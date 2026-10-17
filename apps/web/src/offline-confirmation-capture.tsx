import {useEffect,useRef,useState} from 'react';
import {enqueueCommand} from './offline-command-store.js';
import {followupLocalContext} from './followup-local-context.js';
import {TENANT_SESSION_EVENT} from './tenant-session.js';
import type {ConfirmBookingInput} from './hajj-umrah-operations-client.js';
export function OfflineConfirmationCapture({bookingId,input,onQueued}:{readonly bookingId:string;readonly input:ConfirmBookingInput;readonly onQueued:()=>void}){
 const [secret,setSecret]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),generation=useRef(0);
 useEffect(()=>{const reset=()=>{generation.current++;setSecret('');setError('');};window.addEventListener(TENANT_SESSION_EVENT,reset);return()=>{generation.current++;window.removeEventListener(TENANT_SESSION_EVENT,reset);};},[]);
 async function save(){const started=generation.current;setBusy(true);setError('');try{
  if(secret.length<12)throw Error('أدخل عبارة حماية الجهاز المجهز مسبقًا.');
  if(!input.invoiceNumber||!input.postingDate||!input.dueDate||!input.costCenterId||!input.inventories.length||input.inventories.some(x=>!x.contractId||!x.resourceId||!x.serviceDate||!x.quantity))throw Error('أكمل بيانات التأكيد والمخزون قبل الحفظ.');
  const context=followupLocalContext();await enqueueCommand(context.scope,secret,'BOOKING_CONFIRM',{...input,bookingId});
  if(started===generation.current)onQueued();
 }catch(e){if(started===generation.current)setError(e instanceof Error?e.message:'تعذر حفظ الطلب.');}finally{if(started===generation.current)setBusy(false);}}
 return <fieldset disabled={busy}><legend>حفظ طلب التأكيد دون اتصال</legend><p>يلزم تفويض جهاز مجهز أثناء الاتصال. الرقم المدخل مرجع طلب؛ يخصص الخادم الرقم الرسمي عند الاعتماد. الحفظ مؤقت؛ السعة والفترة والفاتورة تُعتمد عند المزامنة.</p><label>عبارة حماية طلب التأكيد<input type="password" autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)}/></label><button type="button" onClick={()=>void save()}>حفظ طلب التأكيد على الجهاز</button><p role="status">{error}</p></fieldset>;
}
