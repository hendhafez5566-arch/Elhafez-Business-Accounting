import{Body,Controller,Get,Headers,Param,Patch,Post,Query,UnauthorizedException}from'@nestjs/common';
import{PlatformCoreApplicationService}from'@elhafez/platform-core';
import{AutomationWorkflowApplicationService,type AutomationWorkflowContext,type CreateWorkflowInput,type UpdateWorkflowInput}from'../application/automation-workflow.application-service.js';
import type{WorkflowEvent,WorkflowRun,WorkflowStatus}from'../domain/automation-workflow.js';

@Controller('automation-workflows')
export class AutomationWorkflowController{
 constructor(private readonly service:AutomationWorkflowApplicationService,private readonly platform:PlatformCoreApplicationService){}
 @Get()async definitions(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined){return this.service.listDefinitions(await this.context(authorization,companyId));}
 @Post()async create(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Body()input:CreateWorkflowInput){return this.service.createDefinition(await this.context(authorization,companyId),input);}
 @Patch(':workflowId')async update(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('workflowId')workflowId:string,@Body()input:UpdateWorkflowInput){return this.service.updateDefinition(await this.context(authorization,companyId),workflowId,input);}
 @Post(':workflowId/status')async status(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('workflowId')workflowId:string,@Body()input:{status:WorkflowStatus}){return this.service.setStatus(await this.context(authorization,companyId),workflowId,input.status);}
 @Get('runs')async runs(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Query('status')status?:WorkflowRun['status']){return this.service.listRuns(await this.context(authorization,companyId),status);}
 @Get('runs/:runId/logs')async logs(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('runId')runId:string){return this.service.listExecutionLog(await this.context(authorization,companyId),runId);}
 @Post('runs/:runId/approval')async signal(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('runId')runId:string,@Body()input:{signal:string;approved:boolean}){return this.service.signalApproval(await this.context(authorization,companyId),runId,input.signal,input.approved);}
 @Post('events/manual')async event(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Body()input:Omit<WorkflowEvent,'companyId'>){return this.service.emitManually(await this.context(authorization,companyId),input);}
 private async context(authorization:string|undefined,companyId:string|undefined):Promise<AutomationWorkflowContext>{if(!authorization?.startsWith('Bearer ')||!companyId)throw new UnauthorizedException('authenticated company context required');const user=await this.platform.currentUser(authorization.slice(7));return{companyId,actorId:user.id};}
}
