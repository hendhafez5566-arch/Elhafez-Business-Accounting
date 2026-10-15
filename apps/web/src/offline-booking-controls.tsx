import { useEffect, useRef, useState } from 'react';
import type { Booking, CreateBookingInput, ConfirmBookingInput } from './hajj-umrah-operations-client.js';
import { crmRequest } from './crm-core-client.js';
import { followupLocalContext } from './followup-local-context.js';
import { TENANT_SESSION_EVENT } from './tenant-session.js';
import { enqueueCommand, exportCommandVault, importCommandVault, loadCommandVault, recordCommandResult, saveDeviceGrant, type CommandVault, type DeviceGrant, type OfflineOperation } from './offline-command-store.js';
import styles from './offline-booking-controls.module.css';
const empty:CommandVault={grant:null,lastSeen:0,items:[]};
const labels={PENDING:'مؤقت / بانتظار الخادم',ACCEPTED:'اعتمده المالك على الخادم',REVIEW:'يحتاج مراجعة وتسوية'};
export function OfflineBookingControls({draft,bookings,confirmation,canCreate,canConfirm}:{readonly draft:CreateBookingInput;readonly bookings:readonly Booking[];readonly confirmation?:{bookingId:string;input:ConfirmBookingInput};readonly canCreate:boolean;readonly canConfirm:boolean}){
 const [secret,setSecret]=useState(''),[vault,setVault]=useState<CommandVault>(empty),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [cash,setCash]=useState({bookingId:'',treasuryId:'',number:'',postingDate:'',amount:''}),generation=useRef(0);
 useEffect(()=>{const reset=()=>{generation.current++;setSecret('');setVault(empty);setNotice('');setBusy(false);};window.addEventListener(TENANT_SESSION_EVENT,reset);return()=>{generation.current++;window.removeEventListener(TENANT_SESSION_EVENT,reset);};},[]);
 async function run(action:(context:ReturnType<typeof followupLocalContext>)=>Promise<CommandVault>,message:string){const started=generation.current;setBusy(true);try{if(secret.length<12)throw Error('أدخل عبارة حماية من 12 حرفًا على الأقل.');const value=await action(followupLocalContext());if(started===generation.current){setVault(value);setNotice(message);}}catch(error){if(started===generation.current)setNotice(error instanceof Error?error.message:'تعذر حفظ العملية؛ راجع سجل الجهاز.');}finally{if(started===generation.current)setBusy(false);}}
 async function delegate(includeCash=false){return run(async context=>{
  const prior=await loadCommandVault(context.scope,secret),deviceId=prior.grant?.deviceId??crypto.randomUUID();
  const operations:OfflineOperation[]=[...(canCreate?['BOOKING_CREATE' as const]:[]),...(canConfirm?['BOOKING_CONFIRM' as const]:[]),...(includeCash?['BOOKING_DEPOSIT' as const]:[])];
  const grant=await crmRequest<DeviceGrant>('/offline/delegations',{method:'POST',body:JSON.stringify({deviceId,operations,durationMinutes:240}),signal:AbortSignal.timeout(15000)},context.api);
  return saveDeviceGrant(context.scope,secret,grant);
 },'حُفظ تفويض الجهاز لأربع ساعات. يُعاد فحص الصلاحية عند المعالجة.');}
 async function sync(){return run(async context=>{let current=await loadCommandVault(context.scope,secret);for(const item of current.items){if(item.state!=='PENDING')continue;const {id,deviceId,grantId,operation,payload,dependencies,capturedAt}=item;const result=await crmRequest<{state:string;reason:string|null;result:unknown}>('/offline/commands',{method:'POST',body:JSON.stringify({id,deviceId,grantId,operation,payload,dependencies,capturedAt}),signal:AbortSignal.timeout(20000)},context.api);current=await recordCommandResult(context.scope,secret,id,result);}return current;},'اكتملت محاولة المزامنة. راجع حالة كل طلب؛ المعلّق لا يعني التأكيد.');}
 async function backup(){return run(async context=>{const text=await exportCommandVault(context.scope,secret),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');try{link.href=url;link.download='elhafez-encrypted-commands.json';link.click();}finally{URL.revokeObjectURL(url);}return loadCommandVault(context.scope,secret);},'صُدّرت نسخة مشفرة. احتفظ بعبارة الحماية منفصلة عنها.');}
 return <section className={styles.panel} aria-label="سجل المكتب والجهاز المنفصل" dir="rtl">
  <h3>طلبات الجهاز والمزامنة</h3>
  <p>خادم المكتب هو جهة الاعتماد. الطلب المحفوظ على الجهاز لا يؤكد مقعدًا ولا يسدد حسابًا. لا توجد ترقية تلقائية لخادم آخر عند انقطاع الإنترنت.</p>
  <label>عبارة حماية سجل الجهاز<input type="password" autoComplete="off" value={secret} onChange={e=>{setSecret(e.target.value);setVault(empty);}}/></label>
  <div className={styles.actions}>
   <button type="button" disabled={busy} onClick={()=>void delegate()}>تجهيز تفويض الحجز أثناء الاتصال</button>
   <button type="button" disabled={busy} onClick={()=>void delegate(true)}>تجهيز تفويض الحجز والقبض للمخوّل</button>
   <button type="button" disabled={busy} onClick={()=>void run(c=>loadCommandVault(c.scope,secret),'استُعيد سجل الجهاز دون إرسال طلبات.')}>فتح السجل المحلي</button>
   <button type="button" disabled={busy||!canCreate} onClick={()=>void run(c=>{if(!draft.code.trim()||!draft.programId.trim()||!draft.customerId.trim()||!draft.travelerIds.length)throw Error('أكمل بيانات الحجز الجديد أولًا.');return enqueueCommand(c.scope,secret,'BOOKING_CREATE',draft);},'حُفظ طلب حجز مبدئي مشفر. لا يوجد مقعد مؤكد بعد.')}>حفظ الحجز الجديد على الجهاز</button>
   {confirmation&&<button type="button" disabled={busy||!canConfirm} onClick={()=>void run(c=>enqueueCommand(c.scope,secret,'BOOKING_CONFIRM',{...confirmation.input,bookingId:confirmation.bookingId}),'حُفظ طلب التأكيد مؤقتًا؛ يُفحص المخزون عند عودة الاتصال.')}>حفظ طلب التأكيد مؤقتًا</button>}
  </div>
  {vault.grant&&<p>تفويض حتى {vault.grant.expiresAt}؛ الجهاز {vault.grant.deviceId}. سحب الصلاحية أثناء الانفصال لا يُعرف فورًا؛ يُفحص عند المزامنة.</p>}
  <fieldset disabled={busy}><legend>إثبات استلام نقدي مؤقت</legend>
   <p>احفظ الاستلام الفعلي حتى عند انتهاء التفويض؛ سيبقى للمراجعة ولن يُحتسب سدادًا قبل اعتماد الخادم.</p>
   <label>الحجز<select value={cash.bookingId} onChange={e=>setCash({...cash,bookingId:e.target.value})}><option value="">اختر حجزًا</option>{bookings.map(b=><option key={b.id} value={b.id}>{b.code}</option>)}</select></label>
   <label>الخزينة المستلمة<input value={cash.treasuryId} onChange={e=>setCash({...cash,treasuryId:e.target.value})}/></label>
   <label>رقم السند الرسمي المطلوب عند الاعتماد<input value={cash.number} onChange={e=>setCash({...cash,number:e.target.value})}/></label>
   <label>تاريخ الاستلام<input type="date" value={cash.postingDate} onChange={e=>setCash({...cash,postingDate:e.target.value})}/></label>
   <label>المبلغ بعملة الحساب والخزينة<input inputMode="decimal" value={cash.amount} onChange={e=>setCash({...cash,amount:e.target.value})}/></label>
   <button type="button" onClick={()=>void run(c=>{if(Object.values(cash).some(x=>!x.trim())||!/^\d+(?:\.\d+)?$/.test(cash.amount)||/^0(?:\.0+)?$/.test(cash.amount))throw Error('أكمل بيانات الاستلام بمبلغ موجب.');return enqueueCommand(c.scope,secret,'BOOKING_DEPOSIT',cash);},'حُفظ إثبات الاستلام. إيصال مؤقت فقط؛ لا سداد نهائي قبل الاعتماد.')}>حفظ إثبات استلام مؤقت</button>
  </fieldset>
  <div className={styles.actions}><button type="button" disabled={busy} onClick={()=>void sync()}>مزامنة المعلّق بنفس الهويات</button><button type="button" disabled={busy} onClick={()=>void backup()}>تنزيل نسخة مشفرة</button><label>استعادة نسخة مشفرة<input type="file" accept="application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void run(async c=>{if(file.size>10*1024*1024)throw Error('النسخة أكبر من الحد المدعوم.');return importCommandVault(c.scope,secret,await file.text());},'استُعيدت الطلبات دون حذف الموجود؛ يلزم التحقق من إيصالات الخادم.');e.target.value='';}}/></label><button type="button" onClick={()=>window.print()}>طباعة سجل الإيصالات المؤقتة</button></div>
  <p role="status">{busy?'جارٍ الحفظ أو الإرسال؛ لا تغلق الصفحة حتى تظهر النتيجة.':notice}</p>
  <table><caption>الطلبات محفوظة حتى عند الرفض؛ لا تحذف النسخة المحلية قبل التسوية</caption><thead><tr><th>الإيصال المؤقت</th><th>العملية</th><th>الحالة</th><th>المراجعة</th></tr></thead><tbody>{vault.items.map(item=><tr key={item.id}><td>TMP-{item.id}</td><td>{item.operation==='BOOKING_DEPOSIT'?'إثبات استلام':item.operation==='BOOKING_CREATE'?'حجز مبدئي':'طلب تأكيد'}</td><td>{labels[item.state]}</td><td>{item.reason??'—'}</td></tr>)}</tbody></table>
 </section>;
}
