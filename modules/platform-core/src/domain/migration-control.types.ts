/**
 * AC-14A — migration-control metadata owned by Platform Core.
 *
 * These types describe operational bookkeeping for a legacy-to-current
 * migration run: which source was used, what it mapped to, where it left
 * off, what could not be resolved, and later equivalence results.
 *
 * They MUST NOT carry accounting source truth (journals, invoices,
 * vouchers, balances, assets, procurement, tourism financial data). That
 * truth is written only by its owning business module through its own
 * public API, in a later AC-14 batch.
 */

export type Id = string;

export type MigrationRunStatus =
  | 'PLANNED'
  | 'DRY_RUN'
  | 'RUNNING'
  | 'PAUSED'
  | 'VERIFYING'
  | 'READY'
  | 'FAILED';

export type MigrationMode = 'DRY_RUN' | 'EXECUTE' | 'RESUME' | 'VERIFY';

/** Sanitized, minimal taxonomy of things AC-14 cannot silently resolve. */
export type MigrationIssueCode =
  | 'SOURCE_IDENTITY_MISMATCH'
  | 'INVALID_DECIMAL'
  | 'UNKNOWN_STATUS'
  | 'UNKNOWN_COLLECTION_SHAPE'
  | 'MISSING_COMPANY_MAPPING'
  | 'MISSING_BRANCH_MAPPING'
  | 'MISSING_ACCOUNT'
  | 'MISSING_PARTY_REFERENCE'
  | 'MISSING_COST_CENTER'
  | 'MISSING_CURRENCY'
  | 'MISSING_FX_RATE'
  | 'MISSING_JOURNAL_REFERENCE'
  | 'BROKEN_REVERSAL_LINEAGE'
  | 'BROKEN_INVOICE_LINK'
  | 'BROKEN_ALLOCATION_LINK'
  | 'BROKEN_TREASURY_LINK'
  | 'BROKEN_PROCUREMENT_LINK'
  | 'AMBIGUOUS_LEGACY_SEMANTICS'
  | 'TARGET_CONFLICT'
  | 'UNSUPPORTED_LEGACY_CONSTRUCT'
  | 'EQUIVALENCE_MISMATCH';

export const MIGRATION_ISSUE_CODES: readonly MigrationIssueCode[] = [
  'SOURCE_IDENTITY_MISMATCH',
  'INVALID_DECIMAL',
  'UNKNOWN_STATUS',
  'UNKNOWN_COLLECTION_SHAPE',
  'MISSING_COMPANY_MAPPING',
  'MISSING_BRANCH_MAPPING',
  'MISSING_ACCOUNT',
  'MISSING_PARTY_REFERENCE',
  'MISSING_COST_CENTER',
  'MISSING_CURRENCY',
  'MISSING_FX_RATE',
  'MISSING_JOURNAL_REFERENCE',
  'BROKEN_REVERSAL_LINEAGE',
  'BROKEN_INVOICE_LINK',
  'BROKEN_ALLOCATION_LINK',
  'BROKEN_TREASURY_LINK',
  'BROKEN_PROCUREMENT_LINK',
  'AMBIGUOUS_LEGACY_SEMANTICS',
  'TARGET_CONFLICT',
  'UNSUPPORTED_LEGACY_CONSTRUCT',
  'EQUIVALENCE_MISMATCH',
];

export interface MigrationRun {
  id: Id;
  sourceRepository: string;
  sourceCommit: string;
  sourceVersion: string;
  sourceSha256: string | null;
  targetBaselineSha: string;
  implementationVersion: string;
  targetCompanyId: Id;
  actorId: Id;
  mode: MigrationMode;
  status: MigrationRunStatus;
  configSnapshotHash: string;
  processedCount: number;
  rejectedCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MigrationCrosswalk {
  id: Id;
  runId: Id;
  sourceCollection: string;
  sourceId: string;
  targetOwner: string;
  targetKind: string;
  targetId: string;
  sourcePayloadHash: string;
  createdAt: Date;
}

export type MigrationCheckpointStatus = 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';

export interface MigrationCheckpoint {
  id: Id;
  runId: Id;
  stage: string;
  cursor: string | null;
  processedCount: number;
  status: MigrationCheckpointStatus;
  updatedAt: Date;
}

export interface MigrationIssue {
  id: Id;
  runId: Id;
  code: MigrationIssueCode;
  stage: string | null;
  sourceCollection: string | null;
  sourceId: string | null;
  /** Sanitized, human-readable explanation only — never raw PII/secrets. */
  detail: string | null;
  createdAt: Date;
}

export type MigrationEquivalenceStatus = 'MATCH' | 'MISMATCH';

/** Normalized scope used when the caller does not declare an explicit equivalence scope. */
export const GLOBAL_EQUIVALENCE_SCOPE = 'GLOBAL';

export interface MigrationEquivalenceResult {
  id: Id;
  runId: Id;
  checkKey: string;
  /** Never null in storage — an absent caller-supplied scope is normalized to GLOBAL_EQUIVALENCE_SCOPE. */
  scope: string;
  /** Stored as exact strings; never JS Number for financial values. */
  expectedValue: string;
  actualValue: string;
  status: MigrationEquivalenceStatus;
  detail: string | null;
  checkedAt: Date;
}

export class MigrationControlError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MigrationControlError';
  }
}

export const failMigration = (
  code: string,
  message: string,
  details?: Record<string, unknown>,
): never => {
  throw new MigrationControlError(code, message, details);
};
