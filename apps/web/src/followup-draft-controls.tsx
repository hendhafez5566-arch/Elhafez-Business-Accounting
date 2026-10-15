import { useEffect, useRef, useState } from 'react';
import { Button, FormField, Input } from './ui.js';
import { TENANT_SESSION_EVENT } from './tenant-session.js';
import { deleteFollowupDraft, loadFollowupDraft, saveFollowupDraft, type FollowupDraft } from './followup-draft-store.js';

import { followupLocalContext } from './followup-local-context.js';

export function FollowupDraftControls({draft,onRestore,secret,onSecretChange,disabled=false}:{readonly draft:FollowupDraft;readonly onRestore:(value:FollowupDraft)=>void;readonly secret:string;readonly onSecretChange:(value:string)=>void;readonly disabled?:boolean}) {
 const[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),mounted=useRef(true);
 useEffect(()=>{
  mounted.current=true;
  const reset=()=>{generation.current++;onSecretChange('');setNotice('');};
  window.addEventListener(TENANT_SESSION_EVENT,reset);
  return()=>{mounted.current=false;generation.current++;window.removeEventListener(TENANT_SESSION_EVENT,reset);};
 },[]);
 async function run(action:'save'|'restore'|'delete') {
  const started=generation.current;
  setBusy(true);setNotice('');
  try{
   const scope=followupLocalContext().scope,identity=JSON.stringify(scope);
   if(action==='save')await saveFollowupDraft(scope,secret,draft);
   const loaded=action==='restore'?await loadFollowupDraft(scope,secret):null;
   if(action==='delete')await deleteFollowupDraft(scope);
   if(!mounted.current||started!==generation.current||identity!==JSON.stringify(followupLocalContext().scope))return;
   if(loaded)onRestore(loaded);
   setNotice(action==='save'?'حُفظت المسودة مشفرة على هذا الجهاز فقط؛ لم تُرسل ولم تُجدول.':action==='delete'?'حُذفت المسودة المحلية.':loaded?'استُرجعت المسودة. راجع البيانات قبل الجدولة؛ لم تُرسل بعد.':'لا توجد مسودة محفوظة لهذا المستخدم والفرع.');
  }catch(error){if(mounted.current&&started===generation.current)setNotice(error instanceof Error?error.message:'تعذر التعامل مع المسودة.');}
  finally{if(mounted.current)setBusy(false);}
 }
 return <aside aria-label="مسودة المتابعة المحلية">
  <p>مسودة واحدة لكل مستخدم وفرع على هذا المتصفح. الحفظ يستبدل المسودة السابقة. ليست متابعة مجدولة، ولا تُرسل تلقائيًا. احتفظ بعبارة الحماية؛ لا يمكن استعادة المسودة بدونها.</p>
  <FormField label="عبارة حماية المسودة"><Input type="password" disabled={disabled||busy} autoComplete="off" value={secret} onChange={event=>onSecretChange(event.target.value)}/></FormField>
  <Button type="button" disabled={disabled||busy||secret.length<12} onClick={()=>void run('save')}>حفظ مسودة على الجهاز</Button>
  <Button type="button" disabled={disabled||busy||secret.length<12} onClick={()=>void run('restore')}>استرجاع المسودة المحلية</Button>
  <Button type="button" disabled={disabled||busy} onClick={()=>void run('delete')}>حذف المسودة المحلية</Button>
  {notice?<p role="status">{notice}</p>:null}
 </aside>;
}
