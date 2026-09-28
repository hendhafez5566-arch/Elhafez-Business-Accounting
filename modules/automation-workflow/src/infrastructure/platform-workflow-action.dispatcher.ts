import type{PlatformCoreApplicationService}from'@elhafez/platform-core';
import type{IntegrationHubApplicationService}from'@elhafez/integration-hub';
import type{WorkflowActionDispatcher}from'../application/automation-workflow.ports.js';
function text(value:unknown,field:string){if(typeof value!=='string'||!value.trim())throw new Error(field+' is required');return value.trim();}
function object(value:unknown){return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export class PlatformWorkflowActionDispatcher implements WorkflowActionDispatcher{
 constructor(private readonly platform:PlatformCoreApplicationService,private readonly integrations:IntegrationHubApplicationService){}
 async execute(command:{companyId:string;branchId:string|null;runId:string;stepIndex:number;action:string;input:Readonly<Record<string,unknown>>}){
  if(command.action==='platform.notify'){const userId=text(command.input.userId,'userId'),type=text(command.input.type,'type'),payload=object(command.input.payload);await this.platform.notify(userId,type,payload,command.companyId);return;}
  if(command.action==='integration.webhook'){const event=text(command.input.event,'event'),payload=object(command.input.payload);await this.integrations.enqueueEvent(command.companyId as Parameters<IntegrationHubApplicationService['enqueueEvent']>[0],event,{...payload,workflowRunId:command.runId,workflowStep:command.stepIndex,...(command.branchId?{branchId:command.branchId}:{})});return;}
  throw new Error('workflow action is not registered: '+command.action);
 }
}
