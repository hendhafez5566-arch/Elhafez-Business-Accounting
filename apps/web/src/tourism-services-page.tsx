import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ActionBar, Badge, Button, Card, Checkbox, DataGrid, Dialog, EmptyState, ErrorState, FormField, Input, LoadingState, MetricCard, Select, Tabs, Textarea, Toast } from './ui.js';
import { advancedAccountingApi, type CurrencyConfiguration, type FxRateSnapshot } from './advanced-accounting-client.js';
import { tourismServicesApi, type DraftInput, type Fulfillment, type PrintableVoucher, type ServiceRecord, type ServiceRow, type ServiceType, type SupplyPlan, type SupplyRequest, type TourismCapabilities, type Voucher } from './tourism-services-client.js';
import { TourismPartyReferenceFields, TourismSupplierReferenceSelect } from './tourism-service-reference-fields.js';

const labels: Record<ServiceRow['status'], string> = {
  DRAFT: 'مسودة',
  CONFIRMING: 'جارٍ التأكيد',
  CONFIRMED: 'مؤكدة',
  CANCELLATION_REQUESTED: 'إلغاء قيد التسوية',
  CANCELLED: 'ملغاة',
  COMPLETED: 'منفذة',
};
const today = () => new Date().toISOString().slice(0, 10);
const queryParam = (name: string) => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
const scale = 10n ** 18n;

function decimalUnits(value: string) {
  const text = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return 0n;
  const negative = text.startsWith('-');
  const raw = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = raw.split('.');
  const result = BigInt(whole || '0') * scale + BigInt(fraction.slice(0, 18).padEnd(18, '0') || '0');
  return negative ? -result : result;
}
function decimalText(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(18, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
function multiplyDecimal(left: string, right: string) { return decimalText((decimalUnits(left) * decimalUnits(right)) / scale); }
function subtractDecimal(left: string, right: string) { return decimalText(decimalUnits(left) - decimalUnits(right)); }

const fresh = (currency = 'EGP', customerPartyId = ''): DraftInput => ({
  commandKey: crypto.randomUUID(),
  number: '',
  serviceTypeId: '',
  serviceDate: today(),
  quantity: '1',
  debtorKind: 'CUSTOMER',
  debtorPartyId: customerPartyId,
  customerPartyId,
  beneficiaryPartyIds: [],
  details: { travelerIds: [] },
  currency,
  grossAmount: '0',
  discountAmount: '0',
  invoiceNumber: '',
  postingDate: today(),
  dueDate: today(),
});
const editableDraft = (service: ServiceRecord): DraftInput => ({
  commandKey: crypto.randomUUID(),
  number: service.service.number,
  serviceTypeId: service.revision.serviceTypeId,
  serviceDate: service.revision.serviceDate,
  periodEnd: service.revision.periodEnd,
  quantity: service.revision.quantity,
  debtorKind: service.revision.debtorKind,
  debtorPartyId: service.revision.debtorPartyId,
  customerPartyId: service.revision.customerPartyId,
  beneficiaryPartyIds: [...service.revision.beneficiaryPartyIds],
  details: { ...service.revision.details },
  currency: service.revision.commercial.currency,
  grossAmount: service.revision.commercial.grossAmount,
  discountAmount: service.revision.commercial.discountAmount,
  invoiceNumber: service.revision.financialTerms.invoiceNumber,
  postingDate: service.revision.financialTerms.postingDate,
  dueDate: service.revision.financialTerms.dueDate,
  approvalRequestId: service.revision.financialTerms.approvalRequestId,
});
const initialRequest = (service: ServiceRecord): SupplyRequest => ({
  requestId: crypto.randomUUID(),
  contractId: '',
  resourceType: service.revision.category === 'FLIGHT' ? 'FLIGHT_BLOCK' : service.revision.category === 'OTHER' ? 'SERVICE' : service.revision.category,
  resourceId: '',
  serviceDate: service.revision.serviceDate,
  quantity: service.revision.quantity,
  unit: service.revision.category === 'HOTEL' ? 'ROOM' : 'UNIT',
  currency: service.revision.commercial.currency,
  unitCost: '0',
});

export function summarizeServices(rows: readonly ServiceRow[]) {
  return {
    all: rows.length,
    draft: rows.filter((row) => row.status === 'DRAFT').length,
    confirming: rows.filter((row) => row.status === 'CONFIRMING').length,
    confirmed: rows.filter((row) => row.status === 'CONFIRMED').length,
    cancellationRequested: rows.filter((row) => row.status === 'CANCELLATION_REQUESTED').length,
    cancelled: rows.filter((row) => row.status === 'CANCELLED').length,
    completed: rows.filter((row) => row.status === 'COMPLETED').length,
  };
}

function statusTone(status: ServiceRow['status']) {
  if (status === 'CONFIRMED' || status === 'COMPLETED') return 'success' as const;
  if (status === 'CANCELLED') return 'error' as const;
  if (status === 'CONFIRMING' || status === 'CANCELLATION_REQUESTED') return 'warning' as const;
  return 'info' as const;
}

function isServiceStatus(value: string): value is ServiceRow['status'] {
  return value === 'DRAFT' || value === 'CONFIRMING' || value === 'CONFIRMED' || value === 'CANCELLATION_REQUESTED' || value === 'CANCELLED' || value === 'COMPLETED';
}

type WorkspaceMode = 'new' | 'types' | 'service' | null;
type ServiceTab = 'summary' | 'sale' | 'supply' | 'fulfillment' | 'vouchers' | 'history';
const serviceTabs: readonly { id: ServiceTab; label: string }[] = [
  { id: 'summary', label: 'الملخص' },
  { id: 'sale', label: 'بيانات البيع' },
  { id: 'supply', label: 'الشراء والمورد' },
  { id: 'fulfillment', label: 'التنفيذ' },
  { id: 'vouchers', label: 'القسائم' },
  { id: 'history', label: 'السجل' },
];
function isServiceTab(value: string): value is ServiceTab { return serviceTabs.some((tab) => tab.id === value); }

function CurrencyField({ label, value, onChange, currencies, required = true }: { label: string; value: string; onChange: (value: string) => void; currencies: CurrencyConfiguration[]; required?: boolean }) {
  const active = currencies.filter((item) => item.status === 'ACTIVE');
  return <FormField label={label} required={required}>{active.length ? <Select required={required} value={value} onChange={(event) => onChange(event.target.value)}>{!value ? <option value="">اختر العملة</option> : null}{active.map((item) => <option key={item.code} value={item.code}>{item.code}{item.isBase ? ' — العملة الأساسية' : ''}</option>)}</Select> : <Input required={required} maxLength={3} value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} placeholder="EGP" />}</FormField>;
}

export function ServiceRecoveryActions({ service, capabilities, onConfirm, onCancel }: { service: ServiceRow; capabilities: TourismCapabilities; onConfirm: () => void; onCancel: () => void }) {
  return <>{capabilities.confirm && service.status === 'CONFIRMING' && <Button type="button" onClick={onConfirm}>استئناف تأكيد الخدمة</Button>}{capabilities.cancel && service.status === 'CANCELLATION_REQUESTED' && <Button type="button" onClick={onCancel}>إعادة فحص واستئناف الإلغاء</Button>}</>;
}

export function TourismServicesPage({ api = tourismServicesApi }: { api?: typeof tourismServicesApi } = {}) {
  const customerFromCrm = queryParam('customerPartyId');
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyConfiguration[]>([]);
  const [selected, setSelected] = useState<ServiceRecord | null>(null);
  const [form, setForm] = useState<DraftInput>(() => fresh('EGP', customerFromCrm));
  const [editForm, setEditForm] = useState<DraftInput | null>(null);
  const [typeForm, setTypeForm] = useState({ code: '', nameAr: '', category: 'OTHER' as ServiceType['category'] });
  const [request, setRequest] = useState<SupplyRequest | null>(null);
  const [quote, setQuote] = useState({ supplierId: '', unitCost: '', currency: 'EGP', quoteReference: '' });
  const [fxPreview, setFxPreview] = useState<FxRateSnapshot | null>(null);
  const [plan, setPlan] = useState<SupplyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cap, setCap] = useState<TourismCapabilities>({ view: false, manage: false, confirm: false, cancel: false, fulfill: false, voucher: false });
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [supplier, setSupplier] = useState({ quantity: '1', referenceType: 'BOOKING', reference: '', supplierId: '', internalCoverage: false });
  const [delivery, setDelivery] = useState({ quantity: '1', unit: 'UNIT', note: '' });
  const [voucherForm, setVoucherForm] = useState({ number: '', instructions: '' });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ServiceRow['status']>('ALL');
  const [sort, setSort] = useState<'NUMBER_ASC' | 'NUMBER_DESC' | 'STATUS'>('NUMBER_ASC');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(null);
  const [serviceTab, setServiceTab] = useState<ServiceTab>('summary');

  const activeCurrencies = useMemo(() => currencies.filter((item) => item.status === 'ACTIVE'), [currencies]);
  const baseCurrency = useMemo(() => activeCurrencies.find((item) => item.isBase)?.code ?? activeCurrencies[0]?.code ?? 'EGP', [activeCurrencies]);
  const summary = useMemo(() => summarizeServices(rows), [rows]);
  const visibleRows = useMemo(() => rows
    .filter((row) => (!query.trim() || row.number.toLocaleLowerCase('ar').includes(query.trim().toLocaleLowerCase('ar'))) && (statusFilter === 'ALL' || row.status === statusFilter))
    .sort((a, b) => sort === 'STATUS' ? a.status.localeCompare(b.status) : sort === 'NUMBER_DESC' ? b.number.localeCompare(a.number, undefined, { numeric: true }) : a.number.localeCompare(b.number, undefined, { numeric: true })), [rows, query, statusFilter, sort]);
  const purchaseTotal = useMemo(() => request ? multiplyDecimal(quote.unitCost || request.unitCost, request.quantity) : '0', [request, quote.unitCost]);
  const saleNet = selected ? subtractDecimal(selected.revision.commercial.grossAmount, selected.revision.commercial.discountAmount) : '0';
  const convertedPurchase = fxPreview ? multiplyDecimal(purchaseTotal, fxPreview.rate) : request && request.currency === selected?.revision.commercial.currency ? purchaseTotal : '';
  const expectedProfit = convertedPurchase ? subtractDecimal(saleNet, convertedPurchase) : '';

  async function reload() {
    setLoading(true);
    try {
      const [services, catalog, permissions, currencyResult] = await Promise.all([api.list(), api.types(), api.capabilities(), advancedAccountingApi.currencies().catch(() => [])]);
      setRows(services);
      setTypes(catalog);
      setCap(permissions);
      setCurrencies(currencyResult);
      const preferred = currencyResult.find((item) => item.status === 'ACTIVE' && item.isBase)?.code ?? currencyResult.find((item) => item.status === 'ACTIVE')?.code;
      if (preferred) setForm((current) => ({ ...current, currency: currencyResult.some((item) => item.code === current.currency && item.status === 'ACTIVE') ? current.currency : preferred, customerPartyId: customerFromCrm || current.customerPartyId, debtorPartyId: current.debtorKind === 'CUSTOMER' ? (customerFromCrm || current.customerPartyId) : current.debtorPartyId }));
      setError('');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'تعذر تحميل الخدمات');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void reload(); }, [api]);

  async function open(id: string, nextTab: ServiceTab = 'summary') {
    try {
      const record = await api.get(id);
      setSelected(record);
      setEditForm(record.service.status === 'DRAFT' ? editableDraft(record) : null);
      setPlan(null);
      const nextRequest = initialRequest(record);
      setRequest(nextRequest);
      setQuote({ supplierId: '', unitCost: '', currency: nextRequest.currency, quoteReference: '' });
      setFxPreview(null);
      if (record.service.status === 'CONFIRMED' || record.service.status === 'COMPLETED') {
        const [fulfillmentResult, voucherResult] = await Promise.all([api.fulfillment(id), api.vouchers(id)]);
        setFulfillment(fulfillmentResult);
        setVouchers(voucherResult);
      } else {
        setFulfillment(null);
        setVouchers([]);
      }
      setServiceTab(nextTab);
      setWorkspaceMode('service');
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذر فتح الخدمة');
    }
  }

  function startNew() {
    setSelected(null);
    setPlan(null);
    setForm(fresh(baseCurrency, customerFromCrm));
    setWorkspaceMode('new');
  }
  function openTypeSettings() {
    setSelected(null);
    setWorkspaceMode('types');
  }
  function closeWorkspace() {
    setWorkspaceMode(null);
    setSelected(null);
    setEditForm(null);
    setPlan(null);
    setFxPreview(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await api.create(form);
      setNotice('حُفظت المسودة. أضف سعر الشراء والمورد ثم راجع الربح قبل التأكيد.');
      setForm(fresh(baseCurrency, customerFromCrm));
      await reload();
      await open(created.id, 'supply');
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذر حفظ المسودة');
    }
  }
  async function updateDraft(event: FormEvent) {
    event.preventDefault();
    if (!selected || !editForm || selected.service.status !== 'DRAFT') return;
    try {
      await api.update(selected.service.id, { ...editForm, commandKey: crypto.randomUUID(), expectedRevision: selected.service.revision });
      setNotice('تم تعديل المسودة وحفظ نسخة مراجعة جديدة دون تغيير الحقيقة المالية خارج مالكها.');
      await open(selected.service.id, 'sale');
      await reload();
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذر تعديل المسودة');
    }
  }
  async function saveType(event: FormEvent) {
    event.preventDefault();
    try {
      await api.saveType({ ...typeForm, id: crypto.randomUUID(), active: true });
      setTypeForm({ code: '', nameAr: '', category: 'OTHER' });
      setNotice('تمت إضافة نوع الخدمة.');
      await reload();
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذر حفظ النوع');
    }
  }
  async function loadFx(live: boolean) {
    if (!selected || !request) return;
    const from = request.currency;
    const to = selected.revision.commercial.currency;
    if (from === to) {
      setFxPreview({ rateId: 'SAME_CURRENCY', companyId: '', fromCurrency: from, toCurrency: to, effectiveAt: new Date().toISOString(), rate: '1', source: 'SYSTEM' });
      return;
    }
    try {
      const result = live ? await advancedAccountingApi.refreshLiveRate({ fromCurrency: from, toCurrency: to }) : await advancedAccountingApi.resolveRate(from, to, new Date().toISOString());
      setFxPreview(result);
      setNotice(live ? 'تم تحديث سعر الصرف الحي وحفظه لدى وحدة العملات.' : 'تم استخدام سعر الصرف الساري من وحدة العملات.');
    } catch (value) {
      setFxPreview(null);
      setNotice(value instanceof Error ? value.message : 'تعذر جلب سعر الصرف');
    }
  }
  async function preview(event: FormEvent) {
    event.preventDefault();
    if (!selected || !request) return;
    try {
      const quoteInput = quote.supplierId && quote.quoteReference && quote.unitCost ? { externalQuotes: [{ requestId: request.requestId, supplierId: quote.supplierId, unitCost: quote.unitCost, currency: request.currency, quoteReference: quote.quoteReference }] } : {};
      const value = await api.plan(selected.service.id, { expectedRevision: selected.service.revision, requests: [request], ...quoteInput });
      setPlan(value);
      setNotice('راجع التغطية والتكلفة والجزء الخارجي قبل التأكيد.');
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذرت المعاينة');
    }
  }
  async function confirm() {
    if (!selected) return;
    const service = selected.service;
    const planId = service.status === 'CONFIRMING' ? service.supplyPlanId : plan?.planId;
    const planVersion = service.status === 'CONFIRMING' ? service.supplyPlanVersion : plan?.version;
    const commandKey = service.status === 'CONFIRMING' ? service.pendingCommandKey : planId ? `ts-confirm:${service.id}:${service.revision}:${planId}` : undefined;
    if (!planId || planVersion === undefined || !commandKey) return;
    try {
      await api.confirm(service.id, { commandKey, expectedRevision: service.revision, planId, planVersion });
      setNotice('تأكدت الخدمة بعد تخصيص المخزون وتنفيذ الآثار المالية وسعر الصرف المعتمد.');
      await open(service.id, 'summary');
      await reload();
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذر التأكيد؛ راجع الموانع وسعر الصرف');
      await open(service.id, 'summary');
    }
  }
  async function recordSupplier(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      await api.supplierConfirm(selected.service.id, { ...supplier, commandKey: crypto.randomUUID(), at: new Date().toISOString() });
      setNotice('حُفظ إثبات تأكيد المورد أو التغطية الداخلية.');
      await open(selected.service.id, 'fulfillment');
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذر حفظ التأكيد');
    }
  }
  async function recordDelivery(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      await api.deliver(selected.service.id, { ...delivery, commandKey: crypto.randomUUID(), at: new Date().toISOString() });
      setNotice('حُفظ دليل التسليم والكمية المنفذة.');
      await open(selected.service.id, 'fulfillment');
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذر حفظ التسليم');
    }
  }
  async function issue(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      await api.issueVoucher(selected.service.id, { ...voucherForm, commandKey: crypto.randomUUID() });
      setVoucherForm({ number: '', instructions: '' });
      setNotice('صدرت القسيمة بنسخة ثابتة.');
      await open(selected.service.id, 'vouchers');
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذر إصدار القسيمة');
    }
  }
  async function voidVoucher(id: string) {
    if (!selected) return;
    try {
      await api.voidVoucher(selected.service.id, id, { commandKey: crypto.randomUUID() });
      setNotice('أُبطلت القسيمة مع حفظ نسختها.');
      await open(selected.service.id, 'vouchers');
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذر إبطال القسيمة');
    }
  }
  function printSnapshot(snapshot: PrintableVoucher) {
    const popup = window.open('about:blank', '_blank');
    if (!popup) { setNotice('يرجى السماح بفتح نافذة الطباعة.'); return; }
    const doc = popup.document;
    doc.documentElement.lang = 'ar';
    doc.documentElement.dir = 'rtl';
    doc.title = `قسيمة ${snapshot.number}`;
    const style = doc.createElement('style');
    style.textContent = 'body{font-family:system-ui;margin:3rem;color:#17202a}h1{border-bottom:2px solid #123c53;padding-bottom:1rem}p{line-height:1.8}';
    doc.head.append(style);
    const heading = doc.createElement('h1');
    heading.textContent = `قسيمة خدمة ${snapshot.number} · نسخة ${snapshot.version}`;
    doc.body.append(heading);
    for (const [label, value] of [['الخدمة', snapshot.serviceNumber], ['النوع', snapshot.serviceType], ['التاريخ', snapshot.serviceDate], ['العميل', snapshot.customerPartyId], ['المستفيدون', snapshot.beneficiaryPartyIds.join('، ')], ['الكمية', snapshot.quantity], ['الوصف', snapshot.description], ['المورد', snapshot.supplierId ?? 'تغطية داخلية'], ['المرجع', snapshot.externalReference ?? ''], ['تعليمات', snapshot.instructions]]) {
      const line = doc.createElement('p');
      line.textContent = `${label}: ${value}`;
      doc.body.append(line);
    }
    popup.print();
  }
  async function cancel() {
    if (!selected) return;
    const service = selected.service;
    const commandKey = service.status === 'CANCELLATION_REQUESTED' ? service.pendingCommandKey : crypto.randomUUID();
    const postingDate = service.status === 'CANCELLATION_REQUESTED' ? service.cancellationPostingDate : today();
    if (!commandKey || !postingDate) return;
    try {
      await api.cancel(service.id, { commandKey, postingDate });
      setNotice('أُلغيت الخدمة بعد فحص موانع التنفيذ والماليات.');
      await open(service.id, 'summary');
      await reload();
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'تعذر الإلغاء');
      await open(service.id, 'summary');
    }
  }

  const filterTabs = [
    { id: 'ALL', label: `الكل ${summary.all}` },
    { id: 'DRAFT', label: `مسودات ${summary.draft}` },
    { id: 'CONFIRMING', label: `جارٍ التأكيد ${summary.confirming}` },
    { id: 'CONFIRMED', label: `مؤكدة ${summary.confirmed}` },
    { id: 'CANCELLATION_REQUESTED', label: `قيد الإلغاء ${summary.cancellationRequested}` },
    { id: 'CANCELLED', label: `ملغاة ${summary.cancelled}` },
    { id: 'COMPLETED', label: `منفذة ${summary.completed}` },
  ];

  function createServiceForm() {
    return <form onSubmit={save}>
      <div className="ui-dashboard-grid">
        <section>
          <h3>الخدمة والعميل</h3>
          <div className="ui-form-grid">
            <FormField label="رقم الخدمة" required><Input required value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} /></FormField>
            <FormField label="نوع الخدمة" required><Select required value={form.serviceTypeId} onChange={(event) => setForm({ ...form, serviceTypeId: event.target.value })}><option value="">اختر نوعًا</option>{types.filter((type) => type.active).map((type) => <option key={type.id} value={type.id}>{type.nameAr}</option>)}</Select></FormField>
            <FormField label="تاريخ الخدمة" required><Input required type="date" value={form.serviceDate} onChange={(event) => setForm({ ...form, serviceDate: event.target.value })} /></FormField>
            <FormField label="نهاية الفترة"><Input type="date" value={form.periodEnd ?? ''} onChange={(event) => setForm({ ...form, periodEnd: event.target.value || undefined })} /></FormField>
            <FormField label="الكمية" required><Input required inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></FormField>
          </div>
          <TourismPartyReferenceFields value={form} onChange={setForm} />
          <FormField label="وصف الخدمة"><Textarea value={String(form.details.description ?? '')} onChange={(event) => setForm({ ...form, details: { ...form.details, description: event.target.value } })} /></FormField>
        </section>
        <section>
          <h3>سعر البيع</h3>
          <div className="ui-form-grid">
            <CurrencyField label="عملة البيع" value={form.currency} onChange={(currency) => setForm({ ...form, currency })} currencies={currencies} />
            <FormField label="سعر البيع" required><Input required inputMode="decimal" value={form.grossAmount} onChange={(event) => setForm({ ...form, grossAmount: event.target.value })} /></FormField>
            <FormField label="الخصم"><Input required inputMode="decimal" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} /></FormField>
            <FormField label="رقم الفاتورة"><Input required value={form.invoiceNumber} onChange={(event) => setForm({ ...form, invoiceNumber: event.target.value })} /></FormField>
            <FormField label="تاريخ القيد"><Input required type="date" value={form.postingDate} onChange={(event) => setForm({ ...form, postingDate: event.target.value })} /></FormField>
            <FormField label="تاريخ الاستحقاق"><Input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></FormField>
          </div>
        </section>
      </div>
      <ActionBar><Button type="button" variant="secondary" onClick={closeWorkspace}>إلغاء</Button><Button type="submit">حفظ ومتابعة سعر الشراء</Button></ActionBar>
    </form>;
  }

  function serviceTypesForm() {
    return <form onSubmit={saveType}>
      <p>إعداد إداري لأنواع الخدمات. لا يغيّر ملكية أو منطق الخدمات الحالية.</p>
      <div className="ui-form-grid">
        <FormField label="الرمز"><Input required value={typeForm.code} onChange={(event) => setTypeForm({ ...typeForm, code: event.target.value })} /></FormField>
        <FormField label="الاسم"><Input required value={typeForm.nameAr} onChange={(event) => setTypeForm({ ...typeForm, nameAr: event.target.value })} /></FormField>
        <FormField label="الفئة"><Select value={typeForm.category} onChange={(event) => { if (event.target.value === 'HOTEL' || event.target.value === 'FLIGHT' || event.target.value === 'VISA' || event.target.value === 'TRANSPORT' || event.target.value === 'OTHER') setTypeForm({ ...typeForm, category: event.target.value }); }}>{(['HOTEL', 'FLIGHT', 'VISA', 'TRANSPORT', 'OTHER'] as const).map((category) => <option key={category} value={category}>{category}</option>)}</Select></FormField>
      </div>
      <ActionBar><Button type="button" variant="secondary" onClick={closeWorkspace}>إغلاق</Button><Button type="submit">إضافة نوع</Button></ActionBar>
    </form>;
  }

  function summaryPanel(service: ServiceRecord) {
    const row = service.service;
    const revision = service.revision;
    return <section className="ui-dashboard">
      <div className="ui-metric-grid">
        <MetricCard label="الحالة" value={labels[row.status]} detail={`نسخة ${row.revision}`} tone={statusTone(row.status)} />
        <MetricCard label="صافي البيع" value={`${revision.commercial.netAmount} ${revision.commercial.currency}`} />
        <MetricCard label="الكمية" value={revision.quantity} detail={revision.category} />
        <MetricCard label="تاريخ الخدمة" value={revision.serviceDate} detail={revision.periodEnd ? `حتى ${revision.periodEnd}` : undefined} />
      </div>
      <dl className="ui-definition-list">
        <div><dt>رقم الخدمة</dt><dd>{row.number}</dd></div>
        <div><dt>العميل</dt><dd>{revision.customerPartyId || '—'}</dd></div>
        <div><dt>المدين</dt><dd>{revision.debtorPartyId || '—'}</dd></div>
        <div><dt>المستفيدون</dt><dd>{revision.beneficiaryPartyIds.length || '—'}</dd></div>
        <div><dt>الوصف</dt><dd>{String(revision.details.description ?? '—')}</dd></div>
      </dl>
      <ActionBar>
        {cap.manage && row.status === 'DRAFT' ? <Button type="button" variant="secondary" onClick={() => setServiceTab('sale')}>تعديل بيانات البيع</Button> : null}
        {cap.confirm && row.status === 'DRAFT' ? <Button type="button" onClick={() => setServiceTab('supply')}>إضافة المورد وسعر الشراء</Button> : null}
        <ServiceRecoveryActions service={row} capabilities={cap} onConfirm={() => void confirm()} onCancel={() => void cancel()} />
        {cap.cancel && row.status === 'CONFIRMED' ? <Button type="button" variant="danger" onClick={() => void cancel()}>فحص وإلغاء الخدمة</Button> : null}
      </ActionBar>
    </section>;
  }

  function salePanel(service: ServiceRecord) {
    if (cap.manage && service.service.status === 'DRAFT' && editForm) return <form onSubmit={updateDraft}>
      <div className="ui-form-grid">
        <FormField label="نوع الخدمة" required><Select required value={editForm.serviceTypeId} onChange={(event) => setEditForm({ ...editForm, serviceTypeId: event.target.value })}><option value="">اختر نوعًا</option>{types.filter((type) => type.active).map((type) => <option key={type.id} value={type.id}>{type.nameAr}</option>)}</Select></FormField>
        <FormField label="تاريخ الخدمة" required><Input required type="date" value={editForm.serviceDate} onChange={(event) => setEditForm({ ...editForm, serviceDate: event.target.value })} /></FormField>
        <FormField label="نهاية الفترة"><Input type="date" value={editForm.periodEnd ?? ''} onChange={(event) => setEditForm({ ...editForm, periodEnd: event.target.value || undefined })} /></FormField>
        <FormField label="الكمية" required><Input required inputMode="decimal" value={editForm.quantity} onChange={(event) => setEditForm({ ...editForm, quantity: event.target.value })} /></FormField>
      </div>
      <TourismPartyReferenceFields value={editForm} onChange={setEditForm} />
      <FormField label="وصف الخدمة"><Textarea value={String(editForm.details.description ?? '')} onChange={(event) => setEditForm({ ...editForm, details: { ...editForm.details, description: event.target.value } })} /></FormField>
      <div className="ui-form-grid">
        <CurrencyField label="عملة البيع" value={editForm.currency} onChange={(currency) => setEditForm({ ...editForm, currency })} currencies={currencies} />
        <FormField label="سعر البيع"><Input required inputMode="decimal" value={editForm.grossAmount} onChange={(event) => setEditForm({ ...editForm, grossAmount: event.target.value })} /></FormField>
        <FormField label="الخصم"><Input required inputMode="decimal" value={editForm.discountAmount} onChange={(event) => setEditForm({ ...editForm, discountAmount: event.target.value })} /></FormField>
        <FormField label="رقم الفاتورة"><Input required value={editForm.invoiceNumber} onChange={(event) => setEditForm({ ...editForm, invoiceNumber: event.target.value })} /></FormField>
        <FormField label="تاريخ القيد"><Input required type="date" value={editForm.postingDate} onChange={(event) => setEditForm({ ...editForm, postingDate: event.target.value })} /></FormField>
        <FormField label="تاريخ الاستحقاق"><Input required type="date" value={editForm.dueDate} onChange={(event) => setEditForm({ ...editForm, dueDate: event.target.value })} /></FormField>
      </div>
      <ActionBar><Button type="submit">حفظ التعديل</Button></ActionBar>
    </form>;
    return <dl className="ui-definition-list">
      <div><dt>إجمالي البيع</dt><dd>{service.revision.commercial.grossAmount} {service.revision.commercial.currency}</dd></div>
      <div><dt>الخصم</dt><dd>{service.revision.commercial.discountAmount} {service.revision.commercial.currency}</dd></div>
      <div><dt>صافي البيع</dt><dd>{service.revision.commercial.netAmount} {service.revision.commercial.currency}</dd></div>
      <div><dt>رقم الفاتورة</dt><dd>{service.revision.financialTerms.invoiceNumber || '—'}</dd></div>
      <div><dt>تاريخ القيد</dt><dd>{service.revision.financialTerms.postingDate}</dd></div>
      <div><dt>تاريخ الاستحقاق</dt><dd>{service.revision.financialTerms.dueDate}</dd></div>
    </dl>;
  }

  function supplyPanel(service: ServiceRecord) {
    if (!cap.confirm || service.service.status !== 'DRAFT' || !request) return <EmptyState title="لا توجد خطوة شراء متاحة"><p>إضافة المورد وسعر الشراء وخطة التوريد متاحة للمسودة المصرح بتأكيدها.</p></EmptyState>;
    return <section className="ui-dashboard">
      <form onSubmit={preview}>
        <p>سعر الشراء يمكن أن يكون بعملة مختلفة عن البيع. سعر الصرف المستخدم يأتي فقط من وحدة العملات.</p>
        <div className="ui-dashboard-grid">
          <section>
            <h3>المورد وسعر الشراء</h3>
            <div className="ui-form-grid">
              <FormField label="المورد"><TourismSupplierReferenceSelect value={quote.supplierId} onChange={(supplierId) => setQuote({ ...quote, supplierId })} allowBlank={false} /></FormField>
              <CurrencyField label="عملة الشراء" value={request.currency} onChange={(currency) => { setRequest({ ...request, currency }); setQuote({ ...quote, currency }); setFxPreview(null); }} currencies={currencies} />
              <FormField label="سعر شراء الوحدة" required><Input required inputMode="decimal" value={quote.unitCost} onChange={(event) => { setQuote({ ...quote, unitCost: event.target.value }); setFxPreview(null); }} /></FormField>
              <FormField label="مرجع عرض المورد" required><Input required value={quote.quoteReference} onChange={(event) => setQuote({ ...quote, quoteReference: event.target.value })} /></FormField>
            </div>
          </section>
          <section>
            <h3>التغطية الداخلية — اختياري</h3>
            <div className="ui-form-grid">
              <FormField label="عقد مخزون داخلي"><Input value={request.contractId} onChange={(event) => setRequest({ ...request, contractId: event.target.value })} /></FormField>
              <FormField label="مرجع المخزون"><Input value={request.resourceId} onChange={(event) => setRequest({ ...request, resourceId: event.target.value })} /></FormField>
              <FormField label="وحدة القياس"><Input required value={request.unit} onChange={(event) => setRequest({ ...request, unit: event.target.value })} /></FormField>
              <FormField label="تكلفة الوحدة بالعقد الداخلي"><Input inputMode="decimal" value={request.unitCost} onChange={(event) => setRequest({ ...request, unitCost: event.target.value })} /></FormField>
            </div>
          </section>
        </div>
        <div className="ui-metric-grid">
          <MetricCard label="إجمالي الشراء" value={`${purchaseTotal} ${request.currency}`} />
          <MetricCard label="صافي البيع" value={`${saleNet} ${service.revision.commercial.currency}`} />
          <MetricCard label="سعر الصرف" value={request.currency === service.revision.commercial.currency ? '1' : fxPreview?.rate ?? '—'} detail={fxPreview?.source} />
          <MetricCard label="تكلفة الشراء بعملة البيع" value={convertedPurchase ? `${convertedPurchase} ${service.revision.commercial.currency}` : '—'} />
          <MetricCard label="الربح المتوقع" value={expectedProfit ? `${expectedProfit} ${service.revision.commercial.currency}` : '—'} tone={expectedProfit && decimalUnits(expectedProfit) >= 0n ? 'success' : 'warning'} />
        </div>
        <ActionBar><Button type="button" variant="secondary" onClick={() => void loadFx(false)}>استخدام سعر الصرف المسجل</Button><Button type="button" variant="secondary" onClick={() => void loadFx(true)}>تحديث سعر حي</Button><Button type="submit">معاينة خطة التوريد</Button></ActionBar>
      </form>
      {plan ? <section>
        <h3>خطة التوريد للمراجعة</h3>
        <p>صالحة حتى {new Date(plan.expiresAt).toLocaleString('ar-EG')}</p>
        <DataGrid columns={['المخزون', 'الكمية', 'التكلفة']}>{plan.lines.map((line, index) => <tr key={`${line.resourceId}:${index}`}><td>{line.resourceId}</td><td>{line.allocationQuantity}</td><td>{line.costAmount} {line.currency}</td></tr>)}</DataGrid>
        {plan.residuals.map((line, index) => <p key={`${line.quantity}:${index}`}>شراء خارجي: {line.quantity} · {line.supplierId ?? 'مورد غير محدد'} · {line.costAmount ?? 'دون تسعير'} {line.currency}</p>)}
        <p>عند التأكيد تُحوّل التكلفة محاسبيًا إلى عملة البيع بسعر الصرف المسجل وتحفظ أدلة التحويل في اللقطة المالية.</p>
        <ActionBar><Button type="button" onClick={() => void confirm()}>تأكيد الخدمة والخطة المراجعة</Button></ActionBar>
      </section> : null}
    </section>;
  }

  function fulfillmentPanel(service: ServiceRecord) {
    const status = service.service.status;
    if (status !== 'CONFIRMED' && status !== 'COMPLETED') return <EmptyState title="التنفيذ لم يبدأ بعد"><p>تظهر متابعة المورد والتسليم بعد تأكيد الخدمة.</p></EmptyState>;
    return <section className="ui-dashboard">
      <div className="ui-metric-grid">
        <MetricCard label="الكمية المطلوبة" value={service.revision.quantity} />
        <MetricCard label="المؤكد" value={fulfillment?.case.confirmedQuantity ?? '0'} />
        <MetricCard label="المنفذ" value={fulfillment?.case.deliveredQuantity ?? '0'} />
      </div>
      {cap.fulfill && status === 'CONFIRMED' ? <>
        <form onSubmit={recordSupplier}>
          <h3>تأكيد المورد أو التغطية</h3>
          <div className="ui-form-grid">
            <FormField label="الكمية المؤكدة"><Input required value={supplier.quantity} onChange={(event) => setSupplier({ ...supplier, quantity: event.target.value })} /></FormField>
            <FormField label="المورد الخارجي"><TourismSupplierReferenceSelect value={supplier.supplierId} onChange={(supplierId) => setSupplier({ ...supplier, supplierId })} /></FormField>
            <FormField label="نوع المرجع"><Input required value={supplier.referenceType} onChange={(event) => setSupplier({ ...supplier, referenceType: event.target.value })} /></FormField>
            <FormField label="مرجع الحجز لدى المورد"><Input required value={supplier.reference} onChange={(event) => setSupplier({ ...supplier, reference: event.target.value })} /></FormField>
          </div>
          <label className="ui-checkbox-field"><Checkbox checked={supplier.internalCoverage} onChange={(event) => setSupplier({ ...supplier, internalCoverage: event.target.checked, supplierId: event.target.checked ? '' : supplier.supplierId })} /><span>تغطية من مخزون داخلي</span></label>
          <ActionBar><Button type="submit">تسجيل التأكيد</Button></ActionBar>
        </form>
        <form onSubmit={recordDelivery}>
          <h3>تسجيل التسليم</h3>
          <div className="ui-form-grid">
            <FormField label="كمية التسليم"><Input required value={delivery.quantity} onChange={(event) => setDelivery({ ...delivery, quantity: event.target.value })} /></FormField>
            <FormField label="الوحدة"><Input required value={delivery.unit} onChange={(event) => setDelivery({ ...delivery, unit: event.target.value })} /></FormField>
          </div>
          <FormField label="دليل التسليم"><Textarea required value={delivery.note} onChange={(event) => setDelivery({ ...delivery, note: event.target.value })} /></FormField>
          <ActionBar><Button type="submit">تسجيل تسليم جزئي أو كامل</Button></ActionBar>
        </form>
      </> : null}
      {fulfillment?.confirmations.length ? <section><h3>تأكيدات المورد</h3>{fulfillment.confirmations.map((item, index) => <div className="ui-record-card" key={`${item.reference}:${index}`}><strong>{item.reference}</strong><p>{item.supplierId ?? 'تغطية داخلية'} · {item.quantity}</p></div>)}</section> : null}
      {fulfillment?.deliveries.length ? <section><h3>التسليمات</h3>{fulfillment.deliveries.map((item, index) => <div className="ui-record-card" key={`${item.at}:${index}`}><strong>{item.quantity}</strong><p>{new Date(item.at).toLocaleString('ar-EG')} · {item.note}</p></div>)}</section> : null}
    </section>;
  }

  function vouchersPanel(service: ServiceRecord) {
    const status = service.service.status;
    if (status !== 'CONFIRMED' && status !== 'COMPLETED') return <EmptyState title="لا توجد قسائم متاحة"><p>القسائم مرتبطة بالخدمات المؤكدة والمنفذة.</p></EmptyState>;
    return <section className="ui-dashboard">
      {cap.voucher && status === 'CONFIRMED' ? <form onSubmit={issue}>
        <h3>إصدار قسيمة</h3>
        <div className="ui-form-grid">
          <FormField label="رقم القسيمة"><Input required value={voucherForm.number} onChange={(event) => setVoucherForm({ ...voucherForm, number: event.target.value })} /></FormField>
          <FormField label="تعليمات للعميل"><Textarea value={voucherForm.instructions} onChange={(event) => setVoucherForm({ ...voucherForm, instructions: event.target.value })} /></FormField>
        </div>
        <ActionBar><Button type="submit">إصدار نسخة</Button></ActionBar>
      </form> : null}
      {vouchers.length ? vouchers.map((voucher) => <div className="ui-record-card" key={voucher.id}>
        <strong>{voucher.number}</strong>
        <p>{voucher.status === 'ISSUED' ? 'سارية' : 'ملغاة'} · نسخة {voucher.version}</p>
        {voucher.status === 'ISSUED' ? <ActionBar><Button type="button" variant="secondary" onClick={() => void api.printable(service.service.id, voucher.id).then(printSnapshot).catch((value) => setNotice(value instanceof Error ? value.message : 'تعذرت الطباعة'))}>طباعة</Button>{cap.voucher && status === 'CONFIRMED' ? <Button type="button" variant="danger" onClick={() => void voidVoucher(voucher.id)}>إبطال</Button> : null}</ActionBar> : null}
      </div>) : <EmptyState title="لا توجد قسائم بعد" />}
    </section>;
  }

  function historyPanel(service: ServiceRecord) {
    return service.history.length ? <section className="ui-dashboard">{service.history.map((entry) => <div className="ui-record-card" key={`${entry.kind}:${entry.createdAt}`}><strong>{entry.kind}</strong><p>{new Date(entry.createdAt).toLocaleString('ar-EG')} · {entry.actorId}</p></div>)}</section> : <EmptyState title="لا يوجد سجل بعد" />;
  }

  function serviceWorkspace(service: ServiceRecord) {
    let content;
    if (serviceTab === 'summary') content = summaryPanel(service);
    else if (serviceTab === 'sale') content = salePanel(service);
    else if (serviceTab === 'supply') content = supplyPanel(service);
    else if (serviceTab === 'fulfillment') content = fulfillmentPanel(service);
    else if (serviceTab === 'vouchers') content = vouchersPanel(service);
    else content = historyPanel(service);
    return <section className="ui-dashboard">
      <div className="ui-inline"><Badge tone={statusTone(service.service.status)}>{labels[service.service.status]}</Badge><strong>{service.service.number}</strong><span>نسخة {service.service.revision}</span></div>
      <Tabs tabs={serviceTabs} active={serviceTab} onChange={(id) => { if (isServiceTab(id)) setServiceTab(id); }} />
      {content}
    </section>;
  }

  const dialogTitle = workspaceMode === 'new' ? 'خدمة جديدة' : workspaceMode === 'types' ? 'إعداد أنواع الخدمات' : selected ? `ملف ${selected.service.number}` : 'ملف الخدمة';

  return <section aria-label="السياحة والخدمات" className="ui-dashboard">
    <Card title="الخدمات السياحية المستقلة">
      <p>إدارة الخدمة من البيع وحتى المورد والتوريد والتنفيذ والقسيمة في مسار واحد، مع بقاء كل حقيقة مالية وتشغيلية لدى مالكها الحالي.</p>
      {customerFromCrm ? <Badge tone="info">العميل محدد من ملف العميل</Badge> : null}
      <ActionBar>{cap.manage ? <><Button type="button" onClick={startNew}>خدمة جديدة</Button><Button type="button" variant="secondary" onClick={openTypeSettings}>أنواع الخدمات</Button></> : null}</ActionBar>
    </Card>

    <div className="ui-metric-grid" aria-label="مؤشرات الخدمات السياحية">
      <MetricCard label="إجمالي الخدمات" value={summary.all} />
      <MetricCard label="مسودات" value={summary.draft} tone="info" />
      <MetricCard label="مؤكدة" value={summary.confirmed} tone="success" />
      <MetricCard label="منفذة" value={summary.completed} tone="success" />
    </div>

    <Card title="بحث وفرز الخدمات">
      <div className="ui-filter-grid">
        <FormField label="بحث بالرقم"><Input aria-label="بحث الخدمات" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="رقم الخدمة" /></FormField>
        <FormField label="الحالة"><Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value === 'ALL' || isServiceStatus(event.target.value) ? event.target.value : 'ALL')}><option value="ALL">كل الحالات</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FormField>
        <FormField label="الترتيب"><Select value={sort} onChange={(event) => { const value = event.target.value; if (value === 'NUMBER_ASC' || value === 'NUMBER_DESC' || value === 'STATUS') setSort(value); }}><option value="NUMBER_ASC">الرقم تصاعديًا</option><option value="NUMBER_DESC">الرقم تنازليًا</option><option value="STATUS">الحالة</option></Select></FormField>
      </div>
      <Tabs tabs={filterTabs} active={statusFilter} onChange={(id) => setStatusFilter(id === 'ALL' || isServiceStatus(id) ? id : 'ALL')} />
    </Card>

    {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void reload()} /> : <section aria-label="ملفات الخدمات">
      <p className="ui-results-count">{visibleRows.length} من {rows.length} خدمة</p>
      {visibleRows.length ? <div className="ui-grid-md">{visibleRows.map((row) => <Card key={row.id} title={row.number}>
        <div className="ui-inline"><Badge tone={statusTone(row.status)}>{labels[row.status]}</Badge><span>نسخة {row.revision}</span></div>
        <ActionBar><Button type="button" onClick={() => void open(row.id)}>فتح الملف</Button></ActionBar>
      </Card>)}</div> : <EmptyState title={rows.length ? 'لا توجد نتائج مطابقة' : 'لا توجد خدمات بعد'}><p>{rows.length ? 'غيّر البحث أو الفلتر.' : 'ابدأ بإضافة خدمة جديدة.'}</p></EmptyState>}
    </section>}

    <Dialog open={workspaceMode !== null} title={dialogTitle} onClose={closeWorkspace}>
      {workspaceMode === 'new' ? createServiceForm() : workspaceMode === 'types' ? serviceTypesForm() : workspaceMode === 'service' && selected ? serviceWorkspace(selected) : null}
    </Dialog>
    {notice ? <Toast>{notice}</Toast> : null}
  </section>;
}
