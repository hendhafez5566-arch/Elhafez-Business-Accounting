import assert from 'node:assert/strict';
import test from 'node:test';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { agentId, type Agent, type AgentId } from '@elhafez/agent-management';
import {
  customerId,
  type CreateCustomerInput,
  type Customer,
  type CustomerId,
  type CustomerResolveResult,
} from '@elhafez/customer-management';
import { partyId, type DuplicateCandidate, type Party } from '@elhafez/party-registry';
import type { CrmLeadsAccess } from './application/crm-leads-access.js';
import type { LeadAgentPort, LeadCustomerPort } from './application/crm-leads-dependencies.port.js';
import { CrmLeadsApplicationService } from './application/crm-leads.application-service.js';
import { InMemoryCrmLeadsRepository } from './infrastructure/in-memory-crm-leads.repository.js';

class Access implements CrmLeadsAccess {
  async requireBranch(context:ExecutionContext):Promise<void> {
    if (context.branchId === 'blocked') throw new Error('branch access denied');
  }
  async requirePermission():Promise<void> {}
  async audit():Promise<void> {}
}

class Agents implements LeadAgentPort {
  status:Agent['status']='ACTIVE';
  refs=0;

  async requireActiveForIntegration(context:ExecutionContext,id:AgentId):Promise<Agent> {
    if (this.status !== 'ACTIVE') throw new Error('agent suspended');
    return {
      id,
      companyId:context.companyId,
      partyId:'p',
      number:'A1',
      status:this.status,
      notes:null,
      commission:{kind:'PERCENT',value:'1',currency:null},
      createdAt:'x',
      updatedAt:'x',
    };
  }

  async registerReferenceForIntegration():Promise<void> { this.refs++; }
  async releaseReferenceForIntegration():Promise<void> { this.refs--; }
}

class Customers implements LeadCustomerPort {
  seq=0;
  ambiguous=false;
  suspended=false;
  refs=0;
  last:Customer|null=null;

  async resolveOrCreateForLead(context:ExecutionContext,_input:CreateCustomerInput):Promise<CustomerResolveResult> {
    if (this.ambiguous) {
      const candidates:DuplicateCandidate[]=[];
      return {status:'REVIEW_REQUIRED',candidates};
    }
    const id=customerId('customer-'+(++this.seq));
    const customerPartyId=partyId('party-'+this.seq);
    const value:Customer={
      id,
      companyId:context.companyId,
      partyId:customerPartyId,
      number:'C'+this.seq,
      status:this.suspended?'SUSPENDED':'ACTIVE',
      assignedAgentId:null,
      commercialNotes:null,
      createdAt:'x',
      updatedAt:'x',
    };
    const party:Party={
      id:customerPartyId,
      companyId:context.companyId,
      kind:'PERSON',
      displayName:'Lead',
      legalName:null,
      phone:null,
      phoneNormalized:null,
      whatsappNumber:null,
      whatsappNormalized:null,
      email:null,
      emailNormalized:null,
      address:null,
      nationalIdentity:null,
      nationalIdentityNormalized:null,
      taxIdentity:null,
      taxIdentityNormalized:null,
      status:'ACTIVE',
      createdAt:'x',
      updatedAt:'x',
    };
    this.last=value;
    return {
      status:this.suspended?'EXISTING_SUSPENDED':'CREATED',
      value:{customer:value,party},
    };
  }

  async registerReferenceForIntegration():Promise<void> { this.refs++; }

  async requireActiveForIntegration(_context:ExecutionContext,id:CustomerId):Promise<Customer> {
    if (!this.last || this.last.id !== id || this.last.status !== 'ACTIVE') throw new Error('customer inactive');
    return this.last;
  }
}

function fixture() {
  let n=0;
  const customers=new Customers();
  const agents=new Agents();
  const service=new CrmLeadsApplicationService(
    new InMemoryCrmLeadsRepository(),
    customers,
    agents,
    new Access(),
    ()=>new Date('2026-09-20T12:00:00Z'),
    ()=>'id-'+(++n),
  );
  return {service,customers,agents};
}

const ctx=executionContext('co','br','user');

async function qualified(service:CrmLeadsApplicationService) {
  const lead=await service.create(ctx,{partyKind:'PERSON',displayName:'Lead',source:'Web'});
  await service.advance(ctx,lead.id,'CONTACTED');
  return service.advance(ctx,lead.id,'QUALIFIED');
}

test('pipeline enforces NEW -> CONTACTED -> QUALIFIED -> QUOTED -> WON via conversion',async()=>{
  const {service}=fixture();
  const qualifiedLead=await qualified(service);
  await service.markQuoted(ctx,qualifiedLead.id,'quote:1');
  const result=await service.convertToCustomer(ctx,qualifiedLead.id);
  assert.equal(result.status,'CONVERTED');
  assert.equal((await service.get(ctx,qualifiedLead.id)).status,'WON');
});

test('invalid jumps and LOST without reason are rejected; reopen restores history',async()=>{
  const {service}=fixture();
  const lead=await service.create(ctx,{partyKind:'PERSON',displayName:'Lead',source:'Referral'});
  await assert.rejects(()=>service.advance(ctx,lead.id,'QUALIFIED'),/invalid lead transition/);
  await assert.rejects(()=>service.lose(ctx,lead.id,'   '));
  await service.advance(ctx,lead.id,'CONTACTED');
  await service.lose(ctx,lead.id,'No budget');
  assert.equal((await service.get(ctx,lead.id)).status,'LOST');
  await service.reopen(ctx,lead.id);
  assert.equal((await service.get(ctx,lead.id)).status,'CONTACTED');
  assert.deepEqual((await service.history(ctx,lead.id)).map(value=>value.kind),['CREATED','STATUS_CHANGED','LOST','REOPENED']);
});

test('quoted command is idempotent for same opaque reference and rejects conflicting replay',async()=>{
  const {service}=fixture();
  const qualifiedLead=await qualified(service);
  const one=await service.markQuoted(ctx,qualifiedLead.id,'quote:77');
  const two=await service.markQuoted(ctx,qualifiedLead.id,'quote:77');
  assert.equal(one.id,two.id);
  await assert.rejects(()=>service.markQuoted(ctx,qualifiedLead.id,'quote:other'),/different reference/);
});

test('conversion is replay-safe and ambiguous duplicates require review',async()=>{
  const first=fixture();
  const qualifiedLead=await qualified(first.service);
  await first.service.markQuoted(ctx,qualifiedLead.id,'q1');
  const one=await first.service.convertToCustomer(ctx,qualifiedLead.id);
  const two=await first.service.convertToCustomer(ctx,qualifiedLead.id);
  assert.equal(one.status,'CONVERTED');
  assert.equal(two.status,'ALREADY_CONVERTED');
  assert.equal(first.customers.seq,1);

  const ambiguous=fixture();
  const secondLead=await qualified(ambiguous.service);
  await ambiguous.service.markQuoted(ctx,secondLead.id,'q2');
  ambiguous.customers.ambiguous=true;
  const review=await ambiguous.service.convertToCustomer(ctx,secondLead.id);
  assert.equal(review.status,'REVIEW_REQUIRED');
  assert.equal((await ambiguous.service.get(ctx,secondLead.id)).status,'QUOTED');
});

test('suspended customer duplicate cannot silently win conversion',async()=>{
  const f=fixture();
  const qualifiedLead=await qualified(f.service);
  await f.service.markQuoted(ctx,qualifiedLead.id,'q');
  f.customers.suspended=true;
  const result=await f.service.convertToCustomer(ctx,qualifiedLead.id);
  if (result.status !== 'REVIEW_REQUIRED') assert.fail('suspended customer must require review');
  assert.equal(result.reason,'SUSPENDED_CUSTOMER');
});

test('lead and queries are branch/company isolated',async()=>{
  const {service}=fixture();
  const lead=await service.create(ctx,{partyKind:'PERSON',displayName:'Lead',source:'Web'});
  await assert.rejects(()=>service.get(executionContext('co','other','user'),lead.id));
  await assert.rejects(()=>service.list(executionContext('co','blocked','user')),/branch access denied/);
  assert.equal((await service.list(ctx)).length,1);
});

test('referral agent must be active and is referenced by the lead',async()=>{
  const f=fixture();
  const id=agentId('agent');
  await f.service.create(ctx,{partyKind:'PERSON',displayName:'Lead',source:'Agent',referralAgentId:id});
  assert.equal(f.agents.refs,1);
  f.agents.status='SUSPENDED';
  await assert.rejects(
    ()=>f.service.create(ctx,{partyKind:'PERSON',displayName:'Lead 2',source:'Agent',referralAgentId:id}),
    /suspended/,
  );
});
