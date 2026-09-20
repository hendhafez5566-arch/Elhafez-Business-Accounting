import assert from "node:assert/strict";
import test from "node:test";
import {
  HistoricalImportApplicationService,
  type HistoricalImportRecord,
} from "./application/historical-import.application-service.js";
test("owner historical boundary validates exact decimals, persists once, and never posts economic effects", async () => {
  let saved: HistoricalImportRecord | undefined;
  const service = new HistoricalImportApplicationService({
    find: async () => saved,
    create: async (r) => {
      saved = r;
    },
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
  await assert.rejects(
    service.importHistorical({
      ...input,
      sourcePayloadHash: "b".repeat(64),
      payload: { id: "legacy-1", amount: "2" },
    }),
    /historical source identity conflict/,
  );
  assert.equal(
    (await service.equivalence("run", "company")).amount,
    "9007199254740993.000000000000000001",
  );
  assert.throws(
    () => service.validate({ ...input, payload: { amount: 1 } }),
    /exact decimal string/,
  );
});
