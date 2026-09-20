import type { ExecutionContext } from '@elhafez/contracts';
import type { Agent, AgentId } from '@elhafez/agent-management';
import type { DuplicateCandidate, Party, PartyDraft, PartyId, PartyRole } from '@elhafez/party-registry';

export type CustomerPartyResolveResult =
 | { readonly status:'CREATED'|'MATCHED'; readonly party:Party }
 | { readonly status:'REVIEW_REQUIRED'; readonly candidates:readonly DuplicateCandidate[] };

export interface CustomerPartyRegistryPort {
  resolveOrCreateForIntegration(context:ExecutionContext,input:PartyDraft):Promise<CustomerPartyResolveResult>;
  ensureRoleForIntegration(context:ExecutionContext,id:PartyId,role:PartyRole):Promise<void>;
  removeRoleForIntegration(context:ExecutionContext,id:PartyId,role:PartyRole):Promise<void>;
  getForIntegration(context:ExecutionContext,id:PartyId):Promise<Party>;
  searchForIntegration(context:ExecutionContext,query:string):Promise<Party[]>;
  updateForIntegration(context:ExecutionContext,id:PartyId,input:PartyDraft):Promise<Party>;
}
export interface CustomerAgentPort {
  requireActiveForIntegration(context:ExecutionContext,id:AgentId):Promise<Agent>;
  registerReferenceForIntegration(context:ExecutionContext,id:AgentId,sourceType:string,sourceId:string):Promise<void>;
  releaseReferenceForIntegration(context:ExecutionContext,id:AgentId,sourceType:string,sourceId:string):Promise<void>;
}
