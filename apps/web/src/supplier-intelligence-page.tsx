import { type FormEvent, useEffect, useState } from 'react';
import { Badge, Button, Card, DataGrid, Dialog, EmptyState, ErrorState, FormField, Input, Select, Textarea, Toast } from './ui.js';
import { supplierGet, supplierPost } from './supplier-client.js';

type SupplierRow={supplier:{id:string;partyId:string;supplierCode:string;status:string;approvalStatus:string};party:{id:string;displayName:string};categories:string[]};
type Evaluation={id:string;version:number;qualityScore:number;serviceScore:number;notes:string|null;evaluatedAt:string};
type Dispute={id:string;severity:string;title:string;description:string;status:string;openedAt:string;resolvedAt:string|null;cancelledAt:string|null};
type PurchaseOrder={id:string;number:string;status:string;orderDate?:string;expectedDate?:string;currency?:string;externalReference?:string;notes?:string;lines:{id:string;itemReference:string;description?:string;orderedQuantity:string;receivedQuantity:string;invoicedQuantity:string;unitPrice?:string}[]};
type Financials={
  invoices:{id:string;number:string;externalInvoiceNumber?:string;postingDate:string;dueDate?:string;currency:string;status:string;documentTotal:string;outstanding:string;sourceType:string;sourceId:string}[];
  vouchers:{id:string;number:string;kind:string;postingDate:string;currency:string;amount:string;status:string;treasuryId:string;sourceType:string;sourceId:string;advanceId?:string}[];
  activeAdvances:{id:string;amount:string;available:string;sourceType:string;sourceId:string;restrictionSourceType?:string;restrictionSourceId?:string}[];
};
type Overview={
  supplier:{party:{id:string;displayName:string};supplierCode:string;categories:string[];status:string;approvalStatus:string};
  evaluation:{latest:Evaluation|null;history:Evaluation[]};
  procurementMetrics:{poCount:number;cancelledPoCount:number;orderedQuantity:string;receivedQuantity:string;completionRatio:string;completedPoCount:number;fulfillmentCorrectionCount:number;onTimeCompletedCount:number;lateCompletedCount:number;unclassifiedTimingCount:number};
  purchaseOrders:PurchaseOrder[];
  disputes:{open:Dispute[];history:Dispute[]};
  holds:{isHeld:boolean;active:{id:string;sourceType:string;sourceId:string;reason:string}[];criticalDisputeIds:string[]};
};

const errorMessage=(error:unknown)=>error instanceof Error?error.message:'حدث خطأ غير متوقع';
const statusLabel=(status:string)=>status==='ACTIVE'?'نشط':status==='INACTIVE'?'غير نشط':status==='ON_HOLD'?'موقوف مؤقتًا':status;
const statusTone=(status:string):'success'|'warning'|'neutral'=>status==='ACTIVE'?'success':status==='ON_HOLD'?'warning':'neutral';
const approvalLabel=(status:string)=>status==='APPROVED'?'معتمد':status==='PENDING'?'بانتظار الاعتماد':status==='REJECTED'?'مرفوض':status;
const severityLabel=(value:string)=>value==='LOW'?'منخفض':value==='MEDIUM'?'متوسط':value==='HIGH'?'مرتفع':value==='CRITICAL'?'حرج':value;
const disputeStatusLabel=(value:string)=>value==='OPEN'?'مفتوح':value==='RESOLVED'?'محلول':value==='CANCELLED'?'ملغي':value;
const voucherKind=(value:string)=>value==='PAYMENT'?'سداد للمورد':value==='RECEIPT'?'تحصيل من المورد':value;

export function SupplierIntelligencePage(){
  const[q,setQ]=useState(''),[rows,setRows]=useState<SupplierRow[]>([]),[selected,setSelected]=useState<string|null>(null),[overview,setOverview]=useState<Overview|null>(null),[financials,setFinancials]=useState<Financials|null>(null);
  const[error,setError]=useState(''),[notice,setNotice]=useState(''),[financialWarning,setFinancialWarning]=useState(''),[loading,setLoading]=useState(false);
  const[evaluationOpen,setEvaluationOpen]=useState(false),[disputeOpen,setDisputeOpen]=useState(false),[action,setAction]=useState<{kind:'resolve'|'cancel'|'release';dispute:Dispute}|null>(null);
  const[quality,setQuality]=useState('5'),[service,setService]=useState('5'),[notes,setNotes]=useState('');
  const[severity,setSeverity]=useState('LOW'),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[reason,setReason]=useState('');

  async function search(){
    try{setRows(await supplierGet<SupplierRow[]>('/supplier-intelligence/suppliers?q='+encodeURIComponent(q)));setError('');}
    catch(e){setError(errorMessage(e));}
  }
  useEffect(()=>{void search();},[q]);

  async function load(supplierPartyId:string){
    setSelected(supplierPartyId);setLoading(true);setFinancials(null);setFinancialWarning('');
    const [base,finance]=await Promise.allSettled([
      supplierGet<Overview>('/supplier-intelligence/'+supplierPartyId+'/overview'),
      supplierGet<Financials>('/supplier-intelligence/'+supplierPartyId+'/financials'),
    ]);
    if(base.status==='fulfilled'){setOverview(base.value);setError('');}
    else{setOverview(null);setError(errorMessage(base.reason));}
    if(finance.status==='fulfilled')setFinancials(finance.value);
    else setFinancialWarning('البيانات المالية غير متاحة بالصلاحيات الحالية أو تعذر تحميلها.');
    setLoading(false);
  }

  async function addEvaluation(event:FormEvent){
    event.preventDefault();if(!selected)return;
    try{
      await supplierPost('/supplier-intelligence/'+selected+'/evaluations',{requestId:crypto.randomUUID(),qualityScore:Number(quality),serviceScore:Number(service),notes:notes||null});
      setEvaluationOpen(false);setNotice('تم حفظ التقييم كسجل جديد مع الاحتفاظ بالتاريخ السابق.');await load(selected);
    }catch(e){setNotice(errorMessage(e));}
  }

  async function createDispute(event:FormEvent){
    event.preventDefault();if(!selected)return;
    try{
      await supplierPost('/supplier-intelligence/'+selected+'/disputes',{requestId:crypto.randomUUID(),severity,title,description,attachmentIds:[]});
      setDisputeOpen(false);setNotice('تم فتح النزاع.');await load(selected);
    }catch(e){setNotice(errorMessage(e));}
  }

  async function runAction(){
    if(!selected||!action)return;
    const suffix=action.kind==='resolve'?'resolve':action.kind==='cancel'?'cancel':'release-hold';
    const body=action.kind==='resolve'?{resolution:reason}:action.kind==='cancel'?{cancellationReason:reason}:{releaseReason:reason};
    try{
      await supplierPost('/supplier-intelligence/'+selected+'/disputes/'+action.dispute.id+'/'+suffix,body);
      setNotice(action.kind==='release'?'تم رفع الإيقاف الخاص بهذا النزاع فقط.':'تم تحديث النزاع دون رفع الإيقاف تلقائيًا.');
      setAction(null);setReason('');await load(selected);
    }catch(e){setNotice(errorMessage(e));}
  }

  return <section aria-label="تقييم ومتابعة الموردين">
    <Card title="تقييم ومتابعة الموردين">
      <Input aria-label="بحث الموردين" value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث باسم المورد أو الكود"/>
      {error&&<ErrorState message={error}/>}
    </Card>
    <Card title="اختر المورد">
      {rows.length?<DataGrid columns={['الكود','المورد','الحالة','الاعتماد','']}>{rows.map(row=><tr key={row.supplier.id}>
        <td>{row.supplier.supplierCode}</td><td>{row.party.displayName}</td><td><Badge tone={statusTone(row.supplier.status)}>{statusLabel(row.supplier.status)}</Badge></td><td>{approvalLabel(row.supplier.approvalStatus)}</td>
        <td><Button onClick={()=>void load(row.party.id)}>ملف المورد 360°</Button></td>
      </tr>)}</DataGrid>:<EmptyState/>}
    </Card>
    {loading&&<Card title="تحميل ملف المورد"><p role="status">جاري تحميل ملف المورد والبيانات المرتبطة…</p></Card>}
    {overview&&!loading&&<>
      <Card title={'ملف المورد 360° — '+overview.supplier.party.displayName}>
        <p>الكود: {overview.supplier.supplierCode}</p>
        <p>التصنيفات: {overview.supplier.categories.join('، ')||'—'}</p>
        <p>الحالة: <Badge tone={statusTone(overview.supplier.status)}>{statusLabel(overview.supplier.status)}</Badge> · الاعتماد: {approvalLabel(overview.supplier.approvalStatus)}</p>
        {overview.holds.isHeld&&<p>حالات الإيقاف: {overview.holds.active.map(hold=>hold.reason).join('، ')}</p>}
      </Card>
      <Card title="أداء المشتريات">
        <DataGrid columns={['أوامر الشراء','ملغاة','المطلوب','المستلم','نسبة الإكمال','مكتملة','تصحيحات','في الموعد','متأخر','غير مصنف']}>
          <tr><td>{overview.procurementMetrics.poCount}</td><td>{overview.procurementMetrics.cancelledPoCount}</td><td>{overview.procurementMetrics.orderedQuantity}</td><td>{overview.procurementMetrics.receivedQuantity}</td><td>{overview.procurementMetrics.completionRatio}</td><td>{overview.procurementMetrics.completedPoCount}</td><td>{overview.procurementMetrics.fulfillmentCorrectionCount}</td><td>{overview.procurementMetrics.onTimeCompletedCount}</td><td>{overview.procurementMetrics.lateCompletedCount}</td><td>{overview.procurementMetrics.unclassifiedTimingCount}</td></tr>
        </DataGrid>
      </Card>
      <Card title="سجل أوامر الشراء">
        {overview.purchaseOrders.length?<DataGrid columns={['الرقم','الحالة','التاريخ','المتوقع','العملة','المرجع','البنود']}>
          {overview.purchaseOrders.map(po=><tr key={po.id}><td>{po.number}</td><td><Badge tone={po.status==='CANCELLED'?'warning':'neutral'}>{po.status}</Badge></td><td>{po.orderDate??'—'}</td><td>{po.expectedDate??'—'}</td><td>{po.currency??'—'}</td><td>{po.externalReference??'—'}</td><td>{po.lines.length}</td></tr>)}
        </DataGrid>:<EmptyState title="لا توجد أوامر شراء لهذا المورد في الفرع الحالي"/>}
      </Card>
      <Card title="الحساب والمستحقات">
        {financialWarning&&<p role="note">{financialWarning}</p>}
        {financials?.invoices.length?<DataGrid columns={['الفاتورة','فاتورة المورد','التاريخ','الاستحقاق','العملة','الإجمالي','المتبقي','الحالة']}>
          {financials.invoices.map(invoice=><tr key={invoice.id}><td>{invoice.number}</td><td>{invoice.externalInvoiceNumber??'—'}</td><td>{invoice.postingDate}</td><td>{invoice.dueDate??'—'}</td><td>{invoice.currency}</td><td>{invoice.documentTotal}</td><td>{invoice.outstanding}</td><td><Badge tone={invoice.status==='POSTED'?'success':'neutral'}>{invoice.status}</Badge></td></tr>)}
        </DataGrid>:financials?<EmptyState title="لا توجد فواتير مورد في الفرع الحالي"/>:null}
      </Card>
      <Card title="المدفوعات ومقدمات المورد">
        {financials?.vouchers.length?<DataGrid columns={['السند','النوع','التاريخ','العملة','القيمة','الحالة','الخزينة/البنك']}>
          {financials.vouchers.map(voucher=><tr key={voucher.id}><td>{voucher.number}</td><td>{voucherKind(voucher.kind)}</td><td>{voucher.postingDate}</td><td>{voucher.currency}</td><td>{voucher.amount}</td><td><Badge tone={voucher.status==='POSTED'?'success':'neutral'}>{voucher.status}</Badge></td><td>{voucher.treasuryId}</td></tr>)}
        </DataGrid>:financials?<EmptyState title="لا توجد حركة سداد أو تحصيل للمورد في الفرع الحالي"/>:null}
        {financials?.activeAdvances.length?<><h3>المقدمات المتاحة</h3><DataGrid columns={['المقدم','القيمة الأصلية','المتاح','المصدر']}>
          {financials.activeAdvances.map(advance=><tr key={advance.id}><td>{advance.id}</td><td>{advance.amount}</td><td>{advance.available}</td><td>{advance.sourceType}</td></tr>)}
        </DataGrid></>:null}
      </Card>
      <Card title="التقييم">
        <Button onClick={()=>setEvaluationOpen(true)}>إضافة تقييم</Button>
        {overview.evaluation.latest?<p>الجودة {overview.evaluation.latest.qualityScore}/5 · الخدمة {overview.evaluation.latest.serviceScore}/5 · {overview.evaluation.latest.notes??'بدون ملاحظات'}</p>:<EmptyState title="لا يوجد تقييم بعد"/>}
        <DataGrid columns={['الإصدار','الجودة','الخدمة','الملاحظات','التاريخ']}>{overview.evaluation.history.map(item=><tr key={item.id}><td>{item.version}</td><td>{item.qualityScore}</td><td>{item.serviceScore}</td><td>{item.notes??'—'}</td><td>{item.evaluatedAt}</td></tr>)}</DataGrid>
      </Card>
      <Card title="النزاعات">
        <Button onClick={()=>setDisputeOpen(true)}>فتح نزاع</Button>
        <DataGrid columns={['الخطورة','العنوان','الحالة','التاريخ','إجراءات']}>{overview.disputes.history.map(dispute=><tr key={dispute.id}>
          <td>{severityLabel(dispute.severity)}</td><td>{dispute.title}</td><td>{disputeStatusLabel(dispute.status)}</td><td>{dispute.openedAt}</td>
          <td>{dispute.status==='OPEN'?<><Button onClick={()=>{setAction({kind:'resolve',dispute});setReason('');}}>حل</Button><Button onClick={()=>{setAction({kind:'cancel',dispute});setReason('');}}>إلغاء</Button></>:dispute.severity==='CRITICAL'&&overview.holds.criticalDisputeIds.includes(dispute.id)?<Button onClick={()=>{setAction({kind:'release',dispute});setReason('');}}>رفع الإيقاف</Button>:null}</td>
        </tr>)}</DataGrid>
      </Card>
    </>}
    {notice&&<Toast>{notice}</Toast>}
    <Dialog open={evaluationOpen} title="إضافة تقييم" onClose={()=>setEvaluationOpen(false)}>
      <form onSubmit={addEvaluation}>
        <FormField label="الجودة" required><Select value={quality} onChange={e=>setQuality(e.target.value)}>{[1,2,3,4,5].map(value=><option key={value}>{value}</option>)}</Select></FormField>
        <FormField label="الخدمة" required><Select value={service} onChange={e=>setService(e.target.value)}>{[1,2,3,4,5].map(value=><option key={value}>{value}</option>)}</Select></FormField>
        <FormField label="ملاحظات"><Textarea value={notes} onChange={e=>setNotes(e.target.value)}/></FormField>
        <Button type="submit">حفظ التقييم</Button>
      </form>
    </Dialog>
    <Dialog open={disputeOpen} title="فتح نزاع" onClose={()=>setDisputeOpen(false)}>
      <form onSubmit={createDispute}>
        <FormField label="الخطورة" required><Select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="LOW">منخفض</option><option value="MEDIUM">متوسط</option><option value="HIGH">مرتفع</option><option value="CRITICAL">حرج</option></Select></FormField>
        <FormField label="العنوان" required><Input required value={title} onChange={e=>setTitle(e.target.value)}/></FormField>
        <FormField label="الوصف" required><Textarea required value={description} onChange={e=>setDescription(e.target.value)}/></FormField>
        <Button type="submit">فتح النزاع</Button>
      </form>
    </Dialog>
    <Dialog open={Boolean(action)} title={action?.kind==='release'?'رفع الإيقاف':action?.kind==='resolve'?'حل النزاع':'إلغاء النزاع'} onClose={()=>setAction(null)}>
      <FormField label={action?.kind==='resolve'?'قرار الحل':action?.kind==='release'?'سبب رفع الإيقاف':'سبب الإلغاء'} required><Textarea required value={reason} onChange={e=>setReason(e.target.value)}/></FormField>
      <Button disabled={!reason.trim()} onClick={()=>void runAction()}>تأكيد</Button>
    </Dialog>
  </section>;
}
