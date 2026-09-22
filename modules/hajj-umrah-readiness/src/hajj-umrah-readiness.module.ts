import{Module}from'@nestjs/common';
import{PrismaClient}from'@prisma/client';
import{companyId,type SourceReference}from'@elhafez/contracts';
import{PlatformCoreApplicationService,PlatformCoreModule}from'@elhafez/platform-core';
import{HajjUmrahProgramsApplicationService}from'@elhafez/hajj-umrah-programs';
import{HajjUmrahProgramsModule}from'@elhafez/hajj-umrah-programs/nest';
import{HajjUmrahBookingsApplicationService}from'@elhafez/hajj-umrah-bookings';
import{HajjUmrahBookingsModule}from'@elhafez/hajj-umrah-bookings/nest';
import{TravelerManagementApplicationService,travelerId}from'@elhafez/traveler-management';
import{TravelerManagementModule}from'@elhafez/traveler-management/nest';
import{HajjUmrahRoomingApplicationService}from'@elhafez/hajj-umrah-rooming';
import{HajjUmrahRoomingModule}from'@elhafez/hajj-umrah-rooming/nest';
import{HajjUmrahVisaOperationsApplicationService}from'@elhafez/hajj-umrah-visa-operations';
import{HajjUmrahVisaOperationsModule}from'@elhafez/hajj-umrah-visa-operations/nest';
import{HajjUmrahTicketingApplicationService}from'@elhafez/hajj-umrah-ticketing';
import{HajjUmrahTicketingModule}from'@elhafez/hajj-umrah-ticketing/nest';
import{HajjUmrahTransportOperationsApplicationService}from'@elhafez/hajj-umrah-transport-operations';
import{HajjUmrahTransportOperationsModule}from'@elhafez/hajj-umrah-transport-operations/nest';
import{HajjUmrahTripOperationsApplicationService}from'@elhafez/hajj-umrah-trip-operations';
import{HajjUmrahTripOperationsModule}from'@elhafez/hajj-umrah-trip-operations/nest';
import type{TourismContractInventoryApplicationService}from'@elhafez/tourism-contract-inventory';
import{TOURISM_CONTRACT_INVENTORY_SERVICE,TourismContractInventoryModule}from'@elhafez/tourism-contract-inventory/nest';
import{TourismFinanceOrchestrationApplicationService}from'@elhafez/tourism-finance-orchestration';
import{TourismFinanceOrchestrationModule}from'@elhafez/tourism-finance-orchestration/nest';
import{FinancialReportingApplicationService,FinancialReportingModule}from'@elhafez/financial-reporting';
import{HajjUmrahReadinessApplicationService}from'./application/hajj-umrah-readiness.application-service.js';
import{READINESS_REPOSITORY,type ReadinessRepository}from'./application/readiness.repository.js';
import type{ReadinessSources}from'./application/readiness.ports.js';
import{PlatformReadinessAccess}from'./infrastructure/platform-readiness.access.js';
import{PrismaReadinessRepository}from'./infrastructure/prisma-readiness.repository.js';

@Module({
 imports:[PlatformCoreModule,HajjUmrahProgramsModule,HajjUmrahBookingsModule,TravelerManagementModule,HajjUmrahRoomingModule,HajjUmrahVisaOperationsModule,HajjUmrahTicketingModule,HajjUmrahTransportOperationsModule,HajjUmrahTripOperationsModule,TourismContractInventoryModule,TourismFinanceOrchestrationModule,FinancialReportingModule],
 providers:[
  PrismaClient,
  {provide:READINESS_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaReadinessRepository(db),inject:[PrismaClient]},
  {provide:HajjUmrahReadinessApplicationService,useFactory:(
   repository:ReadinessRepository,platform:PlatformCoreApplicationService,programs:HajjUmrahProgramsApplicationService,
   bookings:HajjUmrahBookingsApplicationService,travelers:TravelerManagementApplicationService,rooming:HajjUmrahRoomingApplicationService,
   visas:HajjUmrahVisaOperationsApplicationService,tickets:HajjUmrahTicketingApplicationService,transport:HajjUmrahTransportOperationsApplicationService,
   trip:HajjUmrahTripOperationsApplicationService,inventory:TourismContractInventoryApplicationService,
   finance:TourismFinanceOrchestrationApplicationService,reporting:FinancialReportingApplicationService,
  )=>{
   const sources:ReadinessSources={
    program:(c,id)=>programs.getForIntegration(c,id),
    closeProgramOwner:(c,id,expected)=>programs.closeAfterReadinessForIntegration(c,id,expected),
    booking:(c,id)=>bookings.requireForIntegration(c,id),
    bookings:(c,id)=>bookings.listForProgramForIntegration(c,id),
    traveler:(c,id)=>travelers.requireActiveForIntegration(c,travelerId(id)),
    passport:(c,id)=>travelers.currentPassportForIntegration(c,travelerId(id)),
    rooming:(c,id)=>rooming.listForIntegration(c,id),
    visas:(c,id)=>visas.listForIntegration(c,id),
    tickets:(c,id)=>tickets.listForIntegration(c,id),
    transportRuns:(c,id)=>transport.listRunsForIntegration(c,id),
    manifest:(c,id)=>transport.manifestForIntegration(c,id),
    tasks:(c,id)=>trip.listTasksForIntegration(c,id),
    incidents:(c,id)=>trip.listIncidentsForIntegration(c,id),
    services:(c,id)=>trip.listServicesForIntegration(c,id),
    allocation:(c,id)=>inventory.getAllocation(companyId(c),id),
    supply:(input)=>inventory.checkProgramSupplyEvidence(input),
    bookingFinancial:(input)=>finance.evaluateBookingFinancialReadiness({...input,companyId:companyId(input.companyId)}),
    programFinancial:(input)=>finance.evaluateFinancialReadiness({...input,companyId:companyId(input.companyId)}),
    closeFinancial:(input)=>finance.closeProgram({...input,companyId:companyId(input.companyId),program:input.program as SourceReference}),
    programAccounting:(input,id)=>reporting.getProgramAccountingSnapshot(input,id),
   };
   return new HajjUmrahReadinessApplicationService(repository,new PlatformReadinessAccess(platform),sources);
  },inject:[READINESS_REPOSITORY,PlatformCoreApplicationService,HajjUmrahProgramsApplicationService,HajjUmrahBookingsApplicationService,TravelerManagementApplicationService,HajjUmrahRoomingApplicationService,HajjUmrahVisaOperationsApplicationService,HajjUmrahTicketingApplicationService,HajjUmrahTransportOperationsApplicationService,HajjUmrahTripOperationsApplicationService,TOURISM_CONTRACT_INVENTORY_SERVICE,TourismFinanceOrchestrationApplicationService,FinancialReportingApplicationService]},
 ],
 exports:[HajjUmrahReadinessApplicationService],
})
export class HajjUmrahReadinessModule{}
