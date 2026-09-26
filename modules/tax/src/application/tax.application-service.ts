import { createHash } from 'node:crypto';
import {
  ContractValidationError,
  decimalAmount,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import type { TaxPolicy, TaxSnapshot } from '../domain/tax.js';
import type { TaxRepository } from './tax.repository.js';

function canonicalDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ContractValidationError(field, 'must be YYYY-MM-DD');
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new ContractValidationError(field, 'must be a valid calendar date');
  }
  return value;
}

function decimalParts(value: DecimalAmount): { coefficient: bigint; scale: number } {
  const text = decimalAmount(value);
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = unsigned.split('.');
  return {
    coefficient: BigInt((negative ? '-' : '') + whole + fraction),
    scale: fraction.length,
  };
}

function nonNegative(value: DecimalAmount, field: string): DecimalAmount {
  const parsed = decimalAmount(value);
  if (decimalParts(parsed).coefficient < 0n) throw new ContractValidationError(field, 'must not be negative');
  if ((parsed.split('.')[1] ?? '').length > 18) throw new ContractValidationError(field, 'supports at most 18 fractional digits');
  return parsed;
}

function canonical(coefficient: bigint, scale: number): DecimalAmount {
  let current = coefficient;
  let currentScale = scale;
  while (currentScale > 18 && current % 10n === 0n) {
    current /= 10n;
    currentScale -= 1;
  }
  if (currentScale > 18) {
    throw new ContractValidationError('taxAmount', 'result requires an explicit rounding policy');
  }
  const negative = current < 0n;
  const absolute = negative ? -current : current;
  let digits = absolute.toString().padStart(currentScale + 1, '0');
  if (currentScale > 0) {
    digits = digits.slice(0, -currentScale) + '.' + digits.slice(-currentScale);
    digits = digits.replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '');
  }
  return decimalAmount((negative && digits !== '0' ? '-' : '') + digits);
}

function multiplyExact(left: DecimalAmount, right: DecimalAmount): DecimalAmount {
  const a = decimalParts(left);
  const b = decimalParts(right);
  return canonical(a.coefficient * b.coefficient, a.scale + b.scale);
}

export class TaxApplicationService {
  constructor(private readonly repo: TaxRepository) {}

  async listPolicies(companyId:CompanyId){return this.repo.listPolicies(companyId);}

  async configurePolicy(policy: TaxPolicy) {
    const effectiveFrom = canonicalDate(policy.effectiveFrom, 'effectiveFrom');
    const rate = nonNegative(policy.rate, 'rate');
    if (!policy.code.trim() || !policy.outputAccountId.trim() || !policy.inputAccountId.trim()) {
      throw new ContractValidationError('taxPolicy', 'code and tax accounts are required');
    }
    const existing = (await this.repo.policies(policy.companyId, policy.code)).find(
      (value) => value.effectiveFrom === effectiveFrom,
    );
    if (existing) throw new ContractValidationError('effectiveFrom', 'policy revision already exists');
    const value = Object.freeze({ ...policy, effectiveFrom, rate });
    await this.repo.savePolicy(value);
    return value;
  }

  async resolveEffectivePolicy(companyId: CompanyId, code: string, at: string) {
    const effectiveAt = canonicalDate(at, 'effectiveAt');
    const found = (await this.repo.policies(companyId, code))
      .filter((value) => value.effectiveFrom <= effectiveAt)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.id.localeCompare(a.id))[0];
    if (!found) throw new ContractValidationError('taxCode', 'no effective policy');
    return found;
  }

  async snapshotInvoiceLine(input: {
    companyId: CompanyId;
    code: string;
    effectiveAt: string;
    taxableAmount: DecimalAmount;
    sourceId: string;
  }): Promise<TaxSnapshot> {
    const effectiveAt = canonicalDate(input.effectiveAt, 'effectiveAt');
    const taxableAmount = nonNegative(input.taxableAmount, 'taxableAmount');
    if (!input.sourceId.trim()) throw new ContractValidationError('sourceId', 'is required');
    const id = createHash('sha256').update(`${input.companyId}|${input.sourceId}`).digest('hex');
    const prior = await this.repo.snapshot(input.companyId, id);
    if (prior) {
      if (prior.code !== input.code || prior.effectiveAt !== effectiveAt || prior.taxableAmount !== taxableAmount) {
        throw new ContractValidationError('sourceId', 'conflicting tax snapshot replay');
      }
      return prior;
    }

    const policy = await this.resolveEffectivePolicy(input.companyId, input.code, effectiveAt);
    const value = Object.freeze({
      id,
      companyId: input.companyId,
      policyId: policy.id,
      code: policy.code,
      effectiveAt,
      rate: policy.rate,
      taxableAmount,
      taxAmount: multiplyExact(taxableAmount, policy.rate),
      outputAccountId: policy.outputAccountId,
      inputAccountId: policy.inputAccountId,
      createdAt: new Date().toISOString(),
    });

    try {
      await this.repo.saveSnapshot(value);
      return value;
    } catch (error) {
      const concurrent = await this.repo.snapshot(input.companyId, id);
      if (
        concurrent &&
        concurrent.code === input.code &&
        concurrent.effectiveAt === effectiveAt &&
        concurrent.taxableAmount === taxableAmount
      ) {
        return concurrent;
      }
      throw error;
    }
  }

  async getSnapshot(companyId: CompanyId, id: string) {
    return this.repo.snapshot(companyId, id);
  }
}
