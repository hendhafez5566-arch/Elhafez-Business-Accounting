import { type FormEvent, useEffect, useState } from 'react';
import {
  accountingApi,
  type AccountingCapabilities,
  type AccountingOverview,
  type AccountClassification,
  type FinancialAction,
  type PeriodCloseResult,
} from './accounting-client.js';
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
  MasterDetailWorkspace,
  MetricCard,
  Select,
  SettingsWorkspace,
  SplitWorkspace,
  Toast,
  WorkspaceNavigation,
} from './ui.js';
import {
  AssetsFinancingSection,
  CostBudgetSection,
  CurrencyFxSection,
  ExpenseCommissionSection,
  PartyAccountingSection,
} from './advanced-accounting-sections.js';
import { AllowancesSection, RecognitionAccrualSection } from './advanced-accounting-corrective-sections.js';
import { FiscalYearClosePanel, OpeningBalancesPanel, TreasuryOperationsPanel } from './accounting-parity-sections.js';
import { AssetPayrollParityPanel, FxRevaluationPanel } from './advanced-accounting-parity-sections.js';
import { PeriodClosePanel } from './period-close-panel.js';

const emptyOverview: AccountingOverview = {
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
};

const classLabel: Record<AccountClassification, string> = {
  ASSET: 'أصول',
  LIABILITY: 'التزامات',
  EQUITY: 'حقوق ملكية',
  REVENUE: 'إيرادات',
  EXPENSE: 'مصروفات',
};

const actionLabel: Record<FinancialAction, string> = {
  PAYMENT: 'دفعة',
  PAID_EXPENSE: 'مصروف مدفوع',
  PARTY_NETTING: 'مقاصة طرف',
  COMMISSION_APPROVAL: 'اعتماد عمولة',
  BOOKING_DISCOUNT: 'خصم حجز',
  SERVICE_DISCOUNT: 'خصم خدمة',
};

const accountingSections = [
  { id: 'overview', label: 'لوحة المحاسبة', description: 'ملخص الحالة المالية والتنبيهات الرئيسية.' },
  { id: 'accounts', label: 'دليل الحسابات', description: 'شجرة الحسابات وإنشاء الحسابات من دفتر الأستاذ.' },
  { id: 'journals', label: 'القيود اليومية', description: 'إدخال القيود ومراجعة القيود المرحلة.' },
  { id: 'periods', label: 'الفترات والإقفال', description: 'السنوات والفترات والإقفال والأرصدة الافتتاحية.' },
  { id: 'billing', label: 'الفواتير والذمم', description: 'فواتير العملاء والموردين والإلغاءات المحاسبية.' },
  { id: 'treasury', label: 'الخزائن والبنوك', description: 'الخزائن والحسابات البنكية والتسويات والحركة.' },
  { id: 'currency-fx', label: 'العملات والصرف', description: 'أسعار الصرف وإعادة التقييم.' },
  { id: 'cost-budget', label: 'مراكز التكلفة والموازنات', description: 'التحليل الإداري والتكلفة والموازنات.' },
  { id: 'party-accounting', label: 'حسابات الأطراف والمقاصة', description: 'حسابات العملاء والموردين والمقاصة.' },
  { id: 'expense-commission', label: 'المصروفات والعمولات', description: 'المصروفات والعمولات والاعتمادات المرتبطة.' },
  { id: 'recognition-accrual', label: 'الاستحقاق والاعتراف', description: 'الاستحقاقات والاعتراف بالإيرادات والمصروفات.' },
  { id: 'assets-financing', label: 'الأصول والتمويل', description: 'الأصول والتمويل والعمليات المرتبطة.' },
  { id: 'allowances', label: 'مخصصات الديون', description: 'مخصصات وخسائر الائتمان.' },
  { id: 'tax', label: 'الضرائب', description: 'سياسات الضرائب وحساباتها.' },
  { id: 'controls', label: 'الرقابة والاعتمادات', description: 'سياسات الموافقات ومشكلات الرقابة.' },
  { id: 'reports', label: 'التقارير المالية', description: 'ميزان المراجعة والقوائم والتقارير المالية.' },
] as const;

type AccountingSectionId = (typeof accountingSections)[number]['id'];

export function AccountingWorkspacePage() {
  const [data, setData] = useState<AccountingOverview>(emptyOverview);
  const [cap, setCap] = useState<AccountingCapabilities>({ read: false, operate: false });
  const [section, setSection] = useState<AccountingSectionId>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const [capabilities, overview] = await Promise.all([
        accountingApi.capabilities(),
        accountingApi.overview(),
      ]);
      setCap(capabilities);
      setData(overview);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'تعذر تحميل المحاسبة.');
    } finally {
      setLoading(false);
    }
  }

  async function done(message: string) {
    setNotice(message);
    await reload();
  }

  useEffect(() => {
    void reload();
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!cap.read) return <EmptyState title="لا توجد صلاحية للمحاسبة" />;

  const openInvoices = data.invoices.filter((item) => item.status === 'POSTED' && item.outstanding !== '0').length;
  const pendingApprovals = data.approvalRequests.filter((item) => item.status === 'PENDING').length;
  const openIssues = data.controlIssues.filter((item) => !item.resolvedAt).length;
  const openPeriods = data.periods.filter((item) => item.status === 'OPEN').length;
  const activeTreasuries = data.treasuries.filter((item) => item.active).length;

  return (
    <section dir="rtl" className="ui-dashboard" aria-label="المحاسبة والمالية" data-accounting-layout="workspace">
      <div className="ui-metric-grid">
        <MetricCard label="فواتير مفتوحة" value={openInvoices} tone={openInvoices ? 'warning' : 'neutral'} />
        <MetricCard label="طلبات اعتماد معلقة" value={pendingApprovals} tone={pendingApprovals ? 'warning' : 'neutral'} />
        <MetricCard label="مشكلات رقابة مفتوحة" value={openIssues} tone={openIssues ? 'warning' : 'success'} />
        <MetricCard label="فترات مفتوحة" value={openPeriods} />
        <MetricCard label="خزائن وبنوك نشطة" value={activeTreasuries} />
        <MetricCard label="القيود" value={data.journals.length} />
      </div>

      {notice ? <Toast tone="success">{notice}</Toast> : null}

      <Card title="مركز المحاسبة والمالية">
        <p>
          مساحة تشغيل مالية واحدة تعتمد على مصادر الحقيقة المحاسبية الحالية. تم فصل تنقل الشاشة عن الـTheme
          بحيث يتغير بناء المحاسبة فعليًا من دون تكرار أي رصيد أو قيد أو API.
        </p>
        <ActionBar>
          <Button variant="secondary" onClick={() => void reload()}>تحديث البيانات</Button>
          {pendingApprovals ? <Button variant="secondary" onClick={() => setSection('controls')}>فتح الاعتمادات</Button> : null}
          {openIssues ? <Button variant="secondary" onClick={() => setSection('controls')}>فتح مشكلات الرقابة</Button> : null}
        </ActionBar>
      </Card>

      <SettingsWorkspace
        navigation={(
          <>
            <h2>مساحات المحاسبة</h2>
            <p className="ui-page-intro">اختر مساحة العمل بدل التنقل بين شريط Tabs طويل.</p>
            <WorkspaceNavigation
              items={accountingSections}
              active={section}
              onChange={(id) => setSection(id as AccountingSectionId)}
              ariaLabel="التنقل بين مساحات المحاسبة"
            />
          </>
        )}
        content={renderAccountingSection(section, data, cap, done)}
      />
    </section>
  );
}

function renderAccountingSection(
  section: AccountingSectionId,
  data: AccountingOverview,
  cap: AccountingCapabilities,
  done: (message: string) => Promise<void>,
) {
  switch (section) {
    case 'overview':
      return <Overview data={data} />;
    case 'accounts':
      return <Accounts data={data} operate={cap.operate} done={done} />;
    case 'journals':
      return <Journals data={data} operate={cap.operate} done={done} />;
    case 'periods':
      return <Periods data={data} operate={cap.operate} done={done} />;
    case 'billing':
      return <Billing data={data} operate={cap.operate} done={done} />;
    case 'treasury':
      return (
        <>
          <Treasury data={data} operate={cap.operate} done={done} />
          <TreasuryOperationsPanel
            treasuries={data.treasuries}
            vouchers={data.vouchers}
            accounts={data.accounts}
            operate={cap.operate}
            done={done}
          />
        </>
      );
    case 'currency-fx':
      return cap.operate
        ? <><CurrencyFxSection /><FxRevaluationPanel operate={cap.operate} /></>
        : <ReadOnlyState />;
    case 'cost-budget':
      return cap.operate ? <CostBudgetSection /> : <ReadOnlyState />;
    case 'party-accounting':
      return cap.operate ? <PartyAccountingSection /> : <ReadOnlyState />;
    case 'expense-commission':
      return cap.operate ? <ExpenseCommissionSection /> : <ReadOnlyState />;
    case 'recognition-accrual':
      return cap.operate
        ? <RecognitionAccrualSection accounts={data.accounts} invoices={data.invoices} />
        : <ReadOnlyState />;
    case 'assets-financing':
      return cap.operate
        ? <><AssetsFinancingSection /><AssetPayrollParityPanel accounts={data.accounts} treasuries={data.treasuries} operate={cap.operate} done={done} /></>
        : <ReadOnlyState />;
    case 'allowances':
      return cap.operate
        ? <AllowancesSection accounts={data.accounts} invoices={data.invoices} />
        : <ReadOnlyState />;
    case 'tax':
      return <Tax data={data} operate={cap.operate} done={done} />;
    case 'controls':
      return <Controls data={data} operate={cap.operate} done={done} />;
    case 'reports':
      return <Reports data={data} />;
  }
}

function ReadOnlyState() {
  return (
    <EmptyState title="صلاحية قراءة فقط">
      هذه المساحة تحتوي عمليات مالية وتحتاج صلاحية تشغيل المحاسبة.
    </EmptyState>
  );
}

function Overview({ data }: { data: AccountingOverview }) {
  const pending = data.approvalRequests.filter((item) => item.status === 'PENDING');
  const issues = data.controlIssues.filter((item) => !item.resolvedAt);
  return (
    <>
      <section className="ui-dashboard-grid">
        <Card title="الحالة المحاسبية">
          <div className="ui-metric-grid">
            <MetricCard label="الحسابات" value={data.accounts.length} />
            <MetricCard label="سنوات مالية" value={data.fiscalYears.length} />
            <MetricCard label="الفترات" value={data.periods.length} />
            <MetricCard label="سياسات ضرائب" value={data.taxPolicies.length} />
          </div>
        </Card>
        <Card title="يحتاج انتباه">
          <p>طلبات الاعتماد المعلقة: <strong>{pending.length}</strong></p>
          <p>مشكلات الرقابة المفتوحة: <strong>{issues.length}</strong></p>
          <p>الفواتير المفتوحة: <strong>{data.invoices.filter((item) => item.status === 'POSTED' && item.outstanding !== '0').length}</strong></p>
        </Card>
      </section>
      <section className="ui-dashboard-grid">
        <Card title="الخزائن حسب العملة">
          {!data.reports.treasury.totals.length
            ? <EmptyState title="لا توجد أرصدة خزائن معروضة" />
            : <DataGrid columns={['العملة', 'الإجمالي']}>
                {data.reports.treasury.totals.map((item) => <tr key={item.currency}><td>{item.currency}</td><td>{item.amount}</td></tr>)}
              </DataGrid>}
        </Card>
        <Card title="ملخص الضرائب">
          {!data.reports.tax.totals.length
            ? <EmptyState title="لا توجد حركة ضريبية" />
            : <DataGrid columns={['العملة', 'الإجمالي']}>
                {data.reports.tax.totals.map((item) => <tr key={item.currency}><td>{item.currency}</td><td>{item.amount}</td></tr>)}
              </DataGrid>}
        </Card>
      </section>
    </>
  );
}

function Accounts({
  data,
  operate,
  done,
}: {
  data: AccountingOverview;
  operate: boolean;
  done: (message: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    classification: 'ASSET' as AccountClassification,
    parentId: '',
    controlType: '',
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await accountingApi.createAccount({
      ...form,
      postable: true,
      ...(form.parentId ? { parentId: form.parentId } : {}),
      ...(form.controlType ? { controlType: form.controlType } : {}),
    });
    setForm({ code: '', name: '', classification: 'ASSET', parentId: '', controlType: '' });
    await done('تم إنشاء الحساب من خلال دفتر الأستاذ العام.');
  }

  const master = (
    <>
      <h2>دليل الحسابات</h2>
      <p className="ui-page-intro">قائمة الحسابات الحالية وحالتها وتصنيفها.</p>
      <DataGrid columns={['الكود', 'الحساب', 'التصنيف', 'الحالة']}>
        {data.accounts.map((item) => (
          <tr key={item.id}>
            <td>{item.code}</td>
            <td>{item.name}</td>
            <td>{classLabel[item.classification]}</td>
            <td><Badge tone={item.active ? 'success' : 'neutral'}>{item.active ? 'نشط' : 'غير نشط'}</Badge></td>
          </tr>
        ))}
      </DataGrid>
    </>
  );

  const detail = operate ? (
    <>
      <h2>إضافة حساب</h2>
      <p className="ui-page-intro">إنشاء حساب جديد داخل نفس دفتر الأستاذ المعتمد.</p>
      <form className="ui-filter-grid" onSubmit={submit}>
        <FormField label="الكود" required>
          <Input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        </FormField>
        <FormField label="اسم الحساب" required>
          <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FormField>
        <FormField label="التصنيف">
          <Select value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value as AccountClassification })}>
            {Object.entries(classLabel).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </FormField>
        <FormField label="الحساب الأب">
          <Input value={form.parentId} onChange={(event) => setForm({ ...form, parentId: event.target.value })} />
        </FormField>
        <Button type="submit">إنشاء حساب</Button>
      </form>
    </>
  ) : <ReadOnlyState />;

  return <MasterDetailWorkspace master={master} detail={detail} />;
}

function Journals({
  data,
  operate,
  done,
}: {
  data: AccountingOverview;
  operate: boolean;
  done: (message: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    number: '',
    postingDate: '',
    debitAccount: '',
    creditAccount: '',
    amount: '',
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await accountingApi.postManualJournal({
      commandKey: crypto.randomUUID(),
      number: form.number,
      postingDate: form.postingDate,
      lines: [
        { accountId: form.debitAccount, debit: form.amount },
        { accountId: form.creditAccount, credit: form.amount },
      ],
    });
    setForm({ number: '', postingDate: '', debitAccount: '', creditAccount: '', amount: '' });
    await done('تم ترحيل القيد عبر General Ledger.');
  }

  const entry = operate ? (
    <>
      <h2>قيد يومية جديد</h2>
      <p className="ui-page-intro">نموذج قيد متوازن منفصل عن سجل القيود.</p>
      <form onSubmit={submit}>
        <FormField label="رقم القيد" required>
          <Input required value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} />
        </FormField>
        <FormField label="تاريخ الترحيل" required>
          <Input required type="date" value={form.postingDate} onChange={(event) => setForm({ ...form, postingDate: event.target.value })} />
        </FormField>
        <FormField label="الحساب المدين" required>
          <Select required value={form.debitAccount} onChange={(event) => setForm({ ...form, debitAccount: event.target.value })}>
            <option value="">اختر</option>
            {data.accounts.filter((item) => item.active && item.postable).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
          </Select>
        </FormField>
        <FormField label="الحساب الدائن" required>
          <Select required value={form.creditAccount} onChange={(event) => setForm({ ...form, creditAccount: event.target.value })}>
            <option value="">اختر</option>
            {data.accounts.filter((item) => item.active && item.postable).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
          </Select>
        </FormField>
        <FormField label="المبلغ" required>
          <Input required inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        </FormField>
        <Button type="submit">ترحيل القيد</Button>
      </form>
    </>
  ) : <ReadOnlyState />;

  const history = (
    <>
      <h2>سجل القيود</h2>
      <p className="ui-page-intro">القيود المرحلة من المصدر المحاسبي المعتمد.</p>
      <DataGrid columns={['الرقم', 'التاريخ', 'النوع', 'المصدر']}>
        {data.journals.map((item) => (
          <tr key={item.id}>
            <td>{item.number}</td>
            <td>{item.postingDate}</td>
            <td>{item.kind}</td>
            <td>{item.sourceType}</td>
          </tr>
        ))}
      </DataGrid>
    </>
  );

  return <SplitWorkspace left={entry} right={history} />;
}

function Periods({
  data,
  operate,
  done,
}: {
  data: AccountingOverview;
  operate: boolean;
  done: (message: string) => Promise<void>;
}) {
  const [year, setYear] = useState({ startDate: '', endDate: '' });
  const [period, setPeriod] = useState({ fiscalYearId: '', startDate: '', endDate: '' });
  const [outcome, setOutcome] = useState<PeriodCloseResult | null>(null);
  const [error, setError] = useState('');

  async function addYear(event: FormEvent) {
    event.preventDefault();
    await accountingApi.createFiscalYear(year);
    setYear({ startDate: '', endDate: '' });
    await done('تم إنشاء السنة المالية.');
  }

  async function addPeriod(event: FormEvent) {
    event.preventDefault();
    await accountingApi.createPeriod(period);
    setPeriod({ fiscalYearId: '', startDate: '', endDate: '' });
    await done('تم إنشاء الفترة المحاسبية.');
  }

  async function toggle(id: string, status: 'OPEN' | 'CLOSED') {
    setError('');
    try {
      if (status === 'CLOSED') {
        const result = await accountingApi.closePeriod(id, crypto.randomUUID());
        setOutcome(result);
        if (result.closed) {
          await done(result.alreadyClosed ? 'الفترة مغلقة بالفعل.' : 'تم إغلاق الفترة بعد اجتياز فحوصات الرقابة.');
        }
        return;
      }
      await accountingApi.reopenPeriod(id);
      setOutcome(null);
      await done('تمت إعادة فتح الفترة.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'تعذر تحديث حالة الفترة.');
    }
  }

  return (
    <>
      {error ? <Toast tone="error">{error}</Toast> : null}
      <SplitWorkspace
        left={operate ? (
          <>
            <h2>السنة المالية</h2>
            <form onSubmit={addYear}>
              <FormField label="من"><Input required type="date" value={year.startDate} onChange={(event) => setYear({ ...year, startDate: event.target.value })} /></FormField>
              <FormField label="إلى"><Input required type="date" value={year.endDate} onChange={(event) => setYear({ ...year, endDate: event.target.value })} /></FormField>
              <Button type="submit">إنشاء سنة مالية</Button>
            </form>
          </>
        ) : <ReadOnlyState />}
        right={operate ? (
          <>
            <h2>فترة محاسبية</h2>
            <form onSubmit={addPeriod}>
              <FormField label="السنة">
                <Select required value={period.fiscalYearId} onChange={(event) => setPeriod({ ...period, fiscalYearId: event.target.value })}>
                  <option value="">اختر</option>
                  {data.fiscalYears.map((item) => <option key={item.id} value={item.id}>{item.startDate} — {item.endDate}</option>)}
                </Select>
              </FormField>
              <FormField label="من"><Input required type="date" value={period.startDate} onChange={(event) => setPeriod({ ...period, startDate: event.target.value })} /></FormField>
              <FormField label="إلى"><Input required type="date" value={period.endDate} onChange={(event) => setPeriod({ ...period, endDate: event.target.value })} /></FormField>
              <Button type="submit">إنشاء فترة</Button>
            </form>
          </>
        ) : <ReadOnlyState />}
      />
      <Card title="الفترات الحالية">
        <DataGrid columns={['السنة', 'من', 'إلى', 'الحالة', 'الإجراء']}>
          {data.periods.map((item) => (
            <tr key={item.id}>
              <td>{item.fiscalYearId}</td>
              <td>{item.startDate}</td>
              <td>{item.endDate}</td>
              <td><Badge tone={item.status === 'OPEN' ? 'success' : 'neutral'}>{item.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}</Badge></td>
              <td>{operate ? <Button variant="secondary" onClick={() => void toggle(item.id, item.status === 'OPEN' ? 'CLOSED' : 'OPEN')}>{item.status === 'OPEN' ? 'إغلاق مضبوط' : 'إعادة فتح'}</Button> : null}</td>
            </tr>
          ))}
        </DataGrid>
      </Card>
      <PeriodClosePanel outcome={outcome} />
      <FiscalYearClosePanel fiscalYears={data.fiscalYears} accounts={data.accounts} operate={operate} done={done} />
      <OpeningBalancesPanel accounts={data.accounts} operate={operate} done={done} />
    </>
  );
}

function Billing({
  data,
  operate,
  done,
}: {
  data: AccountingOverview;
  operate: boolean;
  done: (message: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    type: 'CUSTOMER' as 'CUSTOMER' | 'SUPPLIER',
    partyId: '',
    number: '',
    postingDate: '',
    dueDate: '',
    currency: 'EGP',
    controlAccountId: '',
    lineAccountId: '',
    amount: '',
    taxCode: '',
    deferred: false,
  });
  const [cancel, setCancel] = useState({ invoiceId: '', postingDate: '', number: '' });

  async function create(event: FormEvent) {
    event.preventDefault();
    await accountingApi.createInvoice({
      commandKey: crypto.randomUUID(),
      type: form.type,
      partyId: form.partyId,
      number: form.number,
      postingDate: form.postingDate,
      ...(form.dueDate ? { dueDate: form.dueDate } : {}),
      currency: form.currency,
      controlAccountId: form.controlAccountId,
      deferred: form.deferred,
      lines: [{ accountId: form.lineAccountId, amount: form.amount, ...(form.taxCode ? { taxCode: form.taxCode } : {}) }],
    });
    setForm({
      type: 'CUSTOMER', partyId: '', number: '', postingDate: '', dueDate: '', currency: 'EGP',
      controlAccountId: '', lineAccountId: '', amount: '', taxCode: '', deferred: false,
    });
    await done('تم إنشاء الفاتورة وترحيلها عبر Billing/Subledgers.');
  }

  async function cancelInvoice(event: FormEvent) {
    event.preventDefault();
    await accountingApi.cancelInvoice(cancel.invoiceId, { postingDate: cancel.postingDate, number: cancel.number });
    setCancel({ invoiceId: '', postingDate: '', number: '' });
    await done('تم إلغاء الفاتورة بقيد عكسي من المالك المحاسبي.');
  }

  const invoices = (
    <>
      <h2>الفواتير والذمم</h2>
      <p className="ui-page-intro">السجل الفعلي للفواتير المرحّلة والمبالغ المتبقية.</p>
      <DataGrid columns={['الفاتورة', 'النوع', 'الطرف', 'العملة', 'الإجمالي', 'المتبقي', 'الحالة']}>
        {data.invoices.map((item) => (
          <tr key={item.id}>
            <td>{item.number}</td>
            <td>{item.type}</td>
            <td>{item.partyId}</td>
            <td>{item.currency}</td>
            <td>{item.baseTotal}</td>
            <td>{item.outstanding}</td>
            <td>{item.status}</td>
          </tr>
        ))}
      </DataGrid>
    </>
  );

  const actions = operate ? (
    <>
      <h2>إنشاء فاتورة</h2>
      <form onSubmit={create}>
        <FormField label="النوع">
          <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as 'CUSTOMER' | 'SUPPLIER' })}>
            <option value="CUSTOMER">عميل</option>
            <option value="SUPPLIER">مورد</option>
          </Select>
        </FormField>
        <FormField label="معرف الطرف" required><Input required value={form.partyId} onChange={(event) => setForm({ ...form, partyId: event.target.value })} /></FormField>
        <FormField label="رقم الفاتورة" required><Input required value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} /></FormField>
        <FormField label="تاريخ الترحيل" required><Input required type="date" value={form.postingDate} onChange={(event) => setForm({ ...form, postingDate: event.target.value })} /></FormField>
        <FormField label="الاستحقاق"><Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></FormField>
        <FormField label="العملة"><Input required value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></FormField>
        <FormField label="حساب الرقابة" required>
          <Select required value={form.controlAccountId} onChange={(event) => setForm({ ...form, controlAccountId: event.target.value })}>
            <option value="">اختر</option>
            {data.accounts.filter((item) => item.active && item.postable).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
          </Select>
        </FormField>
        <FormField label="حساب البند" required>
          <Select required value={form.lineAccountId} onChange={(event) => setForm({ ...form, lineAccountId: event.target.value })}>
            <option value="">اختر</option>
            {data.accounts.filter((item) => item.active && item.postable).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
          </Select>
        </FormField>
        <FormField label="المبلغ" required><Input required inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></FormField>
        <FormField label="كود الضريبة"><Input value={form.taxCode} onChange={(event) => setForm({ ...form, taxCode: event.target.value.toUpperCase() })} /></FormField>
        <Button type="submit">إنشاء وترحيل</Button>
      </form>

      <h2 className="ui-section-space">إلغاء فاتورة</h2>
      <form onSubmit={cancelInvoice}>
        <FormField label="الفاتورة" required>
          <Select required value={cancel.invoiceId} onChange={(event) => setCancel({ ...cancel, invoiceId: event.target.value })}>
            <option value="">اختر فاتورة مرحّلة</option>
            {data.invoices.filter((item) => item.status === 'POSTED').map((item) => <option key={item.id} value={item.id}>{item.number} — {item.partyId}</option>)}
          </Select>
        </FormField>
        <FormField label="تاريخ الإلغاء" required><Input required type="date" value={cancel.postingDate} onChange={(event) => setCancel({ ...cancel, postingDate: event.target.value })} /></FormField>
        <FormField label="رقم القيد العكسي" required><Input required value={cancel.number} onChange={(event) => setCancel({ ...cancel, number: event.target.value })} /></FormField>
        <Button variant="danger" type="submit">إلغاء محاسبي</Button>
      </form>
    </>
  ) : <ReadOnlyState />;

  return <MasterDetailWorkspace master={invoices} detail={actions} />;
}

function Treasury({
  data,
  operate,
  done,
}: {
  data: AccountingOverview;
  operate: boolean;
  done: (message: string) => Promise<void>;
}) {
  const [form, setForm] = useState({ code: '', name: '', type: 'CASH' as 'CASH' | 'BANK', currency: 'EGP', glAccountId: '' });
  const [settlement, setSettlement] = useState({ invoiceId: '', treasuryId: '', number: '', postingDate: '', amount: '' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await accountingApi.createTreasury(form);
    setForm({ code: '', name: '', type: 'CASH', currency: 'EGP', glAccountId: '' });
    await done('تم إنشاء الخزينة/الحساب البنكي.');
  }

  async function settle(event: FormEvent) {
    event.preventDefault();
    await accountingApi.postSettlement({ commandKey: crypto.randomUUID(), ...settlement });
    setSettlement({ invoiceId: '', treasuryId: '', number: '', postingDate: '', amount: '' });
    await done('تم تسجيل التحصيل/السداد وتسويته على الفاتورة.');
  }

  const treasurySide = (
    <>
      <h2>الخزائن والحسابات البنكية</h2>
      <DataGrid columns={['الكود', 'الاسم', 'النوع', 'العملة', 'الحالة']}>
        {data.treasuries.map((item) => (
          <tr key={item.id}>
            <td>{item.code}</td>
            <td>{item.name}</td>
            <td>{item.type === 'BANK' ? 'بنك' : 'خزينة'}</td>
            <td>{item.currency}</td>
            <td>{item.active ? 'نشط' : 'غير نشط'}</td>
          </tr>
        ))}
      </DataGrid>
      {operate ? (
        <form className="ui-section-space" onSubmit={submit}>
          <FormField label="الكود"><Input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></FormField>
          <FormField label="الاسم"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
          <FormField label="النوع">
            <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as 'CASH' | 'BANK' })}>
              <option value="CASH">خزينة</option>
              <option value="BANK">بنك</option>
            </Select>
          </FormField>
          <FormField label="العملة"><Input required value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></FormField>
          <FormField label="حساب الأستاذ">
            <Select required value={form.glAccountId} onChange={(event) => setForm({ ...form, glAccountId: event.target.value })}>
              <option value="">اختر</option>
              {data.accounts.filter((item) => item.active && item.postable).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
            </Select>
          </FormField>
          <Button type="submit">إنشاء</Button>
        </form>
      ) : null}
    </>
  );

  const settlementSide = (
    <>
      <h2>التسويات والحركة</h2>
      <p className="ui-page-intro">مقابلة التحصيلات والسداد مع الفواتير من نفس مصادر المحاسبة الحالية.</p>
      {operate ? (
        <form onSubmit={settle}>
          <FormField label="الفاتورة" required>
            <Select required value={settlement.invoiceId} onChange={(event) => setSettlement({ ...settlement, invoiceId: event.target.value })}>
              <option value="">اختر فاتورة مفتوحة</option>
              {data.invoices.filter((item) => item.status === 'POSTED' && item.outstanding !== '0').map((item) => <option key={item.id} value={item.id}>{item.number} — {item.outstanding} {item.currency}</option>)}
            </Select>
          </FormField>
          <FormField label="الخزينة / البنك" required>
            <Select required value={settlement.treasuryId} onChange={(event) => setSettlement({ ...settlement, treasuryId: event.target.value })}>
              <option value="">اختر</option>
              {data.treasuries.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
            </Select>
          </FormField>
          <FormField label="رقم المستند" required><Input required value={settlement.number} onChange={(event) => setSettlement({ ...settlement, number: event.target.value })} /></FormField>
          <FormField label="التاريخ" required><Input required type="date" value={settlement.postingDate} onChange={(event) => setSettlement({ ...settlement, postingDate: event.target.value })} /></FormField>
          <FormField label="المبلغ" required><Input required inputMode="decimal" value={settlement.amount} onChange={(event) => setSettlement({ ...settlement, amount: event.target.value })} /></FormField>
          <Button type="submit">ترحيل التسوية</Button>
        </form>
      ) : <ReadOnlyState />}
      <div className="ui-section-space">
        <DataGrid columns={['المستند', 'النوع', 'التاريخ', 'العملة', 'المبلغ', 'الحالة']}>
          {data.vouchers.map((item) => (
            <tr key={item.id}>
              <td>{item.number}</td>
              <td>{item.kind}</td>
              <td>{item.postingDate}</td>
              <td>{item.currency}</td>
              <td>{item.amount}</td>
              <td>{item.status}</td>
            </tr>
          ))}
        </DataGrid>
      </div>
    </>
  );

  return <SplitWorkspace left={treasurySide} right={settlementSide} />;
}

function Tax({
  data,
  operate,
  done,
}: {
  data: AccountingOverview;
  operate: boolean;
  done: (message: string) => Promise<void>;
}) {
  const [form, setForm] = useState({ code: '', effectiveFrom: '', rate: '', outputAccountId: '', inputAccountId: '' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await accountingApi.configureTax(form);
    setForm({ code: '', effectiveFrom: '', rate: '', outputAccountId: '', inputAccountId: '' });
    await done('تم حفظ سياسة الضريبة من خلال Tax owner.');
  }

  const policies = (
    <>
      <h2>سياسات الضرائب</h2>
      <DataGrid columns={['الكود', 'سارية من', 'المعدل', 'مخرجات', 'مدخلات']}>
        {data.taxPolicies.map((item) => (
          <tr key={item.id}>
            <td>{item.code}</td>
            <td>{item.effectiveFrom}</td>
            <td>{item.rate}</td>
            <td>{item.outputAccountId}</td>
            <td>{item.inputAccountId}</td>
          </tr>
        ))}
      </DataGrid>
    </>
  );

  const editor = operate ? (
    <>
      <h2>إعداد ضريبة</h2>
      <form onSubmit={submit}>
        <FormField label="الكود" required><Input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} /></FormField>
        <FormField label="سارية من" required><Input required type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></FormField>
        <FormField label="المعدل" hint="مثال: 0.14"><Input required inputMode="decimal" value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} /></FormField>
        <FormField label="حساب ضريبة المخرجات" required>
          <Select required value={form.outputAccountId} onChange={(event) => setForm({ ...form, outputAccountId: event.target.value })}>
            <option value="">اختر</option>
            {data.accounts.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
          </Select>
        </FormField>
        <FormField label="حساب ضريبة المدخلات" required>
          <Select required value={form.inputAccountId} onChange={(event) => setForm({ ...form, inputAccountId: event.target.value })}>
            <option value="">اختر</option>
            {data.accounts.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
          </Select>
        </FormField>
        <Button type="submit">حفظ السياسة</Button>
      </form>
    </>
  ) : <ReadOnlyState />;

  return <MasterDetailWorkspace master={policies} detail={editor} />;
}

function Controls({
  data,
  operate,
  done,
}: {
  data: AccountingOverview;
  operate: boolean;
  done: (message: string) => Promise<void>;
}) {
  const [policy, setPolicy] = useState({ action: 'PAYMENT' as FinancialAction, threshold: '0', active: true, forbidSelfApproval: true, requiredAuthority: '' });
  const [decision, setDecision] = useState({ requestId: '', outcome: 'APPROVED' as 'APPROVED' | 'REJECTED', reason: '' });

  async function save(event: FormEvent) {
    event.preventDefault();
    await accountingApi.configureApprovalPolicy(policy);
    await done('تم حفظ سياسة الاعتماد المالي.');
  }

  async function decide(event: FormEvent) {
    event.preventDefault();
    await accountingApi.decideApproval(decision.requestId, {
      outcome: decision.outcome,
      ...(decision.reason ? { reason: decision.reason } : {}),
    });
    setDecision({ requestId: '', outcome: 'APPROVED', reason: '' });
    await done('تم تسجيل قرار الاعتماد من خلال Financial Controls.');
  }

  return (
    <>
      <SplitWorkspace
        left={operate ? (
          <>
            <h2>سياسة اعتماد</h2>
            <form onSubmit={save}>
              <FormField label="الإجراء">
                <Select value={policy.action} onChange={(event) => setPolicy({ ...policy, action: event.target.value as FinancialAction })}>
                  {Object.entries(actionLabel).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </Select>
              </FormField>
              <FormField label="حد الاعتماد"><Input required inputMode="decimal" value={policy.threshold} onChange={(event) => setPolicy({ ...policy, threshold: event.target.value })} /></FormField>
              <FormField label="الصلاحية المطلوبة"><Input required value={policy.requiredAuthority} onChange={(event) => setPolicy({ ...policy, requiredAuthority: event.target.value })} /></FormField>
              <Button type="submit">حفظ السياسة</Button>
            </form>
          </>
        ) : <ReadOnlyState />}
        right={operate ? (
          <>
            <h2>قرار اعتماد</h2>
            <form onSubmit={decide}>
              <FormField label="الطلب">
                <Select required value={decision.requestId} onChange={(event) => setDecision({ ...decision, requestId: event.target.value })}>
                  <option value="">اختر طلبًا معلقًا</option>
                  {data.approvalRequests.filter((item) => item.status === 'PENDING').map((item) => <option key={item.id} value={item.id}>{actionLabel[item.action]} — {item.amount}</option>)}
                </Select>
              </FormField>
              <FormField label="القرار">
                <Select value={decision.outcome} onChange={(event) => setDecision({ ...decision, outcome: event.target.value as 'APPROVED' | 'REJECTED' })}>
                  <option value="APPROVED">موافقة</option>
                  <option value="REJECTED">رفض</option>
                </Select>
              </FormField>
              <FormField label="السبب"><Input value={decision.reason} onChange={(event) => setDecision({ ...decision, reason: event.target.value })} /></FormField>
              <Button type="submit">تسجيل القرار</Button>
            </form>
          </>
        ) : <ReadOnlyState />}
      />
      <Card title="سياسات الاعتماد">
        <DataGrid columns={['الإجراء', 'الحد', 'الصلاحية', 'الحالة']}>
          {data.approvalPolicies.map((item) => (
            <tr key={item.id}><td>{actionLabel[item.action]}</td><td>{item.threshold}</td><td>{item.requiredAuthority}</td><td>{item.active ? 'نشطة' : 'متوقفة'}</td></tr>
          ))}
        </DataGrid>
      </Card>
      <Card title="مشكلات الرقابة">
        <DataGrid columns={['المفتاح', 'المصدر', 'الأستاذ', 'الفرق', 'الحالة']}>
          {data.controlIssues.map((item) => (
            <tr key={item.id}><td>{item.evidenceKey}</td><td>{item.sourceAmount}</td><td>{item.ledgerAmount}</td><td>{item.difference}</td><td>{item.resolvedAt ? 'مغلقة' : 'مفتوحة'}</td></tr>
          ))}
        </DataGrid>
      </Card>
    </>
  );
}

function Reports({ data }: { data: AccountingOverview }) {
  return (
    <div className="ui-dashboard-grid">
      <Card title="ميزان المراجعة"><ReportTable rows={data.reports.trialBalance.rows} /></Card>
      <Card title="قائمة الدخل"><ReportTable rows={data.reports.incomeStatement.rows} /></Card>
      <Card title="المركز المالي"><ReportTable rows={data.reports.balanceSheet.rows} /></Card>
      <Card title="إجمالي الخزائن">
        <DataGrid columns={['العملة', 'الإجمالي']}>
          {data.reports.treasury.totals.map((item) => <tr key={item.currency}><td>{item.currency}</td><td>{item.amount}</td></tr>)}
        </DataGrid>
      </Card>
      <Card title="الضرائب">
        <DataGrid columns={['العملة', 'الإجمالي']}>
          {data.reports.tax.totals.map((item) => <tr key={item.currency}><td>{item.currency}</td><td>{item.amount}</td></tr>)}
        </DataGrid>
      </Card>
    </div>
  );
}

function ReportTable({ rows }: { rows: { accountId?: string; accountClass?: string; currency: string; amount: string }[] }) {
  return (
    <DataGrid columns={['البند', 'العملة', 'القيمة']}>
      {rows.map((item, index) => (
        <tr key={(item.accountId ?? item.accountClass ?? 'row') + index}>
          <td>{item.accountId ?? item.accountClass ?? '—'}</td>
          <td>{item.currency}</td>
          <td>{item.amount}</td>
        </tr>
      ))}
    </DataGrid>
  );
}
