import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { MigrationControlApplicationService, type MigrationConfig, type MigrationIssueCode } from '@elhafez/platform-core';
import { ACCEPTED_LEGACY_SOURCE_IDENTITY } from './config.js';
import { readRawSnapshot } from './snapshot-reader.js';
import { AC14_STAGES } from './stages.js';
import { AC14_OWNER_IMPORT_GATEWAY, type Ac14OwnerImportGateway, type HistoricalImportUnit } from './owner-import.gateway.js';
import { assertCompleteGoldenScenarioRegistry } from './golden-scenario.registry.js';
import { LegacyJournalValidationError, normalizeLegacyJournal } from './legacy-journal.js';

export interface Ac14ExecutionRequest {
  snapshotPath: string;
  targetBaselineSha: string;
  implementationVersion: string;
  config: MigrationConfig;
  mode: 'DRY_RUN' | 'EXECUTE' | 'RESUME' | 'VERIFY';
}

const objectRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : objectRecord(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const sourceId = (record: Record<string, unknown>): string | undefined => typeof record.id === 'string' && record.id.trim() ? record.id.trim() : undefined;

@Injectable()
export class Ac14MigrationCoordinator {
  constructor(
    @Inject(MigrationControlApplicationService) private readonly control: MigrationControlApplicationService,
    @Inject(AC14_OWNER_IMPORT_GATEWAY) private readonly owners: Ac14OwnerImportGateway,
  ) {}

  async run(request: Ac14ExecutionRequest) {
    this.control.validateSourceIdentity(ACCEPTED_LEGACY_SOURCE_IDENTITY, ACCEPTED_LEGACY_SOURCE_IDENTITY);
    this.control.validateConfig(request.config);
    const snapshot = await readRawSnapshot(request.snapshotPath);
    const created = await this.control.createRun({ ...ACCEPTED_LEGACY_SOURCE_IDENTITY, targetBaselineSha: request.targetBaselineSha, implementationVersion: request.implementationVersion, mode: request.mode, config: request.config });
    await this.control.registerSourceSha256(created.id, snapshot.sha256);
    if (request.mode === 'DRY_RUN') return this.control.transitionRunStatus(created.id, 'DRY_RUN');
    let run = created.status === 'PLANNED' || created.status === 'DRY_RUN' || created.status === 'PAUSED' ? await this.control.transitionRunStatus(created.id, 'RUNNING') : created;

    for (const [stage, owner, collections] of AC14_STAGES) {
      const prior = await this.control.getCheckpoint(run.id, stage);
      if (prior?.status === 'COMPLETE') continue;
      await this.control.recordCheckpoint({ runId: run.id, stage, cursor: prior?.cursor, processedCount: prior?.processedCount ?? 0, status: 'IN_PROGRESS' });
      if (owner) {
        let count = prior?.processedCount ?? 0;
        for (const collection of collections) {
          const raw = snapshot.root[collection];
          if (raw === undefined) continue;
          if (!Array.isArray(raw)) {
            await this.issue(run.id, 'UNKNOWN_COLLECTION_SHAPE', stage, collection, null, `${collection} must be an array`);
            continue;
          }
          for (const value of raw) {
            if (!objectRecord(value) || !sourceId(value)) {
              await this.issue(run.id, 'SOURCE_IDENTITY_MISMATCH', stage, collection, null, 'record requires a non-empty string id');
              continue;
            }
            const id = sourceId(value)!;
            const branch = this.resolveBranch(value.branchId, request.config);
            if (branch.error) {
              await this.issue(run.id, branch.error, stage, collection, id, 'source branch has no explicit target mapping');
              continue;
            }
            let payload = value;
            try {
              if (collection === 'journals') payload = normalizeLegacyJournal(value) as Record<string, unknown>;
            } catch (error) {
              if (!(error instanceof LegacyJournalValidationError)) throw error;
              await this.issue(run.id, error.code, stage, collection, id, error.message);
              continue;
            }
            const unit: HistoricalImportUnit = { runId: run.id, stage, owner, collection, sourceId: id, sourcePayloadHash: hash(value), targetCompanyId: request.config.targetCompanyId, ...(branch.target ? { targetBranchId: branch.target } : {}), payload };
            const outcome = await this.owners.importUnit(unit);
            if (outcome.status === 'REJECTED') {
              await this.issue(run.id, outcome.code, stage, collection, id, outcome.detail);
              continue;
            }
            await this.control.recordCrosswalk({ runId: run.id, sourceCollection: collection, sourceId: id, targetOwner: owner, targetKind: outcome.targetKind, targetId: outcome.targetId, sourcePayloadHash: unit.sourcePayloadHash });
            count += 1;
            await this.control.recordCheckpoint({ runId: run.id, stage, cursor: `${collection}:${id}`, processedCount: count, status: 'IN_PROGRESS' });
          }
        }
        await this.control.recordCheckpoint({ runId: run.id, stage, cursor: prior?.cursor, processedCount: count, status: 'COMPLETE' });
      } else {
        if (stage === 'equivalence') await this.verify(run.id, request.config);
        if (stage === 'golden-scenarios') assertCompleteGoldenScenarioRegistry();
        await this.control.recordCheckpoint({ runId: run.id, stage, processedCount: 1, status: 'COMPLETE' });
      }
      if (stage === 'reporting-rebuild') await this.owners.rebuildReporting(run.id, request.config);
    }
    const crosswalks = await this.control.listCrosswalks(run.id);
    const issues = await this.control.listIssues(run.id);
    run = await this.control.incrementRunCounts(run.id, crosswalks.length, issues.length);
    run = await this.control.transitionRunStatus(run.id, 'VERIFYING');
    const mismatches = (await this.control.listEquivalence(run.id)).filter((item) => item.status === 'MISMATCH');
    return this.control.transitionRunStatus(run.id, mismatches.length || issues.length ? 'FAILED' : 'READY');
  }

  async status(runId: string) { return { run: await this.control.getRun(runId), checkpoints: await this.control.listCheckpoints(runId), issues: await this.control.listIssues(runId), equivalence: await this.control.listEquivalence(runId) }; }

  private resolveBranch(value: unknown, config: MigrationConfig): { target?: string; error?: MigrationIssueCode } {
    if (value === undefined || value === null || value === '') return config.allowUnscopedSourceRecords ? {} : { error: 'MISSING_BRANCH_MAPPING' };
    if (typeof value !== 'string' || !config.branchMap[value]) return { error: 'MISSING_BRANCH_MAPPING' };
    return { target: config.branchMap[value] };
  }

  private async issue(runId: string, code: MigrationIssueCode, stage: string, collection: string, id: string | null, detail: string) {
    await this.control.recordIssue({ runId, code, stage, sourceCollection: collection, sourceId: id, detail });
  }

  private async verify(runId: string, config: MigrationConfig) {
    const crosswalks = await this.control.listCrosswalks(runId);
    for (const owner of [...new Set(crosswalks.map((item) => item.targetOwner))].sort()) {
      const expected = String(crosswalks.filter((item) => item.targetOwner === owner).length);
      const actual = await this.owners.authoritativeCount(owner, config.targetCompanyId);
      const status = expected === actual ? 'MATCH' : 'MISMATCH';
      await this.control.recordEquivalence({ runId, checkKey: 'authoritative-record-count', scope: owner, expectedValue: expected, actualValue: actual, status });
      if (status === 'MISMATCH') await this.issue(runId, 'EQUIVALENCE_MISMATCH', 'equivalence', owner, null, `authoritative count differs for ${owner}`);
    }
  }
}
