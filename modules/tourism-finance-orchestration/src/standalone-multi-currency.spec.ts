import assert from 'node:assert/strict';
import test from 'node:test';
import { companyId, decimalAmount, sourceReference } from '@elhafez/contracts';
import type { StandaloneSupplyPlan } from '@elhafez/tourism-contract-inventory';
import { TourismFinanceOrchestrationApplicationService } from './application/tourism-finance-orchestration.application-service.js';
import type { BillingPort, CommissionPort, ControlsPort, CostPort, FxPort, InventoryPort, ProcurementPort, TreasuryPort } from './application/ports.js';
import { InMemoryTourismFinanceRepository } from './infrastructure/in-memory-tourism-finance.repository.js';

const company=companyId('company-fx'),serviceRef=sourceReference('TOURISM_SERVICE','service-fx');

test('standalone service keeps supplier PO in purchase currency and snapshots converted cost/profit evidence in sale currency',async()=>{
 const repo=new InMemoryTourismFinanceRepository();
 const plan:StandaloneSupplyPlan={planId:'plan-fx',version:1,inputHash:'hash-fx',companyId:company,branchId:'branch-1',service:serviceRef,serviceRevision:1,expiresAt:'2099-01-01T00:00:00.000Z',lines:[],residuals:[{requestId:'supplier-quote',resourceType:'HOTEL',quantity:decimalAmount('2'),unit:'ROOM',currency:'SAR',supplierId:'supplier-1',unitCost:decimalAmount('50'),costAmount:decimalAmount('100'),quoteReference:'Q-1'}],totalsByCurrency:{SAR:decimalAmount('100')}};
 let purchaseCurrency='';
 const billing:BillingPort={async createServiceInvoice(input){return{id:input.id}},async createBookingInvoice(input){return{id:input.id}},async cancellationEvidence(){return{hasHistoricalAllocationEvidence:false,activeAllocationIds:[],hasAvailableAdvance:false,settlementRequired:false,cancellationSafe:true,outstanding:decimalAmount('0')}},async cancelInvoice(_company,id){return{id}}};
 const treasury:TreasuryPort={async postDeposit(input){return{id:input.id}},async reverseDeposit(_company,id){return{id}}};
 const commission:CommissionPort={async create(input){return{id:input.id}},async createServiceCommission(input){return{id:input.id}},async evidence(){return{hasPostedPaymentHistory:false,reversible:true}},async reverse(_company,id){return{id}}};
 const cost:CostPort={async ensureProgram(_company,_program,id){return{costCenterId:id}},async resolveProgram(){return{costCenterId:'cc'}},async actualize(input){return{id:input.id}}};
 const inventory:InventoryPort={async standalonePlan(){return plan},async commitStandalone(){return{planId:plan.planId,version:plan.version,allocationIds:[],residuals:plan.residuals}},async allocate(){return{}},async allocation(){return null},async blockers(){return[]},async release(){return{success:true}}};
 const procurement:ProcurementPort={async createServicePurchaseOrder(input){purchaseCurrency=input.currency;return{id:input.id}},async cancelServicePurchaseOrder(_company,id){return{id}},async blockers(){return[]},async cleanupForProgramCancellation(_company,reference){return{id:reference.purchaseOrderId??reference.commitmentId??'x',status:'CANCELLED'}}};
 const controls:ControlsPort={async authorizeDiscount(){},async authorizeServiceDiscount(){},async approvalResolved(){return true}};
 const fx:FxPort={async convert(input){assert.equal(input.fromCurrency,'SAR');assert.equal(input.toCurrency,'EGP');assert.equal(input.amount,'100');return{amount:decimalAmount('1325'),rate:decimalAmount('13.25'),rateId:'sar-egp-1',effectiveAt:'2026-10-01T00:00:00.000Z',source:'MANUAL'}}};
 const app=new TourismFinanceOrchestrationApplicationService(repo,billing,treasury,commission,cost,inventory,procurement,controls,fx);
 await app.configureFinancialSetup({id:'setup',companyId:company,category:'HOTEL',receivableAccountId:'ar',customerAdvanceAccountId:'advance',revenueAccountId:'revenue',costAccountId:'cost',active:true});
 const result=await app.confirmStandaloneService({companyId:company,branchId:'branch-1',commandKey:'confirm-fx',service:serviceRef,revision:1,category:'HOTEL',debtorPartyId:'customer-party',currency:'EGP',grossAmount:decimalAmount('1500'),discountAmount:decimalAmount('0'),postingDate:'2026-10-01',dueDate:'2026-10-01',invoiceNumber:'INV-FX',planId:plan.planId,planVersion:plan.version});
 assert.equal(result.status,'ACTIVE');
 assert.equal(purchaseCurrency,'SAR');
 const snapshot=await repo.latestSnapshot(company,serviceRef);
 assert.equal(snapshot?.currency,'EGP');
 assert.equal(snapshot?.saleAmount,'1500');
 assert.equal(snapshot?.costAmount,'1325');
 const evidence=snapshot?.evidence as {purchaseTotalsByCurrency:Record<string,string>;costConversion:Array<{rate:string;fromCurrency:string;toCurrency:string}>};
 assert.equal(evidence.purchaseTotalsByCurrency.SAR,'100');
 assert.deepEqual(evidence.costConversion.map(item=>[item.fromCurrency,item.toCurrency,item.rate]),[['SAR','EGP','13.25']]);
});
