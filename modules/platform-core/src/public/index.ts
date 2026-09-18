/** The only importable boundary for platform capabilities. */
export { PlatformCoreModule } from '../platform-core.module.js';
export { PlatformCoreApplicationService, NoopEventPublisher } from '../application/platform-core.application-service.js';
export { ConsolePlatformLogger } from '../infrastructure/platform.logger.js';
export type { PlatformLogger } from '../infrastructure/platform.logger.js';
export type { AuditEntry, Branch, Company, Notification, StoredFile, User } from '../domain/platform.types.js';
export { PlatformError } from '../domain/platform.types.js';
