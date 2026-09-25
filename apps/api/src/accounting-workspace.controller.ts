import{randomUUID}from'node:crypto';
import{BadRequestException,Body,Controller,Get,Headers,Post,UnauthorizedException}from'@nestjs/common';
import{decimalAmount,executionContext,type ExecutionContext}from'@elhafez/contracts';
import{PLATFORM_CORE_PERMISSIONS,PlatformCoreApplicationService,PlatformError}from'@elhafez/platform-core';
import{PeriodControlApplicationService}from'@elhafez/period-control';
import{GeneralLedgerApplicationService,type AccountClassification,type PostingLine}from'@elhafez/general-ledger';
import{BillingSubledgersApplicationService}from'@elhafez/billing-subledgers';
import{TreasurySettlementApplicationService,type TreasuryType}from'@elhafez/treasury-settlement';
import{FinancialReportingApplicationService}from'@elhafez/financial-reporting';

type HeaderContext={authorization?:string;companyId?:string;branchId?:string};
type ManualJournalLine={accountId:string;debit?:string;credit?:string;partyId?:string;costCenterId?:string};
const ACCOUNT_CLASSES=new Set<AccountClassification>(['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE']);
const TREASURY_TYPES=new Set<TreasuryType>(['CASH','BANK']);

@Controller('accounting')
export class AccountingWorkspaceController{
 constructor(
  private readonly platform:PlatformCoreApplicationService,
  private readonly periods:PeriodControlApplicationService,
  private readonly ledger:GeneralLedgerApplicationService,
  private readonly billing:BillingSubledgersApplicationService,
  private readonly treasury:TreasurySettlementApplicationService,
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
 async overview(@Headers('authorization')auth?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
  const scope={companyId:c.companyId,companyWide:true as const};
  const[fiscalYears,periods,accounts,journals,invoices,treasuries,vouchers,trialBalance,incomeStatement,balanceSheet,treasuryReport]=await Promise.all([
   this.periods.listFiscalYears(c.companyId),this.periods.listPeriods(c.companyId),this.ledger.listAccounts(c.companyId),this.ledger.activity(c.companyId),
   this.billing.listInvoices(c.companyId),this.treasury.listTreasuries(c.companyId),this.treasury.listVouchers(c.companyId),
   this.reporting.trialBalance(scope),this.reporting.incomeStatement(scope),this.reporting.balanceSheet(scope),this.reporting.treasury(scope),
  ]);
  return{
   fiscalYears,periods,accounts,
   journals,
   invoices,
   treasuries,
   vouchers,
   reports:{trialBalance,incomeStatement,balanceSheet,treasury:treasuryReport},
  };
 }
 @Post('accounts')
 async createAccount(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,
  @Body()input:{id?:string;code:string;name:string;classification:AccountClassification;postable?:boolean;parentId?:string;controlType?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  if(!ACCOUNT_CLASSES.has(input.classification))throw new BadRequestException('invalid account classification');
  return this.ledger.createAccount({id:input.id??randomUUID(),companyId:c.companyId,code:input.code.trim(),name:input.name.trim(),classification:input.classification,active:true,postable:input.postable??true,...(input.parentId?.trim()?{parentId:input.parentId.trim()}:{}),...(input.controlType?.trim()?{controlType:input.controlType.trim()}:{})});
 }
 @Post('fiscal-years')
 async createFiscalYear(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{id?:string;startDate:string;endDate:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.periods.createFiscalYear({id:input.id??randomUUID(),companyId:c.companyId,startDate:input.startDate,endDate:input.endDate,status:'OPEN'});
 }
 @Post('periods')
 async createPeriod(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{id?:string;fiscalYearId:string;startDate:string;endDate:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.periods.createPeriod({id:input.id??randomUUID(),companyId:c.companyId,fiscalYearId:input.fiscalYearId,startDate:input.startDate,endDate:input.endDate,status:'OPEN'});
 }
 @Post('manual-journals')
 async postManualJournal(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,
  @Body()input:{id?:string;commandKey:string;number:string;postingDate:string;lines:ManualJournalLine[]}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  const lines:PostingLine[]=input.lines.map(line=>({accountId:line.accountId,...(line.debit?.trim()?{debit:decimalAmount(line.debit)}:{}),...(line.credit?.trim()?{credit:decimalAmount(line.credit)}:{}),...(line.partyId?.trim()?{partyId:line.partyId.trim()}:{}),...(line.costCenterId?.trim()?{costCenterId:line.costCenterId.trim()}:{})}));
  return this.ledger.post({id:input.id??randomUUID(),companyId:c.companyId,number:input.number.trim(),postingDate:input.postingDate,sourceType:'MANUAL_JOURNAL',sourceId:input.commandKey.trim(),lines});
 }
 @Post('treasuries')
 async createTreasury(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,
  @Body()input:{id?:string;code:string;name:string;type:TreasuryType;currency:string;glAccountId:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  if(!TREASURY_TYPES.has(input.type))throw new BadRequestException('invalid treasury type');
  return this.treasury.createTreasury({id:input.id??randomUUID(),companyId:c.companyId,code:input.code.trim(),name:input.name.trim(),type:input.type,currency:input.currency,glAccountId:input.glAccountId});
 }
}
