import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PlatformCoreApplicationService, PlatformCoreModule } from '@elhafez/platform-core';
import { PartyRegistryApplicationService, PartyRegistryModule } from '@elhafez/party-registry';
import { AgentManagementApplicationService } from './application/agent-management.application-service.js';
import { AGENT_ACCESS, type AgentAccess } from './application/agent-access.js';
import { AGENT_MANAGEMENT_REPOSITORY, type AgentManagementRepository } from './application/agent-management.repository.js';
import type { AgentPartyRegistryPort } from './application/party-registry.port.js';
import { AgentController } from './infrastructure/agent.controller.js';
import { PlatformAgentAccess } from './infrastructure/platform-agent-access.js';
import { PrismaAgentManagementRepository } from './infrastructure/prisma-agent-management.repository.js';

class PartyRegistryAdapter implements AgentPartyRegistryPort {
  constructor(private readonly service: PartyRegistryApplicationService) {}
  resolveOrCreateForIntegration(...args: Parameters<AgentPartyRegistryPort['resolveOrCreateForIntegration']>) { return this.service.resolveOrCreateForIntegration(...args); }
  ensureRoleForIntegration(...args: Parameters<AgentPartyRegistryPort['ensureRoleForIntegration']>) { return this.service.ensureRoleForIntegration(...args); }
  removeRoleForIntegration(...args: Parameters<AgentPartyRegistryPort['removeRoleForIntegration']>) { return this.service.removeRoleForIntegration(...args); }
  getForIntegration(...args: Parameters<AgentPartyRegistryPort['getForIntegration']>) { return this.service.getForIntegration(...args); }
  updateForIntegration(...args: Parameters<AgentPartyRegistryPort['updateForIntegration']>) { return this.service.updateForIntegration(...args); }
}
@Module({imports:[PlatformCoreModule,PartyRegistryModule],controllers:[AgentController],providers:[
  PrismaClient,
  {provide:AGENT_MANAGEMENT_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaAgentManagementRepository(db),inject:[PrismaClient]},
  {provide:AGENT_ACCESS,useFactory:(p:PlatformCoreApplicationService)=>new PlatformAgentAccess(p),inject:[PlatformCoreApplicationService]},
  {provide:AgentManagementApplicationService,useFactory:(r:AgentManagementRepository,p:PartyRegistryApplicationService,a:AgentAccess)=>new AgentManagementApplicationService(r,new PartyRegistryAdapter(p),a),inject:[AGENT_MANAGEMENT_REPOSITORY,PartyRegistryApplicationService,AGENT_ACCESS]}
],exports:[AgentManagementApplicationService]})
export class AgentManagementModule{}
