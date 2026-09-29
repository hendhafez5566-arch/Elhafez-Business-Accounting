import {createHash} from 'node:crypto';
import {BadRequestException,Body,Controller,Get,Headers,Inject,Param,Post,UnauthorizedException} from '@nestjs/common';
import {decimalAmount,executionContext,type ExecutionContext} from '@elhafez/contracts';
import {PLATFORM_CORE_PERMISSIONS,PlatformCoreApplicationService} from '@elhafez/platform-core';
import {PartyReceivableApplicationService,type ReceivablePartyKind} from '@elhafez/billing-subledgers';
import {PartyCashMovementApplicationService,TreasurySettlementApplicationService} from '@elhafez/treasury-settlement';
import {FinancialControlsApplicationService} from '@elhafez/financial-controls';

type HeaderContext={authorization?:string;companyId?:string;branchId?:string};
type InvoiceLine={accountId:string;amount:string;taxCode?:string};
function text(value:string,field:string){const result=value?.trim();if(!result)throw new BadRequestException(field+' is required');return result;}
function stableId(...parts:string[]){return createHash('sha256').update(parts.join('|')).digest('hex').slice(0,32);}
function kind(value:string):ReceivablePartyKind{if(value==='CUSTOMER'||value==='AGENT')return value;throw new BadRequestException('partyKind must be CUSTOMER or AGENT');}
function refundSource(kind:ReceivablePartyKind){return kind==='AGENT'?'CRM_AGENT_ADVANCE_REFUND_CASH':'CRM_CUSTOMER_ADVANCE_REFUND_CASH';}

/** Thin orchestration only. Billing owns receivables/advances, Treasury owns cash vouchers,
 * Financial Controls owns approval evidence, and compensation reverses cash if Billing fails. */
@Controller('crm/financial')
export class CrmFinancialOperationsController{
 constructor(
  @Inject(PlatformCoreApplicationService)private readonly platform:PlatformCoreApplicationService,
  @Inject(PartyReceivableApplicationService)private readonly receivables:PartyReceivableApplicationService,
  @Inject(PartyCashMovementApplicationService)private readonly cash:PartyCashMovementApplicationService,
  @Inject(TreasurySettlementApplicationService)private readonly treasury:TreasurySettlementApplicationService,
  @Inject(FinancialControlsApplicationService)private readonly controls:FinancialControlsApplicationService,
 ){}
 private headers(authorization?:string,companyId?:string,branchId?:string):HeaderContext{return{authorization,companyId,branchId};}
 private async context(headers:HeaderContext,permission:string):Promise<ExecutionContext>{
  if(!headers.authorization?.startsWith('Bearer ')||!headers.companyId||!headers.branchId)throw new UnauthorizedException('authenticated company and branch context required');
  const user=await this.platform.currentUser(headers.authorization.slice(7)),context=executionContext(headers.companyId,headers.branchId,user.id);
  await this.platform.requireBranchAccess(user.id,context.companyId,context.branchId);await this.platform.authorize(user.id,context.companyId,permission);return context;
 }

 @Get(':partyKind/:partyId')
 async state(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('partyKind')partyKind:string,@Param('partyId')partyId:string){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead),k=kind(partyKind),id=text(partyId,'partyId');
  const[invoices,advances,baseCurrency]=await Promise.all([this.receivables.listOpenInvoices(c.companyId,k,id,c.branchId),this.receivables.listAvailableAdvances(c.companyId,k,id),this.receivables.baseCurrency(c.companyId)]);
  return{partyKind:k,partyId:id,baseCurrency,invoices,advances};
 }

 @Post('invoices')
 async invoice(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;partyKind:string;partyId:string;number:string;postingDate:string;dueDate:string;currency:string;controlAccountId:string;lines:InvoiceLine[]}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate),k=kind(input.partyKind),commandKey=text(input.commandKey,'commandKey'),id=stableId(c.companyId,'CRM_RECEIVABLE_INVOICE',commandKey);
  if(!input.lines?.length)throw new BadRequestException('at least one invoice line is required');
  return this.receivables.createAndPostReceivableInvoice({id,companyId:c.companyId,branchId:c.branchId,partyKind:k,partyId:text(input.partyId,'partyId'),number:text(input.number,'number'),postingDate:text(input.postingDate,'postingDate'),dueDate:text(input.dueDate,'dueDate'),currency:text(input.currency,'currency'),sourceType:'CRM_RECEIVABLE_INVOICE',sourceId:commandKey,controlAccountId:text(input.controlAccountId,'controlAccountId'),lines:input.lines.map((line,index)=>({id:stableId(id,'LINE',String(index+1)),accountId:text(line.accountId,'line.accountId'),amount:decimalAmount(line.amount),...(line.taxCode?.trim()?{taxCode:line.taxCode.trim()}:{})}))});
 }

 @Post('receipts')
 async receipt(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;partyKind:string;partyId:string;invoiceId:string;treasuryId:string;number:string;postingDate:string;amount:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate),k=kind(input.partyKind),partyId=text(input.partyId,'partyId'),commandKey=text(input.commandKey,'commandKey'),invoiceId=text(input.invoiceId,'invoiceId');
  const invoice=(await this.receivables.listOpenInvoices(c.companyId,k,partyId,c.branchId)).find(value=>value.id===invoiceId);if(!invoice)throw new BadRequestException('open receivable invoice not found for party');
  const base=await this.receivables.baseCurrency(c.companyId),treasury=await this.treasury.getTreasurySnapshot(c.companyId,text(input.treasuryId,'treasuryId'));
  if(invoice.currency!==base||treasury.currency!==base)throw new BadRequestException('CRM receivable receipt is restricted to base currency; use accounting FX settlement for foreign currency');
  const amount=decimalAmount(input.amount),voucherId=stableId(c.companyId,'CRM_PARTY_RECEIPT',commandKey),number=text(input.number,'number'),postingDate=text(input.postingDate,'postingDate');
  const voucher=await this.cash.post({id:voucherId,companyId:c.companyId,branchId:c.branchId,treasuryId:treasury.id,kind:'RECEIPT',partyKind:k,partyId,number,postingDate,currency:base,amount,offsetAccountId:invoice.controlAccountId,sourceType:'CRM_PARTY_RECEIPT_CASH',sourceId:commandKey,actorId:c.actorId});
  try{const allocation=await this.receivables.applyReceipt({id:stableId(c.companyId,'CRM_PARTY_RECEIPT_ALLOCATION',commandKey),companyId:c.companyId,branchId:c.branchId,partyKind:k,partyId,invoiceId,amount,sourceId:commandKey});return{voucher,allocation};}
  catch(error){try{await this.treasury.voidVoucher(c.companyId,voucher.id,postingDate,number+'-REV');}catch{throw new BadRequestException(`receipt allocation failed and treasury compensation also failed; voucher ${voucher.id} requires accounting review`);}throw error;}
 }

 @Post('advance-refunds/approval-requests')
 async requestRefundApproval(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;partyKind:string;amount:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate),k=kind(input.partyKind),commandKey=text(input.commandKey,'commandKey'),amount=decimalAmount(input.amount),sourceType=refundSource(k);
  const requirement=await this.controls.evaluateApprovalRequirement({companyId:c.companyId,action:'PAYMENT',amount});
  if(requirement.decision==='APPROVAL_NOT_REQUIRED')return{status:'NOT_REQUIRED' as const,requirement};
  const request=await this.controls.requestApproval({id:stableId(c.companyId,'CRM_ADVANCE_REFUND_APPROVAL',commandKey),companyId:c.companyId,branchId:c.branchId,action:'PAYMENT',sourceType,sourceId:commandKey,requesterActorId:c.actorId,amount});
  const decision=await this.controls.getApprovalDecision(c.companyId,request.id);
  return{status:decision?.outcome??request.status,request,decision,requirement};
 }

 @Post('advance-refunds')
 async refund(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()input:{commandKey:string;partyKind:string;partyId:string;advanceId:string;treasuryId:string;advanceAccountId:string;number:string;postingDate:string;amount:string;approvalRequestId?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate),k=kind(input.partyKind),partyId=text(input.partyId,'partyId'),commandKey=text(input.commandKey,'commandKey'),advanceId=text(input.advanceId,'advanceId');
  const advance=(await this.receivables.listAvailableAdvances(c.companyId,k,partyId)).find(value=>value.id===advanceId);if(!advance)throw new BadRequestException('available advance not found for party');
  const base=await this.receivables.baseCurrency(c.companyId),treasury=await this.treasury.getTreasurySnapshot(c.companyId,text(input.treasuryId,'treasuryId'));if(treasury.currency!==base)throw new BadRequestException('advance refund is restricted to base currency because Billing advance has no durable FX carrying evidence');
  const amount=decimalAmount(input.amount),voucherId=stableId(c.companyId,'CRM_ADVANCE_REFUND',commandKey),number=text(input.number,'number'),postingDate=text(input.postingDate,'postingDate'),sourceType=refundSource(k);
  const voucher=await this.cash.post({id:voucherId,companyId:c.companyId,branchId:c.branchId,treasuryId:treasury.id,kind:'PAYMENT',partyKind:k,partyId,number,postingDate,currency:base,amount,offsetAccountId:text(input.advanceAccountId,'advanceAccountId'),sourceType,sourceId:commandKey,actorId:c.actorId,...(input.approvalRequestId?.trim()?{approvalRequestId:input.approvalRequestId.trim()}:{})});
  try{const remaining=await this.receivables.consumeAdvanceRefund({companyId:c.companyId,partyKind:k,partyId,advanceId,amount,sourceId:commandKey});return{voucher,advance:remaining};}
  catch(error){try{await this.treasury.voidVoucher(c.companyId,voucher.id,postingDate,number+'-REV');}catch{throw new BadRequestException(`advance consumption failed and treasury compensation also failed; voucher ${voucher.id} requires accounting review`);}throw error;}
 }
}