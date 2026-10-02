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

const reportGroups = [
  {
    title: 'القوائم المالية',
    reports: ['قائمة الدخل', 'الميزانية', 'التدفقات النقدية', 'الأستاذ العام', 'القيود'],
  },
  {
    title: 'العملاء والموردون',
    reports: [
      'تفاصيل التعاملات',
      'أعمار العملاء',
      'أعمار الموردين',
      'المبيعات حسب العميل',
      'المبيعات حسب المندوب',
      'تكاليف الموردين',
    ],
  },
  {
    title: 'الخزينة والضرائب',
    reports: ['التحصيلات', 'المدفوعات', 'الحركة اليومية للخزن', 'ملخص الضرائب', 'تفاصيل الضرائب'],
  },
  {
    title: 'الحج والعمرة',
    reports: ['المسافرون', 'الحجوزات', 'إشغال البرامج', 'ربحية البرامج', 'انتهاء الجوازات', 'حالات التأشيرات'],
  },
  {
    title: 'الإدارة والتحليل',
    reports: ['ربحية الخدمات', 'العمولات', 'المصروفات', 'فروق العملة', 'التعرض للعملات'],
  },
] as const;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'تعذر تحميل البيانات.';
}

export function ReportsCatalogPage() {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('ar');
  return (
    <section className="ui-page-stack" dir="rtl" aria-label="التقارير">
      <Card title="التقارير">
        <p className="ui-page-intro">اختر التقرير المطلوب. الحسابات والأرصدة والنتائج تُقرأ دائمًا من مركز التقارير والمالكين المعتمدين في النظام.</p>
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
          const visible = group.reports.filter((name) => !normalized || name.toLocaleLowerCase('ar').includes(normalized));
          if (!visible.length) return null;
          return (
            <Card key={group.title} title={group.title}>
              <div className="ui-admin-workflows">
                {visible.map((name) => (
                  <section className="ui-disclosure-card" key={name}>
                    <div className="ui-disclosure-card__body ui-inline">
                      <strong>{name}</strong>
                      <a href="/management/reports">فتح التقرير</a>
                    </div>
                  </section>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      {normalized && !reportGroups.some((group) => group.reports.some((name) => name.toLocaleLowerCase('ar').includes(normalized))) ? (
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
