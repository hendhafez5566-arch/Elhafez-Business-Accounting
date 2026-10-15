import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),{chromium}=require('../offline-proof/node_modules/playwright');
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{AgentCommissionAgreements}from'./agent-commission-agreements';createRoot(document.getElementById('app')).render(<AgentCommissionAgreements agents={[{agent:{id:'child',number:'C'},party:{displayName:'Child'}},{agent:{id:'parent',number:'P'},party:{displayName:'Parent'}}]}/>);`,resolveDir:resolve('apps/web/src'),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic'});
await test('commercial split UI with explicit manual save and stable retry (HTTP fixture)',async t=>{
 let deny=false,lose=true,requests=0;const agreements=[],receipts=new Map();
 const server=createServer(async(req,res)=>{
  if(req.url==='/app.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
  if(req.url?.startsWith('/api/')){
   res.setHeader('content-type','application/json');
   if(req.method==='POST'){requests++;let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw);if(deny){res.writeHead(403);res.end(JSON.stringify({message:'fixture forbidden'}));return;}
    let result=receipts.get(body.requestId);if(!result){if(body.expectedVersion!==agreements.length){res.writeHead(400);res.end(JSON.stringify({message:'fixture version conflict'}));return;}result={id:'agreement-'+(agreements.length+1),version:agreements.length+1,parentAgentId:'parent',principalPercent:body.principalPercent,subordinatePercent:'66.666667',reason:body.reason,createdAt:'2026-10-15T17:00:00Z'};agreements.unshift(result);receipts.set(body.requestId,result);}
    if(lose){lose=false;res.writeHead(201);res.flushHeaders();res.write('{"partial":');setTimeout(()=>res.destroy(),30);return;}res.writeHead(201);res.end(JSON.stringify(result));return;
   }
   res.end(JSON.stringify({parentAgentId:'parent',agreements}));return;
  }
  res.setHeader('content-type','text/html');res.end('<!doctype html><div id="app"></div><script type="module" src="/app.js"></script>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,...process.env.OFFLINE_PROOF_CHROMIUM?{executablePath:process.env.OFFLINE_PROOF_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{const page=await browser.newPage();page.setDefaultTimeout(8000);await page.addInitScript(()=>globalThis.sessionStorage.setItem('elhafez.tenantSession',JSON.stringify({token:'fixture',userId:'actor',username:'fixture',mustChangePassword:false,expiresAt:'2099-01-01',companyId:'company',companyCode:'fixture',companyName:'fixture',branchId:'branch',branches:[],subscription:{allowed:true}})));await page.goto(origin);
  await t.test('reading selected agent does not create agreement or financial effect',async()=>{await page.getByLabel('المندوب التابع للاتفاق').selectOption('child');await page.getByText('لا توجد نسخ اتفاق محفوظة.').waitFor();assert.equal(requests,0);});
  await t.test('lost response locks payload and retries the same identity exactly once',async()=>{await page.getByLabel('نصيب الرئيسي من العمولة (%)').fill('33.333333');await page.getByLabel('سبب الاتفاق أو مرجعه').fill('Confirmed commercial terms');await page.getByRole('button',{name:'حفظ نسخة اتفاق جديدة'}).click();await page.getByRole('status').filter({hasText:'إعادة المحاولة تستخدم نفس الطلب'}).waitFor();assert.equal(await page.getByLabel('نصيب الرئيسي من العمولة (%)').isDisabled(),true);await page.getByRole('button',{name:'إعادة محاولة حفظ الاتفاق نفسه'}).click();await page.getByRole('status').filter({hasText:'لم ينشأ استحقاق'}).waitFor();assert.equal(agreements.length,1);assert.equal(requests,2);await page.getByRole('cell',{name:'66.666667',exact:true}).waitFor();});
  await t.test('explicit new revision preserves old history and denied write preserves all revisions',async()=>{await page.getByLabel('سبب الاتفاق أو مرجعه').fill('Second agreement');await page.getByRole('button',{name:'حفظ نسخة اتفاق جديدة'}).click();await page.getByRole('status').filter({hasText:'حُفظت نسخة'}).waitFor();assert.equal(agreements.length,2);deny=true;await page.getByLabel('سبب الاتفاق أو مرجعه').fill('Denied agreement');await page.getByRole('button',{name:'حفظ نسخة اتفاق جديدة'}).click();await page.getByRole('status').filter({hasText:'fixture forbidden'}).waitFor();assert.equal(agreements.length,2);});
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
