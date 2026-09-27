import type{WorkflowDefinition,WorkflowEvent,WorkflowRun,WorkflowSpec,WorkflowStatus}from'../domain/automation-workflow.js';
import type{ClaimedWorkflowRun}from'./automation-workflow.ports.js';
export interface AutomationWorkflowRepository{
 createDefinition(input:{id:string;companyId:string;code:string;name:string;triggerEvent:string;status:WorkflowStatus;version:number;spec:WorkflowSpec;createdBy:string;createdAt:string;updatedAt:string}):Promise<WorkflowDefinition>;
 updateDefinition(companyId:string,id:string,input:{name:string;triggerEvent:string;status:WorkflowStatus;version:number;spec:WorkflowSpec;updatedAt:string}):Promise<WorkflowDefinition>;
 findDefinition(companyId:string,id:string):Promise<WorkflowDefinition|undefined>;
 listDefinitions(companyId:string):Promise<readonly WorkflowDefinition[]>;
 listActiveByEvent(companyId:string,eventName:string):Promise<readonly WorkflowDefinition[]>;
 createRunIdempotent(input:{id:string;event:WorkflowEvent;workflow:WorkflowDefinition;now:string}):Promise<WorkflowRun>;
 findRun(companyId:string,id:string):Promise<WorkflowRun|undefined>;
 listRuns(companyId:string,status?:WorkflowRun['status']):Promise<readonly WorkflowRun[]>;
 saveRun(run:WorkflowRun):Promise<WorkflowRun>;
 claimDue(now:string,limit:number,leaseToken:string,leaseExpiresAt:string):Promise<readonly ClaimedWorkflowRun[]>;
}
export const AUTOMATION_WORKFLOW_REPOSITORY=Symbol('AUTOMATION_WORKFLOW_REPOSITORY');
