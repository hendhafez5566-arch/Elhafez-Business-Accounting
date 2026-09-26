import{crmGet,crmPost}from'./crm-core-client.js';

export type ContractType='HOTEL'|'FLIGHT_BLOCK'|'TRANSPORT'|'VISA'|'SERVICE';
export type ServiceCategory='CAMP'|'MEAL'|'VISIT'|'GUIDE'|'RAWDA'|'INSURANCE'|'OTHER';
export type OperationResult=Record<string,unknown>;

const base='/capabilities';

export const capabilityApi={
 contract:(id:string)=>crmGet<{contract:OperationResult|null;versions:OperationResult[]}>(base+'/tourism/contracts/'+encodeURIComponent(id)),
 allocation:(id:string)=>crmGet<{allocation:OperationResult|null;blockers:OperationResult[]}>(base+'/tourism/allocations/'+encodeURIComponent(id)),
 createContract:(input:unknown)=>crmPost<OperationResult>(base+'/tourism/contracts',input),
 amendContract:(id:string,input:unknown)=>crmPost<OperationResult>(base+'/tourism/contracts/'+encodeURIComponent(id)+'/amend',input),
 createHotel:(input:unknown)=>crmPost<OperationResult>(base+'/tourism/inventory/hotel',input),
 createFlight:(input:unknown)=>crmPost<OperationResult>(base+'/tourism/inventory/flight',input),
 createTransport:(input:unknown)=>crmPost<OperationResult>(base+'/tourism/inventory/transport',input),
 createVisa:(input:unknown)=>crmPost<OperationResult>(base+'/tourism/inventory/visa',input),
 createService:(input:unknown)=>crmPost<OperationResult>(base+'/tourism/inventory/service',input),
 stopSale:(input:unknown)=>crmPost<OperationResult>(base+'/tourism/stop-sales',input),
 availability:(input:unknown)=>crmPost<OperationResult>(base+'/tourism/availability',input),
 allocate:(input:unknown)=>crmPost<OperationResult>(base+'/tourism/allocations',input),
 release:(id:string,input:unknown)=>crmPost<OperationResult>(base+'/tourism/allocations/'+encodeURIComponent(id)+'/release',input),

 baseCurrency:()=>crmGet<OperationResult>(base+'/accounting/currency/base'),
 configureCurrency:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/currency/configure',input),
 publishRate:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/currency/rates',input),
 resolveRate:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/currency/resolve',input),

 createCostCenter:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/cost-centers',input),
 costCenter:(id:string)=>crmGet<OperationResult>(base+'/accounting/cost-centers/'+encodeURIComponent(id)),
 deactivateCostCenter:(id:string)=>crmPost<OperationResult>(base+'/accounting/cost-centers/'+encodeURIComponent(id)+'/deactivate',{}),
 createBudget:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/budgets',input),
 authorizeBudget:(id:string)=>crmPost<OperationResult>(base+'/accounting/budgets/'+encodeURIComponent(id)+'/authorize',{}),
 checkBudget:(id:string)=>crmGet<OperationResult>(base+'/accounting/budgets/'+encodeURIComponent(id)+'/check'),

 createPartyGroup:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/party-groups',input),
 proposeNetting:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/nettings',input),
 executeNetting:(id:string)=>crmPost<OperationResult>(base+'/accounting/nettings/'+encodeURIComponent(id)+'/execute',{}),
 reverseNetting:(id:string,input:unknown)=>crmPost<OperationResult>(base+'/accounting/nettings/'+encodeURIComponent(id)+'/reverse',input),

 createExpense:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/expenses',input),
 payExpense:(id:string,input:unknown)=>crmPost<OperationResult>(base+'/accounting/expenses/'+encodeURIComponent(id)+'/pay',input),
 createCommission:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/commissions',input),
 approveCommission:(id:string,input:unknown)=>crmPost<OperationResult>(base+'/accounting/commissions/'+encodeURIComponent(id)+'/approve',input),
 payCommission:(id:string,input:unknown)=>crmPost<OperationResult>(base+'/accounting/commissions/'+encodeURIComponent(id)+'/pay',input),

 registerAsset:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/assets',input),
 depreciateAsset:(id:string,input:unknown)=>crmPost<OperationResult>(base+'/accounting/assets/'+encodeURIComponent(id)+'/depreciation',input),
 originateLoan:(input:unknown)=>crmPost<OperationResult>(base+'/accounting/loans',input),
 payLoanInstallment:(loanId:string,installmentId:string,input:unknown)=>crmPost<OperationResult>(base+'/accounting/loans/'+encodeURIComponent(loanId)+'/installments/'+encodeURIComponent(installmentId)+'/pay',input),
};
