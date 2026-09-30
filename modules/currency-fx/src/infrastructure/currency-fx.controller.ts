import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { currencyCode, executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PLATFORM_CORE_PERMISSIONS, PlatformCoreApplicationService } from '@elhafez/platform-core';
import { CurrencyFxApplicationService } from '../application/currency-fx.application-service.js';

@Controller('accounting/advanced')
export class CurrencyFxController {
  constructor(private readonly platform: PlatformCoreApplicationService, private readonly fx: CurrencyFxApplicationService) {}

  private async context(auth?: string, company?: string, branch?: string, operate = false): Promise<ExecutionContext> {
    if (!auth?.startsWith('Bearer ') || !company || !branch) throw new UnauthorizedException('authenticated company and branch context required');
    const user = await this.platform.currentUser(auth.slice(7));
    await this.platform.requireBranchAccess(user.id, company, branch);
    await this.platform.authorize(user.id, company, operate ? PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate : PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
    return executionContext(company, branch, user.id);
  }

  @Get('currencies')
  async currencies(@Headers('authorization') auth?: string, @Headers('x-company-id') company?: string, @Headers('x-branch-id') branch?: string) {
    const context = await this.context(auth, company, branch);
    return this.fx.listCurrencies(context.companyId);
  }

  @Post('fx-rates/live')
  async refreshLiveRate(
    @Headers('authorization') auth: string,
    @Headers('x-company-id') company: string,
    @Headers('x-branch-id') branch: string,
    @Body() input: { fromCurrency: string; toCurrency: string },
  ) {
    const context = await this.context(auth, company, branch, true);
    return this.fx.refreshLiveRate(context.companyId, currencyCode(input.fromCurrency), currencyCode(input.toCurrency), randomUUID());
  }
}
