import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { decimalAmount } from '@elhafez/contracts';
import { PlatformCoreApplicationService, PlatformCoreModule } from '@elhafez/platform-core';
import { HajjUmrahProgramsApplicationService } from '@elhafez/hajj-umrah-programs';
import { HajjUmrahProgramsModule } from '@elhafez/hajj-umrah-programs/nest';
import { TravelerManagementApplicationService, travelerId } from '@elhafez/traveler-management';
import { TravelerManagementModule } from '@elhafez/traveler-management/nest';
import { CustomerManagementApplicationService, customerId } from '@elhafez/customer-management';
import { CustomerManagementModule } from '@elhafez/customer-management/nest';
import { AgentManagementApplicationService, agentId } from '@elhafez/agent-management';
import { AgentManagementModule } from '@elhafez/agent-management/nest';
import { TourismFinanceOrchestrationApplicationService } from '@elhafez/tourism-finance-orchestration';
import { TourismFinanceOrchestrationModule } from '@elhafez/tourism-finance-orchestration/nest';
import { HajjUmrahBookingsApplicationService } from './application/hajj-umrah-bookings.application-service.js';
import { BOOKING_REPOSITORY, type BookingRepository } from './application/booking.repository.js';
import {
  BOOKING_ACCESS,BOOKING_AGENT_PORT,BOOKING_CUSTOMER_PORT,BOOKING_FINANCE_PORT,BOOKING_PROGRAM_PORT,BOOKING_TRAVELER_PORT,
  type BookingAccess,type BookingAgentPort,type BookingCustomerPort,type BookingFinancePort,type BookingProgramPort,type BookingTravelerPort,
} from './application/booking.ports.js';
import { PlatformBookingAccess } from './infrastructure/platform-booking.access.js';
import { PrismaBookingRepository } from './infrastructure/prisma-booking.repository.js';

@Module({
  imports:[PlatformCoreModule,HajjUmrahProgramsModule,TravelerManagementModule,CustomerManagementModule,AgentManagementModule,TourismFinanceOrchestrationModule],
  providers:[
    PrismaClient,
    {provide:BOOKING_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaBookingRepository(db),inject:[PrismaClient]},
    {provide:BOOKING_ACCESS,useFactory:(p:PlatformCoreApplicationService)=>new PlatformBookingAccess(p),inject:[PlatformCoreApplicationService]},
    {provide:BOOKING_PROGRAM_PORT,useFactory:(p:HajjUmrahProgramsApplicationService):BookingProgramPort=>({require:(c,id)=>p.getForIntegration(c,id)}),inject:[HajjUmrahProgramsApplicationService]},
    {provide:BOOKING_TRAVELER_PORT,useFactory:(t:TravelerManagementApplicationService):BookingTravelerPort=>({requireActive:(c,id)=>t.requireActiveForIntegration(c,travelerId(id))}),inject:[TravelerManagementApplicationService]},
    {provide:BOOKING_CUSTOMER_PORT,useFactory:(s:CustomerManagementApplicationService):BookingCustomerPort=>({requireActive:(c,id)=>s.requireActiveForIntegration(c,customerId(id)),register:(c,id,b)=>s.registerReferenceForIntegration(c,customerId(id),'HAJJ_UMRAH_BOOKING',b)}),inject:[CustomerManagementApplicationService]},
    {provide:BOOKING_AGENT_PORT,useFactory:(s:AgentManagementApplicationService):BookingAgentPort=>({requireActive:(c,id)=>s.requireActiveForIntegration(c,agentId(id)),register:(c,id,b)=>s.registerReferenceForIntegration(c,agentId(id),'HAJJ_UMRAH_BOOKING',b)}),inject:[AgentManagementApplicationService]},
    {provide:BOOKING_FINANCE_PORT,useFactory:(tfo:TourismFinanceOrchestrationApplicationService):BookingFinancePort=>({
      confirm:(i)=>tfo.confirmBooking({companyId:i.companyId,branchId:i.branchId,commandKey:i.commandKey,booking:{sourceType:'HAJJ_UMRAH_BOOKING',sourceId:i.bookingId},program:{sourceType:'HAJJ_UMRAH_PROGRAM',sourceId:i.programId},programState:'OPEN',programStateEvidence:i.programEvidence,category:i.category,costCenterId:i.costCenterId,customerPartyId:i.customerPartyId,currency:i.currency,grossAmount:decimalAmount(i.grossAmount),discountAmount:decimalAmount(i.discountAmount),...(i.approvalRequestId?{approvalRequestId:i.approvalRequestId}:{}),postingDate:i.postingDate,dueDate:i.dueDate,invoiceNumber:i.invoiceNumber,inventories:i.inventories.map(v=>({...v,quantity:decimalAmount(v.quantity)})),...(i.commission?{commission:{agentPartyId:i.commission.agentPartyId,amount:decimalAmount(i.commission.amount)}}:{})}),
      cancel:(i)=>tfo.cancelBooking({companyId:i.companyId,branchId:i.branchId,commandKey:i.commandKey,booking:{sourceType:'HAJJ_UMRAH_BOOKING',sourceId:i.bookingId},travelStarted:i.travelStarted,travelEvidence:i.travelEvidence,postingDate:i.postingDate}),
    }),inject:[TourismFinanceOrchestrationApplicationService]},
    {provide:HajjUmrahBookingsApplicationService,useFactory:(r:BookingRepository,a:BookingAccess,p:BookingProgramPort,t:BookingTravelerPort,c:BookingCustomerPort,g:BookingAgentPort,f:BookingFinancePort)=>new HajjUmrahBookingsApplicationService(r,a,p,t,c,g,f),inject:[BOOKING_REPOSITORY,BOOKING_ACCESS,BOOKING_PROGRAM_PORT,BOOKING_TRAVELER_PORT,BOOKING_CUSTOMER_PORT,BOOKING_AGENT_PORT,BOOKING_FINANCE_PORT]},
  ],
  exports:[HajjUmrahBookingsApplicationService],
})
export class HajjUmrahBookingsModule {}
