import{type FormEvent,useEffect,useState}from'react';
import{crmGet,crmPost}from'./crm-core-client.js';
import{ActionBar,Badge,Button,Card,DataGrid,DisclosureCard,EmptyState,ErrorState,FormField,Input,Select,Textarea,Toast}from'./ui.js';

type CustomerView={customer:{id:string;number:string};party:{displayName:string}};
type CaseStatus='OPEN'|'IN_PROGRESS'|'WAITING_CUSTOMER'|'RESOLVED'|'CLOSED';
type ServiceCase={id:string;number:string;customerId:string;category:'COMPLAINT'|'SUPPORT'|'REQUEST';priority:'LOW'|'NORMAL'|'HIGH'|'CRITICAL';subject:string;description:string;status:CaseStatus;assigneeUserId:string|null;slaDueAt:string|null;resolvedAt:string|null;closedAt:string|null;createdAt:string;updatedAt:string};
type Note={id:string;visibility:'INTERNAL'|'CUSTOMER';body:string;authorId:string;createdAt:string};
type History={id:string;action:string;detail:string|null;actorId:string;occurredAt:string};
const statusLabel:Record<CaseStatus,string>={OPEN:'مفتوحة',IN_PROGRESS:'قيد المعالجة',WAITING_CUSTOMER:'بانتظار العميل',RESOLVED:'تم الحل',CLOSED:'مغلقة'};
const categoryLabel={COMPLAINT:'شكوى',SUPPORT:'دعم',REQUEST:'طلب'} as const;
const priorityLabel={LOW:'منخفضة',NORMAL:'عادية',HIGH:'مرتفعة',CRITICAL:'حرجة'} as const;
function message(e:unknown){return e instanceof Error?e.message:'تعذر تنفيذ العملية.';}

export function CustomerServicePage(){
 const[cases,setCases]=useState<ServiceCase[]>([]),[customers,setCustomers]=useState<CustomerView[]>([]),[status,setStatus]=useState(''),[selected,setSelected]=useState<ServiceCase|null>(null),[notes,setNotes]=useState<Note[]>([]),[history,setHistory]=useState<History[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const[form,setForm]=useState({customerId:'',category:'COMPLAINT' as ServiceCase['category'],priority:'NORMAL' as ServiceCase['priority'],subject:'',description:'',assigneeUserId:'',slaDueAt:''});
 const[note,setNote]=useState(''),[visibility,setVisibility]=useState<'INTERNAL'|'CUSTOMER'>('INTERNAL'),[assignee,setAssignee]=useState('');
 async function load(){try{const[c,u]=await Promise.all([crmGet<ServiceCase[]>('/customer-service/cases'+(status?'?status='+status:'')),crmGet<CustomerView[]>('/crm/customers?status=ACTIVE')]);setCases(c);setCustomers(u);setError('');}catch(e){setError(message(e));}}
 useEffect(()=>{void load();},[status]);
 async function choose(row:ServiceCase){setSelected(row);setAssignee(row.assigneeUserId??'');try{const[n,h]=await Promise.all([crmGet<Note[]>('/customer-service/cases/'+row.id+'/notes'),crmGet<History[]>('/customer-service/cases/'+row.id+'/history')]);setNotes(n);setHistory(h);}catch(e){setNotice(message(e));}}
 async function create(event:FormEvent){event.preventDefault();try{await crmPost('/customer-service/cases',{customerId:form.customerId,category:form.category,priority:form.priority,subject:form.subject,description:form.description,...form.assigneeUserId?{assigneeUserId:form.assigneeUserId}:{},...form.slaDueAt?{slaDueAt:new Date(form.slaDueAt).toISOString()}:{}});setForm({customerId:'',category:'COMPLAINT',priority:'NORMAL',subject:'',description:'',assigneeUserId:'',slaDueAt:''});setNotice('تم فتح الحالة وتسجيلها في سجل خدمة العملاء.');await load();}catch(e){setNotice(message(e));}}
 async function transition(next:CaseStatus){if(!selected)return;try{const updated=await crmPost<ServiceCase>('/customer-service/cases/'+selected.id+'/status',{status:next});setNotice('تم تحديث حالة الخدمة.');await load();await choose(updated);}catch(e){setNotice(message(e));}}
 async function assign(){if(!selected)return;try{const updated=await crmPost<ServiceCase>('/customer-service/cases/'+selected.id+'/assign',{userId:assignee||null});setNotice('تم تحديث مسؤول الحالة.');await choose(updated);await load();}catch(e){setNotice(message(e));}}
 async function addNote(event:FormEvent){event.preventDefault();if(!selected)return;try{await crmPost('/customer-service/cases/'+selected.id+'/notes',{body:note,visibility});setNote('');setNotice('تمت إضافة الملاحظة إلى سجل الحالة.');await choose(selected);}catch(e){setNotice(message(e));}}
 const next:Record<CaseStatus,CaseStatus[]>={OPEN:['IN_PROGRESS','WAITING_CUSTOMER','RESOLVED'],IN_PROGRESS:['WAITING_CUSTOMER','RESOLVED'],WAITING_CUSTOMER:['IN_PROGRESS','RESOLVED'],RESOLVED:['IN_PROGRESS','CLOSED'],CLOSED:[]};
 return <section dir="rtl" className="ui-page-stack" aria-label="خدمة العملاء والشكاوى">
  {notice?<Toast tone="success">{notice}</Toast>:null}{error?<ErrorState message={error}/>:null}
  <Card title="خدمة العملاء والشكاوى"><p>إدارة الشكاوى وطلبات الدعم والطلبات العامة مع مسؤول معالجة وSLA وسجل حالة وملاحظات.</p><FormField label="تصفية بالحالة"><Select value={status} onChange={e=>setStatus(e.target.value)}><option value="">كل الحالات</option>{Object.entries(statusLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></FormField></Card>
  <DisclosureCard title="فتح حالة جديدة" description="اربط الحالة بالعميل القائم حتى تظل بيانات العميل في المالك الأصلي CRM."><form onSubmit={create}>
   <FormField label="العميل" required><Select required value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})}><option value="">اختر العميل</option>{customers.map(c=><option key={c.customer.id} value={c.customer.id}>{c.customer.number} — {c.party.displayName}</option>)}</Select></FormField>
   <FormField label="النوع"><Select value={form.category} onChange={e=>setForm({...form,category:e.target.value as ServiceCase['category']})}>{Object.entries(categoryLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></FormField>
   <FormField label="الأولوية"><Select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as ServiceCase['priority']})}>{Object.entries(priorityLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></FormField>
   <FormField label="الموضوع" required><Input required value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></FormField>
   <FormField label="التفاصيل" required><Textarea required value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></FormField>
   <FormField label="المسؤول — اختياري"><Input value={form.assigneeUserId} onChange={e=>setForm({...form,assigneeUserId:e.target.value})}/></FormField>
   <FormField label="موعد SLA — اختياري"><Input type="datetime-local" value={form.slaDueAt} onChange={e=>setForm({...form,slaDueAt:e.target.value})}/></FormField><Button type="submit">فتح الحالة</Button>
  </form></DisclosureCard>
  <Card title="الحالات">{!cases.length?<EmptyState title="لا توجد حالات خدمة"/>:<DataGrid columns={['الرقم','العميل','النوع','الأولوية','الموضوع','الحالة','SLA','فتح']}>{cases.map(row=><tr key={row.id}><td>{row.number}</td><td>{customers.find(c=>c.customer.id===row.customerId)?.party.displayName??row.customerId}</td><td>{categoryLabel[row.category]}</td><td><Badge tone={row.priority==='CRITICAL'||row.priority==='HIGH'?'warning':'neutral'}>{priorityLabel[row.priority]}</Badge></td><td>{row.subject}</td><td>{statusLabel[row.status]}</td><td>{row.slaDueAt?new Date(row.slaDueAt).toLocaleString('ar-EG'):'—'}</td><td><Button type="button" variant="secondary" onClick={()=>void choose(row)}>إدارة</Button></td></tr>)}</DataGrid>}</Card>
  {selected?<><Card title={'الحالة '+selected.number}><p><strong>{selected.subject}</strong></p><p>{selected.description}</p><ActionBar>{next[selected.status].map(value=><Button key={value} type="button" variant="secondary" onClick={()=>void transition(value)}>{statusLabel[value]}</Button>)}</ActionBar><FormField label="مسؤول الحالة"><Input value={assignee} onChange={e=>setAssignee(e.target.value)}/></FormField><Button type="button" onClick={()=>void assign()}>حفظ المسؤول</Button></Card>
  <DisclosureCard title="إضافة ملاحظة" description="الملاحظات الداخلية لا تظهر كاتصال موجه للعميل."><form onSubmit={addNote}><FormField label="الرؤية"><Select value={visibility} onChange={e=>setVisibility(e.target.value as typeof visibility)}><option value="INTERNAL">داخلية</option><option value="CUSTOMER">للعميل</option></Select></FormField><FormField label="الملاحظة" required><Textarea required value={note} onChange={e=>setNote(e.target.value)}/></FormField><Button type="submit">إضافة الملاحظة</Button></form></DisclosureCard>
  <Card title="الملاحظات">{!notes.length?<EmptyState/>:<DataGrid columns={['الرؤية','الملاحظة','الكاتب','التاريخ']}>{notes.map(n=><tr key={n.id}><td>{n.visibility==='INTERNAL'?'داخلية':'للعميل'}</td><td>{n.body}</td><td>{n.authorId}</td><td>{new Date(n.createdAt).toLocaleString('ar-EG')}</td></tr>)}</DataGrid>}</Card>
  <Card title="السجل">{!history.length?<EmptyState/>:<DataGrid columns={['الحدث','التفاصيل','المنفذ','الوقت']}>{history.map(h=><tr key={h.id}><td>{h.action}</td><td>{h.detail??'—'}</td><td>{h.actorId}</td><td>{new Date(h.occurredAt).toLocaleString('ar-EG')}</td></tr>)}</DataGrid>}</Card></>:null}
 </section>;
}
