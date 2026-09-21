/** Supplier Intelligence — Domain types. */
import type { CompanyId, BranchId } from '@elhafez/contracts';

export type EvaluationScore = 1 | 2 | 3 | 4 | 5;
export type DisputeSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DisputeStatus = 'OPEN' | 'RESOLVED' | 'CANCELLED';

export interface SupplierEvaluation {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly branchId: BranchId;
  readonly supplierPartyId: string;
  readonly version: number;
  readonly qualityScore: EvaluationScore;
  readonly serviceScore: EvaluationScore;
  readonly notes: string | null;
  readonly evaluatedBy: string;
  readonly evaluatedAt: string;
  readonly requestHash: string;
}

export interface SupplierDispute {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly branchId: BranchId;
  readonly supplierPartyId: string;
  readonly severity: DisputeSeverity;
  readonly title: string;
  readonly description: string;
  readonly attachmentIds: readonly string[] | null;
  readonly openedBy: string;
  readonly openedAt: string;
  readonly status: DisputeStatus;
  readonly requestHash: string;
  readonly resolvedBy: string | null;
  readonly resolvedAt: string | null;
  readonly resolution: string | null;
  readonly cancelledBy: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
}

export interface DisputeHistoryEntry {
  readonly id: string;
  readonly disputeId: string;
  readonly companyId: CompanyId;
  readonly action: string;
  readonly actorId: string;
  readonly actedAt: string;
  readonly metadata: Record<string, unknown> | null;
}

export interface ProcurementMetrics {
  readonly poCount: number;
  readonly cancelledPoCount: number;
  readonly orderedQuantity: string;
  readonly receivedQuantity: string;
  readonly completionRatio: string | null;
  readonly completedPoCount: number;
  readonly correctionCount: number;
  readonly onTimeCompletedCount: number;
  readonly lateCompletedCount: number;
  readonly unclassifiedTimingCount: number;
}

export interface Supplier360View {
  readonly supplierProfile: {
    readonly partyId: string;
    readonly supplierCode: string;
    readonly status: string;
    readonly approvalStatus: string;
    readonly categories: readonly string[];
  };
  readonly evaluation: {
    readonly latestQualityScore: EvaluationScore | null;
    readonly latestServiceScore: EvaluationScore | null;
    readonly latestNotes: string | null;
    readonly latestEvaluatedAt: string | null;
    readonly history: readonly SupplierEvaluation[];
  };
  readonly procurementMetrics: ProcurementMetrics;
  readonly disputes: {
    readonly open: readonly SupplierDispute[];
    readonly history: readonly SupplierDispute[];
  };
  readonly holds: {
    readonly isHeld: boolean;
    readonly activeHoldReasons: readonly string[];
  };
}
