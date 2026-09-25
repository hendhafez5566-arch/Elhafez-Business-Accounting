import{createHash,randomUUID}from'node:crypto';
import{BadRequestException,Body,Controller,Get,Headers,Param,Post,UnauthorizedException}from'@nestjs/common';
import{decimalAmount,executionContext,type ExecutionContext}from'@elhafez/contracts';
import{PLATFORM_CORE_PERMISSIONS,PlatformCoreApplicationService,PlatformError}from'@elhafez/platform-core';
import{PeriodControlApplicationService,type FiscalYear,type AccountingPeriod}from'@elhafez/period-control';
import{GeneralLedgerApplicationService,type Account,type AccountClassification,type Journal,type PostingLine}from'@elhafez/general-ledger';
import{BillingSubledgersApplicationService,type Invoice,type InvoiceType}from'@elhafez/billing-subledgers';
import{TreasurySettlementApplicationService,type Treasury,type TreasuryType,type Voucher}from'@elhafez/treasury-settlement';
import{TaxApplicationService,type TaxPolicy}from'@elhafez/tax';
import{FinancialControlsApplicationService,type ApprovalPolicy,type ApprovalRequest,type FinancialAction,type ReconciliationIssue}from'@elhafez/financial-controls';
import{FinancialReportingApplicationService}from'@elhafez/financial-reporting';

type HeaderContext={authorization?:string;companyId?:string;branchId?:string};
type ManualJournalLine={accountId:string;debit?:string;credit?:string;partyId?:string;costCenterId?:string};
type ManualInvoiceLine={accountId:string;amount:string;taxCode?:string};
type AccountingOverviewOutput={
 fiscalYears:readonly FiscalYear[];periods:readonly AccountingPeriod[];accounts:readonly Account[];journals:readonly Journal[];invoices:readonly Invoice[];
 treasuries:readonly Treasury[];vouchers:readonly Voucher[];taxPolicies:readonly TaxPolicy[];approvalPolicies:readonly ApprovalPolicy[];approvalRequests:readonly ApprovalRequest[];
 controlIssues:readonly ReconciliationIssue[];reports:{trialBalance:unknown;incomeStatement:unknown;balanceSheet:unknown;treasury:unknown;tax:unknown};
};
const ACCOUNT_CLASSES=new Set<AccountClassification>(['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE']);
const TREASURY_TYPES=new Set<TreasuryType>(['CASH','BANK']);
const INVOICE_TYPES=new Set<InvoiceType>(['CUSTOMER','SUPPLIER']);
const FINANCIAL_ACTIONS=new Set<FinancialAction>(['PAYMENT','PAID_EXPENSE','PARTY_NETTING','COMMISSION_APPROVAL','BOOKING_DISCOUNT','SERVICE_DISCOUNT']);
function text(value:string,field:string){const result=value?.trim();if(!result)throw new BadRequestException(field+' is required');return result;}
function stableId(...parts:string[]){return createHash('sha256').update(parts.join('|')).digest('hex').slice(0,32);}

@Controller('accounting')
export class AccountingWorkspaceController{
 constructor(
  private readonly platform:PlatformCoreApplicationService,
  private readonly periods:PeriodControlApplicationService,
  private readonly ledger:GeneralLedgerApplicationService,
  private readonly billing:BillingSubledgersApplicationService,
  private readonly treasury:TreasurySettlementApplicationService,
  private readonly tax:TaxApplicationService,
  private readonly controls:FinancialControlsApplicationService,
  private readonly reporting:FinancialReportingApplicationService,
 ){}
 private async context(headers:HeaderContext,permission:string):Promise<ExecutionContext>{
  if(!headers.authorization?.startsWith('Bearer ')||!headers.companyId||!headers.branchId)throw new UnauthorizedException('authenticated company and branch context required');
  const user=await this.platform.currentUser(headers.authorization.slice(7));
  const context=executionContext(headers.companyId,headers.branchId,user.id);
  await this.platform.requireBranchAccess(user.id,context.companyId,context.branchId);
  await this.platform.authorize(user.id,context.companyId,permission);
  return context;
 }
 private headers(authorization?:string,companyId?:string,branchId?:string):HeaderContext{return{authorization,companyId,branchId};}

 @Get('capabilities')
 async capabilities(@Headers('authorization')auth?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
  try{await this.platform.authorize(c.actorId,c.companyId,PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return{read:true,operate:true};}
  catch(error){if(error instanceof PlatformError&&error.code==='FORBIDDEN')return{read:true,operate:false};throw error;}
 }

 @Get('overview')
 async overview(@Headers('authorization')auth?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string):Promise<AccountingOverviewOutput>{
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
  const scope={companyId:c.companyId,branchIds:[c.branchId] as const};
  const[
   fiscalYears,periods,accounts,journals,invoices,treasuries,vouchers,taxPolicies,approvalPolicies,approvalRequests,controlIssues,
   trialBalance,incomeStatement,balanceSheet,treasuryReport,taxReport
  ]=await Promise.all([
   this.periods.listFiscalYears(c.companyId),this.periods.listPeriods(c.companyId),this.ledger.listAccounts(c.companyId),this.ledger.activity(c.companyId),
   this.billing.listInvoices(c.companyId),this.treasury.listTreasuries(c.companyId),this.treasury.listVouchers(c.companyId),this.tax.listPolicies(c.companyId),
   this.controls.listApprovalPolicies(c.companyId),this.controls.listApprovalRequests(c.companyId),this.controls.listControlIssues(c.companyId),
   this.reporting.trialBalance(scope),this.reporting.incomeStatement(scope),this.reporting.balanceSheet(scope),this.reporting.treasury(scope),this.reporting.tax(scope),
  ]);
  return{fiscalYears,periods,accounts,journals,invoices,treasuries,vouchers,taxPolicies,approvalPolicies,approvalRequests,controlIssues,
   reports:{trialBalance,incomeStatement,balanceSheet,treasury:treasuryReport,tax:taxReport}};
 }

 @Post('accounts')
 async createAccount(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,
  @Body()input:{id?:string;code:string;name:string;classification:AccountClassification;postable?:boolean;parentId?:string;controlType?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  if(!ACCOUNT_CLASSES.has(input.classification))throw new BadRequestException('invalid account classification');
  return this.ledger.createAccount({id:input.id??randomUUID(),companyId:c.companyId,code:text(input.code,'code'),name:text(input.name,'name'),classification:input.classification,active:true,postable:input.postable??true,...(input.parentId?.trim()?{parentId:input.parentId.trim()}:{}),...(input.controlType?.trim()?{controlType:input.controlType.trim()}:{})});
 }

 @Post('fiscal-years')
 async createFiscalYear(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{id?:string;startDate:string;endDate:string}):Promise<FiscalYear>{
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.periods.createFiscalYear({id:input.id??randomUUID(),companyId:c.companyId,startDate:input.startDate,endDate:input.endDate,status:'OPEN'});
 }

 @Post('periods')
 async createPeriod(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{id?:string;fiscalYearId:string;startDate:string;endDate:string}):Promise<AccountingPeriod>{
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.periods.createPeriod({id:input.id??randomUUID(),companyId:c.companyId,fiscalYearId:text(input.fiscalYearId,'fiscalYearId'),startDate:input.startDate,endDate:input.endDate,status:'OPEN'});
 }

 @Post('periods/:id/status')
 async setPeriodStatus(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{status:'OPEN'|'CLOSED'}):Promise<AccountingPeriod>{
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  if(input.status!=='OPEN'&&input.status!=='CLOSED')throw new BadRequestException('invalid period status');
  await this.periods.setPeriodStatus(c.companyId,id,input.status);
  const value=(await this.periods.listPeriods(c.companyId)).find(period=>period.id===id);
  if(!value)throw new BadRequestException('period not found');
  return value;
 }

 @Post('manual-journals')
 async postManualJournal(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,
  @Body()input:{commandKey:string;number:string;postingDate:string;lines:ManualJournalLine[]}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  const commandKey=text(input.commandKey,'commandKey');
  const lines:PostingLine[]=input.lines.map(line=>({accountId:text(line.accountId,'accountId'),...(line.debit?.trim()?{debit:decimalAmount(line.debit)}:{}),...(line.credit?.trim()?{credit:decimalAmount(line.credit)}:{}),...(line.partyId?.trim()?{partyId:line.partyId.trim()}:{}),...(line.costCenterId?.trim()?{costCenterId:line.costCenterId.trim()}:{})}));
  return this.ledger.post({id:stableId(c.companyId,'MANUAL_JOURNAL',commandKey),companyId:c.companyId,number:text(input.number,'number'),postingDate:input.postingDate,sourceType:'MANUAL_JOURNAL',sourceId:commandKey,lines});
 }

 @Post('invoices')
 async createAndPostInvoice(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,
  @Body()input:{commandKey:string;type:InvoiceType;partyId:string;number:string;externalInvoiceNumber?:string;postingDate:string;dueDate?:string;currency:string;controlAccountId:string;deferred?:boolean;lines:ManualInvoiceLine[]}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  if(!INVOICE_TYPES.has(input.type))throw new BadRequestException('manual workspace supports CUSTOMER or SUPPLIER invoices');
  const commandKey=text(input.commandKey,'commandKey'),id=stableId(c.companyId,'MANUAL_INVOICE',commandKey);
  const draft=await this.billing.createDraft({id,companyId:c.companyId,branchId:c.branchId,type:input.type,partyId:text(input.partyId,'partyId'),number:text(input.number,'number'),
   ...(input.externalInvoiceNumber?.trim()?{externalInvoiceNumber:input.externalInvoiceNumber.trim()}:{}),postingDate:input.postingDate,...(input.dueDate?.trim()?{dueDate:input.dueDate}:{}),
   currency:text(input.currency,'currency'),sourceType:'MANUAL_ACCOUNTING_INVOICE',sourceId:commandKey,controlAccountId:text(input.controlAccountId,'controlAccountId'),
   lines:input.lines.map((line,index)=>({id:stableId(id,'LINE',String(index+1)),accountId:text(line.accountId,'line.accountId'),amount:decimalAmount(line.amount),...(line.taxCode?.trim()?{taxCode:line.taxCode.trim()}:{})})),...(input.deferred?{deferred:true}:{})});
  return this.billing.postInvoice(c.companyId,draft.id);
 }

 @Post('invoices/:id/cancel')
 async cancelInvoice(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{postingDate:string;number:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.billing.cancelInvoice(c.companyId,id,input.postingDate,text(input.number,'number'));
 }

 @Post('treasuries')
 async createTreasury(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,
  @Body()input:{id?:string;code:string;name:string;type:TreasuryType;currency:string;glAccountId:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  if(!TREASURY_TYPES.has(input.type))throw new BadRequestException('invalid treasury type');
  return this.treasury.createTreasury({id:input.id??randomUUID(),companyId:c.companyId,code:text(input.code,'code'),name:text(input.name,'name'),type:input.type,currency:text(input.currency,'currency'),glAccountId:text(input.glAccountId,'glAccountId')});
 }

 @Post('settlements')
 async postSettlement(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,
  @Body()input:{commandKey:string;invoiceId:string;treasuryId:string;number:string;postingDate:string;amount:string;advanceAccountId?:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string;approvalRequestId?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  const position=await this.billing.getOpenPosition(c.companyId,text(input.invoiceId,'invoiceId'));
  if(position.status!=='POSTED')throw new BadRequestException('posted invoice position required');
  const commandKey=text(input.commandKey,'commandKey'),id=stableId(c.companyId,'MANUAL_SETTLEMENT',commandKey);
  return this.treasury.postVoucher({id,companyId:c.companyId,branchId:c.branchId,treasuryId:text(input.treasuryId,'treasuryId'),
   kind:position.partyKind==='CUSTOMER'?'RECEIPT':'PAYMENT',partyKind:position.partyKind,partyId:position.partyId,number:text(input.number,'number'),postingDate:input.postingDate,
   amount:decimalAmount(input.amount),sourceType:'MANUAL_ACCOUNTING_SETTLEMENT',sourceId:commandKey,controlAccountId:position.controlAccountId,actorId:c.actorId,
   ...(input.advanceAccountId?.trim()?{advanceAccountId:input.advanceAccountId.trim()}:{}),...(input.realizedFxGainAccountId?.trim()?{realizedFxGainAccountId:input.realizedFxGainAccountId.trim()}:{}),
   ...(input.realizedFxLossAccountId?.trim()?{realizedFxLossAccountId:input.realizedFxLossAccountId.trim()}:{}),...(input.approvalRequestId?.trim()?{approvalRequestId:input.approvalRequestId.trim()}:{})});
 }

 @Post('vouchers/:id/reverse')
 async reverseVoucher(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{postingDate:string;number:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.treasury.voidVoucher(c.companyId,id,input.postingDate,text(input.number,'number'));
 }

 @Post('tax/policies')
 async configureTax(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,
  @Body()input:{code:string;effectiveFrom:string;rate:string;outputAccountId:string;inputAccountId:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  const code=text(input.code,'code').toUpperCase();
  return this.tax.configurePolicy({id:stableId(c.companyId,'TAX_POLICY',code,input.effectiveFrom),companyId:c.companyId,code,effectiveFrom:input.effectiveFrom,rate:decimalAmount(input.rate),outputAccountId:text(input.outputAccountId,'outputAccountId'),inputAccountId:text(input.inputAccountId,'inputAccountId')});
 }

 @Post('controls/policies')
 async configureApprovalPolicy(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,
  @Body()input:{action:FinancialAction;threshold:string;active:boolean;forbidSelfApproval:boolean;requiredAuthority:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  if(!FINANCIAL_ACTIONS.has(input.action))throw new BadRequestException('invalid financial action');
  return this.controls.configureApprovalPolicy({id:stableId(c.companyId,'APPROVAL_POLICY',input.action),companyId:c.companyId,action:input.action,threshold:input.threshold,active:input.active,forbidSelfApproval:input.forbidSelfApproval,requiredAuthority:text(input.requiredAuthority,'requiredAuthority')});
 }

 @Post('controls/approvals/:id/decision')
 async decideApproval(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,
  @Body()input:{outcome:'APPROVED'|'REJECTED';reason?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  if(input.outcome!=='APPROVED'&&input.outcome!=='REJECTED')throw new BadRequestException('invalid approval outcome');
  return this.controls.decideApproval({companyId:c.companyId,requestId:id,decisionId:stableId(c.companyId,'APPROVAL_DECISION',id,input.outcome),actorId:c.actorId,outcome:input.outcome,...(input.reason?.trim()?{reason:input.reason.trim()}:{})});
 }
}
