import {useEffect,useState} from 'react';
import {advancedAccountingApi} from './advanced-accounting-client.js';
import type {Booking,BookingAgentChangeProposal,ChangeBookingAgentInput,HajjUmrahOperationsApi} from './hajj-umrah-operations-client.js';
import {makeOperationCommandKey} from './hajj-umrah-operation-command-key.js';
import {Button,Checkbox,DataGrid,Dialog,FormField,Input,Select,Textarea,Toast} from './ui.js';

export function BookingAgentChangeControl({booking,agents,api,onSaved}:{readonly booking:Booking;readonly agents:readonly {id:string;label:string}[];readonly api:HajjUmrahOperationsApi;readonly onSaved:(message?:string)=>Promise<void>}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[proposal,setProposal]=useState<BookingAgentChangeProposal|null>(null),[labels,setLabels]=useState<Record<string,string>>({});
 const [form,setForm]=useState({newAgentId:'',currency:'',reason:'',postingDate:'',number:'',reviewed:false});
 const pending=booking.financialMutation?.kind==='AGENT_CHANGE'&&booking.financialMutation.state==='PENDING'?booking.financialMutation.input:null;
 useEffect(()=>{if(!open)return;let current=true;setNotice('');setBusy(true);
  if(pending){setForm({...pending});setProposal({claims:[],totals:[],currencies:[pending.currency],expectedRemaining:pending.expectedRemaining,newAgentAgreement:null});setBusy(false);return;}
  if(!api.prepareAgentChange)return;
  void Promise.all([api.prepareAgentChange(booking.id,form.newAgentId||undefined),advancedAccountingApi.commissionClaims(),api.confirmationOptions?.()]).then(([value,claims,options])=>{if(!current)return;setProposal(value);setLabels(Object.fromEntries(claims.map(x=>[x.id,x.label])));setForm(old=>({...old,currency:value.currencies[0]||old.currency||options?.currencies[0]||'',reviewed:false}));}).catch(error=>{if(current)setNotice(error instanceof Error?error.message:'تعذر إعداد تسوية المندوب');}).finally(()=>{if(current)setBusy(false);});
  return()=>{current=false;};
 },[open,booking.id,pending,form.newAgentId,api]);
 async function save(){if(!api.changeBookingAgent||!proposal||busy)return;setBusy(true);try{
  const agreement=proposal.newAgentAgreement,input:ChangeBookingAgentInput=pending??{...form,commandKey:makeOperationCommandKey('booking-agent-change',booking.id,form.number),expectedRemaining:proposal.expectedRemaining,expectedAgreement:agreement?{agreementId:agreement.agreementId,agreementVersion:agreement.agreementVersion}:null};
  const result=await api.changeBookingAgent(booking.id,input);const changed=result.financialMutation?.evidence?.changed!==false;await onSaved(changed?'تم تغيير المندوب وحفظ تاريخ العمولة والمدفوع السابق.':result.financialMutation?.evidence?.reason??'تغيرت الأرصدة؛ راجع اقتراحًا جديدًا.');setOpen(false);
 }catch(error){setNotice(error instanceof Error?error.message:'تعذر تغيير المندوب؛ يمكن استئناف الطلب نفسه.');}finally{setBusy(false);}}
 return <><Button type="button" disabled={!api.changeBookingAgent||booking.financialMutation?.state==='PENDING'&&!pending} onClick={()=>setOpen(true)}>{pending?'استئناف تغيير المندوب':'تغيير المندوب'}</Button><Dialog open={open} title="تغيير المندوب وتسوية العمولة" onClose={()=>{if(!busy)setOpen(false);}}>
  {notice&&<Toast>{notice}</Toast>}
  <p>تبقى المطالبات والدفعات السابقة محفوظة. ينتقل الاستحقاق غير المدفوع فقط، وتُنشأ مطالبات المندوب الجديد للمراجعة والاعتماد.</p>
  <FormField label="المندوب الجديد" required><Select required disabled={busy||!!pending} value={form.newAgentId} onChange={e=>{setProposal(null);setForm({...form,newAgentId:e.target.value,reviewed:false});}}><option value="">اختر المندوب</option>{agents.filter(x=>x.id!==booking.agentId).map(x=><option key={x.id} value={x.id}>{x.label}</option>)}{pending&&!agents.some(x=>x.id===pending.newAgentId)&&<option value={pending.newAgentId}>المندوب المحفوظ في الطلب</option>}</Select></FormField>
  {pending&&<p>أنصبة الطلب المحفوظ غير المدفوعة: {pending.expectedRemaining.map(x=>x.amount+' '+pending.currency).join('، ')}. تُستأنف الهوية نفسها دون تغيير بياناتها.</p>}
  {proposal&&<><DataGrid columns={['المستفيد السابق','الاستحقاق الأصلي','المدفوع المحفوظ','غير المدفوع المنقول']}>{proposal.claims.map(x=><tr key={x.claimId}><td>{labels[x.claimId]??'مستفيد محفوظ'}</td><td>{x.originalAmount} {x.currency}</td><td>{x.paidAmount} {x.currency}</td><td>{x.amount} {x.currency}</td></tr>)}</DataGrid>{proposal.totals.map(x=><p key={x.currency}>الاستحقاق المنقول: {x.amount} {x.currency}</p>)}{proposal.newAgentAgreement?<p>نسخة الاتفاق {proposal.newAgentAgreement.agreementVersion}؛ نصيب الرئيسي {proposal.newAgentAgreement.principalPercent}% والباقي للتابع وفق دقة العملة.</p>:!pending&&<p>المندوب الجديد مستفيد منفرد دون اتفاق رئيسي/تابع.</p>}</>}
  <FormField label="عملة تسوية العمولة"><Input readOnly value={form.currency}/></FormField>
  <FormField label="سبب تغيير المندوب" required><Textarea disabled={busy||!!pending} required minLength={10} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></FormField>
  <FormField label="تاريخ تسوية المندوب" required><Input disabled={busy||!!pending} required type="date" value={form.postingDate} onChange={e=>setForm({...form,postingDate:e.target.value})}/></FormField>
  <FormField label="رقم مستند تسوية المندوب" required><Input disabled={busy||!!pending} required value={form.number} onChange={e=>setForm({...form,number:e.target.value})}/></FormField>
  <label><Checkbox disabled={busy||!!pending} checked={form.reviewed} onChange={e=>setForm({...form,reviewed:e.target.checked})}/> راجعت المدفوع السابق والجزء المنقول واتفاق المندوب الجديد</label>
  <Button type="button" disabled={busy||!proposal||!form.newAgentId||!form.reviewed||!form.number.trim()||!form.postingDate||form.reason.trim().length<10} onClick={()=>void save()}>{pending?'استئناف التسوية المحفوظة':'اعتماد تغيير المندوب بالأنصبة المعروضة'}</Button>
 </Dialog></>;
}
