import { ContractValidationError, type CompanyId, type DecimalAmount, type SourceReference } from '@elhafez/contracts';

declare const costCenterIdBrand: unique symbol;
export type CostCenterId = string & { readonly [costCenterIdBrand]: 'CostCenterId' };

export interface CostCenter {
  readonly id: CostCenterId;
  readonly companyId: CompanyId;
  readonly code: string;
  readonly name: string;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly parentId?: CostCenterId;
}

export interface ProgramCostCenterAssociation {
  readonly companyId: CompanyId;
  readonly program: SourceReference;
  readonly costCenterId: CostCenterId;
}

export function costCenterId(value: string): CostCenterId {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,126}[A-Za-z0-9]$|^[A-Za-z0-9]$/.test(value)) {
    throw new ContractValidationError('costCenterId', 'invalid stable identifier');
  }
  return value as CostCenterId;
}

export function createCostCenter(input: CostCenter): Readonly<CostCenter> {
  if (!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(input.code)) {
    throw new ContractValidationError('code', 'must be uppercase and stable');
  }
  if (!input.name.trim()) throw new ContractValidationError('name', 'is required');
  return Object.freeze({ ...input, id: costCenterId(input.id), code: input.code });
}

export interface Budget {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly costCenterId: CostCenterId;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: string;
  readonly amount: DecimalAmount;
  readonly status: 'DRAFT' | 'AUTHORIZED';
  readonly requestHash: string;
}

export interface BudgetActual {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly costCenterId: CostCenterId;
  readonly postingDate: string;
  readonly amount: DecimalAmount;
  readonly journalId: string;
  readonly journalLineId: string;
}

/** Cost-owned evidence for BR-061. This is not a fabricated GL journal fact. */
export interface ProgramAllocationCostEffect {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly costCenterId: CostCenterId;
  readonly program: SourceReference;
  readonly allocationId: string;
  readonly previousQuantity: DecimalAmount;
  readonly newQuantity: DecimalAmount;
  readonly amount: DecimalAmount;
  readonly postingDate: string;
  readonly requestHash: string;
  readonly createdAt: string;
}

/** Cost-owned, non-GL evidence that a real Tourism service milestone actualized program cost. */
export interface TourismServiceActualization {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly costCenterId: CostCenterId;
  readonly program: SourceReference;
  readonly service: SourceReference;
  readonly evidence: SourceReference;
  readonly amount: DecimalAmount;
  readonly postingDate: string;
  readonly requestHash: string;
  readonly createdAt: string;
}
