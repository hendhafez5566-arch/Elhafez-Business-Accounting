import{Module}from'@nestjs/common';
import{PrismaClient}from'@prisma/client';
import{PlatformCoreApplicationService,PlatformCoreModule}from'@elhafez/platform-core';
import{ProcurementFinanceApplicationService,ProcurementFinanceModule}from'@elhafez/procurement-finance';
import{ProcurementFulfillmentApplicationService}from'./application/procurement-fulfillment.application-service.js';
import{PROCUREMENT_ACCESS,type ProcurementAccess}from'./application/procurement-access.js';
import{PROCUREMENT_FULFILLMENT_REPOSITORY,type ProcurementFulfillmentRepository}from'./application/procurement-fulfillment.repository.js';
import{PlatformProcurementAccess}from'./infrastructure/platform-procurement-access.js';
import{PrismaProcurementFulfillmentRepository}from'./infrastructure/prisma-procurement-fulfillment.repository.js';
import{ProcurementOperationsController}from'./infrastructure/procurement-operations.controller.js';

@Module({
 imports:[PlatformCoreModule,ProcurementFinanceModule],
 controllers:[ProcurementOperationsController],
 providers:[
  PrismaClient,
  {provide:PROCUREMENT_FULFILLMENT_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaProcurementFulfillmentRepository(db),inject:[PrismaClient]},
  {provide:PROCUREMENT_ACCESS,useFactory:(platform:PlatformCoreApplicationService)=>new PlatformProcurementAccess(platform),inject:[PlatformCoreApplicationService]},
  {provide:ProcurementFulfillmentApplicationService,useFactory:(repo:ProcurementFulfillmentRepository,procurement:ProcurementFinanceApplicationService,access:ProcurementAccess)=>new ProcurementFulfillmentApplicationService(repo,procurement,access),inject:[PROCUREMENT_FULFILLMENT_REPOSITORY,ProcurementFinanceApplicationService,PROCUREMENT_ACCESS]},
 ],
 exports:[ProcurementFulfillmentApplicationService],
})
export class ProcurementFulfillmentModule{}
