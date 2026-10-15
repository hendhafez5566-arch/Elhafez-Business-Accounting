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
const scope={companyId:'company-a',branchId:'branch-a',userId:'user-a'};
const session={...scope,token:'fixture-only',username:'fixture',mustChangePassword:false,expiresAt:new Date(Date.now()+3600000).toISOString(),companyCode:'fixture',companyName:'fixture',branches:[{id:'branch-a',name:'fixture',active:true,companyId:'company-a'}],subscription:{allowed:true,status:'ACTIVE',reason:null}};
const secret='queue browser test secret';
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{FollowupsPage}from'./crm-lead-followup-parity-pages';import{writeTenantSession}from'./tenant-session';import * as store from './followup-draft-store';globalThis.queueStore=store;globalThis.switchSession=writeTenantSession;createRoot(document.getElementById('app')).render(<FollowupsPage/>);`,resolveDir:resolve('apps/web/src'),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic'});
await test('canonical FollowupsPage multi-item encrypted queue and legacy migration (HTTP fixture)',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'elhafez-queue-'));
 let context,effects=0,loseNote='';const requests=[],receipts=new Map(),denied=new Set();
 const server=createServer(async(req,res)=>{
  if(req.url==='/app.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
  if(req.url==='/blank'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>fixture origin</title>');return;}
  if(req.url?.startsWith('/api/')){
   res.setHeader('content-type','application/json');
   if(req.method==='POST'){
    let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);requests.push(body);
    if(denied.has(body.nextAction)){res.writeHead(403);res.end(JSON.stringify({message:'fixture access denied'}));return;}
    const key=JSON.stringify([req.headers['x-company-id'],req.headers['x-branch-id'],req.headers.authorization,body.requestId]);let receipt=receipts.get(key);
    if(receipt&&receipt.raw!==raw){res.writeHead(400);res.end(JSON.stringify({message:'identity conflict'}));return;}
    if(!receipt){receipt={raw,result:{id:`accepted-${++effects}`,status:'SCHEDULED'}};receipts.set(key,receipt);}
    if(loseNote===body.nextAction){loseNote='';res.writeHead(201);res.flushHeaders();res.write('{"partial":');setTimeout(()=>res.destroy(),30);return;}
    res.writeHead(201);res.end(JSON.stringify(receipt.result));return;
   }
   res.end(JSON.stringify(req.url==='/api/crm/leads'?[{id:'lead-a',number:'L1',displayName:'Fixture Lead',status:'NEW'}]:req.url==='/api/crm/insights/assignees'?[{id:'user-a',displayName:'Fixture User'}]:[]));return;
  }
  res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="ar"><div id="app"></div><script type="module" src="/app.js"></script></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const launch=(profile='main')=>chromium.launchPersistentContext(join(dir,profile),{headless:true,...process.env.OFFLINE_PROOF_CHROMIUM?{executablePath:process.env.OFFLINE_PROOF_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const ready=async()=>{const page=await context.newPage();page.setDefaultTimeout(8000);await page.addInitScript(value=>globalThis.sessionStorage.setItem('elhafez.tenantSession',JSON.stringify(value)),session);await page.goto(origin);await page.getByText('جدولة متابعة',{exact:true}).click();return page;};
 const area=page=>page.getByRole('complementary',{name:'طلب إرسال المتابعة'}),form=page=>page.locator('form').first();
 const phrase=(page,value=secret)=>page.getByRole('complementary',{name:'مسودة المتابعة المحلية'}).locator('input').fill(value);
 const status=(page,text)=>area(page).getByRole('status').filter({hasText:text}).waitFor();
 const act=async(page,name,text)=>{await area(page).getByRole('button',{name,exact:true}).click();await status(page,text);};
 const fields=async(page,note)=>{await form(page).getByRole('combobox').nth(0).selectOption('lead-a');await form(page).getByRole('combobox').nth(1).selectOption('user-a');await form(page).locator('input[type=datetime-local]').fill('2026-12-10T10:00');await form(page).locator('input').last().fill(note);};
 const row=(page,note)=>area(page).getByRole('row').filter({hasText:note});
 const retry=async(page,note,text)=>{await row(page,note).getByRole('button',{name:'إعادة إرسال هذا الطلب'}).click();await status(page,text);};
 const values=page=>page.evaluate(({scope,secret})=>globalThis.queueStore.listFollowupSubmissions(scope,secret),{scope,secret});
 const raw=page=>page.evaluate(()=>new Promise((resolve,reject)=>{const q=globalThis.indexedDB.open('elhafez.followup-drafts.v1');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction('drafts'),r=tx.objectStore('drafts').getAll();r.onsuccess=()=>{resolve({version:db.version,records:r.result.map(v=>({id:v.id,operationId:v.operationId,bytes:Array.from(new Uint8Array(v.ciphertext))}))});db.close();};};}));
 async function seedLegacy(accepted=null){
  const page=await context.newPage();await page.goto(origin+'/blank');
  await page.evaluate(async({scope,secret,accepted})=>{
   const prefix=JSON.stringify([scope.companyId,scope.branchId,scope.userId]);
   const payload={leadId:'lead-a',responsibleUserId:'user-a',interactionType:'CALL',scheduledAt:'2026-12-10T10:00:00.000Z',nextAction:'LEGACY REQUEST'};
   const record=async(id,value,operationId)=>{
    const salt=globalThis.crypto.getRandomValues(new Uint8Array(16)),iv=globalThis.crypto.getRandomValues(new Uint8Array(12));
    const base=await globalThis.crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveKey']);
    const key=await globalThis.crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt']);
    const ciphertext=await globalThis.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,new TextEncoder().encode(JSON.stringify(value)));
    return {id,salt,iv,ciphertext,...operationId?{operationId}:{}};
   };
   const records=await Promise.all([record(prefix+':schedule-request-v1',{requestId:'legacy-request-0001',payload,accepted},'legacy-request-0001'),record(prefix,{...payload,scheduledAt:'2026-12-10T10:00',nextAction:'ORDINARY DRAFT'})]);
   await new Promise((resolve,reject)=>{const q=globalThis.indexedDB.open('elhafez.followup-drafts.v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('drafts',{keyPath:'id'});q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction('drafts','readwrite');for(const value of records)tx.objectStore('drafts').put(value);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
  },{scope,secret,accepted});await page.close();
 }
 let page,original;
 try{
  context=await launch();await seedLegacy();page=await ready();original=await raw(page);
  await t.test('wrong legacy phrase preserves the original record and does not send',async()=>{
   await phrase(page,'wrong queue protection');await act(page,'استرجاع قائمة الطلبات','تعذر فتح');
   const after=await raw(page);assert.deepEqual(after.records,original.records);assert.equal(requests.length,0);
  });
  await t.test('migration write failure retains legacy ciphertext atomically',async()=>{
   await phrase(page);await page.evaluate(()=>{globalThis.oldPut=globalThis.IDBObjectStore.prototype.put;globalThis.IDBObjectStore.prototype.put=function(){throw new globalThis.DOMException('full','QuotaExceededError');};});
   try{await act(page,'استرجاع قائمة الطلبات','لم يتم ترحيل');}finally{await page.evaluate(()=>{globalThis.IDBObjectStore.prototype.put=globalThis.oldPut;});}
   assert.deepEqual((await raw(page)).records,original.records);assert.equal(requests.length,0);
  });
  await t.test('two tabs migrate one legacy identity and leave the ordinary draft intact',async()=>{
   const other=await ready();await phrase(other);await Promise.all([act(page,'استرجاع قائمة الطلبات','تم استرجاع'),act(other,'استرجاع قائمة الطلبات','تم استرجاع')]);await other.close();
   const data=await values(page);assert.equal(data.length,1);assert.equal(data[0].requestId,'legacy-request-0001');assert.equal(data[0].payload.nextAction,'LEGACY REQUEST');assert.equal(data[0].accepted,null);
   const state=await raw(page);assert.equal(state.version,2);assert.equal(state.records.some(r=>r.id.endsWith(':schedule-request-v1')),false);assert.equal(state.records.length,2);
   const draft=page.getByRole('complementary',{name:'مسودة المتابعة المحلية'});await draft.getByRole('button',{name:'استرجاع المسودة المحلية'}).click();await draft.getByRole('status').filter({hasText:'استُرجعت'}).waitFor();assert.equal(await form(page).locator('input').last().inputValue(),'ORDINARY DRAFT');
  });
  await t.test('old application version fails closed after upgrade',async()=>{
   const error=await page.evaluate(()=>new Promise(resolve=>{const q=globalThis.indexedDB.open('elhafez.followup-drafts.v1',1);q.onerror=()=>resolve(q.error.name);q.onsuccess=()=>{q.result.close();resolve('unexpected success');};}));assert.equal(error,'VersionError');
  });
  await t.test('multiple new requests can be queued offline without discarding a pending one',async()=>{
   await context.setOffline(true);
   for(const note of ['OFFLINE A','OFFLINE B','OFFLINE C']){await act(page,'بدء متابعة أخرى مع الاحتفاظ بالمحفوظة','متابعة أخرى');await fields(page,note);await act(page,'حفظ طلب بالقائمة دون إرسال','حُفظ طلب');}
   const data=await values(page);assert.equal(data.length,4);assert.equal(data.filter(r=>!r.accepted).length,4);assert.equal(requests.length,0);
   assert.equal(await area(page).getByRole('row').count(),5);
  });
  await t.test('process restart recovers all requests and can add another while offline',async()=>{
   await context.close();context=await launch();page=await ready();await phrase(page);await act(page,'استرجاع قائمة الطلبات','تم استرجاع');assert.equal((await values(page)).length,4);
   await context.setOffline(true);await act(page,'بدء متابعة أخرى مع الاحتفاظ بالمحفوظة','متابعة أخرى');await fields(page,'AFTER RESTART');await act(page,'حفظ طلب بالقائمة دون إرسال','حُفظ طلب');assert.equal((await values(page)).length,5);assert.equal(requests.length,0);
  });
  await t.test('selection pins original payload; editing cannot silently replace it',async()=>{
   await row(page,'OFFLINE B').getByRole('button',{name:'اختيار الطلب'}).click();await status(page,'استُرجع');await form(page).locator('input').last().fill('UNSAVED EDIT');
   await form(page).getByRole('button',{name:'جدولة المتابعة',exact:true}).click();await status(page,'ببيانات مختلفة');assert.equal(requests.length,0);assert.equal((await values(page)).find(r=>r.payload.nextAction==='OFFLINE B')?.accepted,null);
  });
  await t.test('one denied request does not block another; confirmed rows remain in history',async()=>{
   await context.setOffline(false);denied.add('LEGACY REQUEST');await retry(page,'LEGACY REQUEST','fixture access denied');assert.equal(effects,0);
   await retry(page,'OFFLINE C','تأكد قبول');assert.equal(effects,1);assert.equal(await form(page).locator('input').last().inputValue(),'UNSAVED EDIT');
   assert.equal(await area(page).getByRole('row').count(),5);await area(page).getByRole('checkbox').check();assert.equal(await area(page).getByRole('row').count(),6);assert.match(await row(page,'OFFLINE C').innerText(),/مؤكد/);
  });
  await t.test('lost response and retry affect only the selected request',async()=>{
   loseNote='OFFLINE A';await retry(page,'OFFLINE A','لم نحذف');const id=requests.at(-1).requestId;assert.equal(effects,2);
   await retry(page,'OFFLINE A','تأكد قبول');assert.equal(effects,2);assert.equal(requests.at(-1).requestId,id);assert.equal((await values(page)).length,5);assert.equal((await values(page)).find(r=>r.payload.nextAction==='OFFLINE B')?.accepted,null);
  });
  await t.test('wrong phrase hides the queue and cannot create mixed-key entries',async()=>{
   await phrase(page,'wrong queue protection');await act(page,'استرجاع قائمة الطلبات','تعذر فتح');assert.equal(await area(page).getByRole('row').count(),0);
   await act(page,'بدء متابعة أخرى مع الاحتفاظ بالمحفوظة','تعذر فتح');await phrase(page);assert.equal((await values(page)).length,5);
  });
  await t.test('user, branch and company switches show only their own queue',async()=>{
   for(const change of [{userId:'other-user'},{branchId:'branch-b'},{companyId:'company-b'}]){
    const value={...session,...change};value.branches=[{id:value.branchId,name:'fixture',active:true,companyId:value.companyId}];
    await page.evaluate(value=>globalThis.switchSession(value),value);await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page);await act(page,'استرجاع قائمة الطلبات','تم استرجاع');assert.equal(await area(page).getByRole('row').count(),0);
   }
   await page.evaluate(value=>globalThis.switchSession(value),session);await page.getByText('جدولة متابعة',{exact:true}).click();await phrase(page);await act(page,'استرجاع قائمة الطلبات','تم استرجاع');
  });
  let other;
  await t.test('two tabs retry one row with one server effect',async()=>{
   other=await ready();await phrase(other);await act(other,'استرجاع قائمة الطلبات','تم استرجاع');
   await Promise.all([retry(page,'OFFLINE B','تأكد قبول'),retry(other,'OFFLINE B','تأكد قبول')]);assert.equal(effects,3);const sent=requests.filter(r=>r.nextAction==='OFFLINE B');assert.equal(new Set(sent.map(r=>r.requestId)).size,1);
  });
  await t.test('simultaneous queue creation converges on one identity',async()=>{
   await act(page,'بدء متابعة أخرى مع الاحتفاظ بالمحفوظة','متابعة أخرى');await fields(page,'DOUBLE TAB');await fields(other,'DOUBLE TAB');
   await Promise.all([act(page,'حفظ طلب بالقائمة دون إرسال','حُفظ طلب'),act(other,'حفظ طلب بالقائمة دون إرسال','حُفظ طلب')]);
   const data=await values(page);assert.equal(data.length,6);assert.equal(data.filter(r=>r.payload.nextAction==='DOUBLE TAB').length,1);assert.equal(effects,3);
  });
  await t.test('another tab changing the active selection cannot retarget an existing form',async()=>{
   await act(other,'بدء متابعة أخرى مع الاحتفاظ بالمحفوظة','متابعة أخرى');await fields(other,'OTHER TAB INTENT');await act(other,'حفظ طلب بالقائمة دون إرسال','حُفظ طلب');
   await form(page).locator('input').last().fill('MUTATED');await form(page).getByRole('button',{name:'جدولة المتابعة',exact:true}).click();await status(page,'ببيانات مختلفة');assert.equal((await values(page)).length,7);
   await act(page,'استرجاع قائمة الطلبات','تم استرجاع');await retry(page,'DOUBLE TAB','تأكد قبول');assert.equal(effects,4);assert.equal((await values(page)).find(r=>r.payload.nextAction==='OTHER TAB INTENT')?.accepted,null);await other.close();
  });
  await t.test('accepted legacy request retains its confirmation during migration',async()=>{
   await context.close();context=await launch('accepted-legacy');await seedLegacy({id:'existing-server-record',status:'CANCELLED'});page=await ready();await phrase(page);const count=requests.length;
   await act(page,'استرجاع قائمة الطلبات','تم استرجاع');assert.equal(await area(page).getByRole('row').count(),0);await area(page).getByRole('checkbox').check();assert.match(await row(page,'LEGACY REQUEST').innerText(),/ملغاة/);
   await act(page,'إعادة محاولة الطلب المحفوظ','مؤكّد بالفعل');assert.equal(requests.length,count);
   await act(page,'بدء متابعة جديدة بعد التأكيد','متابعة جديدة');assert.equal((await values(page)).length,1);assert.equal((await values(page))[0].accepted.id,'existing-server-record');
  });
 }finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
