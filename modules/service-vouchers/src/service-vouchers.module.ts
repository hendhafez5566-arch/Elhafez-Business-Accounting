import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StandaloneServicesApplicationService } from '@elhafez/standalone-services';
import { StandaloneServicesModule } from '@elhafez/standalone-services/nest';
import { ServiceFulfillmentApplicationService } from '@elhafez/service-fulfillment';
import { ServiceFulfillmentModule } from '@elhafez/service-fulfillment/nest';
import { ServiceVouchersApplicationService, type VoucherRepository } from './application/service-vouchers.application-service.js';
import { PrismaServiceVouchersRepository } from './infrastructure/prisma-service-vouchers.repository.js';
export const SERVICE_VOUCHERS_REPOSITORY=Symbol('SERVICE_VOUCHERS_REPOSITORY');
@Module({imports:[StandaloneServicesModule,ServiceFulfillmentModule],providers:[PrismaClient,{provide:SERVICE_VOUCHERS_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaServiceVouchersRepository(db),inject:[PrismaClient]},{provide:ServiceVouchersApplicationService,useFactory:(repo:VoucherRepository,services:StandaloneServicesApplicationService,fulfillment:ServiceFulfillmentApplicationService)=>new ServiceVouchersApplicationService(repo,services,fulfillment),inject:[SERVICE_VOUCHERS_REPOSITORY,StandaloneServicesApplicationService,ServiceFulfillmentApplicationService]}],exports:[ServiceVouchersApplicationService]})
export class ServiceVouchersModule {}
