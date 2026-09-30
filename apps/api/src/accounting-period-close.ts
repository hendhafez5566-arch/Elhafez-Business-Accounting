import { BadRequestException } from '@nestjs/common';

/**
 * Controlled period close/reopen — composition layer ONLY.
 * Owners: Financial Controls (readiness + evidence), Period Control (state).
 * Accounting periods are company-wide in the current domain, so close-readiness
 * evidence must be company-wide too. Branch context authorizes the actor, but it
 * is not used to ignore blockers in other branches.
 */
export type PeriodStatus = 'OPEN' | 'CLOSED';

export interface CloseCheck {
  readonly key: string;
  readonly passed: boolean;
  readonly severity: 'BLOCKER' | 'WARNING';
  readonly detail: string;
}
export interface PeriodRef { readonly id: string; readonly fiscalYearId: string; readonly status: PeriodStatus }
export interface FiscalYearRef { readonly id: string; readonly status: PeriodStatus }
export interface PeriodsPort<P extends PeriodRef, Y extends FiscalYearRef = FiscalYearRef> {
  listPeriods(companyId: string): Promise<readonly P[]>;
  listFiscalYears(companyId: string): Promise<readonly Y[]>;
  setPeriodStatus(companyId: string, periodId: string, status: PeriodStatus): Promise<unknown>;
}
export interface ReadinessInput {
  readonly id: string;
  readonly companyId: string;
  readonly branchId?: string;
  readonly correlationId: string;
  readonly evaluatedAt?: string;
  readonly checks: readonly CloseCheck[];
}
export interface ReadinessResultLike {
  readonly ready: boolean;
  readonly blockers: readonly unknown[];
  readonly warnings: readonly unknown[];
}
export interface ControlsPort {
  listApprovalRequests(companyId: string, branchId?: string): Promise<readonly { readonly status: string }[]>;
  listControlIssues(companyId: string, branchId?: string): Promise<readonly { readonly resolvedAt?: string }[]>;
  evaluateCloseReadiness(input: ReadinessInput): Promise<ReadinessResultLike>;
}
export interface CloseIssue { readonly key: string; readonly detail: string }
export type StableId = (companyId: string, kind: string, key: string) => string;

/** Legacy close concepts still without an accepted NEW close-policy contract. Never faked as passed. */
export const DEFERRED_CLOSE_CHECKS = [
  { key: 'UNSETTLED_CHEQUES', label: 'شيكات غير مسوّاة' },
  { key: 'FX_REVALUATION_REQUIRED', label: 'إعادة تقييم العملات الأجنبية' },
  { key: 'CASH_COUNT_REQUIRED', label: 'جرد الخزينة' },
  { key: 'ACCRUAL_RECOGNITION_READY', label: 'جاهزية الاستحقاق/الاعتراف' }
].map(item => ({ ...item, status: 'DEFERRED — OWNER EVIDENCE REQUIRED' as const }));

export type DeferredChecks = typeof DEFERRED_CLOSE_CHECKS;

function issue(value: unknown): CloseIssue {
  const row = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  return { key: String(row.key ?? ''), detail: String(row.detail ?? '') };
}

/** Canonical Financial Controls evidence; branchId undefined means company-wide. */
export async function collectControlChecks(
  controls: Pick<ControlsPort, 'listApprovalRequests' | 'listControlIssues'>,
  companyId: string,
  branchId?: string,
): Promise<CloseCheck[]> {
  const pending = (await controls.listApprovalRequests(companyId, branchId)).filter(value => value.status === 'PENDING').length;
  const unresolved = (await controls.listControlIssues(companyId, branchId)).filter(value => !value.resolvedAt).length;
  return [
    {
      key: 'PENDING_APPROVALS',
      passed: pending === 0,
      severity: 'BLOCKER',
      detail: pending === 0 ? 'لا توجد طلبات اعتماد معلّقة' : `يوجد ${pending} طلب اعتماد معلّق يجب البت فيه قبل الإغلاق`,
    },
    {
      key: 'UNRESOLVED_CONTROL_ISSUES',
      passed: unresolved === 0,
      severity: 'BLOCKER',
      detail: unresolved === 0 ? 'لا توجد مشكلات رقابة غير محلولة' : `يوجد ${unresolved} مشكلة رقابة/تسوية غير محلولة`,
    },
  ];
}

export async function evaluateReadiness(
  controls: Pick<ControlsPort, 'evaluateCloseReadiness'>,
  input: ReadinessInput,
): Promise<{ ready: boolean; blockers: CloseIssue[]; warnings: CloseIssue[] }> {
  const result = await controls.evaluateCloseReadiness(input);
  const blockers = result.blockers.map(issue);
  const warnings = result.warnings.map(issue);
  return { ready: result.ready && blockers.length === 0, blockers, warnings };
}

export interface PeriodCloseOutcome<P extends PeriodRef> {
  readonly closed: boolean;
  readonly alreadyClosed: boolean;
  readonly period: P;
  readonly ready: boolean;
  readonly blockers: readonly CloseIssue[];
  readonly warnings: readonly CloseIssue[];
  readonly deferred: DeferredChecks;
}

async function requirePeriod<P extends PeriodRef, Y extends FiscalYearRef>(
  periods: PeriodsPort<P, Y>,
  companyId: string,
  periodId: string,
): Promise<P> {
  const period = (await periods.listPeriods(companyId)).find(value => value.id === periodId);
  if (!period) throw new BadRequestException('period not found');
  return period;
}

export async function controlledPeriodClose<P extends PeriodRef, Y extends FiscalYearRef>(
  deps: { readonly periods: PeriodsPort<P, Y>; readonly controls: ControlsPort; readonly stableId: StableId },
  cmd: { readonly companyId: string; readonly periodId: string; readonly commandKey: string },
): Promise<PeriodCloseOutcome<P>> {
  const period = await requirePeriod(deps.periods, cmd.companyId, cmd.periodId);
  if (period.status === 'CLOSED') {
    return { closed: true, alreadyClosed: true, period, ready: true, blockers: [], warnings: [], deferred: DEFERRED_CLOSE_CHECKS };
  }

  const checks: CloseCheck[] = [
    { key: 'PERIOD_OPEN_STATE', passed: period.status === 'OPEN', severity: 'BLOCKER', detail: 'الفترة يجب أن تكون مفتوحة للإغلاق' },
    ...(await collectControlChecks(deps.controls, cmd.companyId)),
  ];
  const readiness = await evaluateReadiness(deps.controls, {
    id: deps.stableId(cmd.companyId, 'PERIOD_CLOSE_READINESS', cmd.commandKey),
    companyId: cmd.companyId,
    correlationId: `period-close:${cmd.periodId}:${cmd.commandKey}`,
    checks,
  });
  if (!readiness.ready) {
    return { closed: false, alreadyClosed: false, period, ready: false, blockers: readiness.blockers, warnings: readiness.warnings, deferred: DEFERRED_CLOSE_CHECKS };
  }

  await deps.periods.setPeriodStatus(cmd.companyId, cmd.periodId, 'CLOSED');
  return {
    closed: true,
    alreadyClosed: false,
    period: await requirePeriod(deps.periods, cmd.companyId, cmd.periodId),
    ready: true,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    deferred: DEFERRED_CLOSE_CHECKS,
  };
}

/** Period reopen cannot create an OPEN period inside a CLOSED fiscal year. */
export async function controlledPeriodReopen<P extends PeriodRef, Y extends FiscalYearRef>(
  deps: { readonly periods: PeriodsPort<P, Y> },
  cmd: { readonly companyId: string; readonly periodId: string },
): Promise<{ readonly reopened: boolean; readonly period: P }> {
  const period = await requirePeriod(deps.periods, cmd.companyId, cmd.periodId);
  if (period.status === 'OPEN') return { reopened: false, period };
  const year = (await deps.periods.listFiscalYears(cmd.companyId)).find(value => value.id === period.fiscalYearId);
  if (!year) throw new BadRequestException('fiscal year not found');
  if (year.status === 'CLOSED') throw new BadRequestException('reopen the fiscal year before reopening this period');
  await deps.periods.setPeriodStatus(cmd.companyId, cmd.periodId, 'OPEN');
  return { reopened: true, period: await requirePeriod(deps.periods, cmd.companyId, cmd.periodId) };
}
