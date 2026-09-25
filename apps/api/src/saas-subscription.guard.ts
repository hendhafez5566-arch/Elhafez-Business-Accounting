import{ForbiddenException,ServiceUnavailableException,UnauthorizedException,type CanActivate,type ExecutionContext}from'@nestjs/common';
import{SaasError,type SaasControlPlaneApplicationService}from'@elhafez/saas-control-plane';
import{PlatformError,type PlatformCoreApplicationService}from'@elhafez/platform-core';
type HttpRequest={headers:Record<string,string|string[]|undefined>;method?:string;url?:string;originalUrl?:string};
export interface MaintenanceStatusPort{maintenanceStatus():Promise<boolean>}
const header=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
export class SaasSubscriptionGuard implements CanActivate{
 constructor(private readonly saas:SaasControlPlaneApplicationService,private readonly platform:PlatformCoreApplicationService,private readonly operations:MaintenanceStatusPort){}
 async canActivate(context:ExecutionContext){
  const request=context.switchToHttp().getRequest<HttpRequest>(),rawPath=request.originalUrl??request.url??'',path=rawPath.split('?')[0]??rawPath;
  const ownerPath=path==='/saas-owner'||path.startsWith('/saas-owner/');
  const ownerRecoveryPath=path==='/saas-owner/login'||path==='/saas-owner/logout'||path==='/saas-owner/operations'||path.startsWith('/saas-owner/operations/');
  if(await this.operations.maintenanceStatus()){
   if(ownerRecoveryPath)return true;
   throw new ServiceUnavailableException({code:'PLATFORM_MAINTENANCE',message:'المنصة في وضع الصيانة والاستعادة حالياً'});
  }
  const publicPath=ownerPath||path==='/saas/login'||path==='/saas/logout'||path==='/saas/subscription-status'||path==='/system-administration/recovery/request'||path==='/system-administration/recovery/reset';
  if(publicPath)return true;
  if((request.method??'GET').toUpperCase()==='POST'&&path==='/system-administration/companies')throw new ForbiddenException({code:'OWNER_CONTROL_REQUIRED',message:'new companies are provisioned only from Owner Control Center'});
  const companyId=header(request.headers['x-company-id']),branchId=header(request.headers['x-branch-id']),authorization=header(request.headers.authorization);
  if(!companyId)throw new ForbiddenException({code:'TENANT_CONTEXT_REQUIRED',message:'company context is required'});
  if(!authorization?.startsWith('Bearer '))throw new UnauthorizedException({code:'UNAUTHENTICATED',message:'valid tenant session required'});
  try{
   const user=await this.platform.currentUser(authorization.slice(7));
   if(branchId)await this.platform.requireBranchAccess(user.id,companyId,branchId);
   else{const company=await this.platform.getCompany(user.id,companyId);if(!company.active)throw new PlatformError('FORBIDDEN','company is inactive');}
   await this.saas.assertTenantAccess(companyId);
   return true;
  }catch(error){
   if(error instanceof PlatformError){
    if(error.code==='UNAUTHENTICATED')throw new UnauthorizedException({code:'UNAUTHENTICATED',message:'valid tenant session required'});
    throw new ForbiddenException({code:'TENANT_ACCESS_DENIED',message:'tenant access denied'});
   }
   if(error instanceof SaasError)throw new ForbiddenException({code:error.code,message:'اشتراك الشركة لا يسمح باستخدام النظام حالياً'});
   throw error;
  }
 }
}
