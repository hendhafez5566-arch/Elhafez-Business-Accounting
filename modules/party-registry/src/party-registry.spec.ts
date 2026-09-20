import assert from 'node:assert/strict';
import test from 'node:test';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import type { PartyAccess } from './application/party-access.js';
import { PartyRegistryApplicationService } from './application/party-registry.application-service.js';
import { InMemoryPartyRegistryRepository } from './infrastructure/in-memory-party-registry.repository.js';

class Access implements PartyAccess {
  readonly permissions:string[]=[];
  async requireBranch(context:ExecutionContext){ if(context.branchId==='blocked') throw new Error('branch access denied'); }
  async requirePermission(_context:ExecutionContext,permission:string){this.permissions.push(permission);}
  async audit():Promise<void>{}
}
const ctx=executionContext('company-a','branch-a','user-a');
const ctxB=executionContext('company-b','branch-b','user-b');

test('party registry normalizes, isolates companies and links roles', async()=>{
  let n=0; const access=new Access(); const service=new PartyRegistryApplicationService(new InMemoryPartyRegistryRepository(),access,()=>new Date('2026-09-20T12:00:00Z'),()=>String(++n));
  const created=await service.create(ctx,{kind:'PERSON',displayName:'  Mohamed   Hafez ',nationalIdentity:' 123-456 ',phone:'+20 100 200 3000',email:'TEST@EXAMPLE.COM'});
  if(created.status!=='CREATED') assert.fail('party should be created');
  assert.equal(created.party.displayName,'Mohamed Hafez');
  await service.ensureRoleForIntegration(ctx,created.party.id,'CUSTOMER');
  assert.deepEqual(await service.roles(ctx,created.party.id),['CUSTOMER']);
  const same=await service.create(ctx,{kind:'PERSON',displayName:'Mohamed Other',nationalIdentity:'123456'});
  assert.equal(same.status,'MATCHED');
  const otherCompany=await service.create(ctxB,{kind:'PERSON',displayName:'Mohamed Other',nationalIdentity:'123456'});
  assert.equal(otherCompany.status,'CREATED');
  await assert.rejects(()=>service.get(executionContext('company-b','branch-b','user-b'),created.party.id));
});

test('contact evidence is confident only when phone and email converge; otherwise review is required', async()=>{
  let n=100; const service=new PartyRegistryApplicationService(new InMemoryPartyRegistryRepository(),new Access(),()=>new Date('2026-09-20T12:00:00Z'),()=>String(++n));
  await service.create(ctx,{kind:'PERSON',displayName:'A',phone:'01000000001',email:'a@example.com'});
  const both=await service.resolveDuplicateForIntegration(ctx,{kind:'PERSON',displayName:'A2',phone:'01000000001',email:'A@example.com'});
  assert.equal(both.status,'CONFIDENT_MATCH');
  await service.create(ctx,{kind:'PERSON',displayName:'B',phone:'01000000002',email:'b@example.com'});
  const one=await service.resolveDuplicateForIntegration(ctx,{kind:'PERSON',displayName:'C',phone:'01000000001'});
  assert.equal(one.status,'REVIEW_REQUIRED');
  const split=await service.resolveDuplicateForIntegration(ctx,{kind:'PERSON',displayName:'D',phone:'01000000001',email:'b@example.com'});
  assert.equal(split.status,'REVIEW_REQUIRED');
});

test('concurrent strong-identity resolve-or-create converges on one party', async()=>{
  let n=200; const service=new PartyRegistryApplicationService(new InMemoryPartyRegistryRepository(),new Access(),()=>new Date('2026-09-20T12:00:00Z'),()=>String(++n));
  const [a,b]=await Promise.all([
    service.resolveOrCreateForIntegration(ctx,{kind:'PERSON',displayName:'Concurrent',nationalIdentity:'998877'}),
    service.resolveOrCreateForIntegration(ctx,{kind:'PERSON',displayName:'Concurrent',nationalIdentity:'998877'}),
  ]);
  if(a.status==='REVIEW_REQUIRED'||b.status==='REVIEW_REQUIRED') assert.fail('concurrent strong identity should converge');
  assert.equal(a.party.id,b.party.id);
});

test('unauthorized branch access is rejected',async()=>{
  const service=new PartyRegistryApplicationService(new InMemoryPartyRegistryRepository(),new Access());
  await assert.rejects(()=>service.create(executionContext('company-a','blocked','user-a'),{kind:'PERSON',displayName:'Blocked'}),/branch access denied/);
});
