import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type {
  HistoricalEquivalence,
  HistoricalImportRecord,
} from "../application/historical-import.application-service.js";
import type { HistoricalImportRepository } from "../application/historical-import.repository.js";

const objectRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export class PrismaHistoricalImportRepository implements HistoricalImportRepository {
  constructor(private readonly db: PrismaClient) {}

  async find(runId: string, collection: string, sourceId: string) {
    const value = await this.db.currencyFxHistoricalImport.findUnique({
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
      if (record.collection === "currencies")
        await tx.fxCurrency.create({
          data: {
            companyId: record.companyId,
            code: String(payload.code ?? record.sourceId),
            precision: Number(payload.precision ?? 2),
            isBase: payload.isBase === true,
            status: String(payload.status ?? "ACTIVE"),
          },
        });
      else if (
        record.collection === "fxRates" ||
        record.collection === "exchangeRates"
      )
        await tx.fxRate.create({
          data: {
            id: record.sourceId,
            companyId: record.companyId,
            fromCurrency: String(payload.fromCurrency),
            toCurrency: String(payload.toCurrency),
            effectiveAt: new Date(String(payload.effectiveAt ?? payload.date)),
            rate: String(payload.rate),
            source: String(payload.source ?? "HISTORICAL"),
          },
        });
      else
        throw new Error(
          `unsupported CurrencyFx historical collection ${record.collection}`,
        );

      await tx.currencyFxHistoricalImport.create({
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
    const provenance = await this.db.currencyFxHistoricalImport.findMany({
      where: { runId, companyId },
    });
    const currencyCodes = provenance
      .filter((row) => row.collection === "currencies")
      .map((row) => {
        const payload = objectRecord(row.payload) ? row.payload : {};
        return typeof payload.code === "string" && payload.code
          ? payload.code
          : row.sourceId;
      });
    const rateIds = provenance
      .filter(
        (row) => row.collection === "fxRates" || row.collection === "exchangeRates",
      )
      .map((row) => row.sourceId);

    const [currencies, rates] = await Promise.all([
      this.db.fxCurrency.findMany({
        where: { companyId, code: { in: currencyCodes } },
        orderBy: { code: "asc" },
      }),
      this.db.fxRate.findMany({
        where: { companyId, id: { in: rateIds } },
        orderBy: { id: "asc" },
      }),
    ]);
    const canonical = [...currencies, ...rates]
      .map((row) =>
        JSON.stringify(row, (_, value) =>
          typeof value === "object" && value?.constructor?.name === "Decimal"
            ? value.toString()
            : value,
        ),
      )
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
