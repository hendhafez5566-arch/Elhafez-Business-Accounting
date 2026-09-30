import{Card,Toast}from'./ui.js';

export interface CloseIssueView{key:string;detail:string}
export interface PeriodCloseOutcomeView{closed:boolean;alreadyClosed:boolean;blockers:CloseIssueView[];warnings:CloseIssueView[];deferred:{key:string;label:string;status:string}[]}

export function PeriodClosePanel({outcome}:{outcome:PeriodCloseOutcomeView|null}){
 if(!outcome)return null;
 return <Card title="نتيجة فحص الإغلاق">
  {outcome.closed?<Toast tone="success">{outcome.alreadyClosed?'الفترة مغلقة بالفعل.':'تم إغلاق الفترة بعد اجتياز فحوصات الرقابة.'}</Toast>:<Toast tone="error">تعذر الإغلاق لوجود موانع يجب معالجتها.</Toast>}
  {outcome.blockers.length?<div><strong>موانع الإغلاق</strong><ul>{outcome.blockers.map(item=><li key={item.key+item.detail}>{item.detail||item.key}</li>)}</ul></div>:null}
  {outcome.warnings.length?<div><strong>تنبيهات</strong><ul>{outcome.warnings.map(item=><li key={item.key+item.detail}>{item.detail||item.key}</li>)}</ul></div>:null}
  {outcome.deferred.length?<details><summary>فحوصات تحتاج سياسة Owner معتمدة</summary><ul>{outcome.deferred.map(item=><li key={item.key}>{item.label}</li>)}</ul></details>:null}
 </Card>;
}
