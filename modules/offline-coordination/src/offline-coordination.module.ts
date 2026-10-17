import { WriteAuthorityApplicationService, WRITE_AUTHORITY_REPOSITORY, type WriteAuthorityRepository } from './application/write-authority.application-service.js';
import { PrismaWriteAuthorityRepository } from './infrastructure/prisma-write-authority.repository.js';
import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { COORDINATION_REPOSITORY } from './application/coordination.ports.js';
import { PrismaCoordinationRepository } from './infrastructure/prisma-coordination.repository.js';
/** Composition root supplies platform access and public owner execution ports. */
@Module({providers:[PrismaClient,{provide:WRITE_AUTHORITY_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaWriteAuthorityRepository(db),inject:[PrismaClient]},{provide:WriteAuthorityApplicationService,useFactory:(r:WriteAuthorityRepository)=>new WriteAuthorityApplicationService(r),inject:[WRITE_AUTHORITY_REPOSITORY]},{provide:COORDINATION_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaCoordinationRepository(db),inject:[PrismaClient]}],exports:[COORDINATION_REPOSITORY,WriteAuthorityApplicationService]})
export class OfflineCoordinationModule {}
