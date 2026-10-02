import * as React from 'react';
import { useCallback, useState, type FormEvent } from 'react';
import { accountingApi, type InvoiceRow } from '../../accounting-client.js';
import { crmPost } from '../../crm-core-client.js';
import { Dialog, FormField, Tabs } from '../../ui.js';
import { SalesInvoiceDialog } from './accounting-sales-invoice-dialog.js';
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
  money,
  useListControls,
  type AccountingPresentationProps,
} from './accounting-page-shared.js';

export type InvoiceTab = 'sales' | 'purchases';
export const invoicesForTab = (rows: readonly InvoiceRow[], tab: InvoiceTab) => rows.filter((row) => tab === 'sales' ? row.type === 'CUSTOMER' || row.type === 'AGENT' || row.type === 'OPENING_CUSTOMER_BALANCE' : row.type === 'SUPPLIER');

const emptySupplierCreate = () => ({
  partyId: '',
  number: '',
  externalInvoiceNumber: '',
  postingDate: '',
  dueDate: '',
  currency: 'EGP',
  controlAccountId: '',
  lineAccountId: '',
  amount: '',
  taxCode: '',
});

const emptyAdjustment = () => ({
  kind: 'CREDIT_NOTE' as 'CREDIT_NOTE' | 'DEBIT_NOTE',
  amount: '',
  postingDate: '',
  number: '',
  offsetAccountId: '',
});

export function InvoicesPage({ data, capabilities, notice, reload }: AccountingPresentationProps) {
  const [tab, setTab] = useState<InvoiceTab>('sales');
  const [createOpen, setCreateOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<InvoiceRow>();
  const [settleInvoice, setSettleInvoice] = useState<InvoiceRow>();
  const [cancelInvoice, setCancelInvoice] = useState<InvoiceRow>();
  const [adjustInvoice, setAdjustInvoice] = useState<InvoiceRow>();
  const [supplierCreate, setSupplierCreate] = useState(emptySupplierCreate());
  const [settlement, setSettlement] = useState({ treasuryId: '', number: '', postingDate: '', amount: '' });
  const [cancellation, setCancellation] = useState({ postingDate: '', number: '' });
  const [adjustment, setAdjustment] = useState(emptyAdjustment());
  const [feedback, setFeedback] = useState('');
  const sourceRows = invoicesForTab(data.invoices, tab);
  const searchable = useCallback((row: InvoiceRow) => [row.number, row.partyId, row.postingDate, row.dueDate, row.status, row.sourceId], []);
  const sortable = useCallback((row: InvoiceRow) => `${row.postingDate}-${row.number}`, []);
  const { controls, setControls, visibleRows } = useListControls(sourceRows, searchable, sortable);

  function changeTab(id: string) {
    const next = id as InvoiceTab;
    setCreateOpen(false);
    setEditInvoice(undefined);
    setTab(next);
    setSupplierCreate(emptySupplierCreate());
  }

  async function submitSupplierCreate(event: FormEvent) {
    event.preventDefault();
    await accountingApi.createInvoice({
      commandKey: crypto.randomUUID(),
      type: 'SUPPLIER',
      partyId: supplierCreate.partyId,
      number: supplierCreate.number,
      externalInvoiceNumber: supplierCreate.externalInvoiceNumber,
      postingDate: supplierCreate.postingDate,
      ...(supplierCreate.dueDate ? { dueDate: supplierCreate.dueDate } : {}),
      currency: supplierCreate.currency,
      controlAccountId: supplierCreate.controlAccountId,
      lines: [{
        accountId: supplierCreate.lineAccountId,
        amount: supplierCreate.amount,
        ...(supplierCreate.taxCode ? { taxCode: supplierCreate.taxCode } : {}),
      }],
    });
    setCreateOpen(false);
    setSupplierCreate(emptySupplierCreate());
    setFeedback('تم إنشاء فاتورة المورد وترحيلها عبر Billing/Subledgers.');
    await reload();
  }

  async function submitSettlement(event: FormEvent) {
    event.preventDefault();
    if (!settleInvoice) return;
    if (settleInvoice.type === 'AGENT') {
      await crmPost('/crm/financial/receipts', {
        commandKey: crypto.randomUUID(),
        partyKind: 'AGENT',
        partyId: settleInvoice.partyId,
        invoiceId: settleInvoice.id,
        treasuryId: settlement.treasuryId,
        number: settlement.number,
        postingDate: settlement.postingDate,
        amount: settlement.amount,
      });
    } else {
      await accountingApi.postSettlement({ commandKey: crypto.randomUUID(), invoiceId: settleInvoice.id, ...settlement });
    }
    setSettleInvoice(undefined);
    setSettlement({ treasuryId: '', number: '', postingDate: '', amount: '' });
    setFeedback('تم تسجيل التحصيل أو السداد عبر Treasury وBilling.');
    await reload();
  }

  async function postDraft(row: InvoiceRow) {
    await accountingApi.postManualInvoice(row.id);
    setFeedback(`تم ترحيل المسودة ${row.number} وإنشاء القيد المحاسبي.`);
    await reload();
  }

  async function cancelDraft(row: InvoiceRow) {
    await accountingApi.cancelManualInvoice(row.id, {});
    setFeedback(`تم إلغاء المسودة ${row.number} بدون إنشاء قيد مالي.`);
    await reload();
  }

  async function submitCancellation(event: FormEvent) {
    event.preventDefault();
    if (!cancelInvoice) return;
    await accountingApi.cancelManualInvoice(cancelInvoice.id, cancellation);
    setCancelInvoice(undefined);
    setCancellation({ postingDate: '', number: '' });
    setFeedback('تم إلغاء الفاتورة بقيد عكسي من المالك المحاسبي.');
    await reload();
  }

  async function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    if (!adjustInvoice) return;
    await accountingApi.createManualInvoiceAdjustment(adjustInvoice.id, {
      commandKey: crypto.randomUUID(),
      kind: adjustment.kind,
      amount: adjustment.amount,
      postingDate: adjustment.postingDate,
      number: adjustment.number,
      offsetAccountId: adjustment.offsetAccountId,
    });
    setAdjustInvoice(undefined);
    setAdjustment(emptyAdjustment());
    setFeedback(adjustment.kind === 'CREDIT_NOTE' ? 'تم تسجيل الإشعار الدائن.' : 'تم تسجيل الإشعار المدين.');
    await reload();
  }

  async function salesInvoiceSaved() {
    setCreateOpen(false);
    setEditInvoice(undefined);
    setFeedback('تم حفظ فاتورة المبيعات عبر Billing/Subledgers مع كامل بيانات البنود.');
    await reload();
  }

  function openAdjustment(row: InvoiceRow) {
    const defaultOffset = data.accounts.find((account) => account.active && account.postable && account.classification === 'REVENUE')?.id ?? '';
    setAdjustment({ ...emptyAdjustment(), postingDate: row.postingDate, offsetAccountId: defaultOffset });
    setAdjustInvoice(row);
  }

  return (
    <AccountingPage accent="blue">
      <AccountingHeader title="الفواتير" reload={reload} notice={feedback || notice}>
        <Button disabled={!capabilities.operate} onClick={() => { setEditInvoice(undefined); setCreateOpen(true); }}>
          {tab === 'sales' ? '+ فاتورة مبيعات' : '+ فاتورة مورد'}
        </Button>
      </AccountingHeader>
      <Tabs
        tabs={[
          { id: 'sales', label: `المبيعات (${invoicesForTab(data.invoices, 'sales').length})` },
          { id: 'purchases', label: `المشتريات (${invoicesForTab(data.invoices, 'purchases').length})` },
        ]}
        active={tab}
        onChange={changeTab}
      />
      <KpiStrip items={[
        ['كل الفواتير', sourceRows.length],
        ['مفتوحة', sourceRows.filter((row) => row.outstanding !== '0').length],
        ['متأخرة', sourceRows.filter((row) => Boolean(row.dueDate) && row.outstanding !== '0').length],
        ['مدفوعة', sourceRows.filter((row) => row.outstanding === '0').length],
      ]} />
      <Card>
        <ListToolbar controls={controls} onChange={setControls} placeholder="رقم الفاتورة أو الطرف أو التاريخ" />
        <DataGrid columns={['الفاتورة', 'الطرف', 'الإجمالي', 'المتبقي', 'الاستحقاق', 'الحالة', 'إجراء']}>
          {visibleRows.length
            ? visibleRows.map((row) => <InvoiceRowActions
              key={row.id}
              row={row}
              operate={capabilities.operate}
              onSettle={setSettleInvoice}
              onCancel={setCancelInvoice}
              onPost={postDraft}
              onEdit={setEditInvoice}
              onCancelDraft={cancelDraft}
              onAdjustment={openAdjustment}
            />)
            : <EmptyRow columns={7} />}
        </DataGrid>
      </Card>

      <SalesInvoiceDialog
        open={(createOpen && tab === 'sales') || Boolean(editInvoice)}
        data={data}
        operate={capabilities.operate}
        invoice={editInvoice}
        onClose={() => { setCreateOpen(false); setEditInvoice(undefined); }}
        onCreated={salesInvoiceSaved}
      />
      <SupplierInvoiceCreateDialog
        open={createOpen && tab === 'purchases'}
        onClose={() => setCreateOpen(false)}
        value={supplierCreate}
        onChange={setSupplierCreate}
        data={data}
        onSubmit={submitSupplierCreate}
      />
      <SettlementDialog invoice={settleInvoice} onClose={() => setSettleInvoice(undefined)} value={settlement} onChange={setSettlement} treasuries={data.treasuries} onSubmit={submitSettlement} />
      <CancellationDialog invoice={cancelInvoice} onClose={() => setCancelInvoice(undefined)} value={cancellation} onChange={setCancellation} onSubmit={submitCancellation} />
      <AdjustmentDialog invoice={adjustInvoice} onClose={() => setAdjustInvoice(undefined)} value={adjustment} onChange={setAdjustment} accounts={data.accounts} onSubmit={submitAdjustment} />
    </AccountingPage>
  );
}

function InvoiceRowActions({ row, operate, onSettle, onCancel, onPost, onEdit, onCancelDraft, onAdjustment }: {
  readonly row: InvoiceRow;
  readonly operate: boolean;
  readonly onSettle: (row: InvoiceRow) => void;
  readonly onCancel: (row: InvoiceRow) => void;
  readonly onPost: (row: InvoiceRow) => Promise<void>;
  readonly onEdit: (row: InvoiceRow) => void;
  readonly onCancelDraft: (row: InvoiceRow) => Promise<void>;
  readonly onAdjustment: (row: InvoiceRow) => void;
}) {
  const draft = row.status === 'DRAFT';
  const posted = row.status === 'POSTED';
  const editableSalesDraft = draft && (row.type === 'CUSTOMER' || row.type === 'AGENT');
  return (
    <tr>
      <td>{row.number}</td>
      <td>{row.partyId}</td>
      <td>{money(row.baseTotal, row.currency)}</td>
      <td>{money(row.outstanding, row.currency)}</td>
      <td>{row.dueDate ?? '—'}</td>
      <td><Status value={row.status} /></td>
      <td>
        <ActionBar>
          {draft ? <Button disabled={!operate} onClick={() => void onPost(row)}>ترحيل</Button> : null}
          {posted && row.outstanding !== '0'
            ? <Button variant="secondary" disabled={!operate} onClick={() => onSettle(row)}>{row.type === 'SUPPLIER' ? 'سداد' : 'تحصيل'}</Button>
            : null}
          <Button variant="ghost" onClick={() => window.print()}>طباعة</Button>
          {editableSalesDraft ? <Button variant="secondary" disabled={!operate} onClick={() => onEdit(row)}>تعديل</Button> : null}
          {posted ? <Button variant="secondary" disabled={!operate} onClick={() => onAdjustment(row)}>إشعار دائن/مدين</Button> : null}
          {draft
            ? <Button variant="danger" disabled={!operate} onClick={() => void onCancelDraft(row)}>إلغاء المسودة</Button>
            : posted ? <Button variant="danger" disabled={!operate} onClick={() => onCancel(row)}>إلغاء</Button> : null}
        </ActionBar>
      </td>
    </tr>
  );
}

function SupplierInvoiceCreateDialog({ open, onClose, value, onChange, data, onSubmit }: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly value: ReturnType<typeof emptySupplierCreate>;
  readonly onChange: (value: ReturnType<typeof emptySupplierCreate>) => void;
  readonly data: AccountingPresentationProps['data'];
  readonly onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Dialog open={open} title="فاتورة مورد" onClose={onClose}>
      <form className="accounting-form" onSubmit={onSubmit}>
        <FormField label="المورد" required><Input required value={value.partyId} onChange={(event) => onChange({ ...value, partyId: event.target.value })} /></FormField>
        <FormField label="رقم الفاتورة الداخلي" required><Input required value={value.number} onChange={(event) => onChange({ ...value, number: event.target.value })} /></FormField>
        <FormField label="رقم فاتورة المورد" required><Input required value={value.externalInvoiceNumber} onChange={(event) => onChange({ ...value, externalInvoiceNumber: event.target.value })} /></FormField>
        <FormField label="تاريخ الترحيل" required><Input required type="date" value={value.postingDate} onChange={(event) => onChange({ ...value, postingDate: event.target.value })} /></FormField>
        <FormField label="الاستحقاق"><Input type="date" value={value.dueDate} onChange={(event) => onChange({ ...value, dueDate: event.target.value })} /></FormField>
        <FormField label="العملة" required><Input required value={value.currency} onChange={(event) => onChange({ ...value, currency: event.target.value.toUpperCase() })} /></FormField>
        <FormField label="حساب المورد" required>
          <Select required value={value.controlAccountId} onChange={(event) => onChange({ ...value, controlAccountId: event.target.value })}>
            <option value="">اختر</option>
            {data.accounts.filter((row) => row.active && row.postable).map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}
          </Select>
        </FormField>
        <FormField label="حساب البند" required>
          <Select required value={value.lineAccountId} onChange={(event) => onChange({ ...value, lineAccountId: event.target.value })}>
            <option value="">اختر</option>
            {data.accounts.filter((row) => row.active && row.postable).map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}
          </Select>
        </FormField>
        <FormField label="المبلغ" required><Input required inputMode="decimal" value={value.amount} onChange={(event) => onChange({ ...value, amount: event.target.value })} /></FormField>
        <FormField label="كود الضريبة"><Input value={value.taxCode} onChange={(event) => onChange({ ...value, taxCode: event.target.value.toUpperCase() })} /></FormField>
        <footer className="ui-dialog__footer"><Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button><Button type="submit">إنشاء وترحيل</Button></footer>
      </form>
    </Dialog>
  );
}

function SettlementDialog({ invoice, onClose, value, onChange, treasuries, onSubmit }: { readonly invoice?: InvoiceRow; readonly onClose: () => void; readonly value: { treasuryId: string; number: string; postingDate: string; amount: string }; readonly onChange: (value: { treasuryId: string; number: string; postingDate: string; amount: string }) => void; readonly treasuries: AccountingPresentationProps['data']['treasuries']; readonly onSubmit: (event: FormEvent) => void }) {
  return <Dialog open={Boolean(invoice)} title={invoice?.type === 'SUPPLIER' ? 'سداد فاتورة مورد' : 'تحصيل فاتورة عميل / مندوب'} onClose={onClose}><form className="accounting-form" onSubmit={onSubmit}><p>{invoice?.number} — {invoice?.partyId}</p><FormField label="الخزينة / البنك" required><Select required value={value.treasuryId} onChange={(event) => onChange({ ...value, treasuryId: event.target.value })}><option value="">اختر</option>{treasuries.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}</Select></FormField><FormField label="رقم المستند" required><Input required value={value.number} onChange={(event) => onChange({ ...value, number: event.target.value })} /></FormField><FormField label="التاريخ" required><Input required type="date" value={value.postingDate} onChange={(event) => onChange({ ...value, postingDate: event.target.value })} /></FormField><FormField label="المبلغ" required><Input required inputMode="decimal" value={value.amount} onChange={(event) => onChange({ ...value, amount: event.target.value })} /></FormField><footer className="ui-dialog__footer"><Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button><Button type="submit">ترحيل التسوية</Button></footer></form></Dialog>;
}

function CancellationDialog({ invoice, onClose, value, onChange, onSubmit }: { readonly invoice?: InvoiceRow; readonly onClose: () => void; readonly value: { postingDate: string; number: string }; readonly onChange: (value: { postingDate: string; number: string }) => void; readonly onSubmit: (event: FormEvent) => void }) {
  return <Dialog open={Boolean(invoice)} title="إلغاء فاتورة بقيد عكسي" onClose={onClose}><form className="accounting-form" onSubmit={onSubmit}><p>{invoice?.number} — لا تُحذف الفاتورة أو تاريخها.</p><FormField label="تاريخ الإلغاء" required><Input required type="date" value={value.postingDate} onChange={(event) => onChange({ ...value, postingDate: event.target.value })} /></FormField><FormField label="رقم القيد العكسي" required><Input required value={value.number} onChange={(event) => onChange({ ...value, number: event.target.value })} /></FormField><footer className="ui-dialog__footer"><Button variant="secondary" type="button" onClick={onClose}>تراجع</Button><Button variant="danger" type="submit">إلغاء محاسبي</Button></footer></form></Dialog>;
}

function AdjustmentDialog({ invoice, onClose, value, onChange, accounts, onSubmit }: {
  readonly invoice?: InvoiceRow;
  readonly onClose: () => void;
  readonly value: ReturnType<typeof emptyAdjustment>;
  readonly onChange: (value: ReturnType<typeof emptyAdjustment>) => void;
  readonly accounts: AccountingPresentationProps['data']['accounts'];
  readonly onSubmit: (event: FormEvent) => void;
}) {
  return <Dialog open={Boolean(invoice)} title="إشعار دائن / مدين" onClose={onClose}><form className="accounting-form" onSubmit={onSubmit}>
    <p>{invoice?.number} — {invoice?.partyId}</p>
    <FormField label="نوع الإشعار" required><Select value={value.kind} onChange={(event) => onChange({ ...value, kind: event.target.value as 'CREDIT_NOTE' | 'DEBIT_NOTE' })}><option value="CREDIT_NOTE">إشعار دائن</option><option value="DEBIT_NOTE">إشعار مدين</option></Select></FormField>
    <FormField label="المبلغ" required><Input required inputMode="decimal" value={value.amount} onChange={(event) => onChange({ ...value, amount: event.target.value })} /></FormField>
    <FormField label="التاريخ" required><Input required type="date" value={value.postingDate} onChange={(event) => onChange({ ...value, postingDate: event.target.value })} /></FormField>
    <FormField label="رقم المستند" required><Input required value={value.number} onChange={(event) => onChange({ ...value, number: event.target.value })} /></FormField>
    <FormField label="الحساب المقابل" required><Select required value={value.offsetAccountId} onChange={(event) => onChange({ ...value, offsetAccountId: event.target.value })}><option value="">اختر الحساب</option>{accounts.filter((account) => account.active && account.postable).map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</Select></FormField>
    <footer className="ui-dialog__footer"><Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button><Button type="submit">ترحيل الإشعار</Button></footer>
  </form></Dialog>;
}
