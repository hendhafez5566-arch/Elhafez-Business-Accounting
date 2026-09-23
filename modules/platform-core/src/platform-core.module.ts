import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PlatformCoreApplicationService } from './application/platform-core.application-service.js';
import { PLATFORM_CORE_REPOSITORY } from './application/platform-core.repository.js';
import { MigrationControlApplicationService } from './application/migration-control.application-service.js';
import { MIGRATION_CONTROL_REPOSITORY } from './application/migration-control.repository.js';
import { PrismaPlatformRepository } from './infrastructure/prisma-platform.repository.js';
import { LocalFileStorage,UnavailableRecoveryDelivery } from './infrastructure/local-file.storage.js';
import { PrismaMigrationControlRepository } from './infrastructure/prisma-migration-control.repository.js';

/** Platform composition boundary. HTTP adapters may depend only on its public service. */
@Module({
  providers: [
    PrismaClient,
    { provide: PLATFORM_CORE_REPOSITORY, useFactory: (prisma: PrismaClient) => new PrismaPlatformRepository(prisma), inject: [PrismaClient] },
    { provide: PlatformCoreApplicationService, useFactory: (repository: PrismaPlatformRepository) => new PlatformCoreApplicationService(repository,undefined,undefined,new UnavailableRecoveryDelivery(),new LocalFileStorage()), inject: [PLATFORM_CORE_REPOSITORY] },
    { provide: MIGRATION_CONTROL_REPOSITORY, useFactory: (prisma: PrismaClient) => new PrismaMigrationControlRepository(prisma), inject: [PrismaClient] },
    { provide: MigrationControlApplicationService, useFactory: (repository: PrismaMigrationControlRepository) => new MigrationControlApplicationService(repository), inject: [MIGRATION_CONTROL_REPOSITORY] },
  ],
  // MIGRATION_CONTROL_REPOSITORY is intentionally NOT exported: it stays an
  // internal provider/injection token. Consumers outside this module must
  // depend only on MigrationControlApplicationService.
  exports: [PlatformCoreApplicationService, PLATFORM_CORE_REPOSITORY, MigrationControlApplicationService],
})
export class PlatformCoreModule {}
