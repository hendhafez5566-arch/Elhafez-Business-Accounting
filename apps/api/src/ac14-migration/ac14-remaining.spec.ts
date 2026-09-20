import assert from 'node:assert/strict';
import test from 'node:test';
import { AC14_STAGES } from './stages.js';
import { GOLDEN_SCENARIO_EVIDENCE, assertCompleteGoldenScenarioRegistry } from './golden-scenario.registry.js';
import { LegacyJournalValidationError, canonicalDecimal, normalizeLegacyJournal } from './legacy-journal.js';
import {
  AC14_FROZEN_SOURCE_REGISTRY,
  AC14_KNOWN_FROZEN_COLLECTIONS,
  inspectFrozenSourceCoverage,
  processingRegistration,
  registrationsForSource,
} from './source-registry.js';
import { Ac14MigrationCoordinator } from './coordinator.service.js';
import { ProductionAc14OwnerImportGateway } from './production-owner-import.gateway.js';
import type { HistoricalImportUnit } from './owner-import.gateway.js';

test('remaining AC-14 stages are deterministic and dependency ordered', () => {
  assert.equal(AC14_STAGES.length, 36);
  assert.deepEqual(AC14_STAGES.map(([name]) => name).slice(0, 8), ['source-preflight', 'currencies', 'historical-fx-rates', 'cost-centers', 'fiscal-years', 'accounting-periods', 'chart-of-accounts', 'general-ledger-journals']);
  assert.deepEqual(AC14_STAGES.map(([name]) => name).slice(-4), ['reporting-rebuild', 'equivalence', 'golden-scenarios', 'cutover-readiness']);
});

test('GS-001 through GS-040 each have one executable evidence registration', async () => {
  await assertCompleteGoldenScenarioRegistry();
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


const realAlignmentCases = [
  ['prepaidSchedules', 'ExpenseRecognition', 'prepayment', 'prepayments'],
  ['deferredRevenueSchedules', 'ExpenseRecognition', 'deferred-revenue', 'deferredRevenue'],
  ['deferredCostSchedules', 'ExpenseRecognition', 'deferred-cost', 'deferredCost'],
  ['accruedRevenues', 'ExpenseRecognition', 'accrual', 'accruals'],
  ['fixedAssets', 'AssetsFinancing', 'asset', 'assets'],
  ['assetDepreciations', 'AssetsFinancing', 'depreciation-event', 'depreciationEvents'],
  ['loanSchedules', 'AssetsFinancing', 'loan-installment', 'loanInstallments'],
  ['doubtfulAllowances', 'AssetsFinancing', 'allowance', 'allowances'],
  ['payrollRuns', 'AssetsFinancing', 'payroll-accounting', 'payrollAccounting'],
  ['accountBudgets', 'CostBudget', 'budget', 'budgets'],
  ['partyNettings', 'PartyAccounting', 'netting', 'nettings'],
  ['taxCodes', 'Tax', 'historical-tax-representation', 'taxFacts'],
] as const;

test('synthetic v32.5.66 fixture discovers real accounting source keys and keeps target kind separate', () => {
  for (const [sourceCollection, owner, targetKind, importKind] of realAlignmentCases) {
    const entry = AC14_FROZEN_SOURCE_REGISTRY.find(
      (candidate) =>
        candidate.sourceCollection === sourceCollection &&
        candidate.owner === owner &&
        candidate.disposition === 'PROCESS',
    );
    assert.ok(entry, `${sourceCollection} must be processed`);
    assert.equal(entry.targetKind, targetKind);
    assert.equal(entry.importKind, importKind);
    assert.equal(entry.sourceCollection, sourceCollection);
  }
  const inventedSourceAliases = [
    'prepayments',
    'deferredRevenue',
    'deferredCost',
    'accruals',
    'assets',
    'depreciationEvents',
    'loanInstallments',
    'allowances',
    'payrollAccounting',
    'budgets',
    'nettings',
    'taxSnapshots',
    'taxFacts',
  ];
  for (const alias of inventedSourceAliases)
    assert.equal(
      AC14_FROZEN_SOURCE_REGISTRY.some((entry) => entry.sourceCollection === alias),
      false,
      `${alias} must never be used for frozen-source discovery`,
    );
});

test('customer and supplier settlements are explicit blocking classifications rather than silent omissions', () => {
  for (const sourceCollection of ['customerSettlements', 'supplierSettlements']) {
    const entries = registrationsForSource(sourceCollection);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.disposition, 'CLASSIFY');
    assert.ok(
      entries[0]?.issueCode === 'AMBIGUOUS_LEGACY_SEMANTICS' ||
        entries[0]?.issueCode === 'UNSUPPORTED_LEGACY_CONSTRUCT',
    );
  }
});

test('receipt and payment economics have exactly Billing allocation and Treasury cash roles, never a GL replay role', () => {
  for (const sourceCollection of ['receipts', 'payments']) {
    const entries = registrationsForSource(sourceCollection).filter(
      (entry) => entry.disposition === 'PROCESS',
    );
    assert.deepEqual(
      entries.map((entry) => [entry.owner, entry.targetKind]).sort(),
      [
        ['Billing', 'allocation-set'],
        ['Treasury', sourceCollection === 'receipts' ? 'receipt-voucher' : 'payment-voucher'],
      ].sort(),
    );
    assert.equal(entries.some((entry) => entry.owner === 'GeneralLedger'), false);
    assert.equal(entries.some((entry) => entry.owner === 'ExpenseRecognition'), false);
  }
});

test('every manager-verified actual Umrah collection is processed or explicitly classified', () => {
  const umrahCollections = [
    'umrahSeasons',
    'umrahHotelContracts',
    'umrahFlightBlocks',
    'umrahTransportContracts',
    'umrahVisaContracts',
    'umrahServiceContracts',
    'umrahContractReservations',
    'umrahPrograms',
    'umrahProgramSegments',
    'umrahProgramCosts',
    'umrahBookings',
    'umrahTravelers',
    'umrahHotelRooms',
    'umrahVisaBatches',
    'umrahVisaItems',
    'umrahTickets',
    'umrahBusRuns',
    'umrahOperationTasks',
    'umrahIncidents',
    'umrahSupplierCommitments',
    'umrahActivity',
    'umrahOutbox',
  ];
  for (const sourceCollection of umrahCollections) {
    assert.ok(AC14_KNOWN_FROZEN_COLLECTIONS.includes(sourceCollection as never));
    const entries = registrationsForSource(sourceCollection);
    assert.ok(entries.length > 0, `${sourceCollection} must be registered`);
    assert.ok(entries.every((entry) => entry.disposition === 'PROCESS' || Boolean(entry.issueCode)));
  }
  assert.equal(
    processingRegistration(
      'tourism-contract-inventory',
      'TourismContractInventory',
      'umrahHotelContracts',
    )?.strategy,
    'UMRAH_CONTRACT',
  );
  assert.equal(
    processingRegistration(
      'tourism-contract-inventory',
      'TourismContractInventory',
      'umrahContractReservations',
    )?.strategy,
    'UMRAH_RESERVATION',
  );
});

test('coverage gate blocks known non-empty unmapped or classified collections and diagnoses malformed shapes', () => {
  const unmapped = inspectFrozenSourceCoverage(
    { newlyKnown: [{ id: 'x' }] },
    ['newlyKnown'],
    [],
  );
  assert.deepEqual(unmapped, [
    {
      sourceCollection: 'newlyKnown',
      state: 'UNMAPPED',
      issueCode: 'UNSUPPORTED_LEGACY_CONSTRUCT',
      stage: 'source-preflight',
      detail: 'known non-empty frozen source collection has no mapping or disposition',
    },
  ]);

  const malformed = inspectFrozenSourceCoverage(
    { prepaidSchedules: { id: 'not-an-array' } },
    ['prepaidSchedules'],
  );
  assert.equal(malformed[0]?.state, 'MALFORMED');
  assert.equal(malformed[0]?.issueCode, 'UNKNOWN_COLLECTION_SHAPE');

  const classified = inspectFrozenSourceCoverage(
    { customerSettlements: [{ id: 'cs-1' }] },
    ['customerSettlements'],
  );
  assert.equal(classified[0]?.state, 'CLASSIFIED');
  assert.equal(classified[0]?.issueCode, 'AMBIGUOUS_LEGACY_SEMANTICS');

  const empty = inspectFrozenSourceCoverage(
    { prepaidSchedules: [] },
    ['prepaidSchedules'],
  );
  assert.deepEqual(empty, [{ sourceCollection: 'prepaidSchedules', state: 'EMPTY' }]);
});

test('expected equivalence changes when records are added to a real frozen key', () => {
  const owners = {
    ownerNames: () =>
      [...new Set(
        AC14_FROZEN_SOURCE_REGISTRY
          .filter((entry) => entry.disposition === 'PROCESS' && entry.owner)
          .map((entry) => entry.owner!),
      )].sort(),
  };
  const coordinator = new Ac14MigrationCoordinator({} as never, owners as never);
  const derive = (
    coordinator as unknown as {
      expectedEquivalence(root: Record<string, unknown>): ReadonlyMap<string, Readonly<Record<string, string>>>;
    }
  ).expectedEquivalence.bind(coordinator);
  const empty = derive({ prepaidSchedules: [] });
  const populated = derive({
    prepaidSchedules: [
      {
        id: 'prepaid-1',
        expenseId: 'expense-1',
        date: '2026-01-31',
        amount: 125.25,
        currency: 'EGP',
        status: 'posted',
      },
    ],
  });
  assert.equal(empty.get('ExpenseRecognition')?.records, '0');
  assert.equal(populated.get('ExpenseRecognition')?.records, '1');
  assert.equal(populated.get('ExpenseRecognition')?.amount, '125.25');
});

test('sourceCollection remains the exact legacy key while targetKind may differ', () => {
  const registration = registrationsForSource('prepaidSchedules').find(
    (entry) => entry.disposition === 'PROCESS',
  );
  assert.equal(registration?.sourceCollection, 'prepaidSchedules');
  assert.equal(registration?.targetKind, 'prepayment');
  assert.equal(registration?.importKind, 'prepayments');
});

test('production owner adapter fans a legacy receipt into Billing allocations only while Treasury receives one cash voucher', async () => {
  const calls: Array<{ owner: string; command: Record<string, unknown> }> = [];
  const boundary = (owner: string) => ({
    validate: () => undefined,
    importHistorical: async (command: Record<string, unknown>) => {
      calls.push({ owner, command });
      return {
        status: 'IMPORTED' as const,
        targetKind: String(command.collection),
        targetId: String(command.sourceId),
      };
    },
    equivalence: async () => ({
      records: '0',
      payloadDigest: '',
      debit: '0',
      credit: '0',
      amount: '0',
    }),
    canonicalRecords: async () => [],
  });
  const gateway = new ProductionAc14OwnerImportGateway(
    boundary('CurrencyFx') as never,
    boundary('CostBudget') as never,
    boundary('PeriodControl') as never,
    boundary('GeneralLedger') as never,
    boundary('Tax') as never,
    boundary('Billing') as never,
    boundary('Treasury') as never,
    boundary('PartyAccounting') as never,
    boundary('ExpenseRecognition') as never,
    boundary('AssetsFinancing') as never,
    boundary('Procurement') as never,
    boundary('FinancialControls') as never,
    boundary('TourismContractInventory') as never,
    boundary('TourismFinance') as never,
    { rebuild: async () => ({ evidenceCount: 0 }) } as never,
  );
  const common = {
    runId: 'run',
    stage: 'billing-settlements',
    sourceCollection: 'receipts',
    sourceId: 'receipt-1',
    sourcePayloadHash: 'a'.repeat(64),
    targetCompanyId: 'company',
    targetBranchId: 'branch',
    payload: {
      id: 'receipt-1',
      partyType: 'customer',
      partyId: 'customer-1',
      treasuryId: 'cash-1',
      date: '2026-01-01',
      amount: 100,
      currency: 'EGP',
      allocations: [
        { invoiceId: 'inv-1', invoiceAmount: 60 },
        { invoiceId: 'inv-2', invoiceAmount: 40 },
      ],
    },
  } satisfies Omit<HistoricalImportUnit, 'owner' | 'importKind' | 'targetKind' | 'processingStrategy'>;

  const billing = registrationsForSource('receipts').find(
    (entry) => entry.owner === 'Billing',
  )!;
  const billingResult = await gateway.importUnit({
    ...common,
    owner: 'Billing',
    importKind: billing.importKind!,
    targetKind: billing.targetKind!,
    processingStrategy: billing.strategy!,
  });
  assert.equal(billingResult.targetKind, 'allocation-set');
  assert.deepEqual(
    calls.filter((call) => call.owner === 'Billing').map((call) => call.command.collection),
    ['allocations', 'allocations'],
  );
  assert.deepEqual(
    calls.filter((call) => call.owner === 'Billing').map((call) => call.command.sourceId),
    ['receipt-1:allocation:1', 'receipt-1:allocation:2'],
  );

  const treasury = registrationsForSource('receipts').find(
    (entry) => entry.owner === 'Treasury',
  )!;
  await gateway.importUnit({
    ...common,
    stage: 'treasury-vouchers',
    owner: 'Treasury',
    importKind: treasury.importKind!,
    targetKind: treasury.targetKind!,
    processingStrategy: treasury.strategy!,
  });
  assert.equal(calls.filter((call) => call.owner === 'Treasury').length, 1);
  assert.equal(
    calls.find((call) => call.owner === 'Treasury')?.command.collection,
    'receipts',
  );
  assert.equal(calls.some((call) => call.owner === 'GeneralLedger'), false);
});


test('non-empty Umrah activity and outbox roots are explicitly classified and never processed', () => {
  for (const sourceCollection of ['umrahActivity', 'umrahOutbox']) {
    const entries = registrationsForSource(sourceCollection);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.disposition, 'CLASSIFY');
    assert.equal(entries[0]?.issueCode, 'UNSUPPORTED_LEGACY_CONSTRUCT');
    assert.equal(entries[0]?.owner, null);
    assert.equal(
      AC14_FROZEN_SOURCE_REGISTRY.some(
        (entry) =>
          entry.sourceCollection === sourceCollection &&
          entry.disposition === 'PROCESS',
      ),
      false,
    );
    const coverage = inspectFrozenSourceCoverage(
      { [sourceCollection]: [{ id: sourceCollection + '-1' }] },
      [sourceCollection],
    );
    assert.equal(coverage[0]?.state, 'CLASSIFIED');
    assert.equal(coverage[0]?.issueCode, 'UNSUPPORTED_LEGACY_CONSTRUCT');
  }
});
