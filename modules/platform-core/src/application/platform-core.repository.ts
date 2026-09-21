import type { AuditEntry, Branch, Company, Id, Notification, Session, StoredFile, User } from '../domain/platform.types.js';

/** Module-private persistence port; infrastructure adapters implement it. */
export interface PlatformCoreRepository {
  transaction<T>(work: () => Promise<T>): Promise<T>;
  findUserById(id: Id): Promise<User | undefined>; findUserByEmail(email: string): Promise<User | undefined>; createUser(user: User): Promise<User>; updateUser(user: User): Promise<User>;
  createSession(session: Session): Promise<void>; findSessionByTokenHash(hash: string): Promise<Session | undefined>; revokeSession(id: Id, revokedAt: Date): Promise<void>;
  createRole(id: Id, name: string): Promise<void>; findRoleByName(name: string): Promise<Id | undefined>; createPermission(id: Id, name: string): Promise<void>; assignRole(userId: Id, roleId: Id): Promise<void>; grantPermission(roleId: Id, permissionId: Id): Promise<void>; hasPermission(userId: Id, permission: string): Promise<boolean>;
  createCompany(company: Company): Promise<Company>; findCompany(id: Id): Promise<Company | undefined>; createBranch(branch: Branch): Promise<Branch>; findBranch(id: Id): Promise<Branch | undefined>; grantBranchAccess(userId: Id, branchId: Id): Promise<void>; hasBranchAccess(userId: Id, branchId: Id): Promise<boolean>;
  recordAudit(entry: AuditEntry): Promise<void>; recordAuditOnce(entry: AuditEntry): Promise<void>; listAudit(): Promise<readonly AuditEntry[]>; registerFile(file: StoredFile): Promise<StoredFile>; notify(notification: Notification): Promise<Notification>; setConfiguration(key: string, value: unknown): Promise<void>; getConfiguration(key: string): Promise<unknown>;
}
export const PLATFORM_CORE_REPOSITORY = Symbol('PLATFORM_CORE_REPOSITORY');
