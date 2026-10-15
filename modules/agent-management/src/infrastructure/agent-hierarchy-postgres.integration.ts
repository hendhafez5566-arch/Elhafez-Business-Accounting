/** Explicit disposable native acceptance; not part of the unit-test glob. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { executionContext } from '@elhafez/contracts';
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
 }finally{for(const companyId of [context.companyId,other.companyId]){await a.amAgent.updateMany({where:{companyId},data:{parentAgentId:null}});await a.amAgent.deleteMany({where:{companyId}});}await Promise.all([a.$disconnect(),b.$disconnect()]);}
});
