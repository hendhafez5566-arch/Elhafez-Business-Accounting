import{type FormEvent,useEffect,useMemo,useState}from'react';
import{tourismOperationsApi,type ItineraryDay,type TourismBooking,type TourismProgram,type TourismProgramInput}from'./tourism-operations-client.js';
import{TourismBookingsWorkspace}from'./tourism-bookings-workspace.js';
import{ActionBar,Badge,Button,Card,DataGrid,Dialog,DisclosureCard,EmptyState,ErrorState,FormField,Input,LoadingState,MetricCard,Select,Textarea,Toast}from'./ui.js';

const programStatus:Record<string,string>={PREPARING:'تحت التجهيز',OPEN:'مفتوح للبيع',OPERATING:'قيد التشغيل',CLOSED:'مغلق',CANCELLED:'ملغي'};
const blankProgram:TourismProgramInput={code:'',nameAr:'',departureDate:'',returnDate:'',salesOpen:'',salesClose:'',currency:'EGP',notes:''};
const blankItinerary={dayNumber:'1',serviceDate:'',title:'',description:'',location:''};
const today=()=>new Date().toISOString().slice(0,10);

type TourismSurface='programs'|'bookings'|'itinerary';
const surfaceMeta:Record<TourismSurface,{title:string;reference:string;description:string}>={
 programs:{title:'البرامج السياحية',reference:'Master Module Template',description:'إدارة دورة البرنامج من التجهيز وفتح البيع حتى التشغيل والإغلاق.'},
 bookings:{title:'الحجوزات السياحية',reference:'Tourism Bookings',description:'إدارة الحجوزات وربطها بالبرنامج والعميل والمسافرين والمخزون والتمويل المعتمد.'},
 itinerary:{title:'البرنامج اليومي',reference:'Tourism Itinerary Builder',description:'بناء أيام الرحلة والأنشطة والمسار الزمني لكل برنامج سياحي.'},
};

export function TourismOperationsPage({initialTab='programs'}:{initialTab?:TourismSurface}={}){
 const[programs,setPrograms]=useState<TourismProgram[]>([]),[bookings,setBookings]=useState<TourismBooking[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function reload(){setLoading(true);setError('');try{const[p,b]=await Promise.all([tourismOperationsApi.programs(),tourismOperationsApi.bookings()]);setPrograms(p);setBookings(b);}catch(value){setError(value instanceof Error?value.message:'تعذر تحميل السياحة العامة.');}finally{setLoading(false);}}
 useEffect(()=>{void reload();},[]);
 if(loading)return <LoadingState/>;if(error)return <ErrorState message={error}/>;
 const meta=surfaceMeta[initialTab];
 return <section dir="rtl" className="ui-dashboard" aria-label={meta.title} data-tourism-surface={initialTab}>
  {notice?<Toast tone="success">{notice}</Toast>:null}
  <Card title={meta.title}><div className="ui-inline"><Badge tone="info">{meta.reference}</Badge></div><p>{meta.description}</p><ActionBar><Button variant="secondary" onClick={()=>void reload()}>تحديث البيانات</Button></ActionBar></Card>
  <div className="ui-metric-grid" aria-label="مؤشرات السياحة العامة"><MetricCard label="إجمالي البرامج" value={programs.length}/><MetricCard label="مفتوح للبيع" value={programs.filter(p=>p.status==='OPEN').length} tone="success"/><MetricCard label="إجمالي الحجوزات" value={bookings.length}/><MetricCard label="حجوزات مؤكدة" value={bookings.filter(b=>b.status==='CONFIRMED').length} tone="success"/></div>
  {initialTab==='programs'?<Programs programs={programs} done={async m=>{setNotice(m);await reload();}}/>:null}
  {initialTab==='bookings'?<TourismBookingsWorkspace programs={programs} bookings={bookings} done={async m=>{setNotice(m);await reload();}}/>:null}
  {initialTab==='itinerary'?<Itinerary programs={programs} done={setNotice}/>:null}
 </section>;
}

function ProgramFields({form,setForm}:{form:TourismProgramInput;setForm:(value:TourismProgramInput)=>void}){
 return <>
  <FormField label="الكود" required><Input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></FormField>
  <FormField label="اسم البرنامج" required><Input required value={form.nameAr} onChange={e=>setForm({...form,nameAr:e.target.value})}/></FormField>
  <FormField label="الاسم بالإنجليزية"><Input value={form.nameEn??''} onChange={e=>setForm({...form,nameEn:e.target.value})}/></FormField>
  <FormField label="تاريخ السفر" required><Input required type="date" value={form.departureDate} onChange={e=>setForm({...form,departureDate:e.target.value})}/></FormField>
  <FormField label="تاريخ العودة" required><Input required type="date" value={form.returnDate} onChange={e=>setForm({...form,returnDate:e.target.value})}/></FormField>
  <FormField label="فتح البيع" required><Input required type="date" value={form.salesOpen} onChange={e=>setForm({...form,salesOpen:e.target.value})}/></FormField>
  <FormField label="إغلاق البيع" required><Input required type="date" value={form.salesClose} onChange={e=>setForm({...form,salesClose:e.target.value})}/></FormField>
  <FormField label="العملة" required><Input required value={form.currency} onChange={e=>setForm({...form,currency:e.target.value.toUpperCase()})}/></FormField>
  <FormField label="ملاحظات"><Textarea value={form.notes??''} onChange={e=>setForm({...form,notes:e.target.value})}/></FormField>
 </>;
}

function Programs({programs,done}:{programs:TourismProgram[];done:(message:string)=>Promise<void>}){
 const[form,setForm]=useState<TourismProgramInput>(blankProgram),[query,setQuery]=useState(''),[status,setStatus]=useState('ACTIVE');
 const[editing,setEditing]=useState<TourismProgram|null>(null),[editForm,setEditForm]=useState<TourismProgramInput>(blankProgram),[cancelling,setCancelling]=useState<TourismProgram|null>(null),[cancelReason,setCancelReason]=useState('');
 const filtered=useMemo(()=>programs.filter(program=>{const q=query.trim().toLowerCase(),matchesQuery=!q||`${program.code} ${program.nameAr} ${program.nameEn??''}`.toLowerCase().includes(q);const matchesStatus=status==='ALL'||(status==='ACTIVE'&&!['CLOSED','CANCELLED'].includes(program.status))||program.status===status;return matchesQuery&&matchesStatus;}).sort((a,b)=>a.departureDate.localeCompare(b.departureDate)),[programs,query,status]);
 async function submit(e:FormEvent){e.preventDefault();await tourismOperationsApi.createProgram(form);setForm(blankProgram);await done('تم إنشاء البرنامج السياحي تحت التجهيز.');}
 async function action(id:string,kind:'open'|'start'|'close'){if(kind==='open')await tourismOperationsApi.openProgram(id);else if(kind==='start')await tourismOperationsApi.startProgram(id);else await tourismOperationsApi.closeProgram(id);await done('تم تحديث دورة البرنامج.');}
 function beginEdit(program:TourismProgram){setEditing(program);setEditForm({code:program.code,nameAr:program.nameAr,nameEn:program.nameEn,departureDate:program.departureDate,returnDate:program.returnDate,salesOpen:program.salesOpen,salesClose:program.salesClose,currency:program.currency,notes:program.notes});}
 async function saveEdit(e:FormEvent){e.preventDefault();if(!editing)return;await tourismOperationsApi.updateProgram(editing.id,editForm);setEditing(null);await done('تم تعديل البرنامج قبل فتحه للبيع.');}
 async function cancelProgram(e:FormEvent){e.preventDefault();if(!cancelling||!cancelReason.trim())return;const postingDate=today();await tourismOperationsApi.cancelProgram(cancelling.id,{reason:cancelReason.trim(),commandKey:`tourism-program-cancel:${cancelling.id}:${postingDate}`,postingDate});setCancelling(null);setCancelReason('');await done('تم إلغاء البرنامج بعد اجتياز فحص التسوية المالية.');}
 return <section className="ui-flow" aria-label="إدارة البرامج السياحية">
  <section className="ui-dashboard-grid" aria-label="إنشاء وتصفية البرامج">
   <DisclosureCard title="برنامج سياحي جديد" description="افتح النموذج عند إنشاء برنامج جديد؛ قائمة البرامج هي مساحة المتابعة."><form className="ui-filter-grid" onSubmit={submit}><ProgramFields form={form} setForm={setForm}/><Button type="submit">إنشاء البرنامج</Button></form></DisclosureCard>
   <Card title="بحث وتصفية البرامج"><div className="ui-filter-grid"><FormField label="بحث"><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="الكود أو اسم البرنامج"/></FormField><FormField label="الحالة"><Select value={status} onChange={e=>setStatus(e.target.value)}><option value="ACTIVE">الحالية</option><option value="ALL">الكل</option><option value="PREPARING">تحت التجهيز</option><option value="OPEN">مفتوح للبيع</option><option value="OPERATING">قيد التشغيل</option><option value="CLOSED">مغلق</option><option value="CANCELLED">ملغي</option></Select></FormField></div><p className="ui-results-count">البرامج المعروضة: {filtered.length} من {programs.length}</p></Card>
  </section>
  <Card title="قائمة البرامج">{filtered.length?<DataGrid columns={['الكود','البرنامج','السفر','العودة','فترة البيع','الحالة','الإجراء']}>{filtered.map(p=><tr key={p.id}><td>{p.code}</td><td><strong>{p.nameAr}</strong>{p.nameEn?<small className="ui-block">{p.nameEn}</small>:null}</td><td>{p.departureDate}</td><td>{p.returnDate}</td><td>{p.salesOpen} → {p.salesClose}</td><td><Badge tone={p.status==='OPEN'?'success':p.status==='CANCELLED'?'error':p.status==='OPERATING'?'warning':'neutral'}>{programStatus[p.status]??p.status}</Badge></td><td><ActionBar>{p.status==='PREPARING'?<Button variant="secondary" onClick={()=>beginEdit(p)}>تعديل</Button>:null}{p.status==='PREPARING'?<Button onClick={()=>void action(p.id,'open')}>فتح للبيع</Button>:null}{p.status==='OPEN'?<Button onClick={()=>void action(p.id,'start')}>بدء التشغيل</Button>:null}{['OPEN','OPERATING'].includes(p.status)?<Button variant="secondary" onClick={()=>void action(p.id,'close')}>إغلاق</Button>:null}{['PREPARING','OPEN'].includes(p.status)?<Button variant="danger" onClick={()=>{setCancelling(p);setCancelReason('');}}>إلغاء البرنامج</Button>:null}</ActionBar></td></tr>)}</DataGrid>:<EmptyState title="لا توجد برامج ضمن الفلتر"/>}</Card>
  <Dialog open={Boolean(editing)} title="تعديل البرنامج" onClose={()=>setEditing(null)}><form className="ui-filter-grid" onSubmit={saveEdit}><ProgramFields form={editForm} setForm={setEditForm}/><ActionBar><Button type="submit">حفظ التعديل</Button><Button type="button" variant="secondary" onClick={()=>setEditing(null)}>إغلاق</Button></ActionBar></form></Dialog>
  <Dialog open={Boolean(cancelling)} title="إلغاء البرنامج" onClose={()=>setCancelling(null)}><form onSubmit={cancelProgram}><p>الإلغاء يمر عبر فحص المالية؛ لن يتم إلغاء برنامج عليه مانع تسوية.</p><FormField label="سبب الإلغاء" required><Textarea required value={cancelReason} onChange={e=>setCancelReason(e.target.value)}/></FormField><Button type="submit" variant="danger" disabled={!cancelReason.trim()}>تأكيد الإلغاء</Button></form></Dialog>
 </section>;
}

function Itinerary({programs,done}:{programs:TourismProgram[];done:(message:string)=>void}){
 const[programId,setProgramId]=useState(''),[days,setDays]=useState<ItineraryDay[]>([]),[form,setForm]=useState(blankItinerary),[error,setError]=useState(''),[editing,setEditing]=useState<ItineraryDay|null>(null),[editForm,setEditForm]=useState(blankItinerary);
 async function load(id:string){setProgramId(id);setError('');if(!id){setDays([]);return}try{setDays(await tourismOperationsApi.itinerary(id));}catch(value){setError(value instanceof Error?value.message:'تعذر تحميل البرنامج اليومي.');}}
 async function submit(e:FormEvent){e.preventDefault();if(!programId)return;try{await tourismOperationsApi.createItinerary(programId,{dayNumber:Number(form.dayNumber),serviceDate:form.serviceDate,title:form.title,description:form.description,location:form.location});setForm(blankItinerary);await load(programId);done('تمت إضافة اليوم إلى البرنامج.');}catch(value){setError(value instanceof Error?value.message:'تعذر الحفظ.');}}
 function beginEdit(day:ItineraryDay){setEditing(day);setEditForm({dayNumber:String(day.dayNumber),serviceDate:day.serviceDate,title:day.title,description:day.description??'',location:day.location??''});}
 async function saveEdit(e:FormEvent){e.preventDefault();if(!programId||!editing)return;try{await tourismOperationsApi.updateItinerary(programId,editing.id,{dayNumber:Number(editForm.dayNumber),serviceDate:editForm.serviceDate,title:editForm.title,description:editForm.description,location:editForm.location,expectedRevision:editing.revision});setEditing(null);await load(programId);done('تم تعديل يوم البرنامج.');}catch(value){setError(value instanceof Error?value.message:'تعذر تعديل اليوم.');}}
 const selected=programs.find(p=>p.id===programId);
 return <section className="ui-dashboard-grid" aria-label="البرنامج اليومي">
  <Card title="إعداد البرنامج اليومي"><FormField label="البرنامج"><Select value={programId} onChange={e=>void load(e.target.value)}><option value="">اختر البرنامج</option>{programs.map(p=><option key={p.id} value={p.id}>{p.code} — {p.nameAr}</option>)}</Select></FormField>{selected?.status==='PREPARING'?<form className="ui-filter-grid" onSubmit={submit}><FormField label="رقم اليوم"><Input required type="number" min="1" value={form.dayNumber} onChange={e=>setForm({...form,dayNumber:e.target.value})}/></FormField><FormField label="التاريخ"><Input required type="date" value={form.serviceDate} onChange={e=>setForm({...form,serviceDate:e.target.value})}/></FormField><FormField label="العنوان"><Input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></FormField><FormField label="المكان"><Input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></FormField><FormField label="التفاصيل"><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></FormField><Button type="submit">إضافة اليوم</Button></form>:selected?<p>يصبح البرنامج اليومي للقراءة فقط بعد فتح البرنامج للبيع.</p>:<p>اختر برنامجًا لعرض أو إعداد أيام الرحلة.</p>}</Card>
  <Card title="أيام البرنامج">{error?<ErrorState message={error}/>:!programId?<EmptyState title="اختر برنامجًا"/>:days.length===0?<EmptyState title="لا يوجد برنامج يومي بعد"/>:<DataGrid columns={['اليوم','التاريخ','العنوان','المكان','إجراء']}>{days.map(d=><tr key={d.id}><td>{d.dayNumber}</td><td>{d.serviceDate}</td><td><strong>{d.title}</strong></td><td>{d.location??'—'}</td><td>{selected?.status==='PREPARING'?<Button variant="secondary" onClick={()=>beginEdit(d)}>تعديل</Button>:null}</td></tr>)}</DataGrid>}</Card>
  <Dialog open={Boolean(editing)} title="تعديل يوم البرنامج" onClose={()=>setEditing(null)}><form className="ui-filter-grid" onSubmit={saveEdit}><FormField label="رقم اليوم"><Input required type="number" min="1" value={editForm.dayNumber} onChange={e=>setEditForm({...editForm,dayNumber:e.target.value})}/></FormField><FormField label="التاريخ"><Input required type="date" value={editForm.serviceDate} onChange={e=>setEditForm({...editForm,serviceDate:e.target.value})}/></FormField><FormField label="العنوان"><Input required value={editForm.title} onChange={e=>setEditForm({...editForm,title:e.target.value})}/></FormField><FormField label="المكان"><Input value={editForm.location} onChange={e=>setEditForm({...editForm,location:e.target.value})}/></FormField><FormField label="التفاصيل"><Textarea value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})}/></FormField><ActionBar><Button type="submit">حفظ</Button><Button type="button" variant="secondary" onClick={()=>setEditing(null)}>إغلاق</Button></ActionBar></form></Dialog>
 </section>;
}
