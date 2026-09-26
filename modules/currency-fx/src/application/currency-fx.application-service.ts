import {
  ContractValidationError,
  currencyCode,
  decimalAmount,
  money,
  type CompanyId,
  type CurrencyCode,
  type DecimalAmount,
  type Money,
} from '@elhafez/contracts';
import {
  configureCurrency,
  makeRate,
  moneyDifference,
  type CurrencyConfiguration,
  type FxRate,
  type PositionClassification,
} from '../domain/fx.js';
import type { CurrencyFxRepository } from './currency-fx.repository.js';

export interface FxRateSnapshot {
  readonly rateId: string;
  readonly companyId: CompanyId;
  readonly fromCurrency: CurrencyCode;
  readonly toCurrency: CurrencyCode;
  readonly effectiveAt: string;
  readonly rate: DecimalAmount;
  readonly source: string;
}

export interface RevaluationRequest {
  readonly companyId: CompanyId;
  readonly positionReference: string;
  readonly classification: PositionClassification;
  readonly monetary: boolean;
  readonly foreignAmount: Money;
  readonly priorBaseAmount: DecimalAmount;
  readonly baseCurrency: CurrencyCode;
  readonly at: string;
}

export type RevaluationPreparation = Readonly<
  | { positionReference: string; status: 'PREPARED'; baseDifference: Money; rate: FxRateSnapshot }
  | { positionReference: string; status: 'EXCLUDED' | 'NO_REVALUATION'; reason: string }
>;

export class CurrencyFxApplicationService {
  constructor(private readonly repository: CurrencyFxRepository) {}

  async listCurrencies(companyId: CompanyId): Promise<CurrencyConfiguration[]> { return this.repository.listCurrencies(companyId); }
  async listRates(companyId: CompanyId): Promise<FxRate[]> { return this.repository.listRates(companyId); }

  async configure(input: CurrencyConfiguration): Promise<CurrencyConfiguration> {
    const value = configureCurrency(input);
    await this.repository.saveCurrency(value);
    return value;
  }

  async getBaseCurrency(companyId: CompanyId): Promise<CurrencyConfiguration> {
    const value = await this.repository.findBaseCurrency(companyId);
    if (!value || value.status !== 'ACTIVE') {
      throw new ContractValidationError('currency', 'active base currency is not configured for company');
    }
    return Object.freeze(value);
  }

  async publishRate(input: FxRate): Promise<FxRateSnapshot> {
    await this.requireActive(input.companyId, input.fromCurrency);
    await this.requireActive(input.companyId, input.toCurrency);
    const value = makeRate(input);
    await this.repository.saveRate(value);
    return this.snapshot(value);
  }

  async resolveRate(companyId: CompanyId, fromInput: CurrencyCode, toInput: CurrencyCode, at: string): Promise<FxRateSnapshot> {
    const from = currencyCode(fromInput);
    const to = currencyCode(toInput);
    await this.requireActive(companyId, from);
    await this.requireActive(companyId, to);

    if (from === to) {
      return Object.freeze({
        rateId: 'SAME_CURRENCY',
        companyId,
        fromCurrency: from,
        toCurrency: to,
        effectiveAt: at,
        rate: decimalAmount('1'),
        source: 'SYSTEM',
      });
    }

    const rate = await this.repository.findRate(companyId, from, to, at);
    if (!rate) throw new ContractValidationError('rate', 'no rate for ' + from + '/' + to + ' at ' + at);
    return this.snapshot(rate);
  }

  async calculateSettlement(
    companyId: CompanyId,
    amount: Money,
    to: CurrencyCode,
    at: string,
  ): Promise<Readonly<{ converted: Money; rate: FxRateSnapshot }>> {
    const rate = await this.resolveRate(companyId, amount.currency, to, at);
    return Object.freeze({
      converted: money((await import('../domain/fx.js')).multiplyExact(amount.amount, rate.rate), to),
      rate,
    });
  }

  async prepareRevaluation(input: RevaluationRequest): Promise<RevaluationPreparation> {
    if (['REVENUE', 'EXPENSE', 'EQUITY'].includes(input.classification)) {
      return Object.freeze({
        positionReference: input.positionReference,
        status: 'EXCLUDED',
        reason: 'BR-036 excludes ' + input.classification,
      });
    }
    if (!input.monetary) {
      return Object.freeze({
        positionReference: input.positionReference,
        status: 'EXCLUDED',
        reason: 'BR-036 excludes non-monetary positions',
      });
    }
    if (input.foreignAmount.currency === input.baseCurrency) {
      return Object.freeze({
        positionReference: input.positionReference,
        status: 'NO_REVALUATION',
        reason: 'position is already in base currency',
      });
    }
    const rate = await this.resolveRate(
      input.companyId,
      input.foreignAmount.currency,
      input.baseCurrency,
      input.at,
    );
    return Object.freeze({
      positionReference: input.positionReference,
      status: 'PREPARED',
      baseDifference: money(
        moneyDifference(input.foreignAmount, rate.rate, decimalAmount(input.priorBaseAmount)),
        input.baseCurrency,
      ),
      rate,
    });
  }

  private async requireActive(companyId: CompanyId, code: CurrencyCode): Promise<void> {
    const value = await this.repository.findCurrency(companyId, currencyCode(code));
    if (!value || value.status !== 'ACTIVE') {
      throw new ContractValidationError('currency', code + ' is not active for company');
    }
  }

  private snapshot(rate: FxRate): FxRateSnapshot {
    return Object.freeze({
      rateId: rate.id,
      companyId: rate.companyId,
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      effectiveAt: rate.effectiveAt,
      rate: rate.rate,
      source: rate.source,
    });
  }
}
