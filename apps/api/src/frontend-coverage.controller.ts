import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Headers, Inject, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { currencyCode, decimalAmount, executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PLATFORM_CORE_PERMISSIONS, PlatformCoreApplicationService } from '@elhafez/platform-core';
import { CurrencyFxApplicationService } from '@elhafez/currency-fx';
import { CostBudgetAccountingApplicationService, costCenterId } from '@elhafez/cost-budget-accounting';
import { PartyAccountingApplicationService, type PartyRole } from '@elhafez/party-accounting';
import { ExpenseCommissionRecognitionApplicationService, type ExpenseForm } from '@elhafez/expense-commission-recognition';
import { AssetsFinancingApplicationService, type RegisterAssetInput } from '@elhafez/assets-financing';
import type {
  AllocateCapacityInput,
  CheckAvailabilityInput,
  CreateFlightBlockInput,
  CreateHotelInventoryInput,
  CreateStopSaleInput,
  CreateTourismContractInput,
  CreateTransportCapacityInput,
  CreateVisaQuotaInput,
  ReleaseAllocationInput,
  TourismContractInventoryApplicationService,
} from '@elhafez/tourism-contract-inventory';
import { TOURISM_CONTRACT_INVENTORY_SERVICE } from '@elhafez/tourism-contract-inventory/nest';

type AuthHeaders = { authorization?: string; companyId?: string; branchId?: string };

async function tenantContext(platform: PlatformCoreApplicationService, headers: AuthHeaders): Promise<ExecutionContext> {
  if (!headers.authorization?.startsWith('Bearer ') || !headers.companyId || !headers.branchId) {
    throw new UnauthorizedException('authenticated company and branch context required');
  }
  const user = await platform.currentUser(headers.authorization.slice(7));
  await platform.requireBranchAccess(user.id, headers.companyId, headers.branchId);
  return executionContext(headers.companyId, headers.branchId, user.id);
}

@Controller('accounting/advanced')
export class AdvancedAccountingController {
  constructor(
    @Inject(PlatformCoreApplicationService) private readonly platform: PlatformCoreApplicationService,
    @Inject(CurrencyFxApplicationService) private readonly fx: CurrencyFxApplicationService,
    @Inject(CostBudgetAccountingApplicationService) private readonly cost: CostBudgetAccountingApplicationService,
    @Inject(PartyAccountingApplicationService) private readonly parties: PartyAccountingApplicationService,
    @Inject(ExpenseCommissionRecognitionApplicationService) private readonly ecr: ExpenseCommissionRecognitionApplicationService,
    @Inject(AssetsFinancingApplicationService) private readonly assets: AssetsFinancingApplicationService,
  ) {}

  private async context(auth?: string, company?: string, branch?: string, operate = false) {
    const context = await tenantContext(this.platform, { authorization: auth, companyId: company, branchId: branch });
    await this.platform.authorize(
      context.actorId,
      context.companyId,
      operate ? PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate : PLATFORM_CORE_PERMISSIONS.accountingFinanceRead,
    );
    return context;
  }

  @Get('base-currency')
  async baseCurrency(@Headers('authorization') auth?: string, @Headers('x-company-id') company?: string, @Headers('x-branch-id') branch?: string) {
    const c = await this.context(auth, company, branch);
    return this.fx.getBaseCurrency(c.companyId);
  }

  @Post('currencies')
  async configureCurrency(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: { code: string; precision: number; isBase: boolean; status: 'ACTIVE' | 'INACTIVE' }) {
    const c = await this.context(auth, company, branch, true);
    return this.fx.configure({ companyId: c.companyId, code: currencyCode(input.code), precision: input.precision, isBase: input.isBase, status: input.status });
  }

  @Post('fx-rates')
  async publishRate(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: { id?: string; fromCurrency: string; toCurrency: string; effectiveAt: string; rate: string; source: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.fx.publishRate({
      id: input.id?.trim() || randomUUID(),
      companyId: c.companyId,
      fromCurrency: currencyCode(input.fromCurrency),
      toCurrency: currencyCode(input.toCurrency),
      effectiveAt: input.effectiveAt,
      rate: decimalAmount(input.rate),
      source: input.source,
    });
  }

  @Get('fx-rates/resolve')
  async resolveRate(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Query('from') from: string, @Query('to') to: string, @Query('at') at: string) {
    const c = await this.context(auth, company, branch);
    return this.fx.resolveRate(c.companyId, currencyCode(from), currencyCode(to), at);
  }

  @Post('cost-centers')
  async createCostCenter(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: { id?: string; code: string; name: string; parentId?: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.cost.create({
      id: costCenterId(input.id?.trim() || randomUUID()),
      companyId: c.companyId,
      code: input.code.trim().toUpperCase(),
      name: input.name,
      status: 'ACTIVE',
      ...(input.parentId?.trim() ? { parentId: costCenterId(input.parentId.trim()) } : {}),
    });
  }

  @Get('cost-centers/:id')
  async getCostCenter(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string) {
    const c = await this.context(auth, company, branch);
    return this.cost.get(c.companyId, costCenterId(id));
  }

  @Post('budgets')
  async createBudget(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: { id?: string; costCenterId: string; periodStart: string; periodEnd: string; currency: string; amount: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.cost.createBudget({
      id: input.id?.trim() || randomUUID(),
      companyId: c.companyId,
      costCenterId: costCenterId(input.costCenterId),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      currency: input.currency,
      amount: decimalAmount(input.amount),
    });
  }

  @Post('budgets/:id/authorize')
  async authorizeBudget(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string) {
    const c = await this.context(auth, company, branch, true);
    return this.cost.authorizeBudget(c.companyId, id);
  }

  @Get('budgets/:id/check')
  async checkBudget(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string) {
    const c = await this.context(auth, company, branch);
    return this.cost.checkBudget(c.companyId, id);
  }

  @Post('party-groups')
  async createPartyGroup(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: { id?: string; name: string; members: { id?: string; role: PartyRole; partyId: string }[] }) {
    const c = await this.context(auth, company, branch, true);
    const id = input.id?.trim() || randomUUID();
    return this.parties.createGroup({
      id,
      companyId: c.companyId,
      name: input.name,
      members: input.members.map((member) => ({ id: member.id?.trim() || randomUUID(), role: member.role, partyId: member.partyId })),
    });
  }

  @Post('nettings')
  async proposeNetting(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: { id?: string; groupId: string; customerInvoiceId: string; supplierInvoiceId: string; amount: string; postingDate: string; number: string; approvalRequestId?: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.parties.proposeNetting({
      id: input.id?.trim() || randomUUID(),
      companyId: c.companyId,
      branchId: c.branchId,
      groupId: input.groupId,
      customerInvoiceId: input.customerInvoiceId,
      supplierInvoiceId: input.supplierInvoiceId,
      amount: decimalAmount(input.amount),
      postingDate: input.postingDate,
      number: input.number,
      requesterActorId: c.actorId,
      ...(input.approvalRequestId?.trim() ? { approvalRequestId: input.approvalRequestId.trim() } : {}),
    });
  }

  @Post('nettings/:id/execute')
  async executeNetting(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string) {
    const c = await this.context(auth, company, branch, true);
    return this.parties.executeNetting(c.companyId, id);
  }

  @Post('nettings/:id/reverse')
  async reverseNetting(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string,
    @Body() input: { postingDate: string; number: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.parties.reverseNetting(c.companyId, id, input.postingDate, input.number);
  }

  @Post('expenses')
  async createExpense(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: { id?: string; form: ExpenseForm; sourceType: string; sourceId: string; currency: string; amount: string; baseAmount: string; expenseAccountId?: string; prepaidAccountId?: string; billingInvoiceId?: string; approvalRequestId?: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.ecr.createExpense({
      id: input.id?.trim() || randomUUID(), companyId: c.companyId, branchId: c.branchId, form: input.form,
      sourceType: input.sourceType, sourceId: input.sourceId, currency: input.currency, amount: decimalAmount(input.amount), baseAmount: decimalAmount(input.baseAmount),
      ...(input.expenseAccountId?.trim() ? { expenseAccountId: input.expenseAccountId.trim() } : {}),
      ...(input.prepaidAccountId?.trim() ? { prepaidAccountId: input.prepaidAccountId.trim() } : {}),
      ...(input.billingInvoiceId?.trim() ? { billingInvoiceId: input.billingInvoiceId.trim() } : {}),
      ...(input.approvalRequestId?.trim() ? { approvalRequestId: input.approvalRequestId.trim() } : {}),
    });
  }

  @Post('expenses/:id/pay')
  async payExpense(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string,
    @Body() input: { treasuryId: string; paymentCurrency: string; postingDate: string; number: string; realizedFxGainAccountId?: string; realizedFxLossAccountId?: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.ecr.postPaidExpense({
      companyId: c.companyId, expenseId: id, actorId: c.actorId, treasuryId: input.treasuryId, paymentCurrency: input.paymentCurrency,
      postingDate: input.postingDate, number: input.number,
      ...(input.realizedFxGainAccountId?.trim() ? { realizedFxGainAccountId: input.realizedFxGainAccountId.trim() } : {}),
      ...(input.realizedFxLossAccountId?.trim() ? { realizedFxLossAccountId: input.realizedFxLossAccountId.trim() } : {}),
    });
  }

  @Post('commissions')
  async createCommission(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: { id?: string; agentPartyId: string; sourceType: string; sourceId: string; currency: string; amount: string; baseCarryingAmount: string; expenseAccountId: string; liabilityAccountId: string; approvalRequestId?: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.ecr.createCommissionClaim({
      id: input.id?.trim() || randomUUID(), companyId: c.companyId, branchId: c.branchId, agentPartyId: input.agentPartyId,
      sourceType: input.sourceType, sourceId: input.sourceId, currency: input.currency, amount: decimalAmount(input.amount),
      baseCarryingAmount: decimalAmount(input.baseCarryingAmount), expenseAccountId: input.expenseAccountId, liabilityAccountId: input.liabilityAccountId,
      requesterActorId: c.actorId,
      ...(input.approvalRequestId?.trim() ? { approvalRequestId: input.approvalRequestId.trim() } : {}),
    });
  }

  @Post('commissions/:id/approve')
  async approveCommission(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string,
    @Body() input: { postingDate: string; number: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.ecr.approveCommission(c.companyId, id, input.postingDate, input.number);
  }

  @Post('commissions/:id/pay')
  async payCommission(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string,
    @Body() input: { paymentId?: string; treasuryId: string; amount: string; paymentCurrency: string; postingDate: string; number: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.ecr.payCommission({
      companyId: c.companyId, claimId: id, paymentId: input.paymentId?.trim() || randomUUID(), treasuryId: input.treasuryId,
      amount: decimalAmount(input.amount), paymentCurrency: input.paymentCurrency, postingDate: input.postingDate, number: input.number,
    });
  }

  @Post('assets')
  async registerAsset(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<RegisterAssetInput, 'companyId' | 'id'> & { id?: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.assets.registerAsset({ ...input, id: input.id?.trim() || randomUUID(), companyId: c.companyId });
  }

  @Post('assets/:id/depreciation')
  async depreciateAsset(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') assetId: string,
    @Body() input: { id?: string; period: number; postingDate: string; number: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.assets.postDepreciation({ id: input.id?.trim() || randomUUID(), companyId: c.companyId, assetId, period: input.period, postingDate: input.postingDate, number: input.number });
  }

  @Post('loans')
  async originateLoan(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: { id?: string; lenderId: string; reference: string; principal: string; currency: string; baseAmount: string; liabilityAccountId: string; interestExpenseAccountId: string; fundingTreasuryId: string; postingDate: string; number: string; installments: { id?: string; dueDate: string; principal: string; interest: string }[] }) {
    const c = await this.context(auth, company, branch, true);
    return this.assets.originateLoan({
      id: input.id?.trim() || randomUUID(), companyId: c.companyId, lenderId: input.lenderId, reference: input.reference,
      principal: decimalAmount(input.principal), currency: input.currency, baseAmount: decimalAmount(input.baseAmount),
      liabilityAccountId: input.liabilityAccountId, interestExpenseAccountId: input.interestExpenseAccountId, fundingTreasuryId: input.fundingTreasuryId,
      postingDate: input.postingDate, number: input.number,
      installments: input.installments.map((item) => ({ id: item.id?.trim() || randomUUID(), dueDate: item.dueDate, principal: decimalAmount(item.principal), interest: decimalAmount(item.interest) })),
    });
  }

  @Post('loans/:loanId/installments/:installmentId/pay')
  async payInstallment(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Param('loanId') loanId: string, @Param('installmentId') installmentId: string, @Body() input: { treasuryId: string; postingDate: string; number: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.assets.payLoanInstallment({ companyId: c.companyId, loanId, installmentId, treasuryId: input.treasuryId, postingDate: input.postingDate, number: input.number });
  }

  @Post('provisions')
  async createProvision(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: { id?: string; name: string; provisionAccountId: string; expenseAccountId: string; releaseAccountId: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.assets.createProvision({ id: input.id?.trim() || randomUUID(), companyId: c.companyId, name: input.name, provisionAccountId: input.provisionAccountId, expenseAccountId: input.expenseAccountId, releaseAccountId: input.releaseAccountId });
  }

  @Post('provisions/:id/movements')
  async moveProvision(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') provisionId: string,
    @Body() input: { id?: string; kind: 'RECOGNIZE' | 'INCREASE' | 'USE' | 'RELEASE'; amount: string; sourceType: string; sourceId: string; postingDate: string; number: string; useOffsetAccountId?: string }) {
    const c = await this.context(auth, company, branch, true);
    return this.assets.moveProvision({
      id: input.id?.trim() || randomUUID(), companyId: c.companyId, provisionId, kind: input.kind, amount: decimalAmount(input.amount),
      sourceType: input.sourceType, sourceId: input.sourceId, postingDate: input.postingDate, number: input.number,
      ...(input.useOffsetAccountId?.trim() ? { useOffsetAccountId: input.useOffsetAccountId.trim() } : {}),
    });
  }
}

@Controller('tourism/contracts-inventory')
export class TourismContractInventoryController {
  constructor(
    @Inject(PlatformCoreApplicationService) private readonly platform: PlatformCoreApplicationService,
    @Inject(TOURISM_CONTRACT_INVENTORY_SERVICE) private readonly inventory: TourismContractInventoryApplicationService,
  ) {}

  private context(auth?: string, company?: string, branch?: string) {
    return tenantContext(this.platform, { authorization: auth, companyId: company, branchId: branch });
  }

  @Post('contracts')
  async createContract(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<CreateTourismContractInput, 'companyId'> & { commandKey?: string }) {
    const c = await this.context(auth, company, branch);
    const { commandKey, ...body } = input;
    return this.inventory.createContract({ ...body, companyId: c.companyId }, commandKey?.trim() || undefined);
  }

  @Get('contracts/:id')
  async contract(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string) {
    const c = await this.context(auth, company, branch);
    return this.inventory.getContract(c.companyId, id);
  }

  @Get('contracts/:id/versions')
  async versions(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string) {
    const c = await this.context(auth, company, branch);
    return this.inventory.getContractVersions(c.companyId, id);
  }

  @Post('hotel-inventory')
  async createHotel(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<CreateHotelInventoryInput, 'companyId'> & { commandKey?: string }) {
    const c = await this.context(auth, company, branch); const { commandKey, ...body } = input;
    return this.inventory.createHotelInventory({ ...body, companyId: c.companyId }, commandKey?.trim() || undefined);
  }

  @Post('flight-blocks')
  async createFlight(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<CreateFlightBlockInput, 'companyId'> & { commandKey?: string }) {
    const c = await this.context(auth, company, branch); const { commandKey, ...body } = input;
    return this.inventory.createFlightBlock({ ...body, companyId: c.companyId }, commandKey?.trim() || undefined);
  }

  @Post('transport-capacity')
  async createTransport(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<CreateTransportCapacityInput, 'companyId'> & { commandKey?: string }) {
    const c = await this.context(auth, company, branch); const { commandKey, ...body } = input;
    return this.inventory.createTransportCapacity({ ...body, companyId: c.companyId }, commandKey?.trim() || undefined);
  }

  @Post('visa-quotas')
  async createVisa(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<CreateVisaQuotaInput, 'companyId'> & { commandKey?: string }) {
    const c = await this.context(auth, company, branch); const { commandKey, ...body } = input;
    return this.inventory.createVisaQuota({ ...body, companyId: c.companyId }, commandKey?.trim() || undefined);
  }

  @Post('stop-sales')
  async stopSale(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<CreateStopSaleInput, 'companyId'> & { commandKey?: string }) {
    const c = await this.context(auth, company, branch); const { commandKey, ...body } = input;
    return this.inventory.createStopSale({ ...body, companyId: c.companyId }, commandKey?.trim() || undefined);
  }

  @Post('availability')
  async availability(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<CheckAvailabilityInput, 'companyId'>) {
    const c = await this.context(auth, company, branch);
    return this.inventory.checkAvailability({ ...input, companyId: c.companyId });
  }

  @Post('allocations')
  async allocate(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<AllocateCapacityInput, 'companyId'> & { commandKey?: string }) {
    const c = await this.context(auth, company, branch); const { commandKey, ...body } = input;
    return this.inventory.allocateCapacity({ ...body, companyId: c.companyId }, commandKey?.trim() || undefined);
  }

  @Get('allocations/:id')
  async allocation(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string) {
    const c = await this.context(auth, company, branch);
    return this.inventory.getAllocation(c.companyId, id);
  }

  @Post('allocations/:id/release')
  async release(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') allocationId: string,
    @Body() input: Omit<ReleaseAllocationInput, 'companyId' | 'allocationId'> & { commandKey?: string }) {
    const c = await this.context(auth, company, branch); const { commandKey, ...body } = input;
    return this.inventory.releaseAllocation({ ...body, allocationId, companyId: c.companyId }, commandKey?.trim() || undefined);
  }
}
