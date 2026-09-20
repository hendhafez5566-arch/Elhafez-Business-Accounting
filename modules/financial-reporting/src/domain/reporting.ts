import type { BranchId, CompanyId, CurrencyCode, DecimalAmount, SourceReference } from '@elhafez/contracts';

export type ReportingEvidenceKind =
  | 'GL_LINE'
  | 'BILLING_POSITION'
  | 'TREASURY_ACTIVITY'
  | 'PROGRAM_ACCOUNTING'
  | 'PROCUREMENT_FINANCIAL'
  | 'TAX_FACT';
export type AccountClass = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type PositionKind = 'RECEIVABLE' | 'PAYABLE' | 'CUSTOMER_ADVANCE' | 'SUPPLIER_ADVANCE';

/** Immutable owner-produced fact. This is projection input, never an accounting command. */
export interface ReportingEvidence {
  readonly evidenceId: string;
  readonly companyId: CompanyId;
  readonly branchId?: BranchId;
  readonly occurredAt: string;
  readonly postingDate: string;
  readonly currency: CurrencyCode;
  readonly kind: ReportingEvidenceKind;
  readonly source: SourceReference;
  readonly authoritativeReference: SourceReference;
  readonly amount: DecimalAmount;
  readonly accountId?: string;
  readonly accountClass?: AccountClass;
  readonly partyId?: string;
  readonly positionKind?: PositionKind;
  readonly dueDate?: string;
  readonly openAmount?: DecimalAmount;
  readonly voucherId?: string;
  readonly allocationReferences?: readonly SourceReference[];
  readonly programId?: string;
  readonly costCenterId?: string;
  readonly programDimension?: 'REVENUE' | 'COST';
  readonly operationalEstimate?: DecimalAmount;
  readonly supplierId?: string;
  readonly taxCode?: string;
  readonly taxSnapshotReference?: SourceReference;
  readonly reversesEvidenceId?: string;
}

export interface ReportScope {
  readonly companyId: CompanyId;
  readonly branchIds?: readonly BranchId[];
  readonly companyWide?: boolean;
  readonly from?: string;
  readonly to?: string;
  readonly asOf?: string;
}

export interface ReportMetadata {
  readonly companyId: CompanyId;
  readonly branchScope: readonly BranchId[] | 'COMPANY_WIDE';
  readonly period: Readonly<{ from?: string; to?: string; asOf?: string }>;
  readonly projectionVersion: 1;
  readonly rebuildable: true;
  readonly authoritative: false;
  readonly evidenceIds: readonly string[];
}
