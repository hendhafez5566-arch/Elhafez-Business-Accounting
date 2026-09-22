import { Controller, Get, Headers, Inject, Param, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@elhafez/contracts';
import { executionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { CrmSalesReadModelService } from './crm-sales-read-model.service.js';

export const CRM_SALES_INSIGHT_PERMISSIONS = Object.freeze({ customerFinancialRead: 'crm.customer.financial.read' });

@Controller('crm/insights')
export class CrmSalesReadModelController {
  constructor(
    @Inject(CrmSalesReadModelService) private readonly service: CrmSalesReadModelService,
    @Inject(PlatformCoreApplicationService) private readonly platform: PlatformCoreApplicationService,
  ) {}
  @Get('customers/:id') async customer(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string){const context=await this.context(auth,company,branch);await this.platform.requireBranchAccess(context.actorId,context.companyId,context.branchId);await this.platform.authorize(context.actorId,context.companyId,CRM_SALES_INSIGHT_PERMISSIONS.customerFinancialRead);return this.service.customer360(context,id);}
  @Get('agents/:id') async agent(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string){return this.service.agent360(await this.context(auth,company,branch),id);}
  @Get('dashboard') async dashboard(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined){return this.service.dashboard(await this.context(auth,company,branch));}
  private async context(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(auth.slice(7));return executionContext(company,branch,user.id);}
}
