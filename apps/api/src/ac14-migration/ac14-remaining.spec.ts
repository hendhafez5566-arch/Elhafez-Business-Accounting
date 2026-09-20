import assert from 'node:assert/strict';
import test from 'node:test';
import { AC14_STAGES } from './stages.js';
import { GOLDEN_SCENARIO_EVIDENCE, assertCompleteGoldenScenarioRegistry } from './golden-scenario.registry.js';
import { LegacyJournalValidationError, canonicalDecimal, normalizeLegacyJournal } from './legacy-journal.js';

test('remaining AC-14 stages are deterministic and dependency ordered', () => {
  assert.equal(AC14_STAGES.length, 36);
  assert.deepEqual(AC14_STAGES.map(([name]) => name).slice(0, 8), ['source-preflight', 'currencies', 'historical-fx-rates', 'cost-centers', 'fiscal-years', 'accounting-periods', 'chart-of-accounts', 'general-ledger-journals']);
  assert.deepEqual(AC14_STAGES.map(([name]) => name).slice(-4), ['reporting-rebuild', 'equivalence', 'golden-scenarios', 'cutover-readiness']);
});

test('GS-001 through GS-040 each have one executable evidence registration', () => {
  assertCompleteGoldenScenarioRegistry();
  assert.equal(GOLDEN_SCENARIO_EVIDENCE.length, 40);
  assert.equal(GOLDEN_SCENARIO_EVIDENCE[0]?.id, 'GS-001');
  assert.equal(GOLDEN_SCENARIO_EVIDENCE[39]?.id, 'GS-040');
  assert.ok(GOLDEN_SCENARIO_EVIDENCE.every((entry) => entry.testFile.endsWith('.spec.ts') && entry.testNamePattern === entry.id));
});

test('legacy GL normalization preserves authoritative bases, foreign evidence, and reversal lineage', () => {
  const journal = normalizeLegacyJournal({ id: 'j2', refType: 'reversal', refId: 'j1', lines: [
    { accountId: 'cash', currency: 'USD', debit: '10.00', baseDebit: '309.123400', baseCredit: '0', rate: '30.91234' },
    { accountId: 'revenue', currency: 'USD', credit: '10', baseDebit: '0', baseCredit: '309.1234', rate: '30.91234' },
  ] });
  assert.equal(journal.kind, 'REVERSAL');
  assert.equal(journal.reversalSourceId, 'j1');
  assert.deepEqual(journal.lines, [
    { accountId: 'cash', debit: '309.1234', foreignCurrency: 'USD', foreignAmount: '10', fxRate: '30.91234' },
    { accountId: 'revenue', credit: '309.1234', foreignCurrency: 'USD', foreignAmount: '10', fxRate: '30.91234' },
  ]);
});

test('legacy GL rejects malformed decimals, missing accounts, broken reversals, and authoritative imbalance', () => {
  assert.equal(canonicalDecimal('9007199254740993.000000000000000001'), '9007199254740993.000000000000000001');
  const base = { id: 'j', lines: [{ accountId: 'a', baseDebit: '1', baseCredit: '0' }, { accountId: 'b', baseDebit: '0', baseCredit: '2' }] };
  assert.throws(() => normalizeLegacyJournal(base), (error) => error instanceof LegacyJournalValidationError && error.code === 'UNSUPPORTED_LEGACY_CONSTRUCT');
  assert.throws(() => normalizeLegacyJournal({ ...base, lines: [{ accountId: 'a', baseDebit: 'NaN' }, { accountId: 'b', baseCredit: '0' }] }), /invalid finite decimal/);
  assert.throws(() => normalizeLegacyJournal({ ...base, lines: [{ baseDebit: '1' }, { accountId: 'b', baseCredit: '1' }] }), (error) => error instanceof LegacyJournalValidationError && error.code === 'MISSING_ACCOUNT');
  assert.throws(() => normalizeLegacyJournal({ ...base, refType: 'reversal', lines: [{ accountId: 'a', baseDebit: '1' }, { accountId: 'b', baseCredit: '1' }] }), (error) => error instanceof LegacyJournalValidationError && error.code === 'BROKEN_REVERSAL_LINEAGE');
});
