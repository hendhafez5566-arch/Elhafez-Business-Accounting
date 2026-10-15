import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,extname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {offlineWorker} from '../../../apps/web/scripts/offline-worker.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('../offline-proof/node_modules/playwright');
const dist=resolve('apps/web/dist');
await test('production public shell offline lifecycle; no cached authorization or API',async t=>{
 const profile=await mkdtemp(join(tmpdir(),'elhafez-shell-'));
 let context,online=true,revision='production',broken=false;const received=[];
 const server=createServer(async(req,res)=>{
  received.push(req.url);
  if(!online){req.socket.destroy();return;}
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api')||path.startsWith('/owner')||path==='/healthz'){
   res.setHeader('content-type','application/json');res.end(JSON.stringify({secret:'NOT-FOR-CACHE'}));return;
  }
  const file=path.startsWith('/assets/')?path:'/index.html';
  if(broken&&file.endsWith('.css')){res.writeHead(503);res.end('missing');return;}
  try{
   let bytes=await readFile(join(dist,path==='/offline-worker.js'?path:file));
   if(revision!=='production'&&path==='/offline-worker.js'){
    const source=await readFile(join(dist,'offline-worker.js'),'utf8');
    const assets=JSON.parse(source.match(/const ASSETS=(.*);/)[1]).filter(p=>p!=='/index.html');
    bytes=Buffer.from(offlineWorker(revision,assets,await readFile(join(dist,'index.html'),'utf8')));
   }
   res.setHeader('content-type',path==='/offline-worker.js'||extname(file)==='.js'?'text/javascript':extname(file)==='.css'?'text/css':'text/html');
   res.setHeader('cache-control','no-store');
   res.setHeader('content-security-policy',"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'");
   res.end(bytes);
  }catch(error){res.writeHead(500);res.end(error.message);}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const launch=()=>chromium.launchPersistentContext(profile,{headless:true,...process.env.OFFLINE_PROOF_CHROMIUM?{executablePath:process.env.OFFLINE_PROOF_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const keys=page=>page.evaluate(async()=>{const result={};for(const name of await globalThis.caches.keys())result[name]=(await(await globalThis.caches.open(name)).keys()).map(r=>r.url);return result;});
 try{
  context=await launch();let page=await context.newPage();page.setDefaultTimeout(10000);
  await t.test('actual built entry installs and controls under production CSP',async()=>{
   await page.goto(origin);await page.getByRole('heading',{name:'منصة الحافظ لإدارة الأعمال'}).waitFor();
   await page.evaluate(()=>navigator.serviceWorker.ready);
   await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
   const entries=Object.values(await keys(page)).flat();assert.ok(entries.some(p=>p.endsWith('/index.html')));assert.ok(entries.some(p=>p.endsWith('.css')));assert.ok(entries.some(p=>p.endsWith('.js')));assert.ok(entries.every(p=>p.endsWith('/index.html')||p.includes('/assets/')));
  });
  await t.test('browser restart with server unavailable loads deep link and offline notice',async()=>{
   await context.close();online=false;context=await launch();await context.setOffline(true);page=await context.newPage();page.setDefaultTimeout(8000);
   await page.goto(origin+'/crm/followups');await page.getByRole('heading',{name:'منصة الحافظ لإدارة الأعمال'}).waitFor();
   await page.getByRole('status').filter({hasText:'الإنترنت غير متصل'}).waitFor();
   assert.equal(await page.evaluate(()=>globalThis.sessionStorage.getItem('elhafez.tenantSession')),null);
  });
  await t.test('offline login never fabricates an authenticated session',async()=>{
   await page.getByLabel('كود الشركة').fill('ELH-TEST');await page.getByLabel('اسم المستخدم').fill('manager');await page.getByLabel('كلمة المرور').fill('test-password-123');
   await page.getByRole('button',{name:'دخول',exact:true}).click();
   await page.waitForFunction(()=>!globalThis.document.querySelector('button[type=submit]')?.disabled);
   assert.equal(await page.evaluate(()=>globalThis.sessionStorage.getItem('elhafez.tenantSession')),null);
   await page.getByRole('heading',{name:'منصة الحافظ لإدارة الأعمال'}).waitFor();
  });
  await t.test('API POST/GET, Owner navigation and health never use shell fallback',async()=>{
   const outcomes=await page.evaluate(async()=>{const out=[];for(const path of ['/api/private','/api','/owner','/owner/private','/healthz'])try{await fetch(path);out.push(true);}catch{out.push(false);}try{await fetch('/api/command',{method:'POST',body:'x'});out.push(true);}catch{out.push(false);}return out;});assert.deepEqual(outcomes,[false,false,false,false,false,false]);
   const owner=await context.newPage();await assert.rejects(owner.goto(origin+'/owner'));await owner.close();
  });
  await t.test('online server responses and authenticated-looking headers never enter caches',async()=>{
   online=true;await context.setOffline(false);await page.reload();
   await page.evaluate(async()=>{await fetch('/api/private',{headers:{authorization:'Bearer fixture-only'}});await fetch('/owner/private');await fetch('/healthz');});
   assert.ok(Object.values(await keys(page)).flat().every(p=>p.endsWith('/index.html')||p.includes('/assets/')));
   await page.waitForFunction(()=>!globalThis.document.body.textContent.includes('الإنترنت غير متصل'));
  });
  await t.test('new worker waits rather than replacing code in open tabs',async()=>{
   await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
   revision='next-valid';await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
   await page.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
   await page.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state==='installed');
   assert.equal(Object.keys(await keys(page)).length,2);
   // Close every controlled tab so the browser can activate the update naturally.
   await page.goto('about:blank');await page.waitForTimeout(500);await page.goto(origin);
   await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated'&&!r.waiting;});
   await page.waitForFunction(async()=>(await globalThis.caches.keys()).length===1);
   assert.deepEqual(Object.keys(await keys(page)),['elhafez.public-shell.next-valid']);
  });
  await t.test('incomplete replacement cannot erase last usable offline build',async()=>{
   revision='broken';broken=true;
   const state=await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();const result=new Promise(resolve=>r.addEventListener('updatefound',()=>{const worker=r.installing;worker.addEventListener('statechange',()=>{if(worker.state==='redundant'||worker.state==='installed')resolve(worker.state);});},{once:true}));await r.update();return result;});
   assert.equal(state,'redundant');
   assert.deepEqual(Object.keys(await keys(page)),['elhafez.public-shell.next-valid']);
   online=false;await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'منصة الحافظ لإدارة الأعمال'}).waitFor();
  });
  await t.test('a first visit without an installed build cannot claim offline availability',async()=>{
   const clean=await chromium.launch({headless:true,...process.env.OFFLINE_PROOF_CHROMIUM?{executablePath:process.env.OFFLINE_PROOF_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage']});
   try{const c=await clean.newContext({offline:true});const p=await c.newPage();await assert.rejects(p.goto(origin));}finally{await clean.close();}
  });
 }finally{if(context)await context.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
});
