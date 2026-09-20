/** The only importable boundary for platform capabilities. */
export { PlatformCoreModule } from '../platform-core.module.js';
export { PlatformCoreApplicationService, NoopEventPublisher } from '../application/platform-core.application-service.js';
export { ConsolePlatformLogger } from '../infrastructure/platform.logger.js';
export type { PlatformLogger } from '../infrastructure/platform.logger.js';
export type { AuditEntry, Branch, Company, Notification, StoredFile, User } from '../domain/platform.types.js';
export { PlatformError } from '../domain/platform.types.js';

/** AC-14A — migration-control metadata only. Never accounting source truth. */
export { MigrationControlApplicationService } from '../application/migration-control.application-service.js';
export type {
  AcceptedSourceIdentity,
  CreateRunInput,
  MigrationBranchMap,
  MigrationConfig,
} from '../application/migration-control.application-service.js';
/**
 * The migration-control repository port and its DI token are deliberately
 * NOT exported from this boundary, in either runtime or type form. Test
 * doubles must be structurally compatible with what
 * MigrationControlApplicationService actually needs at its call sites,
 * not typed against private infrastructure. Consumers depend on
 * MigrationControlApplicationService only.
 */
export type {
  MigrationCheckpoint,
  MigrationCheckpointStatus,
  MigrationCrosswalk,
  MigrationEquivalenceResult,
  MigrationEquivalenceStatus,
  MigrationIssue,
  MigrationIssueCode,
  MigrationMode,
  MigrationRun,
  MigrationRunStatus,
} from '../domain/migration-control.types.js';
export { MIGRATION_ISSUE_CODES, MigrationControlError } from '../domain/migration-control.types.js';
