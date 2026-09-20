import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  HistoricalEquivalence,
  HistoricalImportRecord,
} from "../application/historical-import.application-service.js";
import type { HistoricalImportRepository } from "../application/historical-import.repository.js";
const s = (v: unknown, f = "") => (typeof v === "string" && v ? v : f);
const n = (v: unknown, f = "0") =>
  typeof v === "string" && /^-?\d+(?:\.\d+)?$/.test(v) ? v : f;
const d = (v: unknown) => new Date(s(v, "1970-01-01"));
const o = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const i = (v: unknown, f = 0) =>
  typeof v === "number" && Number.isInteger(v) ? v : f;
const add = (a: string, b: string) => {
  const z = Math.max(
      (a.split(".")[1] ?? "").length,
      (b.split(".")[1] ?? "").length,
    ),
    u = 10n ** BigInt(z),
    p = (v: string) => {
      const q = v.startsWith("-"),
        [w = "0", f = ""] = (q ? v.slice(1) : v).split("."),
        x = BigInt(w) * u + BigInt(f.padEnd(z, "0"));
      return q ? -x : x;
    },
    x = p(a) + p(b),
    q = x < 0n,
    y = q ? -x : x,
    t = y.toString().padStart(z + 1, "0");
  return `${q ? "-" : ""}${z ? `${t.slice(0, -z)}.${t.slice(-z)}` : t}`;
};
export class PrismaHistoricalImportRepository implements HistoricalImportRepository {
  constructor(private readonly db: PrismaClient) {}
  async find(runId: string, collection: string, sourceId: string) {
    const v = await this.db.assetsFinancingHistoricalImport.findUnique({
      where: { runId_collection_sourceId: { runId, collection, sourceId } },
    });
    return v
      ? ({
          ...v,
          owner: "AssetsFinancing",
          payload: v.payload as Record<string, unknown>,
          branchId: v.branchId ?? undefined,
          debit: v.debit.toString(),
          credit: v.credit.toString(),
          amount: v.amount.toString(),
        } as HistoricalImportRecord)
      : undefined;
  }
  async create(r: HistoricalImportRecord) {
    await this.db.$transaction(async (tx) => {
      await this.restore(tx, r);
      await tx.assetsFinancingHistoricalImport.create({
        data: {
          id: r.id,
          runId: r.runId,
          collection: r.collection,
          sourceId: r.sourceId,
          sourcePayloadHash: r.sourcePayloadHash,
          companyId: r.companyId,
          branchId: r.branchId,
          payload: r.payload as object,
          payloadJson: r.payloadJson,
          debit: r.debit,
          credit: r.credit,
          amount: r.amount,
        },
      });
    });
  }
  private async restore(
    tx: Prisma.TransactionClient,
    r: HistoricalImportRecord,
  ) {
    const p = r.payload,
      c = r.collection;
    if (c === "assets")
      await tx.afAsset.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          code: s(p.code, r.sourceId),
          name: s(p.name, r.sourceId),
          description: o(p.description),
          acquisitionValue: n(p.acquisitionValue ?? p.amount),
          baseValue: n(p.baseValue ?? p.amount),
          currency: s(p.currency, "USD"),
          acquisitionDate: d(p.acquisitionDate ?? p.date),
          capitalizationDate: d(p.capitalizationDate ?? p.date),
          inServiceDate: d(p.inServiceDate ?? p.date),
          residualValue: n(p.residualValue),
          usefulLifeMonths: i(p.usefulLifeMonths, 1),
          method: s(p.method, "STRAIGHT_LINE"),
          assetAccountId: s(p.assetAccountId, "historical"),
          capitalizationOffsetAccountId: s(
            p.capitalizationOffsetAccountId,
            "historical",
          ),
          accumulatedDepreciationAccountId: s(
            p.accumulatedDepreciationAccountId,
            "historical",
          ),
          depreciationExpenseAccountId: s(
            p.depreciationExpenseAccountId,
            "historical",
          ),
          disposalGainAccountId: o(p.disposalGainAccountId),
          disposalLossAccountId: o(p.disposalLossAccountId),
          status: s(p.status, "ACTIVE"),
          accumulatedDepreciation: n(p.accumulatedDepreciation),
          capitalizationJournalId: o(p.capitalizationJournalId),
          requestHash: r.sourcePayloadHash,
        },
      });
    else if (c === "depreciationEvents")
      await tx.afAssetDepreciation.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          assetId: s(p.assetId),
          period: i(p.period, 1),
          postingDate: d(p.postingDate ?? p.date),
          amount: n(p.amount),
          status: s(p.status, "POSTED"),
          requestHash: r.sourcePayloadHash,
          journalId: o(p.journalId),
        },
      });
    else if (c === "assetDisposals")
      await tx.afAssetDisposal.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          assetId: s(p.assetId),
          postingDate: d(p.postingDate ?? p.date),
          proceeds: n(p.proceeds ?? p.amount),
          proceedsMode: s(p.proceedsMode, "NONE"),
          treasuryId: o(p.treasuryId),
          proceedsClearingAccountId: o(p.proceedsClearingAccountId),
          requestHash: r.sourcePayloadHash,
          status: s(p.status, "POSTED"),
          treasuryVoucherId: o(p.treasuryVoucherId),
          journalId: o(p.journalId),
        },
      });
    else if (c === "loans")
      await tx.afLoan.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          lenderId: s(p.lenderId),
          reference: s(p.reference, r.sourceId),
          principal: n(p.principal ?? p.amount),
          outstandingPrincipal: n(
            p.outstandingPrincipal ?? p.principal ?? p.amount,
          ),
          currency: s(p.currency, "USD"),
          baseCurrency: s(p.baseCurrency ?? p.currency, "USD"),
          baseAmount: n(p.baseAmount ?? p.amount),
          liabilityAccountId: s(p.liabilityAccountId, "historical"),
          interestExpenseAccountId: s(p.interestExpenseAccountId, "historical"),
          fundingTreasuryId: s(p.fundingTreasuryId, "historical"),
          status: s(p.status, "ACTIVE"),
          requestHash: r.sourcePayloadHash,
          originationTreasuryVoucherId: o(p.originationTreasuryVoucherId),
        },
      });
    else if (c === "loanInstallments")
      await tx.afLoanInstallment.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          loanId: s(p.loanId),
          sequence: i(p.sequence, 1),
          dueDate: d(p.dueDate ?? p.date),
          principal: n(p.principal ?? p.amount),
          interest: n(p.interest),
          status: s(p.status, "DUE"),
          requestHash: r.sourcePayloadHash,
          treasuryVoucherId: o(p.treasuryVoucherId),
          journalId: o(p.journalId),
        },
      });
    else if (c === "provisions")
      await tx.afProvision.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          name: s(p.name, r.sourceId),
          provisionAccountId: s(p.provisionAccountId, "historical"),
          expenseAccountId: s(p.expenseAccountId, "historical"),
          releaseAccountId: s(p.releaseAccountId, "historical"),
          available: n(p.available ?? p.amount),
          requestHash: r.sourcePayloadHash,
        },
      });
    else if (c === "allowances")
      await tx.afAllowance.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          customerId: o(p.customerId),
          sourceReference: s(p.sourceReference, r.sourceId),
          allowanceAccountId: s(p.allowanceAccountId, "historical"),
          expenseAccountId: s(p.expenseAccountId, "historical"),
          releaseAccountId: s(p.releaseAccountId, "historical"),
          amount: n(p.amount),
          used: n(p.used),
          available: n(p.available ?? p.amount),
          requestHash: r.sourcePayloadHash,
        },
      });
    else if (c === "allowanceWriteoffs")
      await tx.afAllowanceWriteoff.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          allowanceId: s(p.allowanceId),
          invoiceId: s(p.invoiceId),
          amount: n(p.amount),
          postingDate: d(p.postingDate ?? p.date),
          requestHash: r.sourcePayloadHash,
          status: s(p.status, "POSTED"),
          billingAdjustmentId: o(p.billingAdjustmentId),
          failureReason: o(p.failureReason),
        },
      });
    else if (c === "payrollAccounting")
      await tx.afPayrollRun.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          sourceId: s(p.sourceId, r.sourceId),
          payrollPeriod: s(p.payrollPeriod, "HISTORICAL"),
          postingDate: d(p.postingDate ?? p.date),
          currency: s(p.currency, "USD"),
          expenseTotal: n(p.expenseTotal ?? p.amount),
          expenseAccountId: s(p.expenseAccountId, "historical"),
          status: s(p.status, "POSTED"),
          requestHash: r.sourcePayloadHash,
          journalId: o(p.journalId),
          treasuryVoucherId: o(p.treasuryVoucherId),
        },
      });
    else
      throw new Error(`unsupported AssetsFinancing historical collection ${c}`);
  }
  async equivalence(
    runId: string,
    companyId: string,
  ): Promise<HistoricalEquivalence> {
    const provenance = await this.db.assetsFinancingHistoricalImport.findMany({
      where: { runId, companyId },
      orderBy: [{ collection: "asc" }, { sourceId: "asc" }],
    });
    const ids = (c: string) =>
      provenance.filter((x) => x.collection === c).map((x) => x.sourceId);
    const groups = await Promise.all([
      this.db.afAsset.findMany({
        where: { companyId, id: { in: ids("assets") } },
      }),
      this.db.afAssetDepreciation.findMany({
        where: { companyId, id: { in: ids("depreciationEvents") } },
      }),
      this.db.afAssetDisposal.findMany({
        where: { companyId, id: { in: ids("assetDisposals") } },
      }),
      this.db.afLoan.findMany({
        where: { companyId, id: { in: ids("loans") } },
      }),
      this.db.afLoanInstallment.findMany({
        where: { companyId, id: { in: ids("loanInstallments") } },
      }),
      this.db.afProvision.findMany({
        where: { companyId, id: { in: ids("provisions") } },
      }),
      this.db.afAllowance.findMany({
        where: { companyId, id: { in: ids("allowances") } },
      }),
      this.db.afAllowanceWriteoff.findMany({
        where: { companyId, id: { in: ids("allowanceWriteoffs") } },
      }),
      this.db.afPayrollRun.findMany({
        where: { companyId, id: { in: ids("payrollAccounting") } },
      }),
    ]);
    const rows = groups
      .flat()
      .map((x) => ({
        value: x,
        amount:
          "amount" in x
            ? x.amount.toString()
            : "principal" in x
              ? x.principal.toString()
              : "expenseTotal" in x
                ? x.expenseTotal.toString()
                : "acquisitionValue" in x
                  ? x.acquisitionValue.toString()
                  : "available" in x
                    ? x.available.toString()
                    : "0",
      }));
    return {
      records: String(rows.length),
      payloadDigest: createHash("sha256")
        .update(
          rows
            .map((x) =>
              JSON.stringify(x, (_, v) =>
                typeof v === "object" && v?.constructor?.name === "Decimal"
                  ? v.toString()
                  : v,
              ),
            )
            .join("\n"),
        )
        .digest("hex"),
      debit: provenance.reduce((a, x) => add(a, x.debit.toString()), "0"),
      credit: provenance.reduce((a, x) => add(a, x.credit.toString()), "0"),
      amount: rows.reduce((a, x) => add(a, x.amount), "0"),
    };
  }
}
