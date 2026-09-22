import type { ExecutionContext } from '@elhafez/contracts';
import type { PlatformCoreApplicationService } from '@elhafez/platform-core';
import type { PartyAccess } from '../application/party-access.js';
export class PlatformPartyAccess implements PartyAccess {
  constructor(private readonly platform:PlatformCoreApplicationService){}
  async requireBranch(context:ExecutionContext):Promise<void>{ await this.platform.requireBranchAccess(context.actorId,context.companyId,context.branchId); }
  async requirePermission(context:ExecutionContext,permission:string):Promise<void>{ await this.platform.authorize(context.actorId,context.companyId,permission); }
  async audit(context:ExecutionContext,action:string,resource:string,entityId:string|null,metadata:Record<string,unknown>={}):Promise<void>{
    await this.platform.recordAudit({actorId:context.actorId,action,resource,entityId,companyId:context.companyId,branchId:context.branchId,metadata});
  }
}
