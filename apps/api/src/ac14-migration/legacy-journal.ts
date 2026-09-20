const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class LegacyJournalValidationError extends Error {
  constructor(public readonly code: 'INVALID_DECIMAL' | 'MISSING_ACCOUNT' | 'BROKEN_REVERSAL_LINEAGE' | 'UNSUPPORTED_LEGACY_CONSTRUCT', message: string) { super(message); }
}

export function canonicalDecimal(value: unknown): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || !DECIMAL.test(String(value))) throw new LegacyJournalValidationError('INVALID_DECIMAL', 'invalid finite decimal');
  const raw = String(value);
  const negative = raw.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? raw.slice(1) : raw).split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  const normalizedFraction = fraction.replace(/0+$/, '');
  const result = `${negative ? '-' : ''}${normalizedWhole}${normalizedFraction ? `.${normalizedFraction}` : ''}`;
  return result === '-0' ? '0' : result;
}

const scaled = (value: string, scale: number): bigint => {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const coefficient = BigInt(whole + fraction.padEnd(scale, '0'));
  return negative ? -coefficient : coefficient;
};

export function normalizeLegacyJournal(record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  if (!Array.isArray(record.lines) || record.lines.length < 2) throw new LegacyJournalValidationError('UNSUPPORTED_LEGACY_CONSTRUCT', 'journal requires at least two lines');
  const rawLines = record.lines.map((line) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) throw new LegacyJournalValidationError('UNSUPPORTED_LEGACY_CONSTRUCT', 'invalid journal line');
    const source = line as Record<string, unknown>;
    if (typeof source.accountId !== 'string' || !source.accountId) throw new LegacyJournalValidationError('MISSING_ACCOUNT', 'journal line requires accountId');
    const baseDebit = canonicalDecimal(source.baseDebit ?? '0');
    const baseCredit = canonicalDecimal(source.baseCredit ?? '0');
    const foreign = source.currency && (source.debit !== undefined || source.credit !== undefined) ? {
      foreignCurrency: source.currency,
      foreignAmount: canonicalDecimal(source.debit !== undefined && canonicalDecimal(source.debit) !== '0' ? source.debit : source.credit ?? '0'),
      fxRate: canonicalDecimal(source.rate ?? '1'),
    } : {};
    return Object.freeze({ accountId: source.accountId, ...(baseDebit !== '0' ? { debit: baseDebit } : {}), ...(baseCredit !== '0' ? { credit: baseCredit } : {}), ...foreign, ...(typeof source.partyId === 'string' ? { partyId: source.partyId } : {}), ...(typeof source.costCenterId === 'string' ? { costCenterId: source.costCenterId } : {}) });
  });
  const decimals = rawLines.flatMap((line) => [line.debit ?? '0', line.credit ?? '0']);
  const scale = Math.max(...decimals.map((value) => value.split('.')[1]?.length ?? 0));
  const debit = rawLines.reduce((sum, line) => sum + scaled(line.debit ?? '0', scale), 0n);
  const credit = rawLines.reduce((sum, line) => sum + scaled(line.credit ?? '0', scale), 0n);
  if (debit !== credit) throw new LegacyJournalValidationError('UNSUPPORTED_LEGACY_CONSTRUCT', 'authoritative base debit and credit are unbalanced');
  const refType = typeof record.refType === 'string' ? record.refType.toLowerCase() : '';
  const kind = refType === 'opening' ? 'OPENING' : refType === 'reversal' ? 'REVERSAL' : refType === 'fiscal_close' || refType === 'year_close' ? 'FISCAL_CLOSE' : 'STANDARD';
  if (kind === 'REVERSAL' && (typeof record.refId !== 'string' || !record.refId)) throw new LegacyJournalValidationError('BROKEN_REVERSAL_LINEAGE', 'reversal requires original journal refId');
  return Object.freeze({ ...record, kind, lines: rawLines, ...(kind === 'REVERSAL' ? { reversalSourceId: record.refId } : {}) });
}
