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
    const v = await this.db.tourismContractInventoryHistoricalImport.findUnique(
      { where: { runId_collection_sourceId: { runId, collection, sourceId } } },
    );
    return v
      ? ({
          ...v,
          owner: "TourismContractInventory",
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
      await tx.tourismContractInventoryHistoricalImport.create({
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
    if (c === "tourismContracts") {
      await tx.tciContract.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          type: s(p.type, "HISTORICAL"),
          status: s(p.status, "ACTIVE"),
          supplierId: o(p.supplierId),
          effectiveFrom: d(p.effectiveFrom ?? p.date),
          effectiveTo: d(p.effectiveTo ?? p.date),
          createdAt: d(p.createdAt ?? p.date),
          sourceReference: p.sourceReference as object | undefined,
        },
      });
      await tx.tciContractVersion.create({
        data: {
          id: s(p.versionId, `${r.sourceId}:v1`),
          companyId: r.companyId,
          contractId: r.sourceId,
          versionNumber: i(p.versionNumber, 1),
          effectiveFrom: d(p.effectiveFrom ?? p.date),
          effectiveTo: p.versionEffectiveTo ? d(p.versionEffectiveTo) : null,
          terms: (p.terms ?? {}) as object,
          isCurrent: true,
        },
      });
    } else if (c === "hotelInventory")
      await tx.tciHotelInventory.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          contractId: s(p.contractId),
          hotelId: s(p.hotelId),
          roomId: o(p.roomId),
          serviceDate: d(p.serviceDate ?? p.date),
          contractedQuantity: n(p.contractedQuantity ?? p.quantity),
          allocatedQuantity: n(p.allocatedQuantity),
          availableQuantity: n(p.availableQuantity ?? p.quantity),
          status: s(p.status, "AVAILABLE"),
        },
      });
    else if (c === "flightBlocks")
      await tx.tciFlightBlock.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          contractId: s(p.contractId),
          flightNumber: s(p.flightNumber),
          origin: s(p.origin),
          destination: s(p.destination),
          departureDate: d(p.departureDate ?? p.date),
          totalSeats: n(p.totalSeats ?? p.quantity),
          consumedSeats: n(p.consumedSeats),
          availableSeats: n(p.availableSeats ?? p.quantity),
        },
      });
    else if (c === "transportCapacity")
      await tx.tciTransportCapacity.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          contractId: s(p.contractId),
          vehicleId: s(p.vehicleId),
          capacityUnits: n(p.capacityUnits ?? p.quantity),
          periodStart: d(p.periodStart ?? p.date),
          periodEnd: d(p.periodEnd ?? p.date),
          consumedUnits: n(p.consumedUnits),
        },
      });
    else if (c === "visaQuotas")
      await tx.tciVisaQuota.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          contractId: s(p.contractId),
          visaType: s(p.visaType),
          nationality: o(p.nationality),
          quotaTotal: n(p.quotaTotal ?? p.quantity),
          quotaConsumed: n(p.quotaConsumed),
          quotaRemaining: n(p.quotaRemaining ?? p.quantity),
          effectiveFrom: d(p.effectiveFrom ?? p.date),
          effectiveTo: d(p.effectiveTo ?? p.date),
        },
      });
    else if (c === "stopSales")
      await tx.tciStopSale.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          contractId: s(p.contractId),
          reason: s(p.reason, "HISTORICAL"),
          effectiveFrom: d(p.effectiveFrom ?? p.date),
          effectiveTo: d(p.effectiveTo ?? p.date),
          createdAt: d(p.createdAt ?? p.date),
          isActive: p.isActive !== false,
        },
      });
    else if (["allotments", "inventoryAllocations"].includes(c))
      await tx.tciAllocation.create({
        data: {
          id: r.sourceId,
          companyId: r.companyId,
          contractId: s(p.contractId),
          contractVersionId: s(p.contractVersionId, `${s(p.contractId)}:v1`),
          resourceType: s(p.resourceType, "HISTORICAL"),
          resourceId: s(p.resourceId, r.sourceId),
          program: (p.program ?? {}) as object,
          serviceDate: d(p.serviceDate ?? p.date),
          periodEnd: p.periodEnd ? d(p.periodEnd) : null,
          quantity: n(p.quantity),
          status: s(p.status, "ACTIVE"),
          releaseBlockerReason: o(p.releaseBlockerReason),
          visaBatchKey: o(p.visaBatchKey),
          visaBatchReference: p.visaBatchReference as object | undefined,
          createdAt: d(p.createdAt ?? p.date),
          sourceReference: p.sourceReference as object | undefined,
        },
      });
    else
      throw new Error(
        `unsupported TourismContractInventory historical collection ${c}`,
      );
  }
  async equivalence(
    runId: string,
    companyId: string,
  ): Promise<HistoricalEquivalence> {
    const provenance =
      await this.db.tourismContractInventoryHistoricalImport.findMany({
        where: { runId, companyId },
        orderBy: [{ collection: "asc" }, { sourceId: "asc" }],
      });
    const ids = (c: string) =>
      provenance.filter((x) => x.collection === c).map((x) => x.sourceId);
    const groups = await Promise.all([
      this.db.tciContract.findMany({
        where: { companyId, id: { in: ids("tourismContracts") } },
      }),
      this.db.tciHotelInventory.findMany({
        where: { companyId, id: { in: ids("hotelInventory") } },
      }),
      this.db.tciFlightBlock.findMany({
        where: { companyId, id: { in: ids("flightBlocks") } },
      }),
      this.db.tciTransportCapacity.findMany({
        where: { companyId, id: { in: ids("transportCapacity") } },
      }),
      this.db.tciVisaQuota.findMany({
        where: { companyId, id: { in: ids("visaQuotas") } },
      }),
      this.db.tciStopSale.findMany({
        where: { companyId, id: { in: ids("stopSales") } },
      }),
      this.db.tciAllocation.findMany({
        where: {
          companyId,
          id: { in: [...ids("allotments"), ...ids("inventoryAllocations")] },
        },
      }),
    ]);
    const rows = groups
      .flat()
      .map((x) => ({
        value: x,
        amount:
          "quantity" in x
            ? x.quantity.toString()
            : "contractedQuantity" in x
              ? x.contractedQuantity.toString()
              : "totalSeats" in x
                ? x.totalSeats.toString()
                : "capacityUnits" in x
                  ? x.capacityUnits.toString()
                  : "quotaTotal" in x
                    ? x.quotaTotal.toString()
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
      debit: "0", credit: "0", amount: rows.reduce((a, x) => add(a, x.amount), "0"),
    };
  }
}
