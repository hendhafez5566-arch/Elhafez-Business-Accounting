import { useEffect, useRef, useState } from 'react';
import { Button } from './ui.js';
import { followupLocalContext } from './followup-local-context.js';
import { deleteFollowupReferences, loadFollowupReferences, saveFollowupReferences, type FollowupReferences } from './followup-draft-store.js';

export function FollowupReferenceControls({references,secret,disabled,onRestore,onRefresh}:{readonly references:FollowupReferences|null;readonly secret:string;readonly disabled:boolean;readonly onRestore:(value:FollowupReferences)=>void;readonly onRefresh:()=>Promise<void>}) {
 const[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const mounted=useRef(true),running=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function run(action:'save'|'restore'|'delete') {
  if(running.current)return;
  running.current=true;setBusy(true);setNotice('');
  try{
   const scope=followupLocalContext().scope,identity=JSON.stringify(scope);
   const active=()=>mounted.current&&identity===JSON.stringify(followupLocalContext().scope);
   if(action==='save'){
    if(!references)throw new Error('حمّل قوائم الاختيار من الخادم أولًا.');
    await saveFollowupReferences(scope,secret,references);
    if(active())setNotice('حُفظت قوائم الاختيار مشفرة على الجهاز، دون بيانات اتصال أو حسابات.');
   }else if(action==='delete'){
    await deleteFollowupReferences(scope);if(active())setNotice('حُذفت نسخة قوائم الاختيار من الجهاز؛ المسودات والطلبات محفوظة.');
   }else{
    const value=await loadFollowupReferences(scope,secret);
    if(!active())return;
    if(!value){setNotice('لا توجد قوائم اختيار محفوظة لهذا المستخدم والفرع.');return;}
    onRestore(value);setNotice('استُرجعت نسخة محلية للاختيار فقط؛ سيعيد الخادم التحقق عند الإرسال.');
   }
  }catch(error){if(mounted.current)setNotice(error instanceof Error?error.message:'تعذر التعامل مع قوائم الاختيار.');}
  finally{running.current=false;if(mounted.current)setBusy(false);}
 }
 return <aside aria-label="قوائم المتابعة المحلية">
  <p>احفظ أسماء العملاء المحتملين والمسؤولين للاختيار أثناء الانقطاع، بنفس عبارة حماية المسودة. النسخة قديمة بمجرد تغير بيانات الخادم وليست إثبات صلاحية أو قبول.</p>
  <Button type="button" disabled={disabled||busy||secret.length<12||!references} onClick={()=>void run('save')}>حفظ قوائم الاختيار على الجهاز</Button>
  <Button type="button" disabled={disabled||busy||secret.length<12} onClick={()=>void run('restore')}>استرجاع قوائم الاختيار المحلية</Button>
  <Button type="button" disabled={disabled||busy} onClick={()=>void run('delete')}>حذف قوائم الاختيار المحلية</Button>
  <Button type="button" disabled={disabled||busy} onClick={()=>void onRefresh()}>تحديث قوائم الاختيار من الخادم</Button>
  {notice?<p role="status">{notice}</p>:null}
 </aside>;
}
