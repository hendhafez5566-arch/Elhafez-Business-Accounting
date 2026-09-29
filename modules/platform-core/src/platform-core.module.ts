import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PlatformCoreApplicationService } from './application/platform-core.application-service.js';
import { EntityFileLinksApplicationService } from './application/entity-file-links.application-service.js';
import { ENTITY_FILE_LINKS_REPOSITORY } from './application/entity-file-links.repository.js';
import { PLATFORM_CORE_REPOSITORY } from './application/platform-core.repository.js';
import { MigrationControlApplicationService } from './application/migration-control.application-service.js';
import { MIGRATION_CONTROL_REPOSITORY } from './application/migration-control.repository.js';
import { PrismaPlatformRepository } from './infrastructure/prisma-platform.repository.js';
import { PrismaEntityFileLinksRepository } from './infrastructure/prisma-entity-file-links.repository.js';
import { LocalFileStorage } from './infrastructure/local-file.storage.js';
import { recoveryDeliveryFromEnvironment } from './infrastructure/recovery.delivery.js';
import { PrismaMigrationControlRepository } from './infrastructure/prisma-migration-control.repository.js';

/** Platform composition boundary. HTTP adapters may depend only on its public service. */
@Module({
  providers: [
    PrismaClient,
    { provide: PLATFORM_CORE_REPOSITORY, useFactory: (prisma: PrismaClient) => new PrismaPlatformRepository(prisma), inject: [PrismaClient] },
    { provide: ENTITY_FILE_LINKS_REPOSITORY, useFactory: (prisma:PrismaClient)=>new PrismaEntityFileLinksRepository(prisma), inject:[PrismaClient] },
    { provide: PlatformCoreApplicationService, useFactory: (repository: PrismaPlatformRepository) => new PlatformCoreApplicationService(repository,undefined,undefined,recoveryDeliveryFromEnvironment(),new LocalFileStorage()), inject: [PLATFORM_CORE_REPOSITORY] },
    { provide: EntityFileLinksApplicationService, useFactory: (repository:PrismaEntityFileLinksRepository,files:PlatformCoreApplicationService)=>new EntityFileLinksApplicationService(repository,files), inject:[ENTITY_FILE_LINKS_REPOSITORY,PlatformCoreApplicationService] },
    { provide: MIGRATION_CONTROL_REPOSITORY, useFactory: (prisma: PrismaClient) => new PrismaMigrationControlRepository(prisma), inject: [PrismaClient] },
    { provide: MigrationControlApplicationService, useFactory: (repository: PrismaMigrationControlRepository) => new MigrationControlApplicationService(repository), inject: [MIGRATION_CONTROL_REPOSITORY] },
  ],
  // Internal repository tokens stay private. Consumers outside this module
  // depend only on the exported application services.
  exports: [PlatformCoreApplicationService, EntityFileLinksApplicationService, PLATFORM_CORE_REPOSITORY, MigrationControlApplicationService],
})
export class PlatformCoreModule {}
