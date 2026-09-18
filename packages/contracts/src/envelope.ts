import { actorId, branchId, causationId, companyId, correlationId, idempotencyKey, sourceId, type ActorId, type BranchId, type CausationId, type CompanyId, type CorrelationId, type IdempotencyKey, type SourceId } from './identifiers.js';
import { sourceType, type SourceType } from './source-reference.js';
import { ContractValidationError, exactKeys, requireRecord, requireString } from './validation.js';

declare const versionBrand: unique symbol;
declare const timestampBrand: unique symbol;
declare const revisionBrand: unique symbol;
export type ContractVersion = string & { readonly [versionBrand]: 'ContractVersion' };
export type IsoTimestamp = string & { readonly [timestampBrand]: 'IsoTimestamp' };
export type ExpectedRevision = number & { readonly [revisionBrand]: 'ExpectedRevision' };

export interface ContractEnvelope {
  readonly contractVersion: ContractVersion;
  readonly companyId: CompanyId;
  readonly branchId: BranchId;
  readonly actorId: ActorId;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId;
  readonly sourceType: SourceType;
  readonly sourceId: SourceId;
  readonly occurredAt: IsoTimestamp;
}
export interface IdempotentContractEnvelope extends ContractEnvelope { readonly idempotencyKey: IdempotencyKey }
export interface RevisionedContractEnvelope extends ContractEnvelope { readonly expectedRevision: ExpectedRevision }
export interface IdempotentRevisionedContractEnvelope extends IdempotentContractEnvelope, RevisionedContractEnvelope {}

export function contractVersion(value: unknown): ContractVersion {
  const text = requireString(value, 'contractVersion');
  if (!/^[1-9]\d*\.(?:0|[1-9]\d*)$/.test(text)) throw new ContractValidationError('contractVersion', 'must use canonical major.minor numeric format');
  return text as ContractVersion;
}
export function isoTimestamp(value: unknown): IsoTimestamp {
  const text = requireString(value, 'occurredAt');
  const date = new Date(text);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(text) || Number.isNaN(date.valueOf()) || date.toISOString() !== (text.includes('.') ? text : text.replace('Z', '.000Z'))) {
    throw new ContractValidationError('occurredAt', 'must be a valid UTC ISO-8601 timestamp');
  }
  return text as IsoTimestamp;
}
export function expectedRevision(value: unknown): ExpectedRevision {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ContractValidationError('expectedRevision', 'must be a non-negative safe integer');
  }
  return value as ExpectedRevision;
}

const baseKeys = ['contractVersion', 'companyId', 'branchId', 'actorId', 'correlationId', 'causationId', 'sourceType', 'sourceId', 'occurredAt'] as const;
function base(input: Readonly<Record<string, unknown>>): ContractEnvelope {
  return {
    contractVersion: contractVersion(input.contractVersion), companyId: companyId(input.companyId), branchId: branchId(input.branchId), actorId: actorId(input.actorId),
    correlationId: correlationId(input.correlationId), causationId: causationId(input.causationId), sourceType: sourceType(input.sourceType), sourceId: sourceId(input.sourceId), occurredAt: isoTimestamp(input.occurredAt),
  };
}
export function parseContractEnvelope(value: unknown): ContractEnvelope {
  const input = requireRecord(value, 'envelope'); exactKeys(input, baseKeys, 'envelope'); return Object.freeze(base(input));
}
export function parseIdempotentEnvelope(value: unknown): IdempotentContractEnvelope {
  const input = requireRecord(value, 'envelope'); exactKeys(input, [...baseKeys, 'idempotencyKey'], 'envelope');
  return Object.freeze({ ...base(input), idempotencyKey: idempotencyKey(input.idempotencyKey) });
}
export function parseRevisionedEnvelope(value: unknown): RevisionedContractEnvelope {
  const input = requireRecord(value, 'envelope'); exactKeys(input, [...baseKeys, 'expectedRevision'], 'envelope');
  return Object.freeze({ ...base(input), expectedRevision: expectedRevision(input.expectedRevision) });
}
export function parseIdempotentRevisionedEnvelope(value: unknown): IdempotentRevisionedContractEnvelope {
  const input = requireRecord(value, 'envelope'); exactKeys(input, [...baseKeys, 'idempotencyKey', 'expectedRevision'], 'envelope');
  return Object.freeze({ ...base(input), idempotencyKey: idempotencyKey(input.idempotencyKey), expectedRevision: expectedRevision(input.expectedRevision) });
}
