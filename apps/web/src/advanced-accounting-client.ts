import { crmGet, crmPost } from './crm-core-client.js';

const base='/accounting/advanced';
const enc=encodeURIComponent;

export type AdvancedResult=Record<string,unknown>;
export interface RevaluationInput{positionReference:string;classification:'ASSET'|'LIABILITY'|'REVENUE'|'EXPENSE'|'EQUITY';monetary:boolean;foreignAmount:{amount:string;currency:string};priorBaseAmount:string;baseCurrency:string;at:string}
export interface AssetDisposalInput{commandKey:string;assetId:string;postingDate:string;proceeds:string;proceedsMode:'TREASURY'|'NON_CASH';treasuryId?:string;proceedsClearingAccountId?:string;number:string}
export interface PayrollLiabilityInput{id?:string;accountId:string;amount:string;label:string}
export interface PayrollAccrualInput{commandKey:string;sourceId:string;payrollPeriod:string;postingDate:string;currency:string;expenseTotal:string;expenseAccountId:string;liabilities:PayrollLiabilityInput[];number:string}
export interface PayrollPaymentInput{runId:string;treasuryId:string;postingDate:string;number:string}

export const advancedAccountingApi={
 baseCurrency:()=>crmGet<AdvancedResult>(base+'/base-currency'),
 configureCurrency:(input:{code:string;precision:number;isBase:boolean;status:'ACTIVE'|'INACTIVE'})=>crmPost<AdvancedResult>(base+'/currencies',input),
 publishRate:(input:{fromCurrency:string;toCurrency:string;effectiveAt:string;rate:string;source:string})=>crmPost<AdvancedResult>(base+'/fx-rates',input),
 resolveRate:(from:string,to:string,at:string)=>crmGet<AdvancedResult>(base+'/fx-rates/resolve?from='+enc(from)+'&to='+enc(to)+'&at='+enc(at)),
 prepareRevaluation:(input:RevaluationInput)=>crmPost<AdvancedResult>(base+'/fx/revaluation/prepare',input),
 createCostCenter:(input:{code:string;name:string;parentId?:string})=>crmPost<AdvancedResult>(base+'/cost-centers',input),
 getCostCenter:(id:string)=>crmGet<AdvancedResult>(base+'/cost-centers/'+enc(id)),
 createBudget:(input:{costCenterId:string;periodStart:string;periodEnd:string;currency:string;amount:string})=>crmPost<AdvancedResult>(base+'/budgets',input),
 authorizeBudget:(id:string)=>crmPost<AdvancedResult>(base+'/budgets/'+enc(id)+'/authorize',{}),
 checkBudget:(id:string)=>crmGet<AdvancedResult>(base+'/budgets/'+enc(id)+'/check'),
 createPartyGroup:(input:{name:string;members:{role:'CUSTOMER'|'SUPPLIER'|'AGENT';partyId:string}[]})=>crmPost<AdvancedResult>(base+'/party-groups',input),
 proposeNetting:(input:{groupId:string;customerInvoiceId:string;supplierInvoiceId:string;amount:string;postingDate:string;number:string;approvalRequestId?:string})=>crmPost<AdvancedResult>(base+'/nettings',input),
 executeNetting:(id:string)=>crmPost<AdvancedResult>(base+'/nettings/'+enc(id)+'/execute',{}),
 reverseNetting:(id:string,input:{postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/nettings/'+enc(id)+'/reverse',input),
 createExpense:(input:{form:'DIRECT_PAID'|'PREPAID'|'SUPPLIER_PAYABLE'|'CANCELLATION_PENALTY';sourceType:string;sourceId:string;currency:string;amount:string;baseAmount:string;expenseAccountId?:string;prepaidAccountId?:string;billingInvoiceId?:string;approvalRequestId?:string})=>crmPost<AdvancedResult>(base+'/expenses',input),
 payExpense:(id:string,input:{treasuryId:string;paymentCurrency:string;postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/expenses/'+enc(id)+'/pay',input),
 createCommission:(input:{agentPartyId:string;sourceType:string;sourceId:string;currency:string;amount:string;baseCarryingAmount:string;expenseAccountId:string;liabilityAccountId:string;approvalRequestId?:string})=>crmPost<AdvancedResult>(base+'/commissions',input),
 approveCommission:(id:string,input:{postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/commissions/'+enc(id)+'/approve',input),
 payCommission:(id:string,input:{treasuryId:string;amount:string;paymentCurrency:string;postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/commissions/'+enc(id)+'/pay',input),
 registerAsset:(input:Record<string,unknown>)=>crmPost<AdvancedResult>(base+'/assets',input),
 depreciateAsset:(id:string,input:{period:number;postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/assets/'+enc(id)+'/depreciation',input),
 disposeAsset:(input:AssetDisposalInput)=>crmPost<AdvancedResult>(base+'/assets/dispose',input),
 originateLoan:(input:Record<string,unknown>)=>crmPost<AdvancedResult>(base+'/loans',input),
 payLoanInstallment:(loanId:string,installmentId:string,input:{treasuryId:string;postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/loans/'+enc(loanId)+'/installments/'+enc(installmentId)+'/pay',input),
 accruePayroll:(input:PayrollAccrualInput)=>crmPost<AdvancedResult>(base+'/payroll/accrual',input),
 payPayroll:(input:PayrollPaymentInput)=>crmPost<AdvancedResult>(base+'/payroll/payment',input),
 createProvision:(input:{name:string;provisionAccountId:string;expenseAccountId:string;releaseAccountId:string})=>crmPost<AdvancedResult>(base+'/provisions',input),
 moveProvision:(id:string,input:{kind:'RECOGNIZE'|'INCREASE'|'USE'|'RELEASE';amount:string;sourceType:string;sourceId:string;postingDate:string;number:string;useOffsetAccountId?:string})=>crmPost<AdvancedResult>(base+'/provisions/'+enc(id)+'/movements',input),
 createRecognitionSchedule:(input:{kind:'PREPAID_EXPENSE'|'DEFERRED_REVENUE'|'DEFERRED_COST';sourceType:string;sourceId:string;sourceInvoiceId?:string;currency:string;sourceAmount:string;baseAmount:string;deferredAccountId:string;recognitionAccountId:string;serviceDates:string[];postingDate:string;number:string;precision?:number})=>crmPost<AdvancedResult>(base+'/recognition-schedules',input),
 postRecognitionPart:(scheduleId:string,partId:string,input:{postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/recognition-schedules/'+enc(scheduleId)+'/parts/'+enc(partId)+'/post',input),
 reverseRecognitionPart:(scheduleId:string,partId:string,input:{postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/recognition-schedules/'+enc(scheduleId)+'/parts/'+enc(partId)+'/reverse',input),
 accrueRevenue:(input:{sourceType:string;sourceId:string;amount:string;serviceDate:string;number:string;accruedRevenueAccountId:string;revenueAccountId:string})=>crmPost<AdvancedResult>(base+'/accruals',input),
 clearAccruedRevenue:(id:string,input:{billingInvoiceId:string;postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/accruals/'+enc(id)+'/clear',input),
 recognizeAllowance:(input:{customerId?:string;sourceReference:string;allowanceAccountId:string;expenseAccountId:string;releaseAccountId:string;amount:string;postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/allowances',input),
 releaseAllowance:(id:string,input:{amount:string;postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/allowances/'+enc(id)+'/release',input),
 writeOffReceivable:(id:string,input:{invoiceId:string;amount:string;postingDate:string;number:string})=>crmPost<AdvancedResult>(base+'/allowances/'+enc(id)+'/write-off',input),
};