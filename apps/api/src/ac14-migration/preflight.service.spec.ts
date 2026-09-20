import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MigrationControlApplicationService,
  MigrationControlError,
  type MigrationRun,
  type MigrationCrosswalk,
  type MigrationCheckpoint,
  type MigrationIssue,
  type MigrationEquivalenceResult,
} from '@elhafez/platform-core';

type Id = string;
import { Ac14PreflightService } from './preflight.service.js';
import { ACCEPTED_LEGACY_SOURCE_IDENTITY } from './config.js';

/**
 * A minimal fake that is merely structurally compatible with what
 * MigrationControlApplicationService needs at its call sites. It does NOT
 * implement any exported repository type — that port is private
 * infrastructure and is not part of Platform Core's public boundary. This
 * test constructs the service exactly as any other consumer would: via
 * MigrationControlApplicationService, its only supported public entry point.
 */
class FakeMigrationControlRepository {
  runs = new Map<Id, MigrationRun>();
  crosswalks: MigrationCrosswalk[] = [];
  checkpoints: MigrationCheckpoint[] = [];
  issues: MigrationIssue[] = [];
  equivalence: MigrationEquivalenceResult[] = [];

  async createRun(run: MigrationRun) {
    this.runs.set(run.id, run);
    return run;
  }
  async findRunById(id: Id) {
    return this.runs.get(id);
  }
  async listRunsByCompany(targetCompanyId: Id) {
    return [...this.runs.values()].filter((r) => r.targetCompanyId === targetCompanyId);
  }
  async updateRun(run: MigrationRun) {
    this.runs.set(run.id, run);
    return run;
  }
  async findCrosswalk(runId: Id, sourceCollection: string, sourceId: string, targetOwner: string, targetKind: string) {
    return this.crosswalks.find(
      (c) =>
        c.runId === runId &&
        c.sourceCollection === sourceCollection &&
        c.sourceId === sourceId &&
        c.targetOwner === targetOwner &&
        c.targetKind === targetKind,
    );
  }
  async findCrosswalkByTarget(runId: Id, targetOwner: string, targetKind: string, targetId: string) {
    return this.crosswalks.find(
      (c) => c.runId === runId && c.targetOwner === targetOwner && c.targetKind === targetKind && c.targetId === targetId,
    );
  }
  async reserveCrosswalk(c: MigrationCrosswalk) {
    this.crosswalks.push(c);
    return c;
  }
  async listCrosswalksByRun(runId: Id) {
    return this.crosswalks.filter((c) => c.runId === runId);
  }
  async findCheckpoint(runId: Id, stage: string) {
    return this.checkpoints.find((c) => c.runId === runId && c.stage === stage);
  }
  async upsertCheckpoint(c: MigrationCheckpoint) {
    this.checkpoints = this.checkpoints.filter((x) => !(x.runId === c.runId && x.stage === c.stage));
    this.checkpoints.push(c);
    return c;
  }
  async listCheckpointsByRun(runId: Id) {
    return this.checkpoints.filter((c) => c.runId === runId);
  }
  async createIssue(i: MigrationIssue) {
    this.issues.push(i);
    return i;
  }
  async listIssuesByRun(runId: Id) {
    return this.issues.filter((i) => i.runId === runId);
  }
  async upsertEquivalence(e: MigrationEquivalenceResult) {
    this.equivalence = this.equivalence.filter(
      (x) => !(x.runId === e.runId && x.checkKey === e.checkKey && x.scope === e.scope),
    );
    this.equivalence.push(e);
    return e;
  }
  async listEquivalenceByRun(runId: Id) {
    return this.equivalence.filter((e) => e.runId === runId);
  }
}

const validConfig = () => ({
  targetCompanyId: 'company-1',
  actorId: 'actor-1',
  branchMap: { 'legacy-1': 'target-1' },
  allowUnscopedSourceRecords: false,
});

async function withSnapshotFile(contents: string, run: (path: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'ac14a-preflight-'));
  const path = join(dir, 'snapshot.json');
  try {
    await writeFile(path, contents, 'utf8');
    await run(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('dry-run preflight accepts a matching source identity, valid config and structurally valid snapshot', async () => {
  await withSnapshotFile('{"accounts": [], "journals": []}', async (snapshotPath) => {
    const repo = new FakeMigrationControlRepository();
    const service = new Ac14PreflightService(new MigrationControlApplicationService(repo));
    const result = await service.dryRunPreflight({
      declaredSourceIdentity: ACCEPTED_LEGACY_SOURCE_IDENTITY,
      targetBaselineSha: '9b30440f33a2237f22deaa202028dfabb02c0e2b',
      implementationVersion: 'ac14a-1',
      config: validConfig(),
      snapshotPath,
    });
    assert.equal(result.run.status, 'DRY_RUN');
    assert.ok(result.run.sourceSha256);
    assert.deepEqual(result.collectionKeysFound, ['accounts', 'journals']);
  });
});

test('a wrong declared source repository/commit/version is rejected before any run is persisted', async () => {
  await withSnapshotFile('{}', async (snapshotPath) => {
    const repo = new FakeMigrationControlRepository();
    const service = new Ac14PreflightService(new MigrationControlApplicationService(repo));
    await assert.rejects(
      service.dryRunPreflight({
        declaredSourceIdentity: { ...ACCEPTED_LEGACY_SOURCE_IDENTITY, sourceCommit: 'not-the-right-commit' },
        targetBaselineSha: '9b30440f33a2237f22deaa202028dfabb02c0e2b',
        implementationVersion: 'ac14a-1',
        config: validConfig(),
        snapshotPath,
      }),
      MigrationControlError,
    );
    assert.equal(repo.runs.size, 0);
  });
});

test('a wrong target baseline sha is rejected before any run is persisted, and the correct baseline is accepted', async () => {
  await withSnapshotFile('{}', async (snapshotPath) => {
    const repo = new FakeMigrationControlRepository();
    const service = new Ac14PreflightService(new MigrationControlApplicationService(repo));
    // The AC-13 business implementation baseline is a different SHA and must be rejected here.
    await assert.rejects(
      service.dryRunPreflight({
        declaredSourceIdentity: ACCEPTED_LEGACY_SOURCE_IDENTITY,
        targetBaselineSha: '00883570188764f9791bdc5ecf0de4f2ec510b7a',
        implementationVersion: 'ac14a-1',
        config: validConfig(),
        snapshotPath,
      }),
      MigrationControlError,
    );
    assert.equal(repo.runs.size, 0);

    const accepted = await service.dryRunPreflight({
      declaredSourceIdentity: ACCEPTED_LEGACY_SOURCE_IDENTITY,
      targetBaselineSha: '9b30440f33a2237f22deaa202028dfabb02c0e2b',
      implementationVersion: 'ac14a-1',
      config: validConfig(),
      snapshotPath,
    });
    assert.equal(accepted.run.targetBaselineSha, '9b30440f33a2237f22deaa202028dfabb02c0e2b');
  });
});

test('an invalid config (missing branch mapping) is rejected before any run is persisted', async () => {
  await withSnapshotFile('{}', async (snapshotPath) => {
    const repo = new FakeMigrationControlRepository();
    const service = new Ac14PreflightService(new MigrationControlApplicationService(repo));
    await assert.rejects(
      service.dryRunPreflight({
        declaredSourceIdentity: ACCEPTED_LEGACY_SOURCE_IDENTITY,
        targetBaselineSha: '9b30440f33a2237f22deaa202028dfabb02c0e2b',
        implementationVersion: 'ac14a-1',
        config: { ...validConfig(), branchMap: { 'legacy-1': '' } },
        snapshotPath,
      }),
      MigrationControlError,
    );
    assert.equal(repo.runs.size, 0);
  });
});

test('an identical dry-run preflight retry (same runId, source identity, baseline, config, and raw snapshot) converges to the same durable run with no duplicate and no failure', async () => {
  await withSnapshotFile('{"accounts": [], "journals": []}', async (snapshotPath) => {
    const repo = new FakeMigrationControlRepository();
    const service = new Ac14PreflightService(new MigrationControlApplicationService(repo));
    const request = {
      declaredSourceIdentity: ACCEPTED_LEGACY_SOURCE_IDENTITY,
      targetBaselineSha: '9b30440f33a2237f22deaa202028dfabb02c0e2b',
      implementationVersion: 'ac14a-1',
      config: { ...validConfig(), runId: 'retry-run-1' },
      snapshotPath,
    };
    const first = await service.dryRunPreflight(request);
    const second = await service.dryRunPreflight(request);
    assert.equal(first.run.id, second.run.id);
    assert.equal(second.run.status, 'DRY_RUN');
    assert.equal(repo.runs.size, 1);
    assert.deepEqual(second.collectionKeysFound, ['accounts', 'journals']);
  });
});

test('dry-run preflight writes only migration-control metadata: the fake repository records exactly one run and nothing else', async () => {
  await withSnapshotFile('{"accounts": []}', async (snapshotPath) => {
    const repo = new FakeMigrationControlRepository();
    const service = new Ac14PreflightService(new MigrationControlApplicationService(repo));
    await service.dryRunPreflight({
      declaredSourceIdentity: ACCEPTED_LEGACY_SOURCE_IDENTITY,
      targetBaselineSha: '9b30440f33a2237f22deaa202028dfabb02c0e2b',
      implementationVersion: 'ac14a-1',
      config: validConfig(),
      snapshotPath,
    });
    // The fake repository IS the entire persistence surface reachable from this service.
    // Proving it only ever gained one migration run (and no crosswalk/checkpoint/issue/
    // equivalence rows) is, at this boundary, proof that no owner data was touched —
    // this service has no handle to any accounting-owner repository at all.
    assert.equal(repo.runs.size, 1);
    assert.equal(repo.crosswalks.length, 0);
    assert.equal(repo.checkpoints.length, 0);
    assert.equal(repo.issues.length, 0);
    assert.equal(repo.equivalence.length, 0);
  });
});
