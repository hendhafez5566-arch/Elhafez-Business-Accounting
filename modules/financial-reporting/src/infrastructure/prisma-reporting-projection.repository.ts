import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { ReportingProjectionRepository } from '../application/reporting-projection.repository.js';
import type { ReportingEvidence } from '../domain/reporting.js';

/** Durable but disposable projection adapter. It only reads and writes the fr_ table owned here. */
export class PrismaReportingProjectionRepository implements ReportingProjectionRepository {
  constructor(private readonly db: PrismaClient) {}

  async find(ownerCompanyId: ReportingEvidence['companyId'], evidenceId: string) {
    const row = await this.db.frReportingEvidence.findUnique({ where: { companyId_evidenceId: { companyId: ownerCompanyId, evidenceId } } });
    return row ? decode(row.companyId, row.payload) : undefined;
  }

  async save(evidence: ReportingEvidence): Promise<void> {
    const payload = JSON.stringify(evidence);
    await this.db.frReportingEvidence.create({ data: {
      id: `${evidence.companyId}:${evidence.evidenceId}`,
      companyId: evidence.companyId,
      evidenceId: evidence.evidenceId,
      ...(evidence.branchId ? { branchId: evidence.branchId } : {}),
      kind: evidence.kind,
      postingDate: new Date(`${evidence.postingDate}T00:00:00.000Z`),
      payload,
      payloadHash: hash(payload),
      authoritativeSourceType: evidence.authoritativeReference.sourceType,
      authoritativeSourceId: evidence.authoritativeReference.sourceId,
    } });
  }

  async list(ownerCompanyId: ReportingEvidence['companyId']) {
    const rows = await this.db.frReportingEvidence.findMany({ where: { companyId: ownerCompanyId }, orderBy: [{ postingDate: 'asc' }, { evidenceId: 'asc' }] });
    return rows.map((row) => decode(row.companyId, row.payload));
  }

  async replaceCompany(ownerCompanyId: ReportingEvidence['companyId'], evidence: readonly ReportingEvidence[]): Promise<void> {
    await this.db.$transaction(async (transaction) => {
      await transaction.frReportingEvidence.deleteMany({ where: { companyId: ownerCompanyId } });
      for (const item of evidence) {
        const payload = JSON.stringify(item);
        await transaction.frReportingEvidence.create({ data: { id: `${item.companyId}:${item.evidenceId}`, companyId: item.companyId, evidenceId: item.evidenceId, ...(item.branchId ? { branchId: item.branchId } : {}), kind: item.kind, postingDate: new Date(`${item.postingDate}T00:00:00.000Z`), payload, payloadHash: hash(payload), authoritativeSourceType: item.authoritativeReference.sourceType, authoritativeSourceId: item.authoritativeReference.sourceId } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

function decode(ownerCompanyId: string, payload: string): ReportingEvidence {
  const parsed: unknown = JSON.parse(payload);
  if (!parsed || typeof parsed !== 'object' || !('companyId' in parsed) || parsed.companyId !== ownerCompanyId) throw new Error('corrupt cross-company reporting projection payload');
  return parsed as ReportingEvidence;
}
function hash(payload: string) { return createHash('sha256').update(payload).digest('hex'); }
