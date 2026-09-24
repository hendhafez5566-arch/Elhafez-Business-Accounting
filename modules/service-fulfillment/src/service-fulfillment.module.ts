import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StandaloneServicesApplicationService } from '@elhafez/standalone-services';
import { StandaloneServicesModule } from '@elhafez/standalone-services/nest';
import { ServiceFulfillmentApplicationService, type FulfillmentRepository } from './application/service-fulfillment.application-service.js';
import { PrismaServiceFulfillmentRepository } from './infrastructure/prisma-service-fulfillment.repository.js';
import { TOURISM_CONTRACT_INVENTORY_SERVICE, TourismContractInventoryModule } from '@elhafez/tourism-contract-inventory/nest';
import type { TourismContractInventoryApplicationService } from '@elhafez/tourism-contract-inventory';
export const SERVICE_FULFILLMENT_REPOSITORY=Symbol('SERVICE_FULFILLMENT_REPOSITORY');
@Module({imports:[StandaloneServicesModule,TourismContractInventoryModule],providers:[PrismaClient,{provide:SERVICE_FULFILLMENT_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaServiceFulfillmentRepository(db),inject:[PrismaClient]},{provide:ServiceFulfillmentApplicationService,useFactory:(repo:FulfillmentRepository,services:StandaloneServicesApplicationService,inventory:TourismContractInventoryApplicationService)=>new ServiceFulfillmentApplicationService(repo,services,inventory),inject:[SERVICE_FULFILLMENT_REPOSITORY,StandaloneServicesApplicationService,TOURISM_CONTRACT_INVENTORY_SERVICE]}],exports:[ServiceFulfillmentApplicationService]})
export class ServiceFulfillmentModule {}
