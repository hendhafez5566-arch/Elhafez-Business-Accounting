import { Inject, Injectable } from '@nestjs/common';
import { MigrationControlApplicationService } from '@elhafez/platform-core';
import type { MigrationRun } from '@elhafez/platform-core';
import { ACCEPTED_LEGACY_SOURCE_IDENTITY, type Ac14PreflightRequest } from './config.js';
import { readRawSnapshot } from './snapshot-reader.js';

export interface Ac14PreflightResult {
  run: MigrationRun;
  /** Top-level keys found in the snapshot root. Visibility only — no collection is migrated here. */
  collectionKeysFound: readonly string[];
}

/**
 * AC-14A dry-run preflight.
 *
 * Validates the declared source identity and migration config, hashes and
 * structurally validates the raw snapshot, and records a migration run in
 * `DRY_RUN` status with its source hash registered.
 *
 * This is a control-plane preflight only: it writes ONLY Platform Core
 * migration-control metadata (through {@link MigrationControlApplicationService}'s
 * public API). It never reads or writes any accounting-owner table, never
 * imports a collection, and never computes equivalence. Those belong to
 * later AC-14 batches.
 */
@Injectable()
export class Ac14PreflightService {
  constructor(
    @Inject(MigrationControlApplicationService)
    private readonly migrationControl: MigrationControlApplicationService,
  ) {}

  async dryRunPreflight(request: Ac14PreflightRequest): Promise<Ac14PreflightResult> {
    this.migrationControl.validateSourceIdentity(
      request.declaredSourceIdentity,
      ACCEPTED_LEGACY_SOURCE_IDENTITY,
    );
    this.migrationControl.validateConfig(request.config);

    const snapshot = await readRawSnapshot(request.snapshotPath);

    const created = await this.migrationControl.createRun({
      sourceRepository: request.declaredSourceIdentity.sourceRepository,
      sourceCommit: request.declaredSourceIdentity.sourceCommit,
      sourceVersion: request.declaredSourceIdentity.sourceVersion,
      targetBaselineSha: request.targetBaselineSha,
      implementationVersion: request.implementationVersion,
      mode: 'DRY_RUN',
      config: request.config,
    });
    await this.migrationControl.registerSourceSha256(created.id, snapshot.sha256);
    const run = await this.migrationControl.transitionRunStatus(created.id, 'DRY_RUN');

    return { run, collectionKeysFound: snapshot.collectionKeys };
  }
}
