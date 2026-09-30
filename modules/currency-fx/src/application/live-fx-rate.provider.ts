import type { CurrencyCode, DecimalAmount } from '@elhafez/contracts';

export interface LiveFxRateQuote {
  readonly fromCurrency: CurrencyCode;
  readonly toCurrency: CurrencyCode;
  readonly effectiveAt: string;
  readonly rate: DecimalAmount;
  readonly source: string;
}

export interface LiveFxRateProvider {
  quote(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<LiveFxRateQuote>;
}

export const LIVE_FX_RATE_PROVIDER = Symbol('LIVE_FX_RATE_PROVIDER');
