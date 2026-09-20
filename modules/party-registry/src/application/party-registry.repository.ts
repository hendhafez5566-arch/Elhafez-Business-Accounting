import type { CompanyId } from '@elhafez/contracts';
import type { Party, PartyId, PartyRole, PartyRoleLink } from '../domain/party.js';

export interface PartyRegistryRepository {
  create(value: Party): Promise<void>;
  update(value: Party): Promise<void>;
  find(companyId: CompanyId, id: PartyId): Promise<Party | undefined>;
  list(companyId: CompanyId, query?: string): Promise<Party[]>;
  findCandidates(companyId: CompanyId, evidence: {
    nationalIdentityNormalized: string | null;
    taxIdentityNormalized: string | null;
    phoneNormalized: string | null;
    emailNormalized: string | null;
  }): Promise<Party[]>;
  ensureRole(value: PartyRoleLink): Promise<void>;
  removeRole(companyId: CompanyId, partyId: PartyId, role: PartyRole): Promise<void>;
  roles(companyId: CompanyId, partyId: PartyId): Promise<PartyRoleLink[]>;
}
export const PARTY_REGISTRY_REPOSITORY=Symbol('PARTY_REGISTRY_REPOSITORY');
