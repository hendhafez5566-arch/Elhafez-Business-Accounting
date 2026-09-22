import { Controller, Get, Headers, Param, Query, UnauthorizedException } from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { SupplierIntelligenceReadModelService } from './supplier-intelligence-read-model.service.js';

export const SUPPLIER_INTELLIGENCE_PERMISSIONS = Object.freeze({
  read: 'supplier.intelligence.read',
  disputeRead: 'supplier.dispute.read',
});

@Controller('supplier-intelligence')
export class SupplierIntelligenceReadModelController {
  static readonly runtimeDependencies=[SupplierIntelligenceReadModelService,PlatformCoreApplicationService] as const;
  constructor(
    private readonly service: SupplierIntelligenceReadModelService,
    private readonly platform: PlatformCoreApplicationService,
  ) {}

  @Get('suppliers')
  async search(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Query('q') query: string | undefined,
  ) {
    const context = await this.context(authorization, companyId, branchId);
    await this.authorize(context, false);
    return this.service.searchSuppliers(context, query);
  }

  @Get(':supplierPartyId/overview')
  async overview(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('supplierPartyId') supplierPartyId: string,
  ) {
    const context = await this.context(authorization, companyId, branchId);
    await this.authorize(context, true);
    return this.service.overview(context, supplierPartyId);
  }

  private async authorize(context: ExecutionContext, includeDisputes: boolean) {
    await this.platform.requireBranchAccess(context.actorId, context.companyId, context.branchId);
    await this.platform.authorize(context.actorId, context.companyId, SUPPLIER_INTELLIGENCE_PERMISSIONS.read);
    if (includeDisputes) await this.platform.authorize(context.actorId, context.companyId, SUPPLIER_INTELLIGENCE_PERMISSIONS.disputeRead);
  }

  private async context(
    authorization: string | undefined,
    companyId: string | undefined,
    branchId: string | undefined,
  ): Promise<ExecutionContext> {
    if (!authorization?.startsWith('Bearer ') || !companyId || !branchId) {
      throw new UnauthorizedException('authenticated company and branch context required');
    }
    const user = await this.platform.currentUser(authorization.slice(7));
    return executionContext(companyId, branchId, user.id);
  }
}
