import { CrosswalkReservationConflictError } from '../application/migration-control.repository.js';
import type { MigrationControlRepository } from '../application/migration-control.repository.js';
import type {
  Id,
  MigrationCheckpoint,
  MigrationCrosswalk,
  MigrationEquivalenceResult,
  MigrationIssue,
  MigrationRun,
} from '../domain/migration-control.types.js';

/** Test adapter only. Deliberately not registered by PlatformCoreModule. */
export class InMemoryMigrationControlRepository implements MigrationControlRepository {
  runs = new Map<Id, MigrationRun>();
  crosswalks = new Map<Id, MigrationCrosswalk>();
  checkpoints = new Map<Id, MigrationCheckpoint>();
  issues: MigrationIssue[] = [];
  equivalence = new Map<Id, MigrationEquivalenceResult>();

  async createRun(run: MigrationRun): Promise<MigrationRun> {
    this.runs.set(run.id, run);
    return run;
  }
  async findRunById(id: Id): Promise<MigrationRun | undefined> {
    return this.runs.get(id);
  }
  async listRunsByCompany(targetCompanyId: Id): Promise<readonly MigrationRun[]> {
    return [...this.runs.values()].filter((r) => r.targetCompanyId === targetCompanyId);
  }
  async updateRun(run: MigrationRun): Promise<MigrationRun> {
    this.runs.set(run.id, run);
    return run;
  }

  async findCrosswalk(
    runId: Id,
    sourceCollection: string,
    sourceId: string,
    targetOwner: string,
    targetKind: string,
  ): Promise<MigrationCrosswalk | undefined> {
    return [...this.crosswalks.values()].find(
      (c) =>
        c.runId === runId &&
        c.sourceCollection === sourceCollection &&
        c.sourceId === sourceId &&
        c.targetOwner === targetOwner &&
        c.targetKind === targetKind,
    );
  }
  async findCrosswalkByTarget(
    runId: Id,
    targetOwner: string,
    targetKind: string,
    targetId: string,
  ): Promise<MigrationCrosswalk | undefined> {
    return [...this.crosswalks.values()].find(
      (c) => c.runId === runId && c.targetOwner === targetOwner && c.targetKind === targetKind && c.targetId === targetId,
    );
  }
  async reserveCrosswalk(crosswalk: MigrationCrosswalk): Promise<MigrationCrosswalk> {
    // Deliberately no `await` between the uniqueness check and the write below:
    // this mirrors what a real database unique constraint gives you (an
    // atomic check-and-insert) rather than the read-then-write race a plain
    // async check-then-set would introduce for this in-memory test double.
    const existingList = [...this.crosswalks.values()];
    const bySource = existingList.find(
      (c) =>
        c.runId === crosswalk.runId &&
        c.sourceCollection === crosswalk.sourceCollection &&
        c.sourceId === crosswalk.sourceId &&
        c.targetOwner === crosswalk.targetOwner &&
        c.targetKind === crosswalk.targetKind,
    );
    const byTarget = existingList.find(
      (c) =>
        c.runId === crosswalk.runId &&
        c.targetOwner === crosswalk.targetOwner &&
        c.targetKind === crosswalk.targetKind &&
        c.targetId === crosswalk.targetId,
    );
    if (bySource || byTarget) {
      throw new CrosswalkReservationConflictError('simulated unique-constraint collision on crosswalk reservation');
    }
    this.crosswalks.set(crosswalk.id, crosswalk);
    return crosswalk;
  }
  async listCrosswalksByRun(runId: Id): Promise<readonly MigrationCrosswalk[]> {
    return [...this.crosswalks.values()].filter((c) => c.runId === runId);
  }

  async findCheckpoint(runId: Id, stage: string): Promise<MigrationCheckpoint | undefined> {
    return [...this.checkpoints.values()].find((c) => c.runId === runId && c.stage === stage);
  }
  async upsertCheckpoint(checkpoint: MigrationCheckpoint): Promise<MigrationCheckpoint> {
    this.checkpoints.set(checkpoint.id, checkpoint);
    return checkpoint;
  }
  async listCheckpointsByRun(runId: Id): Promise<readonly MigrationCheckpoint[]> {
    return [...this.checkpoints.values()].filter((c) => c.runId === runId);
  }

  async createIssue(issue: MigrationIssue): Promise<MigrationIssue> {
    this.issues.push(issue);
    return issue;
  }
  async listIssuesByRun(runId: Id): Promise<readonly MigrationIssue[]> {
    return this.issues.filter((i) => i.runId === runId);
  }

  async upsertEquivalence(result: MigrationEquivalenceResult): Promise<MigrationEquivalenceResult> {
    const existing = [...this.equivalence.values()].find(
      (e) => e.runId === result.runId && e.checkKey === result.checkKey && e.scope === result.scope,
    );
    const stored = existing ? { ...result, id: existing.id } : result;
    this.equivalence.set(stored.id, stored);
    return stored;
  }
  async listEquivalenceByRun(runId: Id): Promise<readonly MigrationEquivalenceResult[]> {
    return [...this.equivalence.values()].filter((e) => e.runId === runId);
  }
}
