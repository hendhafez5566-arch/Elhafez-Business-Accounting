import { useEffect, useMemo, useState } from 'react';
import {
  ActionBar,
  Badge,
  Button,
  DataGrid,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  SettingsWorkspace,
  WorkspaceNavigation,
} from './ui.js';
import { HttpAdministrationClient, type AdministrationClient, type AdministrationContext } from './system-administration-client.js';
import { tenantApiContext } from './tenant-session.js';

type AdminArea = 'identity' | 'access' | 'security' | 'data' | 'configuration' | 'operations';

type Snapshot = {
  readonly users: readonly unknown[];
  readonly roles: readonly unknown[];
  readonly branches: readonly unknown[];
  readonly sessions: readonly unknown[];
  readonly audit: readonly unknown[];
  readonly files: readonly unknown[];
  readonly notifications: readonly unknown[];
};

const emptySnapshot: Snapshot = { users: [], roles: [], branches: [], sessions: [], audit: [], files: [], notifications: [] };
const navigation = [
  { id: 'identity', label: 'الهوية والمستخدمون', description: 'المستخدمون والأدوار والصلاحيات' },
  { id: 'access', label: 'الفروع والوصول', description: 'نطاقات الوصول وربط المستخدمين بالفروع' },
  { id: 'security', label: 'الأمان والجلسات', description: 'الجلسات والأجهزة وسجل النشاط' },
  { id: 'data', label: 'البيانات والمستندات', description: 'الملفات والاستيراد والتصدير' },
  { id: 'configuration', label: 'إعدادات الشركة', description: 'ملف الشركة والترقيم والحقول والأتمتة' },
  { id: 'operations', label: 'تشغيل المنصة', description: 'الإشعارات وصحة النظام والتشخيص' },
] as const;

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'تعذر تحميل مركز إدارة النظام.';

function ManageLink({ children = 'فتح أدوات الإدارة' }: { readonly children?: string }) {
  return <a className="ui-button ui-button--primary" href="/system-administration/manage">{children}</a>;
}

function SummaryTable({ title, rows }: { readonly title: string; readonly rows: readonly unknown[] }) {
  const records = rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row));
  return <section className="ui-flow">
    <div className="ui-inline"><h2>{title}</h2><Badge>{records.length}</Badge></div>
    {!records.length ? <EmptyState title={`لا توجد بيانات — ${title}`} /> : <DataGrid columns={['الاسم / المعرّف', 'الحالة', 'النوع']}>
      {records.slice(0, 8).map((row, index) => <tr key={String(row.id ?? index)}>
        <td><strong>{String(row.displayName ?? row.name ?? row.username ?? row.id ?? '—')}</strong></td>
        <td>{String(row.status ?? (row.active === false ? 'غير نشط' : row.active === true ? 'نشط' : '—'))}</td>
        <td>{String(row.type ?? '—')}</td>
      </tr>)}
    </DataGrid>}
  </section>;
}

export function SystemAdministrationWorkspacePage({
  client = new HttpAdministrationClient(),
  context,
}: {
  readonly client?: AdministrationClient;
  readonly context?: AdministrationContext;
} = {}) {
  const ctx = context ?? tenantApiContext();
  const [active, setActive] = useState<AdminArea>('identity');
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    if (!ctx.token) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const keys = ['users', 'roles', 'branches', 'sessions', 'audit', 'files', 'notifications'] as const;
      const results = await Promise.allSettled(keys.map(key => client.list(key, ctx)));
      const next = { ...emptySnapshot } as Record<keyof Snapshot, readonly unknown[]>;
      keys.forEach((key, index) => { const result = results[index]; next[key] = result?.status === 'fulfilled' ? result.value : []; });
      setSnapshot(next as Snapshot);
    } catch (value) { setError(errorMessage(value)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, [ctx.token, ctx.companyId, ctx.branchId]);

  const metrics = useMemo(() => ({
    users: snapshot.users.length,
    roles: snapshot.roles.length,
    branches: snapshot.branches.length,
    sessions: snapshot.sessions.length,
    notifications: snapshot.notifications.length,
    audit: snapshot.audit.length,
  }), [snapshot]);

  if (!ctx.token) return <EmptyState title="يلزم تسجيل الدخول">سجّل الدخول إلى الشركة والفرع لعرض مركز إدارة النظام.</EmptyState>;
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const content = active === 'identity' ? <section className="ui-flow">
    <h2>الهوية والمستخدمون</h2>
    <p className="ui-page-intro">إدارة المستخدمين والأدوار والصلاحيات من Platform Core بدون خريطة صلاحيات موازية داخل الواجهة.</p>
    <div className="ui-metric-grid"><MetricCard label="المستخدمون" value={metrics.users}/><MetricCard label="الأدوار" value={metrics.roles}/></div>
    <SummaryTable title="المستخدمون" rows={snapshot.users}/>
    <ActionBar><ManageLink>إدارة المستخدمين والأدوار</ManageLink></ActionBar>
  </section> : active === 'access' ? <section className="ui-flow">
    <h2>الفروع والوصول</h2>
    <p className="ui-page-intro">الفروع ونطاقات الوصول تظل مملوكة لنفس خدمات إدارة المنصة الحالية.</p>
    <div className="ui-metric-grid"><MetricCard label="الفروع" value={metrics.branches}/><MetricCard label="المستخدمون" value={metrics.users}/></div>
    <SummaryTable title="الفروع" rows={snapshot.branches}/>
    <ActionBar><ManageLink>إدارة الفروع والوصول</ManageLink></ActionBar>
  </section> : active === 'security' ? <section className="ui-flow">
    <h2>الأمان والجلسات</h2>
    <p className="ui-page-intro">متابعة الجلسات وسجل النشاط وإنهاء الجلسات يتم من مالك الإدارة الحالي.</p>
    <div className="ui-metric-grid"><MetricCard label="الجلسات" value={metrics.sessions}/><MetricCard label="أحداث السجل" value={metrics.audit}/></div>
    <SummaryTable title="الجلسات" rows={snapshot.sessions}/>
    <ActionBar><ManageLink>إدارة الجلسات وسجل النشاط</ManageLink></ActionBar>
  </section> : active === 'data' ? <section className="ui-flow">
    <h2>البيانات والمستندات</h2>
    <p className="ui-page-intro">الملفات والاستيراد والتصدير تستخدم نفس Data Exchange وFile owners بدون نسخ مسار ثانٍ.</p>
    <div className="ui-metric-grid"><MetricCard label="الملفات" value={snapshot.files.length}/><MetricCard label="سجل النشاط" value={metrics.audit}/></div>
    <SummaryTable title="الملفات" rows={snapshot.files}/>
    <ActionBar><ManageLink>فتح الاستيراد والتصدير والملفات</ManageLink></ActionBar>
  </section> : active === 'configuration' ? <section className="ui-flow">
    <h2>إعدادات الشركة والنظام</h2>
    <p className="ui-page-intro">الإعدادات موزعة على مساحات Canonical مستقلة بدل تكديسها داخل Tab shell واحد.</p>
    <div className="ui-dashboard-grid">
      <section className="ui-record-card ui-flow"><strong>ملف الشركة</strong><span>الهوية، اللغة، العملة والإعدادات الأساسية.</span><a href="/system-administration/manage">فتح إعدادات الشركة</a></section>
      <section className="ui-record-card ui-flow"><strong>الحقول المخصصة</strong><span>تعريف حقول إضافية من المصدر المعتمد.</span><a href="/system-administration/custom-fields">فتح الحقول المخصصة</a></section>
      <section className="ui-record-card ui-flow"><strong>ترقيم المستندات</strong><span>سياسات الترقيم المركزية.</span><a href="/system-administration/document-numbering">فتح الترقيم</a></section>
      <section className="ui-record-card ui-flow"><strong>الأتمتة وسير العمل</strong><span>القواعد والتشغيل والمتابعة.</span><a href="/system-administration/automation">فتح الأتمتة</a></section>
    </div>
  </section> : <section className="ui-flow">
    <h2>تشغيل المنصة والتشخيص</h2>
    <p className="ui-page-intro">الإشعارات وصحة النظام وأدوات التشخيص في مساحة تشغيلية منفصلة وواضحة.</p>
    <div className="ui-metric-grid"><MetricCard label="الإشعارات" value={metrics.notifications}/><MetricCard label="أحداث السجل" value={metrics.audit}/></div>
    <SummaryTable title="الإشعارات" rows={snapshot.notifications}/>
    <ActionBar><Button type="button" variant="secondary" onClick={() => void reload()}>تحديث الحالة</Button><ManageLink>فتح أدوات التشخيص</ManageLink></ActionBar>
  </section>;

  return <section className="ui-admin-page" dir="rtl" aria-label="مركز إدارة النظام">
    <div className="ui-metric-grid">
      <MetricCard label="المستخدمون" value={metrics.users}/>
      <MetricCard label="الأدوار" value={metrics.roles}/>
      <MetricCard label="الفروع" value={metrics.branches}/>
      <MetricCard label="الجلسات" value={metrics.sessions}/>
    </div>
    <SettingsWorkspace
      navigation={<WorkspaceNavigation items={navigation} active={active} onChange={id => setActive(id as AdminArea)} ariaLabel="أقسام إدارة النظام"/>}
      content={content}
    />
  </section>;
}
