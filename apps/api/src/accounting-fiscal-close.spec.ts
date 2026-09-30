import test from 'node:test';
import assert from 'node:assert/strict';
import { controlledFiscalYearClose, controlledFiscalYearReopen } from './accounting-fiscal-close.js';

function harness(o: { yearStatus?: 'OPEN' | 'CLOSED'; approvals?: { status: string }[]; issues?: { resolvedAt?: string }[] } = {}) {
  const log: string[] = [];
  const year = { id: 'fy', endDate: '2026-12-31', status: o.yearStatus ?? 'OPEN' as 'OPEN' | 'CLOSED' };
  const deps = {
    periods: {
      async listFiscalYears() { return [year]; },
      async prepareFiscalClose(c: string, y: string) { log.push(`prepare:${c}:${y}`); return { companyId: c, fiscalYearId: y, endDate: '2026-12-31' }; },
      async completeFiscalClose(i: { fiscalYearId: string }, r: { journalId: string }) { log.push(`complete:${i.fiscalYearId}:${r.journalId}`); year.status = 'CLOSED'; },
      async prepareReopen(c: string, y: string) { log.push(`prepareReopen:${c}:${y}`); return { companyId: c, fiscalYearId: y, closeJournalId: 'J-CLOSE' }; },
      async completeReopen(_r: { companyId: string; fiscalYearId: string; closeJournalId: string }, r: { journalId: string }) { log.push(`completeReopen:${r.journalId}`); year.status = 'OPEN'; }
    },
    ledger: {
      async closeFiscalYear(_i: { companyId: string; fiscalYearId: string; endDate: string }, re: string, n: string) { log.push(`closeFiscalYear:${re}:${n}`); return { id: 'J-CLOSE' }; },
      async reverse(c: string, j: string, d: string, n: string) { log.push(`reverse:${c}:${j}:${d}:${n}`); return { id: 'J-REV' }; }
    },
    controls: {
      async listApprovalRequests(_c: string, b?: string) { log.push(`approvals:${b ?? 'ALL'}`); return o.approvals ?? []; },
      async listControlIssues(_c: string, b?: string) { log.push(`issues:${b ?? 'ALL'}`); return o.issues ?? []; },
      async evaluateCloseReadiness(i: { checks: readonly { passed: boolean; severity: string; key: string; detail: string }[] }) {
        const blockers = i.checks.filter(c => !c.passed && c.severity === 'BLOCKER');
        log.push('readiness');
        return { ready: blockers.length === 0, blockers, warnings: [] };
      }
    },
    stableId: (c: string, k: string, key: string) => `${c}|${k}|${key}`
  };
  return { deps, log, year };
}
const close = { companyId: 'c1', fiscalYearId: 'fy', retainedEarningsAccountId: 'eq', number: 'CL1', commandKey: 'k' };

test('pending approvals block fiscal close before Period Control/GL mutation', async () => {
  const h = harness({ approvals: [{ status: 'PENDING' }] });
  const r = await controlledFiscalYearClose(h.deps, close);
  assert.equal(r.closed, false);
  assert.ok(!h.log.some(l => l.startsWith('prepare:')));
  assert.ok(!h.log.some(l => l.startsWith('closeFiscalYear:')));
});

test('unresolved control issues block fiscal close', async () => {
  const h = harness({ issues: [{}] });
  const r = await controlledFiscalYearClose(h.deps, close);
  assert.equal(r.closed, false);
  assert.equal(r.blockers[0]?.key, 'UNRESOLVED_CONTROL_ISSUES');
});

test('fiscal readiness is company-wide and follows exact canonical owner sequence', async () => {
  const h = harness();
  const r = await controlledFiscalYearClose(h.deps, close);
  assert.equal(r.closed, true);
  assert.equal(r.journalId, 'J-CLOSE');
  assert.deepEqual(h.log, [
    'approvals:ALL', 'issues:ALL', 'readiness',
    'prepare:c1:fy', 'closeFiscalYear:eq:CL1', 'complete:fy:J-CLOSE'
  ]);
});

test('retry on a closed year is a no-op without new readiness evidence', async () => {
  const h = harness();
  await controlledFiscalYearClose(h.deps, close);
  const before = h.log.length;
  const again = await controlledFiscalYearClose(h.deps, close);
  assert.equal(again.alreadyClosed, true);
  assert.equal(h.log.length, before);
});

test('reopen uses matching close reversal then Period Control completion', async () => {
  const h = harness({ yearStatus: 'CLOSED' });
  const r = await controlledFiscalYearReopen(h.deps, { companyId: 'c1', fiscalYearId: 'fy', number: 'RCL1' });
  assert.equal(r.reopened, true);
  assert.deepEqual(h.log, ['prepareReopen:c1:fy', 'reverse:c1:J-CLOSE:2026-12-31:RCL1', 'completeReopen:J-REV']);
});

test('open year reopen is a no-op and unknown year is rejected', async () => {
  const h = harness();
  const r = await controlledFiscalYearReopen(h.deps, { companyId: 'c1', fiscalYearId: 'fy', number: 'R' });
  assert.equal(r.reopened, false);
  assert.deepEqual(h.log, []);
  await assert.rejects(controlledFiscalYearClose(h.deps, { ...close, fiscalYearId: 'nope' }), /fiscal year not found/);
});
