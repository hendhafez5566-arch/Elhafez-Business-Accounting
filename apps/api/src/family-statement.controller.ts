import {TreasurySettlementApplicationService} from '@elhafez/treasury-settlement';
import { Body, Controller, Get, Post, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { ContractValidationError, decimalAmount, executionContext, sourceReference } from '@elhafez/contracts';
import { PlatformCoreApplicationService, PLATFORM_CORE_PERMISSIONS } from '@elhafez/platform-core';
import { HajjUmrahBookingsApplicationService } from '@elhafez/hajj-umrah-bookings';
import { TourismFinanceReadApplicationService, TourismFinanceOrchestrationApplicationService } from '@elhafez/tourism-finance-orchestration';
import { BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
const units=(value:string)=>{const negative=value.startsWith('-'),[whole,fraction='']=(negative?value.slice(1):value).split('.');if(fraction.length>18)throw new ContractValidationError('amount','supports at most 18 fractional digits');return BigInt(whole!+fraction.padEnd(18,'0'))*(negative?-1n:1n);};
function amount(value:bigint){const negative=value<0n,absolute=negative?-value:value,fraction=(absolute%10n**18n).toString().padStart(18,'0').replace(/0+$/,'');return decimalAmount((negative?'-':'')+(absolute/10n**18n).toString()+(fraction?'.'+fraction:''));}
@Controller('hajj-umrah/family-statement')
export class FamilyStatementController {
 static readonly runtimeDependencies=[PlatformCoreApplicationService,HajjUmrahBookingsApplicationService,TourismFinanceReadApplicationService,BillingSubledgersApplicationService,TourismFinanceOrchestrationApplicationService,TreasurySettlementApplicationService] as const;
 constructor(private readonly platform:PlatformCoreApplicationService,private readonly bookings:HajjUmrahBookingsApplicationService,private readonly finance:TourismFinanceReadApplicationService,private readonly billing:BillingSubledgersApplicationService,private readonly orchestration:TourismFinanceOrchestrationApplicationService,private readonly treasury:TreasurySettlementApplicationService){}
 private async writeContext(auth:string|undefined,companyId:string|undefined,branchId:string|undefined){if(!auth?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated branch required');const user=await this.platform.currentCompanyUser(auth.slice(7),companyId),c=executionContext(companyId,branchId,user.id);await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);await this.platform.authorize(c.actorId,c.companyId,PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return c;}
 @Post('payment-proposal')
 async proposal(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:{reference:string;currency:string;amount:string}){
  await this.writeContext(auth,companyId,branchId);const statement=await this.statement(auth,companyId,branchId,input.reference),total=units(decimalAmount(input.amount));if(total<=0n)throw new ContractValidationError('amount','positive receipt required');let remaining=total;
  const allocations=[];for(const row of [...statement.rows].sort((a,b)=>a.code.localeCompare(b.code))){if(row.currency!==input.currency||units(row.outstanding)<=0n)continue;const applied=remaining<units(row.outstanding)?remaining:units(row.outstanding);if(applied>0n)allocations.push({bookingId:row.bookingId,invoiceId:row.invoiceId,travelerIds:row.travelerIds,financialCustomerId:row.financialCustomerId,code:row.code,outstanding:row.outstanding,amount:amount(applied)});remaining-=applied;}
  if(remaining>0n)throw new ContractValidationError('amount','receipt exceeds open family balances in selected currency');
  return{reference:input.reference,currency:input.currency,amount:amount(total),allocations,policy:'BOOKING_CODE_ASC_REVIEW_REQUIRED'};
 }
 @Post('payments')
 async allocate(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:{requestId:string;reference:string;currency:string;treasuryId:string;number:string;postingDate:string;amount:string;reviewed:boolean;allocations:readonly {bookingId:string;invoiceId?:string;amount:string}[]}){
  const c=await this.writeContext(auth,companyId,branchId);if(!/^[A-Za-z0-9_-]{16,128}$/.test(input.requestId)||input.reviewed!==true)throw new ContractValidationError('review','stable request and explicit review required');
  const statement=await this.statement(auth,companyId,branchId,input.reference),treasury=(await this.treasury.listTreasuries(c.companyId)).find(x=>x.id===input.treasuryId&&x.active);if(!treasury||treasury.currency!==input.currency)throw new ContractValidationError('currency','active treasury in selected receipt currency required');
  if(!Array.isArray(input.allocations)||!input.allocations.length||input.allocations.length>50)throw new ContractValidationError('allocations','explicit reviewed allocation list required');
  for(const allocation of input.allocations){const row=statement.rows.find(x=>x.bookingId===allocation.bookingId&&(!allocation.invoiceId||x.invoiceId===allocation.invoiceId));if(!row?.invoiceId||row.currency!==input.currency)throw new ContractValidationError('booking','invoiced family booking in selected currency required');}
  return this.orchestration.recordFamilyDeposit({companyId:c.companyId,branchId:c.branchId,commandKey:'family:'+input.requestId,familyReference:input.reference,treasuryId:input.treasuryId,number:input.number,postingDate:input.postingDate,amount:decimalAmount(input.amount),allocations:input.allocations.map(x=>({booking:sourceReference('HAJJ_UMRAH_BOOKING',x.bookingId),...(x.invoiceId?{invoiceId:x.invoiceId}:{}),amount:decimalAmount(x.amount)}))});
 }
 @Post('refunds')
 async refund(@Headers('authorization') auth:string|undefined,
  @Headers('x-company-id') companyId:string|undefined,
  @Headers('x-branch-id') branchId:string|undefined,
  @Body() input:{bookingId:string;invoiceId:string;advanceId:string;treasuryId:string;
    commandKey:string;paymentCurrency:string;paymentAmount:string;postingDate:string;
    number:string;reviewed:boolean;reason:string;approvalRequestId?:string}) {
  const c=await this.writeContext(auth,companyId,branchId);
  if(!input?.bookingId?.trim()||!input?.invoiceId?.trim()||!input?.advanceId?.trim())
    throw new ContractValidationError('refund','booking, invoice and refund credit required');
  return this.orchestration.refundBookingCredit({
    companyId:c.companyId,branchId:c.branchId,
    booking:sourceReference('HAJJ_UMRAH_BOOKING',input.bookingId),
    invoiceId:input.invoiceId,advanceId:input.advanceId,
    treasuryId:input.treasuryId,commandKey:input.commandKey,
    paymentCurrency:input.paymentCurrency,paymentAmount:decimalAmount(input.paymentAmount),
    postingDate:input.postingDate,number:input.number,reviewed:input.reviewed,reason:input.reason,
    ...(input.approvalRequestId?{approvalRequestId:input.approvalRequestId}:{}),
  });
 }
 @Get()
 async statement(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('reference') reference:string|undefined,@Query('travelerId') travelerId?:string){
  if(!auth?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated company and branch required');
  if(!reference?.trim())throw new ContractValidationError('reference','family reference required');
  if(travelerId!==undefined&&(!travelerId.trim()||travelerId.length>128))throw new ContractValidationError('travelerId','valid traveler reference required');
  const user=await this.platform.currentCompanyUser(auth.slice(7),companyId),context=executionContext(companyId,branchId,user.id);
  await this.platform.authorize(context.actorId,context.companyId,PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
  const bookings=(await this.bookings.list(context)).filter(x=>x.familyReference===reference.trim());
  const rows=[],seen=new Set<string>(),totals=new Map<string,{charged:bigint;paid:bigint;outstanding:bigint}>();
  for(const booking of bookings){
   const financial=await this.finance.bookingCustomerView(context.companyId,context.branchId,sourceReference('HAJJ_UMRAH_BOOKING',booking.id));
   const charges=financial?.customerInvoices??[{invoiceId:financial?.invoiceId??null,travelerId:null,financialCustomerId:booking.financialCustomerId??booking.customerId,partyId:financial?.debtorPartyId}];
   for(const charge of charges){
    const invoice=charge.invoiceId?await this.billing.getCommercialPosition(context.companyId,charge.invoiceId):null;
    if(invoice&&(invoice.branchId!==context.branchId||invoice.partyId!==charge.partyId))throw new ContractValidationError('invoice','owner scope does not match family booking');
    const active=invoice?.status==='POSTED';
    rows.push({invoiceState:invoice?.status??null,bookingId:booking.id,code:booking.code,status:booking.status,travelerIds:charge.travelerId?[charge.travelerId]:booking.travelerIds,financialCustomerId:charge.financialCustomerId,invoiceId:invoice?.invoiceId??null,currency:invoice?.currency??null,charged:active?invoice.charged:'0',paid:active?invoice.settled:'0',outstanding:active?invoice.outstanding:'0',refundCredits:active?invoice.advances.filter(x=>units(x.available)>0n&&x.baseCurrency).map(x=>({id:x.id,available:x.available,baseCurrency:x.baseCurrency!})):[],allocationBasis:charge.travelerId||booking.travelerIds.length===1?'INDIVIDUAL':'SHARED_NOT_DISTRIBUTED'});
   }
  }
  const selected=travelerId?rows.filter(row=>row.allocationBasis==='INDIVIDUAL'&&row.travelerIds.includes(travelerId)):rows;
  const sharedUnallocatedBookings=travelerId?[...new Set(rows.filter(row=>row.allocationBasis==='SHARED_NOT_DISTRIBUTED'&&row.travelerIds.includes(travelerId)).map(row=>row.code))]:[];
  for(const row of selected){if(row.invoiceState!=='POSTED'||!row.invoiceId||!row.currency||seen.has(row.invoiceId))continue;seen.add(row.invoiceId);const prior=totals.get(row.currency)??{charged:0n,paid:0n,outstanding:0n};prior.charged+=units(row.charged);prior.paid+=units(row.paid);prior.outstanding+=units(row.outstanding);totals.set(row.currency,prior);}
  // Explicit customer projection: never spread owner results containing cost/commission data.
  return {reference:reference.trim(),travelerId:travelerId??null,sharedUnallocatedBookings,rows:selected,totals:[...totals].map(([currency,v])=>({currency,charged:amount(v.charged),paid:amount(v.paid),outstanding:amount(v.outstanding)})),note:'Settled amounts are document total minus outstanding and include owner adjustments as well as collections; they are not a cash-only total. Shared amounts are never attributed to individual travelers without explicit allocation.'};
 }
}
