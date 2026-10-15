import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),{chromium}=require('../offline-proof/node_modules/playwright');
const scope={companyId:'company-a',branchId:'branch-a',userId:'user-a'},secret='backup browser phrase';
const session={...scope,token:'fixture-only',username:'fixture',mustChangePassword:false,expiresAt:new Date(Date.now()+3600000).toISOString(),companyCode:'fixture',companyName:'fixture',branches:[{id:'branch-a',name:'fixture',active:true,companyId:'company-a'}],subscription:{allowed:true,status:'ACTIVE',reason:null}};
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{FollowupsPage}from'./crm-lead-followup-parity-pages';import * as store from './followup-draft-store';globalThis.backupStore=store;createRoot(document.getElementById('app')).render(<FollowupsPage/>);`,resolveDir:resolve('apps/web/src'),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic'});
await test('actual queue download/import with encrypted archive and atomic additive merge (HTTP fixture)',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'elhafez-backup-')),contexts=[];let posts=0,backup,source,target,page,ids;
 const server=createServer(async(req,res)=>{
  if(req.url==='/app.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
  if(req.url?.startsWith('/api/')){if(req.method==='POST')posts++;res.setHeader('content-type','application/json');res.end('[]');return;}
  res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="ar"><div id="app"></div><script type="module" src="/app.js"></script></html>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const launch=async(name)=>{const c=await chromium.launchPersistentContext(join(dir,name),{headless:true,acceptDownloads:true,...process.env.OFFLINE_PROOF_CHROMIUM?{executablePath:process.env.OFFLINE_PROOF_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});contexts.push(c);return c;};
 const ready=async(context)=>{const p=await context.newPage();p.setDefaultTimeout(8000);await p.addInitScript(v=>globalThis.sessionStorage.setItem('elhafez.tenantSession',JSON.stringify(v)),session);await p.goto(origin);await p.getByText('جدولة متابعة',{exact:true}).click();await p.getByRole('complementary',{name:'مسودة المتابعة المحلية'}).locator('input').fill(secret);return p;};
 const area=p=>p.getByRole('complementary',{name:'نسخة احتياطية لطلبات المتابعة',exact:true});
 const list=p=>p.evaluate(({scope,secret})=>globalThis.backupStore.listFollowupSubmissions(scope,secret),{scope,secret});
 const restore=(p,text=backup,phrase=secret,s=scope)=>p.evaluate(({scope,secret,text})=>globalThis.backupStore.restoreFollowupQueueBackup(scope,secret,text),{scope:s,secret:phrase,text});
 const clear=p=>p.evaluate(()=>new Promise((resolve,reject)=>{const q=globalThis.indexedDB.deleteDatabase('elhafez.followup-drafts.v1');q.onsuccess=()=>resolve();q.onerror=()=>reject(q.error);}));
 const mutate=(p,text,kind)=>p.evaluate(async({text,secret,scope,kind})=>{
  const file=JSON.parse(text),bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const material=await globalThis.crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveKey']);
  const key=await globalThis.crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(file.salt),iterations:150000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const aad=new TextEncoder().encode(JSON.stringify([scope.companyId,scope.branchId,scope.userId])+':queue-backup-v1');
  const payload=JSON.parse(new TextDecoder().decode(await globalThis.crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(file.iv),additionalData:aad},key,bytes(file.ciphertext))));
  if(kind==='firstOnly')payload.submissions=payload.submissions.filter(v=>v.accepted===null);
  if(kind==='conflict')payload.submissions[0].payload.nextAction='CONFLICTING PAYLOAD';
  if(kind==='duplicate')payload.submissions.push(payload.submissions[0]);
  if(kind==='invalid')payload.submissions[0].accepted={id:'fake',status:'UNKNOWN'};
  const iv=globalThis.crypto.getRandomValues(new Uint8Array(12)),cipher=new Uint8Array(await globalThis.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,new TextEncoder().encode(JSON.stringify(payload))));
  const encode=b=>btoa(Array.from(b,c=>String.fromCharCode(c)).join(''));return JSON.stringify({...file,iv:encode(iv),ciphertext:encode(cipher)});
 },{text,secret,scope,kind});
 try{
  source=await launch('source');page=await ready(source);
  await t.test('real UI downloads encrypted intents with no plaintext payload or session',async()=>{
   ids=await page.evaluate(async({scope,secret})=>{
    const store=globalThis.backupStore,payload={leadId:'lead-private',responsibleUserId:'user-a',interactionType:'CALL',scheduledAt:'2026-12-12T10:00:00Z',nextAction:'PRIVATE BACKUP NOTE'};
    const first=await store.prepareFollowupSubmission(scope,secret,payload);await store.beginAnotherFollowupSubmission(scope,secret);
    const second=await store.prepareFollowupSubmission(scope,secret,{...payload,nextAction:'ACCEPTED ARCHIVE NOTE'});await store.acceptFollowupSubmission(scope,secret,second,{id:'previous-confirmation',status:'CANCELLED'});
    return [first.requestId,second.requestId];
   },{scope,secret});
   const download=page.waitForEvent('download');await area(page).getByRole('button',{name:'تنزيل نسخة طلبات المتابعة المشفرة'}).click();const file=await download;await file.saveAs(join(dir,'backup.json'));backup=await readFile(join(dir,'backup.json'),'utf8');
   for(const value of ['PRIVATE BACKUP NOTE','ACCEPTED ARCHIVE NOTE','lead-private','fixture-only','previous-confirmation'])assert.ok(!backup.includes(value));assert.equal(JSON.parse(backup).format,'elhafez-followup-queue');assert.equal(posts,0);
  });
  target=await launch('target');page=await ready(target);
  await t.test('file picker restores into a different browser profile without POST or identity changes',async()=>{
   await area(page).locator('input[type=file]').setInputFiles(join(dir,'backup.json'));await area(page).getByRole('button',{name:'استرجاع طلبات الملف دون إرسال'}).click();await area(page).getByRole('status').filter({hasText:'استُرجع 2 طلب'}).waitFor();
   const values=await list(page);assert.deepEqual(values.map(v=>v.requestId).sort(),[...ids].sort());assert.equal(values.find(v=>v.requestId===ids[1]).accepted.status,'CANCELLED');assert.equal(posts,0);
  });
  await t.test('repeated restore adds nothing and never downgrades a current receipt',async()=>{
   const values=await list(page);await page.evaluate(async({scope,secret,value})=>globalThis.backupStore.acceptFollowupSubmission(scope,secret,value,{id:'newer-confirmation',status:'COMPLETED'}),{scope,secret,value:values.find(v=>v.requestId===ids[0])});
   assert.deepEqual(await restore(page),{added:0,retained:2});assert.equal((await list(page)).find(v=>v.requestId===ids[0]).accepted.id,'newer-confirmation');
  });
  await t.test('wrong phrase, tampering and wrong actor/company/branch change no stored data',async()=>{
   const before=await list(page);await assert.rejects(restore(page,backup,'wrong phrase 12345'));
   const broken=JSON.parse(backup);broken.ciphertext=(broken.ciphertext[0]==='A'?'B':'A')+broken.ciphertext.slice(1);await assert.rejects(restore(page,JSON.stringify(broken)));
   for(const change of [{userId:'user-b'},{companyId:'company-b'},{branchId:'branch-b'}])await assert.rejects(restore(page,backup,secret,{...scope,...change}));
   assert.deepEqual(await list(page),before);
  });
  await t.test('conflicting identity, duplicate identities and invalid accepted data fail closed',async()=>{
   const before=await list(page);for(const kind of ['conflict','duplicate','invalid'])await assert.rejects(restore(page,await mutate(page,backup,kind)));assert.deepEqual(await list(page),before);
  });
  await t.test('malformed, unsupported and oversized files are rejected without writes',async()=>{
   const before=await list(page);await assert.rejects(restore(page,'not json'));await assert.rejects(restore(page,JSON.stringify({...JSON.parse(backup),version:999})));await assert.rejects(restore(page,' '.repeat(5*1024*1024+1)));assert.deepEqual(await list(page),before);
  });
  await t.test('atomic restore abort retains zero partial additions; retry restores all',async()=>{
   await clear(page);await page.evaluate(()=>{const original=globalThis.IDBObjectStore.prototype.add;let count=0;globalThis.IDBObjectStore.prototype.add=function(...args){const result=original.apply(this,args);if(++count===2)this.transaction.abort();return result;};globalThis.restoreAdd=()=>{globalThis.IDBObjectStore.prototype.add=original;};});
   await assert.rejects(restore(page));assert.deepEqual(await list(page),[]);await page.evaluate(()=>globalThis.restoreAdd());assert.deepEqual(await restore(page),{added:2,retained:0});
  });
  await t.test('a receipt arriving during import aborts the stale merge without partial additions',async()=>{
   await clear(page);await restore(page,await mutate(page,backup,'firstOnly'));
   await page.evaluate(({scope,secret,text,id})=>{
    const original=globalThis.crypto.subtle.encrypt.bind(globalThis.crypto.subtle);
    globalThis.crypto.subtle.encrypt=async(...args)=>{if(new TextDecoder().decode(args[0].additionalData).endsWith(':'+id))await new Promise(resolve=>{globalThis.releaseImport=resolve;});return original(...args);};
    globalThis.restoreEncrypt=()=>{globalThis.crypto.subtle.encrypt=original;};
    globalThis.importing=globalThis.backupStore.restoreFollowupQueueBackup(scope,secret,text).then(()=>false,()=>true);
   },{scope,secret,text:backup,id:ids[1]});
   await page.waitForFunction(()=>typeof globalThis.releaseImport==='function');
   await page.evaluate(async({scope,secret})=>{const value=(await globalThis.backupStore.listFollowupSubmissions(scope,secret))[0];await globalThis.backupStore.acceptFollowupSubmission(scope,secret,value,{id:'concurrent-confirmation',status:'COMPLETED'});globalThis.releaseImport();},{scope,secret});
   assert.equal(await page.evaluate(()=>globalThis.importing),true);await page.evaluate(()=>globalThis.restoreEncrypt());
   const values=await list(page);assert.equal(values.length,1);assert.equal(values[0].accepted.id,'concurrent-confirmation');assert.deepEqual(await restore(page),{added:1,retained:1});
  });
  await t.test('restoring does not replace selected intent, ordinary draft or saved reference snapshot',async()=>{
   const state=await page.evaluate(async({scope,secret})=>{const s=globalThis.backupStore;const draft={leadId:'other-lead',responsibleUserId:'user-a',interactionType:'CALL',scheduledAt:'2026-12-15T10:00:00Z',nextAction:'LOCAL DRAFT STAYS'};const selected=await s.prepareFollowupSubmission(scope,secret,draft);await s.saveFollowupDraft(scope,secret,draft);await s.saveFollowupReferences(scope,secret,{capturedAt:'2026-10-15T10:00:00Z',leads:[],users:[]});return selected;},{scope,secret});
   await restore(page);const after=await page.evaluate(async({scope,secret})=>({selected:await globalThis.backupStore.loadFollowupSubmission(scope,secret),draft:await globalThis.backupStore.loadFollowupDraft(scope,secret),refs:await globalThis.backupStore.loadFollowupReferences(scope,secret)}),{scope,secret});assert.equal(after.selected.requestId,state.requestId);assert.equal(after.draft.nextAction,'LOCAL DRAFT STAYS');assert.equal(after.refs.capturedAt,'2026-10-15T10:00:00Z');
  });
  await t.test('concurrent imports converge without duplicate identities',async()=>{
   await clear(page);const second=await ready(target);
   const outcomes=await Promise.allSettled([restore(page),restore(second)]);assert.ok(outcomes.some(v=>v.status==='fulfilled'));assert.equal((await list(page)).length,2);assert.deepEqual(await restore(second),{added:0,retained:2});await second.close();assert.equal(posts,0);
  });
  await t.test('restored requests survive a browser process restart',async()=>{
   await target.close();contexts.splice(contexts.indexOf(target),1);target=await launch('target');page=await ready(target);assert.deepEqual((await list(page)).map(v=>v.requestId).sort(),[...ids].sort());assert.equal(posts,0);
  });
 }finally{for(const context of contexts)await context.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
