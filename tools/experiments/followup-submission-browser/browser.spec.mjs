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
const secret='submission browser test secret';
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{FollowupsPage}from'./crm-lead-followup-parity-pages';import{writeTenantSession}from'./tenant-session';globalThis.switchSession=writeTenantSession;createRoot(document.getElementById('app')).render(<FollowupsPage/>);`,resolveDir:resolve('apps/web/src'),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic'});
await test('canonical FollowupsPage durable manual scheduling over real HTTP (fixture server)',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'elhafez-submission-'));
 const receipts=new Map(),requests=[];
 let effects=0,loseNext=false,rejectNext=false,malformedNext=false,slowNext=false,context;
 const server=createServer(async(req,res)=>{
  if(req.url==='/app.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
  if(req.url?.startsWith('/api/')){
   res.setHeader('content-type','application/json');
   if(req.method==='POST'){
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=JSON.parse(raw);requests.push({body,company:req.headers['x-company-id'],branch:req.headers['x-branch-id'],auth:req.headers.authorization});
    if(rejectNext){rejectNext=false;res.writeHead(403);res.end(JSON.stringify({message:'fixture access denied'}));return;}
    const key=JSON.stringify([req.headers['x-company-id'],req.headers['x-branch-id'],req.headers.authorization,body.requestId]);
    if(!body.requestId){res.writeHead(400);res.end(JSON.stringify({message:'request identity missing'}));return;}
    let receipt=receipts.get(key);
    if(receipt&&receipt.raw!==raw){res.writeHead(400);res.end(JSON.stringify({message:'identity payload changed'}));return;}
    if(!receipt){receipt={raw,result:{id:`accepted-${++effects}`,status:'SCHEDULED'}};receipts.set(key,receipt);}
    if(loseNext){loseNext=false;res.writeHead(200);res.flushHeaders();res.write('{"partial":');setTimeout(()=>res.destroy(),30);return;}
    if(malformedNext){malformedNext=false;res.end('{}');return;}
    if(slowNext){slowNext=false;setTimeout(()=>res.end(JSON.stringify(receipt.result)),100);return;}
    res.end(JSON.stringify(receipt.result));return;
   }
   res.end(JSON.stringify(req.url==='/api/crm/leads'?[{id:'lead-a',number:'L1',displayName:'Fixture Lead',status:'NEW'}]:req.url==='/api/crm/insights/assignees'?[{id:'user-a',displayName:'Fixture User'}]:[]));return;
  }
  res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="ar"><body><div id="app"></div><script type="module" src="/app.js"></script></body></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const launch=()=>chromium.launchPersistentContext(join(directory,'profile'),{headless:true,...process.env.OFFLINE_PROOF_CHROMIUM?{executablePath:process.env.OFFLINE_PROOF_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const ready=async()=>{
  const page=await context.newPage();page.setDefaultTimeout(5000);await page.addInitScript(value=>globalThis.sessionStorage.setItem('elhafez.tenantSession',JSON.stringify(value)),session);
  await page.goto(origin);await page.getByText('جدولة متابعة',{exact:true}).click();return page;
 };
 const form=page=>page.locator('form').first(),area=page=>page.getByRole('complementary',{name:'طلب إرسال المتابعة'});
 const phrase=(page,value=secret)=>page.getByRole('complementary',{name:'مسودة المتابعة المحلية'}).locator('input').fill(value);
 const fields=async(page,note='PRIVATE PENDING FOLLOWUP')=>{await form(page).getByRole('combobox').nth(0).selectOption('lead-a');await form(page).getByRole('combobox').nth(1).selectOption('user-a');await form(page).locator('input[type=datetime-local]').fill('2026-12-10T10:00');await form(page).locator('input').last().fill(note);};
 const notice=async(page,text)=>{try{await area(page).getByRole('status').filter({hasText:text}).waitFor();}catch(error){console.log('Unexpected submission status:',await area(page).innerText(),'requests:',JSON.stringify(requests.map(r=>r.body)));throw error;}};
 const act=async(page,name,text)=>{await area(page).getByRole('button',{name,exact:true}).click();await notice(page,text);};
 const submit=async(page,text)=>{await form(page).getByRole('button',{name:'جدولة المتابعة',exact:true}).click();await notice(page,text);};
 const rows=page=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=globalThis.indexedDB.open('elhafez.followup-drafts.v1');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('drafts'),q=tx.objectStore('drafts').getAll();q.onsuccess=()=>{resolve(q.result.map(v=>({id:v.id,operationId:v.operationId,ciphertext:Array.from(new Uint8Array(v.ciphertext))})));db.close();};};}));
 let page;
 try{
  context=await launch();page=await ready();
  await t.test('no send without a valid protection phrase',async()=>{await fields(page);await submit(page,'١٢ حرفًا');assert.equal(requests.length,0);});
  await t.test('offline submission persists encrypted identity and payload before HTTP',async()=>{
   await phrase(page);await context.setOffline(true);await submit(page,'لم نحذف');
   assert.equal(effects,0);const saved=await rows(page);assert.equal(saved.length,1);assert.ok(saved[0].operationId);assert.equal(JSON.stringify(saved).includes('PRIVATE PENDING FOLLOWUP'),false);
  });
  await t.test('ordinary draft deletion cannot remove pending submission',async()=>{
   const draft=page.getByRole('complementary',{name:'مسودة المتابعة المحلية'});await draft.getByRole('button',{name:'حذف المسودة المحلية'}).click();await draft.getByRole('status').filter({hasText:'حُذفت'}).waitFor();assert.equal((await rows(page)).length,1);
  });
  let identity;
  await t.test('browser restart restores same identity; lost response after server acceptance remains retryable',async()=>{
   identity=(await rows(page))[0].operationId;await context.close();context=await launch();page=await ready();await phrase(page);
   loseNext=true;await act(page,'إعادة محاولة الطلب المحفوظ','لم نحذف');assert.equal(effects,1);assert.equal(requests.at(-1).body.requestId,identity);
  });
  await t.test('unknown-result request cannot be cleared or silently replaced by changed form',async()=>{
   await act(page,'بدء متابعة جديدة بعد التأكيد','لا يمكن حذف');await fields(page,'CHANGED');const count=requests.length;
   await submit(page,'ببيانات مختلفة');assert.equal(requests.length,count);
  });
  await t.test('retry sends immutable original payload and records acceptance locally',async()=>{
   await act(page,'إعادة محاولة الطلب المحفوظ','تأكد قبول');assert.equal(effects,1);assert.equal(requests.at(-1).body.requestId,identity);assert.equal(requests.at(-1).body.nextAction,'PRIVATE PENDING FOLLOWUP');
   const count=requests.length;await act(page,'إعادة محاولة الطلب المحفوظ','مؤكّد بالفعل');assert.equal(requests.length,count);
  });
  await t.test('new intent requires confirmed prior result, storage failure sends nothing',async()=>{
   await act(page,'بدء متابعة جديدة بعد التأكيد','متابعة جديدة');await fields(page,'SECOND INTENT');
   await page.evaluate(()=>{globalThis.originalPut=globalThis.IDBObjectStore.prototype.put;globalThis.IDBObjectStore.prototype.put=function(){throw new globalThis.DOMException('storage full','QuotaExceededError');};});
   const count=requests.length;
   try{await submit(page,'لم يُحفظ');}finally{await page.evaluate(()=>{globalThis.IDBObjectStore.prototype.put=globalThis.originalPut;});}
   assert.equal(requests.length,count);
  });
  await t.test('two tabs atomically share one pending identity',async()=>{
   const other=await ready();await phrase(other);await fields(other,'SECOND INTENT');
   await Promise.all([submit(page,/تأكد قبول|مؤكّد بالفعل|الطلب السابق مؤكّد/),submit(other,/تأكد قبول|مؤكّد بالفعل|الطلب السابق مؤكّد/)]);assert.equal(effects,2);
   const second=requests.filter(r=>r.body.nextAction==='SECOND INTENT');assert.equal(new Set(second.map(r=>r.body.requestId)).size,1);await other.close();
  });
  await t.test('malformed success leaves request pending and same identity recovers',async()=>{
   await act(page,'بدء متابعة جديدة بعد التأكيد','متابعة جديدة');await fields(page,'MALFORMED RESULT');malformedNext=true;
   await submit(page,'رد الجدولة غير صالح');const id=requests.at(-1).body.requestId;await act(page,'إعادة محاولة الطلب المحفوظ','تأكد قبول');assert.equal(requests.at(-1).body.requestId,id);assert.equal(effects,3);
  });
  await t.test('server denial retains identity and retry can succeed after authorization changes',async()=>{
   await act(page,'بدء متابعة جديدة بعد التأكيد','متابعة جديدة');await fields(page,'DENIED');rejectNext=true;await submit(page,'fixture access denied');
   const id=requests.at(-1).body.requestId;assert.equal(effects,3);await act(page,'إعادة محاولة الطلب المحفوظ','تأكد قبول');assert.equal(effects,4);assert.equal(requests.at(-1).body.requestId,id);
  });
  await t.test('wrong phrase and another actor cannot replay original submission',async()=>{
   await phrase(page,'wrong protection phrase');const count=requests.length;await act(page,'إعادة محاولة الطلب المحفوظ','تعذر فتح');assert.equal(requests.length,count);
   await page.evaluate(value=>globalThis.switchSession({...value,userId:'other-user'}),session);await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page);await act(page,'إعادة محاولة الطلب المحفوظ','لا يوجد');assert.equal(requests.length,count);
  });
  await t.test('switching principal during encryption prevents dispatch under a replacement session',async()=>{
   await page.evaluate(value=>globalThis.switchSession(value),session);await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page);
   await act(page,'بدء متابعة جديدة بعد التأكيد','متابعة جديدة');await fields(page,'SESSION SWITCH');
   await page.evaluate(()=>{globalThis.originalEncrypt=globalThis.crypto.subtle.encrypt.bind(globalThis.crypto.subtle);globalThis.crypto.subtle.encrypt=async(...args)=>{const value=await globalThis.originalEncrypt(...args);await new Promise(resolve=>{globalThis.releaseEncrypt=resolve;});return value;};});
   const count=requests.length;await form(page).getByRole('button',{name:'جدولة المتابعة',exact:true}).click();await page.waitForFunction(()=>typeof globalThis.releaseEncrypt==='function');
   await page.evaluate(value=>{globalThis.switchSession({...value,userId:'other-user',token:'fixture-other'});globalThis.crypto.subtle.encrypt=globalThis.originalEncrypt;globalThis.releaseEncrypt();},session);
   await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page);await act(page,'إعادة محاولة الطلب المحفوظ','لا يوجد');assert.equal(requests.length,count);
   await page.evaluate(value=>globalThis.switchSession(value),session);await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page);
   await act(page,'إعادة محاولة الطلب المحفوظ','تأكد قبول');assert.equal(effects,5);assert.equal(requests.at(-1).auth,'Bearer fixture-only');
  });
  await t.test('bounded HTTP timeout preserves accepted-but-unacknowledged request identity',async()=>{
   await act(page,'بدء متابعة جديدة بعد التأكيد','متابعة جديدة');await fields(page,'TIMEOUT');slowNext=true;
   await page.evaluate(()=>{globalThis.originalTimeout=globalThis.AbortSignal.timeout;globalThis.AbortSignal.timeout=()=>globalThis.originalTimeout.call(globalThis.AbortSignal,20);});
   try{await submit(page,'لم نحذف');}finally{await page.evaluate(()=>{globalThis.AbortSignal.timeout=globalThis.originalTimeout;});}
   const id=requests.at(-1).body.requestId;assert.equal(effects,6);await act(page,'إعادة محاولة الطلب المحفوظ','تأكد قبول');assert.equal(requests.at(-1).body.requestId,id);assert.equal(effects,6);
  });
 }finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});
