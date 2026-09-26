import type { CompanyId, SourceReference } from '@elhafez/contracts';
import type {
  Budget,
  BudgetActual,
  CostCenter,
  CostCenterId,
  ProgramAllocationCostEffect,
  ProgramCostCenterAssociation,
  TourismServiceActualization,
} from '../domain/cost-center.js';

export interface CostCenterRepository {
  save(value: CostCenter): Promise<void>;
  find(companyId: CompanyId, id: CostCenterId): Promise<CostCenter | undefined>;
  findByCode(companyId: CompanyId, code: string): Promise<CostCenter | undefined>;
  listCenters(companyId: CompanyId): Promise<CostCenter[]>;
  listBudgets(companyId: CompanyId): Promise<Budget[]>;
  saveAssociation(value: ProgramCostCenterAssociation): Promise<void>;
  findAssociation(companyId: CompanyId, program: SourceReference): Promise<ProgramCostCenterAssociation | undefined>;
  saveBudget(value: Budget): Promise<void>;
  budget(companyId: CompanyId, id: string): Promise<Budget | undefined>;
  budgets(companyId: CompanyId, costCenterId: CostCenterId): Promise<Budget[]>;
  saveActual(value: BudgetActual): Promise<void>;
  actuals(companyId: CompanyId, costCenterId: CostCenterId): Promise<BudgetActual[]>;
  saveProgramAllocationCostEffect(value: ProgramAllocationCostEffect): Promise<void>;
  programAllocationCostEffect(companyId: CompanyId, id: string): Promise<ProgramAllocationCostEffect | undefined>;
  saveTourismServiceActualization(value: TourismServiceActualization): Promise<void>;
  tourismServiceActualization(companyId: CompanyId, id: string): Promise<TourismServiceActualization | undefined>;
}

export const COST_CENTER_REPOSITORY = Symbol('COST_CENTER_REPOSITORY');
