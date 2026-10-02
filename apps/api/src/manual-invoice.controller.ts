import { createHash } from 'node:crypto';
import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { decimalAmount, executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PLATFORM_CORE_PERMISSIONS, PlatformCoreApplicationService } from '@elhafez/platform-core';
import { GeneralLedgerApplicationService, type Account, type AccountClassification } from '@elhafez/general-ledger';
import {
  BillingSubledgersApplicationService,
  ManualInvoiceWorkflowApplicationService,
  type ManualInvoiceLineInput,
  type ManualInvoiceSaveMode,
} from '@elhafez/billing-subledgers';
import { CostBudgetAccountingApplicationService, costCenterId } from '@elhafez/cost-budget-accounting';

type HeaderContext = { authorization?: string; companyId?: string; branchId?: string };

type ManualInvoiceBody = {
  commandKey: string;
  type: 'CUSTOMER' | 'AGENT';
  partyId: string;
  number: string;
  postingDate: string;
  dueDate?: string;
  recognitionDate?: string;
  paymentTerms?: string;
  currency: string;
  saveMode: ManualInvoiceSaveMode;
  lines: ManualInvoiceLineInput[];
};

type AdjustmentBody = {
  commandKey: string;
  kind: 'CREDIT_NOTE' | 'DEBIT_NOTE';
  amount: string;
  postingDate: string;
  number: string;
  offsetAccountId: string;
};

function stableId(...parts: string[]) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

@Controller('accounting/manual-invoices')
export class ManualInvoiceController {
  constructor(
    @Inject(PlatformCoreApplicationService) private readonly platform: PlatformCoreApplicationService,
    @Inject(GeneralLedgerApplicationService) private readonly ledger: GeneralLedgerApplicationService,
    @Inject(BillingSubledgersApplicationService) private readonly billing: BillingSubledgersApplicationService,
    @Inject(ManualInvoiceWorkflowApplicationService) private readonly invoices: ManualInvoiceWorkflowApplicationService,
    @Inject(CostBudgetAccountingApplicationService) private readonly costs: CostBudgetAccountingApplicationService,
  ) {}

  private async context(headers: HeaderContext, permission: string): Promise<ExecutionContext> {
    if (!headers.authorization?.startsWith('Bearer ') || !headers.companyId || !headers.branchId) {
      throw new UnauthorizedException('authenticated company and branch context required');
    }
    const user = await this.platform.currentUser(headers.authorization.slice(7));
    const context = executionContext(headers.companyId, headers.branchId, user.id);
    await this.platform.requireBranchAccess(user.id, context.companyId, context.branchId);
    await this.platform.authorize(user.id, context.companyId, permission);
    return context;
  }

  private headers(authorization?: string, companyId?: string, branchId?: string): HeaderContext {
    return { authorization, companyId, branchId };
  }

  private async ensureAccount(
    c: ExecutionContext,
    accounts: Account[],
    input: { preferredCode: string; name: string; classification: AccountClassification; controlType?: string },
  ) {
    const matching = input.controlType
      ? accounts.find((account) => account.active && account.postable && account.controlType === input.controlType)
      : accounts.find((account) => account.active && account.postable && account.classification === input.classification);
    if (matching) return matching;
    const code = accounts.some((account) => account.code === input.preferredCode)
      ? `${input.preferredCode}-MANUAL`
      : input.preferredCode;
    const created = await this.ledger.createAccount({
      id: stableId(c.companyId, 'GOLDEN_MANUAL_INVOICE_ACCOUNT', input.controlType ?? input.classification),
      companyId: c.companyId,
      code,
      name: input.name,
      classification: input.classification,
      active: true,
      postable: true,
      ...(input.controlType ? { controlType: input.controlType } : {}),
    });
    accounts.push(created);
    return created;
  }

  private async ensureReferences(c: ExecutionContext) {
    const accounts = [...await this.ledger.listAccounts(c.companyId)];
    const customerControl = await this.ensureAccount(c, accounts, {
      preferredCode: '1100', name: 'ذمم العملاء', classification: 'ASSET', controlType: 'CUSTOMER',
    });
    const agentControl = await this.ensureAccount(c, accounts, {
      preferredCode: '1110', name: 'ذمم المندوبين', classification: 'ASSET', controlType: 'AGENT',
    });
    const revenue = await this.ensureAccount(c, accounts, {
      preferredCode: '4100', name: 'إيرادات المبيعات', classification: 'REVENUE',
    });
    return {
      accounts,
      revenueAccounts: accounts.filter((account) => account.active && account.postable && account.classification === 'REVENUE'),
      customerControlAccountId: customerControl.id,
      agentControlAccountId: agentControl.id,
      defaultRevenueAccountId: revenue.id,
      costCenters: await this.costs.list(c.companyId, true),
    };
  }

  private async validatedBody(c: ExecutionContext, body: ManualInvoiceBody) {
    const references = await this.ensureReferences(c);
    const controlAccountId = body.type === 'AGENT'
      ? references.agentControlAccountId
      : references.customerControlAccountId;
    const lines = body.lines.map((line) => ({
      ...line,
      accountId: line.accountId?.trim() || references.defaultRevenueAccountId,
    }));
    for (const line of lines) {
      if (line.costCenterId?.trim()) await this.costs.validateActive(c.companyId, costCenterId(line.costCenterId.trim()));
    }
    return { references, controlAccountId, lines };
  }

  @Post('setup')
  async setup(
    @Headers('authorization') authorization?: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
  ) {
    const c = await this.context(this.headers(authorization, companyId, branchId), PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.ensureReferences(c);
  }

  @Get('references')
  async references(
    @Headers('authorization') authorization?: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
  ) {
    const c = await this.context(this.headers(authorization, companyId, branchId), PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
    const accounts = await this.ledger.listAccounts(c.companyId);
    return {
      accounts,
      revenueAccounts: accounts.filter((account) => account.active && account.postable && account.classification === 'REVENUE'),
      customerControlAccountId: accounts.find((account) => account.active && account.postable && account.controlType === 'CUSTOMER')?.id,
      agentControlAccountId: accounts.find((account) => account.active && account.postable && account.controlType === 'AGENT')?.id,
      defaultRevenueAccountId: accounts.find((account) => account.active && account.postable && account.classification === 'REVENUE')?.id,
      costCenters: await this.costs.list(c.companyId, true),
    };
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Body() body: ManualInvoiceBody,
  ) {
    const c = await this.context(this.headers(authorization, companyId, branchId), PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    const { controlAccountId, lines } = await this.validatedBody(c, body);
    return this.invoices.save({
      commandKey: body.commandKey,
      companyId: c.companyId,
      branchId: c.branchId,
      type: body.type,
      partyId: body.partyId,
      number: body.number,
      postingDate: body.postingDate,
      ...(body.dueDate ? { dueDate: body.dueDate } : {}),
      ...(body.recognitionDate ? { recognitionDate: body.recognitionDate } : {}),
      ...(body.paymentTerms ? { paymentTerms: body.paymentTerms } : {}),
      currency: body.currency,
      controlAccountId,
      lines,
    }, body.saveMode);
  }

  @Patch(':id')
  async edit(
    @Headers('authorization') authorization: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Param('id') id: string,
    @Body() body: ManualInvoiceBody,
  ) {
    const c = await this.context(this.headers(authorization, companyId, branchId), PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    const current = await this.invoices.get(c.companyId, id);
    if (!current || current.branchId !== c.branchId) throw new UnauthorizedException('invoice not found in current branch');
    const { controlAccountId, lines } = await this.validatedBody(c, body);
    return this.invoices.save({
      invoiceId: id,
      commandKey: body.commandKey,
      companyId: c.companyId,
      branchId: c.branchId,
      type: body.type,
      partyId: body.partyId,
      number: body.number,
      postingDate: body.postingDate,
      ...(body.dueDate ? { dueDate: body.dueDate } : {}),
      ...(body.recognitionDate ? { recognitionDate: body.recognitionDate } : {}),
      ...(body.paymentTerms ? { paymentTerms: body.paymentTerms } : {}),
      currency: body.currency,
      controlAccountId,
      lines,
    }, body.saveMode);
  }

  @Post(':id/post')
  async post(
    @Headers('authorization') authorization: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Param('id') id: string,
  ) {
    const c = await this.context(this.headers(authorization, companyId, branchId), PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    const current = await this.invoices.get(c.companyId, id);
    if (!current || current.branchId !== c.branchId) throw new UnauthorizedException('invoice not found in current branch');
    return this.invoices.post(c.companyId, id);
  }

  @Post(':id/cancel')
  async cancel(
    @Headers('authorization') authorization: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Param('id') id: string,
    @Body() body: { postingDate?: string; number?: string },
  ) {
    const c = await this.context(this.headers(authorization, companyId, branchId), PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    const current = await this.invoices.get(c.companyId, id);
    if (!current || current.branchId !== c.branchId) throw new UnauthorizedException('invoice not found in current branch');
    return this.invoices.cancel(c.companyId, id, body.postingDate, body.number);
  }

  @Post(':id/adjustments')
  async adjustment(
    @Headers('authorization') authorization: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Param('id') id: string,
    @Body() body: AdjustmentBody,
  ) {
    const c = await this.context(this.headers(authorization, companyId, branchId), PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    const current = await this.invoices.get(c.companyId, id);
    if (!current || current.branchId !== c.branchId) throw new UnauthorizedException('invoice not found in current branch');
    return this.billing.createAdjustment({
      id: stableId(c.companyId, 'MANUAL_INVOICE_ADJUSTMENT', body.commandKey),
      companyId: c.companyId,
      invoiceId: current.id,
      kind: body.kind,
      amount: decimalAmount(body.amount),
      sourceType: 'MANUAL_ACCOUNTING_ADJUSTMENT',
      sourceId: body.commandKey,
      postingDate: body.postingDate,
      number: body.number,
      offsetAccountId: body.offsetAccountId,
    });
  }

  @Get(':id')
  async get(
    @Headers('authorization') authorization: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Param('id') id: string,
  ) {
    const c = await this.context(this.headers(authorization, companyId, branchId), PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
    const value = await this.invoices.get(c.companyId, id);
    if (!value || value.branchId !== c.branchId) throw new UnauthorizedException('invoice not found in current branch');
    return value;
  }
}
