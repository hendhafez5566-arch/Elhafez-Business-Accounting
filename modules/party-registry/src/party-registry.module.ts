import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PlatformCoreApplicationService, PlatformCoreModule } from '@elhafez/platform-core';
import { PartyRegistryApplicationService } from './application/party-registry.application-service.js';
import { PARTY_ACCESS, type PartyAccess } from './application/party-access.js';
import { PARTY_REGISTRY_REPOSITORY, type PartyRegistryRepository } from './application/party-registry.repository.js';
import { PlatformPartyAccess } from './infrastructure/platform-party-access.js';
import { PrismaPartyRegistryRepository } from './infrastructure/prisma-party-registry.repository.js';
@Module({
  imports:[PlatformCoreModule],
  providers:[
    PrismaClient,
    {provide:PARTY_REGISTRY_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaPartyRegistryRepository(db),inject:[PrismaClient]},
    {provide:PARTY_ACCESS,useFactory:(platform:PlatformCoreApplicationService)=>new PlatformPartyAccess(platform),inject:[PlatformCoreApplicationService]},
    {provide:PartyRegistryApplicationService,useFactory:(repository:PartyRegistryRepository,access:PartyAccess)=>new PartyRegistryApplicationService(repository,access),inject:[PARTY_REGISTRY_REPOSITORY,PARTY_ACCESS]},
  ],
  exports:[PartyRegistryApplicationService],
})
export class PartyRegistryModule {}
