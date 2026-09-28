import {Controller,Get,Headers,Inject,UnauthorizedException} from '@nestjs/common';
import {CostBudgetAccountingApplicationService} from '@elhafez/cost-budget-accounting';
import {PLATFORM_CORE_PERMISSIONS,PlatformCoreApplicationService} from '@elhafez/platform-core';
import {TourismInventoryReferenceQuery} from '@elhafez/tourism-contract-inventory/nest';

@Controller('business-references')
export class BusinessReferenceController{
 constructor(
  @Inject(PlatformCoreApplicationService)private readonly platform:PlatformCoreApplicationService,
  @Inject(CostBudgetAccountingApplicationService)private readonly cost:CostBudgetAccountingApplicationService,
  @Inject(TourismInventoryReferenceQuery)private readonly tourism:TourismInventoryReferenceQuery,
 ){}
 private async context(auth?:string,company?:string,branch?:string){
  if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch context required');
  const user=await this.platform.currentCompanyUser(auth.slice(7),company);
  await this.platform.requireBranchAccess(user.id,company,branch);
  return{actorId:user.id,companyId:company,branchId:branch};
 }
 @Get('cost-centers')
 async costCenters(@Headers('authorization')auth?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string){
  const c=await this.context(auth,company,branch);await this.platform.authorize(c.actorId,c.companyId,PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);return this.cost.list(c.companyId);
 }
 @Get('tourism/contracts')
 async contracts(@Headers('authorization')auth?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string){const c=await this.context(auth,company,branch);return this.tourism.contracts(c.companyId);}
 @Get('tourism/allocations')
 async allocations(@Headers('authorization')auth?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string){const c=await this.context(auth,company,branch);return this.tourism.allocations(c.companyId);}
}
