import {useEffect,useState,type FormEvent} from 'react';
import {crmRequest} from './crm-core-client.js';
import {TENANT_SESSION_EVENT} from './tenant-session.js';

interface Credit {id:string;available:string;baseCurrency:string}
interface Props {bookingId:string;invoiceId:string;code:string;credits:readonly Credit[]}

export function FamilyBookingRefund({bookingId,invoiceId,code,credits}:Props) {
 const [creditId,setCreditId]=useState(credits[0]?.id??'');
 const [treasuries,setTreasuries]=useState<readonly {id:string;label:string}[]>([]);
 const [form,setForm]=useState({treasuryId:'',paymentCurrency:credits[0]?.baseCurrency??'EGP',
  paymentAmount:'',postingDate:'',number:'',reason:''});
 const [commandKey,setCommandKey]=useState(()=>crypto.randomUUID());
 const [reviewed,setReviewed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [posted,setPosted]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  const reset=()=>{setCreditId('');setTreasuries([]);setReviewed(false);setPosted(false);setMessage('');setCommandKey(crypto.randomUUID());};
  window.addEventListener(TENANT_SESSION_EVENT,reset);
  return()=>window.removeEventListener(TENANT_SESSION_EVENT,reset);
 },[]);
 const credit=credits.find(x=>x.id===creditId);
 function change(next:Partial<typeof form>){setForm(current=>({...current,...next}));setCommandKey(crypto.randomUUID());setReviewed(false);}
 async function refreshCash(){
  try {setTreasuries(await crmRequest<readonly {id:string;label:string}[]>('/offline/cash-options'));}
  catch(error){setMessage(error instanceof Error?error.message:'تعذر قراءة الخزائن.');}
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!credit||!reviewed||posted||busy)return;
  setBusy(true);setMessage('');
  try {
   const result=await crmRequest<{voucherId:string}>('/hajj-umrah/family-statement/refunds',{
    method:'POST',
    body:JSON.stringify({
     bookingId,invoiceId,advanceId:credit.id,treasuryId:form.treasuryId,
     commandKey,paymentCurrency:form.paymentCurrency.trim().toUpperCase(),
     paymentAmount:form.paymentAmount,postingDate:form.postingDate,
     number:form.number,reason:form.reason,reviewed,
    }),
    signal:AbortSignal.timeout(45000),
   });
   setPosted(true);setMessage('تم ترحيل سند الاسترداد '+result.voucherId+'؛ أعد عرض الكشف لقراءة الرصيد الجديد.');
  } catch(error) {
   setMessage((error instanceof Error?error.message:'تعذر تأكيد الصرف.')+
    ' لا تغيّر الطلب إذا انقطع الرد؛ أعد المحاولة بنفس رقم العملية لتجنب التكرار.');
  } finally {setBusy(false);}
 }
 if(!credits.length)return null;
 return <details dir="rtl">
  <summary>استرداد رصيد دائن للحجز {code}</summary>
  <form onSubmit={event=>void submit(event)}>
   <p>استرداد من إشعار دائن موجود فقط. الرصيد المتاح بعملة الأساس؛ مبلغ الصرف يكون بعملة الخزينة، ويُراجع سعر التحويل عند الاعتماد.</p>
   <label>الإشعار الدائن
    <select value={creditId} onChange={event=>{setCreditId(event.target.value);setReviewed(false);setCommandKey(crypto.randomUUID());}} disabled={busy||posted}>
     {credits.map(c=><option key={c.id} value={c.id}>{c.id} — متاح {c.available} {c.baseCurrency}</option>)}
    </select>
   </label>
   <button type="button" onClick={()=>void refreshCash()} disabled={busy||posted}>تحميل الخزائن المتاحة</button>
   <label>الخزينة
    <select required value={form.treasuryId} onChange={e=>change({treasuryId:e.target.value})} disabled={busy||posted}>
     <option value="">اختر الخزينة</option>{treasuries.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
   </label>
   <label>عملة الصرف
    <input required maxLength={3} value={form.paymentCurrency} onChange={e=>change({paymentCurrency:e.target.value})} disabled={busy||posted}/>
   </label>
   <label>مبلغ الصرف بهذه العملة
    <input required inputMode="decimal" value={form.paymentAmount} onChange={e=>change({paymentAmount:e.target.value})} disabled={busy||posted}/>
   </label>
   <label>تاريخ الصرف
    <input required type="date" value={form.postingDate} onChange={e=>change({postingDate:e.target.value})} disabled={busy||posted}/>
   </label>
   <label>رقم سند الصرف
    <input required value={form.number} onChange={e=>change({number:e.target.value})} disabled={busy||posted}/>
   </label>
   <label>سبب الصرف
    <textarea required minLength={10} value={form.reason} onChange={e=>change({reason:e.target.value})} disabled={busy||posted}/>
   </label>
   <label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)} disabled={busy||posted}/>
    راجعت إشعار العميل والمبلغ والعملة والخزينة؛ وأوافق على ترحيل سند الصرف.
   </label>
   <button type="submit" disabled={!reviewed||busy||posted||!credit}>{busy?'جارٍ التحقق من الصرف…':'تأكيد وصرف الاسترداد'}</button>
   <p role="status">{message}</p>
  </form>
 </details>;
}
