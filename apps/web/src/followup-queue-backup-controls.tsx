import { useEffect, useRef, useState } from 'react';
import { Button, FormField, Input } from './ui.js';
import { followupLocalContext } from './followup-local-context.js';
import { createFollowupQueueBackup, FOLLOWUP_BACKUP_MAX_BYTES, restoreFollowupQueueBackup } from './followup-draft-store.js';

export function FollowupQueueBackupControls({secret,disabled,onRestored}:{readonly secret:string;readonly disabled:boolean;readonly onRestored:()=>Promise<void>}){
 const[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[fileText,setFileText]=useState('');
 const mounted=useRef(true),running=useRef(false),selection=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;selection.current++;};},[]);
 async function choose(file:File|undefined){
  const current=++selection.current;setFileText('');setNotice('');if(!file)return;
  if(file.size>FOLLOWUP_BACKUP_MAX_BYTES){setNotice('ملف النسخة أكبر من ٥ ميجابايت.');return;}
  try{const text=await file.text();if(mounted.current&&current===selection.current)setFileText(text);}
  catch{if(mounted.current&&current===selection.current)setNotice('تعذرت قراءة الملف.');}
 }
 async function run(action:'export'|'import'){
  if(running.current)return;running.current=true;setBusy(true);setNotice('');
  try{
   const scope=followupLocalContext().scope,identity=JSON.stringify(scope);
   const active=()=>mounted.current&&identity===JSON.stringify(followupLocalContext().scope);
   if(action==='export'){
    const text=await createFollowupQueueBackup(scope,secret);if(!active())return;
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download='elhafez-followup-queue-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('جُهّز ملف طلبات المتابعة المشفّر للتنزيل. احتفظ به وبعبارة الحماية.');
   }else{
    const result=await restoreFollowupQueueBackup(scope,secret,fileText);if(!active())return;
    setNotice(`استُرجع ${result.added} طلب، واحتُفظ بـ ${result.retained} طلب موجود دون استبدال. لم يُرسل أي طلب.`);await onRestored();
   }
  }catch(error){if(mounted.current)setNotice(error instanceof Error?error.message:'تعذر التعامل مع النسخة الاحتياطية.');}
  finally{running.current=false;if(mounted.current)setBusy(false);}
 }
 return <aside aria-label="نسخة احتياطية لطلبات المتابعة">
  <p>الملف لطلبات المتابعة المحفوظة فقط، حتى ٥٠٠ طلب و٥ ميجابايت. لا يشمل المسودة أو قوائم الاختيار أو حسابات الشركة أو تسجيل الدخول. يحتاج نفس المستخدم والشركة والفرع وعبارة الحماية؛ لا يسترجع عبارة مفقودة. الاسترجاع يضيف الناقص ويحافظ على الموجود وعلى هويات الطلبات. التأكيدات المسترجعة سجل سابق وليست فحصًا لحالة الخادم الآن.</p>
  <Button type="button" disabled={disabled||busy||secret.length<12} onClick={()=>void run('export')}>تنزيل نسخة طلبات المتابعة المشفرة</Button>
  <FormField label="ملف طلبات المتابعة المشفر"><Input type="file" accept="application/json,.json" disabled={disabled||busy} onChange={event=>void choose(event.target.files?.[0])}/></FormField>
  <Button type="button" disabled={disabled||busy||secret.length<12||!fileText} onClick={()=>void run('import')}>استرجاع طلبات الملف دون إرسال</Button>
  {notice?<p role="status">{notice}</p>:null}
 </aside>;
}
