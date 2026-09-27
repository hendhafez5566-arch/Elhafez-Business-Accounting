import type{PlatformCoreApplicationService}from'@elhafez/platform-core';
import type{CustomFieldsAccess}from'../application/custom-fields.access.js';
export class PlatformCustomFieldsAccess implements CustomFieldsAccess{
 constructor(private readonly platform:PlatformCoreApplicationService){}
 async requirePermission(context:{companyId:string;actorId:string},permission:string){await this.platform.requireUserCompanyAccess(context.actorId,context.companyId);await this.platform.authorize(context.actorId,context.companyId,permission);}
 async auditOnce(context:{companyId:string;actorId:string},key:string,action:string,entityId:string|null,metadata:Record<string,unknown>={}){await this.platform.recordAuditOnce(key,{actorId:context.actorId,action,resource:'custom-fields',entityId,companyId:context.companyId,branchId:null,metadata});}
}
