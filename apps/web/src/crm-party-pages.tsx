import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { crmDelete, crmGet, crmPatch, crmPost } from './crm-core-client.js';

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

const TEMPLATE_CSS = String.raw`
.ct-root{--ink:#0e1a18;--pri:#0f6b57;--pri-d:#0b5444;--pri-t:#e3f1ed;--gold:#a8782a;--gold-t:#f8eed9;--red:#b3362f;--red-t:#fbe8e6;--blue:#2f5f9e;--blue-t:#e6eef8;--vio:#6a4c9c;--vio-t:#eee9f6;--bg:#f2f5f4;--surf:#fff;--line:#e2e8e6;--mut:#6b7b76;--r1:8px;--r2:12px;--r3:16px;--s1:6px;--s2:10px;--s3:14px;--s4:20px;display:block!important;background:var(--bg);color:#17231f;font-family:Tajawal,Arial,sans-serif;font-size:14px;min-height:70vh;border-radius:16px;overflow:clip}
.ct-root *{box-sizing:border-box}.ct-root button,.ct-root input,.ct-root select,.ct-root textarea{font:inherit;color:inherit}.ct-root button{cursor:pointer}.ct-root :focus-visible{outline:2px solid var(--pri);outline-offset:2px}.ct-mono{font-family:ui-monospace,Consolas,monospace;direction:ltr;unicode-bidi:embed}.ct-neg{color:var(--red)}.ct-pos{color:var(--pri)}.ct-mut{color:var(--mut)}
.ct-top{position:sticky;top:0;z-index:20;background:var(--ink);color:#fff;height:56px;display:flex;align-items:center;gap:var(--s2);padding:0 var(--s3);font-weight:800;font-size:17px}.ct-top__mark{width:32px;height:32px;border-radius:9px;background:var(--pri);display:grid;place-items:center;font-size:16px}.ct-wrap{max-width:1100px;margin:0 auto;padding:var(--s3) var(--s3) 96px}.ct-wrap h1{font-size:21px;font-weight:800;margin:0}.ct-sub{color:var(--mut);margin:2px 0 var(--s3)}
.ct-btn{height:44px;padding:0 var(--s3);border-radius:var(--r2);border:1px solid var(--line);background:var(--surf);font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;color:inherit;white-space:nowrap}.ct-btn--pri{background:var(--pri);border-color:var(--pri);color:#fff}.ct-btn--dark{background:var(--ink);border-color:var(--ink);color:#fff}.ct-btn--red{background:var(--red);border-color:var(--red);color:#fff}.ct-btn--wa{background:#e5f7ec;border-color:#bfe9cf;color:#157a3f}.ct-btn--sm{height:36px;font-size:13px;padding:0 11px}.ct-btn--block{width:100%}.ct-btn:disabled{opacity:.45;cursor:not-allowed}
.ct-ib{width:44px;height:44px;border:1px solid var(--line);border-radius:var(--r2);background:var(--surf);display:grid;place-items:center;color:var(--mut);text-decoration:none;flex-shrink:0}.ct-bd{display:inline-flex;align-items:center;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700}.ct-bd--person{background:var(--blue-t);color:var(--blue)}.ct-bd--org{background:var(--pri-t);color:var(--pri)}.ct-bd--ok{background:var(--pri-t);color:var(--pri)}.ct-bd--off{background:#eceff0;color:var(--mut)}.ct-bd--warn{background:var(--gold-t);color:var(--gold)}.ct-bd--bad{background:var(--red-t);color:var(--red)}
.ct-av{width:44px;height:44px;border-radius:var(--r2);background:var(--pri-t);color:var(--pri);display:grid;place-items:center;font-weight:800;font-size:17px;flex-shrink:0}.ct-in,.ct-sel{height:44px;border:1px solid var(--line);border-radius:var(--r2);background:var(--surf);padding:0 var(--s2);width:100%}.ct-in:focus,.ct-sel:focus,.ct-textarea:focus{border-color:var(--pri);outline:3px solid var(--pri-t)}.ct-in.ct-err{border-color:var(--red)}.ct-textarea{width:100%;border:1px solid var(--line);border-radius:var(--r2);padding:var(--s2);min-height:82px;background:var(--surf)}.ct-label{display:block;font-size:12px;font-weight:700;color:var(--mut);margin-bottom:4px}.ct-field{margin-bottom:var(--s2)}
.ct-kpis{display:grid;grid-template-columns:1fr 1fr;gap:var(--s2)}@media(min-width:800px){.ct-kpis{grid-template-columns:repeat(4,1fr)}}.ct-kpi{background:var(--surf);border:1px solid var(--line);border-radius:var(--r2);padding:var(--s2) var(--s3);text-align:right;width:100%;min-height:67px}.ct-kpi[aria-pressed='true']{border-color:var(--pri);box-shadow:0 0 0 2px var(--pri-t)}.ct-kpi small{display:block;color:var(--mut);font-size:11px}.ct-kpi strong{display:block;font-size:16px;font-weight:800;margin-top:2px}
.ct-finder{position:sticky;top:56px;z-index:15;background:var(--bg);padding:var(--s2) 0}.ct-finder__row{display:flex;gap:8px}.ct-chips{display:flex;gap:8px;overflow-x:auto;padding:var(--s2) 0 2px;scrollbar-width:none}.ct-chip{height:36px;padding:0 var(--s3);border-radius:99px;border:1px solid var(--line);background:var(--surf);font-weight:700;font-size:13px;white-space:nowrap}.ct-chip--on{background:var(--ink);color:#fff;border-color:var(--ink)}.ct-chip b{opacity:.6;margin-right:4px}
.ct-grid{display:grid;gap:var(--s2);grid-template-columns:1fr;margin-top:var(--s2)}@media(min-width:760px){.ct-grid{grid-template-columns:1fr 1fr}}@media(min-width:1050px){.ct-grid{grid-template-columns:repeat(3,1fr)}}.ct-card{background:var(--surf);border:1px solid var(--line);border-radius:var(--r3);padding:var(--s3);display:flex;flex-direction:column;gap:var(--s2)}.ct-card__hd{display:flex;gap:11px;align-items:center;cursor:pointer}.ct-card__hd b{display:block;font-size:15px}.ct-card__hd small{color:var(--mut);font-size:12px}.ct-card__ft{display:grid;grid-template-columns:1fr 1fr 44px;gap:8px}.ct-balbar{display:flex;justify-content:space-between;align-items:center;padding:var(--s2) var(--s3);background:#f7faf9;border-radius:var(--r2);min-height:46px}.ct-balbar strong{font-size:16px}.ct-empty{text-align:center;padding:36px 16px;color:var(--mut)}.ct-empty__icon{font-size:32px;color:#c4d0cc;margin-bottom:8px;display:block}
.ct-fab{position:fixed;bottom:18px;left:18px;height:56px;padding:0 20px;border-radius:99px;background:var(--pri);color:#fff;border:0;font-weight:800;box-shadow:0 6px 18px rgba(15,107,87,.4);z-index:30;display:flex;align-items:center;gap:8px}.ct-overlay{position:fixed;inset:0;background:rgba(14,26,24,.5);opacity:0;pointer-events:none;transition:.2s;z-index:1000}.ct-overlay--on{opacity:1;pointer-events:auto}.ct-sheet{position:fixed;z-index:1010;background:var(--bg);display:flex;flex-direction:column;inset:0;transform:translateY(105%);transition:transform .25s}.ct-sheet--on{transform:none}@media(min-width:800px){.ct-sheet{left:0;right:auto;width:540px;transform:translateX(-105%)}.ct-sheet--on{transform:none}}.ct-sheet__hd{background:var(--surf);padding:var(--s2) var(--s3);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:var(--s2);padding-top:max(var(--s2),env(safe-area-inset-top))}.ct-sheet__hd h2{font-size:17px;font-weight:800;flex:1;margin:0}.ct-sheet__body{overflow-y:auto;padding:var(--s3);flex:1}.ct-sheet__bar{background:var(--surf);padding:var(--s2) var(--s3) calc(var(--s2) + env(safe-area-inset-bottom));border-top:1px solid var(--line);display:flex;gap:8px}.ct-sheet__bar .ct-btn{flex:1;padding:0 6px}
.ct-box{background:var(--surf);border:1px solid var(--line);border-radius:var(--r2);margin-bottom:var(--s3)}.ct-box>h4{font-size:13px;padding:var(--s2) var(--s3) 0;margin:0}.ct-box__pad{padding:var(--s3)}.ct-g2{display:grid;grid-template-columns:1fr 1fr;gap:var(--s2)}.ct-hero{background:var(--ink);color:#fff;border-radius:var(--r3);padding:var(--s3);margin-bottom:var(--s3)}.ct-hero__tp{display:flex;gap:11px;align-items:center}.ct-hero .ct-av{background:#1b2e2a;color:#7fe0c4}.ct-hero h3{font-size:16px;margin:0}.ct-hero small{color:#9fb3ad}.ct-hero strong{display:block;font-size:24px;font-weight:800;margin:var(--s2) 0 0}.ct-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.ct-stat{background:var(--surf);border:1px solid var(--line);border-radius:var(--r2);padding:9px 4px;text-align:center}.ct-stat b{display:block;font-size:19px}.ct-stat small{font-size:11px;color:var(--mut)}
.ct-tabs{display:flex;overflow-x:auto;margin-bottom:var(--s3);border-bottom:1px solid var(--line);scrollbar-width:none}.ct-tab{background:none;border:0;padding:11px var(--s3);font-weight:700;color:var(--mut);white-space:nowrap;border-bottom:3px solid transparent}.ct-tab--on{color:var(--pri);border-color:var(--pri)}.ct-sec{font-weight:800;margin:6px 2px var(--s2);display:flex;justify-content:space-between;align-items:center}.ct-kv{display:flex;justify-content:space-between;gap:var(--s3);padding:11px var(--s3);border-bottom:1px solid #eef2f0}.ct-kv:last-child{border:0}.ct-kv small{color:var(--mut);font-weight:700}.ct-kv span{font-weight:700;text-align:left;word-break:break-word}.ct-item{background:var(--surf);border:1px solid var(--line);border-radius:var(--r2);padding:11px var(--s3);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:var(--s2)}.ct-item b{display:block}.ct-item small{color:var(--mut)}.ct-alert{padding:11px var(--s3);border-radius:var(--r2);margin-bottom:var(--s3);font-weight:700;font-size:13px;background:var(--gold-t);color:var(--gold)}
.ct-stmt{overflow-x:auto;background:var(--surf);border:1px solid var(--line);border-radius:var(--r2)}.ct-stmt table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:13px}.ct-stmt th,.ct-stmt td{padding:9px 11px;text-align:right;border-bottom:1px solid #eef2f0}.ct-stmt th{background:#f8faf9;color:var(--mut);font-size:12px}.ct-modal{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;z-index:1030;background:rgba(14,26,24,.55);padding:0}.ct-modal__box{background:var(--surf);border-radius:var(--r3) var(--r3) 0 0;padding:var(--s4);width:min(460px,100%);padding-bottom:calc(var(--s4) + env(safe-area-inset-bottom))}@media(min-width:800px){.ct-modal{align-items:center;padding:20px}.ct-modal__box{border-radius:var(--r3)}}.ct-modal__box h3{margin:0 0 6px;font-size:17px}.ct-modal__box p{color:var(--mut);margin:0 0 var(--s3);line-height:1.7}.ct-modal__row{display:flex;gap:var(--s2);margin-top:var(--s3)}.ct-modal__row .ct-btn{flex:1}.ct-menu{display:flex;align-items:center;gap:12px;width:100%;padding:13px;border:0;border-bottom:1px solid #eef2f0;background:none;text-align:right;font-weight:700}.ct-menu--danger{color:var(--red)}.ct-notice{max-width:1100px;margin:10px auto 0;padding:11px 14px;background:var(--ink);color:#fff;border-radius:10px;font-weight:700}.ct-loading{padding:25px;text-align:center;color:var(--mut)}
@media(max-width:620px){.ct-finder__row{display:grid;grid-template-columns:minmax(0,1fr) 105px 44px}.ct-g2{grid-template-columns:1fr}.ct-stat-grid{grid-template-columns:1fr 1fr}.ct-root{border-radius:0}.ct-wrap{padding-inline:10px}.ct-fab{bottom:14px;left:14px}.ct-kpi{padding:9px 10px}.ct-card__ft{grid-template-columns:1fr 1fr 40px}}
@media(prefers-reduced-motion:reduce){.ct-root *{transition:none!important}}
`;

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

function Badge({ children, className }: { children: ReactNode; className: string }) {
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
    return {
      total: all.length,
      active: all.filter(value => value.customer.status === 'ACTIVE').length,
      outstanding: workspaces.filter(value => value.hasOutstanding).length,
      overdue: workspaces.filter(value => value.overduePositionCount > 0).length,
      suspended: all.filter(value => value.customer.status === 'SUSPENDED').length,
    };
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
    setPanel('form');
    setModal(null);
  }
  async function openProfile(value: CustomerView) {
    setProfile(value);
    setProfileData(null);
    setProfileFiles([]);
    setProfileTab('summary');
    setPanel('profile');
    setModal(null);
    setProfileLoading(true);
    try {
      const [insight, files] = await Promise.all([
        crmGet<Customer360>(`/crm/insights/customers/${encodeURIComponent(value.customer.id)}`),
        crmGet<EntityFileLink[]>(`/crm/customers/${encodeURIComponent(value.customer.id)}/files`).catch(() => []),
      ]);
      setProfileData(insight);
      setProfileFiles(files);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setProfileLoading(false);
    }
  }
  function accountingAction(action: 'receipt' | 'invoice' | 'advance-refund', value: CustomerView) {
    openPath(`/crm/financial-action?action=${action}&partyKind=CUSTOMER&partyId=${encodeURIComponent(value.party.id)}`);
  }
  function newService(value: CustomerView) { openPath(`/tourism/services?customerPartyId=${encodeURIComponent(value.party.id)}`); }
  function quote(value: CustomerView) { openPath(`/crm/quotations?customerId=${encodeURIComponent(value.customer.id)}`); }
  function documents(value: CustomerView) { openPath(`/crm/customer-documents?customerId=${encodeURIComponent(value.customer.id)}`); }
  function openWhatsapp(value: CustomerView) { const url = whatsappUrl(value.party.whatsappNumber ?? value.party.phone); if (url) window.open(url, '_blank', 'noopener,noreferrer'); }

  async function save(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    const cleanPhone = phoneDigits(form.phone);
    const cleanWhatsapp = phoneDigits(form.whatsappNumber);
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
      if (editing) {
        await crmPatch(`/crm/customers/${editing.customer.id}`, body);
        setNotice('تم حفظ تعديلات العميل.');
      } else {
        const result = await crmPost<CustomerCreateResult>('/crm/customers', body);
        if (result.status === 'REVIEW_REQUIRED') {
          const names = result.candidates?.map(candidate => `${candidate.party.displayName} (${candidate.evidence.join('، ')})`).join(' — ');
          setNotice(`يوجد تطابق محتمل ويجب مراجعته قبل إنشاء سجل جديد${names ? `: ${names}` : ''}.`);
          return;
        }
        setNotice(result.status === 'EXISTING' ? 'تم ربط البيانات بسجل العميل الموجود دون إنشاء تكرار.' : result.status === 'EXISTING_SUSPENDED' ? 'العميل موجود لكنه موقوف؛ لم يتم إنشاء نسخة مكررة.' : 'تمت إضافة العميل بنجاح.');
      }
      setPanel(null);
      setEditing(null);
      setForm(emptyForm());
      reload();
    } catch (error) { setNotice(errorMessage(error)); }
  }

  async function lifecycle(value: CustomerView) {
    const action = value.customer.status === 'ACTIVE' ? 'suspend' : 'reactivate';
    try {
      await crmPost(`/crm/customers/${value.customer.id}/${action}`, {});
      setNotice(action === 'suspend' ? 'تم تعليق العميل.' : 'تم إعادة تنشيط العميل.');
      setModal(null);
      setPanel(null);
      reload();
    } catch (error) { setNotice(errorMessage(error)); }
  }
  async function remove(value: CustomerView) {
    if (!window.confirm('الحذف الآمن متاح فقط للعميل الموقوف وغير المرتبط بأي عمليات. متابعة؟')) return;
    try {
      await crmDelete(`/crm/customers/${value.customer.id}`);
      setNotice('تم الحذف الآمن للعميل.');
      setModal(null);
      setPanel(null);
      reload();
    } catch (error) { setNotice(errorMessage(error)); }
  }
  function exportCsv() {
    if (!visibleCustomers.length) { setNotice('لا توجد بيانات للتصدير.'); return; }
    const esc = (value: string) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const lines = [['الكود', 'الاسم', 'الفئة', 'الهاتف', 'الرقم القومي', 'الحالة', 'الموقف المالي'].join(','), ...visibleCustomers.map(value => [customerCode(value), value.party.displayName, kindLabel(value.party.kind), value.party.phone ?? value.party.whatsappNumber ?? '', value.party.nationalIdentity ?? '', value.customer.status === 'ACTIVE' ? 'نشط' : 'موقوف', financialText(financialByCustomer.get(value.customer.id))].map(item => esc(String(item))).join(','))];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const chips: Array<[QuickFilter, string, number]> = [['ALL', 'الكل', totals.total], ['OUTSTANDING', 'لديهم مستحقات', totals.outstanding], ['OVERDUE', 'متأخرات', totals.overdue], ['SUSPENDED', 'موقوفون', totals.suspended]];
  const activeProfile = profileData?.customer ?? profile;
  const profileMoney = profile ? financialByCustomer.get(profile.customer.id) : undefined;

  return <section className="ct-root" aria-label="إدارة العملاء والوكلاء">
    <style>{TEMPLATE_CSS}</style>
    <div className="ct-top"><span className="ct-top__mark">✈</span>سياحة برو</div>
    {notice ? <div className="ct-notice" role="status">{notice}</div> : null}
    <div className="ct-wrap">
      <h1>العملاء والوكلاء</h1>
      <p className="ct-sub">ابحث، افتح الملف، وسجّل أي عملية بضغطتين.</p>

      <div className="ct-kpis" aria-label="مؤشرات العملاء">
        <button className="ct-kpi" type="button" aria-pressed={quickFilter === 'ALL'} onClick={() => setQuickFilter('ALL')}><small>العملاء النشطون</small><strong className="ct-mono">{totals.active} / {totals.total}</strong></button>
        <button className="ct-kpi" type="button" aria-pressed={quickFilter === 'OUTSTANDING'} onClick={() => setQuickFilter('OUTSTANDING')}><small>لديهم مستحقات مفتوحة</small><strong className="ct-mono">{totals.outstanding}</strong></button>
        <button className="ct-kpi" type="button" aria-pressed={quickFilter === 'OVERDUE'} onClick={() => setQuickFilter('OVERDUE')}><small>لديهم متأخرات</small><strong className="ct-mono">{totals.overdue}</strong></button>
        <button className="ct-kpi" type="button" aria-pressed={quickFilter === 'SUSPENDED'} onClick={() => setQuickFilter('SUSPENDED')}><small>عملاء موقوفون</small><strong className="ct-mono">{totals.suspended}</strong></button>
      </div>

      <div className="ct-finder">
        <div className="ct-finder__row">
          <input className="ct-in" value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الهاتف أو الرقم القومي" aria-label="بحث العملاء" />
          <select className="ct-sel" value={kindFilter} onChange={event => setKindFilter(event.target.value as 'ALL' | PartyKind)} aria-label="الفئة"><option value="ALL">كل الفئات</option><option value="PERSON">فردي</option><option value="ORGANIZATION">شركة</option></select>
          <button type="button" className="ct-ib" onClick={exportCsv} aria-label="تصدير CSV" title="تصدير CSV">CSV</button>
        </div>
        <div className="ct-chips">{chips.map(([id, label, count]) => <button key={id} className={`ct-chip ${quickFilter === id ? 'ct-chip--on' : ''}`} type="button" onClick={() => setQuickFilter(id)}>{label}<b>{count}</b></button>)}</div>
      </div>

      {customers.error ? <div className="ct-alert">{customers.error}</div> : null}
      {financial.error ? <div className="ct-alert">تعذر تحميل المؤشرات المالية أو لا توجد صلاحية قراءة مالية؛ بيانات العملاء نفسها ما زالت متاحة.</div> : null}
      {!customers.data ? <div className="ct-loading">جارٍ تحميل العملاء…</div> : visibleCustomers.length ? <div className="ct-grid">{visibleCustomers.map(value => {
        const money = financialByCustomer.get(value.customer.id);
        const contact = value.party.whatsappNumber ?? value.party.phone;
        return <article className="ct-card" key={value.customer.id}>
          <div className="ct-card__hd" onClick={() => void openProfile(value)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') void openProfile(value); }}>
            <div className="ct-av">{value.party.displayName.trim().charAt(0) || 'ع'}</div>
            <div style={{ flex: 1, minWidth: 0 }}><b>{value.party.displayName}</b><small className="ct-mono">{customerCode(value)} · {contact || 'بدون هاتف'}</small></div>
            <Badge className={value.customer.status === 'ACTIVE' ? 'ct-bd--ok' : 'ct-bd--off'}>{value.customer.status === 'ACTIVE' ? 'نشط' : 'موقوف'}</Badge>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Badge className={value.party.kind === 'ORGANIZATION' ? 'ct-bd--org' : 'ct-bd--person'}>{kindLabel(value.party.kind)}</Badge>{money?.overduePositionCount ? <Badge className="ct-bd--warn">{money.overduePositionCount} متأخر</Badge> : null}</div>
          <div className="ct-balbar"><small className="ct-mut">{money?.hasOutstanding ? 'مستحقات مفتوحة' : 'مصفر / مسدد'}</small><strong className={money?.hasOutstanding ? 'ct-mono ct-neg' : 'ct-mono ct-pos'}>{financialText(money)}</strong></div>
          <div className="ct-card__ft"><button className="ct-btn ct-btn--pri ct-btn--sm" type="button" onClick={() => void openProfile(value)}>المزيد</button><button className="ct-btn ct-btn--sm" type="button" onClick={() => { setModalCustomer(value); setModal('actions'); }}>⚡ إجراءات</button>{whatsappUrl(contact) ? <a className="ct-ib" style={{ height: 36, width: 44 }} target="_blank" rel="noopener noreferrer" href={whatsappUrl(contact)} aria-label="واتساب">WA</a> : <span />}</div>
        </article>;
      })}</div> : <div className="ct-empty"><span className="ct-empty__icon">⌕</span><b>لا يوجد عملاء مطابقون</b><p>غيّر البحث أو الفلتر، أو أضف عميلاً جديداً.</p></div>}
    </div>

    <button className="ct-fab" type="button" onClick={startCreate}><span style={{ fontSize: 22 }}>＋</span>عميل جديد</button>
    <div className={`ct-overlay ${panel ? 'ct-overlay--on' : ''}`} onClick={closeAll} />

    <section className={`ct-sheet ${panel === 'form' ? 'ct-sheet--on' : ''}`} aria-hidden={panel !== 'form'}>
      <div className="ct-sheet__hd"><button type="button" className="ct-ib" onClick={closeAll} aria-label="رجوع">→</button><h2>{editing ? 'تعديل العميل' : 'عميل جديد'}</h2></div>
      <form className="ct-sheet__body" id="customer-template-form" onSubmit={save}>
        <div className="ct-box"><h4>المعلومات الأساسية</h4><div className="ct-box__pad">
          <Field label="الاسم *"><input className="ct-in" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
          <div className="ct-g2"><Field label="الفئة"><select className="ct-sel" value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as PartyKind })}><option value="PERSON">فردي</option><option value="ORGANIZATION">شركة</option></select></Field><Field label="الحالة"><input className="ct-in" disabled value={editing ? (editing.customer.status === 'ACTIVE' ? 'نشط' : 'موقوف') : 'نشط'} /></Field></div>
          {form.kind === 'ORGANIZATION' ? <Field label="الاسم القانوني"><input className="ct-in" value={form.legalName} onChange={event => setForm({ ...form, legalName: event.target.value })} /></Field> : null}
          <div className="ct-g2"><Field label="الهاتف"><input className="ct-in ct-mono" inputMode="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field><Field label="واتساب (لو مختلف)"><input className="ct-in ct-mono" inputMode="tel" value={form.whatsappNumber} onChange={event => setForm({ ...form, whatsappNumber: event.target.value })} /></Field></div>
          <Field label="البريد"><input className="ct-in" inputMode="email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="العنوان"><input className="ct-in" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></Field>
        </div></div>
        <div className="ct-box"><h4>المستندات والهوية</h4><div className="ct-box__pad"><Field label="الرقم القومي"><input className="ct-in ct-mono" inputMode="numeric" maxLength={14} value={form.nationalIdentity} onChange={event => setForm({ ...form, nationalIdentity: event.target.value })} /></Field><Field label="الرقم الضريبي"><input className="ct-in ct-mono" value={form.taxIdentity} onChange={event => setForm({ ...form, taxIdentity: event.target.value })} /></Field>{editing ? <button className="ct-btn ct-btn--block" type="button" onClick={() => documents(editing)}>فتح المستندات والمرفقات</button> : <small className="ct-mut">بعد الحفظ يمكنك رفع البطاقة والجواز والعقود من ملف المستندات الحقيقي.</small>}</div></div>
        <div className="ct-box"><h4>البيانات التجارية</h4><div className="ct-box__pad"><Field label="المندوب المسؤول"><select className="ct-sel" value={form.assignedAgentId} onChange={event => setForm({ ...form, assignedAgentId: event.target.value })}><option value="">بدون مندوب</option>{(agents.data ?? []).map(value => <option key={value.agent.id} value={value.agent.id}>{value.agent.number} — {value.party.displayName}</option>)}</select></Field><Field label="ملاحظات"><textarea className="ct-textarea" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></Field></div></div>
      </form>
      <div className="ct-sheet__bar"><button className="ct-btn" type="button" onClick={closeAll}>إلغاء</button><button className="ct-btn ct-btn--pri" type="submit" form="customer-template-form">حفظ</button></div>
    </section>

    <section className={`ct-sheet ${panel === 'profile' ? 'ct-sheet--on' : ''}`} aria-hidden={panel !== 'profile'}>
      <div className="ct-sheet__hd"><button type="button" className="ct-ib" onClick={closeAll} aria-label="رجوع">→</button><h2>ملف العميل</h2><button type="button" className="ct-ib" aria-label="إدارة العميل" onClick={() => { if (profile) { setModalCustomer(profile); setModal('manage'); } }}>⋮</button></div>
      <div className="ct-sheet__body">
        {profileLoading ? <div className="ct-loading">جارٍ تحميل ملف العميل…</div> : activeProfile ? <>
          <div className="ct-hero"><div className="ct-hero__tp"><div className="ct-av">{activeProfile.party.displayName.trim().charAt(0) || 'ع'}</div><div style={{ flex: 1 }}><h3>{activeProfile.party.displayName}</h3><small className="ct-mono">{customerCode(activeProfile)}</small></div><Badge className={activeProfile.customer.status === 'ACTIVE' ? 'ct-bd--ok' : 'ct-bd--off'}>{activeProfile.customer.status === 'ACTIVE' ? 'نشط' : 'موقوف'}</Badge></div><strong className={profileMoney?.hasOutstanding ? 'ct-neg' : 'ct-pos'}>{financialText(profileMoney)}</strong><small>{profileMoney?.hasOutstanding ? 'الموقف المالي الحالي' : 'لا توجد مستحقات مفتوحة'}</small></div>
          <div className="ct-stat-grid"><div className="ct-stat"><b>{profileData?.financialPositions.length ?? 0}</b><small>الفواتير</small></div><div className="ct-stat"><b>{profileData?.quotations.length ?? 0}</b><small>العروض</small></div><div className="ct-stat"><b>{profileFiles.length}</b><small>المرفقات</small></div><div className="ct-stat"><b>{profileData?.followups.length ?? 0}</b><small>المتابعات</small></div></div>
          <div className="ct-tabs">{([['summary', 'الملخص'], ['finance', 'المالية'], ['operations', 'الحجوزات والخدمات'], ['activity', 'المرفقات والنشاط'], ['statement', 'الحساب الشامل']] as Array<[ProfileTab, string]>).map(([id, label]) => <button className={`ct-tab ${profileTab === id ? 'ct-tab--on' : ''}`} type="button" key={id} onClick={() => setProfileTab(id)}>{label}</button>)}</div>
          {profileTab === 'summary' ? <><div className="ct-sec">بيانات الاتصال</div><div className="ct-box"><Kv label="الكود" value={customerCode(activeProfile)} /><Kv label="الفئة" value={kindLabel(activeProfile.party.kind)} /><Kv label="الهاتف" value={activeProfile.party.phone ?? '—'} /><Kv label="واتساب" value={activeProfile.party.whatsappNumber ?? activeProfile.party.phone ?? '—'} /><Kv label="البريد" value={activeProfile.party.email ?? '—'} /><Kv label="العنوان" value={activeProfile.party.address ?? '—'} /></div><div className="ct-sec">المستندات</div><div className="ct-box"><Kv label="الرقم القومي" value={activeProfile.party.nationalIdentity ?? '—'} /><Kv label="الرقم الضريبي" value={activeProfile.party.taxIdentity ?? '—'} /><Kv label="الاسم القانوني" value={activeProfile.party.legalName ?? '—'} /></div>{activeProfile.customer.commercialNotes ? <div className="ct-alert">{activeProfile.customer.commercialNotes}</div> : null}</> : null}
          {profileTab === 'finance' ? <>{profileData?.financialSummaryByCurrency.length ? <div className="ct-box">{profileData.financialSummaryByCurrency.map(item => <Kv key={item.currency} label={`${item.currency} — إجمالي / متبقي`} value={`${item.documentTotal} / ${item.outstanding}`} />)}</div> : <div className="ct-empty">لا توجد حركة مالية</div>}{profileData?.financialPositions.map(item => <div className="ct-item" key={item.invoiceId}><div><b>{item.number}</b><small>{item.postingDate} · {item.status}</small></div><b className={`ct-mono ${item.overdue ? 'ct-neg' : ''}`}>{item.outstanding} {item.currency}</b></div>)}</> : null}
          {profileTab === 'operations' ? <>{profileData?.quotations.length ? profileData.quotations.map(item => <div className="ct-item" key={item.id}><div><b>{item.number}</b><small>عرض سعر · {item.status}</small></div><b className="ct-mono">{quoteTotal(item)} {item.currency}</b></div>) : <div className="ct-empty">لا توجد عروض أسعار</div>}{profileData?.travelers.length ? <><div className="ct-sec">المسافرون</div>{profileData.travelers.map(item => <div className="ct-item" key={item.id}><div><b>{item.fullName}</b><small>{item.nationality ?? '—'} · {item.status}</small></div></div>)}</> : null}<div className="ct-modal__row"><button className="ct-btn" type="button" onClick={() => quote(activeProfile)}>عرض سعر جديد</button><button className="ct-btn ct-btn--pri" type="button" onClick={() => newService(activeProfile)}>خدمة جديدة</button></div></> : null}
          {profileTab === 'activity' ? <><div className="ct-sec">المرفقات <button className="ct-btn ct-btn--pri ct-btn--sm" type="button" onClick={() => documents(activeProfile)}>إدارة المرفقات</button></div>{profileFiles.length ? profileFiles.map(item => <div className="ct-item" key={item.id}><div><b>{item.label ?? item.fileId}</b><small>{new Date(item.createdAt).toLocaleDateString('ar-EG')} · {Math.ceil(item.file.size / 1024)} ك.ب</small></div></div>) : <div className="ct-empty">لا توجد مرفقات</div>}<div className="ct-sec">النشاط والمتابعات</div>{profileData?.followups.length ? profileData.followups.map(item => <div className="ct-item" key={item.id}><div><b>{item.interactionType}</b><small>{new Date(item.scheduledAt).toLocaleString('ar-EG')} · {item.status}</small></div><span>{item.nextAction ?? ''}</span></div>) : <div className="ct-empty">لا توجد متابعات</div>}</> : null}
          {profileTab === 'statement' ? <>{profileData?.financialPositions.length ? <div className="ct-stmt"><table><thead><tr><th>التاريخ</th><th>المستند</th><th>البيان</th><th>الإجمالي</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>{profileData.financialPositions.map(item => <tr key={item.invoiceId}><td>{item.postingDate}</td><td>{item.number}</td><td>{item.sourceType}</td><td>{item.documentTotal} {item.currency}</td><td className={item.overdue ? 'ct-neg' : ''}>{item.outstanding} {item.currency}</td><td>{item.overdue ? 'متأخر' : item.status}</td></tr>)}</tbody></table></div> : <div className="ct-empty">لا توجد مستندات مالية</div>}</> : null}
        </> : <div className="ct-empty">تعذر تحميل ملف العميل</div>}
      </div>
      {profile ? <div className="ct-sheet__bar"><button className="ct-btn ct-btn--pri" type="button" onClick={() => accountingAction('receipt', profile)}>سند قبض</button><button className="ct-btn ct-btn--dark" type="button" onClick={() => accountingAction('invoice', profile)}>فاتورة</button><button className="ct-btn" type="button" onClick={() => newService(profile)}>＋ خدمة</button></div> : null}
    </section>

    {modal && modalCustomer ? <div className="ct-modal" onClick={event => { if (event.currentTarget === event.target) setModal(null); }}><div className="ct-modal__box">{modal === 'actions' ? <><h3>إجراءات — {modalCustomer.party.displayName}</h3><p>العمليات اليومية السريعة.</p><div style={{ display: 'grid', gap: 8 }}><button className="ct-btn ct-btn--pri" type="button" onClick={() => accountingAction('receipt', modalCustomer)}>سند قبض</button><button className="ct-btn ct-btn--dark" type="button" onClick={() => accountingAction('invoice', modalCustomer)}>فاتورة مبيعات</button><button className="ct-btn" type="button" onClick={() => newService(modalCustomer)}>خدمة جديدة</button><button className="ct-btn" type="button" onClick={() => quote(modalCustomer)}>عرض سعر</button><button className="ct-btn" type="button" onClick={() => setModal(null)}>إغلاق</button></div></> : <><h3>إدارة العميل</h3><button className="ct-menu" type="button" onClick={() => startEdit(modalCustomer)}>✎ تعديل البيانات</button><button className="ct-menu" type="button" disabled={!whatsappUrl(modalCustomer.party.whatsappNumber ?? modalCustomer.party.phone)} onClick={() => openWhatsapp(modalCustomer)}>واتساب</button><button className="ct-menu" type="button" onClick={() => documents(modalCustomer)}>المستندات والمرفقات</button><button className="ct-menu" type="button" onClick={() => void lifecycle(modalCustomer)}>{modalCustomer.customer.status === 'ACTIVE' ? 'تعليق الحساب' : 'تنشيط الحساب'}</button><button className="ct-menu ct-menu--danger" type="button" onClick={() => void remove(modalCustomer)}>حذف العميل</button><div className="ct-modal__row"><button className="ct-btn" type="button" onClick={() => setModal(null)}>إغلاق</button></div></>}</div></div> : null}
  </section>;
}
