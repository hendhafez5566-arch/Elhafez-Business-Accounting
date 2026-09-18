import { parseContractEnvelope, type ContractEnvelope } from './envelope.js';
import { ContractValidationError, assertJsonValue, deepFreeze, exactKeys, requireRecord, requireString, type JsonValue } from './validation.js';

declare const eventNameBrand: unique symbol;
export type EventName = string & { readonly [eventNameBrand]: 'EventName' };
export interface DomainEvent<TPayload extends JsonValue = JsonValue> {
  readonly name: EventName;
  readonly envelope: ContractEnvelope;
  readonly payload: Readonly<TPayload>;
}
/** @deprecated Compatibility only for Phase 0 publishers; new events must use DomainEvent. */
export interface LegacyDomainEvent {
  readonly name: string;
  readonly occurredAt: string;
  readonly payload: unknown;
}
export interface EventPublisher {
  publish(event: DomainEvent | LegacyDomainEvent): Promise<void>;
}

export function eventName(value: unknown): EventName {
  const text = requireString(value, 'name');
  if (!/^[A-Z][A-Za-z0-9]*(?:ed|Paid|Sent|Built|Made|Run|Won|Lost)$/.test(text)) {
    throw new ContractValidationError('name', 'must be a PascalCase past-tense fact');
  }
  return text as EventName;
}

export function domainEvent<TPayload extends JsonValue>(name: unknown, envelope: unknown, payload: TPayload): DomainEvent<TPayload> {
  assertJsonValue(payload, 'payload');
  return deepFreeze({ name: eventName(name), envelope: parseContractEnvelope(envelope), payload });
}

export function parseDomainEvent(value: unknown): DomainEvent {
  const input = requireRecord(value, 'event'); exactKeys(input, ['name', 'envelope', 'payload'], 'event');
  assertJsonValue(input.payload, 'payload');
  return domainEvent(input.name, input.envelope, input.payload);
}
