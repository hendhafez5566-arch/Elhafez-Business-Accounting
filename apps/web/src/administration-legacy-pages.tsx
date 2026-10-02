import { useEffect, useMemo, useState } from 'react';
import {
  ActionBar,
  Badge,
  Button,
  Card,
  DataGrid,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
} from './ui.js';
import {
  HttpAdministrationClient,
  type AdministrationClient,
  type AdministrationContext,
} from './system-administration-client.js';
import { CompanyProfilePanel } from './company-profile-panel.js';
import { tenantApiContext } from './tenant-session.js';

type RecordValue = Readonly<Record<string, unknown>>;
function record(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'تعذر تحميل بيانات الإدارة.';
}

const adminLinks = [
  { label: 'المستخدمون والصلاحيات', path: '/users', detail: 'المستخدمون، الأدوار، الوصول للفروع وكلمات المرور.' },
  { label: 'الفروع', path: '/branches', detail: 'إنشاء الفروع وتفعيلها وتحديد الوصول.' },
  { label: 'مركز المستندات', path: '/documents', detail: 'الملفات والمرفقات المتاحة للشركة.' },
  { label: 'الجلسات والأجهزة', path: '/sessions', detail: 'الجلسات الحالية وإنهاء الوصول.' },
  { label: 'استيراد وتصدير', path: '/dataexchange', detail: 'CSV / XLSX والمطابقة والتحقق والتنفيذ.' },
] as const;

export function MarketReadinessPage({
  client = new HttpAdministrationClient(),
  context,
}: {
  readonly client?: AdministrationClient;
  readonly context?: AdministrationContext;
} = {}) {
  const ctx = context ?? tenantApiContext();
  const [company, setCompany] = useState<readonly unknown[]>([]);
  const [branches, setBranches] = useState<readonly unknown[]>([]);
  const [users, setUsers] = useState<readonly unknown[]>([]);
  const [diagnostics, setDiagnostics] = useState<readonly unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!ctx.token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      client.list('companies', ctx),
      client.list('branches', ctx),
      client.list('users', ctx),
      client.list('operations/diagnostics', ctx),
    ]);
    setCompany(results[0].status === 'fulfilled' ? results[0].value : []);
    setBranches(results[1].status === 'fulfilled' ? results[1].value : []);
    setUsers(results[2].status === 'fulfilled' ? results[2].value : []);
    setDiagnostics(results[3].status === 'fulfilled' ? results[3].value : []);
    const failures = results.filter((item) => item.status === 'rejected').length;
    if (failures) setError(`تعذر تحميل ${failures} من فحوص الجاهزية بسبب الصلاحيات أو حالة الخدمة.`);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [ctx.token, ctx.companyId, ctx.branchId]);

  const checks = [
    { label: 'بيانات الشركة', ready: company.length > 0, path: '/settings' },
    { label: 'الفروع', ready: branches.length > 0, path: '/branches' },
    { label: 'المستخدمون والصلاحيات', ready: users.length > 0, path: '/users' },
    { label: 'صحة النظام والتشخيص', ready: diagnostics.length > 0, path: '/support' },
  ] as const;
  const readyCount = checks.filter((item) => item.ready).length;
  const progress = Math.round((readyCount / checks.length) * 100);

  return (
    <section className="ui-page-stack" dir="rtl" aria-label="جاهزية البيع والتشغيل">
      <Card title="جاهزية البيع والتشغيل">
        <p className="ui-page-intro">قائمة تحقق تشغيلية من بيانات النظام الحالية. لا تنشئ هذه الشاشة حالة موازية ولا تحفظ نتائج منفصلة.</p>
        <ActionBar><Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>إعادة الفحص</Button><a href="/quick-guide">دليل البدء السريع</a></ActionBar>
      </Card>
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : !ctx.token ? <EmptyState title="يلزم تسجيل الدخول" /> : (
        <>
          <div className="ui-metric-grid">
            <MetricCard label="نسبة الجاهزية" value={`${progress}%`} tone={progress === 100 ? 'success' : 'warning'} />
            <MetricCard label="فحوص مكتملة" value={`${readyCount}/${checks.length}`} />
            <MetricCard label="فروع متاحة" value={branches.length} />
            <MetricCard label="مستخدمون" value={users.length} />
          </div>
          <Card title="قائمة الجاهزية">
            <DataGrid columns={['البند', 'الحالة', 'الإجراء']}>
              {checks.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td><Badge tone={item.ready ? 'success' : 'warning'}>{item.ready ? 'مكتمل' : 'يحتاج استكمال'}</Badge></td>
                  <td><a href={item.path}>فتح</a></td>
                </tr>
              ))}
            </DataGrid>
          </Card>
        </>
      )}
    </section>
  );
}

export function BackupCenterPage({
  client = new HttpAdministrationClient(),
  context,
}: {
  readonly client?: AdministrationClient;
  readonly context?: AdministrationContext;
} = {}) {
  const ctx = context ?? tenantApiContext();
  const [diagnostics, setDiagnostics] = useState<readonly RecordValue[]>([]);
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
      setDiagnostics((await client.list('operations/diagnostics', ctx)).filter(record));
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [ctx.token, ctx.companyId, ctx.branchId]);

  const flat = useMemo(() => diagnostics.flatMap((item) => Object.entries(item)), [diagnostics]);
  const provider = flat.find(([key]) => key.toLocaleLowerCase().includes('backup'))?.[1];
  const providerLabel = typeof provider === 'string' ? provider : provider ? 'مهيأ على مستوى المنصة' : 'غير متاح لهذه الصلاحية';

  return (
    <section className="ui-page-stack" dir="rtl" aria-label="النسخ الاحتياطي والاستعادة">
      <Card title="النسخ الاحتياطي والاستعادة">
        <p className="ui-page-intro">مركز متابعة حالة النسخ الاحتياطي من تشخيصات المنصة الحالية. تنفيذ النسخ والتحقق والاستعادة محمي بعقد مالك المنصة ولا يتم تجاوزه من إدارة الشركة.</p>
        <ActionBar><Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>تحديث الحالة</Button><a href="/support">الدعم وحالة النظام</a></ActionBar>
      </Card>
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : !ctx.token ? <EmptyState title="يلزم تسجيل الدخول" /> : (
        <>
          <div className="ui-metric-grid">
            <MetricCard label="موفر النسخ الاحتياطي" value={providerLabel} tone={provider ? 'info' : 'neutral'} />
            <MetricCard label="إنشاء نسخة" value="Owner" />
            <MetricCard label="التحقق" value="Owner" />
            <MetricCard label="الاستعادة" value="Owner + MFA" />
          </div>
          <Card title="حالة الاستمرارية">
            {!flat.length ? <EmptyState title="لا توجد تفاصيل تشخيص متاحة" /> : (
              <DataGrid columns={['الفحص', 'القيمة']}>
                {flat.filter(([, value]) => typeof value !== 'object').map(([key, value]) => <tr key={key}><td>{key}</td><td>{text(value) || '—'}</td></tr>)}
              </DataGrid>
            )}
          </Card>
          <Card title="إجراءات النسخ والاستعادة">
            <p>إنشاء نسخة، Verify، Restore وقوائم النسخ الفعلية تتطلب Tenant-safe backup contract غير متاح في System Administration API الحالي. لا توجد أزرار نجاح وهمية هنا.</p>
          </Card>
        </>
      )}
    </section>
  );
}

export function PeriodArchivingPage() {
  return (
    <section className="ui-page-stack" dir="rtl" aria-label="الأرشفة الذكية">
      <Card title="الأرشفة الذكية">
        <p className="ui-page-intro">واجهة الإدارة العامة للإقفال والأرشفة وصحة البيانات، مع إبقاء ملكية الفترات والقيود والأرصدة داخل المحاسبة.</p>
      </Card>
      <div className="ui-grid-md">
        <Card title="الفترات والإقفال"><p>فتح وإغلاق الفترات المالية يتم من المالك المحاسبي الحالي.</p><ActionBar><a href="/accounting/periods">فتح الفترات المالية</a></ActionBar></Card>
        <Card title="صحة البيانات"><p>راجع الفروق والتحذيرات وجاهزية الإقفال قبل الأرشفة.</p><ActionBar><a href="/audit">فتح الرقابة المالية</a></ActionBar></Card>
        <Card title="سجل المراجعة"><p>راجع كل إجراءات الإقفال والتغييرات من سجل النشاط المعتمد.</p><ActionBar><a href="/activity">فتح سجل النشاط</a></ActionBar></Card>
        <Card title="الاستعادة والمراجعة"><p>استعادة قاعدة البيانات ليست إجراءً ماليًا، وتظل محمية بعقد النسخ والاستعادة الخاص بالمنصة.</p><ActionBar><a href="/backup-center">فتح مركز النسخ الاحتياطي</a></ActionBar></Card>
      </div>
    </section>
  );
}

const guideSteps = [
  { title: '1 — بيانات الشركة والهوية', detail: 'راجع بيانات الشركة وبيانات الطباعة الأساسية.', path: '/settings' },
  { title: '2 — الفروع', detail: 'أنشئ الفروع وحدد نطاق الوصول.', path: '/branches' },
  { title: '3 — المستخدمون والصلاحيات', detail: 'أنشئ المستخدمين واربط الأدوار والفروع.', path: '/users' },
  { title: '4 — الترقيم والإعدادات', detail: 'راجع ترقيم المستندات والمظهر وإعدادات النظام.', path: '/settings' },
  { title: '5 — البيانات الافتتاحية', detail: 'استخدم أدوات الاستيراد الرسمية عند الحاجة.', path: '/dataexchange' },
  { title: '6 — الجاهزية والرقابة', detail: 'أكمل فحوص الجاهزية وراجع الرقابة قبل التشغيل.', path: '/market-readiness' },
] as const;

export function QuickGuidePage() {
  return (
    <section className="ui-page-stack" dir="rtl" aria-label="دليل البدء السريع">
      <Card title="دليل البدء السريع"><p className="ui-page-intro">خطوات التشغيل بالترتيب العملي، وكل خطوة تفتح المالك الحالي بدل إنشاء إعدادات بديلة.</p></Card>
      <div className="ui-grid-md">
        {guideSteps.map((step) => <Card key={step.title} title={step.title}><p>{step.detail}</p><ActionBar><a href={step.path}>فتح الخطوة</a></ActionBar></Card>)}
      </div>
    </section>
  );
}

export function AdministrationSettingsPage({
  client = new HttpAdministrationClient(),
  context,
}: {
  readonly client?: AdministrationClient;
  readonly context?: AdministrationContext;
} = {}) {
  const ctx = context ?? tenantApiContext();
  return (
    <section className="ui-page-stack" dir="rtl" aria-label="الإعدادات">
      <Card title="الإعدادات"><p className="ui-page-intro">إعدادات الشركة والنظام وروابط المالكين المعتمدين. لا توجد خدمة Settings ثانية في هذه الشاشة.</p></Card>
      {!ctx.token ? <EmptyState title="يلزم تسجيل الدخول" /> : <CompanyProfilePanel client={client} context={ctx} />}
      <div className="ui-grid-md">
        <Card title="الترقيم والبادئات"><p>سياسات الترقيم المركزية للمستندات.</p><ActionBar><a href="/system-administration/document-numbering">فتح ترقيم المستندات</a></ActionBar></Card>
        <Card title="المظهر والطباعة"><p>النمط، الخط، الحجم، كثافة الواجهة وإعدادات العرض الحالية.</p><ActionBar><a href="/settings/appearance">فتح المظهر</a><a href="/management/reports">الطباعة وPDF</a></ActionBar></Card>
        <Card title="التنبيهات"><p>مركز الإشعارات الحالي ونتائج التقارير المجدولة.</p><ActionBar><a href="/notifications">فتح التنبيهات</a></ActionBar></Card>
        <Card title="الحساب وسياسات الوصول"><p>بيانات الدخول وإدارة الأدوار والصلاحيات.</p><ActionBar><a href="/settings/account">بيانات الدخول</a><a href="/users">المستخدمون والصلاحيات</a></ActionBar></Card>
        <Card title="السياسات والمالية"><p>حدود الاعتماد والسياسات المالية تظل عند Approval/Accounting owners.</p><ActionBar><a href="/approvals">الاعتمادات</a><a href="/accounting">المحاسبة</a></ActionBar></Card>
        <Card title="حماية البيانات"><p>حالة النسخ والاستعادة واستمرارية التشغيل.</p><ActionBar><a href="/backup-center">مركز النسخ الاحتياطي</a><a href="/support">حالة النظام</a></ActionBar></Card>
      </div>
      <Card title="إعدادات مرئية تنتظر Target Contract">
        <p>حدود تنبيهات الجوازات والفواتير والبرامج والخزينة، وسياسات الورق A4/A5 والاتجاه والتوقيعات والتذييل وتحويل المبلغ إلى حروف لا تُحفظ محليًا لأن عقد إعدادات Tenant معتمدًا لها غير موجود حاليًا.</p>
      </Card>
      <Card title="اختصارات الإدارة">
        <DataGrid columns={['القسم', 'الوصف', 'فتح']}>
          {adminLinks.map((item) => <tr key={item.path}><td>{item.label}</td><td>{item.detail}</td><td><a href={item.path}>فتح</a></td></tr>)}
        </DataGrid>
      </Card>
    </section>
  );
}
