# Integration Standard

Use one of two mechanisms:

- **Public contract / application service** for a synchronous request where the caller needs a response. Expose it only from `src/public/index.ts` and keep it narrow and versioned.
- **Domain event** for a completed fact that other modules may react to. Events are immutable, named in past tense, include `occurredAt`, and do not expose private entities.

Consumers must tolerate duplicate and out-of-order events. Event handlers own their side effects and must not reach into the publisher's data. Shared DTOs belong in `@elhafez/contracts`; do not share repositories, ORM models, or domain entities.
