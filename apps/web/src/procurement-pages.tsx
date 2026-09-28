import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataGrid,
  DisclosureCard,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  Textarea,
} from './ui.js';
import { procurementGet, procurementPatch, procurementPost } from './procurement-client.js';
import { ProcurementReconciliationPanel } from './procurement-reconciliation-panel.js';

type SupplierView = {
  supplier: { id:string; supplierCode:string; status:string; approvalStatus:string };
  party: { id:string; displayName:string };
};

type PoLine = {
  id:string;
  itemReference:string;
  description?:string;
  orderedQuantity:string;
  unitPrice?:string;
  taxCode?:string;
  receivedQuantity:string;
  invoicedQuantity:string;
};

type PurchaseOrder = {
  id:string;
  branchId:string;
  supplierId:string;
  number:string;
  origin:string;
  status:string;
  orderDate?:string;
  expectedDate?:string;
  currency?:string;
  externalReference?:string;
  notes?:string;
  lines:PoLine[];
};

type Fulfillment = {
  id:string;
  kind:string;
  status:string;
  lineId:string;
  requestedQuantity:string;
  previousReceivedQuantity?:string;
  resultingReceivedQuantity?:string;
  reason?:string;
  note?:string;
  createdAt:string;
};

type DraftLine = {
  id:string;
  itemReference:string;
  description:string;
  orderedQuantity:string;
  unitPrice:string;
  taxCode:string;
};

const freshLine = ():DraftLine => ({
  id: crypto.randomUUID(),
  itemReference: '',
  description: '',
  orderedQuantity: '1',
  unitPrice: '0',
  taxCode: '',
});

const message = (error:unknown) =>
  error instanceof Error ? error.message : 'حدث خطأ غير متوقع';

export function ProcurementOperationsPage() {
  const [rows,setRows] = useState<PurchaseOrder[]>([]);
  const [suppliers,setSuppliers] = useState<SupplierView[]>([]);
  const [selected,setSelected] = useState<PurchaseOrder|null>(null);
  const [evidence,setEvidence] = useState<Fulfillment[]>([]);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [query,setQuery] = useState('');

  const [editingId,setEditingId] = useState<string|null>(null);
  const [createPoId,setCreatePoId] = useState(() => crypto.randomUUID());
  const [editCommandId,setEditCommandId] = useState(() => crypto.randomUUID());
  const [supplierId,setSupplierId] = useState('');
  const [orderDate,setOrderDate] = useState('');
  const [expectedDate,setExpectedDate] = useState('');
  const [currency,setCurrency] = useState('EGP');
  const [externalReference,setExternalReference] = useState('');
  const [notes,setNotes] = useState('');
  const [lines,setLines] = useState<DraftLine[]>([freshLine()]);

  const [cancelTarget,setCancelTarget] = useState<PurchaseOrder|null>(null);
  const [cancelReason,setCancelReason] = useState('');

  const [receiptTarget,setReceiptTarget] = useState<PoLine|null>(null);
  const [receiptId,setReceiptId] = useState(() => crypto.randomUUID());
  const [receiptQuantity,setReceiptQuantity] = useState('');
  const [receiptNote,setReceiptNote] = useState('');

  const [correctionTarget,setCorrectionTarget] = useState<Fulfillment|null>(null);
  const [correctionId,setCorrectionId] = useState(() => crypto.randomUUID());
  const [correctionQuantity,setCorrectionQuantity] = useState('');
  const [correctionReason,setCorrectionReason] = useState('');
  const [correctionNote,setCorrectionNote] = useState('');

  const [invoiceTarget,setInvoiceTarget] = useState<PoLine|null>(null);
  const [invoiceConversionId,setInvoiceConversionId] = useState(() => crypto.randomUUID());
  const [invoiceBillingId,setInvoiceBillingId] = useState(() => crypto.randomUUID());
  const [invoiceQuantity,setInvoiceQuantity] = useState('');
  const [invoiceNumber,setInvoiceNumber] = useState('');
  const [supplierInvoiceNumber,setSupplierInvoiceNumber] = useState('');
  const [invoicePostingDate,setInvoicePostingDate] = useState('');
  const [invoiceControlAccount,setInvoiceControlAccount] = useState('');
  const [invoiceExpenseAccount,setInvoiceExpenseAccount] = useState('');
  const [invoiceAmount,setInvoiceAmount] = useState('');

  const [directId,setDirectId] = useState(() => crypto.randomUUID());
  const [directInvoiceId,setDirectInvoiceId] = useState(() => crypto.randomUUID());
  const [directLineId,setDirectLineId] = useState(() => crypto.randomUUID());
  const [directSupplier,setDirectSupplier] = useState('');
  const [directNumber,setDirectNumber] = useState('');
  const [directExternal,setDirectExternal] = useState('');
  const [directDate,setDirectDate] = useState('');
  const [directCurrency,setDirectCurrency] = useState('EGP');
  const [controlAccount,setControlAccount] = useState('');
  const [expenseAccount,setExpenseAccount] = useState('');
  const [directAmount,setDirectAmount] = useState('');

  async function load() {
    try {
      const [purchaseOrders,supplierRows] = await Promise.all([
        procurementGet<PurchaseOrder[]>('/procurement/purchase-orders'),
        procurementGet<SupplierView[]>('/suppliers'),
      ]);
      setRows(purchaseOrders);
      setSuppliers(supplierRows.filter(
        (row) => row.supplier.status === 'ACTIVE' && row.supplier.approvalStatus === 'APPROVED',
      ));
      setError('');
    } catch (reason) {
      setError(message(reason));
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(
    () => rows.filter((row) =>
      !query ||
      row.number.toLowerCase().includes(query.toLowerCase()) ||
      row.supplierId.toLowerCase().includes(query.toLowerCase())
    ),
    [rows,query],
  );

  const supplierOptions = (
    <>
      <option value="">اختر المورد</option>
      {suppliers.map((supplier) => (
        <option key={supplier.party.id} value={supplier.party.id}>
          {supplier.supplier.supplierCode} — {supplier.party.displayName}
        </option>
      ))}
    </>
  );

  function patchLine(index:number,patch:Partial<DraftLine>) {
    setLines((value) => value.map((line,i) => i === index ? { ...line,...patch } : line));
  }

  function resetForm() {
    setEditingId(null);
    setCreatePoId(crypto.randomUUID());
    setEditCommandId(crypto.randomUUID());
    setSupplierId('');
    setOrderDate('');
    setExpectedDate('');
    setCurrency('EGP');
    setExternalReference('');
    setNotes('');
    setLines([freshLine()]);
  }

  async function choose(po:PurchaseOrder) {
    try {
      const detail = await procurementGet<PurchaseOrder>(`/procurement/purchase-orders/${po.id}`);
      const records = await procurementGet<Fulfillment[]>(`/procurement/purchase-orders/${po.id}/fulfillments`);
      setSelected(detail);
      setEvidence(records);
      setNotice('');
    } catch (reason) {
      setNotice(message(reason));
    }
  }

  function edit(po:PurchaseOrder) {
    setEditingId(po.id);
    setEditCommandId(crypto.randomUUID());
    setSupplierId(po.supplierId);
    setOrderDate(po.orderDate ?? '');
    setExpectedDate(po.expectedDate ?? '');
    setCurrency(po.currency ?? 'EGP');
    setExternalReference(po.externalReference ?? '');
    setNotes(po.notes ?? '');
    setLines(po.lines.map((line) => ({
      id: line.id,
      itemReference: line.itemReference,
      description: line.description ?? '',
      orderedQuantity: line.orderedQuantity,
      unitPrice: line.unitPrice ?? '0',
      taxCode: line.taxCode ?? '',
    })));
    window.scrollTo({ top:0,behavior:'smooth' });
  }

  async function savePo(event:FormEvent) {
    event.preventDefault();
    try {
      const normalizedLines = lines.map((line) => ({
        id: line.id,
        itemReference: line.itemReference,
        description: line.description || undefined,
        orderedQuantity: line.orderedQuantity,
        unitPrice: line.unitPrice,
        taxCode: line.taxCode || undefined,
      }));
      if (editingId) {
        await procurementPatch(`/procurement/purchase-orders/${editingId}`, {
          commandId: editCommandId,
          supplierId,
          orderDate,
          expectedDate: expectedDate || undefined,
          currency,
          externalReference: externalReference || undefined,
          notes: notes || undefined,
          lines: normalizedLines,
        });
        setNotice('تم تحديث أمر الشراء Draft.');
      } else {
        await procurementPost('/procurement/purchase-orders', {
          id: createPoId,
          supplierId,
          orderDate,
          expectedDate: expectedDate || undefined,
          currency,
          externalReference: externalReference || undefined,
          notes: notes || undefined,
          lines: normalizedLines,
        });
        setNotice('تم إنشاء أمر الشراء بالترقيم التلقائي.');
      }
      resetForm();
      await load();
    } catch (reason) {
      setNotice(message(reason));
    }
  }

  async function approve(po:PurchaseOrder) {
    try {
      await procurementPost(`/procurement/purchase-orders/${po.id}/approve`, {});
      setNotice('تم اعتماد أمر الشراء.');
      await load();
      await choose(po);
    } catch (reason) {
      setNotice(message(reason));
    }
  }

  async function cancel() {
    if (!cancelTarget || !cancelReason.trim()) return;
    try {
      await procurementPost(`/procurement/purchase-orders/${cancelTarget.id}/cancel`, {
        reason: cancelReason.trim(),
      });
      setNotice('تم إلغاء أمر الشراء مع حفظ السبب.');
      const target = cancelTarget;
      setCancelTarget(null);
      setCancelReason('');
      await load();
      await choose(target);
    } catch (reason) {
      setNotice(message(reason));
    }
  }

  async function recordReceipt(event:FormEvent) {
    event.preventDefault();
    if (!selected || !receiptTarget) return;
    try {
      await procurementPost(`/procurement/purchase-orders/${selected.id}/fulfillments`, {
        id: receiptId,
        lineId: receiptTarget.id,
        quantity: receiptQuantity,
        note: receiptNote || undefined,
      });
      setNotice('تم تسجيل التنفيذ.');
      setReceiptTarget(null);
      setReceiptId(crypto.randomUUID());
      setReceiptQuantity('');
      setReceiptNote('');
      await load();
      await choose(selected);
    } catch (reason) {
      setNotice(message(reason));
    }
  }

  async function correctReceipt(event:FormEvent) {
    event.preventDefault();
    if (!selected || !correctionTarget) return;
    try {
      await procurementPost(`/procurement/purchase-orders/${selected.id}/fulfillment-corrections`, {
        id: correctionId,
        correctionOfId: correctionTarget.id,
        lineId: correctionTarget.lineId,
        targetReceivedQuantity: correctionQuantity,
        reason: correctionReason,
        note: correctionNote || undefined,
      });
      setNotice('تم تسجيل تصحيح التنفيذ مع الاحتفاظ بالدليل السابق.');
      setCorrectionTarget(null);
      setCorrectionId(crypto.randomUUID());
      setCorrectionQuantity('');
      setCorrectionReason('');
      setCorrectionNote('');
      await load();
      await choose(selected);
    } catch (reason) {
      setNotice(message(reason));
    }
  }

  function openInvoice(line:PoLine) {
    const available = String(Number(line.receivedQuantity) - Number(line.invoicedQuantity));
    setInvoiceTarget(line);
    setInvoiceConversionId(crypto.randomUUID());
    setInvoiceBillingId(crypto.randomUUID());
    setInvoiceQuantity(available);
    setInvoicePostingDate(new Date().toISOString().slice(0,10));
    setInvoiceNumber('');
    setSupplierInvoiceNumber('');
    setInvoiceControlAccount('');
    setInvoiceExpenseAccount('');
    setInvoiceAmount('');
  }

  async function invoiceLine(event:FormEvent) {
    event.preventDefault();
    if (!selected || !invoiceTarget) return;
    try {
      await procurementPost(
        `/procurement/purchase-orders/${selected.id}/lines/${invoiceTarget.id}/supplier-invoices`,
        {
          id: invoiceConversionId,
          quantity: invoiceQuantity,
          billing: {
            invoiceId: invoiceBillingId,
            number: invoiceNumber,
            externalInvoiceNumber: supplierInvoiceNumber,
            postingDate: invoicePostingDate,
            currency: selected.currency ?? 'EGP',
            controlAccountId: invoiceControlAccount,
            accountId: invoiceExpenseAccount,
            amount: invoiceAmount,
          },
        },
      );
      setNotice('تم إنشاء وترحيل فاتورة المورد من الكمية المنفذة.');
      setInvoiceTarget(null);
      setInvoiceConversionId(crypto.randomUUID());
      setInvoiceBillingId(crypto.randomUUID());
      await load();
      await choose(selected);
    } catch (reason) {
      setNotice(message(reason));
    }
  }

  async function direct(event:FormEvent) {
    event.preventDefault();
    try {
      await procurementPost('/procurement/direct-purchases', {
        id: directId,
        supplierId: directSupplier,
        invoiceId: directInvoiceId,
        number: directNumber,
        externalInvoiceNumber: directExternal,
        postingDate: directDate,
        currency: directCurrency,
        controlAccountId: controlAccount,
        lines: [{ id:directLineId,accountId:expenseAccount,amount:directAmount }],
      });
      setNotice('تم ترحيل الشراء المباشر كفاتورة مورد من خلال Billing.');
      setDirectId(crypto.randomUUID());
      setDirectInvoiceId(crypto.randomUUID());
      setDirectLineId(crypto.randomUUID());
      setDirectNumber('');
      setDirectExternal('');
      setDirectAmount('');
    } catch (reason) {
      setNotice(message(reason));
    }
  }

  return (
    <section aria-label="تشغيل المشتريات">
      <DisclosureCard title={editingId ? 'تعديل أمر شراء' : 'أمر شراء جديد'} description="افتح النموذج عند إنشاء أمر جديد أو تعديل أمر قائم." open={Boolean(editingId)}>
        <form onSubmit={savePo}>
          <FormField label="المورد" required>
            <Select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              {supplierOptions}
            </Select>
          </FormField>
          <p role="note">
            {editingId
              ? 'رقم أمر الشراء محفوظ ولا يتغير.'
              : 'رقم أمر الشراء يُنشأ تلقائيًا حسب الشركة والفرع والسنة.'}
          </p>
          <FormField label="التاريخ" required>
            <Input required type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
          </FormField>
          <FormField label="التاريخ المتوقع">
            <Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
          </FormField>
          <FormField label="العملة" required>
            <Input required value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
          </FormField>
          <FormField label="مرجع خارجي">
            <Input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} />
          </FormField>
          <FormField label="ملاحظات">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </FormField>
          <h3>البنود</h3>
          {lines.map((line,index) => (
            <div key={line.id} className="ui-card">
              <FormField label="البند" required>
                <Input required value={line.itemReference} onChange={(event) => patchLine(index,{itemReference:event.target.value})} />
              </FormField>
              <FormField label="الوصف">
                <Input value={line.description} onChange={(event) => patchLine(index,{description:event.target.value})} />
              </FormField>
              <FormField label="الكمية" required>
                <Input required inputMode="decimal" value={line.orderedQuantity} onChange={(event) => patchLine(index,{orderedQuantity:event.target.value})} />
              </FormField>
              <FormField label="سعر الوحدة" required>
                <Input required inputMode="decimal" value={line.unitPrice} onChange={(event) => patchLine(index,{unitPrice:event.target.value})} />
              </FormField>
              <FormField label="كود الضريبة">
                <Input value={line.taxCode} onChange={(event) => patchLine(index,{taxCode:event.target.value})} />
              </FormField>
              {lines.length > 1 && <Button type="button" onClick={() => setLines((value) => value.filter((_,i) => i !== index))}>حذف البند</Button>}
            </div>
          ))}
          <Button type="button" onClick={() => setLines((value) => [...value,freshLine()])}>إضافة بند</Button>
          <Button type="submit">{editingId ? 'حفظ التعديل' : 'إنشاء أمر الشراء'}</Button>
          {editingId && <Button type="button" onClick={resetForm}>إلغاء التعديل</Button>}
        </form>
      </DisclosureCard>

      {notice && <p role="status">{notice}</p>}

      <Card title="أوامر الشراء">
        <Input aria-label="بحث أوامر الشراء" placeholder="بحث بالرقم أو المورد" value={query} onChange={(event) => setQuery(event.target.value)} />
        {error ? <ErrorState message={error} /> : !filtered.length ? <EmptyState /> : (
          <DataGrid columns={['الرقم','المورد','الحالة','التاريخ','إجراءات']}>
            {filtered.map((po) => (
              <tr key={po.id}>
                <td>{po.number}</td>
                <td>{suppliers.find((supplier) => supplier.party.id === po.supplierId)?.party.displayName ?? po.supplierId}</td>
                <td><Badge tone={po.status === 'INVOICED' || po.status === 'RECEIVED' ? 'success' : po.status === 'CANCELLED' ? 'error' : 'warning'}>{po.status}</Badge></td>
                <td>{po.orderDate ?? '—'}</td>
                <td>
                  <Button onClick={() => void choose(po)}>تفاصيل</Button>
                  {po.status === 'DRAFT' && <Button onClick={() => edit(po)}>تعديل</Button>}
                  {po.status === 'DRAFT' && <Button onClick={() => void approve(po)}>اعتماد</Button>}
                  {['DRAFT','APPROVED'].includes(po.status) && <Button onClick={() => { setCancelTarget(po); setCancelReason(''); }}>إلغاء</Button>}
                </td>
              </tr>
            ))}
          </DataGrid>
        )}
      </Card>

      {selected && (
        <Card title={`أمر الشراء ${selected.number}`}>
          <Button onClick={() => window.print()}>طباعة</Button>
          <p>الحالة: {selected.status} — العملة: {selected.currency ?? '—'}</p>
          <DataGrid columns={['البند','المطلوب','المستلم','المفوتر','إجراءات']}>
            {selected.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.itemReference}</td>
                <td>{line.orderedQuantity}</td>
                <td>{line.receivedQuantity}</td>
                <td>{line.invoicedQuantity}</td>
                <td>
                  {['APPROVED','PARTIALLY_RECEIVED','PARTIALLY_INVOICED'].includes(selected.status) && (
                    <Button onClick={() => { setReceiptTarget(line); setReceiptId(crypto.randomUUID()); setReceiptQuantity(''); setReceiptNote(''); }}>تسجيل تنفيذ</Button>
                  )}
                  {Number(line.receivedQuantity) > Number(line.invoicedQuantity) && (
                    <Button onClick={() => openInvoice(line)}>فاتورة مورد</Button>
                  )}
                </td>
              </tr>
            ))}
          </DataGrid>

          <h3>سجل التنفيذ</h3>
          {!evidence.length ? <EmptyState /> : (
            <DataGrid columns={['النوع','البند','قبل','بعد','الحالة','إجراء']}>
              {evidence.map((item) => (
                <tr key={item.id}>
                  <td>{item.kind}</td>
                  <td>{item.lineId}</td>
                  <td>{item.previousReceivedQuantity ?? '—'}</td>
                  <td>{item.resultingReceivedQuantity ?? '—'}</td>
                  <td>{item.status}</td>
                  <td>
                    {item.status === 'APPLIED' && (
                      <Button onClick={() => {
                        setCorrectionTarget(item);
                        setCorrectionId(crypto.randomUUID());
                        setCorrectionQuantity(item.resultingReceivedQuantity ?? item.requestedQuantity);
                        setCorrectionReason('');
                        setCorrectionNote('');
                      }}>تصحيح</Button>
                    )}
                  </td>
                </tr>
              ))}
            </DataGrid>
          )}
          <ProcurementReconciliationPanel purchaseOrderId={selected.id}/>
        </Card>
      )}

      <Card title="شراء مباشر">
        <form onSubmit={direct}>
          <FormField label="المورد" required>
            <Select required value={directSupplier} onChange={(event) => setDirectSupplier(event.target.value)}>
              {supplierOptions}
            </Select>
          </FormField>
          <FormField label="رقم الفاتورة الداخلي" required>
            <Input required value={directNumber} onChange={(event) => setDirectNumber(event.target.value)} />
          </FormField>
          <FormField label="رقم فاتورة المورد" required>
            <Input required value={directExternal} onChange={(event) => setDirectExternal(event.target.value)} />
          </FormField>
          <FormField label="تاريخ القيد" required>
            <Input required type="date" value={directDate} onChange={(event) => setDirectDate(event.target.value)} />
          </FormField>
          <FormField label="العملة" required>
            <Input required value={directCurrency} onChange={(event) => setDirectCurrency(event.target.value.toUpperCase())} />
          </FormField>
          <FormField label="حساب الدائنين" required>
            <Input required value={controlAccount} onChange={(event) => setControlAccount(event.target.value)} />
          </FormField>
          <FormField label="حساب المصروف/التكلفة" required>
            <Input required value={expenseAccount} onChange={(event) => setExpenseAccount(event.target.value)} />
          </FormField>
          <FormField label="المبلغ" required>
            <Input required inputMode="decimal" value={directAmount} onChange={(event) => setDirectAmount(event.target.value)} />
          </FormField>
          <Button type="submit">ترحيل الشراء المباشر</Button>
        </form>
      </Card>

      <Dialog open={!!cancelTarget} title="إلغاء أمر الشراء" onClose={() => setCancelTarget(null)}>
        <FormField label="سبب الإلغاء" required>
          <Textarea required value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
        </FormField>
        <Button disabled={!cancelReason.trim()} onClick={() => void cancel()}>تأكيد الإلغاء</Button>
      </Dialog>

      <Dialog open={!!receiptTarget} title="تسجيل تنفيذ / استلام" onClose={() => setReceiptTarget(null)}>
        <form onSubmit={recordReceipt}>
          <FormField label="الكمية المنفذة الآن" required>
            <Input required inputMode="decimal" value={receiptQuantity} onChange={(event) => setReceiptQuantity(event.target.value)} />
          </FormField>
          <FormField label="ملاحظة">
            <Textarea value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} />
          </FormField>
          <Button type="submit">حفظ التنفيذ</Button>
        </form>
      </Dialog>

      <Dialog open={!!correctionTarget} title="تصحيح سجل التنفيذ" onClose={() => setCorrectionTarget(null)}>
        <form onSubmit={correctReceipt}>
          <FormField label="إجمالي الكمية الصحيحة المستلمة" required>
            <Input required inputMode="decimal" value={correctionQuantity} onChange={(event) => setCorrectionQuantity(event.target.value)} />
          </FormField>
          <FormField label="سبب التصحيح" required>
            <Textarea required value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />
          </FormField>
          <FormField label="ملاحظة">
            <Textarea value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} />
          </FormField>
          <Button type="submit">حفظ التصحيح</Button>
        </form>
      </Dialog>

      <Dialog open={!!invoiceTarget} title="تحويل التنفيذ إلى فاتورة مورد" onClose={() => setInvoiceTarget(null)}>
        <form onSubmit={invoiceLine}>
          <FormField label="الكمية المفوترة" required>
            <Input required inputMode="decimal" value={invoiceQuantity} onChange={(event) => setInvoiceQuantity(event.target.value)} />
          </FormField>
          <FormField label="رقم الفاتورة الداخلي" required>
            <Input required value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
          </FormField>
          <FormField label="رقم فاتورة المورد" required>
            <Input required value={supplierInvoiceNumber} onChange={(event) => setSupplierInvoiceNumber(event.target.value)} />
          </FormField>
          <FormField label="تاريخ القيد" required>
            <Input required type="date" value={invoicePostingDate} onChange={(event) => setInvoicePostingDate(event.target.value)} />
          </FormField>
          <FormField label="حساب الدائنين" required>
            <Input required value={invoiceControlAccount} onChange={(event) => setInvoiceControlAccount(event.target.value)} />
          </FormField>
          <FormField label="حساب المصروف/التكلفة" required>
            <Input required value={invoiceExpenseAccount} onChange={(event) => setInvoiceExpenseAccount(event.target.value)} />
          </FormField>
          <FormField label="قيمة الجزء المفوتر" required>
            <Input required inputMode="decimal" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} />
          </FormField>
          <Button type="submit">إنشاء وترحيل الفاتورة</Button>
        </form>
      </Dialog>
    </section>
  );
}
