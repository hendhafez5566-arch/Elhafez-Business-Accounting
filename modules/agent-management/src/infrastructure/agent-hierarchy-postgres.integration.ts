/** Explicit disposable native acceptance; not part of the unit-test glob. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { executionContext } from '@elhafez/contracts';
import { commissionShares } from '../domain/commission-agreement.js';
import { agentId, type Agent } from '../domain/agent.js';
import { PrismaAgentManagementRepository } from './prisma-agent-management.repository.js';
const databaseUrl=process.env.FOLLOWUP_TEST_DATABASE_URL;
if(!databaseUrl)throw new Error('FOLLOWUP_TEST_DATABASE_URL is required');
const url=new URL(databaseUrl);if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/elhafez_followup_test')throw new Error('disposable loopback database required');
const context=executionContext('agent-graph-'+randomUUID(),'branch','actor'),other=executionContext('other-'+randomUUID(),'branch','actor'),at='2026-10-15T16:00:00Z';
const a=new PrismaClient({datasources:{db:{url:databaseUrl}}}),b=new PrismaClient({datasources:{db:{url:databaseUrl}}}),first=new PrismaAgentManagementRepository(a),second=new PrismaAgentManagementRepository(b);
const key=(name:string)=>context.companyId+'-'+name;
const aid=(name:string)=>agentId(key(name));
const row=(id:string,companyId=context.companyId):Agent=>({id:aid(id),companyId,partyId:'party-'+randomUUID(),number:id,status:'ACTIVE',notes:null,commission:{kind:'PERCENT',value:'5.123456',currency:null},createdAt:at,updatedAt:at});
await test('native PostgreSQL agent graph, isolation and concurrency',async t=>{
 try{
  for(const id of ['a','b','c','d'])await first.create(row(id));await first.create(row('foreign',other.companyId));
  await t.test('persist, reassign, detach and reconstruct a repository',async()=>{await first.setParent(context.companyId,aid('b'),aid('a'),at);await first.setParent(context.companyId,aid('c'),aid('b'),at);assert.equal((await second.find(context.companyId,aid('c')))?.parentAgentId,key('b'));await second.setParent(context.companyId,aid('b'),aid('d'),at);await second.setParent(context.companyId,aid('b'),null,at);assert.equal((await first.find(context.companyId,aid('b')))?.parentAgentId,null);});
  await t.test('database self-FK scopes parent identity and prevents deleting a parent with children',async()=>{await assert.rejects(first.setParent(context.companyId,aid('a'),aid('foreign'),at));await assert.rejects(a.amAgent.update({where:{companyId_id:{companyId:context.companyId,id:key('a')}},data:{parentAgentId:key('foreign')}}));await assert.rejects(first.delete(context.companyId,aid('b')));await assert.rejects(a.amAgent.update({where:{companyId_id:{companyId:context.companyId,id:key('a')}},data:{parentAgentId:key('a')}}));});
  await t.test('two native connections cannot produce an opposite-edge cycle',async()=>{const outcomes=await Promise.allSettled([first.setParent(context.companyId,aid('a'),aid('b'),at),second.setParent(context.companyId,aid('b'),aid('a'),at)]);assert.equal(outcomes.filter(v=>v.status==='fulfilled').length,1);for(const id of ['a','b'])await first.setParent(context.companyId,aid(id),null,at);});
  await t.test('longer indirect cycles and suspended parents fail without altering the graph',async()=>{await first.setParent(context.companyId,aid('b'),aid('a'),at);await first.setParent(context.companyId,aid('c'),aid('b'),at);await assert.rejects(second.setParent(context.companyId,aid('a'),aid('c'),at),/circular/);const current=(await first.find(context.companyId,aid('d')))!;await first.update({...current,status:'SUSPENDED'});await assert.rejects(second.setParent(context.companyId,aid('a'),current.id,at),/suspended/);assert.equal((await first.find(context.companyId,aid('a')))?.parentAgentId,null);});
  await t.test('general profile updates preserve relationship and exact commission values',async()=>{const stale=(await first.find(context.companyId,aid('c')))!;await first.setParent(context.companyId,stale.id,aid('a'),at);await second.update({...stale,notes:'profile update'});const current=(await first.find(context.companyId,stale.id))!;assert.equal(current.parentAgentId,key('a'));assert.equal(current.commission.value,'5.123456');assert.equal(current.notes,'profile update');});
  await t.test('commercial agreement replay and competing revisions preserve exact immutable shares',async()=>{
   const command={id:randomUUID(),companyId:context.companyId,agentId:aid('c'),parentAgentId:aid('a'),requestId:randomUUID(),expectedVersion:0,...commissionShares('33.333333'),reason:'Native agreement',actorId:'actor',createdAt:at};
   const results=await Promise.all(Array.from({length:10},(_,i)=>(i%2?first:second).saveCommissionAgreement({...command,id:randomUUID()})));assert.equal(new Set(results.map(v=>v.id)).size,1);
   await assert.rejects(first.saveCommissionAgreement({...command,reason:'changed request'}),/request identity/);
   const competing=await Promise.allSettled([first.saveCommissionAgreement({...command,id:randomUUID(),requestId:randomUUID(),expectedVersion:1,...commissionShares('60')}),second.saveCommissionAgreement({...command,id:randomUUID(),requestId:randomUUID(),expectedVersion:1,...commissionShares('70')})]);assert.equal(competing.filter(v=>v.status==='fulfilled').length,1);
   const rows=await first.listCommissionAgreements(context.companyId,aid('c'));assert.equal(rows.length,2);assert.equal(rows[1]?.principalPercent,'33.333333');assert.equal(rows[1]?.subordinatePercent,'66.666667');
  });
  await t.test('relationship changes preserve old agreements and reject stale principal selection',async()=>{
   await first.setParent(context.companyId,aid('c'),aid('b'),at);
   const command={id:randomUUID(),companyId:context.companyId,agentId:aid('c'),parentAgentId:aid('a'),requestId:randomUUID(),expectedVersion:2,...commissionShares('40'),reason:'Changed principal',actorId:'actor',createdAt:at};
   await assert.rejects(second.saveCommissionAgreement(command),/relationship changed/);await first.saveCommissionAgreement({...command,parentAgentId:aid('b')});
   await first.setParent(context.companyId,aid('b'),null,at);await assert.rejects(first.delete(context.companyId,aid('a')));
   const rows=await second.listCommissionAgreements(context.companyId,aid('c'));assert.deepEqual(rows.map(v=>v.version),[3,2,1]);assert.equal(rows[0]?.parentAgentId,aid('b'));assert.equal(rows[2]?.parentAgentId,aid('a'));
  });
  await t.test('native checks reject invalid share totals and keep agreement history unchanged',async()=>{
   await assert.rejects(a.amCommissionAgreement.create({data:{id:randomUUID(),companyId:context.companyId,agentId:aid('c'),parentAgentId:aid('b'),requestId:randomUUID(),version:99,principalPercent:'50',subordinatePercent:'40',reason:'invalid',actorId:'actor',createdAt:new Date(at)}}));assert.equal((await first.listCommissionAgreements(context.companyId,aid('c'))).length,3);
  });
 }finally{for(const companyId of [context.companyId,other.companyId]){await a.amCommissionAgreement.deleteMany({where:{companyId}});await a.amAgent.updateMany({where:{companyId},data:{parentAgentId:null}});await a.amAgent.deleteMany({where:{companyId}});}await Promise.all([a.$disconnect(),b.$disconnect()]);}
});
