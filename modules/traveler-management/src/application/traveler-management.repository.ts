import type { BranchId, CompanyId } from '@elhafez/contracts';
import type { LegacyImportRecord } from '../domain/legacy-import.js';
import type { TravelDocument, Traveler, TravelerId } from '../domain/traveler.js';

export interface LegacyImportEffect {
  readonly travelerToCreate?: Traveler;
  readonly previousDocument?: TravelDocument;
  readonly documentToCreate?: TravelDocument;
  readonly importRecord: LegacyImportRecord;
}

export interface TravelerManagementRepository {
  createTraveler(value: Traveler): Promise<void>;
  updateTraveler(value: Traveler): Promise<void>;
  findTraveler(companyId: CompanyId, id: TravelerId): Promise<Traveler | undefined>;
  listTravelers(companyId: CompanyId, filter?: { customerId?: string; partyId?: string; query?: string; status?: Traveler['status'] }): Promise<Traveler[]>;
  findByCompanyDocumentNumber(companyId: CompanyId, documentNumber: string): Promise<TravelDocument | undefined>;
  addDocument(value: TravelDocument): Promise<void>;
  supersedeDocument(previous: TravelDocument, next: TravelDocument): Promise<void>;
  listDocuments(companyId: CompanyId, travelerId: TravelerId): Promise<TravelDocument[]>;
  findLegacyImportRecord(companyId: CompanyId, sourceSystem: string, sourceReference: string): Promise<LegacyImportRecord | undefined>;
  saveLegacyImportEffect(effect: LegacyImportEffect): Promise<void>;
  legacyImports(companyId: CompanyId, branchId?: BranchId): Promise<LegacyImportRecord[]>;
}
export const TRAVELER_MANAGEMENT_REPOSITORY = Symbol('TRAVELER_MANAGEMENT_REPOSITORY');
