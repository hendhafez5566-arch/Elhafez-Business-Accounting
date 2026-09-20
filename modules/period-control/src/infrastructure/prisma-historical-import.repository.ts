import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type {
  HistoricalEquivalence,
  HistoricalImportRecord,
} from "../application/historical-import.application-service.js";
import type { HistoricalImportRepository } from "../application/historical-import.repository.js";

export class PrismaHistoricalImportRepository implements HistoricalImportRepository {
  constructor(private readonly db: PrismaClient) {}

  async find(runId: string, collection: string, sourceId: string) {
    const value = await this.db.periodControlHistoricalImport.findUnique({
      where: { runId_collection_sourceId: { runId, collection, sourceId } },
    });
    return value
      ? ({
          ...value,
          owner: "historical-owner",
          payload: value.payload as Record<string, unknown>,
          branchId: value.branchId ?? undefined,
          debit: value.debit.toString(),
          credit: value.credit.toString(),
          amount: value.amount.toString(),
        } as HistoricalImportRecord)
      : undefined;
  }

  async create(record: HistoricalImportRecord) {
    await this.db.$transaction(async (tx) => {
      const payload = record.payload;
      if (record.collection === "fiscalYears")
        await tx.periodFiscalYear.create({
          data: {
            id: record.sourceId,
            companyId: record.companyId,
            startDate: new Date(String(payload.startDate)),
            endDate: new Date(String(payload.endDate)),
            status: String(payload.status ?? "OPEN"),
          },
        });
      else if (
        record.collection === "accountingPeriods" ||
        record.collection === "periods"
      )
        await tx.periodAccountingPeriod.create({
          data: {
            id: record.sourceId,
            companyId: record.companyId,
            fiscalYearId: String(payload.fiscalYearId),
            startDate: new Date(String(payload.startDate)),
            endDate: new Date(String(payload.endDate)),
            status: String(payload.status ?? "OPEN"),
          },
        });
      else
        throw new Error(
          `unsupported PeriodControl historical collection ${record.collection}`,
        );

      await tx.periodControlHistoricalImport.create({
        data: {
          id: record.id,
          runId: record.runId,
          collection: record.collection,
          sourceId: record.sourceId,
          sourcePayloadHash: record.sourcePayloadHash,
          companyId: record.companyId,
          branchId: record.branchId,
          payload: record.payload as object,
          payloadJson: record.payloadJson,
          debit: record.debit,
          credit: record.credit,
          amount: record.amount,
        },
      });
    });
  }

  async equivalence(
    runId: string,
    companyId: string,
  ): Promise<HistoricalEquivalence> {
    const provenance = await this.db.periodControlHistoricalImport.findMany({
      where: { runId, companyId },
    });
    const ids = (collection: string) =>
      provenance
        .filter((row) => row.collection === collection)
        .map((row) => row.sourceId);
    const [years, periods] = await Promise.all([
      this.db.periodFiscalYear.findMany({
        where: { companyId, id: { in: ids("fiscalYears") } },
        orderBy: { id: "asc" },
      }),
      this.db.periodAccountingPeriod.findMany({
        where: {
          companyId,
          id: { in: [...ids("accountingPeriods"), ...ids("periods")] },
        },
        orderBy: { id: "asc" },
      }),
    ]);
    const canonical = [...years, ...periods]
      .map((row) => JSON.stringify(row))
      .sort();

    return {
      records: String(canonical.length),
      payloadDigest: createHash("sha256")
        .update(canonical.join("\n"))
        .digest("hex"),
      debit: "0",
      credit: "0",
      amount: "0",
    };
  }
}
