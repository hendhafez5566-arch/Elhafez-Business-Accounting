import { type FormEvent, useState } from 'react';
import { tourismContractInventoryApi, type InventoryResult } from './tourism-contract-inventory-client.js';
import { ActionBar, Button, Card, FormField, Input, Select, Textarea, Toast } from './ui.js';

type ServiceCategory='CAMP'|'MEAL'|'VISIT'|'GUIDE'|'RAWDA'|'INSURANCE'|'OTHER';
type TermRow={readonly key:string;readonly value:string};
const today=()=>new Date().toISOString().slice(0,10);
const message=(error:unknown)=>error instanceof Error?error.message:'تعذر تنفيذ العملية.';

export function TourismContractInventoryCorrectiveSection({contractId}:{contractId:string}){
 const[notice,setNotice]=useState(''),[result,setResult]=useState<InventoryResult|null>(null);
 const[terms,setTerms]=useState<TermRow[]>([{key:'',value:''}]),[effectiveFrom,setEffectiveFrom]=useState(today()),[effectiveTo,setEffectiveTo]=useState('');
 const[service,setService]=useState({category:'OTHER' as ServiceCategory,name:'',description:'',unit:'UNIT',serviceStart:today(),serviceEnd:today(),capacity:'1',releaseDeadline:''});
 function updateTerm(index:number,field:keyof TermRow,value:string){setTerms(rows=>rows.map((row,rowIndex)=>rowIndex===index?{...row,[field]:value}:row));}
 async function amend(event:FormEvent){
  event.preventDefault();
  const normalized=Object.fromEntries(terms.map(row=>[row.key.trim(),row.value]).filter(([key])=>Boolean(key)));
  if(!contractId){setNotice('اختر عقدًا أولًا.');return;}if(Object.keys(normalized).length===0){setNotice('أضف بند تعديل واحدًا على الأقل.');return;}
  try{const value=await tourismContractInventoryApi.amendContract(contractId,{terms:normalized,effectiveFrom,...(effectiveTo?{effectiveTo}:{}),commandKey:crypto.randomUUID()});setResult(value);setNotice('تم إنشاء نسخة تعديل جديدة للعقد.');}catch(error){setNotice(message(error));}
 }
 async function addService(event:FormEvent){
  event.preventDefault();if(!contractId){setNotice('اختر عقد خدمة أولًا.');return;}
  try{const value=await tourismContractInventoryApi.createService({contractId,category:service.category,name:service.name,...(service.description?{description:service.description}:{}),unit:service.unit,serviceStart:service.serviceStart,serviceEnd:service.serviceEnd,capacity:service.capacity,...(service.releaseDeadline?{releaseDeadline:service.releaseDeadline}:{}),commandKey:crypto.randomUUID()});setResult(value);setNotice('تمت إضافة مخزون الخدمة إلى العقد.');}catch(error){setNotice(message(error));}
 }
 return <section dir="rtl" className="ui-page-stack">
  {notice?<Toast tone={notice.startsWith('تم')?'success':'error'}>{notice}</Toast>:null}
  <div className="ui-grid-md">
   <Card title="تعديل العقد وإصداراته"><form onSubmit={amend}>
    {terms.map((row,index)=><div className="ui-filter-grid" key={index}><FormField label="اسم البند" required><Input required value={row.key} onChange={event=>updateTerm(index,'key',event.target.value)}/></FormField><FormField label="القيمة" required><Input required value={row.value} onChange={event=>updateTerm(index,'value',event.target.value)}/></FormField><Button type="button" variant="secondary" onClick={()=>setTerms(rows=>rows.length===1?[{key:'',value:''}]:rows.filter((_,rowIndex)=>rowIndex!==index))}>حذف البند</Button></div>)}
    <ActionBar><Button type="button" variant="secondary" onClick={()=>setTerms(rows=>[...rows,{key:'',value:''}])}>إضافة بند</Button></ActionBar>
    <FormField label="ساري من" required><Input required type="date" value={effectiveFrom} onChange={event=>setEffectiveFrom(event.target.value)}/></FormField>
    <FormField label="ساري إلى — اختياري"><Input type="date" value={effectiveTo} onChange={event=>setEffectiveTo(event.target.value)}/></FormField>
    <Button type="submit">إنشاء تعديل للعقد</Button>
   </form></Card>
   <Card title="مخزون الخدمات العامة"><form onSubmit={addService}>
    <FormField label="الفئة"><Select value={service.category} onChange={event=>setService({...service,category:event.target.value as ServiceCategory})}><option value="CAMP">مخيم</option><option value="MEAL">وجبات</option><option value="VISIT">زيارة</option><option value="GUIDE">إرشاد</option><option value="RAWDA">روضة</option><option value="INSURANCE">تأمين</option><option value="OTHER">أخرى</option></Select></FormField>
    <FormField label="اسم الخدمة" required><Input required value={service.name} onChange={event=>setService({...service,name:event.target.value})}/></FormField>
    <FormField label="الوصف"><Textarea value={service.description} onChange={event=>setService({...service,description:event.target.value})}/></FormField>
    <FormField label="وحدة القياس" required><Input required value={service.unit} onChange={event=>setService({...service,unit:event.target.value})}/></FormField>
    <FormField label="من" required><Input required type="date" value={service.serviceStart} onChange={event=>setService({...service,serviceStart:event.target.value})}/></FormField>
    <FormField label="إلى" required><Input required type="date" value={service.serviceEnd} onChange={event=>setService({...service,serviceEnd:event.target.value})}/></FormField>
    <FormField label="السعة" required><Input required inputMode="decimal" value={service.capacity} onChange={event=>setService({...service,capacity:event.target.value})}/></FormField>
    <FormField label="آخر موعد للإفراج — اختياري"><Input type="date" value={service.releaseDeadline} onChange={event=>setService({...service,releaseDeadline:event.target.value})}/></FormField>
    <Button type="submit">إضافة مخزون الخدمة</Button>
   </form></Card>
  </div>
  {result?<Card title="نتيجة آخر عملية"><p>المعرّف: {typeof result.id==='string'?result.id:'—'}</p><p>الحالة: {typeof result.status==='string'?result.status:'تم الحفظ لدى المالك المعتمد'}</p></Card>:null}
 </section>;
}
