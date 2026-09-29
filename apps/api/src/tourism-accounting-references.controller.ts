import { Controller, Get, Headers, Inject, UnauthorizedException } from '@nestjs/common';
import { executionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { CostBudgetAccountingApplicationService } from '@elhafez/cost-budget-accounting';

@Controller('tourism/references')
export class TourismAccountingReferencesController {
  constructor(
    @Inject(PlatformCoreApplicationService) private readonly platform:PlatformCoreApplicationService,
    @Inject(CostBudgetAccountingApplicationService) private readonly cost:CostBudgetAccountingApplicationService,
  ){}

  @Get('cost-centers')
  async costCenters(
    @Headers('authorization') auth?:string,
    @Headers('x-company-id') companyId?:string,
    @Headers('x-branch-id') branchId?:string,
  ){
    if(!auth?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated company and branch context required');
    const user=await this.platform.currentUser(auth.slice(7));
    await this.platform.requireBranchAccess(user.id,companyId,branchId);
    const context=executionContext(companyId,branchId,user.id);
    await this.platform.authorize(context.actorId,context.companyId,'tourism.bookings.confirm');
    return this.cost.list(context.companyId,true);
  }
}
