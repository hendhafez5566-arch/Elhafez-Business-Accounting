import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),{chromium}=require('../offline-proof/node_modules/playwright');
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{AgentHierarchy}from'./agent-hierarchy';createRoot(document.getElementById('app')).render(<AgentHierarchy/>);`,resolveDir:resolve('apps/web/src'),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic'});
await test('canonical agent hierarchy UI with HTTP fixture',async t=>{
 const rows=['a','b','c'].map((id,i)=>({agent:{id,number:'AGT-'+id,status:'ACTIVE',parentAgentId:i===2?'b':null},party:{displayName:'Agent '+id}}));let deny=false,requests=0;
 const server=createServer(async(req,res)=>{
  if(req.url==='/app.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
  if(req.url?.startsWith('/api/')){res.setHeader('content-type','application/json');if(req.method==='POST'){requests++;let raw='';for await(const chunk of req)raw+=chunk;const parent=JSON.parse(raw).parentAgentId,id=req.url.split('/')[4];const row=rows.find(v=>v.agent.id===id);if(deny){res.writeHead(403);res.end(JSON.stringify({message:'fixture permission denied'}));return;}if(id==='b'&&parent==='c'){res.writeHead(400);res.end(JSON.stringify({message:'fixture circular relationship'}));return;}if(!row){res.writeHead(404);res.end('{}');return;}row.agent.parentAgentId=parent;res.end(JSON.stringify(row.agent));return;}res.end(JSON.stringify(rows));return;}
  res.setHeader('content-type','text/html');res.end('<!doctype html><div id="app"></div><script type="module" src="/app.js"></script>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,...process.env.OFFLINE_PROOF_CHROMIUM?{executablePath:process.env.OFFLINE_PROOF_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{const page=await browser.newPage();page.setDefaultTimeout(8000);await page.addInitScript(()=>globalThis.sessionStorage.setItem('elhafez.tenantSession',JSON.stringify({token:'fixture',userId:'actor',username:'fixture',mustChangePassword:false,expiresAt:'2099-01-01',companyId:'company',companyCode:'fixture',companyName:'fixture',branchId:'branch',branches:[],subscription:{allowed:true}})));await page.goto(origin);
  const child=page.getByLabel('المندوب المطلوب ربطه'),parent=page.getByLabel('المندوب الرئيسي'),save=page.getByRole('button',{name:'حفظ علاقة المندوب'});
  await t.test('load existing direct relationships and counts',async()=>{await page.getByRole('row').filter({hasText:'AGT-c — Agent c'}).waitFor();assert.equal(await save.isDisabled(),true);assert.equal(requests,0);});
  await t.test('link an independent agent and retain choices after refresh',async()=>{await child.selectOption('b');await parent.selectOption('a');await save.click();await page.getByRole('status').filter({hasText:'حُفظت علاقة المندوب'}).waitFor();assert.equal(rows[1].agent.parentAgentId,'a');await page.reload();await child.selectOption('b');assert.equal(await parent.inputValue(),'a');});
  await t.test('cycle rejection keeps existing relationship visible',async()=>{await parent.selectOption('c');await save.click();await page.getByRole('status').filter({hasText:'fixture circular relationship'}).waitFor();assert.equal(rows[1].agent.parentAgentId,'a');});
  await t.test('permission rejection cannot detach the relationship',async()=>{deny=true;await parent.selectOption('');await save.click();await page.getByRole('status').filter({hasText:'fixture permission denied'}).waitFor();assert.equal(rows[1].agent.parentAgentId,'a');});
  await t.test('explicit detach returns agent to independent status',async()=>{deny=false;await save.click();await page.getByRole('status').filter({hasText:'حُفظت علاقة المندوب'}).waitFor();assert.equal(rows[1].agent.parentAgentId,null);});
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
