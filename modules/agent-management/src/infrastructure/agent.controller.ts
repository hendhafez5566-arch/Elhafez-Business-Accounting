import { Body, Inject, Controller, Delete, Get, Headers,  Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { AgentManagementApplicationService, type CreateAgentInput, type UpdateAgentInput } from '../application/agent-management.application-service.js';
import { agentId, type AgentStatus } from '../domain/agent.js';

export class AgentController{constructor(private readonly service:AgentManagementApplicationService,private readonly platform:PlatformCoreApplicationService){}
 async list(a:string|undefined,c:string|undefined,b:string|undefined,s:AgentStatus|undefined,q:string|undefined){return this.service.list(await this.ctx(a,c,b),s,q);}
 async create(a:string|undefined,c:string|undefined,b:string|undefined,body:CreateAgentInput){return this.service.create(await this.ctx(a,c,b),body);}
 async update(a:string|undefined,c:string|undefined,b:string|undefined,id:string,body:UpdateAgentInput){return this.service.update(await this.ctx(a,c,b),agentId(id),body);}
 async suspend(a:string|undefined,c:string|undefined,b:string|undefined,id:string){return this.service.suspend(await this.ctx(a,c,b),agentId(id));}
 async reactivate(a:string|undefined,c:string|undefined,b:string|undefined,id:string){return this.service.reactivate(await this.ctx(a,c,b),agentId(id));}
 async remove(a:string|undefined,c:string|undefined,b:string|undefined,id:string){await this.service.hardDelete(await this.ctx(a,c,b),agentId(id));return{deleted:true};}
 private async ctx(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(auth.slice(7));return executionContext(company,branch,user.id);}
}
Controller('crm/agents')(AgentController);

Get()(AgentController.prototype,'list',Object.getOwnPropertyDescriptor(AgentController.prototype,'list')!);
Post()(AgentController.prototype,'create',Object.getOwnPropertyDescriptor(AgentController.prototype,'create')!);
Patch(':id')(AgentController.prototype,'update',Object.getOwnPropertyDescriptor(AgentController.prototype,'update')!);
Post(':id/suspend')(AgentController.prototype,'suspend',Object.getOwnPropertyDescriptor(AgentController.prototype,'suspend')!);
Post(':id/reactivate')(AgentController.prototype,'reactivate',Object.getOwnPropertyDescriptor(AgentController.prototype,'reactivate')!);
Delete(':id')(AgentController.prototype,'remove',Object.getOwnPropertyDescriptor(AgentController.prototype,'remove')!);

Headers('authorization')(AgentController.prototype,'list',0);
Headers('x-company-id')(AgentController.prototype,'list',1);
Headers('x-branch-id')(AgentController.prototype,'list',2);
Query('status')(AgentController.prototype,'list',3);
Query('q')(AgentController.prototype,'list',4);
Headers('authorization')(AgentController.prototype,'create',0);
Headers('x-company-id')(AgentController.prototype,'create',1);
Headers('x-branch-id')(AgentController.prototype,'create',2);
Body()(AgentController.prototype,'create',3);
Headers('authorization')(AgentController.prototype,'update',0);
Headers('x-company-id')(AgentController.prototype,'update',1);
Headers('x-branch-id')(AgentController.prototype,'update',2);
Param('id')(AgentController.prototype,'update',3);
Body()(AgentController.prototype,'update',4);
Headers('authorization')(AgentController.prototype,'suspend',0);
Headers('x-company-id')(AgentController.prototype,'suspend',1);
Headers('x-branch-id')(AgentController.prototype,'suspend',2);
Param('id')(AgentController.prototype,'suspend',3);
Headers('authorization')(AgentController.prototype,'reactivate',0);
Headers('x-company-id')(AgentController.prototype,'reactivate',1);
Headers('x-branch-id')(AgentController.prototype,'reactivate',2);
Param('id')(AgentController.prototype,'reactivate',3);
Headers('authorization')(AgentController.prototype,'remove',0);
Headers('x-company-id')(AgentController.prototype,'remove',1);
Headers('x-branch-id')(AgentController.prototype,'remove',2);
Param('id')(AgentController.prototype,'remove',3);
Inject(AgentManagementApplicationService)(AgentController,undefined,0);
Inject(PlatformCoreApplicationService)(AgentController,undefined,1);
