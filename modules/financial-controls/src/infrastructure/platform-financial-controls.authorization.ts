import{PlatformError,type PlatformCoreApplicationService}from'@elhafez/platform-core';
import{FINANCIAL_CONTROL_PERMISSIONS,type TrustedAuthorizationPort}from'../application/financial-controls.application-service.js';

export class PlatformFinancialControlsAuthorization implements TrustedAuthorizationPort{
 constructor(private readonly platform:PlatformCoreApplicationService){}
 private async allowed(action:()=>Promise<void>){try{await action();return true}catch(error){if(error instanceof PlatformError&&error.code==='FORBIDDEN')return false;throw error}}
 canApprove(actorId:string,companyId:string,authority:string){return this.allowed(()=>this.platform.authorize(actorId,companyId,authority))}
 canAccessBranch(actorId:string,companyId:string,branchId:string){return this.allowed(()=>this.platform.requireBranchAccess(actorId,companyId,branchId))}
 canResolveControlIssue(actorId:string,companyId:string){return this.allowed(()=>this.platform.authorize(actorId,companyId,FINANCIAL_CONTROL_PERMISSIONS.resolve))}
}
