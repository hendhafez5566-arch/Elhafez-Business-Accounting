import { type FormEvent, useState } from 'react';
import type { AccountRow, InvoiceRow } from './accounting-client.js';
import { advancedAccountingApi, type AdvancedResult } from './advanced-accounting-client.js';
import { ActionBar, Button, Card, FormField, Input, Select, Textarea, Toast } from './ui.js';

type RecognitionKind='PREPAID_EXPENSE'|'DEFERRED_REVENUE'|'DEFERRED_COST';
const today=()=>new Date().toISOString().slice(0,10);
const message=(error:unknown)=>error instanceof Error?error.message:'تعذر تنفيذ العملية.';
const isRecord=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null;
const resultId=(value:AdvancedResult)=>typeof value.id==='string'?value.id:'';
function firstPartId(value:AdvancedResult){
 const parts=Array.isArray(value.parts)?value.parts:[];
 const first=parts.find(isRecord);
 return first&&typeof first.id==='string'?first.id:'';
}
function ResultSummary({value}:{value:AdvancedResult|null}){
 if(!value)return null;
 return <Card title="آخر نتيجة"><p>المعرّف: {typeof value.id==='string'?value.id:'—'}</p><p>الحالة: {typeof value.status==='string'?value.status:'تمت العملية لدى المالك المعتمد'}</p></Card>;
}
function AccountSelect({label,value,onChange,accounts,required=false}:{label:string;value:string;onChange:(value:string)=>void;accounts:readonly AccountRow[];required?:boolean}){
 const choices=accounts.filter(item=>item.active&&item.postable);
 return <FormField label={label} required={required}><Select required={required} value={value} onChange={event=>onChange(event.target.value)}><option value="">اختر حسابًا</option>{choices.map(item=><option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</Select></FormField>;
}
function InvoiceSelect({label,value,onChange,invoices,type='CUSTOMER',required=false}:{label:string;value:string;onChange:(value:string)=>void;invoices:readonly InvoiceRow[];type?:'CUSTOMER'|'SUPPLIER';required?:boolean}){
 const choices=invoices.filter(item=>item.type===type&&item.status==='POSTED');
 return <FormField label={label} required={required}><Select required={required} value={value} onChange={event=>onChange(event.target.value)}><option value="">اختر فاتورة</option>{choices.map(item=><option key={item.id} value={item.id}>{item.number} — {item.outstanding} {item.currency}</option>)}</Select></FormField>;
}

export function RecognitionAccrualSection({accounts,invoices}:{accounts:readonly AccountRow[];invoices:readonly InvoiceRow[]}){
 const[notice,setNotice]=useState(''),[result,setResult]=useState<AdvancedResult|null>(null),[kind,setKind]=useState<RecognitionKind>('PREPAID_EXPENSE');
 const[sourceId,setSourceId]=useState(''),[sourceInvoiceId,setSourceInvoiceId]=useState(''),[currency,setCurrency]=useState('EGP'),[amount,setAmount]=useState(''),[baseAmount,setBaseAmount]=useState(''),[deferredAccountId,setDeferredAccountId]=useState(''),[recognitionAccountId,setRecognitionAccountId]=useState(''),[dates,setDates]=useState(today()),[postingDate,setPostingDate]=useState(today()),[number,setNumber]=useState('');
 const[scheduleId,setScheduleId]=useState(''),[partId,setPartId]=useState(''),[partDate,setPartDate]=useState(today()),[partNumber,setPartNumber]=useState('');
 const[accrual,setAccrual]=useState({sourceType:'TOURISM_SERVICE',sourceId:'',amount:'',serviceDate:today(),number:'',accruedRevenueAccountId:'',revenueAccountId:''}),[accrualId,setAccrualId]=useState(''),[clearInvoiceId,setClearInvoiceId]=useState(''),[clearDate,setClearDate]=useState(today()),[clearNumber,setClearNumber]=useState('');
 async function createSchedule(event:FormEvent){
  event.preventDefault();
  try{
   const invoice=kind==='PREPAID_EXPENSE'?'':sourceInvoiceId;
   const value=await advancedAccountingApi.createRecognitionSchedule({
    kind,sourceType:kind==='PREPAID_EXPENSE'?'EXPENSE':'INVOICE',sourceId:kind==='PREPAID_EXPENSE'?sourceId:invoice,
    ...(invoice?{sourceInvoiceId:invoice}:{}),currency:currency.toUpperCase(),sourceAmount:amount,baseAmount,
    deferredAccountId,recognitionAccountId,serviceDates:dates.split(/[\n,]+/).map(item=>item.trim()).filter(Boolean),postingDate,number,
   });
   setResult(value);setScheduleId(resultId(value));setPartId(firstPartId(value));setNotice('تم إنشاء جدول الاستحقاق والاعتراف.');
  }catch(error){setNotice(message(error));}
 }
 async function partAction(action:'post'|'reverse'){
  try{
   const value=action==='post'?await advancedAccountingApi.postRecognitionPart(scheduleId,partId,{postingDate:partDate,number:partNumber}):await advancedAccountingApi.reverseRecognitionPart(scheduleId,partId,{postingDate:partDate,number:partNumber});
   setResult(value);setNotice(action==='post'?'تم ترحيل جزء الاعتراف.':'تم عكس جزء الاعتراف مع الحفاظ على التاريخ.');
  }catch(error){setNotice(message(error));}
 }
 async function createAccrual(event:FormEvent){event.preventDefault();try{const value=await advancedAccountingApi.accrueRevenue(accrual);setResult(value);setAccrualId(resultId(value));setNotice('تم إثبات الإيراد المستحق.');}catch(error){setNotice(message(error));}}
 async function clearAccrual(){try{const value=await advancedAccountingApi.clearAccruedRevenue(accrualId,{billingInvoiceId:clearInvoiceId,postingDate:clearDate,number:clearNumber});setResult(value);setNotice('تمت تسوية الإيراد المستحق بالفاتورة.');}catch(error){setNotice(message(error));}}
 return <section dir="rtl" className="ui-page-stack">
  {notice?<Toast tone={notice.startsWith('تم')?'success':'error'}>{notice}</Toast>:null}
  <Card title="الاستحقاق والاعتراف">
   <form className="ui-filter-grid" onSubmit={createSchedule}>
    <FormField label="نوع الجدول"><Select value={kind} onChange={event=>setKind(event.target.value as RecognitionKind)}><option value="PREPAID_EXPENSE">مصروف مقدم</option><option value="DEFERRED_REVENUE">إيراد مؤجل</option><option value="DEFERRED_COST">تكلفة مؤجلة</option></Select></FormField>
    {kind==='PREPAID_EXPENSE'?<FormField label="معرّف المصروف المقدم" required><Input required value={sourceId} onChange={event=>setSourceId(event.target.value)}/></FormField>:<InvoiceSelect label={kind==='DEFERRED_REVENUE'?'فاتورة العميل المؤجلة':'فاتورة المورد المؤجلة'} value={sourceInvoiceId} onChange={setSourceInvoiceId} invoices={invoices} type={kind==='DEFERRED_REVENUE'?'CUSTOMER':'SUPPLIER'} required/>}
    <FormField label="العملة" required><Input required maxLength={3} value={currency} onChange={event=>setCurrency(event.target.value)}/></FormField>
    <FormField label="قيمة المصدر" required><Input required inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)}/></FormField>
    <FormField label="القيمة بالعملة الأساسية" required><Input required inputMode="decimal" value={baseAmount} onChange={event=>setBaseAmount(event.target.value)}/></FormField>
    <AccountSelect label="حساب المؤجل / المقدم" value={deferredAccountId} onChange={setDeferredAccountId} accounts={accounts} required/>
    <AccountSelect label="حساب الاعتراف" value={recognitionAccountId} onChange={setRecognitionAccountId} accounts={accounts} required/>
    <FormField label="تواريخ الخدمة — تاريخ بكل سطر" required><Textarea required value={dates} onChange={event=>setDates(event.target.value)}/></FormField>
    <FormField label="تاريخ القيد الأول" required><Input required type="date" value={postingDate} onChange={event=>setPostingDate(event.target.value)}/></FormField>
    <FormField label="رقم المستند" required><Input required value={number} onChange={event=>setNumber(event.target.value)}/></FormField>
    <Button type="submit">إنشاء جدول الاعتراف</Button>
   </form>
   <ActionBar>
    <Input aria-label="معرّف جدول الاعتراف" placeholder="معرّف الجدول" value={scheduleId} onChange={event=>setScheduleId(event.target.value)}/>
    <Input aria-label="معرّف جزء الاعتراف" placeholder="معرّف الجزء" value={partId} onChange={event=>setPartId(event.target.value)}/>
    <Input aria-label="تاريخ ترحيل الجزء" type="date" value={partDate} onChange={event=>setPartDate(event.target.value)}/>
    <Input aria-label="رقم مستند الجزء" placeholder="رقم المستند" value={partNumber} onChange={event=>setPartNumber(event.target.value)}/>
    <Button type="button" onClick={()=>void partAction('post')}>ترحيل الجزء</Button><Button type="button" variant="danger" onClick={()=>void partAction('reverse')}>عكس الجزء</Button>
   </ActionBar>
  </Card>
  <Card title="الإيرادات المستحقة">
   <form className="ui-filter-grid" onSubmit={createAccrual}>
    <FormField label="نوع المصدر" required><Input required value={accrual.sourceType} onChange={event=>setAccrual({...accrual,sourceType:event.target.value})}/></FormField>
    <FormField label="مرجع المصدر" required><Input required value={accrual.sourceId} onChange={event=>setAccrual({...accrual,sourceId:event.target.value})}/></FormField>
    <FormField label="القيمة" required><Input required inputMode="decimal" value={accrual.amount} onChange={event=>setAccrual({...accrual,amount:event.target.value})}/></FormField>
    <FormField label="تاريخ الخدمة" required><Input required type="date" value={accrual.serviceDate} onChange={event=>setAccrual({...accrual,serviceDate:event.target.value})}/></FormField>
    <FormField label="رقم القيد" required><Input required value={accrual.number} onChange={event=>setAccrual({...accrual,number:event.target.value})}/></FormField>
    <AccountSelect label="حساب الإيراد المستحق" value={accrual.accruedRevenueAccountId} onChange={value=>setAccrual({...accrual,accruedRevenueAccountId:value})} accounts={accounts} required/>
    <AccountSelect label="حساب الإيراد" value={accrual.revenueAccountId} onChange={value=>setAccrual({...accrual,revenueAccountId:value})} accounts={accounts} required/>
    <Button type="submit">إثبات الاستحقاق</Button>
   </form>
   <ActionBar>
    <Input aria-label="معرّف الاستحقاق" placeholder="معرّف الاستحقاق" value={accrualId} onChange={event=>setAccrualId(event.target.value)}/>
    <InvoiceSelect label="فاتورة التسوية" value={clearInvoiceId} onChange={setClearInvoiceId} invoices={invoices} required/>
    <Input aria-label="تاريخ تسوية الاستحقاق" type="date" value={clearDate} onChange={event=>setClearDate(event.target.value)}/>
    <Input aria-label="رقم مستند تسوية الاستحقاق" placeholder="رقم المستند" value={clearNumber} onChange={event=>setClearNumber(event.target.value)}/>
    <Button type="button" variant="secondary" onClick={()=>void clearAccrual()}>تسوية بالفاتورة</Button>
   </ActionBar>
  </Card>
  <ResultSummary value={result}/>
 </section>;
}

export function AllowancesSection({accounts,invoices}:{accounts:readonly AccountRow[];invoices:readonly InvoiceRow[]}){
 const[notice,setNotice]=useState(''),[result,setResult]=useState<AdvancedResult|null>(null),[allowanceId,setAllowanceId]=useState('');
 const[form,setForm]=useState({customerId:'',sourceReference:'',allowanceAccountId:'',expenseAccountId:'',releaseAccountId:'',amount:'',postingDate:today(),number:''});
 const[release,setRelease]=useState({amount:'',postingDate:today(),number:''}),[writeOff,setWriteOff]=useState({invoiceId:'',amount:'',postingDate:today(),number:''});
 async function recognize(event:FormEvent){event.preventDefault();try{const value=await advancedAccountingApi.recognizeAllowance({...form,...(form.customerId?{customerId:form.customerId}:{})});setResult(value);setAllowanceId(resultId(value));setNotice('تم تكوين مخصص الديون.');}catch(error){setNotice(message(error));}}
 async function releaseAllowance(){try{const value=await advancedAccountingApi.releaseAllowance(allowanceId,release);setResult(value);setNotice('تم رد جزء من المخصص.');}catch(error){setNotice(message(error));}}
 async function writeOffReceivable(){try{const value=await advancedAccountingApi.writeOffReceivable(allowanceId,writeOff);setResult(value);setNotice('تم تنفيذ الإعدام في حدود المخصص والرصيد المستحق.');}catch(error){setNotice(message(error));}}
 return <section dir="rtl" className="ui-page-stack">
  {notice?<Toast tone={notice.startsWith('تم')?'success':'error'}>{notice}</Toast>:null}
  <Card title="مخصصات الديون المشكوك فيها">
   <form className="ui-filter-grid" onSubmit={recognize}>
    <FormField label="العميل — اختياري"><Input value={form.customerId} onChange={event=>setForm({...form,customerId:event.target.value})}/></FormField>
    <FormField label="مرجع التقييم" required><Input required value={form.sourceReference} onChange={event=>setForm({...form,sourceReference:event.target.value})}/></FormField>
    <AccountSelect label="حساب المخصص" value={form.allowanceAccountId} onChange={value=>setForm({...form,allowanceAccountId:value})} accounts={accounts} required/>
    <AccountSelect label="حساب مصروف المخصص" value={form.expenseAccountId} onChange={value=>setForm({...form,expenseAccountId:value})} accounts={accounts} required/>
    <AccountSelect label="حساب رد المخصص" value={form.releaseAccountId} onChange={value=>setForm({...form,releaseAccountId:value})} accounts={accounts} required/>
    <FormField label="القيمة" required><Input required inputMode="decimal" value={form.amount} onChange={event=>setForm({...form,amount:event.target.value})}/></FormField>
    <FormField label="تاريخ الترحيل" required><Input required type="date" value={form.postingDate} onChange={event=>setForm({...form,postingDate:event.target.value})}/></FormField>
    <FormField label="رقم القيد" required><Input required value={form.number} onChange={event=>setForm({...form,number:event.target.value})}/></FormField>
    <Button type="submit">تكوين المخصص</Button>
   </form>
  </Card>
  <Card title="استخدام ورد المخصص">
   <FormField label="المخصص الحالي" required><Input required value={allowanceId} onChange={event=>setAllowanceId(event.target.value)}/></FormField>
   <div className="ui-grid-md">
    <form onSubmit={event=>{event.preventDefault();void releaseAllowance();}}>
     <FormField label="قيمة الرد" required><Input required inputMode="decimal" value={release.amount} onChange={event=>setRelease({...release,amount:event.target.value})}/></FormField>
     <FormField label="تاريخ الرد" required><Input required type="date" value={release.postingDate} onChange={event=>setRelease({...release,postingDate:event.target.value})}/></FormField>
     <FormField label="رقم مستند الرد" required><Input required value={release.number} onChange={event=>setRelease({...release,number:event.target.value})}/></FormField>
     <Button type="submit" variant="secondary">رد المخصص</Button>
    </form>
    <form onSubmit={event=>{event.preventDefault();void writeOffReceivable();}}>
     <InvoiceSelect label="فاتورة العميل" value={writeOff.invoiceId} onChange={value=>setWriteOff({...writeOff,invoiceId:value})} invoices={invoices} required/>
     <FormField label="قيمة الإعدام" required><Input required inputMode="decimal" value={writeOff.amount} onChange={event=>setWriteOff({...writeOff,amount:event.target.value})}/></FormField>
     <FormField label="تاريخ الإعدام" required><Input required type="date" value={writeOff.postingDate} onChange={event=>setWriteOff({...writeOff,postingDate:event.target.value})}/></FormField>
     <FormField label="رقم مستند الإعدام" required><Input required value={writeOff.number} onChange={event=>setWriteOff({...writeOff,number:event.target.value})}/></FormField>
     <Button type="submit" variant="danger">إعدام الرصيد</Button>
    </form>
   </div>
  </Card>
  <ResultSummary value={result}/>
 </section>;
}
