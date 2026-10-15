import { Module } from '@nestjs/common';
import { ContractValidationError, decimalAmount, sourceReference, type ExecutionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService, PlatformCoreModule, PlatformError, PLATFORM_CORE_PERMISSIONS } from '@elhafez/platform-core';
import { HajjUmrahBookingsApplicationService, BOOKING_PERMISSIONS, type ConfirmOperationalBookingInput } from '@elhafez/hajj-umrah-bookings';
import { HajjUmrahBookingsModule } from '@elhafez/hajj-umrah-bookings/nest';
import { TourismFinanceOrchestrationApplicationService } from '@elhafez/tourism-finance-orchestration';
import { TourismFinanceOrchestrationModule } from '@elhafez/tourism-finance-orchestration/nest';
import { OfflineCoordinationModule, OfflineCoordinationApplicationService, COORDINATION_REPOSITORY, type CoordinationRepository, type OfflineCommand, type OfflineOperation } from '@elhafez/offline-coordination';
import { OfflineWorkflowController } from './offline-workflow.controller.js';
const permissions:Record<OfflineOperation,string>={BOOKING_CREATE:BOOKING_PERMISSIONS.manage,BOOKING_CONFIRM:BOOKING_PERMISSIONS.confirm,BOOKING_DEPOSIT:PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate};
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ContractValidationError('payload','object required');return value as Record<string,unknown>;}
function text(value:unknown,field:string):string{if(typeof value!=='string'||!value.trim())throw new ContractValidationError(field,'text required');return value.trim();}
function optional(value:unknown):string|undefined{return value===undefined?undefined:text(value,'optional field');}
function strings(value:unknown):string[]{if(!Array.isArray(value))throw new ContractValidationError('travelerIds','array required');return value.map(x=>text(x,'travelerId'));}
export function offlineOwner(bookings:HajjUmrahBookingsApplicationService,finance:TourismFinanceOrchestrationApplicationService){return {async execute(c:ExecutionContext,command:OfflineCommand){
 const p=object(command.payload),key='offline:'+command.id;
 if(command.operation==='BOOKING_CREATE')return bookings.create(c,{requestId:command.id,code:text(p.code,'code'),programId:text(p.programId,'programId'),customerId:text(p.customerId,'customerId'),travelerIds:strings(p.travelerIds),...(p.agentId?{agentId:text(p.agentId,'agentId')}:{}),...(p.financialCustomerId?{financialCustomerId:text(p.financialCustomerId,'financialCustomerId')}:{}),...(p.familyReference?{familyReference:text(p.familyReference,'familyReference')}:{})});
 const bookingId=text(p.bookingId,'bookingId');
 await bookings.requireForIntegration(c,bookingId);
 if(command.operation==='BOOKING_DEPOSIT')return finance.recordBookingDeposit({companyId:c.companyId,branchId:c.branchId,commandKey:key,booking:sourceReference('HAJJ_UMRAH_BOOKING',bookingId),treasuryId:text(p.treasuryId,'treasuryId'),number:text(p.number,'number'),postingDate:text(p.postingDate,'postingDate'),amount:decimalAmount(p.amount)});
 const category=text(p.category,'category');
 if(!['HOTEL','FLIGHT','TRANSPORT','VISA','OTHER'].includes(category))throw new ContractValidationError('category','unsupported category');
 if(!Array.isArray(p.inventories))throw new ContractValidationError('inventories','array required');
 const input:ConfirmOperationalBookingInput={commandKey:key,category:category as ConfirmOperationalBookingInput['category'],costCenterId:text(p.costCenterId,'costCenterId'),currency:text(p.currency,'currency'),grossAmount:decimalAmount(p.grossAmount),discountAmount:decimalAmount(p.discountAmount),postingDate:text(p.postingDate,'postingDate'),dueDate:text(p.dueDate,'dueDate'),invoiceNumber:text(p.invoiceNumber,'invoiceNumber'),inventories:p.inventories.map(value=>{const x=object(value);return{allocationId:text(x.allocationId,'allocationId'),contractId:text(x.contractId,'contractId'),resourceType:text(x.resourceType,'resourceType'),resourceId:text(x.resourceId,'resourceId'),serviceDate:text(x.serviceDate,'serviceDate'),quantity:decimalAmount(x.quantity),...(x.periodEnd?{periodEnd:text(x.periodEnd,'periodEnd')}:{}),...(x.flightSegmentReference?{flightSegmentReference:reference(x.flightSegmentReference)}:{}),...(x.visaBatchReference?{visaBatchReference:reference(x.visaBatchReference)}:{})};}),...(optional(p.approvalRequestId)?{approvalRequestId:text(p.approvalRequestId,'approvalRequestId')}:{}),...(optional(p.commissionAmount)?{commissionAmount:decimalAmount(p.commissionAmount)}:{})};
 return bookings.confirm(c,bookingId,input);
 }};}
function reference(value:unknown){const p=object(value);return sourceReference(text(p.sourceType,'sourceType'),text(p.sourceId,'sourceId'));}
@Module({imports:[PlatformCoreModule,HajjUmrahBookingsModule,TourismFinanceOrchestrationModule,OfflineCoordinationModule],controllers:[OfflineWorkflowController],providers:[{provide:OfflineCoordinationApplicationService,useFactory:(repo:CoordinationRepository,platform:PlatformCoreApplicationService,bookings:HajjUmrahBookingsApplicationService,finance:TourismFinanceOrchestrationApplicationService)=>new OfflineCoordinationApplicationService(repo,{
 requireContext:async c=>{await platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);},
 authorize:async(c,operation)=>{try{await platform.authorize(c.actorId,c.companyId,permissions[operation]);}catch(error){if(error instanceof PlatformError)throw new ContractValidationError('permission','current platform authorization does not permit this operation');throw error;}},
 },offlineOwner(bookings,finance)),inject:[COORDINATION_REPOSITORY,PlatformCoreApplicationService,HajjUmrahBookingsApplicationService,TourismFinanceOrchestrationApplicationService]}]})
export class OfflineWorkflowModule {}
