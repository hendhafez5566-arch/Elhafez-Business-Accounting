import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
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

const run = (x: {
  id: string;
  sourceRepository: string;
  sourceCommit: string;
  sourceVersion: string;
  sourceSha256: string | null;
  targetBaselineSha: string;
  implementationVersion: string;
  targetCompanyId: string;
  actorId: string;
  mode: string;
  status: string;
  configSnapshotHash: string;
  processedCount: number;
  rejectedCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MigrationRun => ({ ...x, mode: x.mode as MigrationRun['mode'], status: x.status as MigrationRun['status'] });

/** PostgreSQL adapter for AC-14 migration-control metadata. Platform Core owns and is the only writer of these tables. */
export class PrismaMigrationControlRepository implements MigrationControlRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createRun(x: MigrationRun): Promise<MigrationRun> {
    return run(await this.prisma.pcMigrationRun.create({ data: x }));
  }
  async findRunById(id: Id): Promise<MigrationRun | undefined> {
    const x = await this.prisma.pcMigrationRun.findUnique({ where: { id } });
    return x ? run(x) : undefined;
  }
  async listRunsByCompany(targetCompanyId: Id): Promise<readonly MigrationRun[]> {
    return (
      await this.prisma.pcMigrationRun.findMany({
        where: { targetCompanyId },
        orderBy: { createdAt: 'asc' },
      })
    ).map(run);
  }
  async updateRun(x: MigrationRun): Promise<MigrationRun> {
    return run(
      await this.prisma.pcMigrationRun.update({
        where: { id: x.id },
        data: {
          sourceSha256: x.sourceSha256,
          status: x.status,
          processedCount: x.processedCount,
          rejectedCount: x.rejectedCount,
          startedAt: x.startedAt,
          completedAt: x.completedAt,
          updatedAt: x.updatedAt,
        },
      }),
    );
  }

  async findCrosswalk(
    runId: Id,
    sourceCollection: string,
    sourceId: string,
    targetOwner: string,
    targetKind: string,
  ): Promise<MigrationCrosswalk | undefined> {
    const x = await this.prisma.pcMigrationCrosswalk.findUnique({
      where: {
        runId_sourceCollection_sourceId_targetOwner_targetKind: {
          runId,
          sourceCollection,
          sourceId,
          targetOwner,
          targetKind,
        },
      },
    });
    return x ?? undefined;
  }
  async findCrosswalkByTarget(
    runId: Id,
    targetOwner: string,
    targetKind: string,
    targetId: string,
  ): Promise<MigrationCrosswalk | undefined> {
    const x = await this.prisma.pcMigrationCrosswalk.findUnique({
      where: { runId_targetOwner_targetKind_targetId: { runId, targetOwner, targetKind, targetId } },
    });
    return x ?? undefined;
  }
  /**
   * Relies solely on the database's own unique constraints for concurrency
   * safety: a concurrent conflicting reservation throws (Prisma P2002).
   * ONLY P2002 (unique constraint violation) is translated into
   * {@link CrosswalkReservationConflictError} for the application layer to
   * interpret as convergence/TARGET_CONFLICT. Every other Prisma or
   * connection failure is rethrown unchanged — it is an infrastructure
   * failure, not a migration data conflict.
   */
  async reserveCrosswalk(x: MigrationCrosswalk): Promise<MigrationCrosswalk> {
    try {
      return await this.prisma.pcMigrationCrosswalk.create({ data: x });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new CrosswalkReservationConflictError();
      }
      throw error;
    }
  }
  async listCrosswalksByRun(runId: Id): Promise<readonly MigrationCrosswalk[]> {
    return this.prisma.pcMigrationCrosswalk.findMany({ where: { runId }, orderBy: { createdAt: 'asc' } });
  }

  async findCheckpoint(runId: Id, stage: string): Promise<MigrationCheckpoint | undefined> {
    const x = await this.prisma.pcMigrationCheckpoint.findUnique({ where: { runId_stage: { runId, stage } } });
    return x ? { ...x, status: x.status as MigrationCheckpoint['status'] } : undefined;
  }
  async upsertCheckpoint(x: MigrationCheckpoint): Promise<MigrationCheckpoint> {
    const saved = await this.prisma.pcMigrationCheckpoint.upsert({
      where: { runId_stage: { runId: x.runId, stage: x.stage } },
      create: x,
      update: { cursor: x.cursor, processedCount: x.processedCount, status: x.status, updatedAt: x.updatedAt },
    });
    return { ...saved, status: saved.status as MigrationCheckpoint['status'] };
  }
  async listCheckpointsByRun(runId: Id): Promise<readonly MigrationCheckpoint[]> {
    return (
      await this.prisma.pcMigrationCheckpoint.findMany({ where: { runId }, orderBy: { stage: 'asc' } })
    ).map((x) => ({ ...x, status: x.status as MigrationCheckpoint['status'] }));
  }

  async createIssue(x: MigrationIssue): Promise<MigrationIssue> {
    const saved = await this.prisma.pcMigrationIssue.create({ data: x });
    return { ...saved, code: saved.code as MigrationIssue['code'] };
  }
  async listIssuesByRun(runId: Id): Promise<readonly MigrationIssue[]> {
    return (
      await this.prisma.pcMigrationIssue.findMany({ where: { runId }, orderBy: { createdAt: 'asc' } })
    ).map((x) => ({ ...x, code: x.code as MigrationIssue['code'] }));
  }

  async upsertEquivalence(x: MigrationEquivalenceResult): Promise<MigrationEquivalenceResult> {
    const saved = await this.prisma.pcMigrationEquivalence.upsert({
      where: { runId_checkKey_scope: { runId: x.runId, checkKey: x.checkKey, scope: x.scope } },
      create: x,
      update: {
        expectedValue: x.expectedValue,
        actualValue: x.actualValue,
        status: x.status,
        detail: x.detail,
        checkedAt: x.checkedAt,
      },
    });
    return { ...saved, status: saved.status as MigrationEquivalenceResult['status'] };
  }
  async listEquivalenceByRun(runId: Id): Promise<readonly MigrationEquivalenceResult[]> {
    return (
      await this.prisma.pcMigrationEquivalence.findMany({ where: { runId }, orderBy: { checkedAt: 'asc' } })
    ).map((x) => ({ ...x, status: x.status as MigrationEquivalenceResult['status'] }));
  }
}
