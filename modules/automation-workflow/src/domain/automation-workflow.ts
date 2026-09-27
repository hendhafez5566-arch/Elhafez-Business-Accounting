export type WorkflowStatus='DRAFT'|'ACTIVE'|'PAUSED'|'RETIRED';
export type WorkflowRunStatus='PENDING'|'RUNNING'|'WAITING'|'WAITING_APPROVAL'|'COMPLETED'|'CANCELLED'|'DEAD_LETTER';
export type WorkflowConditionOperator='EQ'|'NE'|'GT'|'GTE'|'LT'|'LTE'|'EXISTS';
export interface WorkflowCondition{readonly path:string;readonly operator:WorkflowConditionOperator;readonly value?:unknown}
export interface WorkflowAction{readonly kind:'ACTION'|'ESCALATION';readonly action:string;readonly input?:Readonly<Record<string,unknown>>}
export interface WorkflowDelay{readonly kind:'DELAY';readonly seconds:number}
export interface WorkflowApproval{readonly kind:'APPROVAL';readonly signal:string}
export type WorkflowStep=WorkflowAction|WorkflowDelay|WorkflowApproval;
export interface WorkflowSpec{readonly conditions:readonly WorkflowCondition[];readonly steps:readonly WorkflowStep[];readonly retry:{readonly maxAttempts:number;readonly backoffSeconds:number;readonly deadLetterAction?:WorkflowAction}}
export interface WorkflowDefinition{readonly id:string;readonly companyId:string;readonly code:string;readonly name:string;readonly triggerEvent:string;readonly status:WorkflowStatus;readonly version:number;readonly spec:WorkflowSpec;readonly createdBy:string;readonly createdAt:string;readonly updatedAt:string}
export interface WorkflowEvent{readonly companyId:string;readonly branchId:string|null;readonly name:string;readonly correlationKey:string;readonly payload:Readonly<Record<string,unknown>>;readonly occurredAt:string}
export interface WorkflowRun{readonly id:string;readonly companyId:string;readonly branchId:string|null;readonly workflowId:string;readonly workflowVersion:number;readonly triggerEvent:string;readonly correlationKey:string;readonly payload:Readonly<Record<string,unknown>>;readonly workflowSpec:WorkflowSpec;status:WorkflowRunStatus;currentStep:number;attemptCount:number;nextRunAt:string|null;waitingSignal:string|null;lastError:string|null;leaseToken:string|null;leaseExpiresAt:string|null;readonly createdAt:string;updatedAt:string;completedAt:string|null}
export interface WorkflowExecutionLog{readonly id:string;readonly companyId:string;readonly runId:string;readonly stepIndex:number;readonly kind:string;readonly status:string;readonly detail:Readonly<Record<string,unknown>>;readonly occurredAt:string}
