import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startProofServer} from './server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const passphrase='TEST-ONLY unlock secret';
const scope=(userId,deviceId,companyId='company-a',branchId='branch-a')=>({userId,deviceId,companyId,branchId,expiresAt:Date.now()+86400000});
const unlock=(page,value)=>page.evaluate(({value,passphrase})=>globalThis.proof.unlock(value,passphrase),{value,passphrase});
const queue=(page,input)=>page.evaluate(input=>globalThis.proof.queue(input),input);
const flush=page=>page.evaluate(()=>globalThis.proof.flush());
const list=page=>page.evaluate(()=>globalThis.proof.list());
const launch=profile=>chromium.launchPersistentContext(profile,{headless:true,...process.env.OFFLINE_PROOF_CHROMIUM?{executablePath:process.env.OFFLINE_PROOF_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});

await test('isolated real-browser offline feasibility proof (not ERP acceptance)',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'elhafez-offline-proof-'));
  let service=await startProofServer(join(directory,'proof.sqlite'));
  const origin=service.url;
  let deviceA;
  let deviceB;
  let pageA;
  let pageB;
  const a=scope('a','device-a');
  const b=scope('b','device-b');
  const ready=async(page,online=true)=>{await page.goto(origin);await page.waitForFunction(()=>Boolean(globalThis.proof));if(online)await page.waitForFunction(()=>globalThis.proofWorkerReady===true);};
  const count=id=>service.snapshot().receipts.filter(r=>r.id===id).length;
  try {
    deviceA=await launch(join(directory,'device-a'));
    pageA=await deviceA.newPage();await ready(pageA);await unlock(pageA,a);
    deviceB=await launch(join(directory,'device-b'));
    pageB=await deviceB.newPage();await ready(pageB);await unlock(pageB,b);
    console.log('Browser engine:',await deviceA.browser().version());

    await t.test('offline save is durable and attachment data is encrypted at rest',async()=>{
      await deviceA.setOffline(true);
      const saved=await queue(pageA,{id:'offline-note',text:'CONFIDENTIAL TEST NOTE',attachment:'TEST ATTACHMENT BYTES'});
      assert.equal(saved.state,'PENDING');
      const raw=JSON.stringify(await pageA.evaluate(()=>globalThis.proof.rawRecords()));
      assert.equal(raw.includes('CONFIDENTIAL TEST NOTE'),false);
      assert.equal(raw.includes('TEST ATTACHMENT BYTES'),false);
      await flush(pageA);
      assert.equal((await list(pageA))[0].state,'PENDING');assert.equal(count('offline-note'),0);
    });
    await t.test('browser process restart opens cached shell OFFLINE and recovers pending work',async()=>{
      await deviceA.close();
      deviceA=await launch(join(directory,'device-a'));await deviceA.setOffline(true);
      pageA=await deviceA.newPage();await ready(pageA,false);await unlock(pageA,a);
      const rows=await list(pageA);
      assert.equal(rows.length,1);assert.equal(rows[0].request.text,'CONFIDENTIAL TEST NOTE');
      assert.equal(rows[0].request.attachment,'TEST ATTACHMENT BYTES');assert.equal(rows[0].state,'PENDING');
    });
    await t.test('reconnection uploads immutable request and attachment once',async()=>{
      await deviceA.setOffline(false);await flush(pageA);await flush(pageA);await flush(pageA);
      assert.equal(count('offline-note'),1);
      const row=service.snapshot().notes.find(r=>r.id==='offline-note');
      assert.equal(row.text,'CONFIDENTIAL TEST NOTE');assert.equal(row.attachment,'TEST ATTACHMENT BYTES');
      assert.equal((await list(pageA))[0].state,'SYNCED');
    });
    await t.test('a lost response after COMMIT can be retried without a duplicate effect',async()=>{
      await queue(pageA,{id:'lost-ack',text:'one effect'});service.faults.dropAfterCommit.add('lost-ack');
      await flush(pageA);assert.equal(count('lost-ack'),1);
      await flush(pageA);assert.equal(count('lost-ack'),1);
      assert.equal((await list(pageA)).find(r=>r.id==='lost-ack').state,'SYNCED');
    });
    await t.test('server failure after write rolls back before COMMIT and remains retryable',async()=>{
      await queue(pageA,{id:'server-failure',text:'retry after failure'});service.faults.failDuringTransaction.add('server-failure');
      await flush(pageA);assert.equal(count('server-failure'),0);
      assert.equal(service.snapshot().notes.some(r=>r.id==='server-failure'),false);
      assert.equal((await list(pageA)).find(r=>r.id==='server-failure').state,'PENDING');
      await flush(pageA);assert.equal(count('server-failure'),1);
    });
    await t.test('local save failure is reported and never announced as successful',async()=>{
      await pageA.evaluate(()=>globalThis.proof.failNextSave());
      await assert.rejects(()=>queue(pageA,{id:'local-save-failed',text:'must not exist'}),/storage failure/);
      assert.equal((await list(pageA)).some(r=>r.id==='local-save-failed'),false);
      assert.equal(count('local-save-failed'),0);
    });
    await t.test('reusing an operation ID with a different payload is rejected',async()=>{
      const request=(await list(pageA)).find(r=>r.id==='lost-ack').request;
      const response=await pageA.evaluate(async request=>{
        const r=await fetch('/api/proof/operations',{method:'POST',headers:{'content-type':'application/json','x-proof-actor':'a'},body:JSON.stringify({...request,text:'changed payload'})});
        return{status:r.status,body:await r.json()};
      },request);
      assert.equal(response.status,409);assert.equal(response.body.reason,'IDEMPOTENCY_PAYLOAD_MISMATCH');assert.equal(count('lost-ack'),1);
    });
    await t.test('two disconnected devices compete for one test slot without over-confirmation',async()=>{
      await deviceA.setOffline(true);await deviceB.setOffline(true);
      await queue(pageA,{id:'slot-a',kind:'SLOT'});await queue(pageB,{id:'slot-b',kind:'SLOT'});
      await deviceA.setOffline(false);await deviceB.setOffline(false);
      await Promise.all([flush(pageA),flush(pageB)]);
      const outcomes=[...(await list(pageA)),...(await list(pageB))].filter(r=>r.request.kind==='SLOT').map(r=>r.outcome.outcome).sort();
      assert.deepEqual(outcomes,['CONFIRMED','WAITLIST']);assert.equal(service.snapshot().slots[0].remaining,0);
    });
    await t.test('simultaneous edits from two devices expose a version conflict instead of overwriting',async()=>{
      await queue(pageA,{id:'edit-a',recordId:'shared-record',text:'first',expectedVersion:0});
      await queue(pageB,{id:'edit-b',recordId:'shared-record',text:'second',expectedVersion:0});
      await flush(pageA);await flush(pageB);
      const row=(await list(pageB)).find(r=>r.id==='edit-b');assert.equal(row.state,'REVIEW');assert.equal(row.outcome.reason,'VERSION_CONFLICT');
      const note=service.snapshot().notes.find(r=>r.id==='shared-record');assert.equal(note.text,'first');assert.equal(note.version,1);
    });
    await t.test('scope switching does not reveal another company/user/device outbox',async()=>{
      await unlock(pageA,scope('other','device-other','company-b','branch-b'));assert.deepEqual(await list(pageA),[]);
      await unlock(pageA,a);assert.ok((await list(pageA)).length>0);
      assert.equal((await list(pageB)).some(r=>r.id==='offline-note'),false);
    });
    await t.test('forged company or branch is rejected again by the test server',async()=>{
      const status=await pageA.evaluate(async()=>{
        const response=await fetch('/api/proof/operations',{method:'POST',headers:{'content-type':'application/json','x-proof-actor':'a'},body:JSON.stringify({id:'forged',companyId:'company-b',branchId:'branch-b',userId:'a',kind:'NOTE',recordId:'forged',expectedVersion:0,text:'forged'})});return response.status;
      });assert.equal(status,403);assert.equal(count('forged'),0);
    });
    await t.test('expired offline authorization blocks new operations',async()=>{
      await unlock(pageA,{...a,expiresAt:Date.now()-1});
      await assert.rejects(()=>queue(pageA,{id:'expired',text:'blocked'}),/expired/);
      await unlock(pageA,a);assert.equal((await list(pageA)).some(r=>r.id==='expired'),false);
    });
    await t.test('server restart retains deduplication receipts and test-slot capacity',async()=>{
      const before=service.snapshot();const port=service.port;await service.close();
      service=await startProofServer(join(directory,'proof.sqlite'),port);
      assert.deepEqual(service.snapshot(),before);
      const request=(await list(pageA)).find(r=>r.id==='offline-note').request;
      const status=await pageA.evaluate(async request=>(await fetch('/api/proof/operations',{method:'POST',headers:{'content-type':'application/json','x-proof-actor':'a'},body:JSON.stringify(request)})).status,request);
      assert.equal(status,200);assert.equal(count('offline-note'),1);
    });
    await t.test('revoked permission on reconnection leaves the command visible for review',async()=>{
      await deviceB.setOffline(true);await queue(pageB,{id:'revoked',text:'pending before revocation'});service.revoke('b');await deviceB.setOffline(false);await flush(pageB);
      const row=(await list(pageB)).find(r=>r.id==='revoked');assert.equal(row.state,'REVIEW');assert.equal(row.outcome.reason,'AUTHORIZATION_REJECTED');assert.equal(count('revoked'),0);
    });
    await t.test('incorrect unlock secret cannot decrypt saved payloads',async()=>{
      await pageA.evaluate(scope=>globalThis.proof.unlock(scope,'WRONG TEST SECRET'),a);
      await assert.rejects(()=>list(pageA));await unlock(pageA,a);
      assert.ok((await list(pageA)).length>0);
    });
    await t.test('ciphertext tampering is detected instead of accepting a damaged operation',async()=>{
      await pageA.evaluate(()=>globalThis.proof.corrupt('offline-note'));await assert.rejects(()=>list(pageA));
    });
  } finally {
    await deviceA?.close();await deviceB?.close();await service.close();await rm(directory,{recursive:true,force:true});
  }
});
