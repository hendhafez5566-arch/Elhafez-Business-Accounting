import assert from 'node:assert/strict';
import test from 'node:test';
import { executionContext, decimalAmount } from '@elhafez/contracts';
import { customerId, type CustomerView } from '@elhafez/customer-management';
import { agentId, type AgentView } from '@elhafez/agent-management';
import { partyId, type Party } from '@elhafez/party-registry';
import { leadId, type Lead } from '@elhafez/crm-leads';
import { followupId, type Followup } from '@elhafez/crm-followups';
import { quotationId, type Quotation } from '@elhafez/quotations';
import { travelerId, type Traveler } from '@elhafez/traveler-management';
import { TravelerManagementModule } from '@elhafez/traveler-management/nest';
import type { Invoice } from '@elhafez/billing-subledgers';
import type { CommissionClaim } from '@elhafez/expense-commission-recognition';
import { AppModule } from './app.module.js';
import { CrmSalesReadModelService } from './crm-sales-read-model.service.js';

const context=executionContext('company-1','branch-1','actor-1');
const at='2026-09-20T12:00:00.000Z';
function person(id:string,name:string,phone:string):Party{return{id:partyId(id),companyId:context.companyId,kind:'PERSON',displayName:name,legalName:null,phone,phoneNormalized:phone,whatsappNumber:null,whatsappNormalized:null,email:null,emailNormalized:null,address:null,nationalIdentity:null,nationalIdentityNormalized:null,taxIdentity:null,taxIdentityNormalized:null,status:'ACTIVE',createdAt:at,updatedAt:at};}
const customerParty=person('party-customer','عميل','01000000000');
const agentParty=person('party-agent','مندوب','01100000000');
const customer:CustomerView={customer:{id:customerId('customer-1'),companyId:context.companyId,partyId:customerParty.id,number:'CUS-000001',status:'ACTIVE',assignedAgentId:'agent-1',commercialNotes:null,createdAt:at,updatedAt:at},party:customerParty};
const agent:AgentView={agent:{id:agentId('agent-1'),companyId:context.companyId,partyId:agentParty.id,number:'AGT-000001',status:'ACTIVE',notes:null,commission:{kind:'PERCENT',value:'5',currency:null},createdAt:at,updatedAt:at},party:agentParty};
const lead:Lead={id:leadId('lead-1'),companyId:context.companyId,branchId:context.branchId,number:'LEAD-000001',partyKind:'PERSON',displayName:'عميل',legalName:null,phone:'010',whatsappNumber:null,email:null,address:null,nationalIdentity:null,taxIdentity:null,source:'REFERRAL',requestedService:'Umrah',expectedValue:'100',currency:'EGP',status:'WON',responsibleUserId:'actor-1',referralAgentId:'agent-1',notes:null,lostReason:null,preLostStatus:null,quotationReference:'quote-1',convertedCustomerId:'customer-1',createdAt:at,updatedAt:at};
const followup:Followup={id:followupId('followup-1'),companyId:context.companyId,branchId:context.branchId,leadId:lead.id,responsibleUserId:'actor-1',interactionType:'CALL',scheduledAt:'2026-09-19T10:00:00.000Z',status:'SCHEDULED',outcome:null,nextAction:null,previousFollowupId:null,completedAt:null,cancelledAt:null,completionVoidedAt:null,completionVoidReason:null,createdAt:at,updatedAt:at};
function quote(id:string,currency:string,total:string,status:Quotation['status']='SENT'):Quotation{return{id:quotationId(id),companyId:context.companyId,branchId:context.branchId,number:`Q-${id}`,sourceLeadId:lead.id,customerId:'customer-1',customerSnapshot:{displayName:'عميل',contactName:null,phone:'010',email:null},currency,status,approvalStatus:'NOT_REQUIRED',approvalActorId:null,approvalAt:null,approvalReason:null,currentRevisionId:`rev-${id}`,acceptedRevisionId:status==='ACCEPTED'||status==='CONVERTED'?`rev-${id}`:null,rejectedRevisionId:null,rejectionReason:null,billingInvoiceId:status==='CONVERTED'?`invoice-${id}`:null,createdAt:at,updatedAt:at,revisions:[{id:`rev-${id}`,quotationId:quotationId(id),number:1,validityDate:'2026-09-22',notes:null,terms:null,lines:[{id:`line-${id}`,description:'خدمة',quantity:decimalAmount('1'),unitPrice:decimalAmount(total),discount:decimalAmount('0'),taxCode:null,total:decimalAmount(total),manualPriceOverride:false,discountRequiresApproval:false}],subtotal:decimalAmount(total),discountTotal:decimalAmount('0'),total:decimalAmount(total),createdAt:at,sentAt:at}]};}
const traveler:Traveler={id:travelerId('traveler-1'),companyId:context.companyId,fullName:'مسافر',dateOfBirth:null,gender:null,nationality:'EG',partyId:customerParty.id,customerId:'customer-1',status:'ACTIVE',createdAt:at,updatedAt:at};
function invoice(id:string,type:Invoice['type'],party:string,total:string,outstanding:string,dueDate='2026-09-19'):Invoice{return{id,companyId:context.companyId,branchId:context.branchId,type,status:'POSTED',partyId:party,number:`INV-${id}`,postingDate:'2026-09-18',dueDate,currency:'EGP',sourceType:'TEST',sourceId:id,requestHash:`hash-${id}`,controlAccountId:'ar',lines:[{id:`line-${id}`,accountId:'revenue',amount:decimalAmount(total)}],baseTotal:decimalAmount(total),outstanding:decimalAmount(outstanding),journalId:`journal-${id}`,deferred:false,createdAt:at};}
const customerInvoice=invoice('customer-invoice','CUSTOMER',customerParty.id,'100','25');
const agentInvoice=invoice('agent-invoice','AGENT',agentParty.id,'70','30');
const commission:CommissionClaim={id:'commission-1',companyId:context.companyId,branchId:context.branchId,agentPartyId:agentParty.id,sourceType:'BOOKING',sourceId:'booking-1',currency:'EGP',amount:decimalAmount('30'),baseCarryingAmount:decimalAmount('30'),status:'PARTIALLY_PAID',requestHash:'commission-hash',expenseAccountId:'commission-expense',liabilityAccountId:'commission-payable',payments:[{id:'commission-payment-1',requestHash:'payment-hash',status:'POSTED',amount:decimalAmount('10'),paymentCurrency:'EGP',claimAmountApplied:decimalAmount('10'),settlementBaseAmount:decimalAmount('10'),carryingBaseAmount:decimalAmount('10'),realizedFx:decimalAmount('0'),treasuryVoucherId:'voucher-1'}]};

type D=ConstructorParameters<typeof CrmSalesReadModelService>;
function service(overrides:Partial<{quotes:Quotation[];invoices:Invoice[];commissions:CommissionClaim[]}>= {}){
  const quotes=overrides.quotes??[quote('quote-1','EGP','100','CONVERTED'),quote('quote-2','USD','50','SENT')];
  const invoices=overrides.invoices??[customerInvoice,agentInvoice];
  const commissions=overrides.commissions??[commission];
  const customers:D[0]={get:async()=>customer,list:async()=>[customer]};
  const agents:D[1]={get:async()=>agent,list:async()=>[agent]};
  const leads:D[2]={list:async()=>[lead]};
  const followups:D[3]={forLead:async()=>[followup],overdue:async()=>[followup]};
  const quotations:D[4]={list:async()=>quotes};
  const travelers:D[5]={list:async()=>[traveler]};
  const billing:D[6]={listInvoices:async()=>invoices,getOpenPosition:async(companyId,invoiceId)=>({invoiceId,companyId,partyKind:'CUSTOMER',partyId:customerParty.id,invoiceType:'CUSTOMER',currency:'EGP',documentTotal:decimalAmount('100'),outstanding:decimalAmount('25'),baseTotal:decimalAmount('100'),controlAccountId:'ar',status:'POSTED',postingDate:'2026-09-20',deferred:false})};
  const commissionRead:D[7]={listClaims:async()=>commissions};
  return new CrmSalesReadModelService(customers,agents,leads,followups,quotations,travelers,billing,commissionRead,()=>new Date('2026-09-20T12:00:00Z'));
}

test('API composition registers Traveler Management through its explicit Nest boundary',()=>{const imports=Reflect.getMetadata('imports',AppModule) as unknown[];assert.ok(imports.includes(TravelerManagementModule));});
test('Customer 360 composes owner reads, full Billing positions and quotation-linked positions without duplicated truth',async()=>{const view=await service().customer360(context,'customer-1');assert.equal(view.customer.customer.id,'customer-1');assert.equal(view.leads.length,1);assert.equal(view.followups.length,1);assert.equal(view.travelers.length,1);assert.equal(view.financialPositions.length,1);assert.equal(view.financialPositions[0]?.outstanding,'25');assert.equal(view.overdueFinancialPositions.length,1);assert.equal(view.quotationLinkedFinancialPositions.length,1);assert.deepEqual(view.quotationLinkedFinancialSummaryByCurrency,[{currency:'EGP',documentTotal:'100',outstanding:'25'}]);});
test('Agent 360 keeps receivables separate from commission liabilities',async()=>{const view=await service().agent360(context,'agent-1');assert.equal(view.agent.agent.id,'agent-1');assert.equal(view.customers.length,1);assert.equal(view.leads.length,1);assert.equal(view.quotations.length,2);assert.equal(view.financialPositions.length,1);assert.equal(view.financialPositions[0]?.outstanding,'30');assert.equal(view.overdueFinancialPositions.length,1);assert.equal(view.commissionPositions.length,1);assert.equal(view.pendingCommissionPositions[0]?.outstanding,'20');assert.deepEqual(view.financialSummaryByCurrency,[{currency:'EGP',documentTotal:'70',outstanding:'30'}]);assert.deepEqual(view.commissionSummaryByCurrency,[{currency:'EGP',amount:'30',paid:'10',outstanding:'20'}]);});
test('CRM dashboard separates customer AR, agent AR and agent commission AP by currency',async()=>{const view=await service().dashboard(context);assert.equal(view.counts.customers,1);assert.equal(view.counts.agents,1);assert.equal(view.counts.customersWithOutstanding,1);assert.equal(view.counts.agentsWithOutstanding,1);assert.equal(view.counts.overdueReceivables,1);assert.equal(view.counts.overdueAgentReceivables,1);assert.equal(view.counts.pendingCommissions,1);assert.equal(view.counts.overdueFollowups,1);assert.equal(view.leadStages.WON,1);assert.deepEqual(view.quotationValueByCurrency,[{currency:'EGP',total:'100'},{currency:'USD',total:'50'}]);assert.deepEqual(view.receivablesByCurrency,[{currency:'EGP',documentTotal:'100',outstanding:'25'}]);assert.deepEqual(view.agentReceivablesByCurrency,[{currency:'EGP',documentTotal:'70',outstanding:'30'}]);assert.deepEqual(view.commissionsByCurrency,[{currency:'EGP',amount:'30',paid:'10',outstanding:'20'}]);assert.equal(view.attention.expiringSoon.length,1);});