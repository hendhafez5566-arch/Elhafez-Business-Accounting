import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PlatformCoreApplicationService, PlatformCoreModule } from '@elhafez/platform-core';
import { CustomerManagementApplicationService } from '@elhafez/customer-management';
import { CustomerManagementModule } from '@elhafez/customer-management/nest';
import { PartyRegistryApplicationService, PartyRegistryModule } from '@elhafez/party-registry';
import { TravelerManagementApplicationService } from './application/traveler-management.application-service.js';
import { TRAVELER_MANAGEMENT_ACCESS, type TravelerManagementAccess } from './application/traveler-management-access.js';
import { TRAVELER_MANAGEMENT_REPOSITORY, type TravelerManagementRepository } from './application/traveler-management.repository.js';
import { CustomerPartyLinkageAdapter } from './infrastructure/customer-party-linkage.adapter.js';
import { PlatformTravelerManagementAccess } from './infrastructure/platform-traveler-management-access.js';
import { PrismaTravelerManagementRepository } from './infrastructure/prisma-traveler-management.repository.js';
import { TravelerManagementController } from './infrastructure/traveler-management.controller.js';

@Module({
  imports: [PlatformCoreModule, CustomerManagementModule, PartyRegistryModule],
  controllers: [TravelerManagementController],
  providers: [
    PrismaClient,
    { provide: TRAVELER_MANAGEMENT_REPOSITORY, useFactory: (db: PrismaClient) => new PrismaTravelerManagementRepository(db), inject: [PrismaClient] },
    { provide: TRAVELER_MANAGEMENT_ACCESS, useFactory: (platform: PlatformCoreApplicationService) => new PlatformTravelerManagementAccess(platform), inject: [PlatformCoreApplicationService] },
    {
      provide: TravelerManagementApplicationService,
      useFactory: (repository: TravelerManagementRepository, access: TravelerManagementAccess, customers: CustomerManagementApplicationService, parties: PartyRegistryApplicationService) =>
        new TravelerManagementApplicationService(repository, access, new CustomerPartyLinkageAdapter(customers, parties)),
      inject: [TRAVELER_MANAGEMENT_REPOSITORY, TRAVELER_MANAGEMENT_ACCESS, CustomerManagementApplicationService, PartyRegistryApplicationService],
    },
  ],
  exports: [TravelerManagementApplicationService],
})
export class TravelerManagementModule {}
