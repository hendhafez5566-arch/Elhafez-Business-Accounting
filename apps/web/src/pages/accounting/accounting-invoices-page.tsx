import * as React from 'react';
import { useCallback, useState, type FormEvent } from 'react';
import { accountingApi, type InvoiceRow } from '../../accounting-client.js';
import { Dialog, FormField, Tabs } from '../../ui.js';
import {
  AccountingHeader,
  AccountingPage,
  ActionBar,
  Button,
  Card,
  DataGrid,
  EmptyRow,
  Input,
  KpiStrip,
  ListToolbar,
  Select,
  Status,
  UnsupportedAction,
  money,
  useListControls,
  type AccountingPresentationProps,
} from './accounting-page-shared.js';

export type InvoiceTab = 'sales' | 'purchases';
export const invoicesForTab = (rows: readonly InvoiceRow[], tab: InvoiceTab) => rows.filter((row) => tab === 'sales' ? row.type === 'CUSTOMER' || row.type === 'OPENING_CUSTOMER_BALANCE' : row.type === 'SUPPLIER');

const emptyCreate = (type: 'CUSTOMER' | 'SUPPLIER') => ({ type, partyId: '', number: '', postingDate: '', dueDate: '', currency: 'EGP', controlAccountId: '', lineAccountId: '', amount: '', taxCode: '' });

export function InvoicesPage({ data, capabilities, notice, reload }: AccountingPresentationProps) {
  const [tab, setTab] = useState<InvoiceTab>('sales');
  const [createOpen, setCreateOpen] = useState(false);
  const [settleInvoice, setSettleInvoice] = useState<InvoiceRow>();
  const [cancelInvoice, setCancelInvoice] = useState<InvoiceRow>();
  const [create, setCreate] = useState(emptyCreate('CUSTOMER'));
  const [settlement, setSettlement] = useState({ treasuryId: '', number: '', postingDate: '', amount: '' });
  const [cancellation, setCancellation] = useState({ postingDate: '', number: '' });
  const [feedback, setFeedback] = useState('');
  const sourceRows = invoicesForTab(data.invoices, tab);
  const searchable = useCallback((row: InvoiceRow) => [row.number, row.partyId, row.postingDate, row.dueDate, row.status, row.sourceId], []);
  const sortable = useCallback((row: InvoiceRow) => `${row.postingDate}-${row.number}`, []);
  const { controls, setControls, visibleRows } = useListControls(sourceRows, searchable, sortable);

  function changeTab(id: string) {
    const next = id as InvoiceTab;
    setTab(next);
    setCreate(emptyCreate(next === 'sales' ? 'CUSTOMER' : 'SUPPLIER'));
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    await accountingApi.createInvoice({
      commandKey: crypto.randomUUID(),
      type: create.type,
      partyId: create.partyId,
      number: create.number,
      postingDate: create.postingDate,
      ...(create.dueDate ? { dueDate: create.dueDate } : {}),
      currency: create.currency,
      controlAccountId: create.controlAccountId,
      lines: [{ accountId: create.lineAccountId, amount: create.amount, ...(create.taxCode ? { taxCode: create.taxCode } : {}) }],
    });
    setCreateOpen(false);
    setFeedback('تم إنشاء الفاتورة وترحيلها عبر Billing/Subledgers.');
    await reload();
  }

  async function submitSettlement(event: FormEvent) {
    event.preventDefault();
    if (!settleInvoice) return;
    await accountingApi.postSettlement({ commandKey: crypto.randomUUID(), invoiceId: settleInvoice.id, ...settlement });
    setSettleInvoice(undefined);
    setFeedback('تم تسجيل التحصيل أو السداد عبر Treasury وBilling.');
    await reload();
  }

  async function submitCancellation(event: FormEvent) {
    event.preventDefault();
    if (!cancelInvoice) return;
    await accountingApi.cancelInvoice(cancelInvoice.id, cancellation);
    setCancelInvoice(undefined);
    setFeedback('تم إلغاء الفاتورة بقيد عكسي من المالك المحاسبي.');
    await reload();
  }

  return (
    <AccountingPage accent="blue">
      <AccountingHeader title="الفواتير" reload={reload} notice={feedback || notice}>
        <Button disabled={!capabilities.operate} onClick={() => setCreateOpen(true)}>{tab === 'sales' ? '+ فاتورة مبيعات' : '+ فاتورة مورد'}</Button>
      </AccountingHeader>
      <Tabs tabs={[{ id: 'sales', label: `المبيعات (${invoicesForTab(data.invoices, 'sales').length})` }, { id: 'purchases', label: `المشتريات (${invoicesForTab(data.invoices, 'purchases').length})` }]} active={tab} onChange={changeTab} />
      <KpiStrip items={[["كل الفواتير", sourceRows.length], ["مفتوحة", sourceRows.filter((row) => row.outstanding !== '0').length], ["متأخرة", sourceRows.filter((row) => Boolean(row.dueDate) && row.outstanding !== '0').length], ["مدفوعة", sourceRows.filter((row) => row.outstanding === '0').length]]} />
      <Card>
        <ListToolbar controls={controls} onChange={setControls} placeholder="رقم الفاتورة أو الطرف أو التاريخ" />
        <DataGrid columns={['الفاتورة', 'الطرف', 'الإجمالي', 'المتبقي', 'الاستحقاق', 'الحالة', 'إجراء']}>
          {visibleRows.length ? visibleRows.map((row) => <InvoiceRowActions key={row.id} row={row} operate={capabilities.operate} onSettle={setSettleInvoice} onCancel={setCancelInvoice} />) : <EmptyRow columns={7} />}
        </DataGrid>
      </Card>
      <InvoiceCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} value={create} onChange={setCreate} data={data} onSubmit={submitCreate} />
      <SettlementDialog invoice={settleInvoice} onClose={() => setSettleInvoice(undefined)} value={settlement} onChange={setSettlement} treasuries={data.treasuries} onSubmit={submitSettlement} />
      <CancellationDialog invoice={cancelInvoice} onClose={() => setCancelInvoice(undefined)} value={cancellation} onChange={setCancellation} onSubmit={submitCancellation} />
    </AccountingPage>
  );
}

function InvoiceRowActions({ row, operate, onSettle, onCancel }: { readonly row: InvoiceRow; readonly operate: boolean; readonly onSettle: (row: InvoiceRow) => void; readonly onCancel: (row: InvoiceRow) => void }) {
  const draft = row.status === 'DRAFT';
  const posted = row.status === 'POSTED';
  return <tr><td>{row.number}</td><td>{row.partyId}</td><td>{money(row.baseTotal, row.currency)}</td><td>{money(row.outstanding, row.currency)}</td><td>{row.dueDate ?? '—'}</td><td><Status value={row.status} /></td><td><ActionBar>{draft ? <UnsupportedAction reason="Billing لا يوفر عقد ترحيل مسودة منفصلًا">ترحيل</UnsupportedAction> : null}{posted && row.outstanding !== '0' ? <Button variant="secondary" disabled={!operate} onClick={() => onSettle(row)}>{row.type === 'SUPPLIER' ? 'سداد' : 'تحصيل'}</Button> : null}<Button variant="ghost" onClick={() => window.print()}>طباعة</Button>{draft ? <UnsupportedAction reason="لا يوجد عقد تعديل مسودة">تعديل</UnsupportedAction> : null}<UnsupportedAction reason="لا يوجد عقد إشعار دائن/مدين في واجهة Accounting الحالية">إشعار دائن/مدين</UnsupportedAction>{posted ? <Button variant="danger" disabled={!operate} onClick={() => onCancel(row)}>إلغاء</Button> : null}</ActionBar></td></tr>;
}

function InvoiceCreateDialog({ open, onClose, value, onChange, data, onSubmit }: { readonly open: boolean; readonly onClose: () => void; readonly value: ReturnType<typeof emptyCreate>; readonly onChange: (value: ReturnType<typeof emptyCreate>) => void; readonly data: AccountingPresentationProps['data']; readonly onSubmit: (event: FormEvent) => void }) {
  return <Dialog open={open} title={value.type === 'CUSTOMER' ? 'فاتورة مبيعات' : 'فاتورة مورد'} onClose={onClose}><form className="accounting-form" onSubmit={onSubmit}><FormField label="الطرف" required><Input required value={value.partyId} onChange={(event) => onChange({ ...value, partyId: event.target.value })} /></FormField><FormField label="رقم الفاتورة" required><Input required value={value.number} onChange={(event) => onChange({ ...value, number: event.target.value })} /></FormField><FormField label="تاريخ الترحيل" required><Input required type="date" value={value.postingDate} onChange={(event) => onChange({ ...value, postingDate: event.target.value })} /></FormField><FormField label="الاستحقاق"><Input type="date" value={value.dueDate} onChange={(event) => onChange({ ...value, dueDate: event.target.value })} /></FormField><FormField label="العملة" required><Input required value={value.currency} onChange={(event) => onChange({ ...value, currency: event.target.value.toUpperCase() })} /></FormField><FormField label="حساب الرقابة" required><Select required value={value.controlAccountId} onChange={(event) => onChange({ ...value, controlAccountId: event.target.value })}><option value="">اختر</option>{data.accounts.filter((row) => row.active && row.postable).map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}</Select></FormField><FormField label="حساب البند" required><Select required value={value.lineAccountId} onChange={(event) => onChange({ ...value, lineAccountId: event.target.value })}><option value="">اختر</option>{data.accounts.filter((row) => row.active && row.postable).map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}</Select></FormField><FormField label="المبلغ" required><Input required inputMode="decimal" value={value.amount} onChange={(event) => onChange({ ...value, amount: event.target.value })} /></FormField><FormField label="كود الضريبة"><Input value={value.taxCode} onChange={(event) => onChange({ ...value, taxCode: event.target.value.toUpperCase() })} /></FormField><footer className="ui-dialog__footer"><Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button><Button type="submit">إنشاء وترحيل</Button></footer></form></Dialog>;
}

function SettlementDialog({ invoice, onClose, value, onChange, treasuries, onSubmit }: { readonly invoice?: InvoiceRow; readonly onClose: () => void; readonly value: { treasuryId: string; number: string; postingDate: string; amount: string }; readonly onChange: (value: { treasuryId: string; number: string; postingDate: string; amount: string }) => void; readonly treasuries: AccountingPresentationProps['data']['treasuries']; readonly onSubmit: (event: FormEvent) => void }) {
  return <Dialog open={Boolean(invoice)} title={invoice?.type === 'SUPPLIER' ? 'سداد فاتورة مورد' : 'تحصيل فاتورة عميل'} onClose={onClose}><form className="accounting-form" onSubmit={onSubmit}><p>{invoice?.number} — {invoice?.partyId}</p><FormField label="الخزينة / البنك" required><Select required value={value.treasuryId} onChange={(event) => onChange({ ...value, treasuryId: event.target.value })}><option value="">اختر</option>{treasuries.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}</Select></FormField><FormField label="رقم المستند" required><Input required value={value.number} onChange={(event) => onChange({ ...value, number: event.target.value })} /></FormField><FormField label="التاريخ" required><Input required type="date" value={value.postingDate} onChange={(event) => onChange({ ...value, postingDate: event.target.value })} /></FormField><FormField label="المبلغ" required><Input required inputMode="decimal" value={value.amount} onChange={(event) => onChange({ ...value, amount: event.target.value })} /></FormField><footer className="ui-dialog__footer"><Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button><Button type="submit">ترحيل التسوية</Button></footer></form></Dialog>;
}

function CancellationDialog({ invoice, onClose, value, onChange, onSubmit }: { readonly invoice?: InvoiceRow; readonly onClose: () => void; readonly value: { postingDate: string; number: string }; readonly onChange: (value: { postingDate: string; number: string }) => void; readonly onSubmit: (event: FormEvent) => void }) {
  return <Dialog open={Boolean(invoice)} title="إلغاء فاتورة بقيد عكسي" onClose={onClose}><form className="accounting-form" onSubmit={onSubmit}><p>{invoice?.number} — لا تُحذف الفاتورة أو تاريخها.</p><FormField label="تاريخ الإلغاء" required><Input required type="date" value={value.postingDate} onChange={(event) => onChange({ ...value, postingDate: event.target.value })} /></FormField><FormField label="رقم القيد العكسي" required><Input required value={value.number} onChange={(event) => onChange({ ...value, number: event.target.value })} /></FormField><footer className="ui-dialog__footer"><Button variant="secondary" type="button" onClick={onClose}>تراجع</Button><Button variant="danger" type="submit">إلغاء محاسبي</Button></footer></form></Dialog>;
}
