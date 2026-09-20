import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { AgentManagementApplicationService, type CreateAgentInput, type UpdateAgentInput } from '../application/agent-management.application-service.js';
import { agentId, type AgentStatus } from '../domain/agent.js';
@Controller('crm/agents')
export class AgentController{constructor(private readonly service:AgentManagementApplicationService,private readonly platform:PlatformCoreApplicationService){}
 @Get() async list(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Query('status')s:AgentStatus|undefined,@Query('q')q:string|undefined){return this.service.list(await this.ctx(a,c,b),s,q);}
 @Post() async create(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Body()body:CreateAgentInput){return this.service.create(await this.ctx(a,c,b),body);}
 @Patch(':id') async update(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Body()body:UpdateAgentInput){return this.service.update(await this.ctx(a,c,b),agentId(id),body);}
 @Post(':id/suspend') async suspend(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){return this.service.suspend(await this.ctx(a,c,b),agentId(id));}
 @Post(':id/reactivate') async reactivate(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){return this.service.reactivate(await this.ctx(a,c,b),agentId(id));}
 @Delete(':id') async remove(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){await this.service.hardDelete(await this.ctx(a,c,b),agentId(id));return{deleted:true};}
 private async ctx(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(auth.slice(7));return executionContext(company,branch,user.id);}
}
