import type { AuditEntry, Branch, Company, Id, Notification, Session, StoredFile, User } from '../domain/platform.types.js';

/** Replace with a Prisma adapter at application composition; this adapter is deterministic for unit tests. */
export class InMemoryPlatformRepository {
  readonly users = new Map<Id, User>(); readonly companies = new Map<Id, Company>(); readonly branches = new Map<Id, Branch>();
  readonly roles = new Map<Id, string>(); readonly permissions = new Map<Id, string>();
  readonly userRoles = new Map<Id, Set<Id>>(); readonly rolePermissions = new Map<Id, Set<Id>>(); readonly branchAccess = new Map<Id, Set<Id>>();
  readonly sessions = new Map<Id, Session>(); readonly audits: AuditEntry[] = []; readonly files = new Map<Id, StoredFile>(); readonly notifications = new Map<Id, Notification>(); readonly config = new Map<string, unknown>();
  async transaction<T>(operation: () => Promise<T>): Promise<T> { return operation(); }
}
