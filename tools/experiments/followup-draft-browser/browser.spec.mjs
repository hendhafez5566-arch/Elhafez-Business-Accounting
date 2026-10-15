import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require('../offline-proof/node_modules/playwright');
const session={token:'fixture-only',userId:'user-a',username:'fixture',mustChangePassword:false,expiresAt:new Date(Date.now()+3600000).toISOString(),companyId:'company-a',companyCode:'fixture',companyName:'fixture',branches:[{id:'branch-a',name:'fixture',active:true,companyId:'company-a'}],branchId:'branch-a',subscription:{allowed:true,status:'ACTIVE',reason:null}};
const secret='draft browser test secret';
const bundled=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{FollowupsPage}from'./crm-lead-followup-parity-pages';import{writeTenantSession}from'./tenant-session';globalThis.switchSession=writeTenantSession;createRoot(document.getElementById('app')).render(<FollowupsPage/>);`,resolveDir:resolve('apps/web/src'),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic'});
const script=bundled.outputFiles[0].text;
await test('canonical FollowupsPage local encrypted drafts in real Chromium',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'elhafez-followup-draft-'));
 let posts=0,context;
 const server=createServer((req,res)=>{
  if(req.url==='/app.js'){res.setHeader('content-type','text/javascript');res.end(script);return;}
  if(req.url?.startsWith('/api/')){
   res.setHeader('content-type','application/json');
   if(req.method==='POST'){posts++;res.end('{}');return;}
   res.end(JSON.stringify(req.url==='/api/crm/leads'?[{id:'lead-a',number:'L1',displayName:'Fixture Lead',status:'NEW'}]:req.url==='/api/crm/insights/assignees'?[{id:'user-a',displayName:'Fixture User'}]:[]));return;
  }
  res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="ar"><body><div id="app"></div><script type="module" src="/app.js"></script></body></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const launch=()=>chromium.launchPersistentContext(join(dir,'profile'),{headless:true,...process.env.OFFLINE_PROOF_CHROMIUM?{executablePath:process.env.OFFLINE_PROOF_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const ready=async()=>{
  const page=await context.newPage();
  await page.addInitScript(value=>globalThis.sessionStorage.setItem('elhafez.tenantSession',JSON.stringify(value)),session);
  await page.goto(origin);await page.getByText('جدولة متابعة',{exact:true}).click();
  await page.getByRole('combobox').first().selectOption('lead-a');return page;
 };
 const draftArea=page=>page.getByRole('complementary',{name:'مسودة المتابعة المحلية'});
 const fillSecret=(page,value=secret)=>draftArea(page).locator('input').fill(value);
 const action=async(page,name,expected)=>{await draftArea(page).getByRole('button',{name,exact:true}).click();await draftArea(page).getByRole('status').filter({hasText:expected}).waitFor();};
 let page;
 try{
  context=await launch();page=await ready();
  await t.test('save from real form while offline never sends a server request',async()=>{
   const form=page.locator('form').first();await form.getByRole('combobox').nth(1).selectOption('user-a');
   await form.locator('input[type=datetime-local]').fill('2026-12-10T10:00');await form.locator('input').last().fill('PRIVATE FOLLOWUP NOTE');
   await fillSecret(page);await context.setOffline(true);
   await action(page,'حفظ مسودة على الجهاز','حُفظت');assert.equal(posts,0);
  });
  await t.test('persisted bytes contain neither note nor passphrase',async()=>{
   const raw=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=globalThis.indexedDB.open('elhafez.followup-drafts.v1');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('drafts'),q=tx.objectStore('drafts').getAll();q.onsuccess=()=>{resolve(JSON.stringify(q.result));db.close();};};}));
   assert.equal(raw.includes('PRIVATE FOLLOWUP NOTE'),false);assert.equal(raw.includes(secret),false);
  });
  await t.test('close browser process, reopen and restore form without any POST',async()=>{
   await context.close();context=await launch();page=await ready();await context.setOffline(true);await fillSecret(page);
   await action(page,'استرجاع المسودة المحلية','استُرجعت');
   assert.equal(await page.locator('form').first().locator('input').last().inputValue(),'PRIVATE FOLLOWUP NOTE');assert.equal(posts,0);
  });
  await t.test('wrong secret fails without overwriting current form',async()=>{
   await page.locator('form').first().locator('input').last().fill('UNSAVED');await fillSecret(page,'wrong secret for test');
   await action(page,'استرجاع المسودة المحلية','تعذر فتح');assert.equal(await page.locator('form').first().locator('input').last().inputValue(),'UNSAVED');
  });
  await t.test('session switch clears form and secret; other actor sees no draft',async()=>{
   await page.evaluate(value=>globalThis.switchSession({...value,userId:'user-b'}),session);
   await page.getByText('جدولة متابعة',{exact:true}).click();
   assert.equal(await draftArea(page).locator('input').inputValue(),'');assert.equal(await page.locator('form').first().locator('input').last().inputValue(),'');
   await fillSecret(page);await action(page,'استرجاع المسودة المحلية','لا توجد');
  });
  await t.test('expired session blocks local writes',async()=>{
   await page.evaluate(value=>globalThis.switchSession({...value,expiresAt:'2020-01-01T00:00:00Z'}),session);
   await page.getByText('جدولة متابعة',{exact:true}).click();await fillSecret(page);
   await action(page,'حفظ مسودة على الجهاز','يلزم تسجيل');
  });
  await t.test('same user in another branch or company cannot restore original draft',async()=>{
   for(const [companyId,branchId] of [['company-a','branch-b'],['company-b','branch-a']]){
    const value={...session,companyId,branchId,branches:[{id:branchId,name:'fixture',active:true,companyId}]};
    await page.evaluate(value=>globalThis.switchSession(value),value);await page.getByText('جدولة متابعة',{exact:true}).click();await fillSecret(page);
    await action(page,'استرجاع المسودة المحلية','لا توجد');
   }
  });
  await t.test('storage write failure reports failure and preserves original draft',async()=>{
   await page.evaluate(value=>globalThis.switchSession(value),session);await page.getByText('جدولة متابعة',{exact:true}).click();await fillSecret(page);
   await page.locator('form').first().locator('input').last().fill('MUST NOT REPLACE');
   await page.evaluate(()=>{globalThis.savedPut=globalThis.IDBObjectStore.prototype.put;globalThis.IDBObjectStore.prototype.put=function(){throw new globalThis.DOMException('storage full','QuotaExceededError');};});
   try{await action(page,'حفظ مسودة على الجهاز','لم تُحفظ');}finally{await page.evaluate(()=>{globalThis.IDBObjectStore.prototype.put=globalThis.savedPut;});}
   await action(page,'استرجاع المسودة المحلية','استُرجعت');assert.equal(await page.locator('form').first().locator('input').last().inputValue(),'PRIVATE FOLLOWUP NOTE');
  });
  await t.test('original actor retains draft and explicit deletion removes it',async()=>{
   await page.evaluate(value=>globalThis.switchSession(value),session);await page.getByText('جدولة متابعة',{exact:true}).click();await fillSecret(page);
   await action(page,'استرجاع المسودة المحلية','استُرجعت');
   await action(page,'حذف المسودة المحلية','حُذفت');await action(page,'استرجاع المسودة المحلية','لا توجد');assert.equal(posts,0);
  });
 }finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
