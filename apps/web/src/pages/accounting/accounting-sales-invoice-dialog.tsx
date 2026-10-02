import * as React from 'react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  accountingApi,
  type AccountingOverview,
  type ManualInvoiceReferences,
} from '../../accounting-client.js';
import { crmGet, crmPost } from '../../crm-core-client.js';
import { Button, FormField, Icon, Input, Select, Textarea } from '../../ui.js';

type PartyChoice = {
  readonly kind: 'CUSTOMER' | 'AGENT';
  readonly partyId: string;
  readonly number: string;
  readonly displayName: string;
};

type CustomerReference = {
  readonly customer: { readonly id: string; readonly partyId: string; readonly number: string; readonly status: string };
  readonly party: { readonly id: string; readonly displayName: string };
};

type AgentReference = {
  readonly agent: { readonly id: string; readonly partyId: string; readonly number: string; readonly status: string };
  readonly party: { readonly id: string; readonly displayName: string };
};

type AllocatedDocumentNumber = { readonly documentType: string; readonly value: string };
export type SalesInvoiceSaveMode = 'DRAFT' | 'POSTED';
export type SalesInvoiceDiscountMode = 'FIXED' | 'PERCENT';

export interface SalesInvoiceLineDraft {
  readonly id: string;
  readonly description: string;
  readonly quantity: string;
  readonly price: string;
  readonly discountMode: SalesInvoiceDiscountMode;
  readonly discount: string;
  readonly taxCode: string;
  readonly accountId: string;
  readonly costCenterId: string;
}

export interface SalesInvoiceDraft {
  readonly postingDate: string;
  readonly party?: PartyChoice;
  readonly partyQuery: string;
  readonly currency: string;
  readonly dueDate: string;
  readonly recognitionDate: string;
  readonly saveMode: SalesInvoiceSaveMode;
  readonly paymentTerms: string;
  readonly lines: readonly SalesInvoiceLineDraft[];
}

interface SalesInvoiceDialogProps {
  readonly open: boolean;
  readonly data: AccountingOverview;
  readonly operate: boolean;
  readonly onClose: () => void;
  readonly onCreated: () => Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);
const numberValue = (value: string) => Number(value.trim().replace(',', '.'));

function newLine(defaultAccountId = ''): SalesInvoiceLineDraft {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: '1',
    price: '',
    discountMode: 'FIXED',
    discount: '0',
    taxCode: '',
    accountId: defaultAccountId,
    costCenterId: '',
  };
}

export function initialSalesInvoiceDraft(data: AccountingOverview): SalesInvoiceDraft {
  const date = today();
  const defaultAccountId = data.accounts.find((row) => row.active && row.postable && row.classification === 'REVENUE')?.id ?? '';
  return {
    postingDate: date,
    partyQuery: '',
    currency: 'EGP',
    dueDate: date,
    recognitionDate: '',
    saveMode: 'POSTED',
    paymentTerms: '',
    lines: [newLine(defaultAccountId)],
  };
}

function partyLabel(value: PartyChoice) {
  return `${value.kind === 'AGENT' ? 'مندوب' : 'عميل'} — ${value.number} — ${value.displayName}`;
}

function currencyLabel(code: string) {
  const labels: Record<string, string> = {
    EGP: '🇪🇬 EGP — الجنيه المصري',
    USD: '🇺🇸 USD — الدولار الأمريكي',
    EUR: '🇪🇺 EUR — اليورو',
    SAR: '🇸🇦 SAR — الريال السعودي',
    AED: '🇦🇪 AED — الدرهم الإماراتي',
  };
  return labels[code] ?? code;
}

async function allocateSalesInvoiceNumber(date: string) {
  const candidates = ['CUSTOMER_INVOICE', 'SALES_INVOICE', 'INVOICE'];
  let lastError: unknown;
  for (const documentType of candidates) {
    try {
      const allocated = await crmPost<AllocatedDocumentNumber>('/document-numbering/allocate', { documentType, date });
      if (allocated.value) return allocated.value;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? new Error(`تعذر تخصيص رقم فاتورة تلقائي: ${lastError.message}`)
    : new Error('تعذر تخصيص رقم فاتورة تلقائي. يلزم إعداد سياسة ترقيم للفواتير.');
}

function validateDraft(draft: SalesInvoiceDraft) {
  if (!draft.postingDate) return 'حدد تاريخ الفاتورة.';
  if (!draft.party) return 'اختر العميل أو المندوب من نتائج البحث.';
  if (!draft.currency) return 'اختر العملة.';
  if (!draft.lines.length) return 'أضف بندًا واحدًا على الأقل.';
  for (let index = 0; index < draft.lines.length; index += 1) {
    const line = draft.lines[index]!;
    if (!line.description.trim()) return `اكتب بيان البند ${index + 1}.`;
    const quantity = numberValue(line.quantity);
    const price = numberValue(line.price);
    const discount = numberValue(line.discount || '0');
    if (!Number.isFinite(quantity) || quantity <= 0) return `كمية البند ${index + 1} يجب أن تكون أكبر من صفر.`;
    if (!Number.isFinite(price) || price < 0) return `سعر البند ${index + 1} غير صالح.`;
    if (!Number.isFinite(discount) || discount < 0) return `خصم البند ${index + 1} غير صالح.`;
    if (line.discountMode === 'PERCENT' && discount > 100) return `نسبة خصم البند ${index + 1} لا يمكن أن تتجاوز 100%.`;
    if (!line.accountId) return `اختر حساب الإيراد للبند ${index + 1}.`;
  }
  return undefined;
}

export function SalesInvoiceDialog({ open, data, operate, onClose, onCreated }: SalesInvoiceDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<SalesInvoiceDraft>(() => initialSalesInvoiceDraft(data));
  const [references, setReferences] = useState<ManualInvoiceReferences>();
  const [parties, setParties] = useState<PartyChoice[]>([]);
  const [partyResultsOpen, setPartyResultsOpen] = useState(false);
  const [linesCollapsed, setLinesCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setDraft(initialSalesInvoiceDraft(data));
    setReferences(undefined);
    setLinesCollapsed(false);
    setError('');
    setLoadingReferences(true);
    let active = true;
    void Promise.all([
      crmGet<CustomerReference[]>('/crm/customers?status=ACTIVE'),
      crmGet<AgentReference[]>('/crm/agents?status=ACTIVE'),
      accountingApi.ensureManualInvoiceSetup(),
    ]).then(([customers, agents, nextReferences]) => {
      if (!active) return;
      setReferences(nextReferences);
      setParties([
        ...customers.map((value) => ({ kind: 'CUSTOMER' as const, partyId: value.customer.partyId, number: value.customer.number, displayName: value.party.displayName })),
        ...agents.map((value) => ({ kind: 'AGENT' as const, partyId: value.agent.partyId, number: value.agent.number, displayName: value.party.displayName })),
      ]);
      setDraft((current) => ({
        ...current,
        lines: current.lines.map((line) => line.accountId ? line : { ...line, accountId: nextReferences.defaultRevenueAccountId ?? '' }),
      }));
    }).catch((value: unknown) => {
      if (active) setError(value instanceof Error ? value.message : 'تعذر تجهيز بيانات الفاتورة.');
    }).finally(() => {
      if (active) setLoadingReferences(false);
    });
    return () => { active = false; };
  }, [open, data]);

  const filteredParties = useMemo(() => {
    const query = draft.partyQuery.trim().toLocaleLowerCase('ar');
    if (!query) return parties.slice(0, 8);
    return parties.filter((value) => partyLabel(value).toLocaleLowerCase('ar').includes(query)).slice(0, 8);
  }, [parties, draft.partyQuery]);

  const currencyCodes = useMemo(
    () => [...new Set(['EGP', ...data.invoices.map((row) => row.currency).filter(Boolean)])],
    [data.invoices],
  );
  const revenueAccounts = references?.revenueAccounts ?? data.accounts.filter((row) => row.active && row.postable && row.classification === 'REVENUE');
  const costCenters = references?.costCenters ?? [];

  function patchLine(id: string, patch: Partial<SalesInvoiceLineDraft>) {
    setDraft((current) => ({ ...current, lines: current.lines.map((line) => line.id === id ? { ...line, ...patch } : line) }));
  }

  function removeLine(id: string) {
    setDraft((current) => {
      const remaining = current.lines.filter((line) => line.id !== id);
      return { ...current, lines: remaining.length ? remaining : [newLine(references?.defaultRevenueAccountId ?? '')] };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!operate) return setError('لا توجد صلاحية تشغيل للمحاسبة.');
    if (loadingReferences) return setError('انتظر لحظة حتى يكتمل تجهيز الحسابات ومراكز التكلفة.');
    const validation = validateDraft(draft);
    if (validation) return setError(validation);

    setSaving(true);
    try {
      const number = await allocateSalesInvoiceNumber(draft.postingDate);
      await accountingApi.createManualInvoice({
        commandKey: crypto.randomUUID(),
        type: draft.party!.kind,
        partyId: draft.party!.partyId,
        number,
        postingDate: draft.postingDate,
        ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
        ...(draft.recognitionDate ? { recognitionDate: draft.recognitionDate } : {}),
        ...(draft.paymentTerms.trim() ? { paymentTerms: draft.paymentTerms.trim() } : {}),
        currency: draft.currency,
        saveMode: draft.saveMode,
        lines: draft.lines.map((line) => ({
          id: line.id,
          description: line.description.trim(),
          quantity: line.quantity.trim().replace(',', '.'),
          unitPrice: line.price.trim().replace(',', '.'),
          discountMode: line.discountMode,
          discount: (line.discount || '0').trim().replace(',', '.'),
          accountId: line.accountId,
          ...(line.taxCode ? { taxCode: line.taxCode } : {}),
          ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
        })),
      });
      await onCreated();
      onClose();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'تعذر حفظ الفاتورة.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{salesInvoiceVisualCss}</style>
      <dialog ref={dialogRef} className="legacy-invoice-dialog" aria-labelledby="legacy-sales-invoice-title"
        onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}>
        <form className="legacy-invoice-shell" onSubmit={submit} noValidate>
          <header className="legacy-invoice-header">
            <div className="legacy-invoice-title-group">
              <span className="legacy-invoice-icon"><Icon name="quote" size={27} /></span>
              <div><h2 id="legacy-sales-invoice-title">فاتورة مبيعات</h2><p>كل بند يمكن أن يحمل حسابًا ومركز تكلفة وضريبة مختلفة.</p></div>
            </div>
            <Button className="legacy-invoice-close" type="button" variant="ghost" onClick={onClose} aria-label="إغلاق">×</Button>
          </header>

          <main className="legacy-invoice-body">
            {error ? <div className="legacy-invoice-error" role="alert">{error}</div> : null}
            {loadingReferences ? <div className="legacy-invoice-loading">جارٍ تجهيز الحسابات ومراكز التكلفة…</div> : null}

            <section className="legacy-invoice-basic" aria-label="بيانات الفاتورة الأساسية">
              <FormField label="التاريخ" required><Input type="date" value={draft.postingDate} onChange={(event) => {
                const nextDate = event.target.value;
                setDraft((current) => ({ ...current, postingDate: nextDate, dueDate: current.dueDate === current.postingDate ? nextDate : current.dueDate }));
              }} /></FormField>

              <div className="legacy-party-picker">
                <FormField label="العميل / المندوب" required><Input autoComplete="off" placeholder="ابحث عن العميل أو المندوب..." value={draft.partyQuery}
                  onFocus={() => setPartyResultsOpen(true)} onChange={(event) => {
                    setDraft((current) => ({ ...current, party: undefined, partyQuery: event.target.value }));
                    setPartyResultsOpen(true);
                  }} /></FormField>
                {partyResultsOpen ? <div className="legacy-party-results" role="listbox" aria-label="نتائج العملاء والمندوبين">
                  {filteredParties.length ? filteredParties.map((party) => <Button key={`${party.kind}-${party.partyId}`} type="button" variant="ghost"
                    className="legacy-party-option" onClick={() => {
                      setDraft((current) => ({ ...current, party, partyQuery: partyLabel(party) }));
                      setPartyResultsOpen(false);
                    }}><strong>{party.displayName}</strong><span>{party.kind === 'AGENT' ? 'مندوب' : 'عميل'} · {party.number}</span></Button>) : <p>لا توجد نتائج مطابقة.</p>}
                </div> : null}
              </div>

              <FormField label="العملة" required><Select value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))}>
                {currencyCodes.map((code) => <option key={code} value={code}>{currencyLabel(code)}</option>)}
              </Select></FormField>

              <FormField label="تاريخ الاستحقاق" hint="يتحدد تلقائيًا من أيام ائتمان الطرف ويمكن تعديله عند الحاجة."><Input type="date" value={draft.dueDate}
                onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} /></FormField>

              <FormField label="تاريخ تنفيذ / استحقاق الإيراد" hint="اتركه فارغًا إذا كان التنفيذ في نفس تاريخ الفاتورة."><Input type="date" value={draft.recognitionDate}
                onChange={(event) => setDraft((current) => ({ ...current, recognitionDate: event.target.value }))} /></FormField>

              <fieldset className="legacy-save-mode"><legend>طريقة الحفظ</legend>
                <Button type="button" variant="secondary" className={draft.saveMode === 'DRAFT' ? 'is-selected' : ''}
                  onClick={() => setDraft((current) => ({ ...current, saveMode: 'DRAFT' }))}><span aria-hidden="true">✎</span> حفظ مسودة</Button>
                <Button type="button" className={draft.saveMode === 'POSTED' ? 'is-selected' : ''}
                  onClick={() => setDraft((current) => ({ ...current, saveMode: 'POSTED' }))}><span aria-hidden="true">✓</span> تأكيد وترحيل</Button>
              </fieldset>

              <FormField label="شروط الدفع / ملاحظات"><Textarea rows={3} value={draft.paymentTerms}
                onChange={(event) => setDraft((current) => ({ ...current, paymentTerms: event.target.value }))} /></FormField>
            </section>

            <div className="legacy-draft-note"><span aria-hidden="true">✎</span><strong>مسودة:</strong><span>قابلة للتعديل ولا تنشئ التزامًا ماليًا حتى الترحيل.</span></div>

            <section className="legacy-lines-card" aria-label="بنود الفاتورة">
              <header className="legacy-lines-header"><h3>بنود الفاتورة</h3><div>
                <Button type="button" variant="secondary" onClick={() => setDraft((current) => ({ ...current, lines: [...current.lines, newLine(references?.defaultRevenueAccountId ?? '')] }))}>+ بند</Button>
                <Button type="button" variant="ghost" onClick={() => setLinesCollapsed((value) => !value)}>{linesCollapsed ? 'فتح القسم ‹' : 'طي القسم ›'}</Button>
              </div></header>

              {!linesCollapsed ? <div className="legacy-lines-list">{draft.lines.map((line, index) => <article className="legacy-line" key={line.id}>
                <div className="legacy-line-number">بند {index + 1}</div>
                <FormField label="البيان" required><Input placeholder="وصف البند" value={line.description} onChange={(event) => patchLine(line.id, { description: event.target.value })} /></FormField>
                <div className="legacy-line-pair">
                  <FormField label="الكمية" required><Input inputMode="decimal" value={line.quantity} onChange={(event) => patchLine(line.id, { quantity: event.target.value })} /></FormField>
                  <FormField label="السعر" required><Input inputMode="decimal" placeholder="0.00" value={line.price} onChange={(event) => patchLine(line.id, { price: event.target.value })} /></FormField>
                </div>
                <FormField label="نوع الخصم"><Select value={line.discountMode} onChange={(event) => patchLine(line.id, { discountMode: event.target.value as SalesInvoiceDiscountMode })}>
                  <option value="FIXED">خصم قيمة</option><option value="PERCENT">خصم %</option>
                </Select></FormField>
                <FormField label="الخصم"><Input inputMode="decimal" placeholder="اكتب القيمة" value={line.discount} onChange={(event) => patchLine(line.id, { discount: event.target.value })} /></FormField>
                <FormField label="الضريبة"><Select value={line.taxCode} onChange={(event) => patchLine(line.id, { taxCode: event.target.value })}>
                  <option value="">TAX0 — بدون ضريبة (0%)</option>{data.taxPolicies.map((tax) => <option key={tax.id} value={tax.code}>{tax.code} — ضريبة ({tax.rate}%)</option>)}
                </Select></FormField>
                <FormField label="الحساب" required><Select value={line.accountId} onChange={(event) => patchLine(line.id, { accountId: event.target.value })}>
                  <option value="">اختر الحساب</option>{revenueAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
                </Select></FormField>
                <FormField label="مركز التكلفة"><Select value={line.costCenterId} onChange={(event) => patchLine(line.id, { costCenterId: event.target.value })}>
                  <option value="">بدون مركز</option>{costCenters.map((center) => <option key={center.id} value={center.id}>{center.code} — {center.name}</option>)}
                </Select></FormField>
                <Button type="button" variant="danger" className="legacy-line-remove" onClick={() => removeLine(line.id)} aria-label={`حذف البند ${index + 1}`}>×</Button>
              </article>)}</div> : null}
            </section>
          </main>

          <footer className="legacy-invoice-footer">
            <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
            <Button type="submit" loading={saving} disabled={!operate || loadingReferences}><span aria-hidden="true">▣</span> حفظ الفاتورة</Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

const salesInvoiceVisualCss = `
.accounting-route dialog.legacy-invoice-dialog{width:min(760px,calc(100vw - 24px));max-width:760px;height:min(920px,calc(100dvh - 24px));max-height:calc(100dvh - 24px);margin:auto;padding:0;border:1px solid #c9d4de;border-radius:26px;background:#fff;color:#1f2f43;box-shadow:0 26px 70px rgba(8,28,46,.34);overflow:hidden;direction:rtl}
.accounting-route dialog.legacy-invoice-dialog::backdrop{background:rgba(20,37,52,.58)}
.accounting-route dialog.legacy-invoice-dialog>.legacy-invoice-shell{margin:0;padding:0;width:100%;height:100%;max-height:inherit;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#fff;overflow:hidden}
.legacy-invoice-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:24px 28px 20px;border-bottom:1px solid #dfe6ec;background:#fff;position:relative;z-index:2}
.legacy-invoice-title-group{display:flex;flex-direction:row-reverse;justify-content:flex-end;align-items:flex-start;gap:18px;min-width:0;flex:1}.legacy-invoice-title-group h2{margin:0 0 6px;font-size:26px;line-height:1.25;color:#1e2c40;font-weight:800}.legacy-invoice-title-group p{margin:0;max-width:470px;color:#6e7a89;font-size:16px;line-height:1.75}
.legacy-invoice-icon{width:70px;height:70px;display:grid;place-items:center;flex:0 0 70px;border-radius:20px;background:#eaf3ff;color:#2d70a8}.legacy-invoice-close.ui-button{width:70px;height:70px;min-height:70px;flex:0 0 70px;padding:0;border:1px solid #d9e2e9;border-radius:20px;background:#fff;color:#1f2f43;font-size:38px;font-weight:300;line-height:1}
.legacy-invoice-body{min-height:0;overflow-y:auto;padding:26px 30px 34px;background:#fff;scrollbar-width:thin}.legacy-invoice-error{margin-bottom:18px;padding:12px 14px;border:1px solid #f0b7b2;border-radius:12px;background:#fff0ef;color:#9d2a22;font-size:13px;line-height:1.7}.legacy-invoice-loading{margin-bottom:18px;padding:11px 14px;border-radius:12px;background:#edf4fb;color:#526070;font-size:13px}
.legacy-invoice-basic{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 22px}.legacy-invoice-basic .ui-field,.legacy-line .ui-field{gap:9px}.legacy-invoice-basic .ui-field__label,.legacy-line .ui-field__label,.legacy-save-mode legend{color:#303b4b;font-size:15px;font-weight:800}.legacy-invoice-basic .ui-field__hint,.legacy-line .ui-field__hint{color:#98a1ab;font-size:12px;line-height:1.6;font-weight:400}.legacy-invoice-basic .ui-input,.legacy-line .ui-input{min-height:54px;padding:11px 16px;border:1px solid #d3dde5;border-radius:16px;background:#fff;color:#1e2c40;font-size:16px;box-shadow:inset 0 0 0 1px rgba(205,217,227,.22)}.legacy-invoice-basic .ui-input:focus,.legacy-line .ui-input:focus{border-color:#7ea5ca;box-shadow:0 0 0 3px rgba(54,117,174,.12);outline:0}
.legacy-party-picker{position:relative;min-width:0}.legacy-party-results{position:absolute;inset-inline:0;top:calc(100% + 6px);z-index:20;display:grid;gap:3px;max-height:250px;overflow:auto;padding:6px;border:1px solid #d5dfe8;border-radius:14px;background:#fff;box-shadow:0 16px 36px rgba(20,44,66,.18)}.legacy-party-results>p{margin:0;padding:12px;color:#778391;text-align:center}.legacy-party-option.ui-button{min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 11px;border-radius:10px;text-align:right;color:#24384b}.legacy-party-option strong{font-size:14px}.legacy-party-option span{color:#798795;font-size:12px}
.legacy-save-mode{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0;padding:0;border:0}.legacy-save-mode legend{margin-bottom:10px}.legacy-save-mode .ui-button{min-height:58px;border-radius:15px;font-size:17px;box-shadow:none}.legacy-save-mode .ui-button--secondary.is-selected{border:2px solid #a9c3dc;box-shadow:0 0 0 3px #dce9f4;background:#fff;color:#1f2f43}.legacy-save-mode .ui-button--primary.is-selected{background:#194e7e;color:#fff}.legacy-invoice-basic>.ui-field:last-child{grid-column:1/-1}.legacy-invoice-basic textarea.ui-input{min-height:76px;resize:vertical}.legacy-draft-note{display:flex;align-items:center;gap:9px;margin:20px 0;padding:15px 17px;border-radius:16px;background:#edf4fb;color:#526070;font-size:14px;line-height:1.5}.legacy-draft-note>span:first-child{font-size:20px;color:#526d89}.legacy-draft-note strong{color:#334458}
.legacy-lines-card{border:1px solid #d4dee7;border-radius:18px;background:#fbfcfd;overflow:hidden}.legacy-lines-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid #e3e9ee;background:#fff}.legacy-lines-header h3{margin:0;font-size:20px;color:#263548}.legacy-lines-header>div{display:flex;align-items:center;gap:8px}.legacy-lines-header .ui-button{min-height:44px;border-radius:12px}.legacy-lines-list{display:grid;gap:16px;padding:18px}.legacy-line{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 18px;padding:18px 18px 22px;border:1px solid #d5dfe7;border-radius:17px;background:#fff}.legacy-line-number{grid-column:1/-1;color:#607184;font-size:12px;font-weight:800}.legacy-line>.ui-field:first-of-type{grid-column:1/-1}.legacy-line-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;grid-column:1/-1}.legacy-line-remove.ui-button{grid-column:1/-1;min-height:44px;border:1px solid #efc2be;border-radius:13px;background:#fff0ef;color:#ae3026;font-size:22px;box-shadow:none}
.legacy-invoice-footer{display:flex;justify-content:flex-start;align-items:center;gap:12px;padding:18px 30px 22px;border-top:1px solid #dfe6ec;background:#fff;position:relative;z-index:3}.legacy-invoice-footer .ui-button{min-height:58px;border-radius:16px;padding-inline:26px;font-size:17px}.legacy-invoice-footer .ui-button--primary{min-width:205px;background:#194e7e}.legacy-invoice-footer .ui-button--secondary{min-width:92px;background:#fff;color:#1f2f43}
@media(max-width:760px){.accounting-route dialog.legacy-invoice-dialog{width:calc(100vw - 20px);max-width:none;height:calc(100dvh - 26px);max-height:calc(100dvh - 26px);border-radius:26px}.legacy-invoice-header{padding:24px 26px 20px}.legacy-invoice-title-group{gap:14px}.legacy-invoice-title-group h2{font-size:25px}.legacy-invoice-title-group p{font-size:15px}.legacy-invoice-icon,.legacy-invoice-close.ui-button{width:64px;height:64px;min-height:64px;flex-basis:64px;border-radius:18px}.legacy-invoice-body{padding:26px 28px 34px}.legacy-invoice-basic{grid-template-columns:1fr;gap:22px}.legacy-save-mode{grid-column:auto;grid-template-columns:1fr}.legacy-invoice-basic>.ui-field:last-child{grid-column:auto}.legacy-invoice-basic .ui-input,.legacy-line .ui-input{min-height:62px;font-size:18px;border-radius:17px;padding:13px 18px}.legacy-invoice-basic .ui-field__label,.legacy-line .ui-field__label,.legacy-save-mode legend{font-size:16px}.legacy-lines-card{border-radius:19px}.legacy-lines-header{padding:18px}.legacy-lines-header h3{font-size:22px}.legacy-lines-list{padding:16px}.legacy-line{grid-template-columns:1fr;padding:20px 20px 22px;gap:19px}.legacy-line>.ui-field:first-of-type,.legacy-line-number,.legacy-line-pair,.legacy-line-remove.ui-button{grid-column:auto}.legacy-line-pair{grid-template-columns:1fr 1fr}.legacy-invoice-footer{padding:18px 28px 22px}.legacy-invoice-footer .ui-button{min-height:62px;font-size:18px}.legacy-invoice-footer .ui-button--primary{min-width:205px}}
@media(max-width:520px){.legacy-invoice-header{padding:20px 18px 18px}.legacy-invoice-title-group{flex-direction:row;gap:12px}.legacy-invoice-icon{width:56px;height:56px;min-height:56px;flex-basis:56px}.legacy-invoice-close.ui-button{width:56px;height:56px;min-height:56px;flex-basis:56px;font-size:32px}.legacy-invoice-title-group h2{font-size:22px}.legacy-invoice-title-group p{font-size:13px;line-height:1.6}.legacy-invoice-body{padding:22px 18px 30px}.legacy-line-pair{grid-template-columns:1fr}.legacy-lines-header{align-items:flex-start}.legacy-lines-header>div{flex-wrap:wrap;justify-content:flex-start}.legacy-invoice-footer{padding:14px 18px 18px}.legacy-invoice-footer .ui-button{padding-inline:18px}.legacy-invoice-footer .ui-button--primary{min-width:0;flex:1}}
`;
