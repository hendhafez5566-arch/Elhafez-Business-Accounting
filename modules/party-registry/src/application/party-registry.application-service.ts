import { randomUUID } from 'node:crypto';
import { ContractValidationError, type CompanyId, type ExecutionContext } from '@elhafez/contracts';
import type { PartyAccess } from './party-access.js';
import type { PartyRegistryRepository } from './party-registry.repository.js';
import {
  normalizedDraft,
  partyId,
  type DuplicateCandidate,
  type DuplicateEvidence,
  type DuplicateResolution,
  type Party,
  type PartyDraft,
  type PartyId,
  type PartyRole,
} from '../domain/party.js';

export const PARTY_REGISTRY_PERMISSIONS=Object.freeze({
  read:'crm.party.read',
  manage:'crm.party.manage',
});

export type ResolvePartyResult =
  | { readonly status:'CREATED'; readonly party:Party }
  | { readonly status:'MATCHED'; readonly party:Party }
  | { readonly status:'REVIEW_REQUIRED'; readonly candidates:readonly DuplicateCandidate[] };

export class PartyRegistryApplicationService {
  constructor(
    private readonly repository: PartyRegistryRepository,
    private readonly access: PartyAccess,
    private readonly now:()=>Date=()=>new Date(),
    private readonly newId:()=>string=()=>randomUUID(),
  ) {}

  private async branch(context:ExecutionContext):Promise<void>{ await this.access.requireBranch(context); }
  private async permission(context:ExecutionContext, permission:string):Promise<void>{ await this.branch(context); await this.access.requirePermission(context,permission); }

  async create(context:ExecutionContext,input:PartyDraft):Promise<ResolvePartyResult>{
    await this.permission(context,PARTY_REGISTRY_PERMISSIONS.manage);
    return this.resolveOrCreateForIntegration(context,input);
  }

  async resolveDuplicateForIntegration(context:ExecutionContext,input:PartyDraft):Promise<DuplicateResolution>{
    await this.branch(context);
    const normalized=normalizedDraft(input);
    const parties=await this.repository.findCandidates(context.companyId,{
      nationalIdentityNormalized:normalized.nationalIdentityNormalized,
      taxIdentityNormalized:normalized.taxIdentityNormalized,
      phoneNormalized:normalized.phoneNormalized,
      emailNormalized:normalized.emailNormalized,
    });
    const candidates=parties.map((party):DuplicateCandidate=>{
      const evidence:DuplicateEvidence[]=[];
      if (normalized.nationalIdentityNormalized && party.nationalIdentityNormalized===normalized.nationalIdentityNormalized) evidence.push('NATIONAL_ID');
      if (normalized.taxIdentityNormalized && party.taxIdentityNormalized===normalized.taxIdentityNormalized) evidence.push('TAX_ID');
      if (normalized.phoneNormalized && party.phoneNormalized===normalized.phoneNormalized) evidence.push('PHONE');
      if (normalized.emailNormalized && party.emailNormalized===normalized.emailNormalized) evidence.push('EMAIL');
      return {party,evidence:Object.freeze(evidence)};
    }).filter((candidate)=>candidate.evidence.length>0);

    const strong=candidates.filter((candidate)=>candidate.evidence.includes('NATIONAL_ID')||candidate.evidence.includes('TAX_ID'));
    if (strong.length===1) return {status:'CONFIDENT_MATCH',candidate:strong[0]!};
    if (strong.length>1) return {status:'REVIEW_REQUIRED',candidates:Object.freeze(strong)};

    const contactStrong=candidates.filter((candidate)=>candidate.evidence.includes('PHONE')&&candidate.evidence.includes('EMAIL'));
    if (contactStrong.length===1) return {status:'CONFIDENT_MATCH',candidate:contactStrong[0]!};
    if (candidates.length>0) return {status:'REVIEW_REQUIRED',candidates:Object.freeze(candidates)};
    return {status:'NO_MATCH'};
  }

  async resolveOrCreateForIntegration(context:ExecutionContext,input:PartyDraft):Promise<ResolvePartyResult>{
    await this.branch(context);
    const resolution=await this.resolveDuplicateForIntegration(context,input);
    if (resolution.status==='CONFIDENT_MATCH') return {status:'MATCHED',party:resolution.candidate.party};
    if (resolution.status==='REVIEW_REQUIRED') return resolution;
    const normalized=normalizedDraft(input);
    const at=this.now().toISOString();
    const value:Party={id:partyId(this.newId()),companyId:context.companyId,...normalized,status:'ACTIVE',createdAt:at,updatedAt:at};
    try {
      await this.repository.create(value);
      await this.access.audit(context,'party.created','party',value.id,{kind:value.kind});
      return {status:'CREATED',party:value};
    } catch (error) {
      const concurrent=await this.resolveDuplicateForIntegration(context,input);
      if (concurrent.status==='CONFIDENT_MATCH') return {status:'MATCHED',party:concurrent.candidate.party};
      if (concurrent.status==='REVIEW_REQUIRED') return concurrent;
      throw error;
    }
  }

  async get(context:ExecutionContext,id:PartyId):Promise<Party>{
    await this.permission(context,PARTY_REGISTRY_PERMISSIONS.read);
    return this.requireOwned(context.companyId,id);
  }

  async getForIntegration(context:ExecutionContext,id:PartyId):Promise<Party>{
    await this.branch(context); return this.requireOwned(context.companyId,id);
  }

  async list(context:ExecutionContext,query?:string):Promise<Party[]>{
    await this.permission(context,PARTY_REGISTRY_PERMISSIONS.read);
    return this.repository.list(context.companyId,query?.trim());
  }

  async searchForIntegration(context:ExecutionContext,query:string):Promise<Party[]>{
    await this.branch(context);
    const normalized=query.trim();
    return normalized ? this.repository.list(context.companyId,normalized) : [];
  }

  async update(context:ExecutionContext,id:PartyId,input:PartyDraft):Promise<Party>{
    await this.permission(context,PARTY_REGISTRY_PERMISSIONS.manage);
    return this.updateForIntegration(context,id,input);
  }

  async updateForIntegration(context:ExecutionContext,id:PartyId,input:PartyDraft):Promise<Party>{
    await this.branch(context);
    const current=await this.requireOwned(context.companyId,id);
    const normalized=normalizedDraft(input);
    const matches=await this.repository.findCandidates(context.companyId,{
      nationalIdentityNormalized:normalized.nationalIdentityNormalized,
      taxIdentityNormalized:normalized.taxIdentityNormalized,
      phoneNormalized:null,emailNormalized:null,
    });
    const conflict=matches.find((candidate)=>candidate.id!==id && (
      (normalized.nationalIdentityNormalized && candidate.nationalIdentityNormalized===normalized.nationalIdentityNormalized) ||
      (normalized.taxIdentityNormalized && candidate.taxIdentityNormalized===normalized.taxIdentityNormalized)
    ));
    if (conflict) throw new ContractValidationError('identity','strong identity already belongs to another party');
    const updated:Party={...current,...normalized,updatedAt:this.now().toISOString()};
    await this.repository.update(updated);
    await this.access.audit(context,'party.updated','party',id,{});
    return updated;
  }

  async ensureRoleForIntegration(context:ExecutionContext,id:PartyId,role:PartyRole):Promise<void>{
    await this.branch(context);
    await this.requireOwned(context.companyId,id);
    await this.repository.ensureRole({companyId:context.companyId,partyId:id,role,createdAt:this.now().toISOString()});
  }

  async removeRoleForIntegration(context:ExecutionContext,id:PartyId,role:PartyRole):Promise<void>{
    await this.branch(context); await this.repository.removeRole(context.companyId,id,role);
  }

  async roles(context:ExecutionContext,id:PartyId):Promise<readonly PartyRole[]>{
    await this.permission(context,PARTY_REGISTRY_PERMISSIONS.read);
    await this.requireOwned(context.companyId,id);
    return (await this.repository.roles(context.companyId,id)).map((value)=>value.role);
  }

  private async requireOwned(companyId:CompanyId,id:PartyId):Promise<Party>{
    const party=await this.repository.find(companyId,id);
    if (!party) throw new ContractValidationError('partyId','party was not found in this company');
    return party;
  }
}
