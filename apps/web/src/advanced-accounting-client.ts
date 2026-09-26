import{crmGet,crmPost}from'./crm-core-client.js';

export interface AdvancedAccountingCapabilities{read:boolean;operate:boolean}
export interface CurrencyRow{code:string;precision:number;isBase:boolean;status:string}
export interface FxRateRow{id:string;fromCurrency:string;toCurrency:string;effectiveAt:string;rate:string;source:string}
export interface CostCenterRow{id:string;code:string;name:string;status:'ACTIVE'|'INACTIVE';parentId?:string}
export interface BudgetRow{id:string;costCenterId:string;periodStart:string;periodEnd:string;currency:string;amount:string;status:'DRAFT'|'AUTHORIZED'}
export interface PartyGroupRow{id:string;name:string;status:string;members:Array<{id:string;role:'CUSTOMER'|'SUPPLIER'|'AGENT';partyId:string}>}
export interface NettingRow{id:string;groupId:string;customerInvoiceId:string;supplierInvoiceId:string;amount:string;postingDate:string;number:string;status:string;failureReason?:string}
export interface ExpenseRow{id:string;form:string;sourceType:string;sourceId:string;currency:string;amount:string;baseAmount:string;status:string;expenseAccountId?:string;prepaidAccountId?:string}
export interface RecognitionScheduleRow{id:string;kind:string;sourceType:string;sourceId:string;currency:string;sourceAmount:string;baseAmount:string;parts:Array<{id:string;serviceDate:string;amount:string;status:string}>}
export interface CommissionClaimRow{id:string;agentPartyId:string;sourceType:string;sourceId:string;currency:string;amount:string;status:string;expenseAccountId:string;liabilityAccountId:string}
export interface AccrualRow{id:string;sourceType:string;sourceId:string;amount:string;serviceDate:string;status:string}
export interface AssetRow{id:string;code:string;name:string;currency:string;baseValue:string;residualValue:string;accumulatedDepreciation:string;status:string;usefulLifeMonths:number}
export interface LoanRow{id:string;lenderId:string;reference:string;principal:string;outstandingPrincipal:string;currency:string;status:string;installments:Array<{id:string;sequence:number;dueDate:string;principal:string;interest:string;status:string}>}
export interface ProvisionRow{id:string;name:string;available:string;provisionAccountId:string;expenseAccountId:string;releaseAccountId:string}
export interface AllowanceRow{id:string;customerId?:string;sourceReference:string;amount:string;used:string;available:string}
export interface PayrollRunRow{id:string;sourceId:string;payrollPeriod:string;postingDate:string;currency:string;expenseTotal:string;status:string}
export interface AdvancedAccountingOverview{
 currencies:CurrencyRow[];rates:FxRateRow[];costCenters:CostCenterRow[];budgets:BudgetRow[];partyGroups:PartyGroupRow[];nettings:NettingRow[];
 expenses:ExpenseRow[];recognitionSchedules:RecognitionScheduleRow[];commissionClaims:CommissionClaimRow[];accruals:AccrualRow[];
 assets:AssetRow[];loans:LoanRow[];provisions:ProvisionRow[];allowances:AllowanceRow[];payrollRuns:PayrollRunRow[];
}
const base='/accounting/advanced',enc=encodeURIComponent;
export const advancedAccountingApi={
 capabilities:()=>crmGet<AdvancedAccountingCapabilities>(base+'/capabilities'),
 overview:()=>crmGet<AdvancedAccountingOverview>(base+'/overview'),
 configureCurrency:(x:{code:string;precision:number;isBase:boolean;status:'ACTIVE'|'INACTIVE'})=>crmPost(base+'/currencies',x),
 publishRate:(x:{fromCurrency:string;toCurrency:string;effectiveAt:string;rate:string;source:string})=>crmPost(base+'/fx-rates',x),
 createCostCenter:(x:{code:string;name:string;parentId?:string})=>crmPost(base+'/cost-centers',x),
 deactivateCostCenter:(id:string)=>crmPost(base+'/cost-centers/'+enc(id)+'/deactivate',{}),
 createBudget:(x:{costCenterId:string;periodStart:string;periodEnd:string;currency:string;amount:string})=>crmPost(base+'/budgets',x),
 authorizeBudget:(id:string)=>crmPost(base+'/budgets/'+enc(id)+'/authorize',{}),
 createPartyGroup:(x:{name:string;members:{role:'CUSTOMER'|'SUPPLIER'|'AGENT';partyId:string}[]})=>crmPost(base+'/party-groups',x),
 proposeNetting:(x:{groupId:string;customerInvoiceId:string;supplierInvoiceId:string;amount:string;postingDate:string;number:string;approvalRequestId?:string})=>crmPost(base+'/nettings',x),
 executeNetting:(id:string)=>crmPost(base+'/nettings/'+enc(id)+'/execute',{}),
 createExpense:(x:{form:'DIRECT_PAID'|'SUPPLIER_PAYABLE'|'PREPAID'|'CANCELLATION_PENALTY';sourceType:string;sourceId:string;currency:string;amount:string;baseAmount:string;expenseAccountId?:string;prepaidAccountId?:string;billingInvoiceId?:string;approvalRequestId?:string})=>crmPost(base+'/expenses',x),
 postExpense:(id:string,x:{treasuryId:string;paymentCurrency:string;postingDate:string;number:string})=>crmPost(base+'/expenses/'+enc(id)+'/post',x),
 createCommission:(x:{agentPartyId:string;sourceType:string;sourceId:string;currency:string;amount:string;baseCarryingAmount:string;expenseAccountId:string;liabilityAccountId:string;approvalRequestId?:string})=>crmPost(base+'/commissions',x),
 approveCommission:(id:string,x:{postingDate:string;number:string})=>crmPost(base+'/commissions/'+enc(id)+'/approve',x),
 registerAsset:(x:{code:string;name:string;description?:string;acquisitionValue:string;baseValue:string;currency:string;acquisitionDate:string;capitalizationDate:string;inServiceDate:string;residualValue:string;usefulLifeMonths:number;assetAccountId:string;capitalizationOffsetAccountId:string;accumulatedDepreciationAccountId:string;depreciationExpenseAccountId:string;disposalGainAccountId?:string;disposalLossAccountId?:string;number:string})=>crmPost(base+'/assets',x),
 postDepreciation:(id:string,x:{period:number;postingDate:string;number:string})=>crmPost(base+'/assets/'+enc(id)+'/depreciation',x),
 originateLoan:(x:{lenderId:string;reference:string;principal:string;currency:string;baseAmount:string;liabilityAccountId:string;interestExpenseAccountId:string;fundingTreasuryId:string;postingDate:string;number:string;installments:{dueDate:string;principal:string;interest:string}[]})=>crmPost(base+'/loans',x),
 createProvision:(x:{name:string;provisionAccountId:string;expenseAccountId:string;releaseAccountId:string})=>crmPost(base+'/provisions',x),
};
