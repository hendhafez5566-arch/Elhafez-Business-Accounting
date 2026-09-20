import { ContractValidationError, type CompanyId } from '@elhafez/contracts';

declare const partyIdBrand: unique symbol;
export type PartyId = string & { readonly [partyIdBrand]: 'PartyId' };
export type PartyKind = 'PERSON' | 'ORGANIZATION';
export type PartyStatus = 'ACTIVE' | 'INACTIVE';
export type PartyRole = 'CUSTOMER' | 'AGENT' | 'SUPPLIER' | 'TRAVELER' | 'OTHER';

export interface PartyDraft {
  readonly kind: PartyKind;
  readonly displayName: string;
  readonly legalName?: string;
  readonly phone?: string;
  readonly whatsappNumber?: string;
  readonly email?: string;
  readonly address?: string;
  readonly nationalIdentity?: string;
  readonly taxIdentity?: string;
}

export interface Party {
  readonly id: PartyId;
  readonly companyId: CompanyId;
  readonly kind: PartyKind;
  readonly displayName: string;
  readonly legalName: string | null;
  readonly phone: string | null;
  readonly phoneNormalized: string | null;
  readonly whatsappNumber: string | null;
  readonly whatsappNormalized: string | null;
  readonly email: string | null;
  readonly emailNormalized: string | null;
  readonly address: string | null;
  readonly nationalIdentity: string | null;
  readonly nationalIdentityNormalized: string | null;
  readonly taxIdentity: string | null;
  readonly taxIdentityNormalized: string | null;
  readonly status: PartyStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PartyRoleLink {
  readonly companyId: CompanyId;
  readonly partyId: PartyId;
  readonly role: PartyRole;
  readonly createdAt: string;
}

export type DuplicateEvidence = 'NATIONAL_ID' | 'TAX_ID' | 'PHONE' | 'EMAIL';

export interface DuplicateCandidate {
  readonly party: Party;
  readonly evidence: readonly DuplicateEvidence[];
}

export type DuplicateResolution =
  | { readonly status: 'NO_MATCH' }
  | { readonly status: 'CONFIDENT_MATCH'; readonly candidate: DuplicateCandidate }
  | { readonly status: 'REVIEW_REQUIRED'; readonly candidates: readonly DuplicateCandidate[] };

export function partyId(value: string): PartyId {
  const trimmed=value.trim();
  if (!trimmed) throw new ContractValidationError('partyId','is required');
  return trimmed as PartyId;
}

export function normalizeName(value: string, field='displayName'): string {
  const normalized=value.trim().replace(/\s+/g,' ');
  if (!normalized) throw new ContractValidationError(field,'is required');
  return normalized;
}
export function normalizePhone(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized=value.replace(/[^0-9]/g,'');
  if (normalized.length < 7 || normalized.length > 18) throw new ContractValidationError('phone','is invalid');
  return normalized;
}
export function normalizeEmail(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized=value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new ContractValidationError('email','is invalid');
  return normalized;
}
export function normalizeStrongIdentity(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized=value.trim().toUpperCase().replace(/[\s-]+/g,'');
  if (normalized.length < 3) throw new ContractValidationError('identity','is invalid');
  return normalized;
}
export function normalizedDraft(input: PartyDraft): Omit<Party,'id'|'companyId'|'status'|'createdAt'|'updatedAt'> {
  const displayName=normalizeName(input.displayName);
  const legalName=input.legalName?.trim() || null;
  const phone=input.phone?.trim() || null;
  const whatsappNumber=input.whatsappNumber?.trim() || null;
  const email=input.email?.trim() || null;
  const address=input.address?.trim() || null;
  const nationalIdentity=input.nationalIdentity?.trim() || null;
  const taxIdentity=input.taxIdentity?.trim() || null;
  if (input.kind!=='PERSON' && input.kind!=='ORGANIZATION') throw new ContractValidationError('kind','is invalid');
  return {
    kind: input.kind,
    displayName,
    legalName,
    phone,
    phoneNormalized: normalizePhone(input.phone),
    whatsappNumber,
    whatsappNormalized: normalizePhone(input.whatsappNumber),
    email,
    emailNormalized: normalizeEmail(input.email),
    address,
    nationalIdentity,
    nationalIdentityNormalized: normalizeStrongIdentity(input.nationalIdentity),
    taxIdentity,
    taxIdentityNormalized: normalizeStrongIdentity(input.taxIdentity),
  };
}
