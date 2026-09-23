import type { ExecutionContext } from '@elhafez/contracts';
import type { PlatformCoreApplicationService } from '@elhafez/platform-core';
import type { BookingAccess } from '../application/booking.ports.js';
export class PlatformBookingAccess implements BookingAccess {
  constructor(private readonly platform:PlatformCoreApplicationService){}
  async requireBranch(c:ExecutionContext){await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);}
  async requirePermission(c:ExecutionContext,p:string){await this.platform.authorize(c.actorId,c.companyId,p);}
  async audit(c:ExecutionContext,action:string,id:string,metadata:Record<string,unknown>={}){await this.platform.recordAudit({actorId:c.actorId,action,resource:'hajj-umrah-booking',entityId:id,companyId:c.companyId,branchId:c.branchId,metadata});}
}
