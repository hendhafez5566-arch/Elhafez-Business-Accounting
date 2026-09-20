import test from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { branchId, companyId, currencyCode, decimalAmount, sourceReference } from '@elhafez/contracts';
import { FinancialReportingApplicationService } from '../application/financial-reporting.application-service.js';
import type { ReportingEvidence } from '../domain/reporting.js';
import { PrismaReportingProjectionRepository } from './prisma-reporting-projection.repository.js';

type Row = { id: string; companyId: string; evidenceId: string; branchId: string | null; kind: string; postingDate: Date; payload: string; payloadHash: string; authoritativeSourceType: string; authoritativeSourceId: string; createdAt: Date };
function database() {
  const rows = new Map<string, Row>();
  const table = {
    async findUnique(input: { where: { companyId_evidenceId: { companyId: string; evidenceId: string } } }) { return rows.get(`${input.where.companyId_evidenceId.companyId}:${input.where.companyId_evidenceId.evidenceId}`) ?? null; },
    async create(input: { data: Omit<Row, 'createdAt'> & { branchId?: string } }) { const key = `${input.data.companyId}:${input.data.evidenceId}`; if (rows.has(key)) throw Object.assign(new Error('unique'), { code: 'P2002' }); const row = { ...input.data, branchId: input.data.branchId ?? null, createdAt: new Date() }; rows.set(key, row); return row; },
    async findMany(input: { where: { companyId: string } }) { return [...rows.values()].filter((row) => row.companyId === input.where.companyId); },
    async deleteMany(input: { where: { companyId: string } }) { for (const [key, row] of rows) if (row.companyId === input.where.companyId) rows.delete(key); return { count: 0 }; },
  };
  const client = { frReportingEvidence: table, async $transaction(operation: (tx: { frReportingEvidence: typeof table }) => Promise<void>) { return operation({ frReportingEvidence: table }); } } as unknown as PrismaClient;
  return { client, rows };
}
function evidence(id = 'e-1', amount = '1'): ReportingEvidence { return { evidenceId: id, companyId: companyId('company-1'), branchId: branchId('branch-1'), occurredAt: '2026-09-20T00:00:00.000Z', postingDate: '2026-09-20', currency: currencyCode('USD'), kind: 'GL_LINE', source: sourceReference('JOURNAL', 'j-1'), authoritativeReference: sourceReference('JOURNAL_LINE', id), amount: decimalAmount(amount), accountId: 'cash', accountClass: 'ASSET' }; }

test('Prisma projection survives service/repository restart and duplicate delivery converges', async () => { const db = database(); const first = new FinancialReportingApplicationService(new PrismaReportingProjectionRepository(db.client)); await first.ingest(evidence()); const restarted = new FinancialReportingApplicationService(new PrismaReportingProjectionRepository(db.client)); assert.equal((await restarted.ingest(evidence())).status, 'DUPLICATE'); assert.equal((await restarted.trialBalance({ companyId: companyId('company-1'), branchIds: [branchId('branch-1')] })).rows[0]?.amount, '1'); await assert.rejects(restarted.ingest(evidence('e-1', '2')), /conflicting/); });
test('Prisma rebuild replaces only the selected company deterministically', async () => { const db = database(); const service = new FinancialReportingApplicationService(new PrismaReportingProjectionRepository(db.client)); await service.rebuild(companyId('company-1'), [evidence('b', '2'), evidence('a', '1')]); assert.deepEqual((await service.trialBalance({ companyId: companyId('company-1'), companyWide: true })).metadata.evidenceIds, ['a', 'b']); assert.equal(db.rows.size, 2); });
