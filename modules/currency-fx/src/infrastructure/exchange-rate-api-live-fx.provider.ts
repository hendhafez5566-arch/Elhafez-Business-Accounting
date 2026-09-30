import { ContractValidationError, decimalAmount, type CurrencyCode, type DecimalAmount } from '@elhafez/contracts';
import type { LiveFxRateProvider, LiveFxRateQuote } from '../application/live-fx-rate.provider.js';

type HttpResponse = { readonly ok: boolean; readonly status: number; json(): Promise<unknown> };
type Fetcher = (url: string) => Promise<HttpResponse>;
type CachedFeed = { readonly expiresAt: number; readonly effectiveAt: string; readonly rates: Readonly<Record<string, DecimalAmount>> };

const endpoint = 'https://open.er-api.com/v6/latest/';

export class ExchangeRateApiLiveFxProvider implements LiveFxRateProvider {
  private readonly cache = new Map<string, CachedFeed>();

  constructor(
    private readonly fetcher: Fetcher = (url) => fetch(url),
    private readonly now: () => number = () => Date.now(),
    private readonly cacheMs = 60 * 60 * 1000,
  ) {}

  async quote(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<LiveFxRateQuote> {
    if (fromCurrency === toCurrency) {
      return { fromCurrency, toCurrency, effectiveAt: new Date(this.now()).toISOString(), rate: decimalAmount('1'), source: 'LIVE:EXCHANGE_RATE_API' };
    }
    const feed = await this.feed(fromCurrency);
    const rate = feed.rates[toCurrency];
    if (!rate) throw new ContractValidationError('rate', `live provider does not support ${fromCurrency}/${toCurrency}`);
    return { fromCurrency, toCurrency, effectiveAt: feed.effectiveAt, rate, source: 'LIVE:EXCHANGE_RATE_API' };
  }

  private async feed(base: CurrencyCode): Promise<CachedFeed> {
    const prior = this.cache.get(base);
    if (prior && prior.expiresAt > this.now()) return prior;
    let response: HttpResponse;
    try {
      response = await this.fetcher(endpoint + encodeURIComponent(base));
    } catch {
      throw new ContractValidationError('rate', 'live FX provider is unavailable');
    }
    if (!response.ok) throw new ContractValidationError('rate', `live FX provider returned HTTP ${response.status}`);
    const raw = await response.json();
    if (!raw || typeof raw !== 'object') throw new ContractValidationError('rate', 'live FX provider returned an invalid response');
    const body = raw as Record<string, unknown>;
    if (body.result !== 'success' || !body.rates || typeof body.rates !== 'object') {
      throw new ContractValidationError('rate', 'live FX provider rejected the request');
    }
    const updated = typeof body.time_last_update_unix === 'number' ? new Date(body.time_last_update_unix * 1000) : new Date(this.now());
    if (Number.isNaN(updated.valueOf())) throw new ContractValidationError('rate', 'live FX provider returned an invalid timestamp');
    const rates: Record<string, DecimalAmount> = {};
    for (const [code, value] of Object.entries(body.rates as Record<string, unknown>)) {
      if ((typeof value === 'number' && Number.isFinite(value) && value > 0) || (typeof value === 'string' && value.trim())) {
        try { rates[code] = decimalAmount(String(value)); } catch { /* ignore malformed provider rows */ }
      }
    }
    const feed = Object.freeze({ expiresAt: this.now() + this.cacheMs, effectiveAt: updated.toISOString(), rates: Object.freeze(rates) });
    this.cache.set(base, feed);
    return feed;
  }
}
