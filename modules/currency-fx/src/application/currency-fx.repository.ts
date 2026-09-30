import type { CompanyId, CurrencyCode } from '@elhafez/contracts';
import type { CurrencyConfiguration, FxRate } from '../domain/fx.js';

export interface CurrencyFxRepository {
  saveCurrency(value: CurrencyConfiguration): Promise<void>;
  findCurrency(companyId: CompanyId, code: CurrencyCode): Promise<CurrencyConfiguration | undefined>;
  listCurrencies(companyId: CompanyId): Promise<readonly CurrencyConfiguration[]>;
  findBaseCurrency(companyId: CompanyId): Promise<CurrencyConfiguration | undefined>;
  saveRate(value: FxRate): Promise<void>;
  findRate(companyId: CompanyId, from: CurrencyCode, to: CurrencyCode, at: string): Promise<FxRate | undefined>;
}

export const CURRENCY_FX_REPOSITORY = Symbol('CURRENCY_FX_REPOSITORY');
