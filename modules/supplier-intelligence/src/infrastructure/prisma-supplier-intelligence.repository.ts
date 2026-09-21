/** Supplier Intelligence — Prisma repository implementation. */
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { CompanyId, BranchId } from '@elhafez/contracts';
import type {
  SupplierEvaluation,
  SupplierDispute,
  DisputeHistoryEntry,
} from '../domain/supplier-intelligence.types.js';
import {
  SupplierIntelligenceRepository,
  CreateEvaluationCommand,
  CreateDisputeCommand,
  ResolveDisputeCommand,
  CancelDisputeCommand,
} from '../application/supplier-intelligence.repository.js';

@Injectable()
export class PrismaSupplierIntelligenceRepository extends SupplierIntelligenceRepository {
  constructor(private prisma: PrismaClient) {
    super();
  }

  async saveEvaluation(cmd: CreateEvaluationCommand): Promise<SupplierEvaluation> {
    const { companyId, branchId, supplierPartyId, qualityScore, serviceScore, notes, evaluatedBy, requestHash } = cmd;

    // Get next version
    const existing = await this.prisma.si_supplier_evaluations.findMany({
      where: {
        company_id: companyId,
        supplier_party_id: supplierPartyId,
      },
      orderBy: { version: 'desc' },
      take: 1,
    });

    const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;

    const created = await this.prisma.si_supplier_evaluations.create({
      data: {
        id: crypto.randomUUID(),
        company_id: companyId,
        branch_id: branchId,
        supplier_party_id: supplierPartyId,
        version: nextVersion,
        quality_score: qualityScore,
        service_score: serviceScore,
        notes,
        evaluated_by: evaluatedBy,
        evaluated_at: new Date().toISOString(),
        request_hash: requestHash,
      },
    });

    return this.mapEvaluation(created);
  }

  async getEvaluationsBySupplier(
    companyId: CompanyId,
    branchId: BranchId,
    supplierPartyId: string,
  ): Promise<readonly SupplierEvaluation[]> {
    const evaluations = await this.prisma.si_supplier_evaluations.findMany({
      where: {
        company_id: companyId,
        branch_id: branchId,
        supplier_party_id: supplierPartyId,
      },
      orderBy: { version: 'asc' },
    });

    return evaluations.map(e => this.mapEvaluation(e));
  }

  async saveDispute(cmd: CreateDisputeCommand): Promise<SupplierDispute> {
    const { companyId, branchId, supplierPartyId, severity, title, description, attachmentIds, openedBy, requestHash } = cmd;

    const created = await this.prisma.si_supplier_disputes.create({
      data: {
        id: crypto.randomUUID(),
        company_id: companyId,
        branch_id: branchId,
        supplier_party_id: supplierPartyId,
        severity,
        title,
        description,
        attachment_ids: attachmentIds ? JSON.stringify(attachmentIds) : null,
        opened_by: openedBy,
        opened_at: new Date().toISOString(),
        status: 'OPEN',
        request_hash: requestHash,
      },
    });

    // Append history entry
    await this.appendDisputeHistory({
      disputeId: created.id,
      companyId,
      action: 'OPENED',
      actorId: openedBy,
      actedAt: created.opened_at,
      metadata: { severity, title, description },
    });

    return this.mapDispute(created);
  }

  async getDisputeById(disputeId: string): Promise<SupplierDispute | null> {
    const dispute = await this.prisma.si_supplier_disputes.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      return null;
    }

    return this.mapDispute(dispute);
  }

  async getDisputesBySupplier(
    companyId: CompanyId,
    branchId: BranchId,
    supplierPartyId: string,
  ): Promise<readonly SupplierDispute[]> {
    const disputes = await this.prisma.si_supplier_disputes.findMany({
      where: {
        company_id: companyId,
        branch_id: branchId,
        supplier_party_id: supplierPartyId,
      },
      orderBy: { opened_at: 'desc' },
    });

    return disputes.map(d => this.mapDispute(d));
  }

  async resolveDispute(cmd: ResolveDisputeCommand): Promise<SupplierDispute> {
    const { disputeId, resolvedBy, resolution } = cmd;

    const updated = await this.prisma.si_supplier_disputes.update({
      where: { id: disputeId },
      data: {
        status: 'RESOLVED',
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
        resolution,
      },
    });

    // Append history entry
    await this.appendDisputeHistory({
      disputeId,
      companyId: updated.company_id,
      action: 'RESOLVED',
      actorId: resolvedBy,
      actedAt: updated.resolved_at!,
      metadata: { resolution },
    });

    return this.mapDispute(updated);
  }

  async cancelDispute(cmd: CancelDisputeCommand): Promise<SupplierDispute> {
    const { disputeId, cancelledBy, cancellationReason } = cmd;

    const updated = await this.prisma.si_supplier_disputes.update({
      where: { id: disputeId },
      data: {
        status: 'CANCELLED',
        cancelled_by: cancelledBy,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason,
      },
    });

    // Append history entry
    await this.appendDisputeHistory({
      disputeId,
      companyId: updated.company_id,
      action: 'CANCELLED',
      actorId: cancelledBy,
      actedAt: updated.cancelled_at!,
      metadata: { cancellationReason },
    });

    return this.mapDispute(updated);
  }

  async appendDisputeHistory(entry: Omit<DisputeHistoryEntry, 'id'>): Promise<void> {
    await this.prisma.si_supplier_dispute_history.create({
      data: {
        id: crypto.randomUUID(),
        dispute_id: entry.disputeId,
        company_id: entry.companyId,
        action: entry.action,
        actor_id: entry.actorId,
        acted_at: entry.actedAt,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    });
  }

  private mapEvaluation(row: any): SupplierEvaluation {
    return {
      id: row.id,
      companyId: row.company_id,
      branchId: row.branch_id,
      supplierPartyId: row.supplier_party_id,
      version: row.version,
      qualityScore: row.quality_score as 1 | 2 | 3 | 4 | 5,
      serviceScore: row.service_score as 1 | 2 | 3 | 4 | 5,
      notes: row.notes,
      evaluatedBy: row.evaluated_by,
      evaluatedAt: row.evaluated_at,
      requestHash: row.request_hash,
    };
  }

  private mapDispute(row: any): SupplierDispute {
    return {
      id: row.id,
      companyId: row.company_id,
      branchId: row.branch_id,
      supplierPartyId: row.supplier_party_id,
      severity: row.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      title: row.title,
      description: row.description,
      attachmentIds: row.attachment_ids ? JSON.parse(row.attachment_ids) : null,
      openedBy: row.opened_by,
      openedAt: row.opened_at,
      status: row.status as 'OPEN' | 'RESOLVED' | 'CANCELLED',
      requestHash: row.request_hash,
      resolvedBy: row.resolved_by ?? null,
      resolvedAt: row.resolved_at ?? null,
      resolution: row.resolution ?? null,
      cancelledBy: row.cancelled_by ?? null,
      cancelledAt: row.cancelled_at ?? null,
      cancellationReason: row.cancellation_reason ?? null,
    };
  }
}
