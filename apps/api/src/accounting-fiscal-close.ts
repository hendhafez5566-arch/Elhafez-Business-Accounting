import { BadRequestException } from '@nestjs/common';
import {
  collectControlChecks,
  evaluateReadiness,
  DEFERRED_CLOSE_CHECKS,
  type CloseCheck,
  type CloseIssue,
  type ControlsPort,
  type DeferredChecks,
  type StableId,
} from './accounting-period-close.js';

/** Period Control owns fiscal state/history, GL owns close/reversal journals, Controls owns readiness evidence. */
export interface FiscalYearRef { readonly id: string; readonly endDate: string; readonly status: 'OPEN' | 'CLOSED' }

export interface FiscalDeps<Y extends FiscalYearRef, I, R> {
  readonly periods: {
    listFiscalYears(companyId: string): Promise<readonly Y[]>;
    prepareFiscalClose(companyId: string, fiscalYearId: string): Promise<I>;
    completeFiscalClose(instruction: I, result: { journalId: string }): Promise<unknown>;
    prepareReopen(companyId: string, fiscalYearId: string): Promise<R & { closeJournalId: string }>;
    completeReopen(reopen: R, result: { journalId: string }): Promise<unknown>;
  };
  readonly ledger: {
    closeFiscalYear(instruction: I, retainedEarningsAccountId: string, number: string): Promise<{ readonly id: string }>;
    reverse(companyId: string, journalId: string, postingDate: string, number: string): Promise<{ readonly id: string }>;
  };
  readonly controls: ControlsPort;
  readonly stableId: StableId;
}

export interface FiscalCloseOutcome<Y extends FiscalYearRef> {
  readonly closed: boolean;
  readonly alreadyClosed: boolean;
  readonly fiscalYear: Y;
  readonly blockers: readonly CloseIssue[];
  readonly warnings: readonly CloseIssue[];
  readonly deferred: DeferredChecks;
  readonly journalId?: string;
}

async function requireYear<Y extends FiscalYearRef>(list: Promise<readonly Y[]>, fiscalYearId: string): Promise<Y> {
  const year = (await list).find(value => value.id === fiscalYearId);
  if (!year) throw new BadRequestException('fiscal year not found');
  return year;
}

export async function controlledFiscalYearClose<Y extends FiscalYearRef, I, R>(
  deps: FiscalDeps<Y, I, R>,
  cmd: { companyId: string; fiscalYearId: string; retainedEarningsAccountId: string; number: string; commandKey: string },
): Promise<FiscalCloseOutcome<Y>> {
  const year = await requireYear(deps.periods.listFiscalYears(cmd.companyId), cmd.fiscalYearId);
  if (year.status === 'CLOSED') {
    return { closed: true, alreadyClosed: true, fiscalYear: year, blockers: [], warnings: [], deferred: DEFERRED_CLOSE_CHECKS };
  }

  // Fiscal years are company-wide. Readiness must aggregate all branches, not the actor's current branch only.
  const checks: CloseCheck[] = [
    { key: 'FISCAL_YEAR_OPEN_STATE', passed: year.status === 'OPEN', severity: 'BLOCKER', detail: 'السنة المالية يجب أن تكون مفتوحة للإقفال' },
    ...(await collectControlChecks(deps.controls, cmd.companyId)),
  ];
  const readiness = await evaluateReadiness(deps.controls, {
    id: deps.stableId(cmd.companyId, 'FISCAL_CLOSE_READINESS', cmd.commandKey),
    companyId: cmd.companyId,
    correlationId: `fiscal-close:${cmd.fiscalYearId}:${cmd.commandKey}`,
    checks,
  });
  if (!readiness.ready) {
    return { closed: false, alreadyClosed: false, fiscalYear: year, blockers: readiness.blockers, warnings: readiness.warnings, deferred: DEFERRED_CLOSE_CHECKS };
  }

  // Exact canonical owner sequence already covered by General Ledger / Period Control tests.
  const instruction = await deps.periods.prepareFiscalClose(cmd.companyId, cmd.fiscalYearId);
  const close = await deps.ledger.closeFiscalYear(instruction, cmd.retainedEarningsAccountId, cmd.number);
  await deps.periods.completeFiscalClose(instruction, { journalId: close.id });
  return {
    closed: true,
    alreadyClosed: false,
    fiscalYear: await requireYear(deps.periods.listFiscalYears(cmd.companyId), cmd.fiscalYearId),
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    deferred: DEFERRED_CLOSE_CHECKS,
    journalId: close.id,
  };
}

export async function controlledFiscalYearReopen<Y extends FiscalYearRef, I, R>(
  deps: FiscalDeps<Y, I, R>,
  cmd: { companyId: string; fiscalYearId: string; postingDate?: string; number: string },
): Promise<{ readonly reopened: boolean; readonly fiscalYear: Y; readonly journalId?: string }> {
  const year = await requireYear(deps.periods.listFiscalYears(cmd.companyId), cmd.fiscalYearId);
  if (year.status === 'OPEN') return { reopened: false, fiscalYear: year };
  const reopen = await deps.periods.prepareReopen(cmd.companyId, cmd.fiscalYearId);
  const reversal = await deps.ledger.reverse(cmd.companyId, reopen.closeJournalId, cmd.postingDate ?? year.endDate, cmd.number);
  await deps.periods.completeReopen(reopen, { journalId: reversal.id });
  return { reopened: true, fiscalYear: await requireYear(deps.periods.listFiscalYears(cmd.companyId), cmd.fiscalYearId), journalId: reversal.id };
}
