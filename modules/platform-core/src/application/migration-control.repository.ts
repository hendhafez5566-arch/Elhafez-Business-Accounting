import type {
  Id,
  MigrationCheckpoint,
  MigrationCrosswalk,
  MigrationEquivalenceResult,
  MigrationIssue,
  MigrationRun,
} from '../domain/migration-control.types.js';

/**
 * Thrown by an adapter's reserveCrosswalk() ONLY to signal a database
 * uniqueness-constraint collision (e.g. Prisma P2002) — never for any other
 * infrastructure failure (connection loss, permission error, schema error,
 * unrelated driver failure). The application service catches ONLY this type
 * to decide between convergence and MigrationControlError(TARGET_CONFLICT);
 * every other error must propagate unchanged.
 */
export class CrosswalkReservationConflictError extends Error {
  constructor(message = 'a crosswalk uniqueness constraint was violated') {
    super(message);
    this.name = 'CrosswalkReservationConflictError';
  }
}

/**
 * Module-private persistence port for AC-14 migration-control metadata.
 * Kept separate from {@link PlatformCoreRepository} so that adding
 * migration-control persistence never touches the existing platform
 * auth/company/branch repository contract or its adapters.
 */
export interface MigrationControlRepository {
  createRun(run: MigrationRun): Promise<MigrationRun>;
  findRunById(id: Id): Promise<MigrationRun | undefined>;
  listRunsByCompany(targetCompanyId: Id): Promise<readonly MigrationRun[]>;
  updateRun(run: MigrationRun): Promise<MigrationRun>;

  /** Returns the existing crosswalk row if one already exists for this source slot. */
  findCrosswalk(
    runId: Id,
    sourceCollection: string,
    sourceId: string,
    targetOwner: string,
    targetKind: string,
  ): Promise<MigrationCrosswalk | undefined>;
  /** Returns the existing crosswalk row (if any) already claiming this target identity. */
  findCrosswalkByTarget(
    runId: Id,
    targetOwner: string,
    targetKind: string,
    targetId: string,
  ): Promise<MigrationCrosswalk | undefined>;
  /**
   * Atomically reserves a new crosswalk row, relying on the database's own
   * unique constraints for concurrency safety (not an application-level
   * read-then-write race). Must throw {@link CrosswalkReservationConflictError}
   * when — and only when — the failure is a uniqueness-constraint collision
   * (e.g. Prisma P2002). Any other failure (connection loss, permission
   * error, schema error, unrelated driver failure) must propagate as-is.
   */
  reserveCrosswalk(crosswalk: MigrationCrosswalk): Promise<MigrationCrosswalk>;
  listCrosswalksByRun(runId: Id): Promise<readonly MigrationCrosswalk[]>;

  findCheckpoint(runId: Id, stage: string): Promise<MigrationCheckpoint | undefined>;
  upsertCheckpoint(checkpoint: MigrationCheckpoint): Promise<MigrationCheckpoint>;
  listCheckpointsByRun(runId: Id): Promise<readonly MigrationCheckpoint[]>;

  createIssue(issue: MigrationIssue): Promise<MigrationIssue>;
  listIssuesByRun(runId: Id): Promise<readonly MigrationIssue[]>;

  upsertEquivalence(
    result: MigrationEquivalenceResult,
  ): Promise<MigrationEquivalenceResult>;
  listEquivalenceByRun(runId: Id): Promise<readonly MigrationEquivalenceResult[]>;
}

export const MIGRATION_CONTROL_REPOSITORY = Symbol('MIGRATION_CONTROL_REPOSITORY');
