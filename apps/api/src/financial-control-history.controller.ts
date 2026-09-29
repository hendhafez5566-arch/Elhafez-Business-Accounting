import{Controller,Get,Headers,Inject,UnauthorizedException}from'@nestjs/common';
import{executionContext,type ExecutionContext}from'@elhafez/contracts';
import{FinancialControlsApplicationService}from'@elhafez/financial-controls';
import{PLATFORM_CORE_PERMISSIONS,PlatformCoreApplicationService}from'@elhafez/platform-core';

@Controller('management-control/financial-history')
export class FinancialControlHistoryController{
 constructor(@Inject(FinancialControlsApplicationService)private readonly controls:FinancialControlsApplicationService,@Inject(PlatformCoreApplicationService)private readonly platform:PlatformCoreApplicationService){}
 @Get()
 async history(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined){const c=await this.context(auth,company,branch);const[reconciliationRuns,closeReadinessRuns,audit]=await Promise.all([this.controls.listReconciliationRuns(c.companyId,c.branchId),this.controls.listCloseReadinessRuns(c.companyId,c.branchId),this.platform.listAudit(c.companyId)]);const auditEntries=audit.filter(row=>row.branchId===c.branchId).slice(-100).reverse();return{reconciliationRuns,closeReadinessRuns,auditEntries};}
 private async context(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(auth.slice(7));const c=executionContext(company,branch,user.id);await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);await this.platform.authorize(c.actorId,c.companyId,PLATFORM_CORE_PERMISSIONS.managementControlRead);return c;}
}
