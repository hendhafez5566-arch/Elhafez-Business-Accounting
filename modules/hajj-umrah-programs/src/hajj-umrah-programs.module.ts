import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  PlatformCoreApplicationService,
  PlatformCoreModule,
} from '@elhafez/platform-core';
import {
  HajjUmrahSeasonsApplicationService,
  HajjUmrahSeasonsModule,
} from '@elhafez/hajj-umrah-seasons';
import type { TourismContractInventoryApplicationService } from '@elhafez/tourism-contract-inventory';
import {
  TOURISM_CONTRACT_INVENTORY_SERVICE,
  TourismContractInventoryModule,
} from '@elhafez/tourism-contract-inventory/nest';
import {
  PeriodControlApplicationService,
  PeriodControlModule,
} from '@elhafez/period-control';
import { HajjUmrahProgramsApplicationService } from './application/hajj-umrah-programs.application-service.js';
import {
  PROGRAM_ACCESS,
  REOPEN_GUARD,
  SEASON_PORT,
  SUPPLY_PORT,
  type ProgramAccess,
  type ReopenGuard,
  type SeasonPort,
  type SupplyPort,
} from './application/program.ports.js';
import {
  PROGRAM_REPOSITORY,
  type ProgramRepository,
} from './application/program.repository.js';
import { PlatformProgramAccess } from './infrastructure/platform-program.access.js';
import { PrismaProgramRepository } from './infrastructure/prisma-program.repository.js';

@Module({
  imports: [
    PlatformCoreModule,
    HajjUmrahSeasonsModule,
    TourismContractInventoryModule,
    PeriodControlModule,
  ],
  providers: [
    PrismaClient,
    {
      provide: PROGRAM_REPOSITORY,
      useFactory: (db: PrismaClient) => new PrismaProgramRepository(db),
      inject: [PrismaClient],
    },
    {
      provide: PROGRAM_ACCESS,
      useFactory: (platform: PlatformCoreApplicationService) =>
        new PlatformProgramAccess(platform),
      inject: [PlatformCoreApplicationService],
    },
    {
      provide: SEASON_PORT,
      useFactory: (seasons: HajjUmrahSeasonsApplicationService): SeasonPort => ({
        validate: async (companyId, branchId, id, start, end) => {
          await seasons.validateProgramDatesForIntegration(
            companyId,
            branchId,
            id,
            start,
            end,
          );
        },
      }),
      inject: [HajjUmrahSeasonsApplicationService],
    },
    {
      provide: SUPPLY_PORT,
      useFactory: (
        inventory: TourismContractInventoryApplicationService,
      ): SupplyPort => ({
        hasEvidence: async (input) => {
          const result = await inventory.checkProgramSupplyEvidence({
            companyId: input.companyId,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            serviceDate: input.serviceDate,
            ...(input.periodEnd ? { periodEnd: input.periodEnd } : {}),
            ...(input.serviceCategory
              ? { serviceCategory: input.serviceCategory }
              : {}),
          });
          return result.available;
        },
      }),
      inject: [TOURISM_CONTRACT_INVENTORY_SERVICE],
    },
    {
      provide: REOPEN_GUARD,
      useFactory: (periods: PeriodControlApplicationService): ReopenGuard => ({
        assertOpen: async (companyId, branchId, at) => {
          void branchId;
          await periods.authorizePosting(companyId, at.slice(0, 10));
        },
      }),
      inject: [PeriodControlApplicationService],
    },
    {
      provide: HajjUmrahProgramsApplicationService,
      useFactory: (
        repository: ProgramRepository,
        access: ProgramAccess,
        seasons: SeasonPort,
        supply: SupplyPort,
        guard: ReopenGuard,
      ) =>
        new HajjUmrahProgramsApplicationService(
          repository,
          access,
          seasons,
          supply,
          guard,
        ),
      inject: [
        PROGRAM_REPOSITORY,
        PROGRAM_ACCESS,
        SEASON_PORT,
        SUPPLY_PORT,
        REOPEN_GUARD,
      ],
    },
  ],
  exports: [HajjUmrahProgramsApplicationService],
})
export class HajjUmrahProgramsModule {}
