export type Id = string;
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export interface User { id: Id; email: string; passwordHash: string; status: UserStatus; displayName: string; createdAt: Date; updatedAt: Date }
export type UserProjection = Omit<User, 'passwordHash'>;
export interface Company { id: Id; name: string; active: boolean; createdAt: Date }
export interface Branch { id: Id; companyId: Id; name: string; active: boolean; createdAt: Date }
export interface AuditEntry { id: Id; actorId: Id | null; action: string; resource: string; entityId: Id | null; companyId: Id | null; branchId: Id | null; metadata: Record<string, unknown>; occurredAt: Date }
export interface StoredFile { id: Id; companyId: Id | null; key: string; contentType: string; size: number; checksum: string | null; createdBy: Id | null; createdAt: Date }
export interface Notification { id: Id; userId: Id; type: string; payload: Record<string, unknown>; readAt: Date | null; createdAt: Date }
export interface Session { id: Id; userId: Id; tokenHash: string; expiresAt: Date; revokedAt: Date | null; createdAt: Date }
export interface Role { id: Id; name: string }
export interface Permission { id: Id; name: string }
export type SessionProjection = Omit<Session, 'tokenHash'> & { status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' };
export interface DomainErrorShape { code: string; message: string; details?: Record<string, unknown> }

export class PlatformError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) { super(message); this.name = 'PlatformError'; }
}
export const fail = (code: string, message: string, details?: Record<string, unknown>): never => { throw new PlatformError(code, message, details); };
