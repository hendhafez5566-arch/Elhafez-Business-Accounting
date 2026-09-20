import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PlatformCoreApplicationService, PlatformCoreModule } from '@elhafez/platform-core';
import { AgentManagementApplicationService, AgentManagementModule } from '@elhafez/agent-management';
import { PartyRegistryApplicationService, PartyRegistryModule } from '@elhafez/party-registry';
import { CustomerManagementApplicationService } from './application/customer-management.application-service.js';
import { CUSTOMER_ACCESS, type CustomerAccess } from './application/customer-access.js';
import type { CustomerAgentPort, CustomerPartyRegistryPort } from './application/customer-dependencies.port.js';
import { CUSTOMER_MANAGEMENT_REPOSITORY, type CustomerManagementRepository } from './application/customer-management.repository.js';
import { CustomerController } from './infrastructure/customer.controller.js';
import { PlatformCustomerAccess } from './infrastructure/platform-customer-access.js';
import { PrismaCustomerManagementRepository } from './infrastructure/prisma-customer-management.repository.js';

class PartyAdapter implements CustomerPartyRegistryPort {
 constructor(private readonly service:PartyRegistryApplicationService){}
 resolveOrCreateForIntegration(...args:Parameters<CustomerPartyRegistryPort['resolveOrCreateForIntegration']>){return this.service.resolveOrCreateForIntegration(...args);}
 ensureRoleForIntegration(...args:Parameters<CustomerPartyRegistryPort['ensureRoleForIntegration']>){return this.service.ensureRoleForIntegration(...args);}
 removeRoleForIntegration(...args:Parameters<CustomerPartyRegistryPort['removeRoleForIntegration']>){return this.service.removeRoleForIntegration(...args);}
 getForIntegration(...args:Parameters<CustomerPartyRegistryPort['getForIntegration']>){return this.service.getForIntegration(...args);}
 searchForIntegration(...args:Parameters<CustomerPartyRegistryPort['searchForIntegration']>){return this.service.searchForIntegration(...args);}
 updateForIntegration(...args:Parameters<CustomerPartyRegistryPort['updateForIntegration']>){return this.service.updateForIntegration(...args);}
}
class AgentAdapter implements CustomerAgentPort {
 constructor(private readonly service:AgentManagementApplicationService){}
 requireActiveForIntegration(...args:Parameters<CustomerAgentPort['requireActiveForIntegration']>){return this.service.requireActiveForIntegration(...args);}
 registerReferenceForIntegration(...args:Parameters<CustomerAgentPort['registerReferenceForIntegration']>){return this.service.registerReferenceForIntegration(...args);}
 releaseReferenceForIntegration(...args:Parameters<CustomerAgentPort['releaseReferenceForIntegration']>){return this.service.releaseReferenceForIntegration(...args);}
}
@Module({imports:[PlatformCoreModule,PartyRegistryModule,AgentManagementModule],controllers:[CustomerController],providers:[
 PrismaClient,
 {provide:CUSTOMER_MANAGEMENT_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaCustomerManagementRepository(db),inject:[PrismaClient]},
 {provide:CUSTOMER_ACCESS,useFactory:(p:PlatformCoreApplicationService)=>new PlatformCustomerAccess(p),inject:[PlatformCoreApplicationService]},
 {provide:CustomerManagementApplicationService,useFactory:(r:CustomerManagementRepository,p:PartyRegistryApplicationService,a:AgentManagementApplicationService,x:CustomerAccess)=>new CustomerManagementApplicationService(r,new PartyAdapter(p),new AgentAdapter(a),x),inject:[CUSTOMER_MANAGEMENT_REPOSITORY,PartyRegistryApplicationService,AgentManagementApplicationService,CUSTOMER_ACCESS]}
],exports:[CustomerManagementApplicationService]})
export class CustomerManagementModule{}
