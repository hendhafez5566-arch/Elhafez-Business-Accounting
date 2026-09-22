import type { ExecutionContext } from '@elhafez/contracts';
import type { PlatformCoreApplicationService } from '@elhafez/platform-core';
import type { TravelerManagementAccess } from '../application/traveler-management-access.js';

export class PlatformTravelerManagementAccess implements TravelerManagementAccess {
 constructor(private readonly p: PlatformCoreApplicationService) {}
 async requireBranch(c: ExecutionContext) { await this.p.requireBranchAccess(c.actorId, c.companyId, c.branchId); }
 async requirePermission(c: ExecutionContext, x: string) { await this.p.authorize(c.actorId, c.companyId, x); }
 async audit(c: ExecutionContext, a: string, r: string, e: string | null, m: Record<string, unknown> = {}) {
  await this.p.recordAudit({ actorId: c.actorId, action: a, resource: r, entityId: e, companyId: c.companyId, branchId: c.branchId, metadata: m });
 }
}
