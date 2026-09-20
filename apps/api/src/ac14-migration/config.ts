import type { AcceptedSourceIdentity, MigrationConfig } from '@elhafez/platform-core';

/**
 * AC-14A — thin composition-root config for the migration coordinator skeleton.
 *
 * This file is composition wiring only. It has no accounting-owner
 * knowledge and performs no owner-data writes. It calls the Platform Core
 * public API (`@elhafez/platform-core`) exclusively — never a private
 * repository, and never any accounting module.
 */

/** The one canonical accepted frozen legacy source identity for AC-14. */
export const ACCEPTED_LEGACY_SOURCE_IDENTITY: AcceptedSourceIdentity = {
  sourceRepository: 'mhafez300300-byte/Elhafez-Tourism-Offline',
  sourceCommit: 'e97fa6d9cb52acb22b676e1b975c1b2332bc9a13',
  sourceVersion: '32.5.66',
};

export interface Ac14PreflightRequest {
  declaredSourceIdentity: AcceptedSourceIdentity;
  targetBaselineSha: string;
  implementationVersion: string;
  config: MigrationConfig;
  /** Absolute path to the raw exported legacy snapshot JSON file. */
  snapshotPath: string;
}
