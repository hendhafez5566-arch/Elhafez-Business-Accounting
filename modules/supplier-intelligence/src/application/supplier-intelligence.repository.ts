/** Supplier Intelligence — Repository port. */
import type { CompanyId, BranchId } from '@elhafez/contracts';
import type {
  SupplierEvaluation,
  SupplierDispute,
  DisputeHistoryEntry,
} from '../domain/supplier-intelligence.types.js';

export interface CreateEvaluationCommand {
  readonly companyId: CompanyId;
  readonly branchId: BranchId;
  readonly supplierPartyId: string;
  readonly qualityScore: number;
  readonly serviceScore: number;
  readonly notes: string | null;
  readonly evaluatedBy: string;
  readonly requestHash: string;
}

export interface CreateDisputeCommand {
  readonly companyId: CompanyId;
  readonly branchId: BranchId;
  readonly supplierPartyId: string;
  readonly severity: string;
  readonly title: string;
  readonly description: string;
  readonly attachmentIds: readonly string[] | null;
  readonly openedBy: string;
  readonly requestHash: string;
}

export interface ResolveDisputeCommand {
  readonly disputeId: string;
  readonly resolvedBy: string;
  readonly resolution: string;
}

export interface CancelDisputeCommand {
  readonly disputeId: string;
  readonly cancelledBy: string;
  readonly cancellationReason: string;
}

export abstract class SupplierIntelligenceRepository {
  abstract saveEvaluation(cmd: CreateEvaluationCommand): Promise<SupplierEvaluation>;
  abstract getEvaluationsBySupplier(
    companyId: CompanyId,
    branchId: BranchId,
    supplierPartyId: string
  ): Promise<readonly SupplierEvaluation[]>;
  abstract saveDispute(cmd: CreateDisputeCommand): Promise<SupplierDispute>;
  abstract getDisputeById(disputeId: string): Promise<SupplierDispute | null>;
  abstract getDisputesBySupplier(
    companyId: CompanyId,
    branchId: BranchId,
    supplierPartyId: string
  ): Promise<readonly SupplierDispute[]>;
  abstract resolveDispute(cmd: ResolveDisputeCommand): Promise<SupplierDispute>;
  abstract cancelDispute(cmd: CancelDisputeCommand): Promise<SupplierDispute>;
  abstract appendDisputeHistory(entry: Omit<DisputeHistoryEntry, 'id'>): Promise<void>;
}

export const SupplierIntelligenceRepositoryToken = Symbol('SupplierIntelligenceRepository');
