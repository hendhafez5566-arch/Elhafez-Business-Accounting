/** Public, versioned contracts shared across module boundaries. */
export interface DomainEvent<TPayload = unknown> {
  readonly name: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
