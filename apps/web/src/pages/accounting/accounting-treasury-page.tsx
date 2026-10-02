import * as React from 'react';
import { useCallback, useState, type FormEvent } from 'react';
import { accountingApi, type TreasuryRow } from '../../accounting-client.js';
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
  ListToolbar,
  Select,
  UnsupportedAction,
  useListControls,
  type AccountingPresentationProps,
} from './accounting-page-shared.js';

export type TreasuryTab = 'accounts' | 'transfers' | 'reconciliation';
export function treasuryTabLabel(tab: TreasuryTab) {
  return tab === 'accounts' ? 'الحسابات' : tab === 'transfers' ? 'التحويلات' : 'المطابقة البنكية';
}

export function TreasuryPage({ data, capabilities, notice, reload }: AccountingPresentationProps) {
  const [tab, setTab] = useState<TreasuryTab>('accounts');
  const [dialog, setDialog] = useState<'account' | 'transfer'>();
  const [feedback, setFeedback] = useState('');
  const [account, setAccount] = useState({ code: '', name: '', type: 'CASH' as 'CASH' | 'BANK', currency: 'EGP', glAccountId: '' });
  const [transfer, setTransfer] = useState({ sourceTreasuryId: '', destinationTreasuryId: '', amount: '', postingDate: '', number: '' });
  const searchable = useCallback((row: TreasuryRow) => [row.code, row.name, row.type, row.currency], []);
  const sortable = useCallback((row: TreasuryRow) => `${row.name}-${row.code}`, []);
  const { controls, setControls, visibleRows } = useListControls(data.treasuries, searchable, sortable);

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    await accountingApi.createTreasury(account);
    setDialog(undefined);
    setFeedback('تم إنشاء الخزينة أو الحساب البنكي عبر Treasury.');
    await reload();
  }

  async function createTransfer(event: FormEvent) {
    event.preventDefault();
    await accountingApi.transferBetweenTreasuries({ commandKey: crypto.randomUUID(), ...transfer });
    setDialog(undefined);
    setFeedback('تم ترحيل التحويل بين الخزائن عبر Treasury.');
    await reload();
  }

  return (
    <AccountingPage accent="emerald">
      <AccountingHeader title="الخزينة والبنوك" reload={reload} notice={feedback || notice}>
        {tab === 'accounts' ? <Button disabled={!capabilities.operate} onClick={() => setDialog('account')}>+ خزنة / بنك</Button> : null}
        {tab === 'transfers' ? <Button disabled={!capabilities.operate} onClick={() => setDialog('transfer')}>+ تحويل</Button> : null}
        {tab === 'reconciliation' ? <><UnsupportedAction reason="استيراد كشف البنك غير متاح كملف من عقد الويب الحالي">استيراد كشف</UnsupportedAction><UnsupportedAction reason="المطابقة التلقائية غير متاحة في عقد الويب الحالي">مطابقة</UnsupportedAction></> : null}
      </AccountingHeader>
      <Tabs tabs={(['accounts', 'transfers', 'reconciliation'] as const).map((id) => ({ id, label: treasuryTabLabel(id) }))} active={tab} onChange={(id) => setTab(id as TreasuryTab)} />
      {tab === 'accounts' ? <AccountsTab rows={visibleRows} controls={controls} setControls={setControls} /> : null}
      {tab === 'transfers' ? <TransfersTab /> : null}
      {tab === 'reconciliation' ? <ReconciliationTab /> : null}
      <AccountDialog open={dialog === 'account'} onClose={() => setDialog(undefined)} value={account} onChange={setAccount} accounts={data.accounts} onSubmit={createAccount} />
      <TransferDialog open={dialog === 'transfer'} onClose={() => setDialog(undefined)} value={transfer} onChange={setTransfer} treasuries={data.treasuries} onSubmit={createTransfer} />
    </AccountingPage>
  );
}

function AccountsTab({ rows, controls, setControls }: { readonly rows: readonly TreasuryRow[]; readonly controls: Parameters<typeof ListToolbar>[0]['controls']; readonly setControls: Parameters<typeof ListToolbar>[0]['onChange'] }) {
  return <><section className="accounting-balance-cards">{rows.map((row) => <Card key={row.id} title={row.name}><strong>{row.currency}</strong><small>{row.type === 'BANK' ? 'بنك' : 'خزينة'} · {row.active ? 'نشط' : 'متوقف'}</small></Card>)}</section><Card title="الحسابات"><ListToolbar controls={controls} onChange={setControls} placeholder="ابحث باسم الحساب أو الكود أو العملة" /><DataGrid columns={['الحساب', 'النوع', 'العملة', 'الرصيد', 'الحالة', 'إجراء']}>{rows.length ? rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.type === 'BANK' ? 'بنك' : 'خزينة'}</td><td>{row.currency}</td><td>من دفتر الأستاذ</td><td>{row.active ? 'نشط' : 'متوقف'}</td><td><ActionBar><Button variant="ghost">كشف الحركة</Button><UnsupportedAction reason="لا يوجد عقد تعديل خزينة">تعديل</UnsupportedAction><UnsupportedAction reason="لا يوجد عقد تشغيل/إيقاف خزينة">تشغيل/إيقاف</UnsupportedAction></ActionBar></td></tr>) : <EmptyRow columns={6} />}</DataGrid></Card></>;
}

function TransfersTab() {
  return <Card title="التحويلات"><DataGrid columns={['التحويل', 'من', 'المبلغ', 'إلى', 'المستلم', 'الحالة', 'إجراء']}><EmptyRow columns={7} label="لا يعرض عقد الملخص الحالي قائمة التحويلات" /></DataGrid></Card>;
}

function ReconciliationTab() {
  return <Card title="المطابقة البنكية"><DataGrid columns={['المطابقة', 'البنك', 'رصيد النظام', 'كشف البنك', 'الفرق', 'الحالة']}><EmptyRow columns={6} label="اختر بنكًا واستورد كشفًا عند توفر عقد الاستيراد" /></DataGrid></Card>;
}

function AccountDialog({ open, onClose, value, onChange, accounts, onSubmit }: { readonly open: boolean; readonly onClose: () => void; readonly value: { code: string; name: string; type: 'CASH' | 'BANK'; currency: string; glAccountId: string }; readonly onChange: (value: { code: string; name: string; type: 'CASH' | 'BANK'; currency: string; glAccountId: string }) => void; readonly accounts: AccountingPresentationProps['data']['accounts']; readonly onSubmit: (event: FormEvent) => void }) {
  return <Dialog open={open} title="خزنة / بنك جديد" onClose={onClose}><form className="accounting-form" onSubmit={onSubmit}><FormField label="الكود" required><Input required value={value.code} onChange={(event) => onChange({ ...value, code: event.target.value })} /></FormField><FormField label="الاسم" required><Input required value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} /></FormField><FormField label="النوع"><Select value={value.type} onChange={(event) => onChange({ ...value, type: event.target.value as 'CASH' | 'BANK' })}><option value="CASH">خزينة</option><option value="BANK">بنك</option></Select></FormField><FormField label="العملة" required><Input required value={value.currency} onChange={(event) => onChange({ ...value, currency: event.target.value.toUpperCase() })} /></FormField><FormField label="حساب الأستاذ" required><Select required value={value.glAccountId} onChange={(event) => onChange({ ...value, glAccountId: event.target.value })}><option value="">اختر</option>{accounts.filter((row) => row.active && row.postable).map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}</Select></FormField><footer className="ui-dialog__footer"><Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button><Button type="submit">إنشاء</Button></footer></form></Dialog>;
}

function TransferDialog({ open, onClose, value, onChange, treasuries, onSubmit }: { readonly open: boolean; readonly onClose: () => void; readonly value: { sourceTreasuryId: string; destinationTreasuryId: string; amount: string; postingDate: string; number: string }; readonly onChange: (value: { sourceTreasuryId: string; destinationTreasuryId: string; amount: string; postingDate: string; number: string }) => void; readonly treasuries: readonly TreasuryRow[]; readonly onSubmit: (event: FormEvent) => void }) {
  return <Dialog open={open} title="تحويل بين الخزائن" onClose={onClose}><form className="accounting-form" onSubmit={onSubmit}><FormField label="من" required><Select required value={value.sourceTreasuryId} onChange={(event) => onChange({ ...value, sourceTreasuryId: event.target.value })}><option value="">اختر</option>{treasuries.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></FormField><FormField label="إلى" required><Select required value={value.destinationTreasuryId} onChange={(event) => onChange({ ...value, destinationTreasuryId: event.target.value })}><option value="">اختر</option>{treasuries.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></FormField><FormField label="المبلغ" required><Input required inputMode="decimal" value={value.amount} onChange={(event) => onChange({ ...value, amount: event.target.value })} /></FormField><FormField label="التاريخ" required><Input required type="date" value={value.postingDate} onChange={(event) => onChange({ ...value, postingDate: event.target.value })} /></FormField><FormField label="رقم التحويل" required><Input required value={value.number} onChange={(event) => onChange({ ...value, number: event.target.value })} /></FormField><footer className="ui-dialog__footer"><Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button><Button type="submit">ترحيل التحويل</Button></footer></form></Dialog>;
}
