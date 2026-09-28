import { createHash } from 'node:crypto';
import {
  ContractValidationError,
  currencyCode,
  decimalAmount,
  type CompanyId,
  type DecimalAmount,
  type SourceReference,
} from '@elhafez/contracts';
import {
  createCostCenter,
  type Budget,
  type BudgetActual,
  type CostCenter,
  type CostCenterId,
  type ProgramAllocationCostEffect,
  type ProgramCostCenterAssociation,
} from '../domain/cost-center.js';
import type { CostCenterRepository } from './cost-center.repository.js';

export class CostBudgetAccountingApplicationService {
  constructor(private readonly repository: CostCenterRepository) {}

  async create(input: CostCenter): Promise<CostCenter> {
    const value = createCostCenter(input);
    if (await this.repository.findByCode(value.companyId, value.code)) {
      throw new ContractValidationError('code', 'already exists for company');
    }
    if (value.parentId) await this.validateActive(value.companyId, value.parentId);
    await this.repository.save(value);
    return value;
  }

  list(companyId: CompanyId): Promise<CostCenter[]> {
    return this.repository.list(companyId);
  }

  async get(companyId: CompanyId, id: CostCenterId): Promise<CostCenter> {
    const value = await this.repository.find(companyId, id);
    if (!value) throw new ContractValidationError('costCenterId', 'not found for company');
    return value;
  }

  async validateActive(companyId: CompanyId, id: CostCenterId): Promise<CostCenter> {
    const value = await this.get(companyId, id);
    if (value.status !== 'ACTIVE') {
      throw new ContractValidationError('costCenterId', 'cost center is inactive');
    }
    return value;
  }

  async deactivate(companyId: CompanyId, id: CostCenterId): Promise<CostCenter> {
    const value = await this.get(companyId, id);
    const changed = Object.freeze({ ...value, status: 'INACTIVE' as const });
    await this.repository.save(changed);
    return changed;
  }

  async ensureProgramCostCenter(
    companyId: CompanyId,
    program: SourceReference,
    costCenterId: CostCenterId,
  ): Promise<ProgramCostCenterAssociation> {
    await this.validateActive(companyId, costCenterId);
    const existing = await this.repository.findAssociation(companyId, program);
    if (existing) {
      if (existing.costCenterId !== costCenterId) {
        throw new ContractValidationError('program', 'already mapped to a different cost center');
      }
      return existing;
    }
    const value = Object.freeze({ companyId, program, costCenterId });
    await this.repository.saveAssociation(value);
    return value;
  }

  async resolveProgramCostCenter(companyId: CompanyId, program: SourceReference): Promise<CostCenter> {
    const association = await this.repository.findAssociation(companyId, program);
    if (!association) throw new ContractValidationError('program', 'has no cost center association');
    return this.validateActive(companyId, association.costCenterId);
  }

  async createBudget(input: {
    id: string;
    companyId: CompanyId;
    costCenterId: CostCenterId;
    periodStart: string;
    periodEnd: string;
    currency: string;
    amount: DecimalAmount;
  }) {
    await this.validateActive(input.companyId, input.costCenterId);
    const amount = decimalAmount(input.amount);
    if (scaled(amount) <= 0n || input.periodEnd < input.periodStart) {
      throw new ContractValidationError('budget', 'positive amount and valid range required');
    }
    const normalized = { ...input, currency: currencyCode(input.currency), amount };
    const requestHash = fingerprint(normalized);
    const old = await this.repository.budget(input.companyId, input.id);
    if (old) {
      if (old.requestHash !== requestHash) {
        throw new ContractValidationError('budget', 'conflicting replay');
      }
      return old;
    }
    const value: Budget = { ...normalized, status: 'DRAFT', requestHash };
    await this.repository.saveBudget(value);
    return value;
  }

  async authorizeBudget(companyId: CompanyId, id: string) {
    const old = await this.repository.budget(companyId, id);
    if (!old) throw new ContractValidationError('budget', 'not found');
    const value = { ...old, status: 'AUTHORIZED' as const };
    await this.repository.saveBudget(value);
    return value;
  }

  async consumeJournalPostedFact(input: BudgetActual) {
    await this.get(input.companyId, input.costCenterId);
    decimalAmount(input.amount);
    await this.repository.saveActual(input);
    return input;
  }

  async checkBudget(companyId: CompanyId, id: string) {
    const budget = await this.repository.budget(companyId, id);
    if (!budget) throw new ContractValidationError('budget', 'not found');
    const actuals = (await this.repository.actuals(companyId, budget.costCenterId)).filter(
      (value) => value.postingDate >= budget.periodStart && value.postingDate <= budget.periodEnd,
    );
    const actual = actuals.reduce((total, value) => total + scaled(value.amount), 0n);
    return {
      budget,
      actual: dec(actual),
      remaining: dec(scaled(budget.amount) - actual),
      exceeded: actual > scaled(budget.amount),
    };
  }

  async recordProgramAllocationCostEffect(input: {
    id: string;
    companyId: CompanyId;
    program: SourceReference;
    allocationId: string;
    previousQuantity: DecimalAmount;
    newQuantity: DecimalAmount;
    amount: DecimalAmount;
    postingDate: string;
  }): Promise<ProgramAllocationCostEffect> {
    if (!input.id.trim() || !input.allocationId.trim()) {
      throw new ContractValidationError('allocationCostEffect', 'id and allocationId are required');
    }
    const center = await this.resolveProgramCostCenter(input.companyId, input.program);
    const previousQuantity = decimalAmount(input.previousQuantity);
    const newQuantity = decimalAmount(input.newQuantity);
    const amount = decimalAmount(input.amount);
    if (scaled(previousQuantity) < 0n || scaled(newQuantity) < 0n) {
      throw new ContractValidationError('allocationCostEffect', 'quantities cannot be negative');
    }

    const normalized = {
      id: input.id,
      companyId: input.companyId,
      costCenterId: center.id,
      program: input.program,
      allocationId: input.allocationId,
      previousQuantity,
      newQuantity,
      amount,
      postingDate: input.postingDate,
    };
    const requestHash = fingerprint(normalized);
    const existing = await this.repository.programAllocationCostEffect(input.companyId, input.id);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ContractValidationError('allocationCostEffect', 'conflicting replay');
      }
      return existing;
    }

    const value: ProgramAllocationCostEffect = {
      ...normalized,
      requestHash,
      createdAt: new Date().toISOString(),
    };
    await this.repository.saveProgramAllocationCostEffect(value);
    return value;
  }

  async getProgramAllocationCostEffect(
    companyId: CompanyId,
    id: string,
  ): Promise<ProgramAllocationCostEffect | undefined> {
    return this.repository.programAllocationCostEffect(companyId, id);
  }

  async recordTourismServiceActualization(input: {
    id: string; companyId: CompanyId; program: SourceReference; service: SourceReference;
    evidence: SourceReference; amount: DecimalAmount; postingDate: string;
  }) {
    const center = await this.resolveProgramCostCenter(input.companyId, input.program);
    const amount = decimalAmount(input.amount);
    if (scaled(amount) < 0n) throw new ContractValidationError('amount', 'must not be negative');
    const normalized = { ...input, costCenterId: center.id, amount };
    const requestHash = fingerprint(normalized);
    const value = { ...normalized, requestHash, createdAt: new Date().toISOString() };
    try {
      await this.repository.saveTourismServiceActualization(value);
      return (await this.repository.tourismServiceActualization(input.companyId, input.id)) ?? value;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        const existing = await this.repository.tourismServiceActualization(input.companyId, input.id);
        if (!existing) throw error;
        if (existing.requestHash !== requestHash) {
          throw new ContractValidationError('tourismActualization', 'conflicting replay');
        }
        return existing;
      }
      throw error;
    }
  }
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function scaled(value: DecimalAmount): bigint {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const result = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
  return negative ? -result : result;
}

function dec(value: bigint): DecimalAmount {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 10n ** 18n;
  const fraction = absolute % 10n ** 18n;
  return decimalAmount(
    (negative ? '-' : '') +
      (fraction
        ? `${whole}.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}`
        : whole.toString()),
  );
}