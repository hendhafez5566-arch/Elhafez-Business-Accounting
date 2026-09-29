import {
  ContractValidationError,
  type CompanyId,
  type SourceReference,
} from '@elhafez/contracts';
import type { CostCenterRepository } from '../application/cost-center.repository.js';
import type {
  Budget,
  BudgetActual,
  CostCenter,
  CostCenterId,
  ProgramAllocationCostEffect,
  ProgramCostCenterAssociation,
  TourismServiceActualization,
} from '../domain/cost-center.js';

export class InMemoryCostCenterRepository implements CostCenterRepository {
  private readonly centers = new Map<string, CostCenter>();
  private readonly links = new Map<string, ProgramCostCenterAssociation>();
  private readonly budgetValues = new Map<string, Budget>();
  private readonly actualValues = new Map<string, BudgetActual>();
  private readonly allocationCostEffects = new Map<string, ProgramAllocationCostEffect>();
  private readonly tourismActualizations = new Map<string, TourismServiceActualization>();

  async save(value: CostCenter) {
    if ([...this.centers.values()].some((x) => x.id === value.id && x.companyId !== value.companyId)) {
      throw new ContractValidationError('costCenterId', 'is already owned by another company');
    }
    if (value.parentId && !this.centers.has(`${value.companyId}:${value.parentId}`)) {
      throw new ContractValidationError('parentId', 'parent must belong to the same company');
    }
    this.centers.set(`${value.companyId}:${value.id}`, value);
  }

  async find(companyId: CompanyId, id: CostCenterId) {
    return this.centers.get(`${companyId}:${id}`);
  }

  async findByCode(companyId: CompanyId, code: string) {
    return [...this.centers.values()].find(
      (value) => value.companyId === companyId && value.code === code,
    );
  }

  async list(companyId: CompanyId) {
    return [...this.centers.values()]
      .filter((value) => value.companyId === companyId)
      .sort((left, right) => left.code.localeCompare(right.code) || left.name.localeCompare(right.name));
  }

  private associationKey(companyId: CompanyId, program: SourceReference) {
    return `${companyId}:${program.sourceType}:${program.sourceId}`;
  }

  async saveAssociation(value: ProgramCostCenterAssociation) {
    if (!this.centers.has(`${value.companyId}:${value.costCenterId}`)) {
      throw new ContractValidationError(
        'costCenterId',
        'cost center must belong to the association company',
      );
    }
    this.links.set(this.associationKey(value.companyId, value.program), value);
  }

  async findAssociation(companyId: CompanyId, program: SourceReference) {
    return this.links.get(this.associationKey(companyId, program));
  }

  async saveBudget(value: Budget) {
    if (
      [...this.budgetValues.values()].some(
        (x) => x.id === value.id && x.companyId !== value.companyId,
      )
    ) {
      throw new ContractValidationError('budget', 'id owned by another company');
    }
    this.budgetValues.set(`${value.companyId}:${value.id}`, value);
  }

  async budget(companyId: CompanyId, id: string) {
    return this.budgetValues.get(`${companyId}:${id}`);
  }

  async budgets(companyId: CompanyId, costCenterId: CostCenterId) {
    return [...this.budgetValues.values()].filter(
      (value) => value.companyId === companyId && value.costCenterId === costCenterId,
    );
  }

  async saveActual(value: BudgetActual) {
    const key = `${value.companyId}:${value.journalId}:${value.journalLineId}`;
    const old = this.actualValues.get(key);
    if (old && JSON.stringify(old) !== JSON.stringify(value)) {
      throw new ContractValidationError('actual', 'conflicting replay');
    }
    this.actualValues.set(key, value);
  }

  async actuals(companyId: CompanyId, costCenterId: CostCenterId) {
    return [...this.actualValues.values()].filter(
      (value) => value.companyId === companyId && value.costCenterId === costCenterId,
    );
  }

  async saveProgramAllocationCostEffect(value: ProgramAllocationCostEffect) {
    const key = `${value.companyId}:${value.id}`;
    const old = this.allocationCostEffects.get(key);
    if (old && old.requestHash !== value.requestHash) {
      throw new ContractValidationError('allocationCostEffect', 'conflicting replay');
    }
    if (!old) this.allocationCostEffects.set(key, value);
  }

  async programAllocationCostEffect(companyId: CompanyId, id: string) {
    return this.allocationCostEffects.get(`${companyId}:${id}`);
  }
  async saveTourismServiceActualization(value: TourismServiceActualization) { const key = `${value.companyId}:${value.id}`; const old = this.tourismActualizations.get(key); if (old && old.requestHash !== value.requestHash) throw new ContractValidationError('tourismActualization', 'conflicting replay'); if (!old) this.tourismActualizations.set(key, value); }
  async tourismServiceActualization(companyId: CompanyId, id: string) { return this.tourismActualizations.get(`${companyId}:${id}`); }
}
