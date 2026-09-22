import type{ExecutionContext}from'@elhafez/contracts';
import type{PlatformCoreApplicationService}from'@elhafez/platform-core';
import type{ReadinessAccess}from'../application/readiness.ports.js';
export class PlatformReadinessAccess implements ReadinessAccess{
 constructor(private readonly platform:PlatformCoreApplicationService){}
 async requireBranch(c:ExecutionContext){await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId)}
 async requirePermission(c:ExecutionContext,p:string){await this.platform.authorize(c.actorId,p)}
 async auditOnce(c:ExecutionContext,key:string,action:string,id:string,metadata:Record<string,unknown>={}){
  await this.platform.recordAuditOnce(key,{actorId:c.actorId,action,resource:'hajj-umrah-readiness',entityId:id,companyId:c.companyId,branchId:c.branchId,metadata});
 }
}
