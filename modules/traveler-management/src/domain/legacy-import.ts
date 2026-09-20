import type { BranchId, CompanyId } from '@elhafez/contracts';
import type { TravelDocumentId, TravelerGender, TravelerId } from './traveler.js';

export interface LegacyPassportRecord {
  readonly legacySourceSystem: string;
  readonly legacySourceReference: string;
  readonly companyId: CompanyId;
  readonly branchId: BranchId;
  readonly fullName: string;
  readonly dateOfBirth?: string;
  readonly gender?: TravelerGender;
  readonly nationality?: string;
  readonly customerId?: string;
  readonly partyId?: string;
  readonly documentNumber: string;
  readonly issuingCountry?: string;
  readonly issuingPlace?: string;
  readonly issueDate?: string;
  readonly expiryDate?: string;
}

export type LegacyImportOutcome =
  | { readonly status: 'IMPORTED'; readonly travelerId: TravelerId; readonly travelDocumentId: TravelDocumentId }
  | { readonly status: 'ALREADY_IMPORTED'; readonly travelerId: TravelerId; readonly travelDocumentId: TravelDocumentId }
  | { readonly status: 'CONFLICT'; readonly reason: string }
  | { readonly status: 'UNRESOLVED_LINKAGE'; readonly reason: string };

export interface LegacyImportRecord {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly branchId: BranchId;
  readonly legacySourceSystem: string;
  readonly legacySourceReference: string;
  readonly travelerId: TravelerId;
  readonly travelDocumentId: TravelDocumentId;
  readonly inputFingerprint: string;
  readonly importedAt: string;
}
