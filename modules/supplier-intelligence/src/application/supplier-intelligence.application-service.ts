/** Supplier Intelligence — Application service. */
import { Injectable, Inject } from '@nestjs/common';
import type { CompanyId, BranchId } from '@elhafez/contracts';
import type {
  SupplierEvaluation,
  SupplierDispute,
  Supplier360View,
  ProcurementMetrics,
} from '../domain/supplier-intelligence.types.js';
import {
  SupplierIntelligenceRepository,
  SupplierIntelligenceRepositoryToken,
  CreateEvaluationCommand,
  CreateDisputeCommand,
  ResolveDisputeCommand,
  CancelDisputeCommand,
} from './supplier-intelligence.repository.js';

export interface CreateEvaluationInput {
  readonly supplierPartyId: string;
  readonly qualityScore: number;
  readonly serviceScore: number;
  readonly notes?: string | null;
  readonly companyId: CompanyId;
  readonly branchId: BranchId;
  readonly actorId: string;
}

export interface EvaluationView {
  readonly id: string;
  readonly version: number;
  readonly qualityScore: number;
  readonly serviceScore: number;
  readonly notes: string | null;
  readonly evaluatedAt: string;
}

export interface CreateDisputeInput {
  readonly supplierPartyId: string;
  readonly severity: string;
  readonly title: string;
  readonly description: string;
  readonly attachmentIds?: readonly string[] | null;
  readonly companyId: CompanyId;
  readonly branchId: BranchId;
  readonly actorId: string;
}

export interface ResolveDisputeInput {
  readonly disputeId: string;
  readonly resolution: string;
  readonly actorId: string;
}

export interface CancelDisputeInput {
  readonly disputeId: string;
  readonly cancellationReason: string;
  readonly actorId: string;
}

export interface ReleaseHoldInput {
  readonly disputeId: string;
  readonly releaseReason: string;
  readonly actorId: string;
}

export const SUPPLIER_INTELLIGENCE_PERMISSIONS = {
  READ: 'supplier.intelligence.read',
  EVALUATION_MANAGE: 'supplier.evaluation.manage',
  DISPUTE_READ: 'supplier.dispute.read',
  DISPUTE_MANAGE: 'supplier.dispute.manage',
  DISPUTE_RESOLVE: 'supplier.dispute.resolve',
  DISPUTE_RELEASE_HOLD: 'supplier.dispute.release_hold',
} as const;

@Injectable()
export class SupplierIntelligenceApplicationService {
  constructor(
    @Inject(SupplierIntelligenceRepositoryToken)
    private readonly repository: SupplierIntelligenceRepository,
  ) {}

  async createEvaluation(input: CreateEvaluationInput): Promise<SupplierEvaluation> {
    const { supplierPartyId, qualityScore, serviceScore, notes, companyId, branchId, actorId } = input;

    // Validate scores
    if (!this.isValidScore(qualityScore)) {
      throw new Error('qualityScore must be an integer between 1 and 5');
    }
    if (!this.isValidScore(serviceScore)) {
      throw new Error('serviceScore must be an integer between 1 and 5');
    }

    // Get existing evaluations to determine next version
    const existing = await this.repository.getEvaluationsBySupplier(
      companyId,
      branchId,
      supplierPartyId,
    );
    const nextVersion = existing.length > 0 
      ? Math.max(...existing.map(e => e.version)) + 1 
      : 1;

    const cmd: CreateEvaluationCommand = {
      companyId,
      branchId,
      supplierPartyId,
      qualityScore,
      serviceScore,
      notes: notes ?? null,
      evaluatedBy: actorId,
      requestHash: this.computeRequestHash(input),
    };

    return this.repository.saveEvaluation(cmd);
  }

  async getEvaluationsBySupplier(
    companyId: CompanyId,
    branchId: BranchId,
    supplierPartyId: string,
  ): Promise<readonly SupplierEvaluation[]> {
    return this.repository.getEvaluationsBySupplier(companyId, branchId, supplierPartyId);
  }

  async createDispute(input: CreateDisputeInput): Promise<SupplierDispute> {
    const { supplierPartyId, severity, title, description, attachmentIds, companyId, branchId, actorId } = input;

    // Validate severity
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(severity)) {
      throw new Error(`Invalid severity. Must be one of: ${validSeverities.join(', ')}`);
    }

    // Validate required fields
    if (!title || title.trim().length === 0) {
      throw new Error('Title is required');
    }
    if (!description || description.trim().length === 0) {
      throw new Error('Description is required');
    }

    const cmd: CreateDisputeCommand = {
      companyId,
      branchId,
      supplierPartyId,
      severity,
      title: title.trim(),
      description: description.trim(),
      attachmentIds: attachmentIds ?? null,
      openedBy: actorId,
      requestHash: this.computeRequestHash(input),
    };

    return this.repository.saveDispute(cmd);
  }

  async resolveDispute(input: ResolveDisputeInput): Promise<SupplierDispute> {
    const { disputeId, resolution, actorId } = input;

    if (!resolution || resolution.trim().length === 0) {
      throw new Error('Resolution is required');
    }

    const existing = await this.repository.getDisputeById(disputeId);
    if (!existing) {
      throw new Error(`Dispute ${disputeId} not found`);
    }
    if (existing.status !== 'OPEN') {
      throw new Error(`Cannot resolve dispute with status ${existing.status}`);
    }

    const cmd: ResolveDisputeCommand = {
      disputeId,
      resolvedBy: actorId,
      resolution: resolution.trim(),
    };

    return this.repository.resolveDispute(cmd);
  }

  async cancelDispute(input: CancelDisputeInput): Promise<SupplierDispute> {
    const { disputeId, cancellationReason, actorId } = input;

    if (!cancellationReason || cancellationReason.trim().length === 0) {
      throw new Error('Cancellation reason is required');
    }

    const existing = await this.repository.getDisputeById(disputeId);
    if (!existing) {
      throw new Error(`Dispute ${disputeId} not found`);
    }
    if (existing.status !== 'OPEN') {
      throw new Error(`Cannot cancel dispute with status ${existing.status}`);
    }

    const cmd: CancelDisputeCommand = {
      disputeId,
      cancelledBy: actorId,
      cancellationReason: cancellationReason.trim(),
    };

    return this.repository.cancelDispute(cmd);
  }

  async getSupplier360View(
    companyId: CompanyId,
    branchId: BranchId,
    supplierPartyId: string,
  ): Promise<Supplier360View | null> {
    // This is orchestration - would call other modules' public APIs
    // For now, return a basic structure
    const evaluations = await this.repository.getEvaluationsBySupplier(
      companyId,
      branchId,
      supplierPartyId,
    );

    const disputes = await this.repository.getDisputesBySupplier(
      companyId,
      branchId,
      supplierPartyId,
    );

    const latestEvaluation = evaluations.length > 0 
      ? evaluations[evaluations.length - 1] 
      : null;

    return {
      supplierProfile: {
        partyId: supplierPartyId,
        supplierCode: '', // Would come from Supplier Management
        status: '', // Would come from Supplier Management
        approvalStatus: '', // Would come from Supplier Management
        categories: [], // Would come from Supplier Management
      },
      evaluation: {
        latestQualityScore: latestEvaluation?.qualityScore ?? null,
        latestServiceScore: latestEvaluation?.serviceScore ?? null,
        latestNotes: latestEvaluation?.notes ?? null,
        latestEvaluatedAt: latestEvaluation?.evaluatedAt ?? null,
        history: evaluations,
      },
      procurementMetrics: await this.fetchProcurementMetrics(companyId, branchId, supplierPartyId),
      disputes: {
        open: disputes.filter(d => d.status === 'OPEN'),
        history: disputes,
      },
      holds: {
        isHeld: false, // Would come from Supplier Management hold API
        activeHoldReasons: [], // Would come from Supplier Management hold API
      },
    };
  }

  private isValidScore(score: number): boolean {
    return Number.isInteger(score) && score >= 1 && score <= 5;
  }

  private computeRequestHash(input: unknown): string {
    // Deterministic hash for idempotency
    const str = JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private async fetchProcurementMetrics(
    companyId: CompanyId,
    branchId: BranchId,
    supplierPartyId: string,
  ): Promise<ProcurementMetrics> {
    // Would call Procurement Finance / Fulfillment public read APIs
    // Return placeholder for now
    return {
      poCount: 0,
      cancelledPoCount: 0,
      orderedQuantity: '0',
      receivedQuantity: '0',
      completionRatio: null,
      completedPoCount: 0,
      correctionCount: 0,
      onTimeCompletedCount: 0,
      lateCompletedCount: 0,
      unclassifiedTimingCount: 0,
    };
  }
}
