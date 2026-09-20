import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type {
  HistoricalEquivalence,
  HistoricalImportRecord,
} from "../application/historical-import.application-service.js";
import type { HistoricalImportRepository } from "../application/historical-import.repository.js";

const add = (a: string, b: string): string => {
  const scale = Math.max(
    (a.split(".")[1] ?? "").length,
    (b.split(".")[1] ?? "").length,
  );
  const unit = 10n ** BigInt(scale);
  const parse = (value: string) => {
    const negative = value.startsWith("-"),
      parts = (negative ? value.slice(1) : value).split("."),
      whole = parts[0] ?? "0",
      fraction = parts[1] ?? "";
    const parsed =
      BigInt(whole) * unit +
      BigInt((fraction + "0".repeat(scale)).slice(0, scale));
    return negative ? -parsed : parsed;
  };
  const value = parse(a) + parse(b),
    sign = value < 0n ? "-" : "",
    absolute = value < 0n ? -value : value,
    text = absolute.toString().padStart(scale + 1, "0");
  return scale
    ? `${sign}${text.slice(0, -scale)}.${text.slice(-scale)}`
    : `${sign}${text}`;
};

export class PrismaHistoricalImportRepository implements HistoricalImportRepository {
  constructor(private readonly db: PrismaClient) {}

  async find(runId: string, collection: string, sourceId: string) {
    const value = await this.db.costBudgetAccountingHistoricalImport.findUnique({
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
      if (record.collection === "costCenters")
        await tx.cbaCostCenter.create({
          data: {
            id: record.sourceId,
            companyId: record.companyId,
            code: String(payload.code ?? record.sourceId),
            name: String(payload.name ?? record.sourceId),
            status: String(payload.status ?? "ACTIVE"),
            parentId:
              typeof payload.parentId === "string" ? payload.parentId : undefined,
          },
        });
      else if (record.collection === "programCostCenters")
        await tx.cbaProgramCostCenter.create({
          data: {
            companyId: record.companyId,
            sourceType: String(payload.sourceType ?? "PROGRAM"),
            sourceId: String(payload.sourceId ?? record.sourceId),
            costCenterId: String(payload.costCenterId),
          },
        });
      else if (record.collection === "budgets")
        await tx.cbaBudget.create({
          data: {
            id: record.sourceId,
            companyId: record.companyId,
            costCenterId: String(payload.costCenterId),
            periodStart: new Date(String(payload.periodStart ?? payload.startDate)),
            periodEnd: new Date(String(payload.periodEnd ?? payload.endDate)),
            currency: String(payload.currency),
            amount: String(payload.amount),
            status: String(payload.status ?? "ACTIVE"),
            requestHash: record.sourcePayloadHash,
          },
        });
      else
        throw new Error(
          `unsupported CostBudget historical collection ${record.collection}`,
        );

      await tx.costBudgetAccountingHistoricalImport.create({
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
    const provenance = await this.db.costBudgetAccountingHistoricalImport.findMany({
      where: { runId, companyId },
    });
    const ids = (collection: string) =>
      provenance
        .filter((row) => row.collection === collection)
        .map((row) => row.sourceId);
    const [costCenters, budgets] = await Promise.all([
      this.db.cbaCostCenter.findMany({
        where: { companyId, id: { in: ids("costCenters") } },
        orderBy: { id: "asc" },
      }),
      this.db.cbaBudget.findMany({
        where: { companyId, id: { in: ids("budgets") } },
        orderBy: { id: "asc" },
      }),
    ]);
    const canonical = [...costCenters, ...budgets]
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
      amount: budgets.reduce(
        (total, budget) => add(total, budget.amount.toString()),
        "0",
      ),
    };
  }
}
