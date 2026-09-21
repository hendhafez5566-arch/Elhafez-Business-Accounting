import type { BranchId, CompanyId } from '@elhafez/contracts';
import type { LegacyImportEffect, TravelerManagementRepository } from '../application/traveler-management.repository.js';
import type { LegacyImportRecord } from '../domain/legacy-import.js';
import type { TravelDocument, Traveler, TravelerId } from '../domain/traveler.js';

export class InMemoryTravelerManagementRepository implements TravelerManagementRepository {
  readonly travelers = new Map<string, Traveler>();
  readonly documents = new Map<string, TravelDocument>();
  readonly imports = new Map<string, LegacyImportRecord>();

  async createTraveler(value: Traveler): Promise<void> {
    if (this.travelers.has(value.id)) throw new Error('duplicate traveler');
    this.travelers.set(value.id, value);
  }
  async updateTraveler(value: Traveler): Promise<void> { this.travelers.set(value.id, value); }
  async findTraveler(companyId: CompanyId, id: TravelerId) {
    const value = this.travelers.get(id);
    return value?.companyId === companyId ? value : undefined;
  }
  async listTravelers(companyId: CompanyId, filter?: { customerId?: string; partyId?: string; query?: string; status?: Traveler['status'] }) {
    const query = filter?.query?.trim().toLowerCase();
    return [...this.travelers.values()].filter((value) =>
      value.companyId === companyId &&
      (!filter?.customerId || value.customerId === filter.customerId) &&
      (!filter?.partyId || value.partyId === filter.partyId) &&
      (!filter?.status || value.status === filter.status) &&
      (!query || value.fullName.toLowerCase().includes(query)),
    );
  }
  async findByCompanyDocumentNumber(companyId: CompanyId, documentNumber: string) {
    return [...this.documents.values()].find((value) => value.companyId === companyId && value.documentNumber === documentNumber);
  }
  async addDocument(value: TravelDocument): Promise<void> {
    if ([...this.documents.values()].some((item) => item.companyId === value.companyId && item.documentNumber === value.documentNumber)) throw new Error('duplicate document');
    this.documents.set(value.id, value);
  }
  async supersedeDocument(previous: TravelDocument, next: TravelDocument): Promise<void> {
    await this.addDocument(next);
    this.documents.set(previous.id, previous);
  }
  async listDocuments(companyId: CompanyId, travelerId: TravelerId) {
    return [...this.documents.values()]
      .filter((value) => value.companyId === companyId && value.travelerId === travelerId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
  async findLegacyImportRecord(companyId: CompanyId, sourceSystem: string, sourceReference: string) {
    return this.imports.get(`${companyId}:${sourceSystem}:${sourceReference}`);
  }
  async saveLegacyImportEffect(effect: LegacyImportEffect): Promise<void> {
    const key = `${effect.importRecord.companyId}:${effect.importRecord.legacySourceSystem}:${effect.importRecord.legacySourceReference}`;
    if (this.imports.has(key)) throw new Error('duplicate import');
    if (effect.travelerToCreate && this.travelers.has(effect.travelerToCreate.id)) throw new Error('duplicate traveler');
    if (effect.documentToCreate && [...this.documents.values()].some((item) => item.companyId === effect.documentToCreate!.companyId && item.documentNumber === effect.documentToCreate!.documentNumber)) throw new Error('duplicate document');
    if (effect.travelerToCreate) this.travelers.set(effect.travelerToCreate.id, effect.travelerToCreate);
    if (effect.previousDocument) this.documents.set(effect.previousDocument.id, effect.previousDocument);
    if (effect.documentToCreate) this.documents.set(effect.documentToCreate.id, effect.documentToCreate);
    this.imports.set(key, effect.importRecord);
  }
  async legacyImports(companyId: CompanyId, branchId?: BranchId) {
    return [...this.imports.values()].filter((value) => value.companyId === companyId && (!branchId || value.branchId === branchId));
  }
}
