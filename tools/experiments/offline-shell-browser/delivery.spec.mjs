import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
for(const script of ['apps/web/scripts/serve.mjs','deploy/railway/static-proxy.mjs']){
 await test(script+' serves the worker without immutable caching',async()=>{
  const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  const child=spawn(process.execPath,[script],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  try{
   await once(child.stdout,'data');
   const worker=await fetch(`http://127.0.0.1:${port}/offline-worker.js`);
   assert.equal(worker.status,200);assert.match(worker.headers.get('content-type'),/javascript/);assert.equal(worker.headers.get('cache-control'),'no-store');assert.match(await worker.text(),/const CACHE=/);
   const html=await fetch(`http://127.0.0.1:${port}/`);assert.equal(html.headers.get('cache-control'),'no-store');
   const asset=(await readFile('apps/web/dist/index.html','utf8')).match(/src="([^"]+)"/)[1];const js=await fetch(`http://127.0.0.1:${port}${asset}`);assert.match(js.headers.get('cache-control'),/immutable/);
  }finally{child.kill('SIGTERM');await once(child,'exit');}
 });
}
