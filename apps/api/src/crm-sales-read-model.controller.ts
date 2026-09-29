import { Controller, Get, Headers, Inject, Param, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@elhafez/contracts';
import { executionContext } from '@elhafez/contracts';
import { PLATFORM_CORE_PERMISSIONS, PlatformCoreApplicationService } from '@elhafez/platform-core';
import { CrmSalesReadModelService, type Agent360View, type AgentWorkspaceView, type CrmSalesDashboardView, type Customer360View, type CustomerWorkspaceView } from './crm-sales-read-model.service.js';

export const CRM_SALES_INSIGHT_PERMISSIONS = Object.freeze({ customerFinancialRead: 'crm.customer.financial.read', leadRead: 'crm.lead.read' });
export interface CrmAssigneeOption { readonly id:string; readonly displayName:string }

@Controller('crm/insights')
export class CrmSalesReadModelController {
  constructor(
    @Inject(CrmSalesReadModelService) private readonly service: CrmSalesReadModelService,
    @Inject(PlatformCoreApplicationService) private readonly platform: PlatformCoreApplicationService,
  ) {}
  @Get('assignees') async assignees(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined):Promise<readonly CrmAssigneeOption[]>{const context=await this.context(auth,company,branch);await this.platform.requireBranchAccess(context.actorId,context.companyId,context.branchId);await this.platform.authorize(context.actorId,context.companyId,CRM_SALES_INSIGHT_PERMISSIONS.leadRead);return (await this.platform.listCompanyUsers(context.companyId)).filter(user=>user.status==='ACTIVE').map(user=>({id:user.id,displayName:user.displayName}));}
  @Get('customers') async customers(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined):Promise<CustomerWorkspaceView>{return this.service.customersWorkspace(await this.customerFinancialContext(auth,company,branch));}
  @Get('customers/:id') async customer(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string):Promise<Customer360View>{return this.service.customer360(await this.customerFinancialContext(auth,company,branch),id);}
  @Get('agents') async agents(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined):Promise<AgentWorkspaceView>{return this.service.agentsWorkspace(await this.accountingFinancialContext(auth,company,branch));}
  @Get('agents/:id') async agent(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string):Promise<Agent360View>{return this.service.agent360(await this.accountingFinancialContext(auth,company,branch),id);}
  @Get('dashboard') async dashboard(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined):Promise<CrmSalesDashboardView>{const context=await this.customerFinancialContext(auth,company,branch);await this.platform.authorize(context.actorId,context.companyId,PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);return this.service.dashboard(context);}
  private async customerFinancialContext(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{const context=await this.context(auth,company,branch);await this.platform.requireBranchAccess(context.actorId,context.companyId,context.branchId);await this.platform.authorize(context.actorId,context.companyId,CRM_SALES_INSIGHT_PERMISSIONS.customerFinancialRead);return context;}
  private async accountingFinancialContext(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{const context=await this.context(auth,company,branch);await this.platform.requireBranchAccess(context.actorId,context.companyId,context.branchId);await this.platform.authorize(context.actorId,context.companyId,PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);return context;}
  private async context(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(auth.slice(7));return executionContext(company,branch,user.id);}
}
