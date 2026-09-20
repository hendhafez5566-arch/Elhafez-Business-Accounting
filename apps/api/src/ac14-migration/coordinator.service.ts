import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  MigrationControlApplicationService,
  type AcceptedSourceIdentity,
  type MigrationConfig,
  type MigrationIssueCode,
} from "@elhafez/platform-core";
import { ACCEPTED_LEGACY_SOURCE_IDENTITY } from "./config.js";
import { readRawSnapshot } from "./snapshot-reader.js";
import { AC14_STAGES } from "./stages.js";
import {
  AC14_FROZEN_SOURCE_REGISTRY,
  inspectFrozenSourceCoverage,
  processingRegistration,
  registrationAppliesToRecord,
  type FrozenSourceRegistration,
} from "./source-registry.js";
import {
  AC14_OWNER_IMPORT_GATEWAY,
  type Ac14OwnerImportGateway,
  type EquivalenceValues,
  type HistoricalImportUnit,
} from "./owner-import.gateway.js";
import { assertCompleteGoldenScenarioRegistry } from "./golden-scenario.registry.js";
import {
  LegacyJournalValidationError,
  normalizeLegacyJournal,
} from "./legacy-journal.js";
export interface Ac14ExecutionRequest {
  snapshotPath?: string;
  targetBaselineSha: string;
  implementationVersion: string;
  declaredSourceIdentity: AcceptedSourceIdentity;
  config: MigrationConfig;
  mode: "DRY_RUN" | "EXECUTE" | "RESUME" | "VERIFY";
}
const objectRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : objectRecord(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
const hash = (v: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(v)))
    .digest("hex");
const sourceId = (r: Record<string, unknown>) =>
  typeof r.id === "string" && r.id.trim() ? r.id.trim() : undefined;
@Injectable()
export class Ac14MigrationCoordinator {
  constructor(
    @Inject(MigrationControlApplicationService)
    private readonly control: MigrationControlApplicationService,
    @Inject(AC14_OWNER_IMPORT_GATEWAY)
    private readonly owners: Ac14OwnerImportGateway,
  ) {}
  async run(request: Ac14ExecutionRequest) {
    this.control.validateSourceIdentity(
      request.declaredSourceIdentity,
      ACCEPTED_LEGACY_SOURCE_IDENTITY,
    );
    this.control.validateConfig(request.config);
    if (request.mode === "VERIFY")
      return this.verifyExisting(this.requiredRunId(request.config));
    if (!request.snapshotPath) throw new Error("snapshotPath is required");
    const snapshot = await readRawSnapshot(request.snapshotPath);
    const created = await this.control.createRun({
      ...request.declaredSourceIdentity,
      targetBaselineSha: request.targetBaselineSha,
      implementationVersion: request.implementationVersion,
      mode: request.mode,
      config: request.config,
    });
    await this.control.registerSourceSha256(created.id, snapshot.sha256);
    if (
      request.mode === "RESUME" &&
      created.status !== "PAUSED" &&
      created.status !== "RUNNING" &&
      created.status !== "FAILED"
    )
      throw new Error(
        "resume requires an existing paused, running, or failed run",
      );
    const write = request.mode !== "DRY_RUN";
    if (write && (created.status === "PLANNED" || created.status === "PAUSED"))
      await this.control.transitionRunStatus(created.id, "RUNNING");

    const coverage = inspectFrozenSourceCoverage(snapshot.root);
    let coverageBlocked = false;
    let coveredCollections = 0;
    for (const finding of coverage) {
      if (finding.state === "EMPTY" || finding.state === "MAPPED") {
        coveredCollections++;
        continue;
      }
      coverageBlocked = true;
      await this.issue(
        created.id,
        finding.issueCode ?? "UNSUPPORTED_LEGACY_CONSTRUCT",
        finding.stage ?? "source-preflight",
        finding.sourceCollection,
        null,
        finding.detail ?? "frozen source collection is not safely accounted for",
      );
    }
    if (write)
      await this.control.recordCheckpoint({
        runId: created.id,
        stage: "source-preflight",
        processedCount: coveredCollections,
        status: coverageBlocked ? "FAILED" : "COMPLETE",
      });

    for (const [stage, owner, collections] of AC14_STAGES) {
      if (!owner) continue;
      const prior = await this.control.getCheckpoint(created.id, stage);
      if (write && prior?.status === "COMPLETE") continue;
      let count = prior?.processedCount ?? 0;
      if (write)
        await this.control.recordCheckpoint({
          runId: created.id,
          stage,
          cursor: prior?.cursor,
          processedCount: count,
          status: "IN_PROGRESS",
        });
      for (const collection of collections) {
        const registration = processingRegistration(stage, owner, collection);
        if (
          !registration ||
          registration.disposition !== "PROCESS" ||
          !registration.importKind ||
          !registration.targetKind ||
          !registration.strategy
        ) {
          await this.issue(
            created.id,
            "UNSUPPORTED_LEGACY_CONSTRUCT",
            stage,
            collection,
            null,
            "known non-empty frozen source collection has no executable mapping",
          );
          continue;
        }
        const raw = snapshot.root[collection];
        if (raw === undefined) continue;
        if (!Array.isArray(raw)) {
          await this.issue(
            created.id,
            "UNKNOWN_COLLECTION_SHAPE",
            stage,
            collection,
            null,
            `${collection} must be an array`,
          );
          continue;
        }
        for (const value of raw) {
          if (!objectRecord(value) || !sourceId(value)) {
            await this.issue(
              created.id,
              "SOURCE_IDENTITY_MISMATCH",
              stage,
              collection,
              null,
              "record requires a non-empty string id",
            );
            continue;
          }
          if (!registrationAppliesToRecord(registration, value)) continue;
          const id = sourceId(value)!;
          const branch = this.resolveBranch(value.branchId, request.config);
          if (branch.error) {
            await this.issue(
              created.id,
              branch.error,
              stage,
              collection,
              id,
              "source branch has no explicit target mapping",
            );
            continue;
          }
          let payload = value;
          try {
            if (collection === "journals")
              payload = normalizeLegacyJournal(value) as Record<
                string,
                unknown
              >;
          } catch (error) {
            if (!(error instanceof LegacyJournalValidationError)) throw error;
            await this.issue(
              created.id,
              error.code,
              stage,
              collection,
              id,
              error.message,
            );
            continue;
          }
          const unit: HistoricalImportUnit = {
            runId: created.id,
            stage,
            owner,
            sourceCollection: collection,
            importKind: registration.importKind,
            targetKind: registration.targetKind,
            processingStrategy: registration.strategy,
            sourceId: id,
            sourcePayloadHash: hash(value),
            targetCompanyId: request.config.targetCompanyId,
            ...(branch.target ? { targetBranchId: branch.target } : {}),
            payload,
          };
          try {
            this.owners.validateUnit(unit);
            if (write) {
              const outcome = await this.owners.importUnit(unit);
              if (outcome.status === "REJECTED") {
                await this.issue(
                  created.id,
                  outcome.code,
                  stage,
                  collection,
                  id,
                  outcome.detail,
                );
                continue;
              }
              await this.control.recordCrosswalk({
                runId: created.id,
                sourceCollection: collection,
                sourceId: id,
                targetOwner: owner,
                targetKind: unit.targetKind,
                targetId: outcome.targetId,
                sourcePayloadHash: unit.sourcePayloadHash,
              });
              count++;
              await this.control.recordCheckpoint({
                runId: created.id,
                stage,
                cursor: `${collection}:${id}:${owner}:${unit.targetKind}`,
                processedCount: count,
                status: "IN_PROGRESS",
              });
            }
          } catch (error) {
            await this.issue(
              created.id,
              "UNSUPPORTED_LEGACY_CONSTRUCT",
              stage,
              collection,
              id,
              error instanceof Error
                ? error.message
                : "owner validation failed",
            );
          }
        }
      }
      if (write)
        await this.control.recordCheckpoint({
          runId: created.id,
          stage,
          processedCount: count,
          status: "COMPLETE",
        });
    }
    const evidence = await assertCompleteGoldenScenarioRegistry();
    if (!write) {
      const issues = await this.control.listIssues(created.id);
      await this.control.reconcileRunCounts(created.id, 0, issues.length);
      return this.control.transitionRunStatus(created.id, "DRY_RUN");
    }
    const reporting = await this.owners.rebuildReporting(
      created.id,
      request.config,
    );
    if (reporting.evidenceCount === "0")
      await this.issue(
        created.id,
        "UNSUPPORTED_LEGACY_CONSTRUCT",
        "reporting-rebuild",
        "reporting",
        null,
        "canonical owner state produced no reporting evidence",
      );
    await this.recordOwnerEquivalence(
      created.id,
      request.config.targetCompanyId,
      this.expectedEquivalence(snapshot.root),
    );
    await this.control.recordCheckpoint({
      runId: created.id,
      stage: "golden-scenarios",
      processedCount: evidence.length,
      status: "COMPLETE",
    });
    await this.control.recordCheckpoint({
      runId: created.id,
      stage: "reporting-rebuild",
      processedCount: Number(reporting.evidenceCount),
      status: reporting.evidenceCount === "0" ? "FAILED" : "COMPLETE",
    });
    await this.control.recordCheckpoint({
      runId: created.id,
      stage: "equivalence",
      processedCount: this.owners.ownerNames().length,
      status: "COMPLETE",
    });
    const crosswalks = await this.control.listCrosswalks(created.id),
      issues = await this.control.listIssues(created.id);
    await this.control.reconcileRunCounts(
      created.id,
      crosswalks.length,
      issues.length,
    );
    await this.control.transitionRunStatus(created.id, "VERIFYING");
    return this.readiness(created.id);
  }
  async status(runId: string) {
    return {
      run: await this.control.getRun(runId),
      checkpoints: await this.control.listCheckpoints(runId),
      issues: await this.control.listIssues(runId),
      equivalence: await this.control.listEquivalence(runId),
    };
  }
  private async verifyExisting(runId: string) {
    const run = await this.control.getRun(runId);
    await this.recordOwnerEquivalence(runId, run.targetCompanyId);
    return this.readiness(runId, false);
  }
  private async recordOwnerEquivalence(
    runId: string,
    companyId: string,
    expectedByOwner?: ReadonlyMap<string, EquivalenceValues>,
  ) {
    const prior = await this.control.listEquivalence(runId);
    for (const owner of this.owners.ownerNames()) {
      const actual = await this.owners.ownerEquivalence(
        owner,
        runId,
        companyId,
      );
      const expected =
        expectedByOwner?.get(owner) ??
        Object.fromEntries(
          prior
            .filter((x) => x.scope === owner)
            .map((x) => [x.checkKey, x.expectedValue]),
        );
      for (const key of Object.keys(expected).sort()) {
        const expectedValue = expected[key] ?? "";
        const actualValue = actual[key] ?? "";
        const status = expectedValue === actualValue ? "MATCH" : "MISMATCH";
        await this.control.recordEquivalence({
          runId,
          scope: owner,
          checkKey: key,
          expectedValue,
          actualValue,
          status,
        });
        if (status === "MISMATCH")
          await this.issue(
            runId,
            "EQUIVALENCE_MISMATCH",
            "equivalence",
            owner,
            null,
            `${key} does not match frozen source evidence`,
          );
      }
    }
  }
  private async readiness(runId: string, transition = true) {
    const issues = await this.control.listIssues(runId),
      eq = await this.control.listEquivalence(runId),
      cp = await this.control.listCheckpoints(runId);
    const required = AC14_STAGES.map(([stage]) => stage).filter(
      (stage) => stage !== "source-preflight" && stage !== "cutover-readiness",
    );
    const scopes = new Set(
      eq.filter((x) => x.status === "MATCH").map((x) => x.scope),
    );
    const ready =
      !issues.length &&
      !cp.some((x) => x.status === "FAILED") &&
      scopes.size === this.owners.ownerNames().length &&
      eq.every((x) => x.status === "MATCH") &&
      required.every((s) =>
        cp.some((x) => x.stage === s && x.status === "COMPLETE"),
      ) &&
      cp.some(
        (x) =>
          x.stage === "golden-scenarios" &&
          x.status === "COMPLETE" &&
          x.processedCount === 40,
      ) &&
      cp.some(
        (x) =>
          x.stage === "reporting-rebuild" &&
          x.status === "COMPLETE" &&
          x.processedCount > 0,
      );
    await this.control.recordCheckpoint({
      runId,
      stage: "cutover-readiness",
      processedCount: ready ? 1 : 0,
      status: ready ? "COMPLETE" : "FAILED",
    });
    if (!transition) return { ...(await this.status(runId)), ready };
    return this.control.transitionRunStatus(runId, ready ? "READY" : "FAILED");
  }
  private expectedEquivalence(
    root: Record<string, unknown>,
  ): ReadonlyMap<string, EquivalenceValues> {
    const mutable = new Map<string, Record<string, string>>();
    for (const owner of this.owners.ownerNames())
      mutable.set(owner, { records: "0", debit: "0", credit: "0", amount: "0" });

    for (const registration of AC14_FROZEN_SOURCE_REGISTRY) {
      if (registration.disposition !== "PROCESS" || !registration.owner) continue;
      const value = root[registration.sourceCollection];
      if (!Array.isArray(value)) continue;
      const target = mutable.get(registration.owner);
      if (!target) continue;
      for (const raw of value) {
        if (!objectRecord(raw) || !sourceId(raw)) continue;
        if (!registrationAppliesToRecord(registration, raw)) continue;
        if (registration.strategy === "BILLING_ALLOCATIONS") {
          const allocations = Array.isArray(raw.allocations)
            ? raw.allocations.filter(objectRecord)
            : [];
          target.records = addInteger(target.records ?? "0", allocations.length);
          target.amount = allocations.reduce(
            (sum, allocation) =>
              addDecimal(
                sum,
                decimalFrom(
                  allocation.invoiceAmount ??
                    allocation.amount ??
                    allocation.appliedAmount,
                ),
              ),
            target.amount ?? "0",
          );
          continue;
        }
        target.records = addInteger(target.records ?? "0", 1);
        target.debit = addDecimal(target.debit ?? "0", decimalFrom(raw.debit));
        target.credit = addDecimal(target.credit ?? "0", decimalFrom(raw.credit));
        target.amount = addDecimal(
          target.amount ?? "0",
          expectedAmount(registration, raw),
        );
      }
    }

    const gl = mutable.get("GeneralLedger");
    if (gl) {
      const journalsRaw = root.journals;
      const journals = Array.isArray(journalsRaw)
        ? journalsRaw.filter(objectRecord).map(normalizeLegacyJournal)
        : [];
      const lines = journals.flatMap((journal) =>
        Array.isArray(journal.lines) ? journal.lines.filter(objectRecord) : [],
      );
      gl.debit = lines.reduce(
        (sum, line) => addDecimal(sum, decimalFrom(line.debit)),
        "0",
      );
      gl.credit = lines.reduce(
        (sum, line) => addDecimal(sum, decimalFrom(line.credit)),
        "0",
      );
      gl.amount = "0";
      gl.journalCount = String(journals.length);
      gl.foreignCurrencyEvidence = String(
        lines.filter(
          (line) =>
            typeof line.foreignCurrency === "string" &&
            line.foreignCurrency.length > 0,
        ).length,
      );
      gl.fxRateEvidence = String(
        lines.filter(
          (line) => typeof line.fxRate === "string" && line.fxRate.length > 0,
        ).length,
      );
      gl.reversalLineage = String(
        journals.filter(
          (journal) =>
            journal.kind === "REVERSAL" &&
            typeof journal.reversalSourceId === "string",
        ).length,
      );
    }

    return new Map(
      [...mutable.entries()].map(([owner, values]) => [
        owner,
        Object.freeze({ ...values }),
      ]),
    );
  }
  private requiredRunId(config: MigrationConfig) {
    if (!config.runId) throw new Error("runId is required");
    return config.runId;
  }
  private resolveBranch(
    value: unknown,
    config: MigrationConfig,
  ): { target?: string; error?: MigrationIssueCode } {
    if (value === undefined || value === null || value === "")
      return config.allowUnscopedSourceRecords
        ? {}
        : { error: "MISSING_BRANCH_MAPPING" };
    if (typeof value !== "string" || !config.branchMap[value])
      return { error: "MISSING_BRANCH_MAPPING" };
    return { target: config.branchMap[value] };
  }
  private async issue(
    runId: string,
    code: MigrationIssueCode,
    stage: string,
    collection: string,
    id: string | null,
    detail: string,
  ) {
    const existing = await this.control.listIssues(runId);
    if (
      existing.some(
        (issue) =>
          issue.code === code &&
          issue.stage === stage &&
          issue.sourceCollection === collection &&
          issue.sourceId === id,
      )
    )
      return;
    await this.control.recordIssue({
      runId,
      code,
      stage,
      sourceCollection: collection,
      sourceId: id,
      detail,
    });
  }
}
const decimalFrom = (value: unknown) => {
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value))
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "0";
};
const addInteger = (value: string, increment: number) =>
  String(Number.parseInt(value, 10) + increment);
const expectedAmount = (
  registration: FrozenSourceRegistration,
  payload: Readonly<Record<string, unknown>>,
): string => {
  switch (registration.strategy) {
    case "TAX_CODE":
    case "BANK_RECONCILIATION":
    case "UMRAH_CONTRACT":
    case "UMRAH_SUPPLIER_COMMITMENT":
      return "0";
    case "PREPAID_SCHEDULE":
    case "ACCRUED_REVENUE":
    case "ASSET_DEPRECIATION":
    case "PROVISION":
    case "ALLOWANCE":
    case "PARTY_NETTING":
      return decimalFrom(payload.amount);
    case "DEFERRED_REVENUE":
    case "DEFERRED_COST":
      return decimalFrom(payload.total ?? payload.amount);
    case "FIXED_ASSET":
      return decimalFrom(payload.cost ?? payload.acquisitionValue ?? payload.amount);
    case "LOAN":
      return decimalFrom(payload.principal ?? payload.amount);
    case "LOAN_INSTALLMENT":
      return decimalFrom(payload.principal ?? payload.amount);
    case "PAYROLL_RUN":
      return decimalFrom(payload.gross ?? payload.expenseTotal ?? payload.amount);
    case "BUDGET":
      return decimalFrom(payload.amount);
    case "UMRAH_RESERVATION": {
      const allocation = objectRecord(payload.allocation) ? payload.allocation : {};
      const direct =
        allocation.quantity ??
        allocation.units ??
        allocation.seats ??
        allocation.visas ??
        allocation.pax ??
        payload.quantity;
      if (direct !== undefined) return decimalFrom(direct);
      const rooms = objectRecord(allocation.rooms)
        ? Object.values(allocation.rooms)
        : [];
      return rooms.reduce<string>(
        (sum, value) => addDecimal(sum, decimalFrom(value)),
        "0",
      );
    }
    default:
      return decimalFrom(payload.amount);
  }
};
const addDecimal = (a: string, b: string) => {
  const scale = Math.max(
      (a.split(".")[1] ?? "").length,
      (b.split(".")[1] ?? "").length,
    ),
    unit = 10n ** BigInt(scale);
  const parse = (v: string) => {
    const negative = v.startsWith("-"),
      [whole = "0", fraction = ""] = (negative ? v.slice(1) : v).split("."),
      n = BigInt(whole) * unit + BigInt(fraction.padEnd(scale, "0"));
    return negative ? -n : n;
  };
  const n = parse(a) + parse(b),
    negative = n < 0n,
    absolute = negative ? -n : n,
    text = absolute.toString().padStart(scale + 1, "0");
  return `${negative ? "-" : ""}${scale ? `${text.slice(0, -scale)}.${text.slice(-scale).replace(/0+$/, "")}` : text}`.replace(
    /\.$/,
    "",
  );
};
