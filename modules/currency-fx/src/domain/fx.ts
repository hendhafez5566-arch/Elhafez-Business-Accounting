import { ContractValidationError, currencyCode, decimalAmount, type CompanyId, type CurrencyCode, type DecimalAmount, type Money } from '@elhafez/contracts';

export type CurrencyStatus = 'ACTIVE' | 'INACTIVE';
export interface CurrencyConfiguration { readonly companyId: CompanyId; readonly code: CurrencyCode; readonly precision: number; readonly isBase: boolean; readonly status: CurrencyStatus }
export interface FxRate { readonly id: string; readonly companyId: CompanyId; readonly fromCurrency: CurrencyCode; readonly toCurrency: CurrencyCode; readonly effectiveAt: string; readonly rate: DecimalAmount; readonly source: string }
export type PositionClassification = 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE' | 'EQUITY';

export function configureCurrency(input: CurrencyConfiguration): Readonly<CurrencyConfiguration> {
  const code = currencyCode(input.code);
  if (!Number.isInteger(input.precision) || input.precision < 0 || input.precision > 9) throw new ContractValidationError('precision', 'must be an integer from 0 to 9');
  return Object.freeze({ ...input, code });
}

export function canonicalDecimal(coefficient: bigint, scale: number): DecimalAmount {
  const negative = coefficient < 0n; let digits = (negative ? -coefficient : coefficient).toString();
  if (scale) digits = digits.padStart(scale + 1, '0').slice(0, -scale) + '.' + digits.padStart(scale + 1, '0').slice(-scale);
  digits = digits.replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '');
  const value = `${negative && digits !== '0' ? '-' : ''}${digits}`;
  return decimalAmount(value);
}
function parts(value: DecimalAmount): [bigint, number] { const [whole, fraction = ''] = value.split('.'); return [BigInt(whole! + fraction), fraction.length]; }
export function multiplyExact(left: DecimalAmount, right: DecimalAmount): DecimalAmount { const [a, as] = parts(left); const [b, bs] = parts(right); return canonicalDecimal(a * b, as + bs); }
export function subtractExact(left: DecimalAmount, right: DecimalAmount): DecimalAmount { const [a, as] = parts(left); const [b, bs] = parts(right); const scale = Math.max(as, bs); return canonicalDecimal(a * 10n ** BigInt(scale-as) - b * 10n ** BigInt(scale-bs), scale); }

export function makeRate(input: FxRate): Readonly<FxRate> {
  if (input.fromCurrency === input.toCurrency) throw new ContractValidationError('rate', 'same-currency rates are implicit and cannot be published');
  const rate = decimalAmount(input.rate); if (rate.startsWith('-') || rate === '0') throw new ContractValidationError('rate', 'must be positive');
  const date = new Date(input.effectiveAt); if (Number.isNaN(date.valueOf()) || date.toISOString() !== input.effectiveAt) throw new ContractValidationError('effectiveAt', 'must be canonical UTC ISO time');
  if (!input.id || !input.source) throw new ContractValidationError('rate', 'id and source are required');
  return Object.freeze({ ...input, fromCurrency: currencyCode(input.fromCurrency), toCurrency: currencyCode(input.toCurrency), rate });
}
export function moneyDifference(foreign: Money, currentRate: DecimalAmount, priorBaseAmount: DecimalAmount): DecimalAmount { return subtractExact(multiplyExact(foreign.amount, currentRate), priorBaseAmount); }
