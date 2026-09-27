import type{WorkflowExecutionLog,WorkflowRun}from'../domain/automation-workflow.js';
export interface AutomationWorkflowAccess{requirePermission(context:{companyId:string;actorId:string},permission:string):Promise<void>;auditOnce(context:{companyId:string;actorId:string},key:string,action:string,entityId:string|null,metadata?:Record<string,unknown>):Promise<void>;}
export interface WorkflowActionDispatcher{execute(input:{companyId:string;branchId:string|null;runId:string;stepIndex:number;action:string;input:Readonly<Record<string,unknown>>}):Promise<void>;}
export interface WorkflowExecutionEvidence{append(log:WorkflowExecutionLog):Promise<void>;list(companyId:string,runId:string):Promise<readonly WorkflowExecutionLog[]>;}
export const AUTOMATION_WORKFLOW_ACCESS=Symbol('AUTOMATION_WORKFLOW_ACCESS');
export const WORKFLOW_ACTION_DISPATCHER=Symbol('WORKFLOW_ACTION_DISPATCHER');
export const WORKFLOW_EXECUTION_EVIDENCE=Symbol('WORKFLOW_EXECUTION_EVIDENCE');
export interface ClaimedWorkflowRun extends WorkflowRun{leaseToken:string;leaseExpiresAt:string}
