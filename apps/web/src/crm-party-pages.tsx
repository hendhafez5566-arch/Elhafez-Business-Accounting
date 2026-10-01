import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Textarea } from './ui.js';
import { crmDelete, crmGet, crmPatch, crmPost } from './crm-core-client.js';
import './pages/crm-customers/customers.css';

type PartyKind = 'PERSON' | 'ORGANIZATION';
type Party = { id: string; kind: PartyKind; displayName: string; legalName: string | null; phone: string | null; email: string | null; whatsappNumber: string | null; address: string | null; nationalIdentity: string | null; taxIdentity: string | null };
type Customer = { id: string; number: string; status: 'ACTIVE' | 'SUSPENDED'; assignedAgentId: string | null; commercialNotes: string | null };
type CustomerView = { customer: Customer; party: Party };
type CustomerWorkspaceView = CustomerView & { financialSummaryByCurrency: Array<{ currency: string; documentTotal: string; outstanding: string }>; openPositionCount: number; overduePositionCount: number; hasOutstanding: boolean };
type AgentView = { agent: { id: string; number: string; status: 'ACTIVE' | 'SUSPENDED' }; party: { displayName: string } };
type DuplicateCandidate = { party: Party; evidence: string[] };
type CustomerCreateResult = { status: 'CREATED' | 'EXISTING' | 'EXISTING_SUSPENDED' | 'REVIEW_REQUIRED'; value?: CustomerView; candidates?: DuplicateCandidate[] };
type FinancialPosition = { invoiceId: string; number: string; postingDate: string; dueDate: string | null; currency: string; documentTotal: string; outstanding: string; status: string; overdue: boolean; sourceType: string; sourceId: string };
type Lead = { id: string; number: string; displayName: string; phone: string | null; source: string; requestedService: string | null; expectedValue: string | null; currency: string | null; status: string; lostReason: string | null };
type Followup = { id: string; leadId: string; interactionType: string; scheduledAt: string; status: string; outcome: string | null; nextAction: string | null };
type Quote = { id: string; number: string; status: string; approvalStatus: string; currency: string; customerId: string | null; sourceLeadId: string | null; customerSnapshot: { displayName: string }; currentRevisionId: string; acceptedRevisionId: string | null; billingInvoiceId: string | null; revisions: Array<{ id: string; validityDate: string; total: string }> };
type Traveler = { id: string; fullName: string; dateOfBirth: string | null; gender: string | null; nationality: string | null; customerId: string | null; status: 'ACTIVE' | 'ARCHIVED' };
type Customer360 = { customer: CustomerView; leads: Lead[]; followups: Followup[]; quotations: Quote[]; travelers: Traveler[]; financialPositions: FinancialPosition[]; financialSummaryByCurrency: Array<{ currency: string; documentTotal: string; outstanding: string }>; overdueFinancialPositions: FinancialPosition[]; quotationLinkedFinancialPositions: Array<{ invoiceId: string; currency: string; documentTotal: string; outstanding: string; status: string }>; quotationLinkedFinancialSummaryByCurrency: Array<{ currency: string; documentTotal: string; outstanding: string }> };
type StoredFile = { id: string; size: number; contentType: string };
type EntityFileLink = { id: string; fileId: string; label: string | null; createdAt: string; file: StoredFile };
type CustomerForm = { kind: PartyKind; name: string; legalName: string; phone: string; whatsappNumber: string; email: string; address: string; nationalIdentity: string; taxIdentity: string; assignedAgentId: string; notes: string };
type ProfileTab = 'summary' | 'finance' | 'operations' | 'activity' | 'statement';
type QuickFilter = 'ALL' | 'OUTSTANDING' | 'OVERDUE' | 'SUSPENDED';

const emptyForm = (): CustomerForm => ({ kind: 'PERSON', name: '', legalName: '', phone: '', whatsappNumber: '', email: '', address: '', nationalIdentity: '', taxIdentity: '', assignedAgentId: '', notes: '' });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
const openPath = (path: string) => { window.location.href = path; };
const phoneDigits = (value: string | null) => (value ?? '').replace(/[^0-9]/g, '');
const whatsappUrl = (value: string | null) => { const digits = phoneDigits(value); if (!digits) return ''; return `https://wa.me/${digits.startsWith('0') ? `2${digits}` : digits}`; };
const kindLabel = (kind: PartyKind) => kind === 'ORGANIZATION' ? 'شركة' : 'فردي';
const customerCode = (value: CustomerView) => value.customer.number || value.customer.id;
const quoteTotal = (quote: Quote) => quote.revisions.find(item => item.id === (quote.acceptedRevisionId ?? quote.currentRevisionId))?.total ?? '0';

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    crmGet<T>(path).then(value => { if (alive) { setData(value); setError(''); } }).catch(value => { if (alive) setError(errorMessage(value)); });
    return () => { alive = false; };
  }, [path, version]);
  return { data, error, reload: () => setVersion(value => value + 1) };
}

function financialText(value: CustomerWorkspaceView | undefined) {
  if (!value?.financialSummaryByCurrency.length) return 'مسدد';
  const open = value.financialSummaryByCurrency.filter(item => item.outstanding !== '0');
  return open.length ? open.map(item => `${item.outstanding} ${item.currency}`).join(' · ') : 'مسدد';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="ct-field"><label className="ct-label">{label}</label>{children}</div>;
}
function TemplateBadge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`ct-bd ${className}`}>{children}</span>;
}
function Kv({ label, value }: { label: string; value: ReactNode }) {
  return <div className="ct-kv"><small>{label}</small><span>{value || '—'}</span></div>;
}

export function CustomersPage() {
  const customers = useLoad<CustomerView[]>('/crm/customers');
  const agents = useLoad<AgentView[]>('/crm/agents?status=ACTIVE');
  const financial = useLoad<CustomerWorkspaceView[]>('/crm/insights/customers');
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'ALL' | PartyKind>('ALL');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
  const [panel, setPanel] = useState<'form' | 'profile' | null>(null);
  const [editing, setEditing] = useState<CustomerView | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [profile, setProfile] = useState<CustomerView | null>(null);
  const [profileData, setProfileData] = useState<Customer360 | null>(null);
  const [profileFiles, setProfileFiles] = useState<EntityFileLink[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>('summary');
  const [modal, setModal] = useState<'actions' | 'manage' | null>(null);
  const [modalCustomer, setModalCustomer] = useState<CustomerView | null>(null);
  const [notice, setNotice] = useState('');

  const financialByCustomer = useMemo(() => new Map((financial.data ?? []).map(value => [value.customer.id, value])), [financial.data]);
  const totals = useMemo(() => {
    const all = customers.data ?? [];
    const workspaces = financial.data ?? [];
    return { total: all.length, active: all.filter(value => value.customer.status === 'ACTIVE').length, outstanding: workspaces.filter(value => value.hasOutstanding).length, overdue: workspaces.filter(value => value.overduePositionCount > 0).length, suspended: all.filter(value => value.customer.status === 'SUSPENDED').length };
  }, [customers.data, financial.data]);
  const visibleCustomers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ar');
    return (customers.data ?? []).filter(value => {
      const money = financialByCustomer.get(value.customer.id);
      const haystack = [value.party.displayName, value.party.legalName, value.customer.number, value.party.phone, value.party.whatsappNumber, value.party.email, value.party.nationalIdentity, value.party.taxIdentity].filter(Boolean).join(' ').toLocaleLowerCase('ar');
      if (needle && !haystack.includes(needle)) return false;
      if (kindFilter !== 'ALL' && value.party.kind !== kindFilter) return false;
      if (quickFilter === 'OUTSTANDING' && !money?.hasOutstanding) return false;
      if (quickFilter === 'OVERDUE' && !(money?.overduePositionCount ?? 0)) return false;
      if (quickFilter === 'SUSPENDED' && value.customer.status !== 'SUSPENDED') return false;
      return true;
    }).sort((a, b) => a.party.displayName.localeCompare(b.party.displayName, 'ar'));
  }, [customers.data, financialByCustomer, query, kindFilter, quickFilter]);

  function reload() { customers.reload(); financial.reload(); }
  function closeAll() { setPanel(null); setModal(null); }
  function startCreate() { setEditing(null); setForm(emptyForm()); setPanel('form'); setModal(null); }
  function startEdit(value: CustomerView) {
    setEditing(value);
    setForm({ kind: value.party.kind, name: value.party.displayName, legalName: value.party.legalName ?? '', phone: value.party.phone ?? '', whatsappNumber: value.party.whatsappNumber ?? '', email: value.party.email ?? '', address: value.party.address ?? '', nationalIdentity: value.party.nationalIdentity ?? '', taxIdentity: value.party.taxIdentity ?? '', assignedAgentId: value.customer.assignedAgentId ?? '', notes: value.customer.commercialNotes ?? '' });
    setPanel('form'); setModal(null);
  }
  async function openProfile(value: CustomerView) {
    setProfile(value); setProfileData(null); setProfileFiles([]); setProfileTab('summary'); setPanel('profile'); setModal(null); setProfileLoading(true);
    try {
      const [insight, files] = await Promise.all([crmGet<Customer360>(`/crm/insights/customers/${encodeURIComponent(value.customer.id)}`), crmGet<EntityFileLink[]>(`/crm/customers/${encodeURIComponent(value.customer.id)}/files`).catch(() => [])]);
      setProfileData(insight); setProfileFiles(files);
    } catch (error) { setNotice(errorMessage(error)); } finally { setProfileLoading(false); }
  }
  function accountingAction(action: 'receipt' | 'invoice' | 'advance-refund', value: CustomerView) { openPath(`/crm/financial-action?action=${action}&partyKind=CUSTOMER&partyId=${encodeURIComponent(value.party.id)}`); }
  function newService(value: CustomerView) { openPath(`/tourism/services?customerPartyId=${encodeURIComponent(value.party.id)}`); }
  function quote(value: CustomerView) { openPath(`/crm/quotations?customerId=${encodeURIComponent(value.customer.id)}`); }
  function documents(value: CustomerView) { openPath(`/crm/customer-documents?customerId=${encodeURIComponent(value.customer.id)}`); }
  function openWhatsapp(value: CustomerView) { const url = whatsappUrl(value.party.whatsappNumber ?? value.party.phone); if (url) window.open(url, '_blank', 'noopener,noreferrer'); }

  async function save(event: FormEvent) {
    event.preventDefault(); setNotice('');
    const cleanPhone = phoneDigits(form.phone); const cleanWhatsapp = phoneDigits(form.whatsappNumber);
    if (!form.name.trim()) { setNotice('اكتب اسم العميل.'); return; }
    if (!cleanPhone && !cleanWhatsapp) { setNotice('اكتب الهاتف أو الواتساب.'); return; }
    const egyptPhone = /^01[0125]\d{8}$/;
    if (cleanPhone && !egyptPhone.test(cleanPhone)) { setNotice('الهاتف يجب أن يكون 11 رقمًا ويبدأ بـ 01.'); return; }
    if (cleanWhatsapp && !egyptPhone.test(cleanWhatsapp)) { setNotice('رقم واتساب يجب أن يكون 11 رقمًا ويبدأ بـ 01.'); return; }
    if (form.nationalIdentity && !/^\d{14}$/.test(form.nationalIdentity)) { setNotice('الرقم القومي يجب أن يكون 14 رقمًا.'); return; }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) { setNotice('البريد الإلكتروني غير صحيح.'); return; }
    const party = { kind: form.kind, displayName: form.name.trim(), ...(form.legalName.trim() && { legalName: form.legalName.trim() }), ...(cleanPhone && { phone: cleanPhone }), ...(cleanWhatsapp && { whatsappNumber: cleanWhatsapp }), ...(form.email.trim() && { email: form.email.trim() }), ...(form.address.trim() && { address: form.address.trim() }), ...(form.nationalIdentity.trim() && { nationalIdentity: form.nationalIdentity.trim() }), ...(form.taxIdentity.trim() && { taxIdentity: form.taxIdentity.trim() }) };
    const body = { party, assignedAgentId: form.assignedAgentId || null, commercialNotes: form.notes.trim() };
    try {
      if (editing) { await crmPatch(`/crm/customers/${editing.customer.id}`, body); setNotice('تم حفظ تعديلات العميل.'); }
      else {
        const result = await crmPost<CustomerCreateResult>('/crm/customers', body);
        if (result.status === 'REVIEW_REQUIRED') { const names = result.candidates?.map(candidate => `${candidate.party.displayName} (${candidate.evidence.join('، ')})`).join(' — '); setNotice(`يوجد تطابق محتمل ويجب مراجعته قبل إنشاء سجل جديد${names ? `: ${names}` : ''}.`); return; }
        setNotice(result.status === 'EXISTING' ? 'تم ربط البيانات بسجل العميل الموجود دون إنشاء تكرار.' : result.status === 'EXISTING_SUSPENDED' ? 'العميل موجود لكنه موقوف؛ لم يتم إنشاء نسخة مكررة.' : 'تمت إضافة العميل بنجاح.');
      }
      setPanel(null); setEditing(null); setForm(emptyForm()); reload();
    } catch (error) { setNotice(errorMessage(error)); }
  }
  async function lifecycle(value: CustomerView) {
    const action = value.customer.status === 'ACTIVE' ? 'suspend' : 'reactivate';
    try { await crmPost(`/crm/customers/${value.customer.id}/${action}`, {}); setNotice(action === 'suspend' ? 'تم تعليق العميل.' : 'تم إعادة تنشيط العميل.'); setModal(null); setPanel(null); reload(); } catch (error) { setNotice(errorMessage(error)); }
  }
  async function remove(value: CustomerView) {
    if (!window.confirm('الحذف الآمن متاح فقط للعميل الموقوف وغير المرتبط بأي عمليات. متابعة؟')) return;
    try { await crmDelete(`/crm/customers/${value.customer.id}`); setNotice('تم الحذف الآمن للعميل.'); setModal(null); setPanel(null); reload(); } catch (error) { setNotice(errorMessage(error)); }
  }
  function exportCsv() {
    if (!visibleCustomers.length) { setNotice('لا توجد بيانات للتصدير.'); return; }
    const esc = (value: string) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const lines = [['الكود', 'الاسم', 'الفئة', 'الهاتف', 'الرقم القومي', 'الحالة', 'الموقف المالي'].join(','), ...visibleCustomers.map(value => [customerCode(value), value.party.displayName, kindLabel(value.party.kind), value.party.phone ?? value.party.whatsappNumber ?? '', value.party.nationalIdentity ?? '', value.customer.status === 'ACTIVE' ? 'نشط' : 'موقوف', financialText(financialByCustomer.get(value.customer.id))].map(item => esc(String(item))).join(','))];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const chips: Array<[QuickFilter, string, number]> = [['ALL', 'الكل', totals.total], ['OUTSTANDING', 'لديهم مستحقات', totals.outstanding], ['OVERDUE', 'متأخرات', totals.overdue], ['SUSPENDED', 'موقوفون', totals.suspended]];
  const activeProfile = profileData?.customer ?? profile;
  const profileMoney = profile ? financialByCustomer.get(profile.customer.id) : undefined;

  return <section className="ct-root" aria-label="إدارة العملاء والوكلاء">
    <div className="ct-top"><span className="ct-top__mark">✈</span>سياحة برو</div>
    {notice ? <div className="ct-notice" role="status">{notice}</div> : null}
    <div className="ct-wrap">
      <h1>العملاء والوكلاء</h1><p className="ct-sub">ابحث، افتح الملف، وسجّل أي عملية بضغطتين.</p>
      <div className="ct-kpis" aria-label="مؤشرات العملاء">
        <Button className="ct-kpi" type="button" aria-pressed={quickFilter === 'ALL'} onClick={() => setQuickFilter('ALL')}><small>العملاء النشطون</small><strong className="ct-mono">{totals.active} / {totals.total}</strong></Button>
        <Button className="ct-kpi" type="button" aria-pressed={quickFilter === 'OUTSTANDING'} onClick={() => setQuickFilter('OUTSTANDING')}><small>لديهم مستحقات مفتوحة</small><strong className="ct-mono">{totals.outstanding}</strong></Button>
        <Button className="ct-kpi" type="button" aria-pressed={quickFilter === 'OVERDUE'} onClick={() => setQuickFilter('OVERDUE')}><small>لديهم متأخرات</small><strong className="ct-mono">{totals.overdue}</strong></Button>
        <Button className="ct-kpi" type="button" aria-pressed={quickFilter === 'SUSPENDED'} onClick={() => setQuickFilter('SUSPENDED')}><small>عملاء موقوفون</small><strong className="ct-mono">{totals.suspended}</strong></Button>
      </div>
      <div className="ct-finder"><div className="ct-finder__row">
        <Input className="ct-in" value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الهاتف أو الرقم القومي" aria-label="بحث العملاء" />
        <Select className="ct-sel" value={kindFilter} onChange={event => setKindFilter(event.target.value as 'ALL' | PartyKind)} aria-label="الفئة"><option value="ALL">كل الفئات</option><option value="PERSON">فردي</option><option value="ORGANIZATION">شركة</option></Select>
        <Button type="button" className="ct-ib" onClick={exportCsv} aria-label="تصدير CSV" title="تصدير CSV">CSV</Button>
      </div><div className="ct-chips">{chips.map(([id, label, count]) => <Button key={id} className={`ct-chip ${quickFilter === id ? 'ct-chip--on' : ''}`} type="button" onClick={() => setQuickFilter(id)}>{label}<b>{count}</b></Button>)}</div></div>
      {customers.error ? <div className="ct-alert">{customers.error}</div> : null}
      {financial.error ? <div className="ct-alert">تعذر تحميل المؤشرات المالية أو لا توجد صلاحية قراءة مالية؛ بيانات العملاء نفسها ما زالت متاحة.</div> : null}
      {!customers.data ? <div className="ct-loading">جارٍ تحميل العملاء…</div> : visibleCustomers.length ? <div className="ct-grid">{visibleCustomers.map(value => {
        const money = financialByCustomer.get(value.customer.id); const contact = value.party.whatsappNumber ?? value.party.phone;
        return <article className="ct-card" key={value.customer.id}>
          <div className="ct-card__hd" onClick={() => void openProfile(value)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') void openProfile(value); }}><div className="ct-av">{value.party.displayName.trim().charAt(0) || 'ع'}</div><div className="ct-grow"><b>{value.party.displayName}</b><small className="ct-mono">{customerCode(value)} · {contact || 'بدون هاتف'}</small></div><TemplateBadge className={value.customer.status === 'ACTIVE' ? 'ct-bd--ok' : 'ct-bd--off'}>{value.customer.status === 'ACTIVE' ? 'نشط' : 'موقوف'}</TemplateBadge></div>
          <div className="ct-badge-row"><TemplateBadge className={value.party.kind === 'ORGANIZATION' ? 'ct-bd--org' : 'ct-bd--person'}>{kindLabel(value.party.kind)}</TemplateBadge>{money?.overduePositionCount ? <TemplateBadge className="ct-bd--warn">{money.overduePositionCount} متأخر</TemplateBadge> : null}</div>
          <div className="ct-balbar"><small className="ct-mut">{money?.hasOutstanding ? 'مستحقات مفتوحة' : 'مصفر / مسدد'}</small><strong className={money?.hasOutstanding ? 'ct-mono ct-neg' : 'ct-mono ct-pos'}>{financialText(money)}</strong></div>
          <div className="ct-card__ft"><Button className="ct-btn ct-btn--pri ct-btn--sm" type="button" onClick={() => void openProfile(value)}>المزيد</Button><Button className="ct-btn ct-btn--sm" type="button" onClick={() => { setModalCustomer(value); setModal('actions'); }}>⚡ إجراءات</Button>{whatsappUrl(contact) ? <a className="ct-ib ct-ib--sm" target="_blank" rel="noopener noreferrer" href={whatsappUrl(contact)} aria-label="واتساب">WA</a> : <span />}</div>
        </article>;
      })}</div> : <div className="ct-empty"><span className="ct-empty__icon">⌕</span><b>لا يوجد عملاء مطابقون</b><p>غيّر البحث أو الفلتر، أو أضف عميلاً جديداً.</p></div>}
    </div>
    <Button className="ct-fab" type="button" onClick={startCreate}><span className="ct-fab__plus">＋</span>عميل جديد</Button>
    <div className={`ct-overlay ${panel ? 'ct-overlay--on' : ''}`} onClick={closeAll} />

    <section className={`ct-sheet ${panel === 'form' ? 'ct-sheet--on' : ''}`} aria-hidden={panel !== 'form'}>
      <div className="ct-sheet__hd"><Button type="button" className="ct-ib" onClick={closeAll} aria-label="رجوع">→</Button><h2>{editing ? 'تعديل العميل' : 'عميل جديد'}</h2></div>
      <form className="ct-sheet__body" id="customer-template-form" onSubmit={save}>
        <div className="ct-box"><h4>المعلومات الأساسية</h4><div className="ct-box__pad">
          <Field label="الاسم *"><Input className="ct-in" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
          <div className="ct-g2"><Field label="الفئة"><Select className="ct-sel" value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as PartyKind })}><option value="PERSON">فردي</option><option value="ORGANIZATION">شركة</option></Select></Field><Field label="الحالة"><Input className="ct-in" disabled value={editing ? (editing.customer.status === 'ACTIVE' ? 'نشط' : 'موقوف') : 'نشط'} /></Field></div>
          {form.kind === 'ORGANIZATION' ? <Field label="الاسم القانوني"><Input className="ct-in" value={form.legalName} onChange={event => setForm({ ...form, legalName: event.target.value })} /></Field> : null}
          <div className="ct-g2"><Field label="الهاتف"><Input className="ct-in ct-mono" inputMode="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field><Field label="واتساب (لو مختلف)"><Input className="ct-in ct-mono" inputMode="tel" value={form.whatsappNumber} onChange={event => setForm({ ...form, whatsappNumber: event.target.value })} /></Field></div>
          <Field label="البريد"><Input className="ct-in" inputMode="email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field><Field label="العنوان"><Input className="ct-in" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></Field>
        </div></div>
        <div className="ct-box"><h4>المستندات والهوية</h4><div className="ct-box__pad"><Field label="الرقم القومي"><Input className="ct-in ct-mono" inputMode="numeric" maxLength={14} value={form.nationalIdentity} onChange={event => setForm({ ...form, nationalIdentity: event.target.value })} /></Field><Field label="الرقم الضريبي"><Input className="ct-in ct-mono" value={form.taxIdentity} onChange={event => setForm({ ...form, taxIdentity: event.target.value })} /></Field>{editing ? <Button className="ct-btn ct-btn--block" type="button" onClick={() => documents(editing)}>فتح المستندات والمرفقات</Button> : <small className="ct-mut">بعد الحفظ يمكنك رفع البطاقة والجواز والعقود من ملف المستندات الحقيقي.</small>}</div></div>
        <div className="ct-box"><h4>البيانات التجارية</h4><div className="ct-box__pad"><Field label="المندوب المسؤول"><Select className="ct-sel" value={form.assignedAgentId} onChange={event => setForm({ ...form, assignedAgentId: event.target.value })}><option value="">بدون مندوب</option>{(agents.data ?? []).map(value => <option key={value.agent.id} value={value.agent.id}>{value.agent.number} — {value.party.displayName}</option>)}</Select></Field><Field label="ملاحظات"><Textarea className="ct-textarea" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></Field></div></div>
      </form>
      <div className="ct-sheet__bar"><Button className="ct-btn" type="button" onClick={closeAll}>إلغاء</Button><Button className="ct-btn ct-btn--pri" type="submit" form="customer-template-form">حفظ</Button></div>
    </section>

    <section className={`ct-sheet ${panel === 'profile' ? 'ct-sheet--on' : ''}`} aria-hidden={panel !== 'profile'}>
      <div className="ct-sheet__hd"><Button type="button" className="ct-ib" onClick={closeAll} aria-label="رجوع">→</Button><h2>ملف العميل</h2><Button type="button" className="ct-ib" aria-label="إدارة العميل" onClick={() => { if (profile) { setModalCustomer(profile); setModal('manage'); } }}>⋮</Button></div>
      <div className="ct-sheet__body">{profileLoading ? <div className="ct-loading">جارٍ تحميل ملف العميل…</div> : activeProfile ? <>
        <div className="ct-hero"><div className="ct-hero__tp"><div className="ct-av">{activeProfile.party.displayName.trim().charAt(0) || 'ع'}</div><div className="ct-grow"><h3>{activeProfile.party.displayName}</h3><small className="ct-mono">{customerCode(activeProfile)}</small></div><TemplateBadge className={activeProfile.customer.status === 'ACTIVE' ? 'ct-bd--ok' : 'ct-bd--off'}>{activeProfile.customer.status === 'ACTIVE' ? 'نشط' : 'موقوف'}</TemplateBadge></div><strong className={profileMoney?.hasOutstanding ? 'ct-neg' : 'ct-pos'}>{financialText(profileMoney)}</strong><small>{profileMoney?.hasOutstanding ? 'الموقف المالي الحالي' : 'لا توجد مستحقات مفتوحة'}</small></div>
        <div className="ct-stat-grid"><div className="ct-stat"><b>{profileData?.financialPositions.length ?? 0}</b><small>الفواتير</small></div><div className="ct-stat"><b>{profileData?.quotations.length ?? 0}</b><small>العروض</small></div><div className="ct-stat"><b>{profileFiles.length}</b><small>المرفقات</small></div><div className="ct-stat"><b>{profileData?.followups.length ?? 0}</b><small>المتابعات</small></div></div>
        <div className="ct-tabs">{([['summary', 'الملخص'], ['finance', 'المالية'], ['operations', 'الحجوزات والخدمات'], ['activity', 'المرفقات والنشاط'], ['statement', 'الحساب الشامل']] as Array<[ProfileTab, string]>).map(([id, label]) => <Button className={`ct-tab ${profileTab === id ? 'ct-tab--on' : ''}`} type="button" key={id} onClick={() => setProfileTab(id)}>{label}</Button>)}</div>
        {profileTab === 'summary' ? <><div className="ct-sec">بيانات الاتصال</div><div className="ct-box"><Kv label="الكود" value={customerCode(activeProfile)} /><Kv label="الفئة" value={kindLabel(activeProfile.party.kind)} /><Kv label="الهاتف" value={activeProfile.party.phone ?? '—'} /><Kv label="واتساب" value={activeProfile.party.whatsappNumber ?? activeProfile.party.phone ?? '—'} /><Kv label="البريد" value={activeProfile.party.email ?? '—'} /><Kv label="العنوان" value={activeProfile.party.address ?? '—'} /></div><div className="ct-sec">المستندات</div><div className="ct-box"><Kv label="الرقم القومي" value={activeProfile.party.nationalIdentity ?? '—'} /><Kv label="الرقم الضريبي" value={activeProfile.party.taxIdentity ?? '—'} /><Kv label="الاسم القانوني" value={activeProfile.party.legalName ?? '—'} /></div>{activeProfile.customer.commercialNotes ? <div className="ct-alert">{activeProfile.customer.commercialNotes}</div> : null}</> : null}
        {profileTab === 'finance' ? <>{profileData?.financialSummaryByCurrency.length ? <div className="ct-box">{profileData.financialSummaryByCurrency.map(item => <Kv key={item.currency} label={`${item.currency} — إجمالي / متبقي`} value={`${item.documentTotal} / ${item.outstanding}`} />)}</div> : <div className="ct-empty">لا توجد حركة مالية</div>}{profileData?.financialPositions.map(item => <div className="ct-item" key={item.invoiceId}><div><b>{item.number}</b><small>{item.postingDate} · {item.status}</small></div><b className={`ct-mono ${item.overdue ? 'ct-neg' : ''}`}>{item.outstanding} {item.currency}</b></div>)}</> : null}
        {profileTab === 'operations' ? <>{profileData?.quotations.length ? profileData.quotations.map(item => <div className="ct-item" key={item.id}><div><b>{item.number}</b><small>عرض سعر · {item.status}</small></div><b className="ct-mono">{quoteTotal(item)} {item.currency}</b></div>) : <div className="ct-empty">لا توجد عروض أسعار</div>}{profileData?.travelers.length ? <><div className="ct-sec">المسافرون</div>{profileData.travelers.map(item => <div className="ct-item" key={item.id}><div><b>{item.fullName}</b><small>{item.nationality ?? '—'} · {item.status}</small></div></div>)}</> : null}<div className="ct-modal__row"><Button className="ct-btn" type="button" onClick={() => quote(activeProfile)}>عرض سعر جديد</Button><Button className="ct-btn ct-btn--pri" type="button" onClick={() => newService(activeProfile)}>خدمة جديدة</Button></div></> : null}
        {profileTab === 'activity' ? <><div className="ct-sec">المرفقات <Button className="ct-btn ct-btn--pri ct-btn--sm" type="button" onClick={() => documents(activeProfile)}>إدارة المرفقات</Button></div>{profileFiles.length ? profileFiles.map(item => <div className="ct-item" key={item.id}><div><b>{item.label ?? item.fileId}</b><small>{new Date(item.createdAt).toLocaleDateString('ar-EG')} · {Math.ceil(item.file.size / 1024)} ك.ب</small></div></div>) : <div className="ct-empty">لا توجد مرفقات</div>}<div className="ct-sec">النشاط والمتابعات</div>{profileData?.followups.length ? profileData.followups.map(item => <div className="ct-item" key={item.id}><div><b>{item.interactionType}</b><small>{new Date(item.scheduledAt).toLocaleString('ar-EG')} · {item.status}</small></div><span>{item.nextAction ?? ''}</span></div>) : <div className="ct-empty">لا توجد متابعات</div>}</> : null}
        {profileTab === 'statement' ? <>{profileData?.financialPositions.length ? <div className="ct-stmt"><table><thead><tr><th>التاريخ</th><th>المستند</th><th>البيان</th><th>الإجمالي</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>{profileData.financialPositions.map(item => <tr key={item.invoiceId}><td>{item.postingDate}</td><td>{item.number}</td><td>{item.sourceType}</td><td>{item.documentTotal} {item.currency}</td><td className={item.overdue ? 'ct-neg' : ''}>{item.outstanding} {item.currency}</td><td>{item.overdue ? 'متأخر' : item.status}</td></tr>)}</tbody></table></div> : <div className="ct-empty">لا توجد مستندات مالية</div>}</> : null}
      </> : <div className="ct-empty">تعذر تحميل ملف العميل</div>}</div>
      {profile ? <div className="ct-sheet__bar"><Button className="ct-btn ct-btn--pri" type="button" onClick={() => accountingAction('receipt', profile)}>سند قبض</Button><Button className="ct-btn ct-btn--dark" type="button" onClick={() => accountingAction('invoice', profile)}>فاتورة</Button><Button className="ct-btn" type="button" onClick={() => newService(profile)}>＋ خدمة</Button></div> : null}
    </section>

    {modal && modalCustomer ? <div className="ct-modal" onClick={event => { if (event.currentTarget === event.target) setModal(null); }}><div className="ct-modal__box">{modal === 'actions' ? <><h3>إجراءات — {modalCustomer.party.displayName}</h3><p>العمليات اليومية السريعة.</p><div className="ct-actions-grid"><Button className="ct-btn ct-btn--pri" type="button" onClick={() => accountingAction('receipt', modalCustomer)}>سند قبض</Button><Button className="ct-btn ct-btn--dark" type="button" onClick={() => accountingAction('invoice', modalCustomer)}>فاتورة مبيعات</Button><Button className="ct-btn" type="button" onClick={() => newService(modalCustomer)}>خدمة جديدة</Button><Button className="ct-btn" type="button" onClick={() => quote(modalCustomer)}>عرض سعر</Button><Button className="ct-btn" type="button" onClick={() => setModal(null)}>إغلاق</Button></div></> : <><h3>إدارة العميل</h3><Button className="ct-menu" type="button" onClick={() => startEdit(modalCustomer)}>✎ تعديل البيانات</Button><Button className="ct-menu" type="button" disabled={!whatsappUrl(modalCustomer.party.whatsappNumber ?? modalCustomer.party.phone)} onClick={() => openWhatsapp(modalCustomer)}>واتساب</Button><Button className="ct-menu" type="button" onClick={() => documents(modalCustomer)}>المستندات والمرفقات</Button><Button className="ct-menu" type="button" onClick={() => void lifecycle(modalCustomer)}>{modalCustomer.customer.status === 'ACTIVE' ? 'تعليق الحساب' : 'تنشيط الحساب'}</Button><Button className="ct-menu ct-menu--danger" type="button" onClick={() => void remove(modalCustomer)}>حذف العميل</Button><div className="ct-modal__row"><Button className="ct-btn" type="button" onClick={() => setModal(null)}>إغلاق</Button></div></>}</div></div> : null}
  </section>;
}
