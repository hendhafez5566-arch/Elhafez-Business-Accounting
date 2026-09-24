import assert from 'node:assert/strict'; import test from 'node:test';
import { companyId, decimalAmount } from '@elhafez/contracts';
import { StandaloneServicesApplicationService, type ConfirmationPort } from './public/index.js';
import { PrismaClient } from '@prisma/client';
import { InMemoryStandaloneServicesRepository } from './infrastructure/in-memory-standalone-services.repository.js';
import { PrismaStandaloneServicesRepository } from './infrastructure/prisma-standalone-services.repository.js';

const confirmation:ConfirmationPort={async prepare(){return {ready:true,blockers:[],planId:'plan-1',planVersion:1};},async commit(){return {operationId:'op-1'};},async cancel(){return {cancelled:true,blockers:[]};}};
function app(){const repo=new InMemoryStandaloneServicesRepository();return {repo,service:new StandaloneServicesApplicationService(repo,confirmation)};}
async function seeded(){const x=app();await x.service.manageServiceType({id:'hotel',companyId:companyId('c1'),code:'HOTEL',category:'HOTEL',nameAr:'فندق',active:true});return x;}
const draft={companyId:companyId('c1'),branchId:'b1',commandKey:'cmd-1',actorId:'u1',id:'s1',number:'S-1',serviceTypeId:'hotel',serviceDate:'2026-10-01',quantity:decimalAmount('1'),debtorKind:'CUSTOMER' as const,debtorPartyId:'p1',customerPartyId:'p1',details:{hotelId:'h1'},currency:'EGP',grossAmount:decimalAmount('1000'),discountAmount:decimalAmount('100'),invoiceNumber:'S-1',postingDate:'2026-09-24',dueDate:'2026-10-01'};

test('draft is idempotent and computes decimal net',async()=>{const {service}=await seeded();const a=await service.createDraft(draft);const b=await service.createDraft(draft);assert.equal(a.id,b.id);const view=await service.getService(companyId('c1'),'s1');assert.equal(view.revision.commercial.netAmount,'900');});
test('conflicting command replay is rejected',async()=>{const {service}=await seeded();await service.createDraft(draft);await assert.rejects(()=>service.createDraft({...draft,id:'s2',number:'S-2'}));});
test('CAS protects draft revision and confirmed service is immutable through draft update',async()=>{const {service}=await seeded();await service.createDraft(draft);await assert.rejects(()=>service.updateDraft({...draft,serviceId:'s1',expectedRevision:0,commandKey:'cmd-2'}));await service.confirm({companyId:companyId('c1'),branchId:'b1',serviceId:'s1',expectedRevision:1,commandKey:'cmd-3',actorId:'u1',planId:'plan-1',planVersion:1});await assert.rejects(()=>service.updateDraft({...draft,serviceId:'s1',expectedRevision:1,commandKey:'cmd-4'}));});
test('confirmation becomes visible only after external commit succeeds',async()=>{const {service}=await seeded();await service.createDraft(draft);const value=await service.confirm({companyId:companyId('c1'),branchId:'b1',serviceId:'s1',expectedRevision:1,commandKey:'cmd-3',actorId:'u1',planId:'plan-1',planVersion:1});assert.equal(value.status,'CONFIRMED');assert.equal(value.externalOperationId,'op-1');});
test('cancellation delegates to owner orchestration before local cancellation',async()=>{const {service}=await seeded();await service.createDraft(draft);await service.confirm({companyId:companyId('c1'),branchId:'b1',serviceId:'s1',expectedRevision:1,commandKey:'cmd-3',actorId:'u1',planId:'plan-1',planVersion:1});const value=await service.requestCancellation({companyId:companyId('c1'),branchId:'b1',serviceId:'s1',commandKey:'cmd-4',actorId:'u1'});assert.equal(value.status,'CANCELLED');});

test('confirm retry resumes the same reviewed plan after an interrupted owner call', async () => {
  const repo = new InMemoryStandaloneServicesRepository();
  await repo.saveType({ id: 'hotel', companyId: companyId('c1'), code: 'HOTEL', category: 'HOTEL', nameAr: 'فندق', active: true });
  let attempts = 0;
  const owner: ConfirmationPort = {
    async prepare() { return { ready: true, blockers: [], planId: 'plan-1', planVersion: 1 }; },
    async commit(input) { assert.equal(input.planId, 'plan-1'); attempts += 1; if (attempts === 1) throw new Error('interrupted'); return { operationId: 'op-1' }; },
    async cancel() { return { cancelled: true, blockers: [] }; },
  };
  const service = new StandaloneServicesApplicationService(repo, owner);
  await service.createDraft(draft);
  const command = { companyId: companyId('c1'), branchId: 'b1', serviceId: 's1', expectedRevision: 1, commandKey: 'retry-confirm', actorId: 'u1', planId: 'plan-1', planVersion: 1 };
  await assert.rejects(() => service.confirm(command), /interrupted/);
  assert.equal((await service.getService(companyId('c1'), 's1')).service.status, 'CONFIRMING');
  assert.equal((await service.confirm(command)).status, 'CONFIRMED');
  assert.equal((await service.confirm(command)).externalOperationId, 'op-1');
  assert.equal(attempts, 2);
});

test('confirmation requires the exact plan reviewed by staff and branch scope', async () => {
  const { service } = await seeded(); await service.createDraft(draft);
  const command = { companyId: companyId('c1'), branchId: 'b1', serviceId: 's1', expectedRevision: 1, commandKey: 'review-confirm', actorId: 'u1', planId: 'changed', planVersion: 1 };
  await assert.rejects(() => service.confirm(command), /reviewed supply plan changed/);
  await assert.rejects(() => service.confirm({ ...command, branchId: 'b2' }), /different branch/);
  assert.equal((await service.getService(companyId('c1'), 's1')).service.status, 'DRAFT');
});

test('blocked cancellation retains posting date and resumes with the same command after settlement',async()=>{
 const {service}=await seeded();await service.createDraft(draft);await service.confirm({companyId:companyId('c1'),branchId:'b1',serviceId:'s1',expectedRevision:1,commandKey:'confirm-1',actorId:'u1',planId:'plan-1',planVersion:1});
 const command={companyId:companyId('c1'),branchId:'b1',serviceId:'s1',commandKey:'cancel-1',actorId:'u1',postingDate:'2026-09-24'};
 await assert.rejects(service.requestCancellation(command,async()=>({cancelled:false,blockers:['CUSTOMER_SETTLEMENT']})),/CUSTOMER_SETTLEMENT/);
 const pending=(await service.getService(companyId('c1'),'s1')).service;assert.equal(pending.status,'CANCELLATION_REQUESTED');assert.equal(pending.cancellationPostingDate,'2026-09-24');
 assert.equal((await service.requestCancellation(command,async()=>({cancelled:true,blockers:[]}))).status,'CANCELLED');
});
test('a service type cannot silently change its category',async()=>{const {service}=await seeded();await assert.rejects(service.manageServiceType({id:'hotel',companyId:companyId('c1'),code:'HOTEL',category:'VISA',nameAr:'تأشيرة',active:true}),/immutable/)});


test('postgres repository resumes confirmation and cancellation after process restart', { skip: !process.env.DATABASE_URL }, async () => {
  const db=new PrismaClient(),company=companyId('ts01-db-company'),branch='ts01-db-branch',serviceId='ts01-db-service',typeId='ts01-db-hotel';
  let commitAttempts=0,cancelAttempts=0;
  const owner:ConfirmationPort={
    async prepare(input){return{ready:true,blockers:[],planId:input.planId,planVersion:input.planVersion}},
    async commit(){commitAttempts+=1;if(commitAttempts===1)throw new Error('simulated-confirm-interruption');return{operationId:'ts01-db-operation'}},
    async cancel(){cancelAttempts+=1;return cancelAttempts===1?{cancelled:false,blockers:['SIMULATED_SETTLEMENT']}:{cancelled:true,blockers:[]}},
  };
  const make=()=>new StandaloneServicesApplicationService(new PrismaStandaloneServicesRepository(db),owner);
  try{
    await db.ssCommandReceipt.deleteMany({where:{companyId:company}});
    await db.ssServiceHistory.deleteMany({where:{serviceId}});
    await db.ssServiceRevision.deleteMany({where:{serviceId}});
    await db.ssService.deleteMany({where:{id:serviceId}});
    await db.ssServiceType.deleteMany({where:{companyId:company,id:typeId}});
    const first=make();
    await first.manageServiceType({id:typeId,companyId:company,code:'DBHOTEL',category:'HOTEL',nameAr:'اختبار PostgreSQL',active:true});
    await first.createDraft({companyId:company,branchId:branch,commandKey:'db-create',actorId:'db-actor',id:serviceId,number:'DB-S-1',serviceTypeId:typeId,serviceDate:'2026-10-01',quantity:decimalAmount('2'),debtorKind:'CUSTOMER',debtorPartyId:'customer-1',customerPartyId:'customer-1',beneficiaryPartyIds:['traveler-1'],details:{source:'postgres'},currency:'EGP',grossAmount:decimalAmount('1000'),discountAmount:decimalAmount('100'),invoiceNumber:'DB-S-1',postingDate:'2026-09-24',dueDate:'2026-10-01'});
    const confirm={companyId:company,branchId:branch,serviceId,expectedRevision:1,commandKey:'db-confirm',actorId:'db-actor',planId:'db-plan',planVersion:1};
    await assert.rejects(make().confirm(confirm),/simulated-confirm-interruption/);
    assert.equal((await db.ssService.findUnique({where:{companyId_id:{companyId:company,id:serviceId}}}))?.status,'CONFIRMING');
    assert.equal((await make().confirm(confirm)).status,'CONFIRMED');
    const cancel={companyId:company,branchId:branch,serviceId,commandKey:'db-cancel',actorId:'db-actor',postingDate:'2026-09-24'};
    await assert.rejects(make().requestCancellation(cancel),/SIMULATED_SETTLEMENT/);
    const pending=await db.ssService.findUnique({where:{companyId_id:{companyId:company,id:serviceId}}});
    assert.equal(pending?.status,'CANCELLATION_REQUESTED');assert.equal(pending?.cancellationPostingDate,'2026-09-24');
    assert.equal((await make().requestCancellation(cancel)).status,'CANCELLED');
    const history=await db.ssServiceHistory.findMany({where:{serviceId},orderBy:{createdAt:'asc'}});
    assert.deepEqual(history.map(x=>x.kind),['DRAFTED','CONFIRMATION_STARTED','CONFIRMED','CANCELLATION_REQUESTED','CANCELLED']);
  }finally{
    await db.ssCommandReceipt.deleteMany({where:{companyId:company}});
    await db.ssServiceHistory.deleteMany({where:{serviceId}});
    await db.ssServiceRevision.deleteMany({where:{serviceId}});
    await db.ssService.deleteMany({where:{id:serviceId}});
    await db.ssServiceType.deleteMany({where:{companyId:company,id:typeId}});
    await db.$disconnect();
  }
});
