import { createHash } from 'node:crypto';
import { ContractValidationError, decimalAmount, type CompanyId, type DecimalAmount } from '@elhafez/contracts';
import type { CommandReceipt, CommercialSnapshot, DebtorKind, ServiceHistoryEntry, ServiceRevision, ServiceType, StandaloneService, StandaloneServiceCategory } from '../domain/service.js';
import type { StandaloneServicesRepository } from './standalone-services.repository.js';

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}
function hash(value: unknown): string { return createHash('sha256').update(stable(value)).digest('hex'); }
function required(value: string, field: string): string { if (!value?.trim()) throw new ContractValidationError(field, 'is required'); return value.trim(); }
function units(value: DecimalAmount): bigint { const [whole, fraction = ''] = decimalAmount(value).split('.'); return BigInt(whole! + fraction.padEnd(18, '0')); }
function fromUnits(value: bigint): DecimalAmount { const whole = value / 10n**18n; const fraction = value % 10n**18n; return decimalAmount(`${whole}${fraction ? `.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}` : ''}`); }
function commercial(currency: string, grossAmount: DecimalAmount, discountAmount: DecimalAmount): CommercialSnapshot {
  required(currency, 'currency'); const gross = units(grossAmount); const discount = units(discountAmount);
  if (gross < 0n || discount < 0n || discount > gross) throw new ContractValidationError('commercial', 'invalid gross/discount');
  return { currency: currency.trim().toUpperCase(), grossAmount: decimalAmount(grossAmount), discountAmount: decimalAmount(discountAmount), netAmount: fromUnits(gross - discount) };
}
function date(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new ContractValidationError(field, 'must be a valid YYYY-MM-DD date');
  return value;
}

export interface CreateServiceDraftInput {
  companyId: CompanyId; branchId: string; commandKey: string; actorId: string; id: string; number: string;
  serviceTypeId: string; serviceDate: string; periodEnd?: string; quantity: DecimalAmount;
  debtorKind: DebtorKind; debtorPartyId: string; customerPartyId: string; beneficiaryPartyIds?: readonly string[];
  details: Readonly<Record<string, unknown>>; currency: string; grossAmount: DecimalAmount; discountAmount: DecimalAmount;
  invoiceNumber: string; postingDate: string; dueDate: string; approvalRequestId?: string;
  commission?: { agentPartyId: string; amount: DecimalAmount };
}
export interface UpdateServiceDraftInput extends Omit<CreateServiceDraftInput, 'id'|'number'> { serviceId: string; expectedRevision: number; }
export interface ConfirmationPort {
  prepare(input: { companyId: CompanyId; branchId: string; serviceId: string; revision: number; category: StandaloneServiceCategory; commandKey: string; planId: string; planVersion: number }): Promise<{ ready: boolean; blockers: readonly string[]; planId: string; planVersion: number }>;
  commit(input: { companyId: CompanyId; branchId: string; serviceId: string; revision: number; revisionSnapshot: ServiceRevision; commandKey: string; planId: string; planVersion: number }): Promise<{ operationId: string }>;
  cancel(input: { companyId: CompanyId; branchId: string; serviceId: string; revision: number; commandKey: string }): Promise<{ cancelled: boolean; blockers: readonly string[] }>;
}

export class StandaloneServicesApplicationService {
  constructor(private readonly repo: StandaloneServicesRepository, private readonly confirmation: ConfirmationPort) {}

  private async prior(companyId: CompanyId, key: string, payload: unknown): Promise<StandaloneService | null> {
    required(key, 'commandKey'); const old = await this.repo.getReceipt(companyId, key);
    if (old && old.payloadHash !== hash(payload)) throw new ContractValidationError('commandKey', 'conflicting replay');
    return old?.result ?? null;
  }
  private receipt(companyId: CompanyId, key: string, payload: unknown, result: StandaloneService): CommandReceipt {
    return { companyId, commandKey: key, payloadHash: hash(payload), result };
  }
  private history(service: StandaloneService, actorId: string, kind: ServiceHistoryEntry['kind'], evidence?: Readonly<Record<string, unknown>>): ServiceHistoryEntry {
    return { id: hash([service.id, service.revision, kind, service.pendingCommandKey ?? '']).slice(0, 32), serviceId: service.id, revision: service.revision, kind, actorId: required(actorId, 'actorId'), ...(evidence ? { evidence } : {}), createdAt: new Date().toISOString() };
  }

  async manageServiceType(input: ServiceType): Promise<ServiceType> {
    required(input.id, 'id'); required(input.code, 'code'); required(input.nameAr, 'nameAr');
    if (!['HOTEL', 'FLIGHT', 'VISA', 'TRANSPORT', 'OTHER'].includes(input.category)) throw new ContractValidationError('category', 'unknown service category');
    const previous = await this.repo.getType(input.companyId, input.id);
    if (previous && previous.category !== input.category) throw new ContractValidationError('category', 'service type category is immutable');
    const value = { ...input, code: input.code.trim().toUpperCase(), nameAr: input.nameAr.trim() };
    await this.repo.saveType(value); return value;
  }

  async createDraft(input: CreateServiceDraftInput): Promise<StandaloneService> {
    const old = await this.prior(input.companyId, input.commandKey, input); if (old) return old;
    required(input.id, 'id'); required(input.branchId, 'branchId'); required(input.number, 'number'); required(input.actorId, 'actorId');
    const type = await this.repo.getType(input.companyId, input.serviceTypeId); if (!type?.active) throw new ContractValidationError('serviceTypeId', 'active service type required');
    const now = new Date().toISOString(); const service: StandaloneService = { id: input.id, companyId: input.companyId, branchId: input.branchId, number: input.number, status: 'DRAFT', revision: 1, createdAt: now, updatedAt: now };
    await this.repo.createDraft(service, this.revision(input, type, service.id, 1, now), this.history(service, input.actorId, 'DRAFTED'), this.receipt(input.companyId, input.commandKey, input, service));
    return service;
  }

  async updateDraft(input: UpdateServiceDraftInput): Promise<StandaloneService> {
    const old = await this.prior(input.companyId, input.commandKey, input); if (old) return old;
    const current = await this.requiredService(input.companyId, input.serviceId); this.assertScope(current, input.branchId);
    if (current.status !== 'DRAFT') throw new ContractValidationError('status', 'only DRAFT can be edited');
    if (current.revision !== input.expectedRevision) throw new ContractValidationError('expectedRevision', 'stale service revision');
    const type = await this.repo.getType(input.companyId, input.serviceTypeId); if (!type?.active) throw new ContractValidationError('serviceTypeId', 'active service type required');
    const now = new Date().toISOString(); const next: StandaloneService = { ...current, revision: current.revision + 1, updatedAt: now };
    await this.repo.amendDraft(next, current.revision, this.revision(input, type, current.id, next.revision, now), this.history(next, input.actorId, 'AMENDED'), this.receipt(input.companyId, input.commandKey, input, next));
    return next;
  }

  async confirm(input: { companyId: CompanyId; branchId: string; serviceId: string; expectedRevision: number; commandKey: string; actorId: string; planId: string; planVersion: number }): Promise<StandaloneService> {
    const old = await this.prior(input.companyId, input.commandKey, input); if (old) return old;
    let current = await this.requiredService(input.companyId, input.serviceId); this.assertScope(current, input.branchId);
    if (current.revision !== input.expectedRevision) throw new ContractValidationError('expectedRevision', 'stale service revision');
    if (current.status === 'DRAFT') {
      required(input.planId, 'planId');
      if (!Number.isInteger(input.planVersion) || input.planVersion < 1) throw new ContractValidationError('planVersion', 'invalid reviewed plan version');
      const revision = await this.requiredRevision(current);
      const prep = await this.confirmation.prepare({ companyId: input.companyId, branchId: input.branchId, serviceId: current.id, revision: current.revision, category: revision.category, commandKey: `${input.commandKey}:prepare`, planId: input.planId, planVersion: input.planVersion });
      if (!prep.ready) throw new ContractValidationError('confirmation', `blocked: ${prep.blockers.join(',')}`);
      if (prep.planId !== input.planId || prep.planVersion !== input.planVersion) throw new ContractValidationError('planId', 'reviewed supply plan changed');
      const pending: StandaloneService = { ...current, status: 'CONFIRMING', pendingCommandKey: input.commandKey, ...(prep.planId ? { supplyPlanId: prep.planId } : {}), ...(prep.planVersion !== undefined ? { supplyPlanVersion: prep.planVersion } : {}), updatedAt: new Date().toISOString() };
      await this.repo.transition(pending, 'DRAFT', this.history(pending, input.actorId, 'CONFIRMATION_STARTED', { planId: prep.planId ?? null, planVersion: prep.planVersion ?? null }));
      current = pending;
    }
    if (current.status !== 'CONFIRMING' || current.pendingCommandKey !== input.commandKey) throw new ContractValidationError('status', 'confirmation already in progress or service is not a draft');
    if (!current.supplyPlanId || current.supplyPlanVersion === undefined) throw new ContractValidationError('planId', 'persisted reviewed plan is missing');
    const committed = await this.confirmation.commit({ companyId: input.companyId, branchId: input.branchId, serviceId: current.id, revision: current.revision, revisionSnapshot: await this.requiredRevision(current), commandKey: `${input.commandKey}:commit`, planId: current.supplyPlanId, planVersion: current.supplyPlanVersion });
    required(committed.operationId, 'operationId');
    const done: StandaloneService = { ...current, status: 'CONFIRMED', confirmedRevision: current.revision, externalOperationId: committed.operationId, pendingCommandKey: undefined, updatedAt: new Date().toISOString() };
    await this.repo.transition(done, 'CONFIRMING', this.history(done, input.actorId, 'CONFIRMED', { operationId: committed.operationId }), this.receipt(input.companyId, input.commandKey, input, done));
    return done;
  }

  async requestCancellation(input: { companyId: CompanyId; branchId: string; serviceId: string; commandKey: string; actorId: string; postingDate?: string }, cancel: ConfirmationPort['cancel'] = this.confirmation.cancel.bind(this.confirmation)): Promise<StandaloneService> {
    const old = await this.prior(input.companyId, input.commandKey, input); if (old) return old;
    let current = await this.requiredService(input.companyId, input.serviceId); this.assertScope(current, input.branchId);
    if (current.status === 'CONFIRMED') {
      const pending: StandaloneService = { ...current, status: 'CANCELLATION_REQUESTED', pendingCommandKey: input.commandKey, ...(input.postingDate ? { cancellationPostingDate: date(input.postingDate, 'postingDate') } : {}), updatedAt: new Date().toISOString() };
      await this.repo.transition(pending, 'CONFIRMED', this.history(pending, input.actorId, 'CANCELLATION_REQUESTED'));
      current = pending;
    }
    if (current.status !== 'CANCELLATION_REQUESTED' || current.pendingCommandKey !== input.commandKey) throw new ContractValidationError('status', 'another cancellation is in progress');
    const result = await cancel({ companyId: input.companyId, branchId: input.branchId, serviceId: current.id, revision: current.confirmedRevision!, commandKey: `${input.commandKey}:cancel` });
    if (!result.cancelled) throw new ContractValidationError('cancellation', `blocked: ${result.blockers.join(',')}`);
    const done: StandaloneService = { ...current, status: 'CANCELLED', pendingCommandKey: undefined, updatedAt: new Date().toISOString() };
    await this.repo.transition(done, 'CANCELLATION_REQUESTED', this.history(done, input.actorId, 'CANCELLED'), this.receipt(input.companyId, input.commandKey, input, done));
    return done;
  }

  async getService(companyId: CompanyId, id: string) { const service = await this.requiredService(companyId, id); return { service, revision: await this.requiredRevision(service), history: await this.repo.history(id) }; }
  async completeFromFulfillment(input: {companyId:CompanyId;branchId:string;serviceId:string;revision:number;caseId:string;actorId:string;commandKey:string}):Promise<StandaloneService> {
    const old=await this.prior(input.companyId,input.commandKey,input);if(old)return old;
    const current=await this.requiredService(input.companyId,input.serviceId);this.assertScope(current,input.branchId);
    if(current.status==='COMPLETED'&&current.confirmedRevision===input.revision)return current;
    if(current.status!=='CONFIRMED'||current.confirmedRevision!==input.revision)throw new ContractValidationError('status','confirmed revision required for completion');
    const done:StandaloneService={...current,status:'COMPLETED',updatedAt:new Date().toISOString()};
    await this.repo.transition(done,'CONFIRMED',this.history(done,input.actorId,'COMPLETED',{fulfillmentCaseId:input.caseId}),this.receipt(input.companyId,input.commandKey,input,done));
    return done;
  }
  async listServices(companyId: CompanyId, branchId: string) { return this.repo.listServices(companyId, branchId); }
  async listTypes(companyId: CompanyId) { return this.repo.listTypes(companyId); }
  private revision(input: Omit<CreateServiceDraftInput, 'id'|'number'> | CreateServiceDraftInput, type: ServiceType, serviceId: string, revision: number, createdAt: string): ServiceRevision {
    const quantity = decimalAmount(input.quantity); if (units(quantity) <= 0n) throw new ContractValidationError('quantity', 'must be positive');
    required(input.debtorPartyId, 'debtorPartyId'); required(input.customerPartyId, 'customerPartyId'); date(input.serviceDate, 'serviceDate');
    if (input.periodEnd && date(input.periodEnd, 'periodEnd') < input.serviceDate) throw new ContractValidationError('periodEnd', 'must follow serviceDate');
    if (!['CUSTOMER', 'AGENT'].includes(input.debtorKind)) throw new ContractValidationError('debtorKind', 'invalid debtor');
    required(input.invoiceNumber, 'invoiceNumber'); date(input.postingDate, 'postingDate'); date(input.dueDate, 'dueDate');
    if (input.dueDate < input.postingDate) throw new ContractValidationError('dueDate', 'must not precede postingDate');
    if (input.commission) { required(input.commission.agentPartyId, 'commission.agentPartyId'); if (units(decimalAmount(input.commission.amount)) < 0n) throw new ContractValidationError('commission.amount', 'must not be negative'); }
    return { serviceId, revision, serviceTypeId: type.id, category: type.category, serviceDate: input.serviceDate, ...(input.periodEnd ? { periodEnd: input.periodEnd } : {}), quantity, debtorKind: input.debtorKind, debtorPartyId: input.debtorPartyId, customerPartyId: input.customerPartyId, beneficiaryPartyIds: [...(input.beneficiaryPartyIds ?? [])], details: { ...input.details }, commercial: commercial(input.currency, input.grossAmount, input.discountAmount), financialTerms: {invoiceNumber:input.invoiceNumber,postingDate:input.postingDate,dueDate:input.dueDate,...(input.approvalRequestId?{approvalRequestId:input.approvalRequestId}:{}),...(input.commission?{commission:{...input.commission}}:{})}, createdAt };
  }
  private async requiredService(companyId: CompanyId, id: string) { const value = await this.repo.getService(companyId, id); if (!value) throw new ContractValidationError('serviceId', 'service not found'); return value; }
  private async requiredRevision(service: StandaloneService) { const value = await this.repo.getRevision(service.id, service.revision); if (!value) throw new ContractValidationError('revision', 'service revision not found'); return value; }
  private assertScope(service: StandaloneService, branchId: string) { if (service.branchId !== branchId) throw new ContractValidationError('branchId', 'service belongs to a different branch'); }
}
