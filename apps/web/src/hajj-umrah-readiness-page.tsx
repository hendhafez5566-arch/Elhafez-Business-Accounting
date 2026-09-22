import{useEffect,useMemo,useState}from'react';
import{Badge,Button,Card,ConfirmationDialog,DataGrid,EmptyState,ErrorState,LoadingState,Select,Tabs,Toast}from'./ui.js';
import{hajjUmrahApi,type Program}from'./hajj-umrah-client.js';
import{
 emptyReadinessCapabilities,hajjUmrahReadinessApi,type Booking360,type CloseProgramResult,type ClosureEvaluation,type HajjUmrahReadinessApi,type HajjUmrahReportBundle,
 type Program360,type ReadinessBlocker,type ReadinessCapabilities,type ReadinessResult,type WorkQueueItem,
}from'./hajj-umrah-readiness-client.js';

type WorkspaceTab='readiness'|'program360'|'booking360'|'queue'|'reports'|'closure';
const tabs=[
 {id:'readiness',label:'الجاهزية'},{id:'program360',label:'مركز تشغيل البرنامج'},{id:'booking360',label:'مركز الحجز'},
 {id:'queue',label:'قائمة العمل'},{id:'reports',label:'التقارير'},{id:'closure',label:'إغلاق البرنامج'},
]as const;
const categoryLabel:Record<string,string>={TRAVELER_DOCUMENT:'وثائق المسافر',ROOMING:'التسكين',VISA:'التأشيرات',TICKETING:'التذاكر',TRANSPORT:'النقل',SERVICE_OPERATION:'التشغيل',FINANCIAL:'مالي',CONTROL:'رقابي',PROGRAM:'البرنامج'};
const lifecycleLabel:Record<string,string>={PRELIMINARY:'مبدئي',CONFIRMED:'مؤكد',READY:'جاهز تشغيليًا',TRAVELING:'مسافر',COMPLETED:'مكتمل',CANCELLED:'ملغي',PREPARING:'تجهيز',BOOKABLE:'مفتوح للحجز',IN_TRIP:'في الرحلة',CLOSED:'مغلق'};
const toneForStatus=(value:string)=>value==='READY'||value==='COMPLETED'||value==='CLOSED'||value==='ISSUED'?'success':value==='NOT_READY'||value==='CANCELLED'||value==='REJECTED'?'error':'warning';
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'تعذر تحميل بيانات الجاهزية.';

function Blockers({items}:{readonly items:readonly ReadinessBlocker[]}){
 if(!items.length)return <EmptyState title="لا توجد موانع حالية">كل الأدلة المطلوبة مكتملة وفق الحالة الحالية.</EmptyState>;
 return <DataGrid columns={['النوع','المشكلة','المسؤول','الحجز / المسافر']}>{items.map((item,index)=><tr key={item.code+item.bookingId+item.travelerId+index}><td><Badge tone={item.category==='FINANCIAL'||item.category==='CONTROL'?'warning':'error'}>{categoryLabel[item.category]??item.category}</Badge></td><td>{item.message}<small style={{display:'block'}}>{item.code}</small></td><td>{item.responsibility}</td><td>{item.bookingId?'حجز مرتبط':'—'}{item.travelerId?' / مسافر مرتبط':''}</td></tr>)}</DataGrid>;
}
function ReadinessCard({result,title='حالة الجاهزية'}:{readonly result:ReadinessResult;readonly title?:string}){
 return <Card title={title}><p><Badge tone={result.status==='READY'?'success':'error'}>{result.status==='READY'?'جاهز':'غير جاهز'}</Badge></p><Blockers items={result.blockers}/></Card>;
}
function AccountingSummary({value}:{readonly value:unknown}){
 if(!value||typeof value!=='object')return <p>لا توجد بيانات مالية معروضة.</p>;
 const rows=(value as{byCurrency?:readonly {currency:string;revenue:string;cost:string;profit:string}[]}).byCurrency;
 if(!rows?.length)return <p>لا توجد حركة مالية معتمدة للبرنامج ضمن هذا النطاق.</p>;
 return <DataGrid columns={['العملة','الإيراد','التكلفة','الربح']} >{rows.map(row=><tr key={row.currency}><td>{row.currency}</td><td>{row.revenue}</td><td>{row.cost}</td><td>{row.profit}</td></tr>)}</DataGrid>;
}
export function ReadinessWorkspaceView(props:{
 readonly programs:readonly Program[];readonly programId:string;readonly onProgramChange:(id:string)=>void;readonly tab:WorkspaceTab;readonly onTabChange:(id:WorkspaceTab)=>void;
 readonly capabilities:ReadinessCapabilities;readonly readiness?:ReadinessResult;readonly program360?:Program360;readonly booking360?:Booking360;readonly queue?:readonly WorkQueueItem[];
 readonly reports?:HajjUmrahReportBundle;readonly closure?:ClosureEvaluation;readonly bookingId:string;readonly onBookingChange:(id:string)=>void;readonly onCloseRequest:()=>void;readonly closing:boolean;
}){
 const selected=props.programs.find(value=>value.id===props.programId);
 const bookings=props.program360?.bookings??[];
 const reportBookingCode=(id:string)=>props.reports?.bookings.find(value=>value.id===id)?.code??'حجز مرتبط';
 const reportTravelerName=(id:string)=>props.reports?.travelers.find(value=>value.traveler.id===id)?.traveler.fullName??'مسافر مرتبط';
 return <div dir="rtl">
  <Card title="مركز الجاهزية والتشغيل — الحج والعمرة">
   <label>البرنامج<Select aria-label="البرنامج" value={props.programId} onChange={event=>props.onProgramChange(event.target.value)}><option value="">اختر البرنامج</option>{props.programs.map(program=><option key={program.id} value={program.id}>{program.code} — {program.arabicName}</option>)}</Select></label>
   {selected&&<p>الحالة التشغيلية: <Badge tone={toneForStatus(selected.status)}>{lifecycleLabel[selected.status]??selected.status}</Badge></p>}
  </Card>
  <Tabs tabs={tabs as unknown as readonly {id:string;label:string}[]} active={props.tab} onChange={id=>props.onTabChange(id as WorkspaceTab)}/>
  {!props.programId&&<EmptyState title="اختر برنامجًا">سيتم عرض الجاهزية الحالية من البيانات الحقيقية بمجرد اختيار البرنامج.</EmptyState>}
  {props.programId&&props.tab==='readiness'&&(props.capabilities.view?(props.readiness?<ReadinessCard result={props.readiness}/>:<LoadingState/>):<EmptyState title="لا توجد صلاحية لعرض الجاهزية"/>)}
  {props.programId&&props.tab==='program360'&&(props.capabilities.view360?(props.program360?<div><ReadinessCard result={props.program360.readiness} title="جاهزية البرنامج"/><Card title="ملخص الحجوزات"><p>إجمالي الحجوزات: {props.program360.bookingSummary.total}</p><DataGrid columns={['الحالة','العدد']}>{Object.entries(props.program360.bookingSummary.statusCounts).map(([status,count])=><tr key={status}><td>{lifecycleLabel[status]??status}</td><td>{count}</td></tr>)}</DataGrid></Card><Card title="ملخص التشغيل"><p>المسافرون: {props.program360.travelers.length} — التسكين: {props.program360.rooming.length} — التأشيرات: {props.program360.visas.length} — التذاكر: {props.program360.tickets.length} — تشغيل النقل: {props.program360.transport.length}</p></Card><Card title="الوضع المالي"><AccountingSummary value={props.program360.accounting}/></Card></div>:<LoadingState/>):<EmptyState title="لا توجد صلاحية لعرض مركز البرنامج"/>)}
  {props.programId&&props.tab==='booking360'&&(props.capabilities.view360?<div><Card title="اختيار الحجز"><label>الحجز<Select aria-label="الحجز" value={props.bookingId} onChange={event=>props.onBookingChange(event.target.value)}><option value="">اختر الحجز</option>{bookings.map(booking=><option key={booking.id} value={booking.id}>{booking.code}</option>)}</Select></label></Card>{props.bookingId?(props.booking360?<><Card title="الحالات الثلاث"><p>دورة الحجز: <Badge tone={toneForStatus(props.booking360.booking.status)}>{lifecycleLabel[props.booking360.booking.status]??props.booking360.booking.status}</Badge> — الحالة المالية: <Badge tone={props.booking360.financialReadiness?.ready?'success':'warning'}>{props.booking360.financialReadiness?.ready?'ماليًا جاهز':'ماليًا غير جاهز'}</Badge> — الجاهزية النهائية: <Badge tone={props.booking360.readiness.status==='READY'?'success':'error'}>{props.booking360.readiness.status==='READY'?'جاهز':'غير جاهز'}</Badge></p></Card><ReadinessCard result={props.booking360.readiness} title="موانع الحجز"/><Card title="الأدلة التشغيلية"><p>المسافرون: {props.booking360.travelers.length} — التسكين: {props.booking360.rooming.length} — التأشيرات: {props.booking360.visas.length} — التذاكر: {props.booking360.tickets.length} — مهام مفتوحة/تاريخية: {props.booking360.tasks.length} — البلاغات: {props.booking360.incidents.length}</p></Card></>:<LoadingState/>):<EmptyState title="اختر حجزًا من البرنامج"/>}</div>:<EmptyState title="لا توجد صلاحية لعرض مركز الحجز"/>)}
  {props.programId&&props.tab==='queue'&&(props.capabilities.view?(props.queue?(props.queue.length?<DataGrid columns={['الأولوية','النوع','العمل المطلوب','المسؤول','الموعد']} >{props.queue.map(item=><tr key={item.key}><td><Badge tone={item.priority==='CRITICAL'?'error':item.priority==='HIGH'?'warning':'info'}>{item.priority==='CRITICAL'?'عاجل':item.priority==='HIGH'?'مرتفع':'عادي'}</Badge></td><td>{categoryLabel[item.category]??item.category}</td><td>{item.title}</td><td>{item.owner}</td><td>{item.dueAt?new Date(item.dueAt).toLocaleString('ar-EG'):'—'}</td></tr>)}</DataGrid>:<EmptyState title="قائمة العمل خالية">لا توجد أعمال معلقة من المصادر التشغيلية الحالية.</EmptyState>):<LoadingState/>):<EmptyState title="لا توجد صلاحية لعرض قائمة العمل"/>)}
  {props.programId&&props.tab==='reports'&&(props.capabilities.reports?(props.reports?<div>
   <Card title="ملخص الحجوزات"><DataGrid columns={['الحالة','العدد']}>{Object.entries(props.reports.bookingStatus).map(([status,count])=><tr key={status}><td>{lifecycleLabel[status]??status}</td><td>{count}</td></tr>)}</DataGrid></Card>
   <Card title="المسافرون"><DataGrid columns={['المسافر','الجنسية','الجواز','الصلاحية']}>{props.reports.travelers.map(row=><tr key={row.traveler.id}><td>{row.traveler.fullName}</td><td>{row.traveler.nationality??'—'}</td><td>{row.passport?'مسجل':'غير مسجل'}</td><td>{row.passport?.expiryDate??'—'}</td></tr>)}</DataGrid></Card>
   <Card title="قائمة التسكين"><DataGrid columns={['الحجز','المسافر','الغرفة','الفترة','الحالة']}>{props.reports.rooming.map(row=><tr key={row.id}><td>{reportBookingCode(row.bookingId)}</td><td>{reportTravelerName(row.travelerId)}</td><td>{row.roomLabel??row.roomKey}</td><td>{row.startDate.slice(0,10)} — {row.endDate.slice(0,10)}</td><td>{row.status==='ASSIGNED'?'مسكن':'غير مسكن'}</td></tr>)}</DataGrid></Card>
   <Card title="حالة التأشيرات"><DataGrid columns={['الحجز','المسافر','الحالة']}>{props.reports.visas.map(row=><tr key={row.id}><td>{reportBookingCode(row.bookingId)}</td><td>{reportTravelerName(row.travelerId)}</td><td><Badge tone={toneForStatus(row.status)}>{row.status}</Badge></td></tr>)}</DataGrid></Card>
   <Card title="حالة التذاكر"><DataGrid columns={['الحجز','المسافر','PNR','رقم التذكرة','الحالة']}>{props.reports.tickets.map(row=><tr key={row.id}><td>{reportBookingCode(row.bookingId)}</td><td>{reportTravelerName(row.travelerId)}</td><td>{row.pnr}</td><td>{row.ticketNumber??'—'}</td><td><Badge tone={toneForStatus(row.status)}>{row.status}</Badge></td></tr>)}</DataGrid></Card>
   <Card title="النقل والتفويج"><DataGrid columns={['التفويج','المسار','الحالة','عدد المسافرين']}>{props.reports.transport.map(row=><tr key={row.run.id}><td>{row.run.code}</td><td>{row.run.route}</td><td><Badge tone={toneForStatus(row.run.status)}>{row.run.status}</Badge></td><td>{row.manifest.filter(item=>item.status==='ASSIGNED').length}</td></tr>)}</DataGrid></Card>
   <Card title="المهام والبلاغات"><p>المهام المفتوحة: {props.reports.tasks.filter(row=>row.status==='OPEN').length} — البلاغات المفتوحة: {props.reports.incidents.filter(row=>row.status==='OPEN').length}</p><DataGrid columns={['النوع','الوصف','الحالة / الأولوية','الموعد']}>{props.reports.tasks.map(row=><tr key={'task-'+row.id}><td>مهمة</td><td>{row.title}</td><td>{row.status}</td><td>{new Date(row.dueAt).toLocaleString('ar-EG')}</td></tr>)}{props.reports.incidents.map(row=><tr key={'incident-'+row.id}><td>بلاغ</td><td>{row.summary}</td><td>{row.status} / {row.severity}</td><td>—</td></tr>)}</DataGrid></Card>
   <ReadinessCard result={{status:props.reports.readiness.status,blockers:props.reports.readiness.blockers,evidenceReferences:[]}} title="تقرير الجاهزية والموانع"/>
   <Card title="الملخص المالي المعتمد"><AccountingSummary value={props.reports.financial}/></Card>
  </div>:<LoadingState/>):<EmptyState title="لا توجد صلاحية لعرض التقارير"/>)}
  {props.programId&&props.tab==='closure'&&(props.capabilities.close?(props.closure?<Card title="إغلاق البرنامج"><p><Badge tone={props.closure.canClose?'success':'error'}>{props.closure.canClose?'يمكن الإغلاق':'الإغلاق محظور'}</Badge></p><Blockers items={props.closure.blockers}/><Button disabled={!props.closure.canClose||props.closing} loading={props.closing} onClick={props.onCloseRequest}>إغلاق البرنامج بأمان</Button></Card>:<LoadingState/>):<EmptyState title="لا توجد صلاحية لإغلاق البرنامج"/>)}
 </div>;
}

export function HajjUmrahReadinessPage({api=hajjUmrahReadinessApi}:{readonly api?:HajjUmrahReadinessApi}){
 const[programs,setPrograms]=useState<Program[]>([]),[programId,setProgramId]=useState(''),[bookingId,setBookingId]=useState(''),[tab,setTab]=useState<WorkspaceTab>('readiness');
 const[capabilities,setCapabilities]=useState<ReadinessCapabilities>(emptyReadinessCapabilities),[program360,setProgram360]=useState<Program360>(),[readiness,setReadiness]=useState<ReadinessResult>();
 const[booking360,setBooking360]=useState<Booking360>(),[queue,setQueue]=useState<WorkQueueItem[]>(),[reports,setReports]=useState<HajjUmrahReportBundle>(),[closure,setClosure]=useState<ClosureEvaluation>();
 const[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState(false),[closing,setClosing]=useState(false);
 const selectedProgram=useMemo(()=>programs.find(value=>value.id===programId),[programs,programId]);

 useEffect(()=>{let active=true;(async()=>{try{const[p,c]=await Promise.all([hajjUmrahApi.listPrograms(),api.capabilities()]);if(active){setPrograms(p);setCapabilities(c);setProgramId(p[0]?.id??'')}}catch(e){if(active)setError(errorMessage(e))}finally{if(active)setLoading(false)}})();return()=>{active=false}},[api]);
 useEffect(()=>{if(!programId)return;let active=true;setError('');setNotice('');setBookingId('');setBooking360(undefined);setReadiness(undefined);setProgram360(undefined);setQueue(undefined);setReports(undefined);setClosure(undefined);(async()=>{try{
  const jobs:Promise<unknown>[]=[];
  if(capabilities.view)jobs.push(api.programReadiness(programId).then(value=>active&&setReadiness(value)),api.workQueue(programId).then(value=>active&&setQueue(value)));
  if(capabilities.view360)jobs.push(api.program360(programId).then(value=>active&&setProgram360(value)));
  if(capabilities.reports)jobs.push(api.reports(programId).then(value=>active&&setReports(value)));
  if(capabilities.close||capabilities.view)jobs.push(api.closure(programId).then(value=>active&&setClosure(value)));
  await Promise.all(jobs);
 }catch(e){if(active)setError(errorMessage(e))}})();return()=>{active=false}},[api,programId,capabilities]);
 useEffect(()=>{if(!bookingId||!capabilities.view360)return;let active=true;api.booking360(bookingId).then(value=>active&&setBooking360(value)).catch(e=>active&&setError(errorMessage(e)));return()=>{active=false}},[api,bookingId,capabilities.view360]);

 const close=async()=>{if(!programId)return;setConfirm(false);setClosing(true);setNotice('');setError('');try{const result:CloseProgramResult=await api.closeProgram(programId);if(result.closed){setNotice(result.idempotent?'البرنامج مغلق بالفعل، ولم يتم تكرار أي أثر مالي أو تشغيلي.':'تم إغلاق البرنامج بعد التحقق من كل الموانع الحالية.');const[p,r,z]=await Promise.all([hajjUmrahApi.listPrograms(),api.programReadiness(programId),api.program360(programId)]);setPrograms(p);setReadiness(r);setProgram360(z);setClosure(await api.closure(programId))}else{setClosure({canClose:false,program:result.program,blockers:result.blockers,evidenceReferences:[]});setNotice('لم يتم الإغلاق لأن الأدلة الحالية تحتوي على موانع.')}}catch(e){setError(errorMessage(e))}finally{setClosing(false)}};
 if(loading)return <LoadingState/>;
 if(error&&!programs.length)return <ErrorState message={error}/>;
 return <>{error&&<Toast tone="error">{error}</Toast>}{notice&&<Toast tone="success">{notice}</Toast>}<ReadinessWorkspaceView programs={programs} programId={programId} onProgramChange={setProgramId} tab={tab} onTabChange={setTab} capabilities={capabilities} readiness={readiness} program360={program360} booking360={booking360} queue={queue} reports={reports} closure={closure} bookingId={bookingId} onBookingChange={setBookingId} onCloseRequest={()=>setConfirm(true)} closing={closing}/><ConfirmationDialog open={confirm} onClose={()=>setConfirm(false)} onConfirm={close} title="تأكيد إغلاق البرنامج"><p>سيتم إعادة فحص الأدلة التشغيلية والمالية الحالية قبل تغيير حالة البرنامج. لن يتم الإغلاق إذا ظهر أي مانع.</p><p>{selectedProgram?selectedProgram.code+' — '+selectedProgram.arabicName:''}</p></ConfirmationDialog></>;
}
