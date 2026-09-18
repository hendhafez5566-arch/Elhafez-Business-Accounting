export class ContractValidationError extends Error {
  override readonly name = 'ContractValidationError';

  constructor(readonly field: string, message: string) {
    super(`${field}: ${message}`);
  }
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new ContractValidationError(field, 'must be a string');
  return value;
}

export function requireRecord(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContractValidationError(field, 'must be an object');
  }
  return value as Readonly<Record<string, unknown>>;
}

/** Validates the restricted JSON value set used at contract boundaries. */
export function assertJsonValue(value: unknown, field = 'value'): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new ContractValidationError(field, 'numbers must be finite');
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${field}[${index}]`));
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) throw new ContractValidationError(`${field}.${key}`, 'must not be undefined');
      assertJsonValue(item, `${field}.${key}`);
    }
    return;
  }
  throw new ContractValidationError(field, 'must be serialization-safe JSON');
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { readonly [key: string]: JsonValue } | readonly JsonValue[];

export function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

export function exactKeys(record: Readonly<Record<string, unknown>>, allowed: readonly string[], field: string): void {
  const extras = Object.keys(record).filter((key) => !allowed.includes(key));
  if (extras.length) throw new ContractValidationError(field, `contains unknown field(s): ${extras.join(', ')}`);
}
