import test from 'node:test';
import assert from 'node:assert/strict';
import { controlledPeriodClose, controlledPeriodReopen, type PeriodRef, type ReadinessInput } from './accounting-period-close.js';

type P = PeriodRef & { companyId: string };

function harness(o: {
  status?: 'OPEN' | 'CLOSED';
  fiscalYearStatus?: 'OPEN' | 'CLOSED';
  approvals?: { status: string }[];
  issues?: { resolvedAt?: string }[];
  warnings?: unknown[];
  company?: string;
} = {}) {
  const state: P[] = [{ id: 'p1', companyId: o.company ?? 'c1', fiscalYearId: 'fy', status: o.status ?? 'OPEN' }];
  const years = [{ id: 'fy', status: o.fiscalYearStatus ?? 'OPEN' as 'OPEN' | 'CLOSED' }];
  const calls = { set: [] as string[], readiness: [] as ReadinessInput[], lists: [] as string[] };
  const periods = {
    async listPeriods(c: string) { return state.filter(p => p.companyId === c); },
    async listFiscalYears() { return years; },
    async setPeriodStatus(c: string, id: string, s: 'OPEN' | 'CLOSED') {
      calls.set.push(`${c}:${id}:${s}`);
      const p = state.find(x => x.id === id && x.companyId === c);
      if (p) (p as { status: 'OPEN' | 'CLOSED' }).status = s;
    }
  };
  const controls = {
    async listApprovalRequests(c: string, b?: string) { calls.lists.push(`approvals:${c}:${b ?? 'ALL'}`); return o.approvals ?? []; },
    async listControlIssues(c: string, b?: string) { calls.lists.push(`issues:${c}:${b ?? 'ALL'}`); return o.issues ?? []; },
    async evaluateCloseReadiness(input: ReadinessInput) {
      calls.readiness.push(input);
      const blockers = input.checks.filter(c => !c.passed && c.severity === 'BLOCKER').map(c => ({ key: c.key, detail: c.detail }));
      return { ready: blockers.length === 0, blockers, warnings: o.warnings ?? [] };
    }
  };
  const stableId = (c: string, k: string, key: string) => `${c}|${k}|${key}`;
  return { deps: { periods, controls, stableId }, calls, state };
}
const cmd = { companyId: 'c1', periodId: 'p1', commandKey: 'k1' };

test('pending approval is a BLOCKER: no period mutation', async () => {
  const h = harness({ approvals: [{ status: 'PENDING' }, { status: 'APPROVED' }] });
  const r = await controlledPeriodClose(h.deps, cmd);
  assert.equal(r.closed, false);
  assert.equal(r.blockers[0]?.key, 'PENDING_APPROVALS');
  assert.deepEqual(h.calls.set, []);
});

test('unresolved control issue is a BLOCKER: no period mutation', async () => {
  const h = harness({ issues: [{ resolvedAt: '2026-01-01' }, {}] });
  const r = await controlledPeriodClose(h.deps, cmd);
  assert.equal(r.closed, false);
  assert.equal(r.blockers[0]?.key, 'UNRESOLVED_CONTROL_ISSUES');
  assert.deepEqual(h.calls.set, []);
});

test('company-wide accounting close reads control evidence across all branches', async () => {
  const h = harness();
  await controlledPeriodClose(h.deps, cmd);
  assert.deepEqual(h.calls.lists, ['approvals:c1:ALL', 'issues:c1:ALL']);
  assert.equal(h.calls.readiness[0]!.branchId, undefined);
});

test('checks are computed from owner evidence, not fake passes', async () => {
  const h = harness({ approvals: [{ status: 'APPROVED' }, { status: 'REJECTED' }], issues: [{ resolvedAt: 'x' }] });
  await controlledPeriodClose(h.deps, cmd);
  const checks = h.calls.readiness[0]!.checks;
  assert.deepEqual(checks.map(c => [c.key, c.passed]), [
    ['PERIOD_OPEN_STATE', true],
    ['PENDING_APPROVALS', true],
    ['UNRESOLVED_CONTROL_ISSUES', true],
  ]);
});

test('ready period closes once; warnings are preserved; retry does not create readiness evidence', async () => {
  const h = harness({ warnings: [{ key: 'W', detail: 'تنبيه' }] });
  const r = await controlledPeriodClose(h.deps, cmd);
  assert.equal(r.closed, true);
  assert.deepEqual(r.warnings, [{ key: 'W', detail: 'تنبيه' }]);
  const again = await controlledPeriodClose(h.deps, cmd);
  assert.equal(again.alreadyClosed, true);
  assert.deepEqual(h.calls.set, ['c1:p1:CLOSED']);
  assert.equal(h.calls.readiness.length, 1);
  assert.equal(h.calls.readiness[0]!.id, 'c1|PERIOD_CLOSE_READINESS|k1');
  assert.equal(h.calls.readiness[0]!.correlationId, 'period-close:p1:k1');
});

test('company isolation rejects a period owned by another company', async () => {
  const h = harness({ company: 'c1' });
  await assert.rejects(controlledPeriodClose(h.deps, { ...cmd, companyId: 'c2' }), /period not found/);
  assert.equal(h.calls.readiness.length, 0);
  assert.deepEqual(h.calls.set, []);
});

test('period reopen is separate/idempotent and cannot reopen inside a CLOSED fiscal year', async () => {
  const h = harness({ status: 'CLOSED' });
  assert.equal((await controlledPeriodReopen({ periods: h.deps.periods }, cmd)).reopened, true);
  assert.equal((await controlledPeriodReopen({ periods: h.deps.periods }, cmd)).reopened, false);
  assert.deepEqual(h.calls.set, ['c1:p1:OPEN']);

  const blocked = harness({ status: 'CLOSED', fiscalYearStatus: 'CLOSED' });
  await assert.rejects(controlledPeriodReopen({ periods: blocked.deps.periods }, cmd), /reopen the fiscal year/);
  assert.deepEqual(blocked.calls.set, []);
});
