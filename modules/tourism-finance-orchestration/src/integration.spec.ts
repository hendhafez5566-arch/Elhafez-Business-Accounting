import assert from 'node:assert/strict';
import test from 'node:test';
import {
  companyId,
  currencyCode,
  decimalAmount,
  money,
  sourceReference,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import {
  BillingSubledgersApplicationService,
  type Advance,
  type AdvanceConsumption,
  type Adjustment,
  type Allocation,
  type Invoice,
} from '@elhafez/billing-subledgers';
import {
  TreasurySettlementApplicationService,
  type BankLine,
  type BankMatch,
  type CashCount,
  type Cheque,
  type Transfer,
  type Treasury,
  type TreasuryPolicy,
  type Voucher,
} from '@elhafez/treasury-settlement';
import {
  ExpenseCommissionRecognitionApplicationService,
  type Accrual,
  type CommissionClaim,
  type Expense,
  type RecognitionSchedule,
} from '@elhafez/expense-commission-recognition';
import {
  ProcurementFinanceApplicationService,
  type InvoiceConversion,
  type ProcurementHistory,
  type ProcurementPolicy,
  type PurchaseOrder,
  type SupplierCommitment,
} from '@elhafez/procurement-finance';
import {
  FinancialControlsApplicationService,
  type ApprovalDecision,
  type ApprovalPolicy,
  type ApprovalRequest,
  type TrustedAuthorizationPort,
} from '@elhafez/financial-controls';
import {
  CostBudgetAccountingApplicationService,
  costCenterId,
  type Budget,
  type BudgetActual,
  type CostCenter,
  type ProgramAllocationCostEffect,
  type ProgramCostCenterAssociation,
  type TourismServiceActualization,
} from '@elhafez/cost-budget-accounting';
import type { TourismContractInventoryApplicationService } from '@elhafez/tourism-contract-inventory';
import {
  BillingAdapter,
  CommissionAdapter,
  ControlsAdapter,
  CostAdapter,
  InventoryAdapter,
  ProcurementAdapter,
  TreasuryAdapter,
} from './tourism-finance-orchestration.module.js';

const company = companyId('company-integration');
const program = sourceReference('TOURISM_PROGRAM', 'program-1');
const booking = sourceReference('TOURISM_BOOKING', 'booking-1');
const amount = decimalAmount('125');

const key = (scope: CompanyId | string, id: string) => `${scope}:${id}`;

type LedgerPort = ConstructorParameters<typeof BillingSubledgersApplicationService>[3];

function ledgerFixture() {
  type Journal = Awaited<ReturnType<LedgerPort['post']>>;
  const journals = new Map<string, Journal>();
  const port: LedgerPort = {
    async post(input) {
      const journal: Journal = {
        ...input,
        kind: input.kind ?? 'STANDARD',
        requestHash: `integration:${input.id}`,
        lines: input.lines.map((line, index) => ({
          ...line,
          id: `${input.id}:${index + 1}`,
        })),
      };
      journals.set(journal.id, journal);
      return journal;
    },
    async reverse(companyId, journalId, postingDate, number) {
      const original = journals.get(journalId);
      if (!original) throw new Error(`journal not found: ${journalId}`);
      const journal: Journal = {
        id: `reversal:${journalId}`,
        companyId,
        number,
        postingDate,
        kind: 'REVERSAL',
        sourceType: 'JOURNAL_REVERSAL',
        sourceId: journalId,
        requestHash: `integration-reversal:${journalId}`,
        reversalOfId: journalId,
        lines: original.lines.map((line, index) => ({
          id: `reversal:${journalId}:${index + 1}`,
          accountId: line.accountId,
          ...(line.credit !== undefined ? { debit: line.credit } : {}),
          ...(line.debit !== undefined ? { credit: line.debit } : {}),
          ...(line.partyId ? { partyId: line.partyId } : {}),
          ...(line.foreignAmount ? { foreignAmount: line.foreignAmount } : {}),
          ...(line.foreignCurrency ? { foreignCurrency: line.foreignCurrency } : {}),
          ...(line.fxRateId ? { fxRateId: line.fxRateId } : {}),
          ...(line.fxRate ? { fxRate: line.fxRate } : {}),
        })),
      };
      journals.set(journal.id, journal);
      return journal;
    },
  };
  return { port, journals };
}

function billingFixture() {
  type BillingRepo = ConstructorParameters<typeof BillingSubledgersApplicationService>[0];
  type TaxPort = ConstructorParameters<typeof BillingSubledgersApplicationService>[1];
  type FxPort = ConstructorParameters<typeof BillingSubledgersApplicationService>[2];

  const invoices = new Map<string, Invoice>();
  const allocations = new Map<string, Allocation>();
  const advances = new Map<string, Advance>();
  const consumptions = new Map<string, AdvanceConsumption>();
  const adjustments = new Map<string, Adjustment>();
  const creditLimits = new Map<string, DecimalAmount>();

  const repo: BillingRepo = {
    async invoice(companyId, id) {
      return invoices.get(key(companyId, id));
    },
    async invoiceBySource(companyId, sourceType, sourceId) {
      return [...invoices.values()].find(
        (value) =>
          value.companyId === companyId &&
          value.sourceType === sourceType &&
          value.sourceId === sourceId,
      );
    },
    async supplierExternal(companyId, partyId, externalNumber) {
      return [...invoices.values()].find(
        (value) =>
          value.companyId === companyId &&
          value.partyId === partyId &&
          value.externalInvoiceNumber === externalNumber,
      );
    },
    async invoices(companyId) {
      return [...invoices.values()].filter((value) => value.companyId === companyId);
    },
    async saveInvoice(value) {
      invoices.set(key(value.companyId, value.id), value);
    },
    async startRecognition(companyId, id, reference) {
      const value = invoices.get(key(companyId, id));
      if (!value) throw new Error('invoice not found');
      const next: Invoice = { ...value, recognitionReference: reference };
      invoices.set(key(companyId, id), next);
      return next;
    },
    async markInvoicePosting(companyId, id) {
      const value = invoices.get(key(companyId, id));
      if (!value) throw new Error('invoice not found');
      const next: Invoice = { ...value, status: 'POSTING' };
      invoices.set(key(companyId, id), next);
      return next;
    },
    async beginCancellation(companyId, id) {
      const value = invoices.get(key(companyId, id));
      if (!value) throw new Error('invoice not found');
      const next: Invoice = { ...value, status: 'CANCELLING' };
      invoices.set(key(companyId, id), next);
      return next;
    },
    async finalizeInvoicePosting(value, allocationUpdates, generatedAdvances) {
      invoices.set(key(value.companyId, value.id), value);
      for (const allocation of allocationUpdates) {
        allocations.set(key(allocation.companyId, allocation.id), allocation);
      }
      for (const advance of generatedAdvances) {
        advances.set(key(advance.companyId, advance.id), advance);
      }
    },
    async saveCreditLimit(companyId, partyId, value) {
      creditLimits.set(key(companyId, partyId), value);
    },
    async creditLimit(companyId, partyId) {
      return creditLimits.get(key(companyId, partyId));
    },
    async allocationBySource(companyId, sourceType, sourceId) {
      return [...allocations.values()].find(
        (value) =>
          value.companyId === companyId &&
          value.sourceType === sourceType &&
          value.sourceId === sourceId,
      );
    },
    async saveAllocation(value) {
      allocations.set(key(value.companyId, value.id), value);
    },
    async saveAllocationEffect(value, _invoiceBefore, invoiceAfter, advance) {
      allocations.set(key(value.companyId, value.id), value);
      if (invoiceAfter) invoices.set(key(invoiceAfter.companyId, invoiceAfter.id), invoiceAfter);
      if (advance) advances.set(key(advance.companyId, advance.id), advance);
    },
    async allocations(companyId, invoiceId) {
      return [...allocations.values()].filter(
        (value) =>
          value.companyId === companyId &&
          (invoiceId === undefined || value.invoiceId === invoiceId),
      );
    },
    async advance(companyId, id) {
      return advances.get(key(companyId, id));
    },
    async advances(companyId, partyKind, partyId) {
      return [...advances.values()].filter(
        (value) =>
          value.companyId === companyId &&
          value.partyKind === partyKind &&
          value.partyId === partyId,
      );
    },
    async saveAdvance(value) {
      advances.set(key(value.companyId, value.id), value);
    },
    async consumptionBySource(companyId, sourceType, sourceId) {
      return [...consumptions.values()].find(
        (value) =>
          value.companyId === companyId &&
          value.sourceType === sourceType &&
          value.sourceId === sourceId,
      );
    },
    async saveAdvanceConsumptionEffect(consumption, _advanceBefore, advanceAfter) {
      consumptions.set(key(consumption.companyId, consumption.id), consumption);
      advances.set(key(advanceAfter.companyId, advanceAfter.id), advanceAfter);
    },
    async adjustment(companyId, id) {
      return adjustments.get(key(companyId, id));
    },
    async adjustmentBySource(companyId, sourceType, sourceId) {
      return [...adjustments.values()].find(
        (value) =>
          value.companyId === companyId &&
          value.sourceType === sourceType &&
          value.sourceId === sourceId,
      );
    },
    async adjustments(companyId, invoiceId) {
      return [...adjustments.values()].filter(
        (value) =>
          value.companyId === companyId &&
          (invoiceId === undefined || value.invoiceId === invoiceId),
      );
    },
    async saveAdjustment(value) {
      adjustments.set(key(value.companyId, value.id), value);
    },
    async saveAdjustmentEffect(value, _invoiceBefore, invoiceAfter, advance) {
      adjustments.set(key(value.companyId, value.id), value);
      invoices.set(key(invoiceAfter.companyId, invoiceAfter.id), invoiceAfter);
      if (advance) advances.set(key(advance.companyId, advance.id), advance);
    },
  };

  const tax: TaxPort = {
    async snapshotInvoiceLine() {
      throw new Error('tax snapshot is not expected in AC-12 integration fixtures');
    },
  };
  const fx: FxPort = {
    async getBaseCurrency(companyId) {
      return {
        companyId,
        code: currencyCode('EGP'),
        precision: 2,
        isBase: true,
        status: 'ACTIVE',
      };
    },
    async calculateSettlement(companyId, source, toCurrency, effectiveAt) {
      return {
        converted: money(source.amount, toCurrency),
        rate: {
          rateId: `integration-rate:${source.currency}:${toCurrency}`,
          companyId,
          fromCurrency: source.currency,
          toCurrency,
          effectiveAt,
          rate: decimalAmount('1'),
          source: 'INTEGRATION_TEST',
        },
      };
    },
  };
  const ledger = ledgerFixture();
  const service = new BillingSubledgersApplicationService(repo, tax, fx, ledger.port);
  return { service, invoices, allocations, advances, journals: ledger.journals };
}

async function postedBookingInvoice(
  service: BillingSubledgersApplicationService,
  id = 'invoice-1',
) {
  return new BillingAdapter(service).createBookingInvoice({
    id,
    companyId: company,
    branchId: 'branch-1',
    partyId: 'customer-1',
    number: 'INV-1',
    postingDate: '2026-09-19',
    dueDate: '2026-09-30',
    currency: 'EGP',
    sourceId: booking.sourceId,
    receivableAccountId: 'ar',
    revenueAccountId: 'revenue',
    amount,
  });
}

function treasuryFixture(billing: BillingSubledgersApplicationService) {
  type TreasuryRepo = ConstructorParameters<typeof TreasurySettlementApplicationService>[0];
  type ControlsPort = ConstructorParameters<typeof TreasurySettlementApplicationService>[3];

  const treasuries = new Map<string, Treasury>();
  const policies = new Map<string, TreasuryPolicy>();
  const vouchers = new Map<string, Voucher>();
  const transfers = new Map<string, Transfer>();
  const cheques = new Map<string, Cheque>();
  const cashCounts = new Map<string, CashCount>();
  const bankLines = new Map<string, BankLine>();
  const bankMatches = new Map<string, BankMatch>();

  const repo: TreasuryRepo = {
    async treasury(companyId, id) {
      return treasuries.get(key(companyId, id));
    },
    async treasuries(companyId) {
      return [...treasuries.values()].filter((value) => value.companyId === companyId);
    },
    async saveTreasury(value) {
      treasuries.set(key(value.companyId, value.id), value);
    },
    async deactivateTreasury(value) {
      const next: Treasury = { ...value, active: false };
      treasuries.set(key(next.companyId, next.id), next);
      return next;
    },
    async policy(companyId) {
      return policies.get(String(companyId));
    },
    async savePolicy(value) {
      policies.set(String(value.companyId), value);
    },
    async voucher(companyId, id) {
      return vouchers.get(key(companyId, id));
    },
    async voucherBySource(companyId, sourceType, sourceId) {
      return [...vouchers.values()].find(
        (value) =>
          value.companyId === companyId &&
          value.sourceType === sourceType &&
          value.sourceId === sourceId,
      );
    },
    async vouchers(companyId, treasuryId) {
      return [...vouchers.values()].filter(
        (value) =>
          value.companyId === companyId &&
          (treasuryId === undefined || value.treasuryId === treasuryId),
      );
    },
    async reserveVoucher(value) {
      vouchers.set(key(value.companyId, value.id), value);
      return value;
    },
    async saveVoucher(value) {
      vouchers.set(key(value.companyId, value.id), value);
    },
    async transferBySource(companyId, sourceType, sourceId) {
      return [...transfers.values()].find(
        (value) =>
          value.companyId === companyId &&
          value.sourceType === sourceType &&
          value.sourceId === sourceId,
      );
    },
    async transfers(companyId) {
      return [...transfers.values()].filter((value) => value.companyId === companyId);
    },
    async reserveTransfer(value) {
      transfers.set(key(value.companyId, value.id), value);
      return value;
    },
    async saveTransfer(value) {
      transfers.set(key(value.companyId, value.id), value);
    },
    async createCheque(value) {
      cheques.set(key(value.companyId, value.id), value);
    },
    async saveCheque(value) {
      cheques.set(key(value.companyId, value.id), value);
    },
    async cheque(companyId, id) {
      return cheques.get(key(companyId, id));
    },
    async cashCount(companyId, id) {
      return cashCounts.get(key(companyId, id));
    },
    async cashCounts(companyId, treasuryId) {
      return [...cashCounts.values()].filter(
        (value) =>
          value.companyId === companyId &&
          (treasuryId === undefined || value.treasuryId === treasuryId),
      );
    },
    async saveCashCount(value) {
      cashCounts.set(key(value.companyId, value.id), value);
    },
    async saveBankLine(value) {
      bankLines.set(key(value.companyId, value.id), value);
    },
    async bankLine(companyId, id) {
      return bankLines.get(key(companyId, id));
    },
    async bankLines(companyId, treasuryId) {
      return [...bankLines.values()].filter(
        (value) => value.companyId === companyId && value.treasuryId === treasuryId,
      );
    },
    async saveBankMatchEffect(value, _lineBefore, lineAfter) {
      bankMatches.set(key(value.companyId, value.lineId), value);
      bankLines.set(key(lineAfter.companyId, lineAfter.id), lineAfter);
    },
    async bankMatch(companyId, lineId) {
      return bankMatches.get(key(companyId, lineId));
    },
  };
  const ledger = ledgerFixture();
  const controls: ControlsPort = {
    async evaluateApprovalRequirement() {
      return { decision: 'APPROVAL_NOT_REQUIRED' };
    },
    async getApprovalRequest() {
      return undefined;
    },
    async getApprovalDecision() {
      return undefined;
    },
  };
  const service = new TreasurySettlementApplicationService(
    repo,
    billing,
    ledger.port,
    controls,
  );
  return { service, vouchers, journals: ledger.journals };
}

async function createCashTreasury(service: TreasurySettlementApplicationService) {
  return service.createTreasury({
    id: 'cash',
    companyId: company,
    code: 'CASH',
    name: 'Cash',
    type: 'CASH',
    currency: 'EGP',
    glAccountId: 'cash-account',
  });
}

function ecrFixture() {
  type Repo = ConstructorParameters<typeof ExpenseCommissionRecognitionApplicationService>[0];
  type BillingPort = ConstructorParameters<typeof ExpenseCommissionRecognitionApplicationService>[1];
  type TreasuryPort = ConstructorParameters<typeof ExpenseCommissionRecognitionApplicationService>[2];
  type FxPort = ConstructorParameters<typeof ExpenseCommissionRecognitionApplicationService>[4];
  type ControlsPort = ConstructorParameters<typeof ExpenseCommissionRecognitionApplicationService>[5];

  const expenses = new Map<string, Expense>();
  const schedules = new Map<string, RecognitionSchedule>();
  const claims = new Map<string, CommissionClaim>();
  const accruals = new Map<string, Accrual>();
  type SupplierSettlement = NonNullable<Awaited<ReturnType<Repo['supplierSettlement']>>>;
  const supplierSettlements = new Map<string, SupplierSettlement>();

  const repo: Repo = {
    async expense(companyId, id) {
      return expenses.get(key(companyId, id));
    },
    async saveExpense(value) {
      expenses.set(key(value.companyId, value.id), value);
    },
    async schedule(companyId, id) {
      return schedules.get(key(companyId, id));
    },
    async scheduleByInvoice(companyId, invoiceId, kind) {
      return [...schedules.values()].find(
        (value) =>
          value.companyId === companyId &&
          value.sourceInvoiceId === invoiceId &&
          value.kind === kind,
      );
    },
    async saveSchedule(value) {
      schedules.set(key(value.companyId, value.id), value);
    },
    async setInitialJournalId(companyId, scheduleId, journalId) {
      const value = schedules.get(key(companyId, scheduleId));
      if (!value) throw new Error('schedule not found');
      schedules.set(key(companyId, scheduleId), { ...value, initialJournalId: journalId });
    },
    async transitionRecognitionPart(
      companyId,
      scheduleId,
      partId,
      expectedStatus,
      expectedCycle,
      next,
    ) {
      const value = schedules.get(key(companyId, scheduleId));
      if (!value) throw new Error('schedule not found');
      const current = value.parts.find((part) => part.id === partId);
      if (!current || current.status !== expectedStatus || current.cycle !== expectedCycle) {
        throw new Error('recognition part compare-and-set failed');
      }
      const parts = value.parts.map((part) => (part.id === partId ? next : part));
      schedules.set(key(companyId, scheduleId), { ...value, parts });
      return next;
    },
    async claim(companyId, id) {
      return claims.get(key(companyId, id));
    },
    async saveClaim(value) {
      claims.set(key(value.companyId, value.id), value);
    },
    async reserveCommissionPayment(companyId, claimId, payment) {
      const claim = claims.get(key(companyId, claimId));
      if (!claim) throw new Error('claim not found');
      const existing = claim.payments.find((value) => value.id === payment.id);
      if (existing) return { claim, payment: existing };
      const next: CommissionClaim = { ...claim, payments: [...claim.payments, payment] };
      claims.set(key(companyId, claimId), next);
      return { claim: next, payment };
    },
    async finalizeCommissionPayment(companyId, claimId, payment) {
      const claim = claims.get(key(companyId, claimId));
      if (!claim) throw new Error('claim not found');
      const payments = claim.payments.map((value) => (value.id === payment.id ? payment : value));
      const next: CommissionClaim = { ...claim, payments };
      claims.set(key(companyId, claimId), next);
      return next;
    },
    async accrual(companyId, id) {
      return accruals.get(key(companyId, id));
    },
    async saveAccrual(value) {
      accruals.set(key(value.companyId, value.id), value);
    },
    async supplierSettlement(companyId, id) {
      return supplierSettlements.get(key(companyId, id));
    },
    async saveSupplierSettlement(value) {
      supplierSettlements.set(key(value.companyId, value.id), value);
    },
  };
  const billing: BillingPort = {
    async recordRecognitionStarted() {
      throw new Error('billing recognition is not expected in commission cancellation coverage');
    },
    async getOpenPosition() {
      throw new Error('billing open position is not expected in commission cancellation coverage');
    },
    async getAdvance() {
      throw new Error('billing advance is not expected in commission cancellation coverage');
    },
    async consumeAdvance() {
      throw new Error('billing advance consumption is not expected in commission cancellation coverage');
    },
  };
  const treasury: TreasuryPort = {
    async postOwnerPayment() {
      throw new Error('commission payment is not expected in unpaid cancellation coverage');
    },
    async postSupplierAdvanceRefundReceipt() {
      throw new Error('supplier refund is not expected in commission cancellation coverage');
    },
    async getTreasurySnapshot() {
      throw new Error('treasury snapshot is not expected in commission cancellation coverage');
    },
  };
  const ledger = ledgerFixture();
  const fx: FxPort = {
    async getBaseCurrency() {
      throw new Error('FX is not expected before commission approval');
    },
    async calculateSettlement() {
      throw new Error('FX is not expected before commission approval');
    },
  };
  const controls: ControlsPort = {
    async evaluateApprovalRequirement() {
      return { decision: 'APPROVAL_NOT_REQUIRED' };
    },
    async getApprovalRequest() {
      return undefined;
    },
    async getApprovalDecision() {
      return undefined;
    },
  };
  const service = new ExpenseCommissionRecognitionApplicationService(
    repo,
    billing,
    treasury,
    ledger.port,
    fx,
    controls,
  );
  return { service, claims };
}

function procurementFixture() {
  type Repo = ConstructorParameters<typeof ProcurementFinanceApplicationService>[0];
  type BillingPort = ConstructorParameters<typeof ProcurementFinanceApplicationService>[1];

  const policies = new Map<string, ProcurementPolicy>();
  const commitments = new Map<string, SupplierCommitment>();
  const purchaseOrders = new Map<string, PurchaseOrder>();
  const conversions = new Map<string, InvoiceConversion>();
  const history = new Map<string, ProcurementHistory[]>();

  const appendHistory = (value: ProcurementHistory) => {
    const id = key(value.companyId, value.aggregateId);
    history.set(id, [...(history.get(id) ?? []), value]);
  };

  const repo: Repo = {
    async policy(companyId) {
      return policies.get(String(companyId));
    },
    async savePolicy(value) {
      policies.set(String(value.companyId), value);
      return value;
    },
    async commitment(companyId, id) {
      return commitments.get(key(companyId, id));
    },
    async commitmentBySource(companyId, sourceType, sourceId) {
      return [...commitments.values()].find(
        (value) =>
          value.companyId === companyId &&
          value.sourceType === sourceType &&
          value.sourceId === sourceId,
      );
    },
    async saveCommitment(value, record) {
      commitments.set(key(value.companyId, value.id), value);
      appendHistory(record);
      return value;
    },
    async cancelCommitment(companyId, id, reason, at) {
      const value = commitments.get(key(companyId, id));
      if (!value) throw new Error('commitment not found');
      const next: SupplierCommitment = {
        ...value,
        status: 'CANCELLED',
        cancelReason: reason,
        cancelledAt: at,
      };
      commitments.set(key(companyId, id), next);
      return next;
    },
    async po(companyId, id) {
      return purchaseOrders.get(key(companyId, id));
    },
    async listPos(companyId, branchId) {
      return [...purchaseOrders.values()].filter(
        (value) =>
          value.companyId === companyId &&
          (branchId === undefined || value.branchId === branchId),
      );
    },
    async posByCommitment(companyId, commitmentId) {
      return [...purchaseOrders.values()].filter(
        (value) => value.companyId === companyId && value.commitmentId === commitmentId,
      );
    },
    async poByNumber(companyId, branchId, number) {
      return [...purchaseOrders.values()].find(
        (value) =>
          value.companyId === companyId &&
          value.branchId === branchId &&
          value.number === number,
      );
    },
    async nextPoNumber(_companyId, _branchId, _year) {
      throw new Error('PO numbering is not expected in cancellation cleanup coverage');
    },
    async savePo(value, record) {
      purchaseOrders.set(key(value.companyId, value.id), value);
      appendHistory(record);
      return value;
    },
    async updateDraftPo() {
      throw new Error('PO draft editing is not expected in cancellation cleanup coverage');
    },
    async approvePo() {
      throw new Error('PO approval is not expected in cancellation cleanup coverage');
    },
    async transitionPo(companyId, id, _from, to, record) {
      const value = purchaseOrders.get(key(companyId, id));
      if (!value) throw new Error('purchase order not found');
      if (to !== 'DISPOSED' && to !== 'CANCELLED') {
        throw new Error(`unexpected PO transition: ${to}`);
      }
      const next: PurchaseOrder = {
        ...value,
        status: to === 'DISPOSED' ? 'DISPOSED' : 'CANCELLED',
      };
      purchaseOrders.set(key(companyId, id), next);
      appendHistory(record);
      return next;
    },
    async receive() {
      throw new Error('PO receipt is not expected in cancellation cleanup coverage');
    },
    async adjustReceived() {
      throw new Error('PO receipt correction is not expected in cancellation cleanup coverage');
    },
    async conversion(companyId, id) {
      return conversions.get(key(companyId, id));
    },
    async reserveConversion(value) {
      conversions.set(key(value.companyId, value.id), value);
      return value;
    },
    async completeConversion(companyId, id, billingInvoiceId) {
      const value = conversions.get(key(companyId, id));
      if (!value) throw new Error('conversion not found');
      const next: InvoiceConversion = { ...value, billingInvoiceId, status: 'INVOICED' };
      conversions.set(key(companyId, id), next);
      return next;
    },
    async reopenConversion(companyId, id) {
      const value = conversions.get(key(companyId, id));
      if (!value) throw new Error('conversion not found');
      const next: InvoiceConversion = { ...value, status: 'REOPENED' };
      conversions.set(key(companyId, id), next);
      return next;
    },
    async history(companyId, aggregateId) {
      return history.get(key(companyId, aggregateId)) ?? [];
    },
  };
  const billing: BillingPort = {
    async createDraft() {
      throw new Error('Billing is not expected for empty PO cancellation cleanup');
    },
    async postInvoice() {
      throw new Error('Billing is not expected for empty PO cancellation cleanup');
    },
    async getOpenPosition() {
      throw new Error('Billing is not expected for empty PO cancellation cleanup');
    },
  };
  const suppliers = {
    async assertSupplierReferenceUsableForProcurementForIntegration(
      _companyId: CompanyId,
      supplierId: string,
    ) {
      return { partyId: supplierId };
    },
  };
  const service = new ProcurementFinanceApplicationService(repo, billing, suppliers as never);
  return { service, purchaseOrders };
}

function controlsFixture() {
  type Repo = ConstructorParameters<typeof FinancialControlsApplicationService>[0];

  const policies = new Map<string, ApprovalPolicy>();
  const requests = new Map<string, ApprovalRequest>();
  const decisions = new Map<string, ApprovalDecision>();

  const repo: Repo = {
    async savePolicy(value) {
      policies.set(key(value.companyId, value.action), value);
    },
    async findPolicy(companyId, action) {
      return policies.get(key(companyId, action));
    },
    async saveRequest(value) {
      requests.set(key(value.companyId, value.id), value);
    },
    async findRequest(companyId, id) {
      return requests.get(key(companyId, id));
    },
    async saveDecision(value) {
      decisions.set(key(value.companyId, value.requestId), value);
    },
    async findDecision(companyId, requestId) {
      return decisions.get(key(companyId, requestId));
    },
    async saveRun() {
      throw new Error('reconciliation is not expected in approval integration coverage');
    },
    async findRun() {
      return undefined;
    },
    async findIssue() {
      return undefined;
    },
    async resolveIssue() {
      throw new Error('issue resolution is not expected in approval integration coverage');
    },
    async saveCloseRun(value) {
      return value;
    },
    async findCloseRun() {
      return undefined;
    },
    async saveEvidence() {},
  };
  const authorization: TrustedAuthorizationPort = {
    async canApprove(actorId, _companyId, authority) {
      return actorId === 'approver' && authority === 'approve.booking';
    },
    async canAccessBranch() {
      return true;
    },
    async canResolveControlIssue() {
      return false;
    },
  };
  return {
    service: new FinancialControlsApplicationService(repo, authorization),
    requests,
    decisions,
  };
}

function costFixture() {
  type Repo = ConstructorParameters<typeof CostBudgetAccountingApplicationService>[0];

  const centers = new Map<string, CostCenter>();
  const associations = new Map<string, ProgramCostCenterAssociation>();
  const budgets = new Map<string, Budget>();
  const actuals = new Map<string, BudgetActual>();
  const allocationEffects = new Map<string, ProgramAllocationCostEffect>();
  const actualizations = new Map<string, TourismServiceActualization>();

  const programKey = (companyId: CompanyId, value: typeof program) =>
    `${companyId}:${value.sourceType}:${value.sourceId}`;

  const repo: Repo = {
    async save(value) {
      centers.set(key(value.companyId, value.id), value);
    },
    async find(companyId, id) {
      return centers.get(key(companyId, id));
    },
    async findByCode(companyId, code) {
      return [...centers.values()].find(
        (value) => value.companyId === companyId && value.code === code,
      );
    },
    async saveAssociation(value) {
      associations.set(programKey(value.companyId, value.program), value);
    },
    async findAssociation(companyId, value) {
      return associations.get(programKey(companyId, value));
    },
    async saveBudget(value) {
      budgets.set(key(value.companyId, value.id), value);
    },
    async budget(companyId, id) {
      return budgets.get(key(companyId, id));
    },
    async budgets(companyId, costCenter) {
      return [...budgets.values()].filter(
        (value) =>
          value.companyId === companyId && value.costCenterId === costCenter,
      );
    },
    async saveActual(value) {
      actuals.set(key(value.companyId, value.id), value);
    },
    async actuals(companyId, costCenter) {
      return [...actuals.values()].filter(
        (value) =>
          value.companyId === companyId && value.costCenterId === costCenter,
      );
    },
    async saveProgramAllocationCostEffect(value) {
      allocationEffects.set(key(value.companyId, value.id), value);
    },
    async programAllocationCostEffect(companyId, id) {
      return allocationEffects.get(key(companyId, id));
    },
    async saveTourismServiceActualization(value) {
      const id = key(value.companyId, value.id);
      if (actualizations.has(id)) {
        class UniqueConstraintError extends Error {
          readonly code = 'P2002';
        }
        throw new UniqueConstraintError('duplicate');
      }
      actualizations.set(id, value);
    },
    async tourismServiceActualization(companyId, id) {
      return actualizations.get(key(companyId, id));
    },
  };
  return {
    service: new CostBudgetAccountingApplicationService(repo),
    actualizations,
  };
}

test('AC-12 -> Billing executes real createDraft/postInvoice and persists posted Billing state', async () => {
  const fixture = billingFixture();
  const result = await postedBookingInvoice(fixture.service);

  assert.equal(result.status, 'POSTED');
  assert.equal(result.baseTotal, amount);
  assert.equal(result.outstanding, amount);
  assert.equal(fixture.invoices.get(key(company, 'invoice-1'))?.status, 'POSTED');
  assert.equal(fixture.journals.get('billing:invoice-1')?.sourceType, 'BILLING_INVOICE');
});

test('AC-12 -> Treasury -> Billing executes real settlement allocation and economic effect', async () => {
  const billing = billingFixture();
  await postedBookingInvoice(billing.service);
  const treasury = treasuryFixture(billing.service);
  await createCashTreasury(treasury.service);

  const voucher = await new TreasuryAdapter(treasury.service).postDeposit({
    id: 'voucher-1',
    companyId: company,
    branchId: 'branch-1',
    treasuryId: 'cash',
    partyId: 'customer-1',
    invoiceId: 'invoice-1',
    number: 'R-1',
    postingDate: '2026-09-19',
    amount,
    controlAccountId: 'ar',
    advanceAccountId: 'advance',
  });

  const position = await billing.service.getOpenPosition(company, 'invoice-1');
  assert.equal(voucher.status, 'POSTED');
  assert.equal(position.outstanding, '0');
  assert.equal(voucher.allocationIds.length, 1);
  const allocation = billing.allocations.get(key(company, voucher.allocationIds[0]!));
  assert.equal(allocation?.appliedAmount, amount);
  assert.equal(allocation?.settlementId, voucher.id);
});

test('Treasury reversal executes real Billing reversal while historical cancellation evidence remains', async () => {
  const billing = billingFixture();
  await postedBookingInvoice(billing.service);
  const treasury = treasuryFixture(billing.service);
  await createCashTreasury(treasury.service);
  const treasuryAdapter = new TreasuryAdapter(treasury.service);
  const billingAdapter = new BillingAdapter(billing.service);

  await treasuryAdapter.postDeposit({
    id: 'voucher-reversal',
    companyId: company,
    branchId: 'branch-1',
    treasuryId: 'cash',
    partyId: 'customer-1',
    invoiceId: 'invoice-1',
    number: 'R-2',
    postingDate: '2026-09-19',
    amount,
    controlAccountId: 'ar',
    advanceAccountId: 'advance',
  });

  const before = await billingAdapter.cancellationEvidence(company, 'invoice-1');
  assert.equal(before.settlementRequired, true);
  assert.equal(before.hasHistoricalAllocationEvidence, true);

  const reversed = await treasuryAdapter.reverseDeposit(
    company,
    'voucher-reversal',
    '2026-09-20',
    'RV-2',
  );
  const after = await billingAdapter.cancellationEvidence(company, 'invoice-1');
  const position = await billing.service.getOpenPosition(company, 'invoice-1');

  assert.equal(reversed.status, 'REVERSED');
  assert.equal(after.settlementRequired, false);
  assert.equal(after.cancellationSafe, true);
  assert.equal(after.hasHistoricalAllocationEvidence, true);
  assert.deepEqual(after.activeAllocationIds, []);
  assert.equal(position.outstanding, amount);
});

test('AC-12 -> ECR executes real claim creation, cancellation evidence, and unpaid reversal', async () => {
  const fixture = ecrFixture();
  const adapter = new CommissionAdapter(fixture.service);

  const created = await adapter.create({
    id: 'claim-1',
    companyId: company,
    branchId: 'branch-1',
    agentPartyId: 'agent-1',
    sourceId: booking.sourceId,
    currency: 'EGP',
    amount,
    expenseAccountId: 'commission-expense',
    liabilityAccountId: 'commission-payable',
  });
  const before = await adapter.evidence(company, created.id);
  const reversed = await adapter.reverse(company, created.id, '2026-09-20', 'REV-COMM-1');
  const after = await adapter.evidence(company, created.id);

  assert.equal(created.status, 'DRAFT');
  assert.equal(before.hasPostedPaymentHistory, false);
  assert.equal(before.reversible, true);
  assert.equal(reversed.status, 'REVERSED');
  assert.equal(after.status, 'REVERSED');
  assert.equal(after.reversible, false);
  assert.equal(fixture.claims.get(key(company, created.id))?.status, 'REVERSED');
});

test('AC-12 -> Procurement delegates to real owner cleanup policy', async () => {
  const fixture = procurementFixture();
  await fixture.service.createPurchaseOrder({
    id: 'po-1',
    companyId: company,
    branchId: 'branch-a',
    supplierId: 'supplier-1',
    number: 'PO-1',
    origin: 'AUTO',
    lines: [
      {
        id: 'po-1-line',
        itemReference: 'hotel-service',
        orderedQuantity: decimalAmount('2'),
      },
    ],
  });

  const result = await new ProcurementAdapter(fixture.service).cleanupForProgramCancellation(
    company,
    { purchaseOrderId: 'po-1' },
  );

  assert.equal(result.status, 'DISPOSED');
  assert.equal((await fixture.service.getPurchaseOrder(company, 'po-1')).status, 'DISPOSED');
  assert.equal(fixture.purchaseOrders.get(key(company, 'po-1'))?.status, 'DISPOSED');
});

test('AC-12 -> Financial Controls executes real BOOKING_DISCOUNT policy/request/decision', async () => {
  const fixture = controlsFixture();
  await fixture.service.configureApprovalPolicy({
    id: 'booking-discount-policy',
    companyId: company,
    action: 'BOOKING_DISCOUNT',
    threshold: '1',
    active: true,
    forbidSelfApproval: true,
    requiredAuthority: 'approve.booking',
  });
  const request = await fixture.service.requestApproval({
    id: 'approval-1',
    companyId: company,
    branchId: 'branch-1',
    action: 'BOOKING_DISCOUNT',
    sourceType: booking.sourceType,
    sourceId: booking.sourceId,
    requesterActorId: 'requester',
    amount,
    requestedAt: '2026-09-19T00:00:00.000Z',
  });
  await fixture.service.decideApproval({
    companyId: company,
    requestId: request.id,
    decisionId: 'approval-decision-1',
    actorId: 'approver',
    outcome: 'APPROVED',
    decidedAt: '2026-09-19T01:00:00.000Z',
  });

  const adapter = new ControlsAdapter(fixture.service);
  await adapter.authorizeDiscount({
    companyId: company,
    branchId: 'branch-1',
    booking,
    amount,
    approvalRequestId: request.id,
  });

  assert.equal(await adapter.approvalResolved(company, request.id), true);
  assert.equal(fixture.requests.get(key(company, request.id))?.action, 'BOOKING_DISCOUNT');
  assert.equal(fixture.decisions.get(key(company, request.id))?.outcome, 'APPROVED');
});

test('AC-12 -> Cost executes real program association and idempotent Tourism actualization', async () => {
  const fixture = costFixture();
  const center = costCenterId('cc-1');
  await fixture.service.create({
    id: center,
    companyId: company,
    code: 'PROGRAM_1',
    name: 'Program 1',
    status: 'ACTIVE',
  });

  const adapter = new CostAdapter(fixture.service);
  assert.deepEqual(await adapter.ensureProgram(company, program, center), {
    costCenterId: center,
  });
  assert.deepEqual(await adapter.resolveProgram(company, program), {
    costCenterId: center,
  });

  const command = {
    id: 'cost-actualization-1',
    companyId: company,
    program,
    service: sourceReference('TOURISM_SERVICE', 'service-1'),
    evidence: sourceReference('FLIGHT_SEGMENT', 'segment-1'),
    amount,
    postingDate: '2026-09-19',
  };
  const first = await adapter.actualize(command);
  const replay = await adapter.actualize(command);

  assert.deepEqual(replay, first);
  assert.equal(first.costCenterId, center);
  assert.equal(fixture.actualizations.size, 1);
});

test('AC-12 -> Inventory exercises the legitimate public service boundary for allocation/release', async () => {
  type InventoryPort = Pick<
    TourismContractInventoryApplicationService,
    'allocateCapacity' | 'getReleaseBlockers' | 'releaseAllocation'
  >;

  const allocations = new Map<
    string,
    NonNullable<Awaited<ReturnType<InventoryPort['allocateCapacity']>>['allocation']>
  >();
  const released = new Set<string>();
  const allocationByKey = new Map<
    string,
    Awaited<ReturnType<InventoryPort['allocateCapacity']>>
  >();
  const releaseByKey = new Map<
    string,
    Awaited<ReturnType<InventoryPort['releaseAllocation']>>
  >();

  const service: InventoryPort = {
    async allocateCapacity(value, idempotencyKey) {
      const id = idempotencyKey ?? 'no-key';
      const prior = allocationByKey.get(id);
      if (prior) return prior;
      const allocation = {
        id: 'allocation-1',
        companyId: value.companyId,
        contractId: value.contractId,
        contractVersionId: 'version-1',
        resourceType: value.resourceType,
        resourceId: value.resourceId,
        program: value.program,
        serviceDate: value.serviceDate,
        quantity: value.quantity,
        status: 'CONFIRMED' as const,
        createdAt: '2026-09-19T00:00:00.000Z',
      };
      allocations.set(allocation.id, allocation);
      const result = { allocation };
      allocationByKey.set(id, result);
      return result;
    },
    async getReleaseBlockers() {
      return [];
    },
    async releaseAllocation(value, idempotencyKey) {
      const id = idempotencyKey ?? 'no-key';
      const prior = releaseByKey.get(id);
      if (prior) return prior;
      const allocation = allocations.get(value.allocationId);
      if (!allocation || released.has(value.allocationId)) {
        throw new Error('active allocation required');
      }
      released.add(value.allocationId);
      const result = { success: true, releasedQuantity: value.quantity };
      releaseByKey.set(id, result);
      return result;
    },
  };

  const adapter = new InventoryAdapter(service);
  const allocation = await adapter.allocate(
    {
      companyId: company,
      allocationId: 'allocation-1',
      contractId: 'contract-1',
      resourceType: 'HOTEL',
      resourceId: 'room-1',
      program,
      serviceDate: '2026-10-01',
      quantity: decimalAmount('2'),
    },
    'allocate-key',
  );
  assert.deepEqual(await adapter.blockers(company, 'allocation-1'), []);
  const release = await adapter.release(
    company,
    'allocation-1',
    decimalAmount('2'),
    'release-key',
  );

  assert.deepEqual(allocation, {
    allocationId: 'allocation-1',
    procurementReference: undefined,
  });
  assert.deepEqual(release, { success: true });
  assert.equal(released.has('allocation-1'), true);
});
