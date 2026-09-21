import { type FormEvent, useEffect, useState } from 'react';
import { Badge, Button, Card, DataGrid, Dialog, EmptyState, ErrorState, FormField, Input, Select, Textarea, Toast } from './ui.js';
import { supplierGet, supplierPost } from './supplier-client.js';

type SupplierRow={supplier:{id:string;partyId:string;supplierCode:string;status:string;approvalStatus:string};party:{id:string;displayName:string};categories:string[]};
type Evaluation={id:string;version:number;qualityScore:number;serviceScore:number;notes:string|null;evaluatedAt:string};
type Dispute={id:string;severity:string;title:string;description:string;status:string;openedAt:string;resolvedAt:string|null;cancelledAt:string|null};
type Overview={
  supplier:{party:{id:string;displayName:string};supplierCode:string;categories:string[];status:string;approvalStatus:string};
  evaluation:{latest:Evaluation|null;history:Evaluation[]};
  procurementMetrics:{poCount:number;cancelledPoCount:number;orderedQuantity:string;receivedQuantity:string;completionRatio:string;completedPoCount:number;fulfillmentCorrectionCount:number;onTimeCompletedCount:number;lateCompletedCount:number;unclassifiedTimingCount:number};
  disputes:{open:Dispute[];history:Dispute[]};
  holds:{isHeld:boolean;active:{id:string;sourceType:string;sourceId:string;reason:string}[];criticalDisputeIds:string[]};
};

const errorMessage=(error:unknown)=>error instanceof Error?error.message:'حدث خطأ غير متوقع';
const statusLabel=(status:string)=>status==='ACTIVE'?'نشط':status==='INACTIVE'?'غير نشط':status==='ON_HOLD'?'موقوف مؤقتًا':status;
const statusTone=(status:string):'success'|'warning'|'neutral'=>status==='ACTIVE'?'success':status==='ON_HOLD'?'warning':'neutral';

export function SupplierIntelligencePage(){
  const[q,setQ]=useState(''),[rows,setRows]=useState<SupplierRow[]>([]),[selected,setSelected]=useState<string|null>(null),[overview,setOverview]=useState<Overview|null>(null);
  const[error,setError]=useState(''),[notice,setNotice]=useState('');
  const[evaluationOpen,setEvaluationOpen]=useState(false),[disputeOpen,setDisputeOpen]=useState(false),[action,setAction]=useState<{kind:'resolve'|'cancel'|'release';dispute:Dispute}|null>(null);
  const[quality,setQuality]=useState('5'),[service,setService]=useState('5'),[notes,setNotes]=useState('');
  const[severity,setSeverity]=useState('LOW'),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[reason,setReason]=useState('');

  async function search(){
    try{setRows(await supplierGet<SupplierRow[]>('/supplier-intelligence/suppliers?q='+encodeURIComponent(q)));setError('');}
    catch(e){setError(errorMessage(e));}
  }
  useEffect(()=>{void search();},[q]);

  async function load(supplierPartyId:string){
    try{setSelected(supplierPartyId);setOverview(await supplierGet<Overview>('/supplier-intelligence/'+supplierPartyId+'/overview'));setError('');}
    catch(e){setError(errorMessage(e));}
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
      setNotice(action.kind==='release'?'تم رفع Hold الخاص بهذا النزاع فقط.':'تم تحديث النزاع دون رفع Hold تلقائيًا.');
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
        <td>{row.supplier.supplierCode}</td><td>{row.party.displayName}</td><td><Badge tone={statusTone(row.supplier.status)}>{statusLabel(row.supplier.status)}</Badge></td><td>{row.supplier.approvalStatus}</td>
        <td><Button onClick={()=>void load(row.party.id)}>Supplier 360</Button></td>
      </tr>)}</DataGrid>:<EmptyState/>}
    </Card>
    {overview&&<>
      <Card title={'Supplier 360 — '+overview.supplier.party.displayName}>
        <p>الكود: {overview.supplier.supplierCode}</p>
        <p>التصنيفات: {overview.supplier.categories.join('، ')||'—'}</p>
        <p>الحالة: <Badge tone={statusTone(overview.supplier.status)}>{statusLabel(overview.supplier.status)}</Badge> · الاعتماد: {overview.supplier.approvalStatus}</p>
        {overview.holds.isHeld&&<p>حالات الإيقاف: {overview.holds.active.map(hold=>hold.reason+' ('+hold.sourceType+')').join('، ')}</p>}
      </Card>
      <Card title="أداء المشتريات">
        <DataGrid columns={['أوامر الشراء','ملغاة','المطلوب','المستلم','نسبة الإكمال','مكتملة','تصحيحات','في الموعد','متأخر','غير مصنف']}>
          <tr><td>{overview.procurementMetrics.poCount}</td><td>{overview.procurementMetrics.cancelledPoCount}</td><td>{overview.procurementMetrics.orderedQuantity}</td><td>{overview.procurementMetrics.receivedQuantity}</td><td>{overview.procurementMetrics.completionRatio}</td><td>{overview.procurementMetrics.completedPoCount}</td><td>{overview.procurementMetrics.fulfillmentCorrectionCount}</td><td>{overview.procurementMetrics.onTimeCompletedCount}</td><td>{overview.procurementMetrics.lateCompletedCount}</td><td>{overview.procurementMetrics.unclassifiedTimingCount}</td></tr>
        </DataGrid>
      </Card>
      <Card title="التقييم">
        <Button onClick={()=>setEvaluationOpen(true)}>إضافة تقييم</Button>
        {overview.evaluation.latest?<p>الجودة {overview.evaluation.latest.qualityScore}/5 · الخدمة {overview.evaluation.latest.serviceScore}/5 · {overview.evaluation.latest.notes??'بدون ملاحظات'}</p>:<EmptyState title="لا يوجد تقييم بعد"/>}
        <DataGrid columns={['الإصدار','الجودة','الخدمة','الملاحظات','التاريخ']}>{overview.evaluation.history.map(item=><tr key={item.id}><td>{item.version}</td><td>{item.qualityScore}</td><td>{item.serviceScore}</td><td>{item.notes??'—'}</td><td>{item.evaluatedAt}</td></tr>)}</DataGrid>
      </Card>
      <Card title="النزاعات">
        <Button onClick={()=>setDisputeOpen(true)}>فتح نزاع</Button>
        <DataGrid columns={['الخطورة','العنوان','الحالة','التاريخ','إجراءات']}>{overview.disputes.history.map(dispute=><tr key={dispute.id}>
          <td>{dispute.severity}</td><td>{dispute.title}</td><td>{dispute.status}</td><td>{dispute.openedAt}</td>
          <td>{dispute.status==='OPEN'?<><Button onClick={()=>{setAction({kind:'resolve',dispute});setReason('');}}>حل</Button><Button onClick={()=>{setAction({kind:'cancel',dispute});setReason('');}}>إلغاء</Button></>:dispute.severity==='CRITICAL'&&overview.holds.criticalDisputeIds.includes(dispute.id)?<Button onClick={()=>{setAction({kind:'release',dispute});setReason('');}}>رفع Hold</Button>:null}</td>
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
        <FormField label="الخطورة" required><Select value={severity} onChange={e=>setSeverity(e.target.value)}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></Select></FormField>
        <FormField label="العنوان" required><Input required value={title} onChange={e=>setTitle(e.target.value)}/></FormField>
        <FormField label="الوصف" required><Textarea required value={description} onChange={e=>setDescription(e.target.value)}/></FormField>
        <Button type="submit">فتح النزاع</Button>
      </form>
    </Dialog>
    <Dialog open={Boolean(action)} title={action?.kind==='release'?'رفع Hold':action?.kind==='resolve'?'حل النزاع':'إلغاء النزاع'} onClose={()=>setAction(null)}>
      <FormField label={action?.kind==='resolve'?'قرار الحل':action?.kind==='release'?'سبب رفع Hold':'سبب الإلغاء'} required><Textarea required value={reason} onChange={e=>setReason(e.target.value)}/></FormField>
      <Button disabled={!reason.trim()} onClick={()=>void runAction()}>تأكيد</Button>
    </Dialog>
  </section>;
}
