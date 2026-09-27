import type{PlatformCoreApplicationService}from'@elhafez/platform-core';
import type{WorkflowActionDispatcher}from'../application/automation-workflow.ports.js';
function text(value:unknown,field:string){if(typeof value!=='string'||!value.trim())throw new Error(field+' is required');return value.trim();}
export class PlatformWorkflowActionDispatcher implements WorkflowActionDispatcher{
 constructor(private readonly platform:PlatformCoreApplicationService){}
 async execute(command:{companyId:string;action:string;input:Readonly<Record<string,unknown>>}){if(command.action!=='platform.notify')throw new Error('workflow action is not registered: '+command.action);const userId=text(command.input.userId,'userId'),type=text(command.input.type,'type'),payload=command.input.payload&&typeof command.input.payload==='object'&&!Array.isArray(command.input.payload)?command.input.payload as Record<string,unknown>:{};await this.platform.notify(userId,type,payload,command.companyId);}
}
