import { actorId, branchId, companyId, type ActorId, type BranchId, type CompanyId } from './identifiers.js';
import { exactKeys, requireRecord } from './validation.js';

export interface ExecutionContext {
  readonly companyId: CompanyId;
  readonly branchId: BranchId;
  readonly actorId: ActorId;
}

export function executionContext(company: unknown, branch: unknown, actor: unknown): ExecutionContext {
  return Object.freeze({ companyId: companyId(company), branchId: branchId(branch), actorId: actorId(actor) });
}

export function parseExecutionContext(value: unknown): ExecutionContext {
  const input = requireRecord(value, 'context');
  exactKeys(input, ['companyId', 'branchId', 'actorId'], 'context');
  return executionContext(input.companyId, input.branchId, input.actorId);
}
