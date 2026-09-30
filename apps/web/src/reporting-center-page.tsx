import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ActionBar,
  Badge,
  Button,
  Card,
  DataGrid,
  DisclosureCard,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  MetricCard,
  Select,
  Toast,
} from './ui.js';
import { WorkspaceNavigation, WorkspacePane } from './ui/screen-layouts.js';
import {
  HttpReportingCenterClient,
  type AgingReport,
  type CurrencyTotalsReport,
  type ProgramAccountingReport,
  type ProgramOption,
  type ReportKey,
  type ReportSchedule,
  type ReportScopeFilters,
  type ReportingCenterClient,
  type ReportingCenterData,
  type SavedReport,
  type ScopedStatements,
} from './reporting-center-client.js';
import type { InvoiceRow, ReportRow } from './accounting-client.js';

type Tab = 'executive' | 'financial' | 'parties' | 'operations' | 'saved';
type FinancialView =
  | 'FINANCIAL_STATEMENTS'
  | 'AR_AGING'
  | 'AP_AGING'
  | 'TREASURY'
  | 'TAX'
  | 'PROGRAM_PROFITABILITY';
type PartyKind = 'CUSTOMER' | 'SUPPLIER';

const reportLabels: Record<ReportKey, string> = {
  EXECUTIVE_OVERVIEW: 'الملخص التنفيذي',
  FINANCIAL_STATEMENTS: 'القوائم المالية',
  AR_AGING: 'أعمار ديون العملاء',
  AP_AGING: 'أعمار ديون الموردين',
  CUSTOMER_STATEMENT: 'كشف حساب عميل',
  SUPPLIER_STATEMENT: 'كشف حساب مورد',
  TREASURY: 'الخزائن والسيولة',
  TAX: 'الضرائب',
  PROGRAM_PROFITABILITY: 'ربحية البرامج',
  CRM_SALES: 'العملاء والمبيعات',
  SUPPLIER_PROCUREMENT: 'الموردون والمشتريات',
  HAJJ_UMRAH: 'الحج والعمرة',
  EXCEPTIONS: 'الاستثناءات ومركز العمل',
};
const financialLabels: Record<FinancialView, string> = {
  FINANCIAL_STATEMENTS: 'القوائم المالية',
  AR_AGING: 'أعمار ديون العملاء',
  AP_AGING: 'أعمار ديون الموردين',
  TREASURY: 'الخزائن والسيولة',
  TAX: 'الضرائب',
  PROGRAM_PROFITABILITY: 'ربحية البرامج',
};
const empty: ReportingCenterData = {
  management: {
    generatedAt: '',
    totals: { attention: 0, critical: 0, high: 0 },
    domains: [],
    summary: {
      crmSales: {
        customers: 0,
        agents: 0,
        travelers: 0,
        overdueFollowups: 0,
        leadStages: {},
        quotationStatuses: {},
        quotationValueByCurrency: [],
      },
      suppliers: { total: 0, openDisputes: 0, activeHolds: 0 },
      hajjUmrah: { activePrograms: 0, readinessItems: 0, criticalReadinessItems: 0 },
      finance: { overduePositions: 0, overdueByCurrency: [] },
    },
    items: [],
  },
  accounting: {
    fiscalYears: [],
    periods: [],
    accounts: [],
    journals: [],
    invoices: [],
    treasuries: [],
    vouchers: [],
    taxPolicies: [],
    approvalPolicies: [],
    approvalRequests: [],
    controlIssues: [],
    reports: {
      trialBalance: { rows: [] },
      incomeStatement: { rows: [] },
      balanceSheet: { rows: [] },
      treasury: { totals: [] },
      tax: { totals: [], facts: [] },
    },
  },
  financialHistory: { reconciliationRuns: [], closeReadinessRuns: [], auditEntries: [] },
  savedReports: [],
  schedules: [],
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'تعذر تنفيذ العملية.';
}
function reportRows(rows: readonly ReportRow[]) {
  return rows.map((row) => [row.accountId ?? row.accountClass ?? '—', row.currency, row.amount]);
}
function csvValue(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
function downloadCsv(
  name: string,
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
) {
  const content =
    '\uFEFF' + [headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name + '.csv';
  link.click();
  URL.revokeObjectURL(url);
}
function scheduleLabel(schedule: ReportSchedule) {
  if (schedule.cadence === 'DAILY') return 'يوميًا الساعة ' + schedule.hourUtc + ':00 UTC';
  if (schedule.cadence === 'WEEKLY')
    return 'أسبوعيًا — يوم ' + String(schedule.weekday) + ' — ' + schedule.hourUtc + ':00 UTC';
  return 'شهريًا — يوم ' + String(schedule.dayOfMonth) + ' — ' + schedule.hourUtc + ':00 UTC';
}
function daysPastDue(dueDate: string | undefined, today = new Date()) {
  if (!dueDate) return null;
  const due = new Date(dueDate + 'T00:00:00Z');
  if (Number.isNaN(due.getTime())) return null;
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((current - due.getTime()) / 86400000);
}
function agingBucket(dueDate: string | undefined) {
  const days = daysPastDue(dueDate);
  if (days === null || days <= 0) return 'غير مستحق';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}
function savedScope(filters: Readonly<Record<string, unknown>>): ReportScopeFilters {
  return {
    ...(typeof filters.from === 'string' ? { from: filters.from } : {}),
    ...(typeof filters.to === 'string' ? { to: filters.to } : {}),
    ...(typeof filters.asOf === 'string' ? { asOf: filters.asOf } : {}),
  };
}
function inScope(date: string, scope: ReportScopeFilters) {
  return (
    (!scope.from || date >= scope.from) &&
    (!scope.to || date <= scope.to) &&
    (!scope.asOf || date <= scope.asOf)
  );
}
function scaled(value: string) {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const result =
    BigInt(whole || '0') * 10n ** 18n + BigInt((fraction || '').padEnd(18, '0').slice(0, 18));
  return negative ? -result : result;
}
function decimal(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 10n ** 18n;
  const fraction = absolute % 10n ** 18n;
  const text = fraction
    ? `${whole}.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}`
    : whole.toString();
  return (negative ? '-' : '') + text;
}
function sumDecimal(values: readonly string[]) {
  return decimal(values.reduce((total, value) => total + scaled(value), 0n));
}
function invoiceDocumentTotal(invoice: InvoiceRow) {
  return sumDecimal(
    invoice.lines.flatMap((line) => [line.amount, ...(line.taxAmount ? [line.taxAmount] : [])]),
  );
}
function partyOptions(data: ReportingCenterData, kind: PartyKind) {
  const ids = new Set<string>();
  for (const invoice of data.accounting.invoices) {
    const matches =
      kind === 'CUSTOMER'
        ? invoice.type === 'CUSTOMER' || invoice.type === 'OPENING_CUSTOMER_BALANCE'
        : invoice.type === 'SUPPLIER';
    if (matches) ids.add(invoice.partyId);
  }
  for (const voucher of data.accounting.vouchers) {
    if (voucher.partyKind === kind) ids.add(voucher.partyId);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}
type PartyMovement = Readonly<{
  key: string;
  date: string;
  type: string;
  document: string;
  currency: string;
  debit: string;
  credit: string;
  outstanding: string;
  status: string;
  source: string;
  allocations: string;
  advance: string;
}>;
function partyMovements(
  data: ReportingCenterData,
  kind: PartyKind,
  partyId: string,
  scope: ReportScopeFilters,
): PartyMovement[] {
  if (!partyId) return [];
  const invoices = data.accounting.invoices
    .filter((row) => {
      const matches =
        kind === 'CUSTOMER'
          ? row.type === 'CUSTOMER' || row.type === 'OPENING_CUSTOMER_BALANCE'
          : row.type === 'SUPPLIER';
      return row.partyId === partyId && matches && inScope(row.postingDate, scope);
    })
    .map((row) => {
      const amount = row.status === 'CANCELLED' ? '0' : invoiceDocumentTotal(row);
      const opening = row.type === 'OPENING_CUSTOMER_BALANCE';
      return {
        key: 'invoice:' + row.id,
        date: row.postingDate,
        type: opening ? 'رصيد افتتاحي' : kind === 'CUSTOMER' ? 'فاتورة عميل' : 'فاتورة مورد',
        document: row.externalInvoiceNumber ?? row.number,
        currency: row.currency,
        debit: kind === 'CUSTOMER' ? amount : '0',
        credit: kind === 'SUPPLIER' ? amount : '0',
        outstanding: row.outstanding,
        status: row.status,
        source: row.sourceType + ':' + row.sourceId,
        allocations: '—',
        advance: '—',
      } satisfies PartyMovement;
    });
  const vouchers = data.accounting.vouchers
    .filter(
      (row) => row.partyKind === kind && row.partyId === partyId && inScope(row.postingDate, scope),
    )
    .map((row) => {
      const amount = row.status === 'POSTED' ? row.amount : '0';
      const debit = row.kind === 'PAYMENT' ? amount : '0';
      const credit = row.kind === 'RECEIPT' ? amount : '0';
      return {
        key: 'voucher:' + row.id,
        date: row.postingDate,
        type: row.kind === 'RECEIPT' ? 'سند قبض' : 'سند صرف',
        document: row.number,
        currency: row.currency,
        debit,
        credit,
        outstanding: '—',
        status: row.status,
        source: row.sourceType + ':' + row.sourceId,
        allocations: row.allocationIds.length ? row.allocationIds.join(' | ') : '—',
        advance: row.advanceId ?? '—',
      } satisfies PartyMovement;
    });
  return [...invoices, ...vouchers].sort(
    (a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key),
  );
}

export function ReportingCenterPage({ client }: { client?: ReportingCenterClient } = {}) {
  const api = useMemo(() => client ?? new HttpReportingCenterClient(), [client]);
  const [data, setData] = useState<ReportingCenterData>(empty);
  const [tab, setTab] = useState<Tab>('executive');
  const [financialView, setFinancialView] = useState<FinancialView>('FINANCIAL_STATEMENTS');
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scopeDraft, setScopeDraft] = useState({ from: '', to: '', asOf: '' });
  const [scope, setScope] = useState<ReportScopeFilters>({});
  const [statements, setStatements] = useState<ScopedStatements | null>(null);
  const [aging, setAging] = useState<AgingReport | null>(null);
  const [totals, setTotals] = useState<CurrencyTotalsReport | null>(null);
  const [programs, setPrograms] = useState<readonly ProgramOption[]>([]);
  const [programId, setProgramId] = useState('');
  const [programReport, setProgramReport] = useState<ProgramAccountingReport | null>(null);
  const [partyKind, setPartyKind] = useState<PartyKind>('CUSTOMER');
  const [partyId, setPartyId] = useState('');
  const [partyAging, setPartyAging] = useState<AgingReport | null>(null);
  const [savedForm, setSavedForm] = useState({
    name: '',
    reportKey: 'EXECUTIVE_OVERVIEW' as ReportKey,
    visibility: 'PRIVATE' as 'PRIVATE' | 'COMPANY',
  });
  const [scheduleForm, setScheduleForm] = useState({
    savedReportId: '',
    cadence: 'DAILY' as 'DAILY' | 'WEEKLY' | 'MONTHLY',
    hourUtc: '8',
    weekday: '0',
    dayOfMonth: '1',
    channel: 'IN_APP' as 'IN_APP' | 'EMAIL',
    recipient: '',
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await api.load());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [api]);

  useEffect(() => {
    if (tab !== 'financial' || financialView !== 'PROGRAM_PROFITABILITY') return;
    let active = true;
    api
      .programs()
      .then((rows) => {
        if (!active) return;
        setPrograms(rows);
        setProgramId((current) =>
          current && rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? ''),
        );
      })
      .catch((e) => active && setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [api, tab, financialView]);

  useEffect(() => {
    if (tab !== 'financial') return;
    if (financialView === 'PROGRAM_PROFITABILITY' && !programId) {
      setReportLoading(false);
      setProgramReport(null);
      return;
    }
    let active = true;
    setReportLoading(true);
    setError('');
    const task =
      financialView === 'FINANCIAL_STATEMENTS'
        ? api.statements(scope)
        : financialView === 'AR_AGING'
          ? api.aging('CUSTOMER', scope)
          : financialView === 'AP_AGING'
            ? api.aging('SUPPLIER', scope)
            : financialView === 'TREASURY'
              ? api.treasury(scope)
              : financialView === 'TAX'
                ? api.tax(scope)
                : api.program(programId, scope);
    task
      .then((value) => {
        if (!active) return;
        if (financialView === 'FINANCIAL_STATEMENTS') setStatements(value as ScopedStatements);
        else if (financialView === 'AR_AGING' || financialView === 'AP_AGING')
          setAging(value as AgingReport);
        else if (financialView === 'TREASURY' || financialView === 'TAX')
          setTotals(value as CurrencyTotalsReport);
        else setProgramReport(value as ProgramAccountingReport);
      })
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setReportLoading(false));
    return () => {
      active = false;
    };
  }, [api, tab, financialView, programId, scope.from, scope.to, scope.asOf]);

  const currentPartyOptions = useMemo(
    () => partyOptions(data, partyKind),
    [data.accounting.invoices, data.accounting.vouchers, partyKind],
  );
  useEffect(() => {
    if (tab !== 'parties') return;
    setPartyId((current) =>
      current && currentPartyOptions.includes(current) ? current : (currentPartyOptions[0] ?? ''),
    );
  }, [tab, partyKind, currentPartyOptions]);
  useEffect(() => {
    if (tab !== 'parties') return;
    let active = true;
    setReportLoading(true);
    api
      .aging(partyKind, scope)
      .then((value) => active && setPartyAging(value))
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setReportLoading(false));
    return () => {
      active = false;
    };
  }, [api, tab, partyKind, scope.from, scope.to, scope.asOf]);

  async function perform(success: string, task: () => Promise<unknown>) {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await task();
      setNotice(success);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  async function createSaved(event: FormEvent) {
    event.preventDefault();
    const isPartyStatement =
      savedForm.reportKey === 'CUSTOMER_STATEMENT' || savedForm.reportKey === 'SUPPLIER_STATEMENT';
    if (isPartyStatement && !partyId) {
      setError('اختر العميل أو المورد من تبويب كشوف الحساب قبل حفظ التقرير.');
      return;
    }
    const filters = {
      scope: 'CURRENT_COMPANY_BRANCH',
      ...scope,
      ...(savedForm.reportKey === 'PROGRAM_PROFITABILITY' && programId ? { programId } : {}),
      ...(isPartyStatement ? { partyId } : {}),
    };
    await perform('تم حفظ التقرير.', () =>
      api.createSavedReport({
        name: savedForm.name,
        reportKey: savedForm.reportKey,
        visibility: savedForm.visibility,
        filters,
      }),
    );
    setSavedForm({ name: '', reportKey: 'EXECUTIVE_OVERVIEW', visibility: 'PRIVATE' });
  }
  async function createSchedule(event: FormEvent) {
    event.preventDefault();
    const hourUtc = Number(scheduleForm.hourUtc);
    const weekday = Number(scheduleForm.weekday);
    const dayOfMonth = Number(scheduleForm.dayOfMonth);
    await perform(
      'تم حفظ جدول التقرير. التنفيذ الخارجي يتم عبر قناة التسليم المهيأة.',
      () =>
        api.createSchedule({
          savedReportId: scheduleForm.savedReportId,
          cadence: scheduleForm.cadence,
          hourUtc,
          ...(scheduleForm.cadence === 'WEEKLY' ? { weekday } : {}),
          ...(scheduleForm.cadence === 'MONTHLY' ? { dayOfMonth } : {}),
          channel: scheduleForm.channel,
          ...(scheduleForm.channel === 'EMAIL' ? { recipient: scheduleForm.recipient } : {}),
        }),
    );
  }
  const activeSaved = useMemo(() => data.savedReports.filter((row) => row.active), [data.savedReports]);
  const critical = data.management.totals.critical;
  const high = data.management.totals.high;

  function applyScope() {
    setScope({
      ...(scopeDraft.from ? { from: scopeDraft.from } : {}),
      ...(scopeDraft.to ? { to: scopeDraft.to } : {}),
      ...(scopeDraft.asOf ? { asOf: scopeDraft.asOf } : {}),
    });
  }
  function openSaved(row: SavedReport) {
    const restored = savedScope(row.filters);
    setScope(restored);
    setScopeDraft({
      from: restored.from ?? '',
      to: restored.to ?? '',
      asOf: restored.asOf ?? '',
    });
    if (row.reportKey === 'PROGRAM_PROFITABILITY' && typeof row.filters.programId === 'string')
      setProgramId(row.filters.programId);
    if (
      (row.reportKey === 'CUSTOMER_STATEMENT' || row.reportKey === 'SUPPLIER_STATEMENT') &&
      typeof row.filters.partyId === 'string'
    ) {
      setPartyKind(row.reportKey === 'CUSTOMER_STATEMENT' ? 'CUSTOMER' : 'SUPPLIER');
      setPartyId(row.filters.partyId);
      setTab('parties');
      return;
    }
    if (row.reportKey === 'EXECUTIVE_OVERVIEW') {
      setTab('executive');
      return;
    }
    if (
      ['FINANCIAL_STATEMENTS', 'AR_AGING', 'AP_AGING', 'TREASURY', 'TAX', 'PROGRAM_PROFITABILITY'].includes(
        row.reportKey,
      )
    ) {
      setFinancialView(row.reportKey as FinancialView);
      setTab('financial');
      return;
    }
    setTab('operations');
  }
  function exportCurrent() {
    if (tab === 'parties') {
      const rows = partyMovements(data, partyKind, partyId, scope);
      downloadCsv(
        partyKind === 'CUSTOMER' ? 'customer-statement' : 'supplier-statement',
        [
          'التاريخ',
          'نوع الحركة',
          'المستند',
          'العملة',
          'مدين',
          'دائن',
          'المتبقي',
          'الحالة',
          'المصدر',
          'التسويات',
          'الدفعة المقدمة',
        ],
        rows.map((row) => [
          row.date,
          row.type,
          row.document,
          row.currency,
          row.debit,
          row.credit,
          row.outstanding,
          row.status,
          row.source,
          row.allocations,
          row.advance,
        ]),
      );
      return;
    }
    if (tab === 'financial') {
      if (financialView === 'AR_AGING' || financialView === 'AP_AGING') {
        const rows = aging?.positions ?? [];
        downloadCsv(
          financialView === 'AR_AGING' ? 'ar-aging' : 'ap-aging',
          ['الطرف', 'نوع المركز', 'تاريخ الاستحقاق', 'الأيام', 'الشريحة', 'العملة', 'الرصيد'],
          rows.map((row) => [
            row.partyId ?? '—',
            row.positionKind ?? '—',
            row.dueDate ?? '—',
            daysPastDue(row.dueDate) ?? '—',
            agingBucket(row.dueDate),
            row.currency,
            row.openAmount,
          ]),
        );
        return;
      }
      if (financialView === 'TREASURY' || financialView === 'TAX') {
        downloadCsv(
          financialView === 'TREASURY' ? 'treasury-report' : 'tax-report',
          ['العملة', 'القيمة'],
          (totals?.totals ?? []).map((row) => [row.currency, row.amount]),
        );
        return;
      }
      if (financialView === 'PROGRAM_PROFITABILITY') {
        downloadCsv(
          'program-profitability',
          ['العملة', 'الإيراد', 'التكلفة', 'الربح', 'مراكز التكلفة'],
          (programReport?.byCurrency ?? []).map((row) => [
            row.currency,
            row.revenue,
            row.cost,
            row.profit,
            row.costCenterIds?.join(' | ') ?? '',
          ]),
        );
        return;
      }
      const s = statements;
      downloadCsv(
        'financial-statements',
        ['البند', 'العملة', 'القيمة'],
        s
          ? [
              ...reportRows(s.trialBalance.rows),
              ...reportRows(s.incomeStatement.rows),
              ...reportRows(s.balanceSheet.rows),
            ]
          : [],
      );
      return;
    }
    if (tab === 'operations') {
      downloadCsv(
        'operational-exceptions',
        ['المجال', 'العنوان', 'التفاصيل', 'الأولوية', 'الحالة'],
        data.management.items.map((row) => [
          row.sourceDomain,
          row.title,
          row.summary,
          row.severity,
          row.status,
        ]),
      );
      return;
    }
    downloadCsv(
      'executive-summary',
      ['المؤشر', 'القيمة'],
      [
        ['الاستثناءات', data.management.totals.attention],
        ['حرج', critical],
        ['مرتفع', high],
        ['عملاء', data.management.summary.crmSales.customers],
        ['موردون', data.management.summary.suppliers.total],
        ['برامج حج وعمرة نشطة', data.management.summary.hajjUmrah.activePrograms],
        ['ذمم عملاء متأخرة', data.management.summary.finance.overduePositions],
      ],
    );
  }

  return (
    <section dir="rtl" className="ui-dashboard" aria-label="مركز التقارير">
      <Card title="مركز التقارير">
        <p>
          قراءة موحدة للتقارير المالية والتشغيلية من أصحاب البيانات الأصليين، مع حفظ طرق
          العرض وجدولتها بدون نسخ الحقيقة المحاسبية أو التشغيلية.
        </p>
        <ActionBar>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            تحديث
          </Button>
          {tab !== 'saved' ? (
            <>
              <Button type="button" variant="secondary" onClick={() => window.print()}>
                طباعة / PDF
              </Button>
              <Button type="button" variant="secondary" onClick={exportCurrent}>
                تصدير CSV لفتح Excel
              </Button>
            </>
          ) : null}
        </ActionBar>
      </Card>
      <WorkspacePane variant="nav">
        <WorkspaceNavigation
          ariaLabel="أقسام مركز التقارير"
          items={[
            { id: 'executive', label: 'ملخص تنفيذي' },
            { id: 'financial', label: 'تقارير مالية' },
            { id: 'parties', label: 'كشوف العملاء والموردين' },
            { id: 'operations', label: 'تقارير تشغيلية ورقابية' },
            { id: 'saved', label: 'التقارير المحفوظة والجدولة' },
          ]}
          active={tab}
          onChange={(id) => setTab(id as Tab)}
        />
      </WorkspacePane>
      {notice ? <Toast tone="success">{notice}</Toast> : null}
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : null}
      {tab === 'executive' ? <Executive data={data} /> : null}
      {tab === 'financial' ? (
        <Financial
          data={data}
          view={financialView}
          onView={setFinancialView}
          scope={scopeDraft}
          onScope={setScopeDraft}
          onApply={applyScope}
          reportLoading={reportLoading}
          statements={statements}
          aging={aging}
          totals={totals}
          programs={programs}
          programId={programId}
          onProgram={setProgramId}
          programReport={programReport}
        />
      ) : null}
      {tab === 'parties' ? (
        <PartyStatements
          data={data}
          kind={partyKind}
          onKind={setPartyKind}
          partyId={partyId}
          onParty={setPartyId}
          options={currentPartyOptions}
          scope={scopeDraft}
          appliedScope={scope}
          onScope={setScopeDraft}
          onApply={applyScope}
          reportLoading={reportLoading}
          aging={partyAging}
        />
      ) : null}
      {tab === 'operations' ? <Operations data={data} /> : null}
      {tab === 'saved' ? (
        <section className="ui-grid-md">
          <DisclosureCard
            title="حفظ تقرير"
            description="يحفظ اسم التقرير ونوعه ونطاق التاريخ والفلاتر اللازمة فقط؛ الأرقام تُقرأ من المصدر عند الفتح."
          >
            <form onSubmit={createSaved}>
              <FormField label="اسم التقرير" required>
                <Input
                  required
                  value={savedForm.name}
                  onChange={(e) => setSavedForm({ ...savedForm, name: e.target.value })}
                />
              </FormField>
              <FormField label="نوع التقرير">
                <Select
                  value={savedForm.reportKey}
                  onChange={(e) =>
                    setSavedForm({ ...savedForm, reportKey: e.target.value as ReportKey })
                  }
                >
                  {Object.entries(reportLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="الرؤية">
                <Select
                  value={savedForm.visibility}
                  onChange={(e) =>
                    setSavedForm({
                      ...savedForm,
                      visibility: e.target.value as 'PRIVATE' | 'COMPANY',
                    })
                  }
                >
                  <option value="PRIVATE">خاص بي</option>
                  <option value="COMPANY">مشترك للشركة</option>
                </Select>
              </FormField>
              <Button type="submit" disabled={loading}>
                حفظ التقرير
              </Button>
            </form>
          </DisclosureCard>
          <Card title="التقارير المحفوظة">
            {!data.savedReports.length ? (
              <EmptyState title="لا توجد تقارير محفوظة" />
            ) : (
              <DataGrid columns={['الاسم', 'النوع', 'الرؤية', 'الحالة', 'آخر تحديث', 'إجراء']}>
                {data.savedReports.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{reportLabels[row.reportKey]}</td>
                    <td>{row.visibility === 'COMPANY' ? 'الشركة' : 'خاص'}</td>
                    <td>
                      <Badge tone={row.active ? 'success' : 'warning'}>
                        {row.active ? 'نشط' : 'متوقف'}
                      </Badge>
                    </td>
                    <td>{new Date(row.updatedAt).toLocaleString('ar-EG')}</td>
                    <td>
                      <ActionBar>
                        <Button type="button" variant="secondary" onClick={() => openSaved(row)}>
                          فتح
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            void perform(
                              row.active
                                ? 'تم إيقاف التقرير المحفوظ.'
                                : 'تم تفعيل التقرير المحفوظ.',
                              () => api.updateSavedReport(row.id, { active: !row.active }),
                            )
                          }
                        >
                          {row.active ? 'إيقاف' : 'تفعيل'}
                        </Button>
                      </ActionBar>
                    </td>
                  </tr>
                ))}
              </DataGrid>
            )}
          </Card>
          <DisclosureCard
            title="جدولة تقرير"
            description="يحفظ موعد وقناة التسليم. التنفيذ الخارجي يظل مسؤولية طبقة التكامل وليس Reporting owner."
          >
            <form onSubmit={createSchedule}>
              <FormField label="التقرير المحفوظ" required>
                <Select
                  required
                  value={scheduleForm.savedReportId}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, savedReportId: e.target.value })
                  }
                >
                  <option value="">اختر</option>
                  {activeSaved.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="التكرار">
                <Select
                  value={scheduleForm.cadence}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      cadence: e.target.value as typeof scheduleForm.cadence,
                    })
                  }
                >
                  <option value="DAILY">يومي</option>
                  <option value="WEEKLY">أسبوعي</option>
                  <option value="MONTHLY">شهري</option>
                </Select>
              </FormField>
              <FormField label="الساعة UTC">
                <Input
                  inputMode="numeric"
                  required
                  value={scheduleForm.hourUtc}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, hourUtc: e.target.value })}
                />
              </FormField>
              {scheduleForm.cadence === 'WEEKLY' ? (
                <FormField label="يوم الأسبوع (0-6)">
                  <Input
                    inputMode="numeric"
                    required
                    value={scheduleForm.weekday}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, weekday: e.target.value })
                    }
                  />
                </FormField>
              ) : null}
              {scheduleForm.cadence === 'MONTHLY' ? (
                <FormField label="يوم الشهر (1-28)">
                  <Input
                    inputMode="numeric"
                    required
                    value={scheduleForm.dayOfMonth}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, dayOfMonth: e.target.value })
                    }
                  />
                </FormField>
              ) : null}
              <FormField label="قناة التسليم">
                <Select
                  value={scheduleForm.channel}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      channel: e.target.value as 'IN_APP' | 'EMAIL',
                    })
                  }
                >
                  <option value="IN_APP">داخل النظام</option>
                  <option value="EMAIL">بريد إلكتروني</option>
                </Select>
              </FormField>
              {scheduleForm.channel === 'EMAIL' ? (
                <FormField label="البريد المستلم" required>
                  <Input
                    required
                    type="email"
                    value={scheduleForm.recipient}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, recipient: e.target.value })
                    }
                  />
                </FormField>
              ) : null}
              <Button type="submit" disabled={loading || !activeSaved.length}>
                حفظ الجدولة
              </Button>
            </form>
          </DisclosureCard>
          <Card title="الجداول">
            {!data.schedules.length ? (
              <EmptyState title="لا توجد جداول تقارير" />
            ) : (
              <DataGrid columns={['التقرير', 'الموعد', 'القناة', 'المستلم', 'الحالة', 'إجراء']}>
                {data.schedules.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {data.savedReports.find((saved) => saved.id === row.savedReportId)?.name ??
                        row.savedReportId}
                    </td>
                    <td>{scheduleLabel(row)}</td>
                    <td>{row.channel === 'EMAIL' ? 'بريد إلكتروني' : 'داخل النظام'}</td>
                    <td>{row.recipient ?? '—'}</td>
                    <td>
                      <Badge tone={row.enabled ? 'success' : 'warning'}>
                        {row.enabled ? 'نشط' : 'متوقف'}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          void perform(
                            row.enabled ? 'تم إيقاف الجدولة.' : 'تم تفعيل الجدولة.',
                            () => api.updateSchedule(row.id, { enabled: !row.enabled }),
                          )
                        }
                      >
                        {row.enabled ? 'إيقاف' : 'تفعيل'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </DataGrid>
            )}
          </Card>
        </section>
      ) : null}
    </section>
  );
}

function Executive({ data }: { data: ReportingCenterData }) {
  const summary = data.management.summary;
  return (
    <>
      <div className="ui-metric-grid">
        <MetricCard
          label="الاستثناءات المفتوحة"
          value={data.management.totals.attention}
          tone={data.management.totals.attention ? 'warning' : 'success'}
        />
        <MetricCard
          label="حرج"
          value={data.management.totals.critical}
          tone={data.management.totals.critical ? 'warning' : 'success'}
        />
        <MetricCard label="متابعات متأخرة" value={summary.crmSales.overdueFollowups} />
        <MetricCard label="نزاعات موردين مفتوحة" value={summary.suppliers.openDisputes} />
        <MetricCard label="عناصر جاهزية الحج والعمرة" value={summary.hajjUmrah.readinessItems} />
        <MetricCard label="ذمم عملاء متأخرة" value={summary.finance.overduePositions} />
      </div>
      <Card title="قيمة عروض الأسعار حسب العملة">
        <DataGrid columns={['العملة', 'القيمة']}>
          {summary.crmSales.quotationValueByCurrency.map((row) => (
            <tr key={row.currency}>
              <td>{row.currency}</td>
              <td>{row.total}</td>
            </tr>
          ))}
        </DataGrid>
      </Card>
      <Card title="الذمم المتأخرة حسب العملة">
        <DataGrid columns={['العملة', 'القيمة']}>
          {summary.finance.overdueByCurrency.map((row) => (
            <tr key={row.currency}>
              <td>{row.currency}</td>
              <td>{row.amount}</td>
            </tr>
          ))}
        </DataGrid>
      </Card>
    </>
  );
}

function Financial({
  data,
  view,
  onView,
  scope,
  onScope,
  onApply,
  reportLoading,
  statements,
  aging,
  totals,
  programs,
  programId,
  onProgram,
  programReport,
}: {
  data: ReportingCenterData;
  view: FinancialView;
  onView: (value: FinancialView) => void;
  scope: { from: string; to: string; asOf: string };
  onScope: (value: { from: string; to: string; asOf: string }) => void;
  onApply: () => void;
  reportLoading: boolean;
  statements: ScopedStatements | null;
  aging: AgingReport | null;
  totals: CurrencyTotalsReport | null;
  programs: readonly ProgramOption[];
  programId: string;
  onProgram: (id: string) => void;
  programReport: ProgramAccountingReport | null;
}) {
  const statementData = statements ?? {
    trialBalance: data.accounting.reports.trialBalance,
    incomeStatement: data.accounting.reports.incomeStatement,
    balanceSheet: data.accounting.reports.balanceSheet,
  };
  const currencyTotals =
    totals?.totals ??
    (view === 'TREASURY'
      ? data.accounting.reports.treasury.totals
      : data.accounting.reports.tax.totals);
  return (
    <section className="ui-grid-md">
      <Card title="نطاق التقرير">
        <div className="ui-filter-grid">
          <FormField label="التقرير المالي">
            <Select
              aria-label="التقرير المالي"
              value={view}
              onChange={(e) => onView(e.target.value as FinancialView)}
            >
              {Object.entries(financialLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          {view === 'PROGRAM_PROFITABILITY' ? (
            <FormField label="البرنامج">
              <Select
                aria-label="البرنامج"
                value={programId}
                onChange={(e) => onProgram(e.target.value)}
              >
                <option value="">اختر البرنامج</option>
                {programs.map((row) => (
                  <option key={row.source + ':' + row.id} value={row.id}>
                    {row.source === 'TOURISM' ? 'سياحة' : 'حج/عمرة'} — {row.code} — {row.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <FormField label="من تاريخ">
            <Input
              type="date"
              value={scope.from}
              onChange={(e) => onScope({ ...scope, from: e.target.value })}
            />
          </FormField>
          <FormField label="إلى تاريخ">
            <Input
              type="date"
              value={scope.to}
              onChange={(e) => onScope({ ...scope, to: e.target.value })}
            />
          </FormField>
          <FormField label="كما في">
            <Input
              type="date"
              value={scope.asOf}
              onChange={(e) => onScope({ ...scope, asOf: e.target.value })}
            />
          </FormField>
        </div>
        <ActionBar>
          <Button type="button" onClick={onApply} disabled={reportLoading}>
            تطبيق النطاق
          </Button>
        </ActionBar>
      </Card>
      {reportLoading ? <LoadingState /> : null}
      {view === 'FINANCIAL_STATEMENTS' ? (
        <div className="ui-grid-md">
          <ReportCard title="ميزان المراجعة" rows={statementData.trialBalance.rows} />
          <ReportCard title="قائمة الدخل" rows={statementData.incomeStatement.rows} />
          <ReportCard title="المركز المالي" rows={statementData.balanceSheet.rows} />
        </div>
      ) : null}
      {view === 'AR_AGING' ? (
        <AgingTable title="أعمار ديون العملاء" rows={aging?.side === 'CUSTOMER' ? aging.positions : []} />
      ) : null}
      {view === 'AP_AGING' ? (
        <AgingTable title="أعمار ديون الموردين" rows={aging?.side === 'SUPPLIER' ? aging.positions : []} />
      ) : null}
      {view === 'TREASURY' ? <CurrencyTable title="الخزائن والسيولة" rows={currencyTotals} /> : null}
      {view === 'TAX' ? <CurrencyTable title="الضرائب" rows={currencyTotals} /> : null}
      {view === 'PROGRAM_PROFITABILITY' ? (
        <ProgramProfitability
          program={programs.find((row) => row.id === programId)}
          report={programReport}
        />
      ) : null}
    </section>
  );
}

function PartyStatements({
  data,
  kind,
  onKind,
  partyId,
  onParty,
  options,
  scope,
  appliedScope,
  onScope,
  onApply,
  reportLoading,
  aging,
}: {
  data: ReportingCenterData;
  kind: PartyKind;
  onKind: (value: PartyKind) => void;
  partyId: string;
  onParty: (value: string) => void;
  options: readonly string[];
  scope: { from: string; to: string; asOf: string };
  appliedScope: ReportScopeFilters;
  onScope: (value: { from: string; to: string; asOf: string }) => void;
  onApply: () => void;
  reportLoading: boolean;
  aging: AgingReport | null;
}) {
  const movements = partyMovements(data, kind, partyId, appliedScope);
  const positions =
    aging?.side === kind ? aging.positions.filter((row) => row.partyId === partyId) : [];
  return (
    <section className="ui-grid-md">
      <Card title={kind === 'CUSTOMER' ? 'كشف حساب عميل' : 'كشف حساب مورد'}>
        <div className="ui-filter-grid">
          <FormField label="نوع الطرف">
            <Select value={kind} onChange={(e) => onKind(e.target.value as PartyKind)}>
              <option value="CUSTOMER">عميل</option>
              <option value="SUPPLIER">مورد</option>
            </Select>
          </FormField>
          <FormField label={kind === 'CUSTOMER' ? 'العميل' : 'المورد'}>
            <Select value={partyId} onChange={(e) => onParty(e.target.value)}>
              <option value="">اختر</option>
              {options.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="من تاريخ">
            <Input
              type="date"
              value={scope.from}
              onChange={(e) => onScope({ ...scope, from: e.target.value })}
            />
          </FormField>
          <FormField label="إلى تاريخ">
            <Input
              type="date"
              value={scope.to}
              onChange={(e) => onScope({ ...scope, to: e.target.value })}
            />
          </FormField>
          <FormField label="كما في">
            <Input
              type="date"
              value={scope.asOf}
              onChange={(e) => onScope({ ...scope, asOf: e.target.value })}
            />
          </FormField>
        </div>
        <ActionBar>
          <Button type="button" onClick={onApply} disabled={reportLoading}>
            تطبيق النطاق
          </Button>
        </ActionBar>
      </Card>
      {reportLoading ? <LoadingState /> : null}
      {!partyId ? (
        <EmptyState title={kind === 'CUSTOMER' ? 'اختر عميلًا لعرض كشف الحساب' : 'اختر موردًا لعرض كشف الحساب'} />
      ) : (
        <>
          <Card title="الأرصدة والمراكز المفتوحة الحالية">
            {!positions.length ? (
              <EmptyState title="لا توجد أرصدة مفتوحة لهذا الطرف في النطاق الحالي" />
            ) : (
              <DataGrid columns={['النوع', 'تاريخ الاستحقاق', 'العملة', 'الرصيد المفتوح', 'المصدر']}>
                {positions.map((row) => (
                  <tr key={row.evidenceId}>
                    <td>
                      {row.positionKind === 'CUSTOMER_ADVANCE'
                        ? 'دفعة مقدمة عميل'
                        : row.positionKind === 'SUPPLIER_ADVANCE'
                          ? 'دفعة مقدمة مورد'
                          : row.positionKind === 'RECEIVABLE'
                            ? 'ذمة مدينة'
                            : row.positionKind === 'PAYABLE'
                              ? 'ذمة دائنة'
                              : (row.positionKind ?? '—')}
                    </td>
                    <td>{row.dueDate ?? '—'}</td>
                    <td>{row.currency}</td>
                    <td>{row.openAmount}</td>
                    <td>
                      {row.authoritativeReference
                        ? row.authoritativeReference.sourceType +
                          ':' +
                          row.authoritativeReference.sourceId
                        : '—'}
                    </td>
                  </tr>
                ))}
              </DataGrid>
            )}
          </Card>
          <Card title="الحركة التفصيلية">
            {!movements.length ? (
              <EmptyState title="لا توجد حركات لهذا الطرف في النطاق الحالي" />
            ) : (
              <DataGrid
                columns={[
                  'التاريخ',
                  'الحركة',
                  'المستند',
                  'العملة',
                  'مدين',
                  'دائن',
                  'المتبقي',
                  'الحالة',
                  'المصدر',
                  'التسويات',
                  'دفعة مقدمة',
                ]}
              >
                {movements.map((row) => (
                  <tr key={row.key}>
                    <td>{row.date}</td>
                    <td>{row.type}</td>
                    <td>{row.document}</td>
                    <td>{row.currency}</td>
                    <td>{row.debit}</td>
                    <td>{row.credit}</td>
                    <td>{row.outstanding}</td>
                    <td>
                      <Badge tone={row.status === 'POSTED' ? 'success' : 'warning'}>
                        {row.status}
                      </Badge>
                    </td>
                    <td>{row.source}</td>
                    <td>{row.allocations}</td>
                    <td>{row.advance}</td>
                  </tr>
                ))}
              </DataGrid>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

function ReportCard({ title, rows }: { title: string; rows: readonly ReportRow[] }) {
  return (
    <Card title={title}>
      {!rows.length ? (
        <EmptyState title="لا توجد بيانات في النطاق الحالي" />
      ) : (
        <DataGrid columns={['البند', 'العملة', 'القيمة']}>
          {rows.map((row, index) => (
            <tr key={(row.accountId ?? row.accountClass ?? 'row') + String(index)}>
              <td>{row.accountId ?? row.accountClass ?? '—'}</td>
              <td>{row.currency}</td>
              <td>{row.amount}</td>
            </tr>
          ))}
        </DataGrid>
      )}
    </Card>
  );
}
function AgingTable({ title, rows }: { title: string; rows: AgingReport['positions'] }) {
  return (
    <Card title={title}>
      {!rows.length ? (
        <EmptyState title="لا توجد أرصدة مفتوحة في النطاق الحالي" />
      ) : (
        <DataGrid
          columns={[
            'الطرف',
            'نوع المركز',
            'تاريخ الاستحقاق',
            'أيام التأخير',
            'الشريحة',
            'العملة',
            'الرصيد',
          ]}
        >
          {rows.map((row) => (
            <tr key={row.evidenceId}>
              <td>{row.partyId ?? '—'}</td>
              <td>{row.positionKind ?? '—'}</td>
              <td>{row.dueDate ?? '—'}</td>
              <td>{row.dueDate ? Math.max(0, daysPastDue(row.dueDate) ?? 0) : '—'}</td>
              <td>{agingBucket(row.dueDate)}</td>
              <td>{row.currency}</td>
              <td>{row.openAmount}</td>
            </tr>
          ))}
        </DataGrid>
      )}
    </Card>
  );
}
function CurrencyTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly { currency: string; amount: string }[];
}) {
  return (
    <Card title={title}>
      {!rows.length ? (
        <EmptyState title="لا توجد بيانات في النطاق الحالي" />
      ) : (
        <DataGrid columns={['العملة', 'الإجمالي']}>
          {rows.map((row) => (
            <tr key={row.currency}>
              <td>{row.currency}</td>
              <td>{row.amount}</td>
            </tr>
          ))}
        </DataGrid>
      )}
    </Card>
  );
}
function ProgramProfitability({
  program,
  report,
}: {
  program: ProgramOption | undefined;
  report: ProgramAccountingReport | null;
}) {
  return (
    <Card title="ربحية البرنامج">
      {!program ? (
        <EmptyState title="اختر برنامجًا حقيقيًا من القائمة" />
      ) : !report?.byCurrency.length ? (
        <EmptyState title="لا توجد حركة مالية معتمدة للبرنامج في النطاق الحالي">
          {program.code} — {program.name}
        </EmptyState>
      ) : (
        <>
          <p>
            <strong>
              {program.code} — {program.name}
            </strong>{' '}
            <Badge tone="info">{program.source === 'TOURISM' ? 'سياحة' : 'حج/عمرة'}</Badge>
          </p>
          <DataGrid columns={['العملة', 'الإيراد', 'التكلفة', 'الربح', 'مراكز التكلفة']}>
            {report.byCurrency.map((row) => (
              <tr key={row.currency}>
                <td>{row.currency}</td>
                <td>{row.revenue}</td>
                <td>{row.cost}</td>
                <td>{row.profit}</td>
                <td>{row.costCenterIds?.join('، ') || '—'}</td>
              </tr>
            ))}
          </DataGrid>
        </>
      )}
    </Card>
  );
}
function Operations({ data }: { data: ReportingCenterData }) {
  const summary = data.management.summary;
  const history = data.financialHistory;
  return (
    <>
      <div className="ui-metric-grid">
        <MetricCard label="العملاء" value={summary.crmSales.customers} />
        <MetricCard label="الموردون" value={summary.suppliers.total} />
        <MetricCard label="الموردون الموقوفون" value={summary.suppliers.activeHolds} />
        <MetricCard label="برامج حج وعمرة نشطة" value={summary.hajjUmrah.activePrograms} />
        <MetricCard
          label="جاهزية حرجة"
          value={summary.hajjUmrah.criticalReadinessItems}
          tone={summary.hajjUmrah.criticalReadinessItems ? 'warning' : 'success'}
        />
        <MetricCard
          label="مشكلات رقابية مفتوحة"
          value={data.accounting.controlIssues.filter((row) => !row.resolvedAt).length}
          tone={data.accounting.controlIssues.some((row) => !row.resolvedAt) ? 'warning' : 'success'}
        />
        <MetricCard label="تسويات رقابية" value={history.reconciliationRuns.length} />
        <MetricCard label="فحوص جاهزية الإقفال" value={history.closeReadinessRuns.length} />
      </div>
      <ActionBar>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            window.location.href = '/management/approvals';
          }}
        >
          مركز الموافقات
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            window.location.href = '/management/exceptions';
          }}
        >
          مركز العمل والاستثناءات
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            window.location.href = '/hajj-umrah/readiness';
          }}
        >
          تقارير وجاهزية الحج والعمرة
        </Button>
      </ActionBar>
      <Card title="مشكلات الرقابة المالية">
        {!data.accounting.controlIssues.length ? (
          <EmptyState title="لا توجد مشكلات رقابية" />
        ) : (
          <DataGrid columns={['الدليل', 'المصدر', 'الدفتر', 'الفرق', 'الحالة']}>
            {data.accounting.controlIssues.map((row) => (
              <tr key={row.id}>
                <td>{row.evidenceKey}</td>
                <td>{row.sourceAmount}</td>
                <td>{row.ledgerAmount}</td>
                <td>{row.difference}</td>
                <td>
                  <Badge tone={row.resolvedAt ? 'success' : 'warning'}>
                    {row.resolvedAt ? 'تم الحل' : 'مفتوح'}
                  </Badge>
                </td>
              </tr>
            ))}
          </DataGrid>
        )}
      </Card>
      <Card title="سجل التسويات الرقابية">
        {!history.reconciliationRuns.length ? (
          <EmptyState title="لا توجد تسويات مسجلة لهذا الفرع" />
        ) : (
          <DataGrid columns={['النوع', 'Correlation', 'الحالة', 'وقت التشغيل']}>
            {history.reconciliationRuns.map((row) => (
              <tr key={row.id}>
                <td>{row.type}</td>
                <td>{row.correlationId}</td>
                <td>
                  <Badge tone={row.clean ? 'success' : 'warning'}>
                    {row.clean ? 'سليم' : 'به فروق'}
                  </Badge>
                </td>
                <td>{new Date(row.runAt).toLocaleString('ar-EG')}</td>
              </tr>
            ))}
          </DataGrid>
        )}
      </Card>
      <Card title="جاهزية الإقفال">
        {!history.closeReadinessRuns.length ? (
          <EmptyState title="لا توجد فحوص جاهزية مسجلة لهذا الفرع" />
        ) : (
          <DataGrid columns={['Correlation', 'النتيجة', 'العوائق', 'التحذيرات', 'وقت الفحص']}>
            {history.closeReadinessRuns.map((row) => (
              <tr key={row.id}>
                <td>{row.correlationId}</td>
                <td>
                  <Badge tone={row.ready ? 'success' : 'warning'}>
                    {row.ready ? 'جاهز' : 'غير جاهز'}
                  </Badge>
                </td>
                <td>{row.blockers.join(' | ') || '—'}</td>
                <td>{row.warnings.join(' | ') || '—'}</td>
                <td>{new Date(row.evaluatedAt).toLocaleString('ar-EG')}</td>
              </tr>
            ))}
          </DataGrid>
        )}
      </Card>
      <Card title="سجل التدقيق للفرع">
        {!history.auditEntries.length ? (
          <EmptyState title="لا توجد أحداث تدقيق مسجلة لهذا الفرع" />
        ) : (
          <DataGrid columns={['الوقت', 'الإجراء', 'المورد', 'السجل', 'المستخدم']}>
            {history.auditEntries.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.occurredAt).toLocaleString('ar-EG')}</td>
                <td>{row.action}</td>
                <td>{row.resource}</td>
                <td>{row.entityId ?? '—'}</td>
                <td>{row.actorId ?? 'SYSTEM'}</td>
              </tr>
            ))}
          </DataGrid>
        )}
      </Card>
      <Card title="الاستثناءات التشغيلية">
        {!data.management.items.length ? (
          <EmptyState title="لا توجد استثناءات تشغيلية" />
        ) : (
          <DataGrid columns={['المجال', 'العنوان', 'التفاصيل', 'الأولوية', 'الحالة', 'فتح']}>
            {data.management.items.map((row) => (
              <tr key={row.sourceKey}>
                <td>{row.sourceDomain}</td>
                <td>{row.title}</td>
                <td>{row.summary}</td>
                <td>
                  <Badge
                    tone={
                      row.severity === 'CRITICAL' || row.severity === 'HIGH' ? 'warning' : 'info'
                    }
                  >
                    {row.severity}
                  </Badge>
                </td>
                <td>{row.status}</td>
                <td>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      window.location.href = row.drillDownPath;
                    }}
                  >
                    فتح
                  </Button>
                </td>
              </tr>
            ))}
          </DataGrid>
        )}
      </Card>
    </>
  );
}
