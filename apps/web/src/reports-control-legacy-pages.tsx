import { useEffect, useMemo, useState } from 'react';
import {
  ActionBar,
  Badge,
  Button,
  Card,
  DataGrid,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  MetricCard,
  Select,
} from './ui.js';
import {
  HttpReportingCenterClient,
  type ReportingCenterClient,
  type ReportingCenterData,
} from './reporting-center-client.js';
import {
  HttpAdministrationClient,
  type AdministrationClient,
  type AdministrationContext,
} from './system-administration-client.js';
import { tenantApiContext } from './tenant-session.js';

type LegacyReportEntry = {
  readonly name: string;
  readonly target?: string;
  readonly targetKind: 'REPORT' | 'SOURCE' | 'BLOCKED';
};

const reportGroups: readonly { readonly title: string; readonly reports: readonly LegacyReportEntry[] }[] = [
  {
    title: 'القوائم المالية',
    reports: [
      { name: 'قائمة الدخل', target: '/management/reports', targetKind: 'REPORT' },
      { name: 'الميزانية', target: '/management/reports', targetKind: 'REPORT' },
      { name: 'التدفقات النقدية', targetKind: 'BLOCKED' },
      { name: 'الأستاذ العام', target: '/accounting/accounts', targetKind: 'SOURCE' },
      { name: 'القيود', target: '/accounting/journal', targetKind: 'SOURCE' },
    ],
  },
  {
    title: 'العملاء والموردون',
    reports: [
      { name: 'تفاصيل التعاملات', target: '/management/reports', targetKind: 'REPORT' },
      { name: 'أعمار العملاء', target: '/management/reports', targetKind: 'REPORT' },
      { name: 'أعمار الموردين', target: '/management/reports', targetKind: 'REPORT' },
      { name: 'المبيعات حسب العميل', targetKind: 'BLOCKED' },
      { name: 'المبيعات حسب المندوب', targetKind: 'BLOCKED' },
      { name: 'تكاليف الموردين', target: '/management/reports', targetKind: 'REPORT' },
    ],
  },
  {
    title: 'الخزينة والضرائب',
    reports: [
      { name: 'التحصيلات', target: '/accounting/receipts', targetKind: 'SOURCE' },
      { name: 'المدفوعات', target: '/accounting/payments', targetKind: 'SOURCE' },
      { name: 'الحركة اليومية للخزن', target: '/accounting/treasury', targetKind: 'SOURCE' },
      { name: 'ملخص الضرائب', target: '/management/reports', targetKind: 'REPORT' },
      { name: 'تفاصيل الضرائب', target: '/accounting/taxes', targetKind: 'SOURCE' },
    ],
  },
  {
    title: 'الحج والعمرة',
    reports: [
      { name: 'المسافرون', target: '/hajj-umrah/travelers', targetKind: 'SOURCE' },
      { name: 'الحجوزات', target: '/hajj-umrah/bookings', targetKind: 'SOURCE' },
      { name: 'إشغال البرامج', target: '/hajj-umrah/programs', targetKind: 'SOURCE' },
      { name: 'ربحية البرامج', target: '/management/reports', targetKind: 'REPORT' },
      { name: 'انتهاء الجوازات', targetKind: 'BLOCKED' },
      { name: 'حالات التأشيرات', target: '/hajj-umrah/visas', targetKind: 'SOURCE' },
    ],
  },
  {
    title: 'الإدارة والتحليل',
    reports: [
      { name: 'ربحية الخدمات', targetKind: 'BLOCKED' },
      { name: 'العمولات', target: '/accounting/expenses', targetKind: 'SOURCE' },
      { name: 'المصروفات', target: '/accounting/expenses', targetKind: 'SOURCE' },
      { name: 'فروق العملة', target: '/accounting/currencies', targetKind: 'SOURCE' },
      { name: 'التعرض للعملات', targetKind: 'BLOCKED' },
    ],
  },
];

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'تعذر تحميل البيانات.';
}

function reportStatus(entry: LegacyReportEntry) {
  if (entry.targetKind === 'REPORT') return <Badge tone="success">Target report</Badge>;
  if (entry.targetKind === 'SOURCE') return <Badge tone="info">المصدر التشغيلي</Badge>;
  return <Badge tone="warning">BLOCKED-BY-BACKEND</Badge>;
}

export function ReportsCatalogPage() {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('ar');
  return (
    <section className="ui-page-stack" dir="rtl" aria-label="التقارير">
      <Card title="التقارير">
        <p className="ui-page-intro">اختر التقرير المطلوب. الحسابات والأرصدة والنتائج تُقرأ دائمًا من مركز التقارير والمالكين المعتمدين في النظام. أي تعريف Legacy بلا Target Contract يظل ظاهرًا وموسومًا بوضوح بدل إنشاء نتيجة وهمية.</p>
        <div className="ui-filter-grid">
          <FormField label="بحث في التقارير">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اسم التقرير" />
          </FormField>
        </div>
        <ActionBar>
          <a href="/management/reports">فتح مركز التقارير والفلاتر</a>
          <a href="/management/outputs">المخرجات والطباعة والاستحقاقات</a>
        </ActionBar>
      </Card>
      <div className="ui-grid-md" aria-label="مجموعات التقارير">
        {reportGroups.map((group) => {
          const visible = group.reports.filter((entry) => !normalized || entry.name.toLocaleLowerCase('ar').includes(normalized));
          if (!visible.length) return null;
          return (
            <Card key={group.title} title={group.title}>
              <div className="ui-admin-workflows">
                {visible.map((entry) => (
                  <section className="ui-disclosure-card" key={entry.name}>
                    <div className="ui-disclosure-card__body ui-inline">
                      <strong>{entry.name}</strong>
                      {reportStatus(entry)}
                      {entry.target ? <a href={entry.target}>{entry.targetKind === 'REPORT' ? 'فتح التقرير' : 'فتح المصدر'}</a> : <span>لا يوجد عقد تنفيذ صالح حاليًا</span>}
                    </div>
                  </section>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      {normalized && !reportGroups.some((group) => group.reports.some((entry) => entry.name.toLocaleLowerCase('ar').includes(normalized))) ? (
        <EmptyState title="لا توجد تقارير مطابقة للبحث" />
      ) : null}
    </section>
  );
}

export function FinancialControlAuditPage({ client }: { readonly client?: ReportingCenterClient } = {}) {
  const api = useMemo(() => client ?? new HttpReportingCenterClient(), [client]);
  const [data, setData] = useState<ReportingCenterData>();
  const [state, setState] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await api.load());
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [api]);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return <EmptyState title="لا توجد بيانات رقابية" />;

  const issues = data.accounting.controlIssues.filter((issue) =>
    state === 'ALL' ? true : state === 'OPEN' ? !issue.resolvedAt : Boolean(issue.resolvedAt),
  );
  const financeAttention = data.management.items.filter((item) => item.sourceDomain === 'FINANCE');
  const openIssues = data.accounting.controlIssues.filter((issue) => !issue.resolvedAt).length;
  const latestReadiness = data.financialHistory.closeReadinessRuns[0];

  return (
    <section className="ui-page-stack" dir="rtl" aria-label="الرقابة المالية">
      <Card title="مركز الرقابة المالية">
        <p className="ui-page-intro">عرض رقابي موحد من Financial Controls وManagement Control دون إعادة حساب الأرصدة داخل الواجهة.</p>
        <ActionBar>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>تحديث</Button>
          <a href="/management/reports">التقارير الرقابية والتاريخ</a>
          <a href="/accounting">فتح المحاسبة</a>
        </ActionBar>
      </Card>
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : null}
      <div className="ui-metric-grid">
        <MetricCard label="مشكلات رقابية مفتوحة" value={openIssues} tone={openIssues ? 'warning' : 'success'} />
        <MetricCard label="تنبيهات مالية" value={financeAttention.length} tone={financeAttention.length ? 'warning' : 'success'} />
        <MetricCard label="تشغيلات تسوية" value={data.financialHistory.reconciliationRuns.length} />
        <MetricCard label="جاهزية الإقفال" value={latestReadiness ? (latestReadiness.ready ? 'جاهز' : 'غير جاهز') : '—'} tone={latestReadiness?.ready ? 'success' : 'neutral'} />
      </div>
      <Card title="مشكلات وتحذيرات الرقابة">
        <div className="ui-inline">
          <FormField label="الحالة">
            <Select value={state} onChange={(event) => setState(event.target.value as typeof state)}>
              <option value="ALL">الكل</option>
              <option value="OPEN">مفتوحة</option>
              <option value="RESOLVED">تم حلها</option>
            </Select>
          </FormField>
        </div>
        {!issues.length ? (
          <EmptyState title="لا توجد مشكلات رقابية مطابقة" />
        ) : (
          <DataGrid columns={['الدليل', 'المصدر', 'الدفتر', 'الفرق', 'التفاصيل', 'الحالة', 'الإجراء']}>
            {issues.map((issue) => (
              <tr key={issue.id}>
                <td>{issue.evidenceKey}</td>
                <td>{issue.sourceAmount}</td>
                <td>{issue.ledgerAmount}</td>
                <td>{issue.difference}</td>
                <td>{issue.detail}</td>
                <td><Badge tone={issue.resolvedAt ? 'success' : 'warning'}>{issue.resolvedAt ? 'تم الحل' : 'مفتوحة'}</Badge></td>
                <td><a href="/accounting">فتح المالك المالي</a></td>
              </tr>
            ))}
          </DataGrid>
        )}
      </Card>
      <Card title="التنبيهات المالية ذات الأولوية">
        {!financeAttention.length ? (
          <EmptyState title="لا توجد تنبيهات مالية حالية" />
        ) : (
          <DataGrid columns={['الأولوية', 'العنوان', 'التفاصيل', 'الحالة', 'فتح']}>
            {financeAttention.map((item) => (
              <tr key={item.sourceKey}>
                <td><Badge tone={item.severity === 'CRITICAL' ? 'error' : item.severity === 'HIGH' ? 'warning' : 'info'}>{item.severity}</Badge></td>
                <td>{item.title}</td>
                <td>{item.summary}</td>
                <td>{item.status}</td>
                <td><a href={item.drillDownPath}>فتح المصدر</a></td>
              </tr>
            ))}
          </DataGrid>
        )}
      </Card>
    </section>
  );
}

type AuditRecord = Readonly<Record<string, unknown>>;
function isRecord(value: unknown): value is AuditRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function field(record: AuditRecord, key: string) {
  const value = record[key];
  return value === null || value === undefined ? '' : String(value);
}

export function ActivityLogPage({
  client = new HttpAdministrationClient(),
  context,
}: {
  readonly client?: AdministrationClient;
  readonly context?: AdministrationContext;
} = {}) {
  const ctx = context ?? tenantApiContext();
  const [rows, setRows] = useState<readonly AuditRecord[]>([]);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!ctx.token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setRows((await client.list('audit', ctx)).filter(isRecord));
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [ctx.token, ctx.companyId, ctx.branchId]);

  const filtered = rows.filter((row) => {
    const haystack = [field(row, 'actorId'), field(row, 'action'), field(row, 'resource'), field(row, 'entityId')].join(' ').toLocaleLowerCase('ar');
    const occurredAt = field(row, 'occurredAt') || field(row, 'createdAt');
    if (query.trim() && !haystack.includes(query.trim().toLocaleLowerCase('ar'))) return false;
    if (from && occurredAt && occurredAt.slice(0, 10) < from) return false;
    if (to && occurredAt && occurredAt.slice(0, 10) > to) return false;
    return true;
  });

  return (
    <section className="ui-page-stack" dir="rtl" aria-label="سجل النشاط">
      <Card title="سجل النشاط">
        <div className="ui-filter-grid">
          <FormField label="بحث"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="المستخدم أو الإجراء أو السجل" /></FormField>
          <FormField label="من تاريخ"><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></FormField>
          <FormField label="إلى تاريخ"><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></FormField>
        </div>
        <ActionBar><Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>تحديث</Button></ActionBar>
      </Card>
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : !ctx.token ? <EmptyState title="يلزم تسجيل الدخول" /> : !filtered.length ? <EmptyState title="لا توجد حركات في النطاق الحالي" /> : (
        <Card title={`الحركات — ${filtered.length}`}>
          <DataGrid columns={['المستخدم', 'الإجراء', 'السجل / المورد', 'المعرّف', 'الوقت', 'التفاصيل']}>
            {filtered.map((row, index) => {
              const id = field(row, 'id') || String(index);
              const occurredAt = field(row, 'occurredAt') || field(row, 'createdAt');
              return (
                <tr key={id}>
                  <td>{field(row, 'actorId') || 'SYSTEM'}</td>
                  <td>{field(row, 'action') || '—'}</td>
                  <td>{field(row, 'resource') || '—'}</td>
                  <td>{field(row, 'entityId') || '—'}</td>
                  <td>{occurredAt ? new Date(occurredAt).toLocaleString('ar-EG') : '—'}</td>
                  <td>{field(row, 'detail') || field(row, 'metadata') || '—'}</td>
                </tr>
              );
            })}
          </DataGrid>
        </Card>
      )}
    </section>
  );
}
