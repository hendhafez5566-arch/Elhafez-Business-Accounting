import { createHash, randomUUID } from 'node:crypto';
import { ContractValidationError, type ExecutionContext } from '@elhafez/contracts';
import type { LegacyImportOutcome, LegacyImportRecord, LegacyPassportRecord } from '../domain/legacy-import.js';
import {
  isoDate,
  optionalText,
  passportNumber,
  requiredText,
  travelDocumentId,
  travelerId,
  type CreateTravelDocumentInput,
  type CreateTravelerInput,
  type TravelDocument,
  type Traveler,
  type TravelerId,
  type UpdateTravelerInput,
} from '../domain/traveler.js';
import type { TravelerManagementAccess } from './traveler-management-access.js';
import type { TravelerLinkagePort } from './traveler-management-dependencies.port.js';
import type { TravelerManagementRepository } from './traveler-management.repository.js';

export const TRAVELER_PERMISSIONS = Object.freeze({
  read: 'traveler.read',
  manage: 'traveler.manage',
  lifecycle: 'traveler.lifecycle',
  migrate: 'traveler.migrate',
});

export class TravelerManagementApplicationService {
  constructor(
    private readonly repository: TravelerManagementRepository,
    private readonly access: TravelerManagementAccess,
    private readonly linkage: TravelerLinkagePort,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = () => randomUUID(),
  ) {}

  private async perm(context: ExecutionContext, permission: string) {
    await this.access.requireBranch(context);
    await this.access.requirePermission(context, permission);
  }

  async createTraveler(context: ExecutionContext, input: CreateTravelerInput): Promise<Traveler> {
    await this.perm(context, TRAVELER_PERMISSIONS.manage);
    const canonicalPartyId = await this.validateLinks(context, input.customerId, input.partyId);
    const at = this.now().toISOString();
    const value: Traveler = {
      id: travelerId(this.newId()),
      companyId: context.companyId,
      fullName: requiredText(input.fullName, 'fullName'),
      dateOfBirth: isoDate(input.dateOfBirth, 'dateOfBirth'),
      gender: input.gender ?? null,
      nationality: optionalText(input.nationality),
      partyId: optionalText(input.partyId ?? canonicalPartyId),
      customerId: optionalText(input.customerId),
      status: 'ACTIVE',
      createdAt: at,
      updatedAt: at,
    };
    await this.repository.createTraveler(value);
    await this.access.audit(context, 'traveler.created', 'traveler', value.id, {});
    return value;
  }

  async get(context: ExecutionContext, id: TravelerId): Promise<Traveler> {
    await this.perm(context, TRAVELER_PERMISSIONS.read);
    return this.require(context, id);
  }

  async list(context: ExecutionContext, filter?: { customerId?: string; partyId?: string; query?: string; status?: Traveler['status'] }): Promise<Traveler[]> {
    await this.perm(context, TRAVELER_PERMISSIONS.read);
    return this.repository.listTravelers(context.companyId, filter);
  }

  async update(context: ExecutionContext, id: TravelerId, input: UpdateTravelerInput): Promise<Traveler> {
    await this.perm(context, TRAVELER_PERMISSIONS.manage);
    const current = await this.require(context, id);
    const updated: Traveler = {
      ...current,
      fullName: input.fullName === undefined ? current.fullName : requiredText(input.fullName, 'fullName'),
      dateOfBirth: input.dateOfBirth === undefined ? current.dateOfBirth : isoDate(input.dateOfBirth, 'dateOfBirth'),
      gender: input.gender === undefined ? current.gender : input.gender,
      nationality: input.nationality === undefined ? current.nationality : optionalText(input.nationality),
      updatedAt: this.now().toISOString(),
    };
    await this.repository.updateTraveler(updated);
    await this.access.audit(context, 'traveler.updated', 'traveler', id, {});
    return updated;
  }

  async archive(context: ExecutionContext, id: TravelerId): Promise<Traveler> {
    await this.perm(context, TRAVELER_PERMISSIONS.lifecycle);
    const current = await this.require(context, id);
    if (current.status === 'ARCHIVED') return current;
    const updated = { ...current, status: 'ARCHIVED' as const, updatedAt: this.now().toISOString() };
    await this.repository.updateTraveler(updated);
    await this.access.audit(context, 'traveler.archived', 'traveler', id, {});
    return updated;
  }

  async reactivate(context: ExecutionContext, id: TravelerId): Promise<Traveler> {
    await this.perm(context, TRAVELER_PERMISSIONS.lifecycle);
    const current = await this.require(context, id);
    if (current.status === 'ACTIVE') return current;
    const updated = { ...current, status: 'ACTIVE' as const, updatedAt: this.now().toISOString() };
    await this.repository.updateTraveler(updated);
    await this.access.audit(context, 'traveler.reactivated', 'traveler', id, {});
    return updated;
  }

  async addDocument(context: ExecutionContext, id: TravelerId, input: CreateTravelDocumentInput): Promise<TravelDocument> {
    await this.perm(context, TRAVELER_PERMISSIONS.manage);
    const traveler = await this.require(context, id);
    if (traveler.status !== 'ACTIVE') throw new ContractValidationError('traveler', 'archived traveler cannot receive a new document');
    const effect = await this.prepareDocumentEffect(context, traveler, input);
    if (!effect.next) return effect.current!;
    if (effect.current) await this.repository.supersedeDocument(effect.previous!, effect.next);
    else await this.repository.addDocument(effect.next);
    await this.access.audit(context, 'traveler.document_added', 'traveler', traveler.id, { documentId: effect.next.id });
    return effect.next;
  }

  async listDocuments(context: ExecutionContext, id: TravelerId): Promise<TravelDocument[]> {
    await this.perm(context, TRAVELER_PERMISSIONS.read);
    await this.require(context, id);
    return this.repository.listDocuments(context.companyId, id);
  }

  async legacyImportHistory(context: ExecutionContext): Promise<LegacyImportRecord[]> {
    await this.perm(context, TRAVELER_PERMISSIONS.migrate);
    return this.repository.legacyImports(context.companyId, context.branchId);
  }

  async importLegacyPassport(context: ExecutionContext, source: LegacyPassportRecord): Promise<LegacyImportOutcome> {
    await this.perm(context, TRAVELER_PERMISSIONS.migrate);
    if (source.companyId !== context.companyId || source.branchId !== context.branchId) {
      throw new ContractValidationError('companyId', 'legacy record company/branch does not match execution context');
    }

    const sourceSystem = requiredText(source.legacySourceSystem, 'legacySourceSystem');
    const sourceReference = requiredText(source.legacySourceReference, 'legacySourceReference');
    const fingerprint = this.fingerprint(source);
    const prior = await this.repository.findLegacyImportRecord(context.companyId, sourceSystem, sourceReference);
    if (prior) {
      return prior.inputFingerprint === fingerprint
        ? { status: 'ALREADY_IMPORTED', travelerId: prior.travelerId, travelDocumentId: prior.travelDocumentId }
        : { status: 'CONFLICT', reason: 'legacy source reference was already imported with different data' };
    }

    if (!source.customerId && !source.partyId) {
      return { status: 'UNRESOLVED_LINKAGE', reason: 'legacy record supplies no canonical customerId or partyId' };
    }
    const customerPartyId = source.customerId ? await this.linkage.customerPartyId(context, source.customerId) : null;
    if (source.customerId && !customerPartyId) {
      return { status: 'UNRESOLVED_LINKAGE', reason: 'customerId does not resolve to an active customer' };
    }
    if (source.partyId && !(await this.linkage.isResolvableParty(context, source.partyId))) {
      return { status: 'UNRESOLVED_LINKAGE', reason: 'partyId does not resolve to a canonical party' };
    }
    if (source.partyId && customerPartyId && source.partyId !== customerPartyId) {
      return { status: 'CONFLICT', reason: 'customerId and partyId do not identify the same canonical party' };
    }

    const linkedByCustomer = source.customerId ? await this.repository.listTravelers(context.companyId, { customerId: source.customerId }) : [];
    const linkedByParty = source.partyId ? await this.repository.listTravelers(context.companyId, { partyId: source.partyId }) : [];
    const linkedIds = new Set([...linkedByCustomer, ...linkedByParty].map((value) => value.id));
    if (linkedIds.size > 1) {
      return { status: 'UNRESOLVED_LINKAGE', reason: 'legacy customer/party linkage matches multiple travelers and requires review' };
    }
    const existingTraveler = [...linkedByCustomer, ...linkedByParty][0];
    if (existingTraveler?.status !== undefined && existingTraveler.status !== 'ACTIVE') {
      return { status: 'UNRESOLVED_LINKAGE', reason: 'linked traveler is archived and requires review' };
    }
    if (existingTraveler?.customerId && source.customerId && existingTraveler.customerId !== source.customerId) {
      return { status: 'CONFLICT', reason: 'linked traveler belongs to a different canonical customer' };
    }
    const canonicalPartyId = source.partyId ?? customerPartyId;
    if (existingTraveler?.partyId && canonicalPartyId && existingTraveler.partyId !== canonicalPartyId) {
      return { status: 'CONFLICT', reason: 'linked traveler belongs to a different canonical party' };
    }

    const at = this.now().toISOString();
    const traveler: Traveler = existingTraveler ?? {
      id: travelerId(this.newId()),
      companyId: context.companyId,
      fullName: requiredText(source.fullName, 'fullName'),
      dateOfBirth: isoDate(source.dateOfBirth, 'dateOfBirth'),
      gender: source.gender ?? null,
      nationality: optionalText(source.nationality),
      partyId: optionalText(source.partyId ?? customerPartyId),
      customerId: optionalText(source.customerId),
      status: 'ACTIVE',
      createdAt: at,
      updatedAt: at,
    };

    const normalizedNumber = passportNumber(source.documentNumber);
    const duplicate = await this.repository.findByCompanyDocumentNumber(context.companyId, normalizedNumber);
    if (duplicate && duplicate.travelerId !== traveler.id) {
      return { status: 'CONFLICT', reason: 'passport number already belongs to a different traveler in this company' };
    }
    if (duplicate && !this.legacyDocumentMatches(duplicate, source)) {
      return { status: 'CONFLICT', reason: 'passport number already exists with conflicting document evidence' };
    }

    const documents = existingTraveler ? await this.repository.listDocuments(context.companyId, traveler.id) : [];
    const current = documents.find((value) => value.isCurrent);
    const sameDocument = duplicate?.travelerId === traveler.id ? duplicate : undefined;
    const nextDocument: TravelDocument | undefined = sameDocument ? undefined : {
      id: travelDocumentId(this.newId()),
      companyId: context.companyId,
      travelerId: traveler.id,
      documentType: 'PASSPORT',
      documentNumber: normalizedNumber,
      issuingCountry: optionalText(source.issuingCountry),
      issuingPlace: optionalText(source.issuingPlace),
      holderNameSnapshot: traveler.fullName,
      issueDate: isoDate(source.issueDate, 'issueDate'),
      expiryDate: isoDate(source.expiryDate, 'expiryDate'),
      isCurrent: true,
      supersededByDocumentId: null,
      createdAt: at,
    };
    const importRecord: LegacyImportRecord = {
      id: this.newId(),
      companyId: context.companyId,
      branchId: context.branchId,
      legacySourceSystem: sourceSystem,
      legacySourceReference: sourceReference,
      travelerId: traveler.id,
      travelDocumentId: sameDocument?.id ?? nextDocument!.id,
      inputFingerprint: fingerprint,
      importedAt: at,
    };

    try {
      await this.repository.saveLegacyImportEffect({
        ...(existingTraveler ? {} : { travelerToCreate: traveler }),
        ...(current && nextDocument ? { previousDocument: { ...current, isCurrent: false, supersededByDocumentId: nextDocument.id } } : {}),
        ...(nextDocument ? { documentToCreate: nextDocument } : {}),
        importRecord,
      });
    } catch (error) {
      const concurrent = await this.repository.findLegacyImportRecord(context.companyId, sourceSystem, sourceReference);
      if (concurrent?.inputFingerprint === fingerprint) {
        return { status: 'ALREADY_IMPORTED', travelerId: concurrent.travelerId, travelDocumentId: concurrent.travelDocumentId };
      }
      throw error;
    }

    await this.access.audit(context, 'traveler.legacy_imported', 'traveler', traveler.id, { legacySourceReference: sourceReference });
    return { status: 'IMPORTED', travelerId: traveler.id, travelDocumentId: importRecord.travelDocumentId };
  }

  private async validateLinks(context: ExecutionContext, customerId?: string, partyId?: string): Promise<string | null> {
    const customerPartyId = customerId ? await this.linkage.customerPartyId(context, customerId) : null;
    if (customerId && !customerPartyId) throw new ContractValidationError('customerId', 'does not resolve to an active customer in this company');
    if (partyId && !(await this.linkage.isResolvableParty(context, partyId))) throw new ContractValidationError('partyId', 'does not resolve to a canonical party');
    if (partyId && customerPartyId && partyId !== customerPartyId) throw new ContractValidationError('partyId', 'does not match the Customer canonical party');
    return customerPartyId;
  }

  private async prepareDocumentEffect(context: ExecutionContext, traveler: Traveler, input: CreateTravelDocumentInput) {
    const number = passportNumber(input.documentNumber);
    const conflict = await this.repository.findByCompanyDocumentNumber(context.companyId, number);
    if (conflict && conflict.travelerId !== traveler.id) throw new ContractValidationError('documentNumber', 'passport number already belongs to another traveler in this company');
    if (conflict?.travelerId === traveler.id) {
      if (conflict.isCurrent) return { current: conflict, previous: undefined, next: undefined };
      throw new ContractValidationError('documentNumber', 'historical passport number cannot be reused as a new current document');
    }
    const documents = await this.repository.listDocuments(context.companyId, traveler.id);
    const current = documents.find((value) => value.isCurrent);
    const next: TravelDocument = {
      id: travelDocumentId(this.newId()), companyId: context.companyId, travelerId: traveler.id, documentType: 'PASSPORT', documentNumber: number,
      issuingCountry: optionalText(input.issuingCountry), issuingPlace: optionalText(input.issuingPlace), holderNameSnapshot: traveler.fullName, issueDate: isoDate(input.issueDate, 'issueDate'), expiryDate: isoDate(input.expiryDate, 'expiryDate'),
      isCurrent: true, supersededByDocumentId: null, createdAt: this.now().toISOString(),
    };
    return { current, previous: current ? { ...current, isCurrent: false, supersededByDocumentId: next.id } : undefined, next };
  }

  private async require(context: ExecutionContext, id: TravelerId): Promise<Traveler> {
    const value = await this.repository.findTraveler(context.companyId, id);
    if (!value) throw new ContractValidationError('travelerId', 'traveler was not found in this company');
    return value;
  }

  private legacyDocumentMatches(document: TravelDocument, source: LegacyPassportRecord): boolean {
    const issuingCountry = optionalText(source.issuingCountry);
    const issuingPlace = optionalText(source.issuingPlace);
    const issueDate = isoDate(source.issueDate, 'issueDate');
    const expiryDate = isoDate(source.expiryDate, 'expiryDate');
    return (issuingCountry === null || document.issuingCountry === issuingCountry) &&
      (issuingPlace === null || document.issuingPlace === issuingPlace) &&
      (issueDate === null || document.issueDate === issueDate) &&
      (expiryDate === null || document.expiryDate === expiryDate);
  }

  private fingerprint(source: LegacyPassportRecord): string {
    return createHash('sha256').update(JSON.stringify({
      fullName: requiredText(source.fullName, 'fullName'), dateOfBirth: isoDate(source.dateOfBirth, 'dateOfBirth'), gender: source.gender ?? null,
      nationality: optionalText(source.nationality), customerId: optionalText(source.customerId), partyId: optionalText(source.partyId),
      documentNumber: passportNumber(source.documentNumber), issuingCountry: optionalText(source.issuingCountry), issuingPlace: optionalText(source.issuingPlace), issueDate: isoDate(source.issueDate, 'issueDate'), expiryDate: isoDate(source.expiryDate, 'expiryDate'),
    })).digest('hex');
  }
}
