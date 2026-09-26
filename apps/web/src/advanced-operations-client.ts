import { crmGet, crmPost } from './crm-core-client.js';

const base='/advanced';

export type JsonRecord=Record<string,unknown>;
export type CurrencyStatus='ACTIVE'|'INACTIVE';
export type ContractType='HOTEL'|'FLIGHT_BLOCK'|'TRANSPORT'|'VISA'|'SERVICE';
export type ResourceType=ContractType;
export type ServiceCategory='CAMP'|'MEAL'|'VISIT'|'GUIDE'|'RAWDA'|'INSURANCE'|'OTHER';

export const advancedOperationsApi={
  baseCurrency:()=>crmGet<JsonRecord>(base+'/currency/base'),
  configureCurrency:(input:{code:string;precision:number;isBase:boolean;status:CurrencyStatus})=>crmPost<JsonRecord>(base+'/currency/configure',input),
  publishRate:(input:{id:string;fromCurrency:string;toCurrency:string;effectiveAt:string;rate:string;source:string})=>crmPost<JsonRecord>(base+'/currency/rates',input),
  resolveRate:(input:{fromCurrency:string;toCurrency:string;at:string})=>crmPost<JsonRecord>(base+'/currency/resolve',input),

  createCostCenter:(input:{id:string;code:string;name:string;parentId?:string})=>crmPost<JsonRecord>(base+'/cost-centers',input),
  getCostCenter:(id:string)=>crmGet<JsonRecord>(base+'/cost-centers/'+encodeURIComponent(id)),
  deactivateCostCenter:(id:string)=>crmPost<JsonRecord>(base+'/cost-centers/'+encodeURIComponent(id)+'/deactivate',{}),
  createBudget:(input:{id:string;costCenterId:string;periodStart:string;periodEnd:string;currency:string;amount:string})=>crmPost<JsonRecord>(base+'/budgets',input),
  authorizeBudget:(id:string)=>crmPost<JsonRecord>(base+'/budgets/'+encodeURIComponent(id)+'/authorize',{}),
  checkBudget:(id:string)=>crmGet<JsonRecord>(base+'/budgets/'+encodeURIComponent(id)+'/check'),

  createPartyGroup:(input:{id:string;name:string;members:Array<{id:string;role:'CUSTOMER'|'SUPPLIER'|'AGENT';partyId:string}>})=>crmPost<JsonRecord>(base+'/party-groups',input),
  proposeNetting:(input:{id:string;groupId:string;customerInvoiceId:string;supplierInvoiceId:string;amount:string;postingDate:string;number:string;approvalRequestId?:string})=>crmPost<JsonRecord>(base+'/nettings',input),
  executeNetting:(id:string)=>crmPost<JsonRecord>(base+'/nettings/'+encodeURIComponent(id)+'/execute',{}),
  reverseNetting:(id:string,input:{postingDate:string;number:string})=>crmPost<JsonRecord>(base+'/nettings/'+encodeURIComponent(id)+'/reverse',input),

  createExpense:(input:{id:string;form:'DIRECT_PAID'|'SUPPLIER_PAYABLE'|'PREPAID'|'CANCELLATION_PENALTY';sourceType:string;sourceId:string;currency:string;amount:string;baseAmount:string;expenseAccountId?:string;prepaidAccountId?:string;billingInvoiceId?:string;approvalRequestId?:string})=>crmPost<JsonRecord>(base+'/expenses',input),
  payExpense:(id:string,input:{treasuryId:string;paymentCurrency:string;postingDate:string;number:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string})=>crmPost<JsonRecord>(base+'/expenses/'+encodeURIComponent(id)+'/pay',input),
  createCommission:(input:{id:string;agentPartyId:string;sourceType:string;sourceId:string;currency:string;amount:string;baseCarryingAmount:string;expenseAccountId:string;liabilityAccountId:string;approvalRequestId?:string})=>crmPost<JsonRecord>(base+'/commissions',input),
  approveCommission:(id:string,input:{postingDate:string;number:string})=>crmPost<JsonRecord>(base+'/commissions/'+encodeURIComponent(id)+'/approve',input),
  payCommission:(id:string,input:{paymentId:string;treasuryId:string;amount:string;paymentCurrency:string;postingDate:string;number:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string})=>crmPost<JsonRecord>(base+'/commissions/'+encodeURIComponent(id)+'/pay',input),

  registerAsset:(input:{id:string;code:string;name:string;description?:string;acquisitionValue:string;baseValue:string;currency:string;acquisitionDate:string;capitalizationDate:string;inServiceDate:string;residualValue:string;usefulLifeMonths:number;assetAccountId:string;capitalizationOffsetAccountId:string;accumulatedDepreciationAccountId:string;depreciationExpenseAccountId:string;disposalGainAccountId?:string;disposalLossAccountId?:string;number:string})=>crmPost<JsonRecord>(base+'/assets',input),
  depreciateAsset:(id:string,input:{movementId:string;period:number;postingDate:string;number:string})=>crmPost<JsonRecord>(base+'/assets/'+encodeURIComponent(id)+'/depreciation',input),
  originateLoan:(input:{id:string;lenderId:string;reference:string;principal:string;currency:string;baseAmount:string;liabilityAccountId:string;interestExpenseAccountId:string;fundingTreasuryId:string;postingDate:string;number:string;installments:Array<{id:string;dueDate:string;principal:string;interest:string}>})=>crmPost<JsonRecord>(base+'/loans',input),
  payLoanInstallment:(loanId:string,installmentId:string,input:{treasuryId:string;postingDate:string;number:string})=>crmPost<JsonRecord>(base+'/loans/'+encodeURIComponent(loanId)+'/installments/'+encodeURIComponent(installmentId)+'/pay',input),

  createContract:(input:{type:ContractType;supplierId?:string;effectiveFrom:string;effectiveTo:string;sourceType?:string;sourceId?:string})=>crmPost<JsonRecord>(base+'/inventory/contracts',input),
  getContract:(id:string)=>crmGet<{contract:JsonRecord|null;versions:JsonRecord[]}>(base+'/inventory/contracts/'+encodeURIComponent(id)),
  amendContract:(id:string,input:{terms:Record<string,unknown>;effectiveFrom:string;effectiveTo?:string})=>crmPost<JsonRecord>(base+'/inventory/contracts/'+encodeURIComponent(id)+'/amend',input),
  createResource:(input:JsonRecord)=>crmPost<JsonRecord>(base+'/inventory/resources',input),
  createStopSale:(input:{contractId:string;reason:string;effectiveFrom:string;effectiveTo:string})=>crmPost<JsonRecord>(base+'/inventory/stop-sales',input),
  availability:(input:{contractId:string;resourceType:ResourceType;resourceId:string;serviceDate:string;periodEnd?:string})=>crmPost<JsonRecord>(base+'/inventory/availability',input),
  allocate:(input:{contractId:string;resourceType:ContractType;resourceId:string;programSourceType:string;programSourceId:string;serviceDate:string;periodEnd?:string;quantity:string})=>crmPost<JsonRecord>(base+'/inventory/allocations',input),
  getAllocation:(id:string)=>crmGet<JsonRecord|null>(base+'/inventory/allocations/'+encodeURIComponent(id)),
  releaseAllocation:(id:string,quantity:string)=>crmPost<JsonRecord>(base+'/inventory/allocations/'+encodeURIComponent(id)+'/release',{quantity}),
};
