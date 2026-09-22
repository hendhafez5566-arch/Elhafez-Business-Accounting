import{Controller,Get,Headers,Param,Post,UnauthorizedException}from'@nestjs/common';
import{executionContext,type ExecutionContext}from'@elhafez/contracts';
import{PlatformCoreApplicationService,PlatformError}from'@elhafez/platform-core';
import{HajjUmrahReadinessApplicationService,READINESS_PERMISSIONS}from'@elhafez/hajj-umrah-readiness';

type RequestHeaders={authorization:string|undefined;companyId:string|undefined;branchId:string|undefined};

@Controller('hajj-umrah/readiness')
export class HajjUmrahReadinessController{
 static readonly runtimeDependencies=[HajjUmrahReadinessApplicationService,PlatformCoreApplicationService]as const;
 constructor(private readonly readiness:HajjUmrahReadinessApplicationService,private readonly platform:PlatformCoreApplicationService){}

 @Get('capabilities')
 async capabilities(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined){
  const c=await this.context({authorization,companyId,branchId});
  await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);
  return{
   view:await this.allowed(c,READINESS_PERMISSIONS.view),
   view360:await this.allowed(c,READINESS_PERMISSIONS.view360),
   reports:await this.allowed(c,READINESS_PERMISSIONS.reports),
   close:await this.allowed(c,READINESS_PERMISSIONS.close),
  };
 }
 @Get('booking/:id')
 bookingReadiness(@Headers('authorization') a:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.context({authorization:a,companyId,branchId}).then(c=>this.readiness.bookingReadiness(c,id))}
 @Get('program/:id')
 programReadiness(@Headers('authorization') a:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.context({authorization:a,companyId,branchId}).then(c=>this.readiness.programReadiness(c,id))}
 @Get('booking/:id/360')
 booking360(@Headers('authorization') a:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string):ReturnType<HajjUmrahReadinessApplicationService['booking360']>{return this.context({authorization:a,companyId,branchId}).then(c=>this.readiness.booking360(c,id))}
 @Get('program/:id/360')
 program360(@Headers('authorization') a:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.context({authorization:a,companyId,branchId}).then(c=>this.readiness.program360(c,id))}
 @Get('program/:id/work-queue')
 workQueue(@Headers('authorization') a:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.context({authorization:a,companyId,branchId}).then(c=>this.readiness.workQueue(c,id))}
 @Get('program/:id/reports')
 reports(@Headers('authorization') a:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.context({authorization:a,companyId,branchId}).then(c=>this.readiness.reports(c,id))}
 @Get('program/:id/closure')
 closure(@Headers('authorization') a:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.context({authorization:a,companyId,branchId}).then(c=>this.readiness.evaluateClosure(c,id))}
 @Post('program/:id/closure')
 close(@Headers('authorization') a:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.context({authorization:a,companyId,branchId}).then(c=>this.readiness.closeProgram(c,id))}

 private async allowed(c:ExecutionContext,p:string){try{await this.platform.authorize(c.actorId,p);return true}catch(error){if(error instanceof PlatformError&&error.code==='FORBIDDEN')return false;throw error}}
 private async context(h:RequestHeaders):Promise<ExecutionContext>{
  if(!h.authorization?.startsWith('Bearer ')||!h.companyId||!h.branchId)throw new UnauthorizedException('authenticated company and branch context required');
  const user=await this.platform.currentUser(h.authorization.slice(7));
  return executionContext(h.companyId,h.branchId,user.id);
 }
}
