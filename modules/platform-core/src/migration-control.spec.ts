import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MigrationControlApplicationService,
  MigrationControlError,
  type CreateRunInput,
} from './public/index.js';
import { InMemoryMigrationControlRepository } from './infrastructure/in-memory-migration-control.repository.js';

const ACCEPTED = {
  sourceRepository: 'mhafez300300-byte/Elhafez-Tourism-Offline',
  sourceCommit: 'e97fa6d9cb52acb22b676e1b975c1b2332bc9a13',
  sourceVersion: '32.5.66',
};

const validConfig = () => ({
  targetCompanyId: 'company-1',
  actorId: 'actor-1',
  branchMap: { 'legacy-branch-1': 'target-branch-1' },
  allowUnscopedSourceRecords: false,
});

const service = () => new MigrationControlApplicationService(new InMemoryMigrationControlRepository());

const createRun = (s: MigrationControlApplicationService, overrides: Partial<CreateRunInput> = {}) =>
  s.createRun({
    sourceRepository: ACCEPTED.sourceRepository,
    sourceCommit: ACCEPTED.sourceCommit,
    sourceVersion: ACCEPTED.sourceVersion,
    targetBaselineSha: '9b30440f33a2237f22deaa202028dfabb02c0e2b',
    implementationVersion: 'ac14a-1',
    mode: 'DRY_RUN',
    config: validConfig(),
    ...overrides,
  });

test('source identity is validated against the canonical accepted identity', () => {
  const s = service();
  assert.doesNotThrow(() => s.validateSourceIdentity(ACCEPTED, ACCEPTED));
  assert.throws(
    () => s.validateSourceIdentity({ ...ACCEPTED, sourceCommit: 'wrong-commit' }, ACCEPTED),
    MigrationControlError,
  );
  assert.throws(
    () => s.validateSourceIdentity({ ...ACCEPTED, sourceVersion: '1.0.0' }, ACCEPTED),
    MigrationControlError,
  );
  assert.throws(
    () => s.validateSourceIdentity({ ...ACCEPTED, sourceRepository: 'someone/else' }, ACCEPTED),
    MigrationControlError,
  );
});

test('migration config requires explicit company, actor and branch map', () => {
  const s = service();
  assert.doesNotThrow(() => s.validateConfig(validConfig()));
  assert.throws(() => s.validateConfig({ ...validConfig(), targetCompanyId: '' }), MigrationControlError);
  assert.throws(() => s.validateConfig({ ...validConfig(), actorId: '' }), MigrationControlError);
  assert.throws(
    () => s.validateConfig({ ...validConfig(), branchMap: { 'legacy-1': '' } }),
    MigrationControlError,
  );
  assert.throws(
    () => s.validateConfig({ ...validConfig(), allowUnscopedSourceRecords: undefined as unknown as boolean }),
    MigrationControlError,
  );
});

test('migration run creation is durable and company-scoped', async () => {
  const s = service();
  const run = await createRun(s);
  assert.equal(run.status, 'PLANNED');
  assert.equal((await s.getRun(run.id)).id, run.id);
  const runs = await s.listRunsByCompany('company-1');
  assert.equal(runs.length, 1);
  assert.equal((await s.listRunsByCompany('other-company')).length, 0);
});

test('raw source SHA-256 registration is deterministic and conflicting hashes are rejected', async () => {
  const s = service();
  const run = await createRun(s);
  const updated = await s.registerSourceSha256(run.id, 'a'.repeat(64));
  assert.equal(updated.sourceSha256, 'a'.repeat(64));
  // Same hash replay converges without error.
  await s.registerSourceSha256(run.id, 'a'.repeat(64));
  await assert.rejects(s.registerSourceSha256(run.id, 'b'.repeat(64)), MigrationControlError);
  await assert.rejects(s.registerSourceSha256(run.id, 'not-a-hash'), MigrationControlError);
});

test('run status transitions follow the explicit allowed set only', async () => {
  const s = service();
  const run = await createRun(s);
  const dryRun = await s.transitionRunStatus(run.id, 'DRY_RUN');
  assert.equal(dryRun.status, 'DRY_RUN');
  await assert.rejects(s.transitionRunStatus(run.id, 'READY'), MigrationControlError);
  const running = await s.transitionRunStatus(run.id, 'RUNNING');
  assert.ok(running.startedAt);
});

test('an identical status transition (current === requested) converges idempotently without regressing lifecycle state', async () => {
  const s = service();
  const run = await createRun(s);
  const dryRun = await s.transitionRunStatus(run.id, 'DRY_RUN');
  const dryRunReplay = await s.transitionRunStatus(run.id, 'DRY_RUN');
  assert.equal(dryRunReplay.status, 'DRY_RUN');
  assert.equal(dryRunReplay.updatedAt.getTime(), dryRun.updatedAt.getTime());

  const running = await s.transitionRunStatus(run.id, 'RUNNING');
  const startedAt = running.startedAt;
  const runningReplay = await s.transitionRunStatus(run.id, 'RUNNING');
  assert.equal(runningReplay.status, 'RUNNING');
  assert.equal(runningReplay.startedAt?.getTime(), startedAt?.getTime());

  const ready = await s.transitionRunStatus(run.id, 'VERIFYING').then((r) => s.transitionRunStatus(r.id, 'READY'));
  const readyReplay = await s.transitionRunStatus(run.id, 'READY');
  assert.equal(readyReplay.completedAt?.getTime(), ready.completedAt?.getTime());

  // Backward transitions are still rejected even though forward-to-self converges.
  await assert.rejects(s.transitionRunStatus(run.id, 'RUNNING'), MigrationControlError);
});

test('crosswalk identical replay converges and conflicting replay rejects; source ID == target ID is still recorded', async () => {
  const s = service();
  const run = await createRun(s);
  const input = {
    runId: run.id,
    sourceCollection: 'accounts',
    sourceId: 'acct-1',
    targetOwner: 'general-ledger',
    targetKind: 'Account',
    targetId: 'acct-1',
    sourcePayloadHash: 'hash-1',
  };
  const first = await s.recordCrosswalk(input);
  const replay = await s.recordCrosswalk(input);
  assert.equal(first.id, replay.id);
  await assert.rejects(
    s.recordCrosswalk({ ...input, sourcePayloadHash: 'hash-2' }),
    MigrationControlError,
  );
  await assert.rejects(
    s.recordCrosswalk({ ...input, targetId: 'acct-2' }),
    MigrationControlError,
  );
  const stored = await s.getCrosswalk(run.id, 'accounts', 'acct-1', 'general-ledger', 'Account');
  assert.equal(stored?.targetId, 'acct-1');
});

test('one source can map to two different target owners/kinds simultaneously, but a different source cannot claim the same target', async () => {
  const s = service();
  const run = await createRun(s);
  const treasury = await s.recordCrosswalk({
    runId: run.id,
    sourceCollection: 'payments',
    sourceId: 'pay-1',
    targetOwner: 'treasury',
    targetKind: 'Voucher',
    targetId: 'voucher-1',
    sourcePayloadHash: 'hash-a',
  });
  const billing = await s.recordCrosswalk({
    runId: run.id,
    sourceCollection: 'payments',
    sourceId: 'pay-1',
    targetOwner: 'billing',
    targetKind: 'Allocation',
    targetId: 'alloc-1',
    sourcePayloadHash: 'hash-a',
  });
  assert.notEqual(treasury.id, billing.id);

  await assert.rejects(
    s.recordCrosswalk({
      runId: run.id,
      sourceCollection: 'payments',
      sourceId: 'pay-2',
      targetOwner: 'treasury',
      targetKind: 'Voucher',
      targetId: 'voucher-1',
      sourcePayloadHash: 'hash-b',
    }),
    MigrationControlError,
  );
});

test('concurrent identical crosswalk reservation converges without duplicating', async () => {
  const s = service();
  const run = await createRun(s);
  const input = {
    runId: run.id,
    sourceCollection: 'accounts',
    sourceId: 'acct-9',
    targetOwner: 'general-ledger',
    targetKind: 'Account',
    targetId: 'acct-9',
    sourcePayloadHash: 'hash-9',
  };
  const [a, b] = await Promise.all([s.recordCrosswalk(input), s.recordCrosswalk(input)]);
  assert.equal(a.id, b.id);
  assert.equal((await s.listCrosswalks(run.id)).length, 1);
});

test('crosswalk uniqueness is enforced per run/source collection/source id', async () => {
  const s = service();
  const runA = await createRun(s);
  const runB = await createRun(s, { config: { ...validConfig(), targetCompanyId: 'company-2' } });
  const input = {
    sourceCollection: 'accounts',
    sourceId: 'acct-1',
    targetOwner: 'general-ledger',
    targetKind: 'Account',
    targetId: 'acct-1',
    sourcePayloadHash: 'hash-1',
  };
  await s.recordCrosswalk({ ...input, runId: runA.id });
  // Same source identity under a different run is not a conflict.
  await s.recordCrosswalk({ ...input, runId: runB.id });
  assert.equal((await s.listCrosswalks(runA.id)).length, 1);
  assert.equal((await s.listCrosswalks(runB.id)).length, 1);
});

test('checkpoints persist and resume without forgetting prior progress', async () => {
  const s = service();
  const run = await createRun(s);
  await s.recordCheckpoint({ runId: run.id, stage: 'accounts', processedCount: 10, status: 'IN_PROGRESS' });
  const resumed = await s.recordCheckpoint({
    runId: run.id,
    stage: 'accounts',
    processedCount: 4,
    status: 'IN_PROGRESS',
  });
  // A lower processed count on resume never regresses recorded progress.
  assert.equal(resumed.processedCount, 10);
  const completed = await s.recordCheckpoint({
    runId: run.id,
    stage: 'accounts',
    processedCount: 25,
    status: 'COMPLETE',
  });
  assert.equal(completed.processedCount, 25);
  assert.equal(completed.status, 'COMPLETE');
});

test('checkpoint count and cursor never regress, and COMPLETE cannot regress', async () => {
  const s = service();
  const run = await createRun(s);
  await s.recordCheckpoint({ runId: run.id, stage: 'accounts', processedCount: 10, cursor: 'c10', status: 'IN_PROGRESS' });
  // Equal count with a conflicting cursor must not overwrite the stored cursor.
  const equalConflicting = await s.recordCheckpoint({
    runId: run.id,
    stage: 'accounts',
    processedCount: 10,
    cursor: 'different-cursor',
    status: 'IN_PROGRESS',
  });
  assert.equal(equalConflicting.cursor, 'c10');

  const completed = await s.recordCheckpoint({ runId: run.id, stage: 'accounts', processedCount: 20, cursor: 'c20', status: 'COMPLETE' });
  assert.equal(completed.status, 'COMPLETE');

  // COMPLETE cannot regress to IN_PROGRESS or FAILED.
  await assert.rejects(
    s.recordCheckpoint({ runId: run.id, stage: 'accounts', processedCount: 20, cursor: 'c20', status: 'IN_PROGRESS' }),
    MigrationControlError,
  );
  // Identical COMPLETE replay converges without error.
  const replay = await s.recordCheckpoint({ runId: run.id, stage: 'accounts', processedCount: 20, cursor: 'c20', status: 'COMPLETE' });
  assert.equal(replay.processedCount, 20);
  assert.equal(replay.status, 'COMPLETE');

  await assert.rejects(
    s.recordCheckpoint({ runId: run.id, stage: 'other', processedCount: -1, status: 'IN_PROGRESS' }),
    MigrationControlError,
  );
});

test('recordIssue centrally sanitizes secrets, raw JSON payloads, PII, and overlong detail', async () => {
  const s = service();
  const run = await createRun(s);

  const secretIssue = await s.recordIssue({
    runId: run.id,
    code: 'MISSING_ACCOUNT',
    detail: 'auth failed, password: hunter2, apiKey=abc123',
  });
  assert.ok(!secretIssue.detail?.includes('hunter2'));
  assert.ok(!secretIssue.detail?.includes('abc123'));

  const jsonIssue = await s.recordIssue({
    runId: run.id,
    code: 'MISSING_ACCOUNT',
    detail: JSON.stringify({ ssn: '123-45-6789' }),
  });
  assert.ok(!jsonIssue.detail?.includes('123-45-6789'));

  const piiIssue = await s.recordIssue({
    runId: run.id,
    code: 'MISSING_ACCOUNT',
    detail: 'contact jane@example.com or 555-123-4567 for help',
  });
  assert.ok(!piiIssue.detail?.includes('jane@example.com'));
  assert.ok(!piiIssue.detail?.includes('555-123-4567'));

  const longIssue = await s.recordIssue({
    runId: run.id,
    code: 'MISSING_ACCOUNT',
    detail: 'x'.repeat(2000),
  });
  assert.ok((longIssue.detail?.length ?? 0) < 2000);
});

test('migration issues persist safely with a sanitized taxonomy code', async () => {
  const s = service();
  const run = await createRun(s);
  await s.recordIssue({
    runId: run.id,
    code: 'MISSING_ACCOUNT',
    sourceCollection: 'journals',
    sourceId: 'j-1',
    detail: 'no matching target account for legacy accountId',
  });
  const issues = await s.listIssues(run.id);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code, 'MISSING_ACCOUNT');
});

test('equivalence metadata persists exact string values, not JS Number', async () => {
  const s = service();
  const run = await createRun(s);
  const result = await s.recordEquivalence({
    runId: run.id,
    checkKey: 'gl.total.debit',
    scope: 'EGP',
    expectedValue: '10000.500000000000000000',
    actualValue: '10000.500000000000000000',
    status: 'MATCH',
  });
  assert.equal(typeof result.expectedValue, 'string');
  assert.equal(result.expectedValue, '10000.500000000000000000');
  await assert.rejects(
    s.recordEquivalence({
      runId: run.id,
      checkKey: 'bad',
      expectedValue: 1 as unknown as string,
      actualValue: '1',
      status: 'MATCH',
    }),
    MigrationControlError,
  );
  const listed = await s.listEquivalence(run.id);
  assert.equal(listed.length, 1);
});

test('equivalence with no declared scope normalizes to GLOBAL and stays a single durable row', async () => {
  const s = service();
  const run = await createRun(s);
  const first = await s.recordEquivalence({
    runId: run.id,
    checkKey: 'gl.total.debit',
    expectedValue: '100.00',
    actualValue: '100.00',
    status: 'MATCH',
  });
  assert.equal(first.scope, 'GLOBAL');
  const second = await s.recordEquivalence({
    runId: run.id,
    checkKey: 'gl.total.debit',
    expectedValue: '200.00',
    actualValue: '200.00',
    status: 'MATCH',
  });
  assert.equal(second.id, first.id);
  const listed = await s.listEquivalence(run.id);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.expectedValue, '200.00');
});

test('wrong AC-14 target baseline is rejected and the canonical baseline is accepted; a supplied runId is honored and conflicting reuse rejects', async () => {
  const s = service();
  await assert.rejects(
    createRun(s, { targetBaselineSha: '00883570188764f9791bdc5ecf0de4f2ec510b7a' }),
    MigrationControlError,
  );

  const explicitRunId = 'explicit-run-1';
  const created = await createRun(s, { config: { ...validConfig(), runId: explicitRunId } });
  assert.equal(created.id, explicitRunId);
  // Identical provenance replay with the same runId converges.
  const replay = await createRun(s, { config: { ...validConfig(), runId: explicitRunId } });
  assert.equal(replay.id, explicitRunId);
  // Conflicting reuse of the same runId (different provenance) is rejected.
  await assert.rejects(
    createRun(s, { config: { ...validConfig(), runId: explicitRunId, targetCompanyId: 'other-company' } }),
    MigrationControlError,
  );
});

test('reordered branchMap/config key insertion order produces an identical config snapshot hash', async () => {
  const s = service();
  const runA = await createRun(s, {
    config: {
      targetCompanyId: 'company-1',
      actorId: 'actor-1',
      branchMap: { a: '1', b: '2' },
      allowUnscopedSourceRecords: false,
    },
  });
  const runB = await createRun(s, {
    config: {
      allowUnscopedSourceRecords: false,
      branchMap: { b: '2', a: '1' },
      actorId: 'actor-1',
      targetCompanyId: 'company-1',
    },
  });
  assert.equal(runA.configSnapshotHash, runB.configSnapshotHash);
});

test('a non-uniqueness repository failure during crosswalk reservation is NOT converted to TARGET_CONFLICT', async () => {
  const repo = new InMemoryMigrationControlRepository();
  const originalReserve = repo.reserveCrosswalk.bind(repo);
  let calls = 0;
  repo.reserveCrosswalk = async (c) => {
    calls += 1;
    throw new Error('ECONNREFUSED: simulated database outage');
  };
  const s = new MigrationControlApplicationService(repo);
  const run = await createRun(s);
  await assert.rejects(
    s.recordCrosswalk({
      runId: run.id,
      sourceCollection: 'accounts',
      sourceId: 'acct-x',
      targetOwner: 'general-ledger',
      targetKind: 'Account',
      targetId: 'acct-x',
      sourcePayloadHash: 'hash-x',
    }),
    (error: unknown) => error instanceof Error && !(error instanceof MigrationControlError) && error.message.includes('ECONNREFUSED'),
  );
  assert.equal(calls, 1);
  void originalReserve;
});

test('company isolation holds across unrelated migration runs', async () => {
  const s = service();
  const runA = await createRun(s, { config: { ...validConfig(), targetCompanyId: 'company-a' } });
  const runB = await createRun(s, { config: { ...validConfig(), targetCompanyId: 'company-b' } });
  assert.deepEqual(
    (await s.listRunsByCompany('company-a')).map((r) => r.id),
    [runA.id],
  );
  assert.deepEqual(
    (await s.listRunsByCompany('company-b')).map((r) => r.id),
    [runB.id],
  );
});
