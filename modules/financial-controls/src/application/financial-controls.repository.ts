import type { ApprovalDecision, ApprovalPolicy, ApprovalRequest, ReconciliationType } from '../domain/financial-controls.js';

export interface ReconciliationIssue { readonly id: string; readonly companyId: string; readonly runId: string; readonly evidenceKey: string; readonly sourceAmount: string; readonly ledgerAmount: string; readonly difference: string; readonly detail: string; readonly resolvedAt?: string; readonly resolutionReference?: string }
export interface ReconciliationRun { readonly id: string; readonly companyId: string; readonly branchId?: string; readonly type: ReconciliationType; readonly correlationId: string; readonly fingerprint: string; readonly clean: boolean; readonly runAt: string }
export interface CloseReadinessRun { readonly id: string; readonly companyId: string; readonly branchId?: string; readonly correlationId: string; readonly fingerprint: string; readonly ready: boolean; readonly blockers: readonly string[]; readonly warnings: readonly string[]; readonly evaluatedAt: string }
export interface ControlEvidence { readonly id: string; readonly companyId: string; readonly kind: string; readonly subjectId: string; readonly detail: string; readonly occurredAt: string }
export interface FinancialControlsRepository {
  savePolicy(value: ApprovalPolicy): Promise<void>; findPolicy(companyId: string, action: string): Promise<ApprovalPolicy | undefined>; listPolicies(companyId:string):Promise<readonly ApprovalPolicy[]>;
  saveRequest(value: ApprovalRequest): Promise<void>; findRequest(companyId: string, id: string): Promise<ApprovalRequest | undefined>; listRequests(companyId:string,branchId?:string):Promise<readonly ApprovalRequest[]>;
  saveDecision(value: ApprovalDecision): Promise<void>; findDecision(companyId: string, requestId: string): Promise<ApprovalDecision | undefined>;
  saveRun(value: ReconciliationRun, issues: readonly ReconciliationIssue[]): Promise<void>; findRun(companyId: string, correlationId: string): Promise<{ run: ReconciliationRun; issues: readonly ReconciliationIssue[] } | undefined>; listRuns(companyId:string,branchId?:string):Promise<readonly ReconciliationRun[]>;
  findIssue(companyId: string, issueId: string): Promise<ReconciliationIssue | undefined>; listIssues(companyId:string,branchId?:string):Promise<readonly ReconciliationIssue[]>; resolveIssue(companyId: string, issueId: string, at: string, reference: string): Promise<ReconciliationIssue>;
  saveCloseRun(value: CloseReadinessRun): Promise<CloseReadinessRun>; findCloseRun(companyId: string, correlationId: string): Promise<CloseReadinessRun | undefined>; listCloseRuns(companyId:string,branchId?:string):Promise<readonly CloseReadinessRun[]>; saveEvidence(value: ControlEvidence): Promise<void>;
}
export const FINANCIAL_CONTROLS_REPOSITORY = Symbol('FINANCIAL_CONTROLS_REPOSITORY');
