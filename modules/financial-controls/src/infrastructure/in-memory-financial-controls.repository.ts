import { ContractValidationError } from '@elhafez/contracts';
import type { ApprovalDecision, ApprovalPolicy, ApprovalRequest } from '../domain/financial-controls.js';
import type { CloseReadinessRun, ControlEvidence, FinancialControlsRepository, ReconciliationIssue, ReconciliationRun } from '../application/financial-controls.repository.js';

export class InMemoryFinancialControlsRepository implements FinancialControlsRepository {
  readonly policies = new Map<string, ApprovalPolicy>(); readonly requests = new Map<string, ApprovalRequest>(); readonly decisions = new Map<string, ApprovalDecision>(); readonly runs = new Map<string, { run: ReconciliationRun; issues: ReconciliationIssue[] }>(); readonly issues = new Map<string, ReconciliationIssue>(); readonly closeRuns: CloseReadinessRun[] = []; readonly evidence: ControlEvidence[] = [];
  private key(companyId: string, id: string) { return `${companyId}:${id}`; }
  async savePolicy(v: ApprovalPolicy) { this.policies.set(this.key(v.companyId, v.action), v); }
  async findPolicy(c: string, a: string) { return this.policies.get(this.key(c, a)); }
  async listPolicies(c:string){return[...this.policies.values()].filter(v=>v.companyId===c);}
  async saveRequest(v: ApprovalRequest) { this.requests.set(this.key(v.companyId, v.id), v); }
  async findRequest(c: string, id: string) { return this.requests.get(this.key(c, id)); }
  async listRequests(c:string,branchId?:string){return[...this.requests.values()].filter(v=>v.companyId===c&&(branchId===undefined||v.branchId===branchId));}
  async saveDecision(v: ApprovalDecision) { this.decisions.set(this.key(v.companyId, v.requestId), v); const request = this.requests.get(this.key(v.companyId, v.requestId)); if (request) this.requests.set(this.key(v.companyId, v.requestId), { ...request, status: v.outcome }); }
  async findDecision(c: string, id: string) { return this.decisions.get(this.key(c, id)); }
  async saveRun(run: ReconciliationRun, issues: readonly ReconciliationIssue[]) { this.runs.set(this.key(run.companyId, run.correlationId), { run, issues: [...issues] }); for (const issue of issues) this.issues.set(this.key(run.companyId, issue.id), issue); }
  async findRun(c: string, id: string) { return this.runs.get(this.key(c, id)); }
  async findIssue(c: string, id: string) { return this.issues.get(this.key(c, id)); }
  async listIssues(c:string,branchId?:string){return[...this.issues.values()].filter(v=>{if(v.companyId!==c)return false;if(branchId===undefined)return true;for(const entry of this.runs.values())if(entry.run.companyId===c&&entry.run.id===v.runId)return entry.run.branchId===branchId;return false;});}
  async resolveIssue(c: string, id: string, at: string, reference: string) { const issue = this.issues.get(this.key(c, id)); if (!issue) throw new ContractValidationError('issueId', 'not found'); const resolved = { ...issue, resolvedAt: at, resolutionReference: reference }; this.issues.set(this.key(c, id), resolved); return resolved; }
  async saveCloseRun(v: CloseReadinessRun) { const existing = await this.findCloseRun(v.companyId, v.correlationId); if (existing) return existing; this.closeRuns.push(v); return v; }
  async findCloseRun(c: string, correlationId: string) { return this.closeRuns.find((x) => x.companyId === c && x.correlationId === correlationId); }
  async saveEvidence(v: ControlEvidence) { if (!this.evidence.some((x) => x.id === v.id)) this.evidence.push(v); }
}
