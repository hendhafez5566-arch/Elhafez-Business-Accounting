import { ContractValidationError, exactKeys, requireRecord, requireString } from './validation.js';

declare const decimalBrand: unique symbol;
declare const currencyBrand: unique symbol;
export type DecimalAmount = string & { readonly [decimalBrand]: 'DecimalAmount' };
export type CurrencyCode = string & { readonly [currencyBrand]: 'CurrencyCode' };

export interface Money {
  readonly amount: DecimalAmount;
  readonly currency: CurrencyCode;
}

// Canonical, non-exponential decimal: no leading zeroes, trailing fractional zeroes, or negative zero.
const DECIMAL_PATTERN = /^(?:0|-?(?:0\.\d*[1-9]|[1-9]\d*(?:\.\d*[1-9])?))$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function decimalAmount(value: unknown): DecimalAmount {
  const text = requireString(value, 'amount');
  if (!DECIMAL_PATTERN.test(text)) {
    throw new ContractValidationError('amount', 'must be a canonical decimal string');
  }
  return text as DecimalAmount;
}

export function currencyCode(value: unknown): CurrencyCode {
  const text = requireString(value, 'currency');
  if (!CURRENCY_PATTERN.test(text)) throw new ContractValidationError('currency', 'must be a three-letter uppercase code');
  return text as CurrencyCode;
}

export function money(amount: unknown, currency: unknown): Money {
  return Object.freeze({ amount: decimalAmount(amount), currency: currencyCode(currency) });
}

export function parseMoney(value: unknown): Money {
  const input = requireRecord(value, 'money');
  exactKeys(input, ['amount', 'currency'], 'money');
  return money(input.amount, input.currency);
}
