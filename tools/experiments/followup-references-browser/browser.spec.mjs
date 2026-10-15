import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),{chromium}=require('../offline-proof/node_modules/playwright');
const scope={companyId:'company-a',branchId:'branch-a',userId:'user-a'},secret='references browser secret';
const session={...scope,token:'fixture-only',username:'fixture',mustChangePassword:false,expiresAt:new Date(Date.now()+3600000).toISOString(),companyCode:'fixture',companyName:'fixture',branches:[{id:'branch-a',name:'fixture',active:true,companyId:'company-a'}],subscription:{allowed:true,status:'ACTIVE',reason:null}};
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{FollowupsPage}from'./crm-lead-followup-parity-pages';import{writeTenantSession}from'./tenant-session';import * as store from './followup-draft-store';globalThis.refsStore=store;globalThis.switchSession=writeTenantSession;createRoot(document.getElementById('app')).render(<FollowupsPage/>);`,resolveDir:resolve('apps/web/src'),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic'});
await test('encrypted selection snapshots on canonical FollowupsPage (HTTP fixture)',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'elhafez-refs-'));let context,online=true,denied=false,posts=0;
 const server=createServer(async(req,res)=>{
  if(req.url==='/app.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
  if(req.url?.startsWith('/api/')){
   if(!online){req.socket.destroy();return;}
   res.setHeader('content-type','application/json');
   if(req.method==='POST'){posts++;let raw='';for await(const c of req)raw+=c;const payload=JSON.parse(raw);if(payload.leadId!=='lead-a'||payload.responsibleUserId!=='user-a'||!payload.requestId){res.writeHead(400);res.end(JSON.stringify({message:'fixture invalid submission'}));return;}if(denied){res.writeHead(403);res.end(JSON.stringify({message:'fixture revoked assignment'}));}else{res.writeHead(201);res.end(JSON.stringify({id:'accepted-fixture',status:'SCHEDULED'}));}return;}
   res.end(JSON.stringify(req.url==='/api/crm/leads'?[{id:'lead-a',number:'L1',displayName:'Reference Alice',status:'NEW',phone:'SECRET-PHONE',notes:'SECRET-NOTES',expectedValue:'SECRET-FINANCE'},{id:'closed',number:'L2',displayName:'Closed Lead',status:'WON'}]:req.url==='/api/crm/insights/assignees'?[{id:'user-a',displayName:'Reference Employee',email:'SECRET-EMAIL'}]:[]));return;
  }
  res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="ar"><div id="app"></div><script type="module" src="/app.js"></script></html>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const launch=()=>chromium.launchPersistentContext(dir,{headless:true,...process.env.OFFLINE_PROOF_CHROMIUM?{executablePath:process.env.OFFLINE_PROOF_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const ready=async()=>{const p=await context.newPage();p.setDefaultTimeout(8000);await p.addInitScript(v=>globalThis.sessionStorage.setItem('elhafez.tenantSession',JSON.stringify(v)),session);await p.goto(origin);await p.getByText('جدولة متابعة',{exact:true}).click();return p;};
 const refs=p=>p.getByRole('complementary',{name:'قوائم المتابعة المحلية'}),phrase=(p,v=secret)=>p.getByRole('complementary',{name:'مسودة المتابعة المحلية'}).locator('input').fill(v),form=p=>p.locator('form').first();
 const click=async(p,name,notice)=>{await refs(p).getByRole('button',{name,exact:true}).click();await refs(p).getByRole('status').filter({hasText:notice}).waitFor();};
 const loaded=p=>form(p).getByRole('combobox').first().getByRole('option',{name:'L1 — Reference Alice',exact:true}).waitFor({state:'attached'});
 const snapshot=p=>p.evaluate(({scope,secret})=>globalThis.refsStore.loadFollowupReferences(scope,secret),{scope,secret});
 try{
  context=await launch();let page=await ready();
  await t.test('explicit save encrypts minimal mapped references and records capture time',async()=>{
   await loaded(page);await phrase(page);await click(page,'حفظ قوائم الاختيار على الجهاز','حُفظت قوائم الاختيار');
   const value=await snapshot(page);assert.deepEqual(Object.keys(value.leads[0]).sort(),['displayName','id','number','status']);assert.deepEqual(Object.keys(value.users[0]).sort(),['displayName','id']);assert.ok(Date.parse(value.capturedAt)>Date.now()-60000);assert.equal(posts,0);
   const raw=await page.evaluate(()=>new Promise((resolve,reject)=>{const q=globalThis.indexedDB.open('elhafez.followup-drafts.v1');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction('drafts'),r=tx.objectStore('drafts').getAll();r.onsuccess=()=>{resolve(JSON.stringify(r.result.map(v=>({...v,ciphertext:Array.from(new Uint8Array(v.ciphertext))}))));db.close();};};}));
   for(const text of ['Reference Alice','Reference Employee','SECRET-PHONE','SECRET-NOTES','SECRET-FINANCE','SECRET-EMAIL'])assert.ok(!raw.includes(text));
  });
  await t.test('offline reload restores selections by phrase and keeps source timestamp',async()=>{
   online=false;await page.reload();await page.getByText('جدولة متابعة',{exact:true}).click();assert.equal(await form(page).getByRole('combobox').first().locator('option').count(),1);
   await phrase(page);await click(page,'استرجاع قوائم الاختيار المحلية','استُرجعت نسخة محلية');await loaded(page);
   await page.getByRole('status').filter({hasText:'نسخة محلية — تاريخ تحميلها من الخادم:'}).waitFor();
   assert.equal(await refs(page).getByRole('button',{name:'حفظ قوائم الاختيار على الجهاز'}).isDisabled(),true);
   assert.equal(await form(page).getByRole('combobox').first().getByRole('option',{name:'L2 — Closed Lead'}).count(),0);
  });
  await t.test('create a new encrypted queued request entirely offline from restored options',async()=>{
   await form(page).getByRole('combobox').nth(0).selectOption('lead-a');await form(page).getByRole('combobox').nth(1).selectOption('user-a');await form(page).locator('input[type=datetime-local]').fill('2026-12-11T10:00');await form(page).locator('input').last().fill('OFFLINE FROM REFERENCES');
   const queue=page.getByRole('complementary',{name:'طلب إرسال المتابعة'});await queue.getByRole('button',{name:'حفظ طلب بالقائمة دون إرسال'}).click();await queue.getByRole('status').filter({hasText:'حُفظ طلب المتابعة'}).waitFor();assert.equal(posts,0);
   const list=await page.evaluate(({scope,secret})=>globalThis.refsStore.listFollowupSubmissions(scope,secret),{scope,secret});assert.equal(list.length,1);assert.equal(list[0].payload.leadId,'lead-a');assert.equal(list[0].accepted,null);
  });
  await t.test('process restart retains encrypted references but does not supply authentication',async()=>{
   await context.close();context=await launch();page=await ready();await phrase(page);await click(page,'استرجاع قوائم الاختيار المحلية','استُرجعت نسخة محلية');await loaded(page);
   // Session here is an explicit fixture, not restored by the reference store.
   assert.equal(await page.evaluate(()=>globalThis.localStorage.getItem('elhafez.tenantSession')),null);
  });
  await t.test('wrong phrase reveals no names and cannot overwrite an existing snapshot',async()=>{
   const before=await snapshot(page);await page.reload();await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page,'incorrect phrase 123');await click(page,'استرجاع قوائم الاختيار المحلية','تعذر فتح المسودة');assert.equal(await form(page).getByRole('combobox').first().locator('option').count(),1);
   await assert.rejects(page.evaluate(({scope,before})=>globalThis.refsStore.saveFollowupReferences(scope,'incorrect phrase 123',before),{scope,before}));await phrase(page);assert.deepEqual(await snapshot(page),before);
  });
  await t.test('actor, company and branch isolation plus expired session rejection',async()=>{
   for(const change of [{userId:'user-b'},{companyId:'company-b',branches:[{...session.branches[0],companyId:'company-b'}]},{branchId:'branch-b',branches:[{...session.branches[0],id:'branch-b'}]}]){
    await page.evaluate(v=>globalThis.switchSession(v),{...session,...change});await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page);await click(page,'استرجاع قوائم الاختيار المحلية','لا توجد قوائم اختيار');assert.equal(await form(page).getByRole('combobox').first().locator('option').count(),1);
   }
   await page.evaluate(v=>globalThis.switchSession(v),{...session,expiresAt:'2000-01-01T00:00:00Z'});await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page);await click(page,'استرجاع قوائم الاختيار المحلية','يلزم تسجيل دخول صالح');
   await page.evaluate(v=>globalThis.switchSession(v),session);await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page);
  });
  await t.test('late decrypt after changing user cannot restore the previous names',async()=>{
   await page.evaluate(()=>{const original=globalThis.crypto.subtle.decrypt.bind(globalThis.crypto.subtle);globalThis.crypto.subtle.decrypt=async(...args)=>{await new Promise(resolve=>{globalThis.releaseDecrypt=resolve;});return original(...args);};});
   await refs(page).getByRole('button',{name:'استرجاع قوائم الاختيار المحلية'}).click();await page.waitForFunction(()=>typeof globalThis.releaseDecrypt==='function');
   await page.evaluate(v=>{globalThis.switchSession(v);globalThis.releaseDecrypt();},{...session,userId:'user-b'});await page.getByText('جدولة متابعة',{exact:true}).click();assert.equal(await form(page).getByRole('combobox').first().locator('option').count(),1);
   await page.reload();await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page);
  });
  await t.test('stale assignment still requires server acceptance and rejection retains request',async()=>{
   online=true;denied=true;await page.getByRole('complementary',{name:'طلب إرسال المتابعة'}).getByRole('button',{name:'استرجاع قائمة الطلبات'}).click();
   const queue=page.getByRole('complementary',{name:'طلب إرسال المتابعة'});await queue.getByRole('row').filter({hasText:'OFFLINE FROM REFERENCES'}).getByRole('button',{name:'إعادة إرسال هذا الطلب'}).click();await queue.getByRole('status').filter({hasText:'fixture revoked assignment'}).waitFor();assert.equal(posts,1);
   const list=await page.evaluate(({scope,secret})=>globalThis.refsStore.listFollowupSubmissions(scope,secret),{scope,secret});assert.equal(list[0].accepted,null);
  });
  await t.test('deleting selection cache preserves draft and queued request',async()=>{
   await page.evaluate(({scope,secret})=>globalThis.refsStore.saveFollowupDraft(scope,secret,{leadId:'lead-a',responsibleUserId:'user-a',interactionType:'CALL',scheduledAt:'2026-12-11T10:00',nextAction:'draft stays'}),{scope,secret});
   await click(page,'حذف قوائم الاختيار المحلية','حُذفت نسخة قوائم الاختيار');assert.equal(await snapshot(page),null);
   const remaining=await page.evaluate(async({scope,secret})=>({draft:await globalThis.refsStore.loadFollowupDraft(scope,secret),queue:await globalThis.refsStore.listFollowupSubmissions(scope,secret)}),{scope,secret});assert.equal(remaining.draft.nextAction,'draft stays');assert.equal(remaining.queue.length,1);
  });
 }finally{if(context)await context.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
