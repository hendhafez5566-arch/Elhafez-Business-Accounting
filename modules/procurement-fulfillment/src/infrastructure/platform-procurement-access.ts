import type{ExecutionContext}from'@elhafez/contracts';
import type{PlatformCoreApplicationService}from'@elhafez/platform-core';
import type{ProcurementAccess}from'../application/procurement-access.js';
export class PlatformProcurementAccess implements ProcurementAccess{
 constructor(private readonly platform:PlatformCoreApplicationService){}
 async requireBranch(c:ExecutionContext){await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);}
 async requirePermission(c:ExecutionContext,p:string){await this.platform.authorize(c.actorId,p);}
 async audit(c:ExecutionContext,action:string,resource:string,entityId:string|null,metadata:Record<string,unknown>={},idempotencyKey?:string){const entry={actorId:c.actorId,action,resource,entityId,companyId:c.companyId,branchId:c.branchId,metadata};if(idempotencyKey)await this.platform.recordAuditOnce(idempotencyKey,entry);else await this.platform.recordAudit(entry);}
}
