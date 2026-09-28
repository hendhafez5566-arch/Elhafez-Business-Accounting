import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {gzipSync} from 'node:zlib';

async function freePort(){
 const server=createServer();
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 const port=server.address().port;
 server.close();
 await once(server,'close');
 return port;
}

test('a cold API is probed before forwarding a bootstrap POST exactly once',async()=>{
 let healthCalls=0,bootstrapCalls=0;
 const api=createServer((request,response)=>{
  if(request.url==='/health'){
   healthCalls++;
   response.writeHead(healthCalls<3?502:200).end();
   return;
  }
  if(request.url==='/saas-owner/bootstrap'){
   bootstrapCalls++;
   response.writeHead(401,{'content-type':'application/json'}).end('{"message":"invalid token"}');
   return;
  }
  response.writeHead(404).end();
 });
 api.listen(0,'127.0.0.1');
 await once(api,'listening');
 const proxyPort=await freePort();
 const child=spawn(process.execPath,['static-proxy.mjs'],{
  cwd:import.meta.dirname,
  env:{...process.env,PORT:String(proxyPort),ELHAFEZ_API_BASE_URL:`http://127.0.0.1:${api.address().port}`,ELHAFEZ_STATIC_ROOT:import.meta.dirname},
  stdio:['ignore','pipe','pipe'],
 });
 try{
  await new Promise((resolve,reject)=>{
   child.stdout.once('data',resolve);
   child.once('error',reject);
   child.once('exit',code=>reject(new Error(`proxy exited: ${code}`)));
  });
  const response=await fetch(`http://127.0.0.1:${proxyPort}/api/saas-owner/bootstrap`,{
   method:'POST',headers:{'content-type':'application/json'},body:'{"email":"test@example.invalid"}',
  });
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{message:'invalid token'});
  assert.equal(healthCalls,3);
  assert.equal(bootstrapCalls,1);
 }finally{
  child.kill();
  api.close();
 }
});

test('API responses are served decoded without stale compression headers',async()=>{
 let upstreamAcceptEncoding=null;
 const payload=JSON.stringify([{company:{id:'company-1',name:'Elhafez'}}]);
 const compressed=gzipSync(payload);
 const api=createServer((request,response)=>{
  if(request.url==='/health'){
   response.writeHead(200).end();
   return;
  }
  if(request.url==='/saas-owner/companies'){
   upstreamAcceptEncoding=request.headers['accept-encoding']??null;
   response.writeHead(200,{
    'content-type':'application/json',
    'content-encoding':'gzip',
    'content-length':String(compressed.length),
   });
   response.end(compressed);
   return;
  }
  response.writeHead(404).end();
 });
 api.listen(0,'127.0.0.1');
 await once(api,'listening');
 const proxyPort=await freePort();
 const child=spawn(process.execPath,['static-proxy.mjs'],{
  cwd:import.meta.dirname,
  env:{...process.env,PORT:String(proxyPort),ELHAFEZ_API_BASE_URL:`http://127.0.0.1:${api.address().port}`,ELHAFEZ_STATIC_ROOT:import.meta.dirname},
  stdio:['ignore','pipe','pipe'],
 });
 try{
  await new Promise((resolve,reject)=>{
   child.stdout.once('data',resolve);
   child.once('error',reject);
   child.once('exit',code=>reject(new Error(`proxy exited: ${code}`)));
  });
  const response=await fetch(`http://127.0.0.1:${proxyPort}/api/saas-owner/companies`,{
   headers:{'accept-encoding':'gzip, deflate, br'},
  });
  assert.equal(response.status,200);
  assert.equal(upstreamAcceptEncoding,'identity');
  assert.equal(response.headers.get('content-encoding'),null);
  assert.equal(Number(response.headers.get('content-length')),Buffer.byteLength(payload));
  assert.deepEqual(await response.json(),[{company:{id:'company-1',name:'Elhafez'}}]);
 }finally{
  child.kill();
  api.close();
 }
});
