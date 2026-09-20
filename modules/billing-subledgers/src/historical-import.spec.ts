import assert from "node:assert/strict";
import test from "node:test";
import {
  HistoricalImportApplicationService,
  type HistoricalImportRecord,
} from "./application/historical-import.application-service.js";
import { PrismaHistoricalImportRepository } from "./infrastructure/prisma-historical-import.repository.js";
test("owner historical boundary validates exact decimals, persists once, and never posts economic effects", async () => {
  let saved: HistoricalImportRecord | undefined;
  const service = new HistoricalImportApplicationService({
    find: async () => saved,
    create: async (r) => {
      saved = r;
    },
    canonicalRecords: async () => [],
    equivalence: async () => ({
      records: saved ? "1" : "0",
      payloadDigest: "digest",
      debit: saved?.debit ?? "0",
      credit: saved?.credit ?? "0",
      amount: saved?.amount ?? "0",
    }),
  });
  const input = {
    runId: "run",
    collection: "history",
    sourceId: "legacy-1",
    sourcePayloadHash: "a".repeat(64),
    companyId: "company",
    payload: { id: "legacy-1", amount: "9007199254740993.000000000000000001" },
  };
  assert.equal((await service.importHistorical(input)).status, "IMPORTED");
  assert.equal((await service.importHistorical(input)).status, "CONVERGED");
  assert.equal(
    (await service.equivalence("run", "company")).amount,
    "9007199254740993.000000000000000001",
  );
  assert.throws(
    () => service.validate({ ...input, payload: { amount: 1 } }),
    /exact decimal string/,
  );
});


test("AC-14 equivalence reads canonical Billing state rather than provenance amounts", async () => {
  const decimal = (value: string) => ({ toString: () => value });
  const db = {
    billingSubledgersHistoricalImport: {
      findMany: async () => [
        {
          collection: "allocations",
          sourceId: "receipt-1:allocation:1",
          amount: decimal("999999"),
          debit: decimal("888888"),
          credit: decimal("777777"),
        },
      ],
    },
    billingInvoice: { findMany: async () => [] },
    billingAdjustment: { findMany: async () => [] },
    billingAdvance: { findMany: async () => [] },
    billingAllocation: {
      findMany: async () => [
        {
          id: "receipt-1:allocation:1",
          amount: decimal("60"),
          companyId: "company",
        },
      ],
    },
  };
  const repository = new PrismaHistoricalImportRepository(db as never);
  const equivalence = await repository.equivalence("run", "company");
  assert.equal(equivalence.records, "1");
  assert.equal(equivalence.amount, "60");
  assert.equal(equivalence.debit, "0");
  assert.equal(equivalence.credit, "0");
});
