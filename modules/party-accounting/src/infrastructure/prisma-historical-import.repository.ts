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
  const parse = (v: string) => {
    const negative = v.startsWith("-"),
      parts = (negative ? v.slice(1) : v).split("."),
      i = parts[0] ?? "0",
      f = parts[1] ?? "";
    const n =
      BigInt(i) * unit + BigInt((f + "0".repeat(scale)).slice(0, scale));
    return negative ? -n : n;
  };
  const n = parse(a) + parse(b),
    sign = n < 0n ? "-" : "",
    abs = n < 0n ? -n : n,
    s = abs.toString().padStart(scale + 1, "0");
  return scale
    ? `${sign}${s.slice(0, -scale)}.${s.slice(-scale)}`
    : `${sign}${s}`;
};
export class PrismaHistoricalImportRepository implements HistoricalImportRepository {
  constructor(private readonly db: PrismaClient) {}
  async find(runId: string, collection: string, sourceId: string) {
    const v = await this.db.partyAccountingHistoricalImport.findUnique({
      where: { runId_collection_sourceId: { runId, collection, sourceId } },
    });
    return v
      ? ({
          ...v,
          owner: "historical-owner",
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
      const p = r.payload;
      if (r.collection === "partyGroups") {
        await tx.partyAccountingGroup.create({
          data: {
            id: r.sourceId,
            companyId: r.companyId,
            name: String(p.name ?? r.sourceId),
            status: String(p.status ?? "ACTIVE"),
          },
        });
        const members = Array.isArray(p.members) ? p.members : [];
        if (members.length)
          await tx.partyAccountingGroupMember.createMany({
            data: members.map((m, index) => {
              const x = m as Record<string, unknown>;
              return {
                id: String(x.id ?? `${r.sourceId}:member:${index + 1}`),
                companyId: r.companyId,
                groupId: r.sourceId,
                role: String(x.role ?? "MEMBER"),
                partyId: String(x.partyId),
              };
            }),
          });
      } else if (r.collection === "nettings") {
        await tx.partyNettingDocument.create({
          data: {
            id: r.sourceId,
            companyId: r.companyId,
            groupId: String(p.groupId),
            branchId: r.branchId,
            customerInvoiceId: String(p.customerInvoiceId),
            supplierInvoiceId: String(p.supplierInvoiceId),
            amount: String(p.amount ?? "0"),
            postingDate: new Date(String(p.postingDate ?? p.date)),
            number: String(p.number ?? r.sourceId),
            status: String(p.status ?? "POSTED"),
            requestHash: r.sourcePayloadHash,
            requesterActorId: String(p.requesterActorId ?? "historical"),
          },
        });
      } else
        throw new Error(
          `unsupported Party Accounting historical collection ${r.collection}`,
        );
      await tx.partyAccountingHistoricalImport.create({
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
  async equivalence(
    runId: string,
    companyId: string,
  ): Promise<HistoricalEquivalence> {
    const rows = await this.db.partyAccountingHistoricalImport.findMany({
      where: { runId, companyId },
      orderBy: [{ collection: "asc" }, { sourceId: "asc" }],
    });
    const ids = (collection: string) => rows.filter((row) => row.collection === collection).map((row) => row.sourceId);
    const [groups, nettings] = await Promise.all([
      this.db.partyAccountingGroup.findMany({ where: { companyId, id: { in: ids("partyGroups") } }, include: { members: true } }),
      this.db.partyNettingDocument.findMany({ where: { companyId, id: { in: ids("nettings") } }, include: { lines: true, allocationRefs: true } }),
    ]);
    const canonical = [...groups, ...nettings].map((row) => JSON.stringify(row, (_, value) => value?.constructor?.name === "Decimal" ? value.toString() : value)).sort();
    return {
      records: String(canonical.length),
      payloadDigest: createHash("sha256")
        .update(canonical.join("\n"))
        .digest("hex"),
      debit: rows.reduce((a, x) => add(a, x.debit.toString()), "0"),
      credit: rows.reduce((a, x) => add(a, x.credit.toString()), "0"),
      amount: nettings.reduce((a, x) => add(a, x.amount.toString()), "0"),
    };
  }
}
