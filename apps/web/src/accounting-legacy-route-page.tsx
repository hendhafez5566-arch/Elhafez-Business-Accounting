import { useEffect, useState } from 'react';
import { accountingApi, type AccountingCapabilities, type AccountingOverview } from './accounting-client.js';
import { AccountingSectionContent, type AccountingSectionId } from './accounting-workspace-page.js';
import { Badge, Button, EmptyState, ErrorState, LoadingState, Toast } from './ui.js';

const emptyOverview: AccountingOverview = {
  fiscalYears: [], periods: [], accounts: [], journals: [], invoices: [], treasuries: [], vouchers: [],
  taxPolicies: [], approvalPolicies: [], approvalRequests: [], controlIssues: [],
  reports: { trialBalance: { rows: [] }, incomeStatement: { rows: [] }, balanceSheet: { rows: [] }, treasury: { totals: [] }, tax: { totals: [], facts: [] } },
};

export type AccountingLegacyScreen =
  | 'workspace' | 'invoices' | 'receipts' | 'payments' | 'expenses' | 'settlements' | 'accruals'
  | 'cheques' | 'treasury' | 'currencies' | 'taxes' | 'periods' | 'journal' | 'accounts' | 'trial'
  | 'cost-centers' | 'assets' | 'loans' | 'budgets';

const screenPresentation: Record<AccountingLegacyScreen, { title: string; subtitle: string; accent: string; action: string }> = {
  workspace: { title: 'المحاسبة والمالية', subtitle: 'ملخص الحالة المالية والعمليات التي تحتاج متابعة', accent: 'navy', action: 'تحديث البيانات' },
  invoices: { title: 'الفواتير', subtitle: 'فواتير العملاء والموردين وحالات الاستحقاق والترحيل', accent: 'blue', action: '+ فاتورة' },
  receipts: { title: 'سندات القبض', subtitle: 'تحصيلات العملاء وربطها بالفواتير والخزائن', accent: 'green', action: '+ سند قبض' },
  payments: { title: 'سندات الصرف', subtitle: 'مدفوعات الموردين والمصروفات ووسائل السداد', accent: 'red', action: '+ سند صرف' },
  expenses: { title: 'المصروفات', subtitle: 'المصروفات والتصنيفات والمعالجة المحاسبية', accent: 'red', action: '+ مصروف' },
  settlements: { title: 'التسويات', subtitle: 'تسويات أرصدة العملاء والموردين مع سجل غير قابل للمحو', accent: 'navy', action: '+ تسوية' },
  accruals: { title: 'الاستحقاقات', subtitle: 'جداول الاستحقاق والاعتراف والتأجيل', accent: 'navy', action: '+ استحقاق' },
  cheques: { title: 'الشيكات', subtitle: 'الشيكات الواردة والصادرة وحالات التحصيل والارتداد', accent: 'brown', action: '+ شيك' },
  treasury: { title: 'الخزينة والبنوك', subtitle: 'الحسابات والتحويلات والتسوية البنكية', accent: 'green', action: '+ خزنة / بنك' },
  currencies: { title: 'العملات وأسعار الصرف', subtitle: 'العملات والأسعار المؤرخة وإعادة التقييم', accent: 'gold', action: '+ سعر صرف' },
  taxes: { title: 'الضرائب', subtitle: 'أكواد الضرائب والحسابات المرتبطة', accent: 'brown', action: '+ كود ضريبة' },
  periods: { title: 'الفترات المالية', subtitle: 'السنوات والفترات والإقفال وإعادة الفتح', accent: 'gray', action: '+ فترة مالية' },
  journal: { title: 'القيود اليومية', subtitle: 'القيود المتوازنة وحالات الترحيل والعكس', accent: 'slate', action: '+ قيد يومية' },
  accounts: { title: 'دليل الحسابات', subtitle: 'شجرة الحسابات والتصنيفات والحسابات النظامية', accent: 'blue', action: '+ حساب' },
  trial: { title: 'ميزان المراجعة', subtitle: 'الأرصدة المدينة والدائنة حسب الفترة والعملة', accent: 'purple', action: 'طباعة / تصدير' },
  'cost-centers': { title: 'مراكز التكلفة', subtitle: 'الهيكل والموازنات والمسؤوليات', accent: 'teal', action: '+ مركز تكلفة' },
  assets: { title: 'الأصول', subtitle: 'سجل الأصول والإهلاك والاستبعاد', accent: 'blue', action: '+ أصل' },
  loans: { title: 'القروض والتمويل', subtitle: 'التمويلات وجداول الأقساط والمخصصات', accent: 'navy', action: '+ قرض' },
  budgets: { title: 'الموازنات', subtitle: 'المخطط مقابل الفعلي حسب الحساب ومركز التكلفة', accent: 'teal', action: '+ موازنة' },
};

export function AccountingLegacyRoutePage({ initialSection, screen }: { readonly initialSection: AccountingSectionId; readonly screen: AccountingLegacyScreen }) {
  const [data, setData] = useState<AccountingOverview>(emptyOverview);
  const [capabilities, setCapabilities] = useState<AccountingCapabilities>({ read: false, operate: false });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true); setError('');
    try {
      const [nextCapabilities, nextData] = await Promise.all([accountingApi.capabilities(), accountingApi.overview()]);
      setCapabilities(nextCapabilities); setData(nextData);
    } catch (value) { setError(value instanceof Error ? value.message : 'تعذر تحميل المحاسبة.'); }
    finally { setLoading(false); }
  }
  async function done(message: string) { setNotice(message); await reload(); }
  useEffect(() => { void reload(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!capabilities.read) return <EmptyState title="لا توجد صلاحية للمحاسبة" />;

  const presentation = screenPresentation[screen];
  return <section dir="rtl" className="ui-page-stack" data-accounting-accent={presentation.accent} aria-label={presentation.title}>
    <header className="ui-toolbar">
      <div className="ui-inline"><span aria-hidden="true" className="ui-icon-badge">◈</span><div><h2>{presentation.title}</h2><p>{presentation.subtitle}</p></div></div>
      <div className="ui-inline"><Badge tone={capabilities.operate ? 'success' : 'neutral'}>{capabilities.operate ? 'تشغيل' : 'قراءة فقط'}</Badge><Button type="button" onClick={() => void reload()}>{presentation.action}</Button></div>
    </header>
    {notice ? <Toast tone="success">{notice}</Toast> : null}
    <div className="ui-card"><AccountingSectionContent section={initialSection} data={data} operate={capabilities.operate} done={done} /></div>
  </section>;
}
