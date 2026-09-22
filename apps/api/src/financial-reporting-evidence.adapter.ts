import { Injectable } from '@nestjs/common';
import { decimalAmount, sourceReference, type BranchId, type CurrencyCode, type DecimalAmount } from '@elhafez/contracts';
import type { Account, Journal, JournalLine } from '@elhafez/general-ledger';
import type { Invoice, Advance } from '@elhafez/billing-subledgers';
import type { Voucher } from '@elhafez/treasury-settlement';
import type { ProgramCostCenterAssociation } from '@elhafez/cost-budget-accounting';
import type { TaxSnapshot } from '@elhafez/tax';
import { FinancialReportingApplicationService } from '@elhafez/financial-reporting';

/** Composition-root-only trusted adapter: maps owner public results into disposable Reporting evidence. */
@Injectable()
export class FinancialReportingEvidenceAdapter {
  constructor(private readonly reporting: FinancialReportingApplicationService) {}
  async consumeJournal(journal: Journal, branchId: BranchId | undefined, baseCurrency: Readonly<{ code: CurrencyCode }>, accounts: readonly Account[]) {
    const classifications = new Map(accounts.map((account) => [account.id, account.classification]));
    return Promise.all(journal.lines.map((line) => this.reporting.ingest({ evidenceId: `GL:${journal.id}:${line.id}`, companyId: journal.companyId, ...(branchId ? { branchId } : {}), occurredAt: `${journal.postingDate}T00:00:00.000Z`, postingDate: journal.postingDate, currency: baseCurrency.code, kind: 'GL_LINE', source: sourceReference('JOURNAL', journal.id), authoritativeReference: sourceReference('JOURNAL_LINE', line.id), amount: subtract(line.debit ?? decimalAmount('0'), line.credit ?? decimalAmount('0')), accountId: line.accountId, accountClass: classifications.get(line.accountId) ?? fail(`missing classification for ${line.accountId}`), ...(journal.reversalOfId ? { reversesEvidenceId: `GL:${journal.reversalOfId}:${line.id}` } : {}) })));
  }
  async consumeProgramAccounting(journal: Journal, association: ProgramCostCenterAssociation, baseCurrency: Readonly<{ code: CurrencyCode }>, accounts: readonly Account[]) {
    const classifications = new Map(accounts.map((account) => [account.id, account.classification]));
    const accountingLines: { line: JournalLine; dimension: 'REVENUE' | 'COST'; amount: DecimalAmount }[] = [];
    for (const line of journal.lines) {
      if (line.costCenterId !== association.costCenterId) continue;
      const classification = classifications.get(line.accountId);
      if (classification === 'REVENUE') accountingLines.push({ line, dimension: 'REVENUE', amount: subtract(line.credit ?? decimalAmount('0'), line.debit ?? decimalAmount('0')) });
      if (classification === 'EXPENSE') accountingLines.push({ line, dimension: 'COST', amount: subtract(line.debit ?? decimalAmount('0'), line.credit ?? decimalAmount('0')) });
    }
    if (!accountingLines.length) throw new Error('journal has no authoritative program accounting evidence');
    return Promise.all(accountingLines.map(({ line, dimension, amount }) => this.reporting.ingest({ evidenceId: `PROGRAM_ACCOUNTING:${journal.id}:${line.id}`, companyId: journal.companyId, occurredAt: `${journal.postingDate}T00:00:00.000Z`, postingDate: journal.postingDate, currency: baseCurrency.code, kind: 'PROGRAM_ACCOUNTING', source: sourceReference('JOURNAL', journal.id), authoritativeReference: sourceReference('JOURNAL_LINE', line.id), amount, programId: association.program.sourceId, costCenterId: association.costCenterId, programDimension: dimension })));
  }
  consumeInvoicePosition(invoice: Invoice) { return this.reporting.ingest({ evidenceId: `BILLING_POSITION:${invoice.id}`, companyId: invoice.companyId, ...(invoice.branchId ? { branchId: invoice.branchId as BranchId } : {}), occurredAt: invoice.createdAt, postingDate: invoice.postingDate, currency: invoice.currency as CurrencyCode, kind: 'BILLING_POSITION', source: sourceReference('INVOICE', invoice.id), authoritativeReference: sourceReference('BILLING_POSITION', invoice.id), amount: invoice.outstanding, partyId: invoice.partyId, positionKind: invoice.type === 'SUPPLIER' ? 'PAYABLE' : 'RECEIVABLE', ...(invoice.dueDate ? { dueDate: invoice.dueDate } : {}), openAmount: invoice.outstanding }); }
  consumeAdvance(advance: Advance, postingDate: string, currency: CurrencyCode, branchId?: BranchId) { return this.reporting.ingest({ evidenceId: `BILLING_ADVANCE:${advance.id}`, companyId: advance.companyId, ...(branchId ? { branchId } : {}), occurredAt: `${postingDate}T00:00:00.000Z`, postingDate, currency, kind: 'BILLING_POSITION', source: sourceReference('BILLING_ADVANCE', advance.id), authoritativeReference: sourceReference('BILLING_ADVANCE', advance.id), amount: advance.available, partyId: advance.partyId, positionKind: advance.partyKind === 'SUPPLIER' ? 'SUPPLIER_ADVANCE' : 'CUSTOMER_ADVANCE', openAmount: advance.available }); }
  consumeVoucher(voucher: Voucher) { return this.reporting.ingest({ evidenceId: `TREASURY_VOUCHER:${voucher.id}`, companyId: voucher.companyId, ...(voucher.branchId ? { branchId: voucher.branchId as BranchId } : {}), occurredAt: `${voucher.postingDate}T00:00:00.000Z`, postingDate: voucher.postingDate, currency: voucher.currency as CurrencyCode, kind: 'TREASURY_ACTIVITY', source: sourceReference('TREASURY_VOUCHER', voucher.id), authoritativeReference: sourceReference('TREASURY_VOUCHER', voucher.id), amount: voucher.kind === 'PAYMENT' ? negate(voucher.amount) : voucher.amount, voucherId: voucher.id, allocationReferences: voucher.allocationIds.map((id) => sourceReference('BILLING_ALLOCATION', id)) }); }
  consumeTax(snapshot: TaxSnapshot, currency: CurrencyCode, branchId?: BranchId) { return this.reporting.ingest({ evidenceId: `TAX_SNAPSHOT:${snapshot.id}`, companyId: snapshot.companyId, ...(branchId ? { branchId } : {}), occurredAt: snapshot.createdAt, postingDate: snapshot.effectiveAt, currency, kind: 'TAX_FACT', source: sourceReference('TAX_SNAPSHOT', snapshot.id), authoritativeReference: sourceReference('TAX_SNAPSHOT', snapshot.id), amount: snapshot.taxAmount, taxCode: snapshot.code, taxSnapshotReference: sourceReference('TAX_SNAPSHOT', snapshot.id) }); }
}
function parts(value: DecimalAmount) { const negative = value.startsWith('-'); const unsigned = negative ? value.slice(1) : value; const [whole = '0', fraction = ''] = unsigned.split('.'); return { value: (negative ? -1n : 1n) * BigInt(whole + fraction), scale: fraction.length }; }
function exact(value: bigint, scale: number): DecimalAmount { const negative = value < 0n; let digits = (negative ? -value : value).toString().padStart(scale + 1, '0'); if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, ''); return decimalAmount(`${negative ? '-' : ''}${digits}`); }
function subtract(left: DecimalAmount, right: DecimalAmount) { const a = parts(left), b = parts(right), scale = Math.max(a.scale, b.scale); return exact(a.value * 10n ** BigInt(scale - a.scale) - b.value * 10n ** BigInt(scale - b.scale), scale); }
function negate(value: DecimalAmount) { return value === '0' ? value : decimalAmount(value.startsWith('-') ? value.slice(1) : `-${value}`); }
function fail(message: string): never { throw new Error(message); }
