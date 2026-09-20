import { createHash, randomUUID } from 'node:crypto';
import {
  failMigration,
  GLOBAL_EQUIVALENCE_SCOPE,
  MigrationControlError,
  type Id,
  type MigrationCheckpoint,
  type MigrationCheckpointStatus,
  type MigrationCrosswalk,
  type MigrationEquivalenceResult,
  type MigrationEquivalenceStatus,
  type MigrationIssue,
  type MigrationIssueCode,
  type MigrationMode,
  type MigrationRun,
  type MigrationRunStatus,
} from '../domain/migration-control.types.js';
import { CrosswalkReservationConflictError } from './migration-control.repository.js';
import type { MigrationControlRepository } from './migration-control.repository.js';

const id = (): Id => randomUUID();

/**
 * Recursively sorts object keys so that structurally-equivalent values with
 * different key insertion order produce identical JSON text. Arrays keep
 * their order (order is significant there); only plain-object key order is
 * normalized. No new dependency.
 */
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
};

const stableHash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');

/** The only AC-14 target baseline preflight may accept. See docs/PROJECT_STATE.md for the AC-13 business baseline, which is a different SHA and is not valid here. */
export const AC14_CANONICAL_TARGET_BASELINE_SHA = '9b30440f33a2237f22deaa202028dfabb02c0e2b';

/** Centrally sanitizes free-text issue detail before it is ever persisted. */
const SECRET_KEY_PATTERN =
  /(password|passwordHash|token|accessToken|authorization|cookie|secret|activationKey|apiKey)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(?<!\d)(\+?\d[\d\s().-]{7,}\d)(?!\d)/g;
const MAX_ISSUE_DETAIL_LENGTH = 500;

const looksLikeJsonPayload = (value: string): boolean => {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
};

export const sanitizeIssueDetail = (detail: string | null | undefined): string | null => {
  if (detail === null || detail === undefined) return null;
  let value = detail;
  if (looksLikeJsonPayload(value)) {
    return '[redacted: raw payload not stored]';
  }
  value = value.replace(SECRET_KEY_PATTERN, (_match, key: string) => `${key}: [redacted]`);
  value = value.replace(EMAIL_PATTERN, '[redacted-email]');
  value = value.replace(PHONE_PATTERN, '[redacted-phone]');
  if (value.length > MAX_ISSUE_DETAIL_LENGTH) {
    value = `${value.slice(0, MAX_ISSUE_DETAIL_LENGTH)}…[truncated]`;
  }
  return value;
};

const required = (value: string, field: string): string => {
  if (!value || !value.trim()) failMigration('VALIDATION_ERROR', `${field} is required`, { field });
  return value.trim();
};

/** Statuses a run may legally move between. Kept minimal and explicit. */
const ALLOWED_TRANSITIONS: Record<MigrationRunStatus, readonly MigrationRunStatus[]> = {
  PLANNED: ['DRY_RUN', 'RUNNING', 'FAILED'],
  DRY_RUN: ['RUNNING', 'FAILED'],
  RUNNING: ['PAUSED', 'VERIFYING', 'FAILED'],
  PAUSED: ['RUNNING', 'FAILED'],
  VERIFYING: ['READY', 'FAILED'],
  READY: [],
  FAILED: [],
};

export interface MigrationBranchMap {
  /** Legacy branchId -> target branchId. Empty legacy branchId is handled separately. */
  [legacyBranchId: string]: string;
}

export interface MigrationConfig {
  targetCompanyId: Id;
  actorId: Id;
  branchMap: MigrationBranchMap;
  /** Explicit opt-in to allow legacy records with no branchId to remain unscoped. */
  allowUnscopedSourceRecords: boolean;
  runId?: Id;
}

export interface AcceptedSourceIdentity {
  sourceRepository: string;
  sourceCommit: string;
  sourceVersion: string;
}

export interface CreateRunInput {
  sourceRepository: string;
  sourceCommit: string;
  sourceVersion: string;
  targetBaselineSha: string;
  implementationVersion: string;
  mode: MigrationMode;
  config: MigrationConfig;
}

/**
 * AC-14A migration-control public API.
 *
 * This service owns ONLY operational migration metadata (runs, crosswalk,
 * checkpoints, issues, equivalence results). It has no knowledge of and no
 * dependency on any accounting business module. Historical accounting-owner
 * import execution is implemented in a later AC-14 batch and, when it
 * exists, will call this service plus each owner's own public API — never
 * the other way around.
 */
export class MigrationControlApplicationService {
  constructor(
    private readonly repository: MigrationControlRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Validates a declared source identity against the one canonical accepted identity. */
  validateSourceIdentity(
    declared: AcceptedSourceIdentity,
    accepted: AcceptedSourceIdentity,
  ): void {
    if (
      declared.sourceRepository !== accepted.sourceRepository ||
      declared.sourceCommit !== accepted.sourceCommit ||
      declared.sourceVersion !== accepted.sourceVersion
    ) {
      failMigration(
        'SOURCE_IDENTITY_MISMATCH',
        'declared source identity does not match the accepted canonical legacy identity',
        { declared, accepted },
      );
    }
  }

  /** Validates the narrow AC-14 migration config contract. No automatic branch guessing. */
  validateConfig(config: MigrationConfig): MigrationConfig {
    required(config.targetCompanyId, 'targetCompanyId');
    required(config.actorId, 'actorId');
    if (typeof config.allowUnscopedSourceRecords !== 'boolean') {
      failMigration('VALIDATION_ERROR', 'allowUnscopedSourceRecords must be explicit', {
        field: 'allowUnscopedSourceRecords',
      });
    }
    if (!config.branchMap || typeof config.branchMap !== 'object' || Array.isArray(config.branchMap)) {
      failMigration('VALIDATION_ERROR', 'branchMap must be an explicit object', {
        field: 'branchMap',
      });
    }
    for (const [legacyBranchId, targetBranchId] of Object.entries(config.branchMap)) {
      if (!legacyBranchId.trim() || typeof targetBranchId !== 'string' || !targetBranchId.trim()) {
        failMigration('MISSING_BRANCH_MAPPING', 'every declared branch mapping must be explicit and non-empty', {
          legacyBranchId,
        });
      }
    }
    return config;
  }

  async createRun(input: CreateRunInput): Promise<MigrationRun> {
    const config = this.validateConfig(input.config);
    const targetBaselineSha = required(input.targetBaselineSha, 'targetBaselineSha');
    if (targetBaselineSha !== AC14_CANONICAL_TARGET_BASELINE_SHA) {
      failMigration(
        'VALIDATION_ERROR',
        'targetBaselineSha does not match the canonical AC-14 target baseline',
        { declared: targetBaselineSha, accepted: AC14_CANONICAL_TARGET_BASELINE_SHA },
      );
    }
    const configSnapshotHash = stableHash(config);

    if (input.config.runId) {
      const existing = await this.repository.findRunById(input.config.runId);
      if (existing) {
        const sameProvenance =
          existing.sourceRepository === input.sourceRepository &&
          existing.sourceCommit === input.sourceCommit &&
          existing.sourceVersion === input.sourceVersion &&
          existing.targetBaselineSha === targetBaselineSha &&
          existing.implementationVersion === input.implementationVersion &&
          existing.targetCompanyId === config.targetCompanyId &&
          existing.actorId === config.actorId &&
          existing.mode === input.mode &&
          existing.configSnapshotHash === configSnapshotHash;
        if (!sameProvenance) {
          failMigration('TARGET_CONFLICT', 'runId is already in use by a run with conflicting provenance', {
            runId: input.config.runId,
          });
        }
        return existing;
      }
    }

    const run: MigrationRun = {
      id: input.config.runId ?? id(),
      sourceRepository: required(input.sourceRepository, 'sourceRepository'),
      sourceCommit: required(input.sourceCommit, 'sourceCommit'),
      sourceVersion: required(input.sourceVersion, 'sourceVersion'),
      sourceSha256: null,
      targetBaselineSha,
      implementationVersion: required(input.implementationVersion, 'implementationVersion'),
      targetCompanyId: config.targetCompanyId,
      actorId: config.actorId,
      mode: input.mode,
      status: 'PLANNED',
      configSnapshotHash,
      processedCount: 0,
      rejectedCount: 0,
      startedAt: null,
      completedAt: null,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    return this.repository.createRun(run);
  }

  async getRun(runId: Id): Promise<MigrationRun> {
    return (await this.repository.findRunById(runId)) ?? failMigration('NOT_FOUND', 'migration run was not found', { runId });
  }

  async listRunsByCompany(targetCompanyId: Id): Promise<readonly MigrationRun[]> {
    return this.repository.listRunsByCompany(required(targetCompanyId, 'targetCompanyId'));
  }

  /** Registers the SHA-256 of the RAW source snapshot bytes, hashed before parsing. */
  async registerSourceSha256(runId: Id, sha256: string): Promise<MigrationRun> {
    const run = await this.getRun(runId);
    if (!/^[a-f0-9]{64}$/i.test(sha256)) {
      failMigration('VALIDATION_ERROR', 'sha256 must be a 64-character hex digest', { sha256 });
    }
    if (run.sourceSha256 && run.sourceSha256 !== sha256) {
      failMigration('SOURCE_IDENTITY_MISMATCH', 'a conflicting source hash was already recorded for this run', {
        runId,
        recorded: run.sourceSha256,
        declared: sha256,
      });
    }
    run.sourceSha256 = sha256;
    run.updatedAt = this.now();
    return this.repository.updateRun(run);
  }

  async transitionRunStatus(runId: Id, next: MigrationRunStatus): Promise<MigrationRun> {
    const run = await this.getRun(runId);
    // An identical transition to the CURRENT status is an idempotent replay:
    // converge without rewriting lifecycle timestamps. This never permits a
    // backward transition — only current === requested short-circuits here.
    if (run.status === next) {
      return run;
    }
    const allowed = ALLOWED_TRANSITIONS[run.status] ?? [];
    if (!allowed.includes(next)) {
      failMigration('VALIDATION_ERROR', `run cannot transition from ${run.status} to ${next}`, {
        runId,
        from: run.status,
        to: next,
      });
    }
    run.status = next;
    run.updatedAt = this.now();
    if (next === 'RUNNING' && !run.startedAt) run.startedAt = this.now();
    if (next === 'READY' || next === 'FAILED') run.completedAt = this.now();
    return this.repository.updateRun(run);
  }

  async incrementRunCounts(runId: Id, processed: number, rejected: number): Promise<MigrationRun> {
    const run = await this.getRun(runId);
    run.processedCount += processed;
    run.rejectedCount += rejected;
    run.updatedAt = this.now();
    return this.repository.updateRun(run);
  }

  /**
   * Records (or converges with) a source -> target crosswalk row.
   * Same identity + same payload hash converges (returns the existing row).
   * Same identity + a different payload hash is rejected as a target conflict.
   */
  async recordCrosswalk(input: {
    runId: Id;
    sourceCollection: string;
    sourceId: string;
    targetOwner: string;
    targetKind: string;
    targetId: string;
    sourcePayloadHash: string;
  }): Promise<MigrationCrosswalk> {
    await this.getRun(input.runId);
    const sourceCollection = required(input.sourceCollection, 'sourceCollection');
    const sourceId = required(input.sourceId, 'sourceId');
    const targetOwner = required(input.targetOwner, 'targetOwner');
    const targetKind = required(input.targetKind, 'targetKind');
    const targetId = required(input.targetId, 'targetId');
    const sourcePayloadHash = required(input.sourcePayloadHash, 'sourcePayloadHash');

    const existingBySource = await this.repository.findCrosswalk(
      input.runId,
      sourceCollection,
      sourceId,
      targetOwner,
      targetKind,
    );
    const existingByTarget = await this.repository.findCrosswalkByTarget(
      input.runId,
      targetOwner,
      targetKind,
      targetId,
    );

    if (existingBySource) {
      const sameSlot = existingBySource.sourcePayloadHash === sourcePayloadHash && existingBySource.targetId === targetId;
      if (!sameSlot) {
        failMigration('TARGET_CONFLICT', 'a conflicting crosswalk already exists for this source identity', {
          existing: existingBySource,
          attempted: input,
        });
      }
      return existingBySource;
    }

    if (existingByTarget) {
      // A different source is trying to claim a target identity already owned by another source.
      failMigration('TARGET_CONFLICT', 'this target identity is already claimed by a different source', {
        existing: existingByTarget,
        attempted: input,
      });
    }

    try {
      return await this.repository.reserveCrosswalk({
        id: id(),
        runId: input.runId,
        sourceCollection,
        sourceId,
        targetOwner,
        targetKind,
        targetId,
        sourcePayloadHash,
        createdAt: this.now(),
      });
    } catch (error) {
      // ONLY a database uniqueness-constraint collision may enter the
      // convergence / TARGET_CONFLICT path. Any other infrastructure
      // failure (connection loss, permission error, schema error, unrelated
      // driver failure) must propagate unchanged — it is not a data conflict.
      if (!(error instanceof CrosswalkReservationConflictError)) {
        throw error;
      }
      const concurrentBySource = await this.repository.findCrosswalk(
        input.runId,
        sourceCollection,
        sourceId,
        targetOwner,
        targetKind,
      );
      if (
        concurrentBySource &&
        concurrentBySource.sourcePayloadHash === sourcePayloadHash &&
        concurrentBySource.targetId === targetId
      ) {
        return concurrentBySource;
      }
      return failMigration('TARGET_CONFLICT', 'a conflicting crosswalk reservation was made concurrently', {
        attempted: input,
      });
    }
  }

  async getCrosswalk(
    runId: Id,
    sourceCollection: string,
    sourceId: string,
    targetOwner: string,
    targetKind: string,
  ): Promise<MigrationCrosswalk | undefined> {
    return this.repository.findCrosswalk(runId, sourceCollection, sourceId, targetOwner, targetKind);
  }

  async listCrosswalks(runId: Id): Promise<readonly MigrationCrosswalk[]> {
    return this.repository.listCrosswalksByRun(runId);
  }

  /** Resumable per-stage progress. Idempotent: re-recording the same or a later cursor never loses prior progress. */
  async recordCheckpoint(input: {
    runId: Id;
    stage: string;
    cursor?: string | null;
    processedCount: number;
    status: MigrationCheckpointStatus;
  }): Promise<MigrationCheckpoint> {
    await this.getRun(input.runId);
    if (!Number.isInteger(input.processedCount) || input.processedCount < 0) {
      failMigration('VALIDATION_ERROR', 'processedCount must be a non-negative integer', {
        processedCount: input.processedCount,
      });
    }
    const existing = await this.repository.findCheckpoint(input.runId, input.stage);

    if (existing?.status === 'COMPLETE') {
      // COMPLETE never regresses to IN_PROGRESS/FAILED. An identical COMPLETE replay converges.
      if (
        input.status === 'COMPLETE' &&
        input.processedCount === existing.processedCount &&
        (input.cursor ?? existing.cursor) === existing.cursor
      ) {
        return existing;
      }
      if (input.status !== 'COMPLETE') {
        failMigration('VALIDATION_ERROR', 'a COMPLETE checkpoint cannot regress to IN_PROGRESS or FAILED', {
          runId: input.runId,
          stage: input.stage,
          attempted: input.status,
        });
      }
      // status stays COMPLETE: never allow processedCount to decrease past what's stored.
      if (input.processedCount < existing.processedCount) {
        return existing;
      }
    }

    const existingCount = existing?.processedCount ?? 0;
    const isHigher = input.processedCount > existingCount;
    const isEqual = input.processedCount === existingCount;

    let cursor: string | null;
    if (isHigher) {
      // Only a genuinely higher processedCount may advance the cursor.
      cursor = input.cursor ?? existing?.cursor ?? null;
    } else if (isEqual) {
      // Equal count with a conflicting cursor must not overwrite the stored cursor.
      cursor = existing?.cursor ?? input.cursor ?? null;
    } else {
      // Lower incoming count preserves both the existing count and cursor.
      cursor = existing?.cursor ?? null;
    }

    const checkpoint: MigrationCheckpoint = {
      id: existing?.id ?? id(),
      runId: input.runId,
      stage: required(input.stage, 'stage'),
      cursor,
      processedCount: Math.max(input.processedCount, existingCount),
      status: isHigher || !existing ? input.status : input.status === 'COMPLETE' ? 'COMPLETE' : existing.status,
      updatedAt: this.now(),
    };
    return this.repository.upsertCheckpoint(checkpoint);
  }

  async getCheckpoint(runId: Id, stage: string): Promise<MigrationCheckpoint | undefined> {
    return this.repository.findCheckpoint(runId, stage);
  }

  async listCheckpoints(runId: Id): Promise<readonly MigrationCheckpoint[]> {
    return this.repository.listCheckpointsByRun(runId);
  }

  async recordIssue(input: {
    runId: Id;
    code: MigrationIssueCode;
    stage?: string | null;
    sourceCollection?: string | null;
    sourceId?: string | null;
    detail?: string | null;
  }): Promise<MigrationIssue> {
    await this.getRun(input.runId);
    const issue: MigrationIssue = {
      id: id(),
      runId: input.runId,
      code: input.code,
      stage: input.stage ?? null,
      sourceCollection: input.sourceCollection ?? null,
      sourceId: input.sourceId ?? null,
      detail: sanitizeIssueDetail(input.detail),
      createdAt: this.now(),
    };
    return this.repository.createIssue(issue);
  }

  async listIssues(runId: Id): Promise<readonly MigrationIssue[]> {
    return this.repository.listIssuesByRun(runId);
  }

  /** Stores an equivalence comparison result. Values are exact strings — never JS Number. */
  async recordEquivalence(input: {
    runId: Id;
    checkKey: string;
    scope?: string | null;
    expectedValue: string;
    actualValue: string;
    status: MigrationEquivalenceStatus;
    detail?: string | null;
  }): Promise<MigrationEquivalenceResult> {
    await this.getRun(input.runId);
    if (typeof input.expectedValue !== 'string' || typeof input.actualValue !== 'string') {
      failMigration('VALIDATION_ERROR', 'equivalence values must be exact strings', { input });
    }
    const scope = input.scope && input.scope.trim() ? input.scope.trim() : GLOBAL_EQUIVALENCE_SCOPE;
    const result: MigrationEquivalenceResult = {
      id: id(),
      runId: input.runId,
      checkKey: required(input.checkKey, 'checkKey'),
      scope,
      expectedValue: input.expectedValue,
      actualValue: input.actualValue,
      status: input.status,
      detail: input.detail ?? null,
      checkedAt: this.now(),
    };
    return this.repository.upsertEquivalence(result);
  }

  async listEquivalence(runId: Id): Promise<readonly MigrationEquivalenceResult[]> {
    return this.repository.listEquivalenceByRun(runId);
  }

  toError(error: unknown): { status: number; body: { code: string; message: string; details?: Record<string, unknown> } } {
    if (error instanceof MigrationControlError) {
      const status =
        error.code === 'VALIDATION_ERROR' ||
        error.code === 'MISSING_BRANCH_MAPPING' ||
        error.code === 'MISSING_COMPANY_MAPPING'
          ? 400
          : error.code === 'NOT_FOUND'
            ? 404
            : error.code === 'TARGET_CONFLICT' || error.code === 'SOURCE_IDENTITY_MISMATCH'
              ? 409
              : 422;
      return { status, body: { code: error.code, message: error.message, details: error.details } };
    }
    return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'an unexpected error occurred' } };
  }
}
