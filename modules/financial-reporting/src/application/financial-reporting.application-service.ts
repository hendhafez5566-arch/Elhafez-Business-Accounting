import { createHash } from 'node:crypto';
import { ContractValidationError, currencyCode, decimalAmount, type CurrencyCode, type DecimalAmount } from '@elhafez/contracts';
import type { ReportMetadata, ReportScope, ReportingEvidence } from '../domain/reporting.js';
import type { ReportingProjectionRepository } from './reporting-projection.repository.js';

type CurrencyTotal = Readonly<{ currency: CurrencyCode; amount: DecimalAmount }>;
type ExportCell = string;
export interface StructuredReportExport { readonly format: 'STRUCTURED_V1'; readonly columns: readonly string[]; readonly rows: readonly (readonly ExportCell[])[]; readonly metadata: ReportMetadata; }

export class FinancialReportingApplicationService {
  constructor(private readonly repository: ReportingProjectionRepository) {}

  async ingest(evidence: ReportingEvidence): Promise<{ status: 'INGESTED' | 'DUPLICATE'; evidenceId: string }> {
    const normalized = normalize(evidence);
    const existing = await this.repository.find(normalized.companyId, normalized.evidenceId);
    if (existing) {
      if (fingerprint(existing) !== fingerprint(normalized)) throw new ContractValidationError('evidenceId', 'conflicting immutable reporting evidence');
      return { status: 'DUPLICATE', evidenceId: existing.evidenceId };
    }
    await this.repository.save(normalized);
    return { status: 'INGESTED', evidenceId: normalized.evidenceId };
  }

  async rebuild(companyId: ReportingEvidence['companyId'], evidence: readonly ReportingEvidence[]) {
    const normalized = evidence.map(normalize);
    if (normalized.some((item) => item.companyId !== companyId)) throw new ContractValidationError('companyId', 'rebuild evidence crosses company scope');
    const unique = new Map<string, ReportingEvidence>();
    for (const item of normalized.sort(orderEvidence)) {
      const existing = unique.get(item.evidenceId);
      if (existing && fingerprint(existing) !== fingerprint(item)) throw new ContractValidationError('evidenceId', 'conflicting immutable reporting evidence');
      unique.set(item.evidenceId, item);
    }
    await this.repository.replaceCompany(companyId, [...unique.values()]);
    return { companyId, evidenceCount: unique.size, projectionVersion: 1 as const };
  }

  async trialBalance(scope: ReportScope) {
    const facts = (await this.active(scope)).filter((x) => x.kind === 'GL_LINE');
    const rows = group(facts, (x) => `${x.accountId ?? ''}|${x.currency}`, (items) => ({ accountId: items[0]!.accountId!, currency: items[0]!.currency, amount: sum(items.map((x) => x.amount)), evidenceIds: items.map((x) => x.evidenceId) }));
    return { metadata: metadata(scope, facts), rows };
  }
  async accountLedger(scope: ReportScope, accountId: string) {
    const entries = (await this.active(scope)).filter((x) => x.kind === 'GL_LINE' && x.accountId === accountId).sort(orderEvidence);
    return { metadata: metadata(scope, entries), accountId, entries };
  }
  async incomeStatement(scope: ReportScope) { return this.statement(scope, ['REVENUE', 'EXPENSE']); }
  async balanceSheet(scope: ReportScope) { return this.statement(scope, ['ASSET', 'LIABILITY', 'EQUITY']); }

  async aging(scope: ReportScope, side: 'CUSTOMER' | 'SUPPLIER') {
    const allowed = side === 'CUSTOMER' ? ['RECEIVABLE', 'CUSTOMER_ADVANCE'] : ['PAYABLE', 'SUPPLIER_ADVANCE'];
    const positions = (await this.active(scope)).filter((x) => x.kind === 'BILLING_POSITION' && x.positionKind && allowed.includes(x.positionKind));
    return { metadata: metadata(scope, positions), side, positions: positions.map((x) => ({ evidenceId: x.evidenceId, partyId: x.partyId, positionKind: x.positionKind, dueDate: x.dueDate, currency: x.currency, openAmount: x.openAmount!, authoritativeReference: x.authoritativeReference })) };
  }
  async treasury(scope: ReportScope) {
    const activity = (await this.active(scope)).filter((x) => x.kind === 'TREASURY_ACTIVITY');
    return { metadata: metadata(scope, activity), totals: totals(activity), activity: activity.map((x) => ({ evidenceId: x.evidenceId, voucherId: x.voucherId, amount: x.amount, currency: x.currency, allocationReferences: x.allocationReferences ?? [], authoritativeReference: x.authoritativeReference })) };
  }
  async getProgramAccountingSnapshot(scope: ReportScope, programId: string) {
    const facts = (await this.active(scope)).filter((x) => x.kind === 'PROGRAM_ACCOUNTING' && x.programId === programId);
    const currencies = [...new Set(facts.map((x) => x.currency))].sort();
    return { metadata: metadata(scope, facts), programId, byCurrency: currencies.map((currency) => { const selected = facts.filter((x) => x.currency === currency); const revenue = sum(selected.filter((x) => x.programDimension === 'REVENUE').map((x) => x.amount)); const cost = sum(selected.filter((x) => x.programDimension === 'COST').map((x) => x.amount)); return { currency, revenue, cost, profit: subtract(revenue, cost), costCenterIds: [...new Set(selected.map((x) => x.costCenterId!))], authoritativeReferences: selected.map((x) => x.authoritativeReference) }; }) };
  }
  async supplier(scope: ReportScope) { const facts = (await this.active(scope)).filter((x) => x.kind === 'PROCUREMENT_FINANCIAL'); return { metadata: metadata(scope, facts), facts }; }
  async tax(scope: ReportScope) { const facts = (await this.active(scope)).filter((x) => x.kind === 'TAX_FACT'); return { metadata: metadata(scope, facts), totals: totals(facts), facts }; }
  exportRows(metadataValue: ReportMetadata, columns: readonly string[], rows: readonly (readonly string[])[]): StructuredReportExport { return Object.freeze({ format: 'STRUCTURED_V1', columns: [...columns], rows: rows.map((row) => [...row]), metadata: metadataValue }); }

  private async statement(scope: ReportScope, classes: readonly string[]) {
    const facts = (await this.active(scope)).filter((x) => x.kind === 'GL_LINE' && x.accountClass && classes.includes(x.accountClass));
    return { metadata: metadata(scope, facts), totals: totals(facts), rows: group(facts, (x) => `${x.accountClass}|${x.currency}`, (items) => ({ accountClass: items[0]!.accountClass!, currency: items[0]!.currency, amount: sum(items.map((x) => x.amount)), evidenceIds: items.map((x) => x.evidenceId) })) };
  }
  private async active(scope: ReportScope) {
    validateScope(scope);
    const all = await this.repository.list(scope.companyId);
    const selected = all.filter((x) => (!scope.branchIds || (x.branchId && scope.branchIds.includes(x.branchId))) && (!scope.from || x.postingDate >= scope.from) && (!scope.to || x.postingDate <= scope.to) && (!scope.asOf || x.postingDate <= scope.asOf));
    // A reversal is itself canonical signed evidence. Retain both sides so reports net them
    // while provenance continues to show the immutable original and its linked reversal.
    return selected.sort(orderEvidence);
  }
}

function validateScope(scope: ReportScope) { if (scope.companyWide === true && scope.branchIds) throw new ContractValidationError('scope', 'choose explicit branch scope or company-wide scope'); if (scope.companyWide !== true && !scope.branchIds?.length) throw new ContractValidationError('branchIds', 'explicit branch scope is required unless companyWide is authorized'); }
function normalize(value: ReportingEvidence): ReportingEvidence {
  if (!value.evidenceId.trim()) throw new ContractValidationError('evidenceId', 'is required');
  const amount = decimalAmount(value.amount); const currency = currencyCode(value.currency);
  const openAmount = value.openAmount === undefined ? undefined : decimalAmount(value.openAmount);
  const operationalEstimate = value.operationalEstimate === undefined ? undefined : decimalAmount(value.operationalEstimate);
  if (value.kind === 'GL_LINE' && (!value.accountId || !value.accountClass)) throw new ContractValidationError('GL_LINE', 'account identity and class are required');
  if (value.kind === 'BILLING_POSITION' && (!value.partyId || !value.positionKind || openAmount === undefined)) throw new ContractValidationError('BILLING_POSITION', 'owner position evidence is required');
  if (value.kind === 'PROGRAM_ACCOUNTING' && (!value.programId || !value.costCenterId || !value.programDimension)) throw new ContractValidationError('PROGRAM_ACCOUNTING', 'program cost-center accounting evidence is required');
  if (value.kind === 'TAX_FACT' && !value.taxSnapshotReference) throw new ContractValidationError('TAX_FACT', 'frozen tax snapshot reference is required');
  return Object.freeze({ ...value, amount, currency, ...(openAmount === undefined ? {} : { openAmount }), ...(operationalEstimate === undefined ? {} : { operationalEstimate }) });
}
function fingerprint(value: ReportingEvidence) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function orderEvidence(a: ReportingEvidence, b: ReportingEvidence) { return a.postingDate.localeCompare(b.postingDate) || a.evidenceId.localeCompare(b.evidenceId); }
function metadata(scope: ReportScope, facts: readonly ReportingEvidence[]): ReportMetadata { return Object.freeze({ companyId: scope.companyId, branchScope: scope.companyWide ? 'COMPANY_WIDE' : [...scope.branchIds!], period: { ...(scope.from ? { from: scope.from } : {}), ...(scope.to ? { to: scope.to } : {}), ...(scope.asOf ? { asOf: scope.asOf } : {}) }, projectionVersion: 1, rebuildable: true, authoritative: false, evidenceIds: facts.map((x) => x.evidenceId) }); }
function group<T, R>(items: readonly T[], key: (item: T) => string, convert: (grouped: readonly T[]) => R): R[] { const values = new Map<string, T[]>(); for (const item of items) { const id = key(item); values.set(id, [...(values.get(id) ?? []), item]); } return [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, grouped]) => convert(grouped)); }
function totals(items: readonly ReportingEvidence[]): CurrencyTotal[] { return group(items, (x) => x.currency, (values) => ({ currency: values[0]!.currency, amount: sum(values.map((x) => x.amount)) })); }
function scaled(value: DecimalAmount): bigint { const negative = value.startsWith('-'); const unsigned = negative ? value.slice(1) : value; const [whole = '0', fraction = ''] = unsigned.split('.'); const result = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0')); return negative ? -result : result; }
function decimal(value: bigint): DecimalAmount { const negative = value < 0n; const absolute = negative ? -value : value; const whole = absolute / 10n ** 18n; const fraction = absolute % 10n ** 18n; return decimalAmount(`${negative ? '-' : ''}${whole}${fraction ? `.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}` : ''}`); }
function sum(values: readonly DecimalAmount[]) { return decimal(values.reduce((total, value) => total + scaled(value), 0n)); }
function subtract(left: DecimalAmount, right: DecimalAmount) { return decimal(scaled(left) - scaled(right)); }
