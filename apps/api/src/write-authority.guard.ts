import { ForbiddenException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ContractValidationError } from '@elhafez/contracts';
import type { WriteAuthorityApplicationService } from '@elhafez/offline-coordination';
export class WriteAuthorityGuard implements CanActivate {
 constructor(private readonly authority:Pick<WriteAuthorityApplicationService,'assert'>,private readonly serverId:()=>string|undefined=()=>process.env.ELHAFEZ_WRITE_AUTHORITY_ID){}
 async canActivate(context:ExecutionContext){const request=context.switchToHttp().getRequest<{method:string;originalUrl?:string;url?:string;headers:Record<string,string|string[]|undefined>}>();
  if(['GET','HEAD','OPTIONS'].includes(request.method))return true;
  const path=(request.originalUrl??request.url??'').split('?')[0];
  if(path==='/offline/authority/enroll'||path==='/saas/login'||path==='/saas/logout'||path==='/saas/credentials/initial-password'||path?.startsWith('/saas-owner/'))return true;
  const company=request.headers['x-company-id'];if(typeof company!=='string')return true; // Authentication guard remains responsible for missing context.
  try{await this.authority.assert(company,this.serverId());return true;}catch(error){if(error instanceof ContractValidationError)throw new ForbiddenException({code:'WRITE_AUTHORITY_REQUIRED',message:error.message});throw error;}
 }
}
