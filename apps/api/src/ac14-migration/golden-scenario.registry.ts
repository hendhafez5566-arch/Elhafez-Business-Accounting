export interface GoldenScenarioEvidence { id: `GS-${string}`; testFile: string; testNamePattern: string }

const groups: readonly [number, number, string][] = [
  [1, 2, 'modules/billing-subledgers/src/billing-subledgers.spec.ts'],
  [3, 8, 'modules/treasury-settlement/src/treasury-settlement.spec.ts'],
  [9, 9, 'modules/billing-subledgers/src/billing-subledgers.spec.ts'],
  [10, 10, 'modules/party-accounting/src/party-accounting.spec.ts'],
  [11, 14, 'modules/expense-commission-recognition/src/expense-commission-recognition.spec.ts'],
  [15, 18, 'modules/assets-financing/src/assets-financing.spec.ts'],
  [19, 19, 'modules/billing-subledgers/src/billing-subledgers.spec.ts'],
  [20, 20, 'modules/treasury-settlement/src/treasury-settlement.spec.ts'],
  [21, 21, 'modules/financial-controls/src/financial-controls.spec.ts'],
  [22, 22, 'modules/general-ledger/src/general-ledger.spec.ts'],
  [23, 28, 'modules/tourism-finance-orchestration/src/ac12.spec.ts'],
  [29, 31, 'modules/procurement-finance/src/procurement-finance.spec.ts'],
  [32, 39, 'modules/tourism-contract-inventory/src/ac11.spec.ts'],
  [40, 40, 'modules/financial-controls/src/financial-controls.spec.ts'],
];

export const GOLDEN_SCENARIO_EVIDENCE: readonly GoldenScenarioEvidence[] = groups.flatMap(
  ([from, to, testFile]) => Array.from({ length: to - from + 1 }, (_, offset) => {
    const id = `GS-${String(from + offset).padStart(3, '0')}` as const;
    return Object.freeze({ id, testFile, testNamePattern: id });
  }),
);

export function assertCompleteGoldenScenarioRegistry(): void {
  const expected = Array.from({ length: 40 }, (_, i) => `GS-${String(i + 1).padStart(3, '0')}`);
  const actual = GOLDEN_SCENARIO_EVIDENCE.map((entry) => entry.id);
  if (new Set(actual).size !== 40 || expected.some((id, index) => actual[index] !== id)) {
    throw new Error('AC-14 requires executable evidence for GS-001 through GS-040');
  }
}
