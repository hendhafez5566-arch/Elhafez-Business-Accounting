import test from 'node:test';
import assert from 'node:assert/strict';
import { companyId, currencyCode, decimalAmount } from '@elhafez/contracts';
import { BillingSubledgersApplicationService } from './application/billing-subledgers.application-service.js';
import { PartyReceivableApplicationService } from './application/party-receivable.application-service.js';
import { InMemoryBillingRepository } from './infrastructure/in-memory-billing.repository.js';

const company=companyId('11111111-1111-4111-8111-111111111111');
const amount=(value:string)=>decimalAmount(value);
type TaxPort=ConstructorParameters<typeof BillingSubledgersApplicationService>[1];
type FxPort=ConstructorParameters<typeof BillingSubledgersApplicationService>[2];
type LedgerPort=ConstructorParameters<typeof BillingSubledgersApplicationService>[3];
type Journal=Awaited<ReturnType<LedgerPort['post']>>;
type PostingInput=Parameters<LedgerPort['post']>[0];

function fixture(){
 const repository=new InMemoryBillingRepository();
 const journals:PostingInput[]=[];
 const posted=new Map<string,Journal>();
 const tax:TaxPort={snapshotInvoiceLine:async()=>{throw new Error('tax snapshot not expected')}};
 const fx:FxPort={
  getBaseCurrency:async()=>({companyId:company,code:currencyCode('EGP'),precision:2,isBase:true,status:'ACTIVE' as const}),
  calculateSettlement:async()=>{throw new Error('foreign settlement not expected')},
 };
 const gl:LedgerPort={
  async post(input){
   journals.push(input);
   const journal:Journal={...input,kind:input.kind??'STANDARD',requestHash:`test:${input.id}`,lines:input.lines.map((line,index)=>({...line,id:`${input.id}:${index+1}`}))};
   posted.set(journal.id,journal);
   return journal;
  },
  async reverse(companyIdValue,journalId,postingDate,number){
   const original=posted.get(journalId);if(!original)throw new Error(`journal not found: ${journalId}`);
   const journal:Journal={id:`reverse:${journalId}`,companyId:companyIdValue,number,postingDate,kind:'REVERSAL',sourceType:'JOURNAL_REVERSAL',sourceId:journalId,requestHash:`reverse:${journalId}`,reversalOfId:journalId,lines:original.lines.map((line,index)=>({id:`reverse:${journalId}:${index+1}`,accountId:line.accountId,...(line.credit!==undefined?{debit:line.credit}:{}),...(line.debit!==undefined?{credit:line.debit}:{}),...(line.partyId?{partyId:line.partyId}:{}),...(line.foreignAmount?{foreignAmount:line.foreignAmount}:{}),...(line.foreignCurrency?{foreignCurrency:line.foreignCurrency}:{}),...(line.costCenterId?{costCenterId:line.costCenterId}:{})}))};
   posted.set(journal.id,journal);return journal;
  },
 };
 const billing=new BillingSubledgersApplicationService(repository,tax,fx,gl);
 return{repository,journals,billing,party:new PartyReceivableApplicationService(repository,billing,fx)};
}

async function agentInvoice(f:ReturnType<typeof fixture>){
 return f.party.createAndPostReceivableInvoice({id:'agent-invoice',companyId:company,branchId:'branch-1',partyKind:'AGENT',partyId:'agent-party',number:'AG-INV-1',postingDate:'2026-09-29',dueDate:'2026-10-05',currency:'EGP',sourceType:'CRM_RECEIVABLE_INVOICE',sourceId:'cmd-invoice',controlAccountId:'agent-ar',lines:[{id:'line-1',accountId:'service-revenue',amount:amount('100')}]});
}

test('AGENT invoice uses the canonical Billing engine and keeps AGENT party identity in open position',async()=>{
 const f=fixture(),posted=await agentInvoice(f),position=await f.billing.getOpenPosition(company,posted.id);
 assert.equal(posted.type,'AGENT');
 assert.equal(posted.outstanding,'100');
 assert.equal(position.partyKind,'AGENT');
 assert.equal(position.partyId,'agent-party');
 assert.deepEqual(f.journals[0]?.lines,[{accountId:'agent-ar',debit:'100',partyId:'agent-party'},{accountId:'service-revenue',credit:'100'}]);
});

test('agent receipt allocation reduces receivable and creates only genuine excess as AGENT advance',async()=>{
 const f=fixture();await agentInvoice(f);
 const allocation=await f.party.applyReceipt({id:'receipt-allocation',companyId:company,branchId:'branch-1',partyKind:'AGENT',partyId:'agent-party',invoiceId:'agent-invoice',amount:amount('120'),sourceId:'receipt-command'});
 assert.equal(allocation.appliedAmount,'100');
 assert.equal(allocation.advanceAmount,'20');
 assert.equal((await f.billing.getInvoice(company,'agent-invoice'))?.outstanding,'0');
 assert.equal((await f.party.listAvailableAdvances(company,'AGENT','agent-party'))[0]?.available,'20');
});

test('advance refund consumption is idempotent, exact-party scoped and blocks source-restricted advances',async()=>{
 const f=fixture();await agentInvoice(f);
 await f.party.applyReceipt({id:'receipt-allocation',companyId:company,branchId:'branch-1',partyKind:'AGENT',partyId:'agent-party',invoiceId:'agent-invoice',amount:amount('120'),sourceId:'receipt-command'});
 const advance=(await f.party.listAvailableAdvances(company,'AGENT','agent-party'))[0]!;
 const first=await f.party.consumeAdvanceRefund({companyId:company,partyKind:'AGENT',partyId:'agent-party',advanceId:advance.id,amount:amount('5'),sourceId:'refund-command'});
 const replay=await f.party.consumeAdvanceRefund({companyId:company,partyKind:'AGENT',partyId:'agent-party',advanceId:advance.id,amount:amount('5'),sourceId:'refund-command'});
 assert.equal(first.available,'15');
 assert.equal(replay.available,'15');
 await assert.rejects(()=>f.party.consumeAdvanceRefund({companyId:company,partyKind:'AGENT',partyId:'agent-party',advanceId:advance.id,amount:amount('6'),sourceId:'refund-command'}),/conflicting/i);
 await f.repository.saveAdvance({id:'restricted',companyId:company,partyKind:'AGENT',partyId:'agent-party',amount:amount('10'),available:amount('10'),sourceType:'BOOKING',sourceId:'booking-1',restrictionSourceType:'BOOKING',restrictionSourceId:'booking-1'});
 await assert.rejects(()=>f.party.consumeAdvanceRefund({companyId:company,partyKind:'AGENT',partyId:'agent-party',advanceId:'restricted',amount:amount('1'),sourceId:'restricted-refund'}),/restricted/i);
});
