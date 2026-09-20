import type { ExecutionContext } from '@elhafez/contracts';
import type { DuplicateCandidate, Party, PartyDraft, PartyId, PartyRole } from '@elhafez/party-registry';

export type PartyResolveResult =
  | { readonly status: 'CREATED' | 'MATCHED'; readonly party: Party }
  | { readonly status: 'REVIEW_REQUIRED'; readonly candidates: readonly DuplicateCandidate[] };

export interface AgentPartyRegistryPort {
  resolveOrCreateForIntegration(context: ExecutionContext, input: PartyDraft): Promise<PartyResolveResult>;
  ensureRoleForIntegration(context: ExecutionContext, id: PartyId, role: PartyRole): Promise<void>;
  removeRoleForIntegration(context: ExecutionContext, id: PartyId, role: PartyRole): Promise<void>;
  getForIntegration(context: ExecutionContext, id: PartyId): Promise<Party>;
  updateForIntegration(context: ExecutionContext, id: PartyId, input: PartyDraft): Promise<Party>;
}
