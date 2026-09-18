import { createHash } from 'node:crypto';
import { ContractValidationError, decimalAmount } from '@elhafez/contracts';
import { compareDecimal, requireText, subtractDecimal, type ApprovalOutcome, type ApprovalPolicy, type ApprovalRequest, type FinancialAction, type MutationKind, type ReconciliationType } from '../domain/financial-controls.js';
import type { CloseReadinessRun, ControlEvidence, FinancialControlsRepository, ReconciliationIssue, ReconciliationRun } from './financial-controls.repository.js';

export interface TrustedAuthorizationPort {
  canApprove(actorId: string, companyId: string, authority: string): Promise<boolean>;
  canAccessBranch(actorId: string, companyId: string, branchId: string): Promise<boolean>;
  canResolveControlIssue(actorId: string, companyId: string): Promise<boolean>;
}
export const TRUSTED_AUTHORIZATION_PORT = Symbol('TRUSTED_AUTHORIZATION_PORT');
export class DenyByDefaultAuthorization implements TrustedAuthorizationPort {
  async canApprove(): Promise<boolean> { return false; }
  async canAccessBranch(): Promise<boolean> { return false; }
  async canResolveControlIssue(): Promise<boolean> { return false; }
}
export interface ApprovalRequirementEvaluation {
  readonly decision: ApprovalOutcome;
  readonly policyId?: string;
  readonly threshold?: string;
  readonly forbidSelfApproval?: boolean;
  readonly requiredAuthority?: string;
}

export interface ReconciliationComparison { readonly key: string; readonly sourceAmount: string; readonly ledgerAmount: string; readonly detail?: string }
export interface ReadinessCheck { readonly key: string; readonly passed: boolean; readonly severity: 'BLOCKER' | 'WARNING'; readonly detail: string }
function fingerprint(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function now(): string { return new Date().toISOString(); }

export class FinancialControlsApplicationService {
  constructor(private readonly repository: FinancialControlsRepository, private readonly authorization: TrustedAuthorizationPort) {}

  async configureApprovalPolicy(input: Omit<ApprovalPolicy, 'threshold'> & { threshold: string }): Promise<ApprovalPolicy> {
    requireText(input.id, 'id'); requireText(input.companyId, 'companyId'); requireText(input.requiredAuthority, 'requiredAuthority');
    const threshold = decimalAmount(input.threshold); if (compareDecimal(threshold, '0') < 0) throw new ContractValidationError('threshold', 'must not be negative');
    const policy = Object.freeze({ ...input, threshold }); await this.repository.savePolicy(policy); return policy;
  }
  async evaluateApprovalRequirement(input: { companyId: string; action: FinancialAction; amount: string }): Promise<ApprovalRequirementEvaluation> {
    const amount = decimalAmount(input.amount); if (compareDecimal(amount, '0') < 0) throw new ContractValidationError('amount', 'must not be negative');
    const policy = await this.repository.findPolicy(input.companyId, input.action);
    if (!policy?.active) return { decision: 'APPROVAL_NOT_REQUIRED' };
    return compareDecimal(amount, policy.threshold) >= 0
      ? { decision: 'APPROVAL_REQUIRED', policyId: policy.id, threshold: policy.threshold, forbidSelfApproval: policy.forbidSelfApproval, requiredAuthority: policy.requiredAuthority }
      : { decision: 'APPROVAL_NOT_REQUIRED', policyId: policy.id };
  }
  async requestApproval(input: Omit<ApprovalRequest, 'amount' | 'status' | 'policyId' | 'policyThresholdSnapshot' | 'policyForbidSelfApprovalSnapshot' | 'policyRequiredAuthoritySnapshot' | 'requestedAt'> & { amount: string; requestedAt?: string }): Promise<ApprovalRequest> {
    const evaluation = await this.evaluateApprovalRequirement(input);
    if (evaluation.decision !== 'APPROVAL_REQUIRED' || !evaluation.policyId || evaluation.threshold === undefined || evaluation.forbidSelfApproval === undefined || !evaluation.requiredAuthority) throw new ContractValidationError('approval', 'approval is not required');
    const existing = await this.repository.findRequest(input.companyId, input.id);
    const candidate = { ...input, amount: decimalAmount(input.amount), status: 'PENDING' as const, policyId: evaluation.policyId, policyThresholdSnapshot: decimalAmount(evaluation.threshold), policyForbidSelfApprovalSnapshot: evaluation.forbidSelfApproval, policyRequiredAuthoritySnapshot: evaluation.requiredAuthority, requestedAt: input.requestedAt ?? now() };
    if (existing) { const comparable = { ...candidate, requestedAt: existing.requestedAt }; if (JSON.stringify(existing) !== JSON.stringify(comparable)) throw new ContractValidationError('request', 'conflicting approval request replay'); return existing; }
    await this.repository.saveRequest(candidate); await this.audit(input.companyId, 'APPROVAL_REQUESTED', input.id, candidate); return candidate;
  }
  async decideApproval(input: { companyId: string; requestId: string; decisionId: string; actorId: string; outcome: 'APPROVED' | 'REJECTED'; reason?: string; decidedAt?: string }) {
    const request = await this.repository.findRequest(input.companyId, input.requestId); if (!request) throw new ContractValidationError('requestId', 'approval request not found');
    const existing = await this.repository.findDecision(input.companyId, input.requestId);
    if (existing) { if (existing.outcome === input.outcome && existing.actorId === input.actorId && existing.reason === input.reason) return existing; throw new ContractValidationError('decision', 'approval request already has a conflicting final decision'); }
    if (request.policyForbidSelfApprovalSnapshot && request.requesterActorId === input.actorId) { await this.audit(input.companyId, 'SELF_APPROVAL_REJECTED', input.requestId, input); throw new ContractValidationError('actorId', 'self approval is forbidden'); }
    if (!(await this.authorization.canApprove(input.actorId, input.companyId, request.policyRequiredAuthoritySnapshot))) { await this.audit(input.companyId, 'APPROVAL_DENIED', input.requestId, input); throw new ContractValidationError('actorId', 'approval authority is required'); }
    const decision = { id: input.decisionId, requestId: input.requestId, companyId: input.companyId, outcome: input.outcome, actorId: input.actorId, ...(input.reason === undefined ? {} : { reason: input.reason }), decidedAt: input.decidedAt ?? now() };
    await this.repository.saveDecision(decision); await this.audit(input.companyId, 'APPROVAL_DECIDED', input.requestId, decision); return decision;
  }
  async getApprovalDecision(companyId: string, requestId: string) { return this.repository.findDecision(companyId, requestId); }

  async evaluateFinancialMutation(input: { executionCompanyId: string; executionBranchId: string; actorId: string; sourceReference: string; targetCompanyId: string; targetBranchId: string; lifecycle: 'DRAFT' | 'PERMANENT' | 'POSTED'; collection: boolean; mutation: MutationKind }) {
    requireText(input.sourceReference, 'sourceReference'); let reason: string | undefined;
    if (input.executionCompanyId !== input.targetCompanyId) reason = 'COMPANY_SCOPE_MISMATCH';
    else if (!(await this.authorization.canAccessBranch(input.actorId, input.targetCompanyId, input.targetBranchId))) reason = 'BRANCH_SCOPE_DENIED';
    else if ((input.lifecycle === 'PERMANENT' || input.lifecycle === 'POSTED') && (input.mutation === 'UPDATE' || input.mutation === 'DELETE')) reason = input.collection && input.mutation === 'DELETE' ? 'PERMANENT_COLLECTION_DELETE_DENIED' : 'PERMANENT_FINANCIAL_RECORD_IMMUTABLE';
    const result = Object.freeze({ decision: reason ? 'DENIED' as const : 'ALLOWED' as const, ...(reason ? { reason } : {}), sourceReference: input.sourceReference });
    if (reason) await this.audit(input.targetCompanyId, 'MUTATION_DENIED', input.sourceReference, { ...input, result }); return result;
  }

  async reconcile(input: { id: string; companyId: string; branchId?: string; type: ReconciliationType; correlationId: string; runAt?: string; comparisons: readonly ReconciliationComparison[] }) {
    const normalized = input.comparisons.map((item) => ({ ...item, sourceAmount: decimalAmount(item.sourceAmount), ledgerAmount: decimalAmount(item.ledgerAmount) })); const suppliedFingerprint = fingerprint({ branchId: input.branchId ?? null, type: input.type, comparisons: normalized });
    const existing = await this.repository.findRun(input.companyId, input.correlationId); if (existing) { if (existing.run.fingerprint !== suppliedFingerprint || existing.run.type !== input.type) throw new ContractValidationError('correlationId', 'conflicting reconciliation replay'); return existing; }
    const issues: ReconciliationIssue[] = normalized.flatMap((item) => { const difference = subtractDecimal(item.sourceAmount, item.ledgerAmount); return difference === '0' ? [] : [{ id: fingerprint([input.companyId, input.correlationId, item.key]).slice(0, 32), companyId: input.companyId, runId: input.id, evidenceKey: item.key, sourceAmount: item.sourceAmount, ledgerAmount: item.ledgerAmount, difference, detail: item.detail ?? 'exact monetary mismatch' }]; });
    const run: ReconciliationRun = { id: input.id, companyId: input.companyId, ...(input.branchId === undefined ? {} : { branchId: input.branchId }), type: input.type, correlationId: input.correlationId, fingerprint: suppliedFingerprint, clean: issues.length === 0, runAt: input.runAt ?? now() };
    await this.repository.saveRun(run, issues); for (const issue of issues) await this.audit(input.companyId, 'RECONCILIATION_ISSUE_DETECTED', issue.id, issue); return { run, issues };
  }
  async evaluateIntegrity(input: Omit<Parameters<FinancialControlsApplicationService['reconcile']>[0], 'type'>) { return this.reconcile({ ...input, type: 'INTEGRITY' }); }
  async evaluateCloseReadiness(input: { id: string; companyId: string; branchId?: string; correlationId: string; evaluatedAt?: string; checks: readonly ReadinessCheck[] }): Promise<CloseReadinessRun> {
    const blockers = input.checks.filter((x) => !x.passed && x.severity === 'BLOCKER').map((x) => `${x.key}: ${x.detail}`); const warnings = input.checks.filter((x) => !x.passed && x.severity === 'WARNING').map((x) => `${x.key}: ${x.detail}`);
    const closeFingerprint = fingerprint({ branchId: input.branchId ?? null, checks: input.checks });
    const candidate = { id: input.id, companyId: input.companyId, ...(input.branchId === undefined ? {} : { branchId: input.branchId }), correlationId: input.correlationId, fingerprint: closeFingerprint, ready: blockers.length === 0, blockers, warnings, evaluatedAt: input.evaluatedAt ?? now() };
    const existing = await this.repository.findCloseRun(input.companyId, input.correlationId);
    if (existing) { if (existing.fingerprint !== candidate.fingerprint || existing.branchId !== candidate.branchId) throw new ContractValidationError('correlationId', 'conflicting close readiness replay'); return existing; }
    const persisted = await this.repository.saveCloseRun(candidate);
    if (persisted.fingerprint !== candidate.fingerprint || persisted.branchId !== candidate.branchId) throw new ContractValidationError('correlationId', 'conflicting close readiness replay');
    await this.audit(input.companyId, 'CLOSE_READINESS_EVALUATED', persisted.id, persisted); return persisted;
  }
  evaluateAutoFix(): { decision: 'DENIED'; reason: string } { return { decision: 'DENIED', reason: 'economic source truth cannot be auto-fixed' }; }
  async resolveControlIssue(input: { companyId: string; issueId: string; actorId: string; resolutionMode: 'SUPERVISED' | 'OWNER_CONFIRMED'; ownerReference?: string; resolvedAt?: string }) {
    const issue = await this.repository.findIssue(input.companyId, input.issueId); if (!issue) throw new ContractValidationError('issueId', 'control issue not found');
    if (!input.ownerReference?.trim()) throw new ContractValidationError('ownerReference', 'immutable owner or supervised resolution evidence is required');
    if (input.resolutionMode === 'SUPERVISED' && !(await this.authorization.canResolveControlIssue(input.actorId, input.companyId))) { await this.audit(input.companyId, 'ISSUE_RESOLUTION_DENIED', input.issueId, input); throw new ContractValidationError('actorId', 'control issue resolution authority is required'); }
    const resolved = await this.repository.resolveIssue(input.companyId, input.issueId, input.resolvedAt ?? now(), input.ownerReference); await this.audit(input.companyId, 'ISSUE_RESOLVED', input.issueId, input); return resolved;
  }
  private async audit(companyId: string, kind: string, subjectId: string, detail: unknown): Promise<void> { const evidence: ControlEvidence = { id: fingerprint([companyId, kind, subjectId, detail]).slice(0, 32), companyId, kind, subjectId, detail: JSON.stringify(detail), occurredAt: now() }; await this.repository.saveEvidence(evidence); }
}
