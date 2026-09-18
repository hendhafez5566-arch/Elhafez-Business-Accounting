import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actorId, assertContractRoundTrip, branchId, companyId, ContractValidationError, correlationId,
  domainEvent, executionContext, idempotencyKey, money, parseContractEnvelope, parseDomainEvent,
  parseExecutionContext, parseIdempotentEnvelope, parseIdempotentRevisionedEnvelope, parseMoney,
  parseRevisionedEnvelope, parseSourceReference, sourceReference,
} from './index.js';

const rawEnvelope = {
  contractVersion: '1.0', companyId: 'company-1', branchId: 'branch-1', actorId: 'actor-1',
  correlationId: 'correlation-1', causationId: 'causation-1', sourceType: 'SALES_ORDER',
  sourceId: 'order-1', occurredAt: '2026-09-18T12:30:45.123Z',
};

test('opaque identifiers validate their boundary representation', () => {
  assert.equal(companyId('company:egypt'), 'company:egypt');
  assert.equal(branchId('branch_1'), 'branch_1');
  assert.equal(actorId('actor.1'), 'actor.1');
  assert.equal(correlationId('correlation-1'), 'correlation-1');
  assert.equal(idempotencyKey('request-1'), 'request-1');
  for (const invalid of ['', ' spaces ', '-leading', 'trailing-', 'x'.repeat(129)]) {
    assert.throws(() => companyId(invalid), ContractValidationError);
  }
});

test('Money is exact, immutable, serialization safe, and never accepts a number', () => {
  const value = money('9007199254740993.123456789', 'EGP');
  assert.deepEqual(JSON.parse(JSON.stringify(value)), { amount: '9007199254740993.123456789', currency: 'EGP' });
  assert.ok(Object.isFrozen(value));
  assertContractRoundTrip(value, parseMoney);
  assert.throws(() => money(0.1, 'EGP'), /amount: must be a string/);
  assert.equal(money('-0.1', 'EGP').amount, '-0.1');
  for (const invalid of ['01', '1.0', '1.', '.1', '1e3', '-0', '-0.10', 'NaN']) assert.throws(() => money(invalid, 'EGP'));
  for (const invalid of ['egp', 'EG', 'EGYP', '12A']) assert.throws(() => money('1', invalid));
  assert.throws(() => parseMoney({ amount: '1', currency: 'EGP', precision: 2 }), /unknown field/);
});

test('execution context and source reference are immutable and round-trip', () => {
  const context = executionContext('company-1', 'branch-1', 'actor-1');
  const source = sourceReference('TOURISM_BOOKING', 'booking-1');
  assert.ok(Object.isFrozen(context));
  assert.ok(Object.isFrozen(source));
  assertContractRoundTrip(context, parseExecutionContext);
  assertContractRoundTrip(source, parseSourceReference);
  assert.throws(() => sourceReference('tourism-booking', 'booking-1'));
});

test('base envelope requires all audit metadata and preserves it through transport', () => {
  const envelope = parseContractEnvelope(rawEnvelope);
  assert.ok(Object.isFrozen(envelope));
  assertContractRoundTrip(envelope, parseContractEnvelope);
  assert.deepEqual(envelope, rawEnvelope);
  const missingActor: Record<string, unknown> = { ...rawEnvelope };
  delete missingActor.actorId;
  assert.throws(() => parseContractEnvelope(missingActor), /ActorId/);
  assert.throws(() => parseContractEnvelope({ ...rawEnvelope, idempotencyKey: 'unexpected' }), /unknown field/);
});

test('idempotency and revision capabilities are explicit envelope variants', () => {
  const idempotent = parseIdempotentEnvelope({ ...rawEnvelope, idempotencyKey: 'intent-1' });
  const revisioned = parseRevisionedEnvelope({ ...rawEnvelope, expectedRevision: 0 });
  const both = parseIdempotentRevisionedEnvelope({ ...rawEnvelope, idempotencyKey: 'intent-1', expectedRevision: 42 });
  assert.equal(idempotent.idempotencyKey, 'intent-1');
  assert.equal(revisioned.expectedRevision, 0);
  assert.equal(both.expectedRevision, 42);
  for (const revision of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1']) {
    assert.throws(() => parseRevisionedEnvelope({ ...rawEnvelope, expectedRevision: revision }));
  }
});

test('versions and timestamps reject malformed or impossible values', () => {
  for (const contractVersion of ['1', 'v1', '1.0.0', '-1.0']) {
    assert.throws(() => parseContractEnvelope({ ...rawEnvelope, contractVersion }));
  }
  for (const occurredAt of ['2026-02-30T00:00:00.000Z', '2026-09-18', '2026-09-18T12:30:45+00:00']) {
    assert.throws(() => parseContractEnvelope({ ...rawEnvelope, occurredAt }));
  }
});

test('domain events are versioned immutable payload facts with no internal classes', () => {
  const payload = { invoiceId: 'invoice-1', lines: [{ amount: '10.25' }] };
  const event = domainEvent('InvoicePosted', rawEnvelope, payload);
  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.envelope));
  assert.ok(Object.isFrozen(event.payload));
  assert.ok(Object.isFrozen(event.payload.lines));
  assertContractRoundTrip(event, parseDomainEvent);
  assert.throws(() => domainEvent('PostInvoice', rawEnvelope, payload), /past-tense/);
  assert.throws(() => domainEvent('InvoicePosted', rawEnvelope, { unsafe: new Date() } as never), /serialization-safe/);
  assert.throws(() => domainEvent('InvoicePosted', rawEnvelope, { unsafe: undefined } as never), /undefined/);
});

test('identifier brands prevent accidental cross-assignment at compile time', () => {
  const company = companyId('company-1');
  // @ts-expect-error CompanyId and BranchId are intentionally not interchangeable.
  const branch: ReturnType<typeof branchId> = company;
  assert.equal(branch, 'company-1');
});
