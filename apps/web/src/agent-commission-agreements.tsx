import { useEffect, useRef, useState } from 'react';
import { Button, DataGrid, FormField, Input, Select, Textarea } from './ui.js';
import { crmRequest } from './crm-core-client.js';
type AgentOption={agent:{id:string;number:string};party:{displayName:string}};
type Agreement={id:string;version:number;parentAgentId:string;principalPercent:string;subordinatePercent:string;reason:string;createdAt:string};
type Snapshot={parentAgentId:string|null;agreements:Agreement[]};
type Command={requestId:string;parentAgentId:string;expectedVersion:number;principalPercent:string;reason:string};
export function AgentCommissionAgreements({agents}:{readonly agents:readonly AgentOption[]}){
 const[id,setId]=useState(''),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[percent,setPercent]=useState(''),[reason,setReason]=useState(''),[pending,setPending]=useState<Command|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
 const label=(id:string)=>{const row=agents.find(v=>v.agent.id===id);return row?`${row.agent.number} — ${row.party.displayName}`:'مندوب مسجل بالاتفاق';};
 async function load(value=id){
  const started=++generation.current;setSnapshot(null);setBusy(true);setNotice('');
  try{if(!value)return;const result=await crmRequest<Snapshot>(`/crm/agents/${encodeURIComponent(value)}/commission-agreements`,{signal:AbortSignal.timeout(15000)});if(started!==generation.current)return;setSnapshot(result);setPending(null);}
  catch(error){if(started===generation.current)setNotice(error instanceof Error?error.message:'تعذر تحميل الاتفاقات.');}
  finally{if(started===generation.current)setBusy(false);}
 }
 async function save(){
  if(busy||!snapshot?.parentAgentId)return;
  const started=generation.current,body=pending??{requestId:crypto.randomUUID(),parentAgentId:snapshot.parentAgentId,expectedVersion:Math.max(0,...snapshot.agreements.map(v=>v.version)),principalPercent:percent,reason};
  setPending(body);setBusy(true);setNotice('');
  try{await crmRequest(`/crm/agents/${encodeURIComponent(id)}/commission-agreements`,{method:'POST',body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(started!==generation.current)return;await load();setNotice('حُفظت نسخة اتفاق التقسيم التجاري. لم ينشأ استحقاق أو قيد أو صرف مالي.');}
  catch(error){if(started===generation.current)setNotice((error instanceof Error?error.message:'تعذر الحفظ.')+' إعادة المحاولة تستخدم نفس الطلب؛ حدّث وراجع الاتفاقات قبل تغيير البيانات.');}
  finally{if(started===generation.current)setBusy(false);}
 }
 return <section aria-label="اتفاق تقسيم عمولة المندوب">
  <h3>اتفاق تقسيم العمولة التجاري</h3><p>النسب من العمولة المتفق عليها، وليست من سعر البرنامج. نصيب التابع هو الباقي من ١٠٠٪. كل حفظ ينشئ نسخة مستقلة، ولا يطبق الاتفاق تلقائيًا على حجز أو يعدل مطالبة سابقة.</p>
  <FormField label="المندوب التابع للاتفاق"><Select disabled={busy} value={id} onChange={event=>{setId(event.target.value);setPending(null);setPercent('');setReason('');void load(event.target.value);}}><option value="">اختر المندوب</option>{agents.map(v=><option key={v.agent.id} value={v.agent.id}>{label(v.agent.id)}</option>)}</Select></FormField>
  {snapshot?<><p>الرئيسي في آخر تحميل: {snapshot.parentAgentId?label(snapshot.parentAgentId):'لا يوجد؛ اربط المندوب برئيسي أولًا.'}</p><FormField label="نصيب الرئيسي من العمولة (%)"><Input disabled={busy||Boolean(pending)} inputMode="decimal" value={percent} onChange={event=>setPercent(event.target.value)}/></FormField><FormField label="سبب الاتفاق أو مرجعه"><Textarea disabled={busy||Boolean(pending)} value={reason} onChange={event=>setReason(event.target.value)}/></FormField><Button type="button" disabled={busy||!snapshot.parentAgentId||(!pending&&(!percent||!reason.trim()))} onClick={()=>void save()}>{pending?'إعادة محاولة حفظ الاتفاق نفسه':'حفظ نسخة اتفاق جديدة'}</Button>
  {snapshot.agreements.length?<DataGrid columns={['النسخة','الرئيسي وقت الاتفاق','نصيبه %','نصيب التابع %','المرجع','التاريخ','العلاقة عند آخر تحميل']}>{snapshot.agreements.map(v=><tr key={v.id}><td>{v.version}</td><td>{label(v.parentAgentId)}</td><td>{v.principalPercent}</td><td>{v.subordinatePercent}</td><td>{v.reason}</td><td>{new Date(v.createdAt).toLocaleString('ar-EG')}</td><td>{v.parentAgentId===snapshot.parentAgentId?'نفس الرئيسي؛ يلزم اتفاق الحجز للتطبيق المالي':'اتفاق مع رئيسي سابق'}</td></tr>)}</DataGrid>:<p>لا توجد نسخ اتفاق محفوظة.</p>}</>:null}
  <Button type="button" disabled={busy||!id} onClick={()=>void load()}>تحديث ومراجعة الاتفاقات</Button>{notice?<p role="status">{notice}</p>:null}
 </section>;
}
