import type { PrismaClient } from '@prisma/client';
import type { BranchId, CompanyId } from '@elhafez/contracts';
import type { LegacyImportEffect, TravelerManagementRepository } from '../application/traveler-management.repository.js';
import type { LegacyImportRecord } from '../domain/legacy-import.js';
import { travelDocumentId, travelerId, type TravelDocument, type Traveler, type TravelerId } from '../domain/traveler.js';

const toDate = (value: string | null) => value ? new Date(`${value}T00:00:00Z`) : null;
const toIso = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

type TravelerRow = { id:string; companyId:string; fullName:string; dateOfBirth:Date|null; gender:string|null; nationality:string|null; partyId:string|null; customerId:string|null; status:string; createdAt:Date; updatedAt:Date };
type DocumentRow = { id:string; companyId:string; travelerId:string; documentType:string; documentNumber:string; issuingCountry:string|null; issuingPlace:string|null; holderNameSnapshot:string; issueDate:Date|null; expiryDate:Date|null; isCurrent:boolean; supersededByDocumentId:string|null; createdAt:Date };
type ImportRow = { id:string; companyId:string; branchId:string; legacySourceSystem:string; legacySourceReference:string; travelerId:string; travelDocumentId:string; inputFingerprint:string; importedAt:Date };

function mapTraveler(row: TravelerRow): Traveler {
  return { id: travelerId(row.id), companyId: row.companyId as CompanyId, fullName: row.fullName, dateOfBirth: toIso(row.dateOfBirth), gender: row.gender as Traveler['gender'], nationality: row.nationality, partyId: row.partyId, customerId: row.customerId, status: row.status as Traveler['status'], createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function mapDocument(row: DocumentRow): TravelDocument {
  return { id: travelDocumentId(row.id), companyId: row.companyId as CompanyId, travelerId: travelerId(row.travelerId), documentType: 'PASSPORT', documentNumber: row.documentNumber, issuingCountry: row.issuingCountry, issuingPlace: row.issuingPlace, holderNameSnapshot: row.holderNameSnapshot, issueDate: toIso(row.issueDate), expiryDate: toIso(row.expiryDate), isCurrent: row.isCurrent, supersededByDocumentId: row.supersededByDocumentId ? travelDocumentId(row.supersededByDocumentId) : null, createdAt: row.createdAt.toISOString() };
}
function mapImport(row: ImportRow): LegacyImportRecord {
  return { id: row.id, companyId: row.companyId as CompanyId, branchId: row.branchId as BranchId, legacySourceSystem: row.legacySourceSystem, legacySourceReference: row.legacySourceReference, travelerId: travelerId(row.travelerId), travelDocumentId: travelDocumentId(row.travelDocumentId), inputFingerprint: row.inputFingerprint, importedAt: row.importedAt.toISOString() };
}
function travelerData(value: Traveler) {
  return { id:value.id, companyId:value.companyId, fullName:value.fullName, dateOfBirth:toDate(value.dateOfBirth), gender:value.gender, nationality:value.nationality, partyId:value.partyId, customerId:value.customerId, status:value.status, createdAt:new Date(value.createdAt), updatedAt:new Date(value.updatedAt) };
}
function documentData(value: TravelDocument) {
  return { id:value.id, companyId:value.companyId, travelerId:value.travelerId, documentType:value.documentType, documentNumber:value.documentNumber, issuingCountry:value.issuingCountry, issuingPlace:value.issuingPlace, holderNameSnapshot:value.holderNameSnapshot, issueDate:toDate(value.issueDate), expiryDate:toDate(value.expiryDate), isCurrent:value.isCurrent, supersededByDocumentId:value.supersededByDocumentId, createdAt:new Date(value.createdAt) };
}

export class PrismaTravelerManagementRepository implements TravelerManagementRepository {
  constructor(private readonly db: PrismaClient) {}
  async createTraveler(value: Traveler) { await this.db.tvmTraveler.create({ data: travelerData(value) }); }
  async updateTraveler(value: Traveler) { await this.db.tvmTraveler.update({ where:{ companyId_id:{ companyId:value.companyId, id:value.id } }, data:{ fullName:value.fullName, dateOfBirth:toDate(value.dateOfBirth), gender:value.gender, nationality:value.nationality, partyId:value.partyId, customerId:value.customerId, status:value.status, updatedAt:new Date(value.updatedAt) } }); }
  async findTraveler(companyId: CompanyId, id: TravelerId) { const row=await this.db.tvmTraveler.findUnique({ where:{ companyId_id:{ companyId, id } } }); return row ? mapTraveler(row) : undefined; }
  async listTravelers(companyId: CompanyId, filter?: { customerId?: string; partyId?: string; query?: string; status?: Traveler['status'] }) {
    const rows=await this.db.tvmTraveler.findMany({ where:{ companyId, ...(filter?.customerId?{customerId:filter.customerId}:{}), ...(filter?.partyId?{partyId:filter.partyId}:{}), ...(filter?.status?{status:filter.status}:{}), ...(filter?.query?{fullName:{contains:filter.query,mode:'insensitive'}}:{}) }, orderBy:{createdAt:'desc'} });
    return rows.map(mapTraveler);
  }
  async findByCompanyDocumentNumber(companyId: CompanyId, documentNumber: string) { const row=await this.db.tvmTravelDocument.findUnique({ where:{ companyId_documentNumber:{ companyId, documentNumber } } }); return row ? mapDocument(row) : undefined; }
  async addDocument(value: TravelDocument) { await this.db.tvmTravelDocument.create({ data:documentData(value) }); }
  async supersedeDocument(previous: TravelDocument, next: TravelDocument) { await this.db.$transaction(async (tx)=>{ await tx.tvmTravelDocument.update({ where:{ id:previous.id }, data:{ isCurrent:false, supersededByDocumentId:next.id } }); await tx.tvmTravelDocument.create({ data:documentData(next) }); }); }
  async listDocuments(companyId: CompanyId, travelerId_: TravelerId) { const rows=await this.db.tvmTravelDocument.findMany({ where:{ companyId, travelerId:travelerId_ }, orderBy:{createdAt:'asc'} }); return rows.map(mapDocument); }
  async findLegacyImportRecord(companyId: CompanyId, sourceSystem: string, sourceReference: string) { const row=await this.db.tvmLegacyImportRecord.findUnique({ where:{ companyId_source_reference:{ companyId, legacySourceSystem:sourceSystem, legacySourceReference:sourceReference } } }); return row ? mapImport(row) : undefined; }
  async saveLegacyImportEffect(effect: LegacyImportEffect) {
    await this.db.$transaction(async (tx)=>{
      if (effect.travelerToCreate) await tx.tvmTraveler.create({ data:travelerData(effect.travelerToCreate) });
      if (effect.previousDocument) await tx.tvmTravelDocument.update({ where:{ id:effect.previousDocument.id }, data:{ isCurrent:false, supersededByDocumentId:effect.previousDocument.supersededByDocumentId } });
      if (effect.documentToCreate) await tx.tvmTravelDocument.create({ data:documentData(effect.documentToCreate) });
      const record=effect.importRecord;
      await tx.tvmLegacyImportRecord.create({ data:{ id:record.id, companyId:record.companyId, branchId:record.branchId, legacySourceSystem:record.legacySourceSystem, legacySourceReference:record.legacySourceReference, travelerId:record.travelerId, travelDocumentId:record.travelDocumentId, inputFingerprint:record.inputFingerprint, importedAt:new Date(record.importedAt) } });
    });
  }
  async legacyImports(companyId: CompanyId, branchId?: BranchId) { const rows=await this.db.tvmLegacyImportRecord.findMany({ where:{ companyId, ...(branchId?{branchId}: {}) }, orderBy:{importedAt:'desc'} }); return rows.map(mapImport); }
}
