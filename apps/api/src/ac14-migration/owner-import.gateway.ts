import type { MigrationConfig, MigrationIssueCode } from '@elhafez/platform-core';

export const AC14_OWNER_IMPORT_GATEWAY = Symbol('AC14_OWNER_IMPORT_GATEWAY');

export interface HistoricalImportUnit {
  runId: string;
  stage: string;
  owner: string;
  collection: string;
  sourceId: string;
  sourcePayloadHash: string;
  targetCompanyId: string;
  targetBranchId?: string;
  payload: Readonly<Record<string, unknown>>;
}

export type HistoricalImportOutcome =
  | { status: 'IMPORTED' | 'CONVERGED'; targetKind: string; targetId: string }
  | { status: 'REJECTED'; code: MigrationIssueCode; detail: string };

/**
 * Composition contract implemented by owner-controlled historical boundaries.
 * An implementation must route only to public owner APIs and must never issue
 * Prisma writes from the coordinator.
 */
export interface Ac14OwnerImportGateway {
  importUnit(unit: HistoricalImportUnit): Promise<HistoricalImportOutcome>;
  rebuildReporting(runId: string, config: MigrationConfig): Promise<{ evidenceCount: string }>;
  authoritativeCount(owner: string, companyId: string): Promise<string>;
}
