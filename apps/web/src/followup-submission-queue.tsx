import { FollowupQueueBackupControls } from './followup-queue-backup-controls.js';
import { useState } from 'react';
import { Button, DataGrid } from './ui.js';
import type { useFollowupSubmission } from './followup-submission.js';

type Submission=ReturnType<typeof useFollowupSubmission>;
export function FollowupSubmissionQueue({submission,leadLabel,responsibleLabel}:{readonly submission:Submission;readonly leadLabel:(id:string)=>string;readonly responsibleLabel:(id:string)=>string}) {
 const[includeConfirmed,setIncludeConfirmed]=useState(false);
 const pending=submission.items.filter(item=>!item.accepted),visible=includeConfirmed?submission.items:pending;
 return <aside aria-label="طلب إرسال المتابعة">
  <p>كل متابعة محفوظة لها طلب مستقل. يمكنك بدء متابعة أخرى مع الاحتفاظ بالسابقة. تستخدم القائمة نفس عبارة الحماية للطلبات المحفوظة. الإرسال يدوي، وحالة الانتظار تعني أن النتيجة لم تتأكد على هذا الجهاز.</p>
  <Button type="button" disabled={submission.busy} onClick={()=>void submission.queue()}>حفظ طلب بالقائمة دون إرسال</Button>
  <Button type="button" disabled={submission.busy} onClick={()=>void submission.showQueue()}>استرجاع قائمة الطلبات</Button>
  <Button type="button" disabled={submission.busy} onClick={()=>void submission.startAnother()}>بدء متابعة أخرى مع الاحتفاظ بالمحفوظة</Button>
  <Button type="button" disabled={submission.busy} onClick={()=>void submission.restore()}>استرجاع طلب الإرسال</Button>
  <Button type="button" disabled={submission.busy} onClick={()=>void submission.retry()}>إعادة محاولة الطلب المحفوظ</Button>
  <Button type="button" disabled={submission.busy} onClick={()=>void submission.startNew()}>بدء متابعة جديدة بعد التأكيد</Button>
  <p>المحمّلة: {submission.items.length} — بانتظار التأكيد: {pending.length} — مؤكدة: {submission.items.length-pending.length}</p>
  <label><input type="checkbox" checked={includeConfirmed} onChange={event=>setIncludeConfirmed(event.target.checked)}/>عرض الطلبات المؤكدة أيضًا</label>
  {visible.length?<DataGrid columns={['العميل المحتمل','المسؤول','الموعد','الإجراء التالي','حالة الإرسال','إجراءات']}>{visible.map(item=><tr key={item.requestId} aria-current={submission.selectedId===item.requestId?'true':undefined}>
   <td>{leadLabel(item.payload.leadId)}</td><td>{responsibleLabel(item.payload.responsibleUserId)}</td><td>{new Date(item.payload.scheduledAt).toLocaleString('ar-EG')}</td><td>{item.payload.nextAction||'—'}</td><td>{item.accepted?`مؤكد — ${submission.statusLabel(item.accepted.status)}`:'بانتظار تأكيد النتيجة'}</td><td><Button type="button" disabled={submission.busy} onClick={()=>void submission.restore(item.requestId)}>اختيار الطلب</Button>{!item.accepted?<Button type="button" disabled={submission.busy} onClick={()=>void submission.retry(item.requestId)}>إعادة إرسال هذا الطلب</Button>:null}</td>
  </tr>)}</DataGrid>:<p>لا توجد طلبات معروضة. أدخل عبارة الحماية واسترجع القائمة، أو احفظ طلبًا جديدًا.</p>}
  <FollowupQueueBackupControls secret={submission.secret} disabled={submission.busy} onRestored={submission.showQueue}/>
  {submission.notice?<p role="status">{submission.notice}</p>:null}
 </aside>;
}
