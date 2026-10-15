import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { ContractValidationError, decimalAmount, executionContext, sourceReference } from '@elhafez/contracts';
import { PlatformCoreApplicationService, PLATFORM_CORE_PERMISSIONS } from '@elhafez/platform-core';
import { HajjUmrahBookingsApplicationService } from '@elhafez/hajj-umrah-bookings';
import { TourismFinanceReadApplicationService } from '@elhafez/tourism-finance-orchestration';
import { BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
const units=(value:string)=>{const negative=value.startsWith('-'),[whole,fraction='']=(negative?value.slice(1):value).split('.');return BigInt(whole!+fraction.padEnd(18,'0'))*(negative?-1n:1n);};
function amount(value:bigint){const negative=value<0n,absolute=negative?-value:value,fraction=(absolute%10n**18n).toString().padStart(18,'0').replace(/0+$/,'');return decimalAmount((negative?'-':'')+(absolute/10n**18n).toString()+(fraction?'.'+fraction:''));}
@Controller('hajj-umrah/family-statement')
export class FamilyStatementController {
 static readonly runtimeDependencies=[PlatformCoreApplicationService,HajjUmrahBookingsApplicationService,TourismFinanceReadApplicationService,BillingSubledgersApplicationService] as const;
 constructor(private readonly platform:PlatformCoreApplicationService,private readonly bookings:HajjUmrahBookingsApplicationService,private readonly finance:TourismFinanceReadApplicationService,private readonly billing:BillingSubledgersApplicationService){}
 @Get()
 async statement(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('reference') reference:string|undefined){
  if(!auth?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated company and branch required');
  if(!reference?.trim())throw new ContractValidationError('reference','family reference required');
  const user=await this.platform.currentCompanyUser(auth.slice(7),companyId),context=executionContext(companyId,branchId,user.id);
  await this.platform.authorize(context.actorId,context.companyId,PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
  const bookings=(await this.bookings.list(context)).filter(x=>x.familyReference===reference.trim());
  const rows=[],seen=new Set<string>(),totals=new Map<string,{charged:bigint;paid:bigint;outstanding:bigint}>();
  for(const booking of bookings){
   const financial=await this.finance.bookingCustomerView(context.companyId,context.branchId,sourceReference('HAJJ_UMRAH_BOOKING',booking.id));
   const invoice=financial?.invoiceId?await this.billing.getOpenPosition(context.companyId,financial.invoiceId):null;
   if(invoice&&(invoice.branchId!==context.branchId||invoice.partyId!==financial!.debtorPartyId))throw new ContractValidationError('invoice','owner scope does not match family booking');
   const active=invoice?.status==='POSTED';
   if(active&&!seen.has(invoice.invoiceId)){seen.add(invoice.invoiceId);const prior=totals.get(invoice.currency)??{charged:0n,paid:0n,outstanding:0n};prior.charged+=units(invoice.documentTotal);prior.outstanding+=units(invoice.outstanding);prior.paid+=units(invoice.documentTotal)-units(invoice.outstanding);totals.set(invoice.currency,prior);}
   rows.push({bookingId:booking.id,code:booking.code,status:booking.status,travelerIds:booking.travelerIds,financialCustomerId:booking.financialCustomerId??booking.customerId,invoiceId:invoice?.invoiceId??null,currency:invoice?.currency??null,charged:active?invoice.documentTotal:'0',paid:active?amount(units(invoice.documentTotal)-units(invoice.outstanding)):'0',outstanding:active?invoice.outstanding:'0',allocationBasis:booking.travelerIds.length===1?'INDIVIDUAL':'SHARED_NOT_DISTRIBUTED'});
  }
  // Explicit customer projection: never spread owner results containing cost/commission data.
  return {reference:reference.trim(),rows,totals:[...totals].map(([currency,v])=>({currency,charged:amount(v.charged),paid:amount(v.paid),outstanding:amount(v.outstanding)})),note:'Shared booking payments are not attributed to individual travelers without an explicit allocation.'};
 }
}
