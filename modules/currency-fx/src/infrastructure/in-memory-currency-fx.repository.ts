import { ContractValidationError, type CompanyId, type CurrencyCode } from '@elhafez/contracts';
import type { CurrencyFxRepository } from '../application/currency-fx.repository.js';
import type { CurrencyConfiguration, FxRate } from '../domain/fx.js';

export class InMemoryCurrencyFxRepository implements CurrencyFxRepository {
  private currencies = new Map<string, CurrencyConfiguration>();
  private rates: FxRate[] = [];

  async saveCurrency(value: CurrencyConfiguration): Promise<void> {
    const key = value.companyId + ':' + value.code;
    const old = this.currencies.get(key);
    if (old?.isBase && !value.isBase) throw new ContractValidationError('currency', 'base currency cannot be changed');
    if (value.isBase && [...this.currencies.values()].some((x) => x.companyId === value.companyId && x.isBase && x.code !== value.code)) {
      throw new ContractValidationError('currency', 'company already has a base currency');
    }
    this.currencies.set(key, value);
  }

  async findCurrency(companyId: CompanyId, code: CurrencyCode): Promise<CurrencyConfiguration | undefined> {
    return this.currencies.get(companyId + ':' + code);
  }

  async findBaseCurrency(companyId: CompanyId): Promise<CurrencyConfiguration | undefined> {
    return [...this.currencies.values()].find((x) => x.companyId === companyId && x.isBase);
  }

  async listCurrencies(companyId: CompanyId): Promise<CurrencyConfiguration[]> {
    return [...this.currencies.values()].filter((value) => value.companyId === companyId).sort((a,b) => a.code.localeCompare(b.code));
  }

  async listRates(companyId: CompanyId): Promise<FxRate[]> {
    return this.rates.filter((value) => value.companyId === companyId).sort((a,b) => b.effectiveAt.localeCompare(a.effectiveAt));
  }

  async saveRate(value: FxRate): Promise<void> {
    const duplicate = this.rates.find(
      (x) =>
        x.companyId === value.companyId &&
        x.fromCurrency === value.fromCurrency &&
        x.toCurrency === value.toCurrency &&
        x.effectiveAt === value.effectiveAt,
    );
    if (duplicate) {
      if (duplicate.id !== value.id || duplicate.rate !== value.rate || duplicate.source !== value.source) {
        throw new ContractValidationError('rate', 'conflicting FX rate');
      }
      return;
    }
    if (this.rates.some((x) => x.id === value.id)) throw new ContractValidationError('rate', 'rate id is already used');
    this.rates.push(value);
  }

  async findRate(companyId: CompanyId, from: CurrencyCode, to: CurrencyCode, at: string): Promise<FxRate | undefined> {
    return this.rates
      .filter((x) => x.companyId === companyId && x.fromCurrency === from && x.toCurrency === to && x.effectiveAt <= at)
      .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))[0];
  }
}
