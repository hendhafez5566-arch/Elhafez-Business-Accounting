import { sourceId, type SourceId } from './identifiers.js';
import { ContractValidationError, exactKeys, requireRecord, requireString } from './validation.js';

declare const sourceTypeBrand: unique symbol;
export type SourceType = string & { readonly [sourceTypeBrand]: 'SourceType' };
export interface SourceReference { readonly sourceType: SourceType; readonly sourceId: SourceId }

export function sourceType(value: unknown): SourceType {
  const text = requireString(value, 'sourceType');
  if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(text)) {
    throw new ContractValidationError('sourceType', 'must be an uppercase snake-case contract name');
  }
  return text as SourceType;
}

export function sourceReference(type: unknown, id: unknown): SourceReference {
  return Object.freeze({ sourceType: sourceType(type), sourceId: sourceId(id) });
}

export function parseSourceReference(value: unknown): SourceReference {
  const input = requireRecord(value, 'sourceReference');
  exactKeys(input, ['sourceType', 'sourceId'], 'sourceReference');
  return sourceReference(input.sourceType, input.sourceId);
}
