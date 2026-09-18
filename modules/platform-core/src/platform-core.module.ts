import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PlatformCoreApplicationService } from './application/platform-core.application-service.js';
import { PLATFORM_CORE_REPOSITORY } from './application/platform-core.repository.js';
import { PrismaPlatformRepository } from './infrastructure/prisma-platform.repository.js';

/** Platform composition boundary. HTTP adapters may depend only on its public service. */
@Module({ providers: [PrismaClient, { provide: PLATFORM_CORE_REPOSITORY, useFactory: (prisma: PrismaClient) => new PrismaPlatformRepository(prisma), inject: [PrismaClient] }, { provide: PlatformCoreApplicationService, useFactory: (repository: PrismaPlatformRepository) => new PlatformCoreApplicationService(repository), inject: [PLATFORM_CORE_REPOSITORY] }], exports: [PlatformCoreApplicationService, PLATFORM_CORE_REPOSITORY] })
export class PlatformCoreModule {}
