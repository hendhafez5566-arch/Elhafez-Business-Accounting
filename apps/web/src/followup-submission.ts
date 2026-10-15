import { useEffect, useRef, useState } from 'react';
import { crmRequest } from './crm-core-client.js';
import { followupLocalContext } from './followup-local-context.js';
import { acceptFollowupSubmission, clearAcceptedFollowupSubmission, followupPayload, loadFollowupSubmission, prepareFollowupSubmission, type FollowupDraft, type FollowupSubmission } from './followup-draft-store.js';

export function useFollowupSubmission({draft,onRestore,onAccepted}:{draft:FollowupDraft;onRestore:(draft:FollowupDraft)=>void;onAccepted:()=>Promise<void>}) {
 const[secret,setSecret]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const running=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function run(action:'send'|'retry'|'restore'|'new') {
  if(running.current)return;
  running.current=true;setBusy(true);setNotice('');
  try{
   const {scope,api}=followupLocalContext(),identity=JSON.stringify(scope);
   const stillActive=()=>{if(!mounted.current||JSON.stringify(followupLocalContext().scope)!==identity)throw new Error('تغيرت الجلسة. طلب الحساب الأصلي يظل محفوظًا.');};
   if(action==='new'){
    await clearAcceptedFollowupSubmission(scope,secret);stillActive();
    onRestore({...draft,scheduledAt:'',nextAction:''});setNotice('يمكنك إدخال متابعة جديدة.');return;
   }
   const value:FollowupSubmission|null=action==='send'?await prepareFollowupSubmission(scope,secret,followupPayload(draft)):await loadFollowupSubmission(scope,secret);
   stillActive();if(!value){setNotice('لا يوجد طلب إرسال محفوظ لهذا المستخدم والفرع.');return;}
   if(action==='restore'){
    const date=new Date(value.payload.scheduledAt),offset=date.getTimezoneOffset()*60000;
    onRestore({...value.payload,scheduledAt:new Date(date.getTime()-offset).toISOString().slice(0,16)});
    setNotice(value.accepted?`الطلب مؤكّد برقم ${value.accepted.id}، حالته ${value.accepted.status}.`:'استُرجع طلب الإرسال الأصلي. أعد المحاولة بنفس بياناته.');return;
   }
   if(value.accepted){setNotice(`الطلب مؤكّد بالفعل برقم ${value.accepted.id}، حالته ${value.accepted.status}.`);return;}
   // Capture the original principal; never silently send under a replacement session.
   const result=await crmRequest<{id:string;status:string}>('/crm/followups',{method:'POST',body:JSON.stringify({...value.payload,requestId:value.requestId}),signal:AbortSignal.timeout(20000)},api);
   stillActive();
   await acceptFollowupSubmission(scope,secret,value,result);stillActive();
   setNotice(`تأكد قبول الطلب برقم ${result.id}، حالته ${result.status}.`);
   await onAccepted();
  }catch(error){if(mounted.current)setNotice((error instanceof Error?error.message:'تعذر الإرسال.')+' لم نحذف طلب الإرسال المحفوظ.');}
  finally{running.current=false;if(mounted.current)setBusy(false);}
 }
 return {secret,setSecret,busy,notice,send:()=>run('send'),retry:()=>run('retry'),restore:()=>run('restore'),startNew:()=>run('new')};
}
