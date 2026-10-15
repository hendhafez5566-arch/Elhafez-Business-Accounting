import { useEffect, useRef, useState } from 'react';
import { crmRequest } from './crm-core-client.js';
import { followupLocalContext } from './followup-local-context.js';
import { acceptFollowupSubmission, beginAnotherFollowupSubmission, clearAcceptedFollowupSubmission, followupPayload, listFollowupSubmissions, loadFollowupSubmission, prepareFollowupSubmission, type FollowupDraft, type FollowupSubmission } from './followup-draft-store.js';

const statusLabels:Readonly<Record<string,string>>={SCHEDULED:'مجدولة',COMPLETED:'مكتملة',CANCELLED:'ملغاة'};
const statusLabel=(status:string)=>statusLabels[status]??'غير معروفة';

export function useFollowupSubmission({draft,onRestore,onAccepted}:{draft:FollowupDraft;onRestore:(draft:FollowupDraft)=>void;onAccepted:()=>Promise<void>}) {
 const[secret,setSecret]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const[items,setItems]=useState<FollowupSubmission[]>([]),[selectedId,setSelectedId]=useState<string>();
 const running=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function run(action:'send'|'queue'|'retry'|'restore'|'new'|'another'|'list',requestId?:string) {
  if(running.current)return;
  running.current=true;setBusy(true);setNotice('');
  try{
   const {scope,api}=followupLocalContext(),identity=JSON.stringify(scope);
   const stillActive=()=>{if(!mounted.current||JSON.stringify(followupLocalContext().scope)!==identity)throw new Error('تغيرت الجلسة. طلبات الحساب الأصلي تظل محفوظة.');};
   const refresh=async()=>{const values=await listFollowupSubmissions(scope,secret);stillActive();setItems(values);};
   if(action==='list'){await refresh();setNotice('تم استرجاع قائمة طلبات هذا المستخدم والفرع.');return;}
   if(action==='new'||action==='another'){
    if(action==='new')await clearAcceptedFollowupSubmission(scope,secret,selectedId);
    else await beginAnotherFollowupSubmission(scope,secret);
    stillActive();setSelectedId(undefined);onRestore({...draft,scheduledAt:'',nextAction:''});await refresh();
    setNotice(action==='new'?'يمكنك إدخال متابعة جديدة.':'يمكنك إدخال متابعة أخرى؛ كل الطلبات السابقة محفوظة بالقائمة.');return;
   }
   const value:FollowupSubmission|null=action==='send'||action==='queue'?await prepareFollowupSubmission(scope,secret,followupPayload(draft),selectedId):await loadFollowupSubmission(scope,secret,requestId??selectedId);
   stillActive();if(!value){setNotice('لا يوجد طلب إرسال محفوظ لهذا المستخدم والفرع.');return;}
   if(action==='send'||action==='queue'||action==='restore')setSelectedId(value.requestId);
   if(action==='restore'){
    const date=new Date(value.payload.scheduledAt),offset=date.getTimezoneOffset()*60000;
    onRestore({...value.payload,scheduledAt:new Date(date.getTime()-offset).toISOString().slice(0,16)});await refresh();
    setNotice(value.accepted?`الطلب مؤكّد برقم ${value.accepted.id}، حالته ${statusLabel(value.accepted.status)}.`:'استُرجع طلب الإرسال الأصلي. أعد المحاولة بنفس بياناته.');return;
   }
   if(action==='queue'){await refresh();setNotice('حُفظ طلب المتابعة مشفرًا بالقائمة على الجهاز؛ لم يُرسل.');return;}
   if(action==='send')await refresh();
   if(value.accepted){await refresh();setNotice(`الطلب مؤكّد بالفعل برقم ${value.accepted.id}، حالته ${statusLabel(value.accepted.status)}.`);return;}
   const result=await crmRequest<{id:string;status:string}>('/crm/followups',{method:'POST',body:JSON.stringify({...value.payload,requestId:value.requestId}),signal:AbortSignal.timeout(20000)},api);
   stillActive();await acceptFollowupSubmission(scope,secret,value,result);stillActive();await refresh();
   setNotice(`تأكد قبول الطلب برقم ${result.id}، حالته ${statusLabel(result.status)}.`);await onAccepted();
  }catch(error){if(mounted.current)setNotice((error instanceof Error?error.message:'تعذر الإرسال.')+' لم نحذف طلب الإرسال المحفوظ.');}
  finally{running.current=false;if(mounted.current)setBusy(false);}
 }
 return {statusLabel,secret,setSecret:(value:string)=>{setSecret(value);setItems([]);},busy,notice,items,selectedId,send:()=>run('send'),queue:()=>run('queue'),retry:(id?:string)=>run('retry',id),restore:(id?:string)=>run('restore',id),startNew:()=>run('new'),startAnother:()=>run('another'),showQueue:()=>run('list')};
}
