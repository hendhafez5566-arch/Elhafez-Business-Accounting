import { decimalAmount, type CompanyId, type DecimalAmount } from '@elhafez/contracts';

export type AccountClassification = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account {
  id: string;
  companyId: CompanyId;
  code: string;
  name: string;
  classification: AccountClassification;
  active: boolean;
  postable: boolean;
  parentId?: string;
  controlType?: string;
}

export interface JournalLine {
  id: string;
  accountId: string;
  debit?: DecimalAmount;
  credit?: DecimalAmount;
  partyId?: string;
  /** Opaque Cost-owner identity carried on authoritative accounting evidence. */
  costCenterId?: string;
  foreignAmount?: DecimalAmount;
  foreignCurrency?: string;
  fxRateId?: string;
  fxRate?: DecimalAmount;
}

export type JournalKind = 'STANDARD' | 'OPENING' | 'REVERSAL' | 'FISCAL_CLOSE';

export interface Journal {
  id: string;
  companyId: CompanyId;
  number: string;
  postingDate: string;
  kind: JournalKind;
  sourceType: string;
  sourceId: string;
  requestHash: string;
  correlationId?: string;
  reversalOfId?: string;
  fiscalYearId?: string;
  lines: readonly JournalLine[];
}

function parts(value: DecimalAmount): [bigint, number] {
  const [whole, fraction = ''] = value.split('.');
  return [BigInt(whole! + fraction), fraction.length];
}

function canonicalDecimal(coefficient: bigint, scale: number): DecimalAmount {
  const negative = coefficient < 0n;
  let digits = (negative ? -coefficient : coefficient).toString();

  if (scale > 0) {
    digits = digits.padStart(scale + 1, '0');
    digits = digits.slice(0, -scale) + '.' + digits.slice(-scale);
    digits = digits.replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '');
  }

  return decimalAmount((negative && digits !== '0' ? '-' : '') + digits);
}

export function addExact(left: DecimalAmount, right: DecimalAmount): DecimalAmount {
  const [a, aScale] = parts(left);
  const [b, bScale] = parts(right);
  const scale = Math.max(aScale, bScale);
  return canonicalDecimal(
    a * 10n ** BigInt(scale - aScale) + b * 10n ** BigInt(scale - bScale),
    scale,
  );
}

export function subtractExact(left: DecimalAmount, right: DecimalAmount): DecimalAmount {
  const [a, aScale] = parts(left);
  const [b, bScale] = parts(right);
  const scale = Math.max(aScale, bScale);
  return canonicalDecimal(
    a * 10n ** BigInt(scale - aScale) - b * 10n ** BigInt(scale - bScale),
    scale,
  );
}

export function sumExact(values: readonly DecimalAmount[]): DecimalAmount {
  return values.reduce<DecimalAmount>((total, value) => addExact(total, value), decimalAmount('0'));
}

export function isPositive(value: DecimalAmount): boolean {
  return parts(value)[0] > 0n;
}

export function absoluteExact(value: DecimalAmount): DecimalAmount {
  const [coefficient, scale] = parts(value);
  return canonicalDecimal(coefficient < 0n ? -coefficient : coefficient, scale);
}
