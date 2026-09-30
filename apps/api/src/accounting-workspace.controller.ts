import{createHash,randomUUID}from'node:crypto';
import{BadRequestException,Body,Controller,Get,Headers,Inject,Param,Post,UnauthorizedException}from'@nestjs/common';
import{decimalAmount,executionContext,type ExecutionContext}from'@elhafez/contracts';
import{PLATFORM_CORE_PERMISSIONS,PlatformCoreApplicationService,PlatformError}from'@elhafez/platform-core';
import{PeriodControlApplicationService,type FiscalYear,type AccountingPeriod}from'@elhafez/period-control';
import{GeneralLedgerApplicationService,type Account,type AccountClassification,type Journal,type PostingLine}from'@elhafez/general-ledger';
import{BillingSubledgersApplicationService,type Invoice,type InvoiceType}from'@elhafez/billing-subledgers';
import{TreasuryChequeReadApplicationService,TreasurySettlementApplicationService,type Treasury,type TreasuryType,type Voucher,type Cheque}from'@elhafez/treasury-settlement';
import{TaxApplicationService,type TaxPolicy}from'@elhafez/tax';
import{FinancialControlsApplicationService,type ApprovalPolicy,type ApprovalRequest,type FinancialAction,type ReconciliationIssue}from'@elhafez/financial-controls';
import{FinancialReportingApplicationService}from'@elhafez/financial-reporting';
import{CurrencyFxApplicationService}from'@elhafez/currency-fx';
import{AssetsFinancingApplicationService}from'@elhafez/assets-financing';
import{controlledPeriodClose,controlledPeriodReopen,type PeriodCloseOutcome}from'./accounting-period-close.js';
import{controlledFiscalYearClose,controlledFiscalYearReopen}from'./accounting-fiscal-close.js';
import{requiredDecimal}from'./accounting-input.js';
import{accruePayrollOp,disposeAssetOp,payPayrollOp,prepareRevaluationOp}from'./accounting-advanced-operations.js';

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
  @Inject(PlatformCoreApplicationService) private readonly platform:PlatformCoreApplicationService,
  @Inject(PeriodControlApplicationService) private readonly periods:PeriodControlApplicationService,
  @Inject(GeneralLedgerApplicationService) private readonly ledger:GeneralLedgerApplicationService,
  @Inject(BillingSubledgersApplicationService) private readonly billing:BillingSubledgersApplicationService,
  @Inject(TreasurySettlementApplicationService) private readonly treasury:TreasurySettlementApplicationService,
  @Inject(TaxApplicationService) private readonly tax:TaxApplicationService,
  @Inject(FinancialControlsApplicationService) private readonly controls:FinancialControlsApplicationService,
  @Inject(FinancialReportingApplicationService) private readonly reporting:FinancialReportingApplicationService,
  @Inject(CurrencyFxApplicationService) private readonly fx?:CurrencyFxApplicationService,
  @Inject(AssetsFinancingApplicationService) private readonly assets?:AssetsFinancingApplicationService,
  @Inject(TreasuryChequeReadApplicationService) private readonly chequeRead?:TreasuryChequeReadApplicationService,
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
 private requireFx(){if(!this.fx)throw new BadRequestException('currency/FX service unavailable');return this.fx;}
 private requireAssets(){if(!this.assets)throw new BadRequestException('assets/financing service unavailable');return this.assets;}
 private requireChequeRead(){if(!this.chequeRead)throw new BadRequestException('cheque read service unavailable');return this.chequeRead;}
 private async branchVoucher(companyId:Parameters<TreasurySettlementApplicationService['listVouchers']>[0],branchId:string,id:string){const value=(await this.treasury.listVouchers(companyId)).find(item=>item.id===id&&item.branchId===branchId);if(!value)throw new BadRequestException('voucher not found in current branch');return value;}

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
  const[fiscalYears,periods,accounts,journals,invoices,treasuries,vouchers,taxPolicies,approvalPolicies,approvalRequests,controlIssues,trialBalance,incomeStatement,balanceSheet,treasuryReport,taxReport]=await Promise.all([
   this.periods.listFiscalYears(c.companyId),this.periods.listPeriods(c.companyId),this.ledger.listAccounts(c.companyId),this.ledger.activity(c.companyId,c.branchId),
   this.billing.listInvoices(c.companyId).then(values=>values.filter(value=>value.branchId===c.branchId)),this.treasury.listTreasuries(c.companyId),this.treasury.listVouchers(c.companyId).then(values=>values.filter(value=>value.branchId===c.branchId)),this.tax.listPolicies(c.companyId),
   this.controls.listApprovalPolicies(c.companyId),this.controls.listApprovalRequests(c.companyId,c.branchId),this.controls.listControlIssues(c.companyId,c.branchId),
   this.reporting.trialBalance(scope),this.reporting.incomeStatement(scope),this.reporting.balanceSheet(scope),this.reporting.treasury(scope),this.reporting.tax(scope),
  ]);
  return{fiscalYears,periods,accounts,journals,invoices,treasuries,vouchers,taxPolicies,approvalPolicies,approvalRequests,controlIssues,reports:{trialBalance,incomeStatement,balanceSheet,treasury:treasuryReport,tax:taxReport}};
 }

 @Post('accounts')
 async createAccount(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{id?:string;code:string;name:string;classification:AccountClassification;postable?:boolean;parentId?:string;controlType?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  if(!ACCOUNT_CLASSES.has(input.classification))throw new BadRequestException('invalid account classification');
  return this.ledger.createAccount({id:input.id??randomUUID(),companyId:c.companyId,code:text(input.code,'code'),name:text(input.name,'name'),classification:input.classification,active:true,postable:input.postable??true,...(input.parentId?.trim()?{parentId:input.parentId.trim()}:{}),...(input.controlType?.trim()?{controlType:input.controlType.trim()}:{})});
 }

 @Post('fiscal-years')
 async createFiscalYear(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{id?:string;startDate:string;endDate:string}):Promise<FiscalYear>{const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return this.periods.createFiscalYear({id:input.id??randomUUID(),companyId:c.companyId,startDate:input.startDate,endDate:input.endDate,status:'OPEN'});}

 @Post('periods')
 async createPeriod(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{id?:string;fiscalYearId:string;startDate:string;endDate:string}):Promise<AccountingPeriod>{const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return this.periods.createPeriod({id:input.id??randomUUID(),companyId:c.companyId,fiscalYearId:text(input.fiscalYearId,'fiscalYearId'),startDate:input.startDate,endDate:input.endDate,status:'OPEN'});}

 @Post('periods/:id/close')
 async closePeriod(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{commandKey:string}):Promise<PeriodCloseOutcome<AccountingPeriod>>{
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return controlledPeriodClose({periods:this.periods,controls:this.controls,stableId},{companyId:c.companyId,periodId:text(id,'id'),commandKey:text(input.commandKey,'commandKey')});
 }

 @Post('periods/:id/reopen')
 async reopenPeriod(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string):Promise<AccountingPeriod>{const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return (await controlledPeriodReopen({periods:this.periods},{companyId:c.companyId,periodId:text(id,'id')})).period;}

 /** Compatibility route: OPEN only. Closing must pass Financial Controls readiness. */
 @Post('periods/:id/status')
 async setPeriodStatus(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{status:'OPEN'|'CLOSED'}):Promise<AccountingPeriod>{if(input.status!=='OPEN')throw new BadRequestException('closing requires POST periods/:id/close');return this.reopenPeriod(auth,company,branch,id);}

 @Post('fiscal-years/:id/close')
 async closeFiscalYear(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{commandKey:string;retainedEarningsAccountId:string;number:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  const openPeriods=(await this.periods.listPeriods(c.companyId,id)).filter(value=>value.status!=='CLOSED');
  if(openPeriods.length)throw new BadRequestException(`close all fiscal-year periods first (${openPeriods.length} open)`);
  return controlledFiscalYearClose({periods:this.periods,ledger:this.ledger,controls:this.controls,stableId},{companyId:c.companyId,fiscalYearId:text(id,'id'),retainedEarningsAccountId:text(input.retainedEarningsAccountId,'retainedEarningsAccountId'),number:text(input.number,'number'),commandKey:text(input.commandKey,'commandKey')});
 }

 @Post('fiscal-years/:id/reopen')
 async reopenFiscalYear(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{number:string;postingDate?:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return controlledFiscalYearReopen({periods:this.periods,ledger:this.ledger,controls:this.controls,stableId},{companyId:c.companyId,fiscalYearId:text(id,'id'),number:text(input.number,'number'),...(input.postingDate?.trim()?{postingDate:input.postingDate.trim()}:{})});}

 @Post('manual-journals')
 async postManualJournal(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;number:string;postingDate:string;lines:ManualJournalLine[]}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);const commandKey=text(input.commandKey,'commandKey');const lines:PostingLine[]=input.lines.map(line=>({accountId:text(line.accountId,'accountId'),...(line.debit?.trim()?{debit:decimalAmount(line.debit)}:{}),...(line.credit?.trim()?{credit:decimalAmount(line.credit)}:{}),...(line.partyId?.trim()?{partyId:line.partyId.trim()}:{}),...(line.costCenterId?.trim()?{costCenterId:line.costCenterId.trim()}:{})}));return this.ledger.post({id:stableId(c.companyId,'MANUAL_JOURNAL',commandKey),companyId:c.companyId,branchId:c.branchId,number:text(input.number,'number'),postingDate:input.postingDate,sourceType:'MANUAL_JOURNAL',sourceId:commandKey,lines});
 }

 @Post('opening-balances/ledger')
 async postOpeningBalances(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;number:string;postingDate:string;lines:ManualJournalLine[]}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);const commandKey=text(input.commandKey,'commandKey');if(!Array.isArray(input.lines)||input.lines.length<2)throw new BadRequestException('at least two opening lines required');
  const lines:PostingLine[]=input.lines.map(line=>({accountId:text(line.accountId,'accountId'),...(line.debit?.trim()?{debit:decimalAmount(line.debit)}:{}),...(line.credit?.trim()?{credit:decimalAmount(line.credit)}:{}),...(line.partyId?.trim()?{partyId:line.partyId.trim()}:{}),...(line.costCenterId?.trim()?{costCenterId:line.costCenterId.trim()}:{})}));
  return this.ledger.post({id:stableId(c.companyId,'OPENING_BALANCE',commandKey),companyId:c.companyId,branchId:c.branchId,number:text(input.number,'number'),postingDate:text(input.postingDate,'postingDate'),kind:'OPENING',sourceType:'OPENING_BALANCE',sourceId:commandKey,lines});
 }

 @Post('opening-balances/customers')
 async postCustomerOpeningBalance(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;partyId:string;number:string;postingDate:string;dueDate?:string;currency:string;controlAccountId:string;lines:{accountId:string;amount:string}[]}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);const commandKey=text(input.commandKey,'commandKey'),id=stableId(c.companyId,'OPENING_CUSTOMER_BALANCE',commandKey);
  const draft=await this.billing.createDraft({id,companyId:c.companyId,branchId:c.branchId,type:'OPENING_CUSTOMER_BALANCE',partyId:text(input.partyId,'partyId'),number:text(input.number,'number'),postingDate:text(input.postingDate,'postingDate'),...(input.dueDate?.trim()?{dueDate:input.dueDate.trim()}:{}),currency:text(input.currency,'currency'),sourceType:'OPENING_CUSTOMER_BALANCE',sourceId:commandKey,controlAccountId:text(input.controlAccountId,'controlAccountId'),lines:input.lines.map((line,index)=>({id:stableId(id,'LINE',String(index+1)),accountId:text(line.accountId,'line.accountId'),amount:requiredDecimal(line.amount,'line.amount')}))});
  return this.billing.postInvoice(c.companyId,draft.id);
 }

 @Post('invoices')
 async createAndPostInvoice(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;type:InvoiceType;partyId:string;number:string;externalInvoiceNumber?:string;postingDate:string;dueDate?:string;currency:string;controlAccountId:string;deferred?:boolean;lines:ManualInvoiceLine[]}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);if(!INVOICE_TYPES.has(input.type))throw new BadRequestException('manual workspace supports CUSTOMER or SUPPLIER invoices');const commandKey=text(input.commandKey,'commandKey'),id=stableId(c.companyId,'MANUAL_INVOICE',commandKey);const draft=await this.billing.createDraft({id,companyId:c.companyId,branchId:c.branchId,type:input.type,partyId:text(input.partyId,'partyId'),number:text(input.number,'number'),...(input.externalInvoiceNumber?.trim()?{externalInvoiceNumber:input.externalInvoiceNumber.trim()}:{}),postingDate:input.postingDate,...(input.dueDate?.trim()?{dueDate:input.dueDate}:{}),currency:text(input.currency,'currency'),sourceType:'MANUAL_ACCOUNTING_INVOICE',sourceId:commandKey,controlAccountId:text(input.controlAccountId,'controlAccountId'),lines:input.lines.map((line,index)=>({id:stableId(id,'LINE',String(index+1)),accountId:text(line.accountId,'line.accountId'),amount:decimalAmount(line.amount),...(line.taxCode?.trim()?{taxCode:line.taxCode.trim()}:{})})),...(input.deferred?{deferred:true}:{})});return this.billing.postInvoice(c.companyId,draft.id);
 }

 @Post('invoices/:id/cancel')
 async cancelInvoice(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{postingDate:string;number:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);const target=await this.billing.getInvoice(c.companyId,id);if(!target||target.branchId!==c.branchId)throw new BadRequestException('invoice not found in current branch');return this.billing.cancelInvoice(c.companyId,id,input.postingDate,text(input.number,'number'));}

 @Post('treasuries')
 async createTreasury(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{id?:string;code:string;name:string;type:TreasuryType;currency:string;glAccountId:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);if(!TREASURY_TYPES.has(input.type))throw new BadRequestException('invalid treasury type');return this.treasury.createTreasury({id:input.id??randomUUID(),companyId:c.companyId,code:text(input.code,'code'),name:text(input.name,'name'),type:input.type,currency:text(input.currency,'currency'),glAccountId:text(input.glAccountId,'glAccountId')});}

 @Post('settlements')
 async postSettlement(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;invoiceId:string;treasuryId:string;number:string;postingDate:string;amount:string;advanceAccountId?:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string;approvalRequestId?:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);const position=await this.billing.getOpenPosition(c.companyId,text(input.invoiceId,'invoiceId'));if(position.branchId!==c.branchId)throw new BadRequestException('invoice not found in current branch');if(position.status!=='POSTED')throw new BadRequestException('posted invoice position required');if(position.partyKind==='AGENT')throw new BadRequestException('agent receivable settlement must use the CRM financial workflow');const commandKey=text(input.commandKey,'commandKey'),id=stableId(c.companyId,'MANUAL_SETTLEMENT',commandKey);return this.treasury.postVoucher({id,companyId:c.companyId,branchId:c.branchId,treasuryId:text(input.treasuryId,'treasuryId'),kind:position.partyKind==='CUSTOMER'?'RECEIPT':'PAYMENT',partyKind:position.partyKind,partyId:position.partyId,number:text(input.number,'number'),postingDate:input.postingDate,amount:decimalAmount(input.amount),sourceType:'MANUAL_ACCOUNTING_SETTLEMENT',sourceId:commandKey,controlAccountId:position.controlAccountId,actorId:c.actorId,explicitPostedInvoiceId:position.invoiceId,...(input.advanceAccountId?.trim()?{advanceAccountId:input.advanceAccountId.trim()}:{}),...(input.realizedFxGainAccountId?.trim()?{realizedFxGainAccountId:input.realizedFxGainAccountId.trim()}:{}),...(input.realizedFxLossAccountId?.trim()?{realizedFxLossAccountId:input.realizedFxLossAccountId.trim()}:{}) ,...(input.approvalRequestId?.trim()?{approvalRequestId:input.approvalRequestId.trim()}:{})});}

 @Post('vouchers/:id/reverse')
 async reverseVoucher(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{postingDate:string;number:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);await this.branchVoucher(c.companyId,c.branchId,id);return this.treasury.voidVoucher(c.companyId,id,input.postingDate,text(input.number,'number'));}

 @Post('treasury/transfers')
 async transferBetweenTreasuries(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;sourceTreasuryId:string;destinationTreasuryId:string;amount:string;postingDate:string;number:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);const commandKey=text(input.commandKey,'commandKey');return this.treasury.transfer({id:stableId(c.companyId,'TREASURY_TRANSFER',commandKey),companyId:c.companyId,sourceTreasuryId:text(input.sourceTreasuryId,'sourceTreasuryId'),destinationTreasuryId:text(input.destinationTreasuryId,'destinationTreasuryId'),amount:requiredDecimal(input.amount,'amount'),postingDate:text(input.postingDate,'postingDate'),sourceType:'ACCOUNTING_WORKSPACE_TRANSFER',sourceId:commandKey,number:text(input.number,'number')});}

 @Post('treasury/cash-counts')
 async recordCashCount(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;treasuryId:string;countedAmount:string;countDate:string;adjustmentAccountId?:string;number?:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return this.treasury.recordCashCount({id:stableId(c.companyId,'CASH_COUNT',text(input.commandKey,'commandKey')),companyId:c.companyId,treasuryId:text(input.treasuryId,'treasuryId'),countedAmount:requiredDecimal(input.countedAmount,'countedAmount'),countDate:text(input.countDate,'countDate'),...(input.adjustmentAccountId?.trim()?{adjustmentAccountId:input.adjustmentAccountId.trim()}:{}),...(input.number?.trim()?{number:input.number.trim()}:{})});}

 @Post('treasury/bank-lines')
 async importBankLine(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;treasuryId:string;currency:string;signedAmount:string;valueDate:string;reference?:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return this.treasury.importBankLine({id:stableId(c.companyId,'BANK_LINE',text(input.commandKey,'commandKey')),companyId:c.companyId,treasuryId:text(input.treasuryId,'treasuryId'),currency:text(input.currency,'currency'),signedAmount:requiredDecimal(input.signedAmount,'signedAmount'),valueDate:text(input.valueDate,'valueDate'),...(input.reference?.trim()?{reference:input.reference.trim()}:{})});}

 @Get('treasury/:id/bank-lines')
 async listBankLines(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);return this.treasury.listBankLines(c.companyId,text(id,'id'));}

 @Post('treasury/bank-lines/:id/manual-match')
 async manualMatchBankLine(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{voucherId:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);const voucher=await this.branchVoucher(c.companyId,c.branchId,text(input.voucherId,'voucherId'));return this.treasury.manualMatch(c.companyId,text(id,'id'),voucher.id,c.actorId);}

 @Get('treasury/cheques')
 async listCheques(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);const voucherIds=new Set((await this.treasury.listVouchers(c.companyId)).filter(value=>value.branchId===c.branchId).map(value=>value.id));return (await this.requireChequeRead().list(c.companyId)).filter(value=>voucherIds.has(value.voucherId));}

 @Post('treasury/cheques')
 async issueCheque(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;voucherId:string;direction:Cheque['direction'];bankTreasuryId?:string;number:string;amount:string;currency:string;issueDate:string;dueDate?:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);await this.branchVoucher(c.companyId,c.branchId,text(input.voucherId,'voucherId'));if(input.direction!=='INCOMING'&&input.direction!=='OUTGOING')throw new BadRequestException('invalid cheque direction');return this.treasury.issueCheque({id:stableId(c.companyId,'CHEQUE',text(input.commandKey,'commandKey')),companyId:c.companyId,voucherId:input.voucherId,direction:input.direction,...(input.bankTreasuryId?.trim()?{bankTreasuryId:input.bankTreasuryId.trim()}:{}),number:text(input.number,'number'),amount:requiredDecimal(input.amount,'amount'),currency:text(input.currency,'currency'),issueDate:text(input.issueDate,'issueDate'),...(input.dueDate?.trim()?{dueDate:input.dueDate.trim()}:{})});}

 @Post('treasury/cheques/:id/status')
 async transitionCheque(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{status:Cheque['status'];reference?:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);const cheque=(await this.requireChequeRead().list(c.companyId)).find(value=>value.id===id);if(!cheque)throw new BadRequestException('cheque not found');await this.branchVoucher(c.companyId,c.branchId,cheque.voucherId);return this.treasury.transitionCheque(c.companyId,id,input.status,input.reference?.trim()||undefined);}

 @Post('advanced/fx/revaluation/prepare')
 async prepareRevaluation(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:Record<string,unknown>){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return prepareRevaluationOp(this.requireFx(),c.companyId,input);}

 @Post('advanced/assets/dispose')
 async disposeAsset(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:Record<string,unknown>){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return disposeAssetOp(this.requireAssets(),stableId,c.companyId,input);}

 @Post('advanced/payroll/accrual')
 async accruePayroll(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:Record<string,unknown>){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return accruePayrollOp(this.requireAssets(),stableId,c.companyId,input);}

 @Post('advanced/payroll/payment')
 async payPayroll(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:Record<string,unknown>){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return payPayrollOp(this.requireAssets(),c.companyId,input);}

 @Post('tax/policies')
 async configureTax(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{code:string;effectiveFrom:string;rate:string;outputAccountId:string;inputAccountId:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);const code=text(input.code,'code').toUpperCase();return this.tax.configurePolicy({id:stableId(c.companyId,'TAX_POLICY',code,input.effectiveFrom),companyId:c.companyId,code,effectiveFrom:input.effectiveFrom,rate:decimalAmount(input.rate),outputAccountId:text(input.outputAccountId,'outputAccountId'),inputAccountId:text(input.inputAccountId,'inputAccountId')});}

 @Get('controls/policies')
 async approvalPolicies(@Headers('authorization')auth?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);return this.controls.listApprovalPolicies(c.companyId);}

 @Get('controls/approvals')
 async approvalRequests(@Headers('authorization')auth?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);return this.controls.listApprovalRequests(c.companyId,c.branchId);}

 @Post('controls/policies')
 async configureApprovalPolicy(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{action:FinancialAction;threshold:string;active:boolean;forbidSelfApproval:boolean;requiredAuthority:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);if(!FINANCIAL_ACTIONS.has(input.action))throw new BadRequestException('invalid financial action');return this.controls.configureApprovalPolicy({id:stableId(c.companyId,'APPROVAL_POLICY',input.action),companyId:c.companyId,action:input.action,threshold:input.threshold,active:input.active,forbidSelfApproval:input.forbidSelfApproval,requiredAuthority:text(input.requiredAuthority,'requiredAuthority')});}

 @Post('controls/approvals/:id/decision')
 async decideApproval(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()input:{outcome:'APPROVED'|'REJECTED';reason?:string}){const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);if(input.outcome!=='APPROVED'&&input.outcome!=='REJECTED')throw new BadRequestException('invalid approval outcome');const request=await this.controls.getApprovalRequest(c.companyId,id);if(!request||request.branchId!==c.branchId)throw new BadRequestException('approval request not found in current branch');return this.controls.decideApproval({companyId:c.companyId,requestId:id,decisionId:stableId(c.companyId,'APPROVAL_DECISION',id,input.outcome),actorId:c.actorId,outcome:input.outcome,...(input.reason?.trim()?{reason:input.reason.trim()}:{})});}
}
