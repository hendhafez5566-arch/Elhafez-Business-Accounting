import { ContractValidationError, requireString } from './validation.js';

declare const identifierBrand: unique symbol;
type Identifier<Name extends string> = string & { readonly [identifierBrand]: Name };

export type CompanyId = Identifier<'CompanyId'>;
export type BranchId = Identifier<'BranchId'>;
export type ActorId = Identifier<'ActorId'>;
export type CorrelationId = Identifier<'CorrelationId'>;
export type CausationId = Identifier<'CausationId'>;
export type IdempotencyKey = Identifier<'IdempotencyKey'>;
export type SourceId = Identifier<'SourceId'>;

const ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,126}[A-Za-z0-9])?$/;

function identifier<Name extends string>(value: unknown, field: Name): Identifier<Name> {
  const text = requireString(value, field);
  if (!ID_PATTERN.test(text)) {
    throw new ContractValidationError(field, 'must be 1-128 characters using letters, digits, dot, underscore, colon, or hyphen');
  }
  return text as Identifier<Name>;
}

export const companyId = (value: unknown): CompanyId => identifier(value, 'CompanyId');
export const branchId = (value: unknown): BranchId => identifier(value, 'BranchId');
export const actorId = (value: unknown): ActorId => identifier(value, 'ActorId');
export const correlationId = (value: unknown): CorrelationId => identifier(value, 'CorrelationId');
export const causationId = (value: unknown): CausationId => identifier(value, 'CausationId');
export const idempotencyKey = (value: unknown): IdempotencyKey => identifier(value, 'IdempotencyKey');
export const sourceId = (value: unknown): SourceId => identifier(value, 'SourceId');
