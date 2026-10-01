import { currencyCode, money } from '@elhafez/contracts';
import type { CurrencyFxApplicationService } from '@elhafez/currency-fx';
import type { FxPort } from '../application/ports.js';

export class CurrencyFxAdapter implements FxPort {
  constructor(private readonly fx: CurrencyFxApplicationService) {}

  async convert(input: Parameters<FxPort['convert']>[0]) {
    const result = await this.fx.calculateSettlement(
      input.companyId,
      money(input.amount, currencyCode(input.fromCurrency)),
      currencyCode(input.toCurrency),
      input.at,
    );
    return {
      amount: result.converted.amount,
      rate: result.rate.rate,
      rateId: result.rate.rateId,
      effectiveAt: result.rate.effectiveAt,
      source: result.rate.source,
    };
  }
}
