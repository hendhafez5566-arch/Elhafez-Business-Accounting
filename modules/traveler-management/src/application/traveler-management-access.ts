import type { ExecutionContext } from '@elhafez/contracts';
export interface TravelerManagementAccess {
 requireBranch(c: ExecutionContext): Promise<void>;
 requirePermission(c: ExecutionContext, p: string): Promise<void>;
 audit(c: ExecutionContext, action: string, resource: string, entityId: string | null, meta?: Record<string, unknown>): Promise<void>;
}
export const TRAVELER_MANAGEMENT_ACCESS = Symbol('TRAVELER_MANAGEMENT_ACCESS');
