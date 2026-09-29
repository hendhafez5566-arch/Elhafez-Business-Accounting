import { type FormEvent, useState } from 'react';
import { tourismContractInventoryApi, type InventoryResult } from './tourism-contract-inventory-client.js';
import { ActionBar, Button, Card, FormField, Input, Toast } from './ui.js';

type TermRow={readonly key:string;readonly value:string};
const today=()=>new Date().toISOString().slice(0,10);
const message=(error:unknown)=>error instanceof Error?error.message:'تعذر تنفيذ العملية.';

export function TourismContractInventoryCorrectiveSection({contractId}:{contractId:string}){
 const[notice,setNotice]=useState(''),[result,setResult]=useState<InventoryResult|null>(null);
 const[terms,setTerms]=useState<TermRow[]>([{key:'',value:''}]),[effectiveFrom,setEffectiveFrom]=useState(today()),[effectiveTo,setEffectiveTo]=useState(today());
 function updateTerm(index:number,field:keyof TermRow,value:string){setTerms(rows=>rows.map((row,rowIndex)=>rowIndex===index?{...row,[field]:value}:row));}
 async function amend(event:FormEvent){event.preventDefault();const normalized=Object.fromEntries(terms.map(row=>[row.key.trim(),row.value]).filter(([key])=>Boolean(key)));if(!contractId){setNotice('اختر عقدًا أولًا.');return;}if(Object.keys(normalized).length===0){setNotice('أضف بند تعديل واحدًا على الأقل.');return;}try{const value=await tourismContractInventoryApi.amendContract(contractId,{terms:normalized,effectiveFrom,effectiveTo,commandKey:crypto.randomUUID()});setResult(value);setNotice('تم إنشاء نسخة تعديل جديدة للعقد.');}catch(error){setNotice(message(error));}}
 return <section dir="rtl" className="ui-page-stack">
  {notice?<Toast tone={notice.startsWith('تم')?'success':'error'}>{notice}</Toast>:null}
  <Card title="تعديل العقد وإصداراته"><p>التعديل ينشئ نسخة جديدة من شروط العقد ولا يغيّر أي حقيقة مالية أو مستند محاسبي.</p><form onSubmit={amend}>
   {terms.map((row,index)=><div className="ui-filter-grid" key={index}><FormField label="اسم البند" required><Input required value={row.key} onChange={event=>updateTerm(index,'key',event.target.value)}/></FormField><FormField label="القيمة" required><Input required value={row.value} onChange={event=>updateTerm(index,'value',event.target.value)}/></FormField><Button type="button" variant="secondary" onClick={()=>setTerms(rows=>rows.length===1?[{key:'',value:''}]:rows.filter((_,rowIndex)=>rowIndex!==index))}>حذف البند</Button></div>)}
   <ActionBar><Button type="button" variant="secondary" onClick={()=>setTerms(rows=>[...rows,{key:'',value:''}])}>إضافة بند</Button></ActionBar>
   <FormField label="ساري من" required><Input required type="date" value={effectiveFrom} onChange={event=>setEffectiveFrom(event.target.value)}/></FormField>
   <FormField label="ساري إلى" required><Input required type="date" value={effectiveTo} onChange={event=>setEffectiveTo(event.target.value)}/></FormField>
   <Button type="submit">إنشاء تعديل للعقد</Button>
  </form></Card>
  {result?<Card title="نتيجة آخر تعديل"><p>المعرّف: {typeof result.id==='string'?result.id:'—'}</p><p>الحالة: {typeof result.status==='string'?result.status:'تم الحفظ لدى المالك المعتمد'}</p></Card>:null}
 </section>;
}
