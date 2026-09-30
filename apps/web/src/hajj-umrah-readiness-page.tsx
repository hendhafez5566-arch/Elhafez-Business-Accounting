import{useEffect,useMemo,useState}from'react';
import{ActionBar,Badge,Button,Card,ConfirmationDialog,DataGrid,DisclosureCard,EmptyState,ErrorState,LoadingState,MetricCard,Select,SplitWorkspace,Toast}from'./ui.js';
import{hajjUmrahApi,type Program}from'./hajj-umrah-client.js';
import{
 emptyReadinessCapabilities,hajjUmrahReadinessApi,type Booking360,type CloseProgramResult,type ClosureEvaluation,type HajjUmrahReadinessApi,type HajjUmrahReportBundle,
 type Program360,type ReadinessBlocker,type ReadinessCapabilities,type ReadinessResult,type WorkQueueItem,
}from'./hajj-umrah-readiness-client.js';

type WorkspaceTab='readiness'|'program360'|'booking360'|'queue'|'reports'|'closure';
const categoryLabel:Record<string,string>={TRAVELER_DOCUMENT:'وثائق المسافر',ROOMING:'التسكين',VISA:'التأشيرات',TICKETING:'التذاكر',TRANSPORT:'النقل',SERVICE_OPERATION:'التشغيل',FINANCIAL:'مالي',CONTROL:'رقابي',PROGRAM:'البرنامج'};
const lifecycleLabel:Record<string,string>={PRELIMINARY:'مبدئي',CONFIRMED:'مؤكد',READY:'جاهز تشغيليًا',TRAVELING:'مسافر',COMPLETED:'مكتمل',CANCELLED:'ملغي',PREPARING:'تجهيز',BOOKABLE:'مفتوح للحجز',IN_TRIP:'في الرحلة',CLOSED:'مغلق'};
const operationLabel:Record<string,string>={PREPARING:'قيد التجهيز',SUBMITTED:'مقدم',ISSUED:'صادر',REJECTED:'مرفوض',RESERVED:'محجوز',REISSUED:'معاد الإصدار',VOIDED:'ملغى الإصدار',SCHEDULED:'مجدول',DISPATCHED:'تحرك',COMPLETED:'مكتمل',CANCELLED:'ملغي',ASSIGNED:'مسند',UNASSIGNED:'غير مسند',OPEN:'مفتوح',RESOLVED:'محلول'};
const ownerLabel:Record<string,string>={'traveler-management':'بيانات المسافرين','hajj-umrah-rooming':'التسكين','hajj-umrah-visa-operations':'التأشيرات','hajj-umrah-ticketing':'التذاكر والطيران','hajj-umrah-transport-operations':'النقل والتفويج','hajj-umrah-trip-operations':'التشغيل','tourism-finance-orchestration':'المالية','tourism-contract-inventory':'التعاقدات والتوريد','hajj-umrah-programs':'إدارة البرنامج','hajj-umrah-bookings':'الحجوزات'};
const supplyStatusLabel:Record<string,string>={ALLOCATED:'مغطى بتخصيص مؤكد',AVAILABLE:'متاح للتخصيص',BLOCKED:'غير متاح',MISSING_COMPONENT:'المكوّن غير معرف',MISSING_REFERENCE:'مرجع التوريد غير معرف',OWNER_UNAVAILABLE:'تعذر قراءة المصدر'};
const toneForStatus=(value:string)=>value==='READY'||value==='COMPLETED'||value==='CLOSED'||value==='ISSUED'?'success':value==='NOT_READY'||value==='CANCELLED'||value==='REJECTED'?'error':'warning';
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'تعذر تحميل بيانات الجاهزية.';

function Blockers({items}:{readonly items:readonly ReadinessBlocker[]}){
 if(!items.length)return <EmptyState title="لا توجد موانع حالية">كل الأدلة المطلوبة مكتملة وفق الحالة الحالية.</EmptyState>;
 return <DataGrid columns={['النوع','المشكلة','المسؤول','الحجز / المسافر']}>{items.map((item,index)=><tr key={item.code+item.bookingId+item.travelerId+index}><td><Badge tone={item.category==='FINANCIAL'||item.category==='CONTROL'?'warning':'error'}>{categoryLabel[item.category]??item.category}</Badge></td><td>{item.message}</td><td>{item.responsibility}</td><td>{item.bookingId?'حجز مرتبط':'—'}{item.travelerId?' / مسافر مرتبط':''}</td></tr>)}</DataGrid>;
}
function AccountingSummary({value}:{readonly value:unknown}){
 if(!value||typeof value!=='object')return <p>لا توجد بيانات مالية معروضة.</p>;
 const rows=(value as{byCurrency?:readonly {currency:string;revenue:string;cost:string;profit:string}[]}).byCurrency;
 if(!rows?.length)return <p>لا توجد حركة مالية معتمدة للبرنامج ضمن هذا النطاق.</p>;
 return <DataGrid columns={['العملة','الإيراد','التكلفة','الربح']} >{rows.map(row=><tr key={row.currency}><td>{row.currency}</td><td>{row.revenue}</td><td>{row.cost}</td><td>{row.profit}</td></tr>)}</DataGrid>;
}
export function ReadinessWorkspaceView(props:{
 readonly programs:readonly Program[];readonly programId:string;readonly onProgramChange:(id:string)=>void;readonly tab?:WorkspaceTab;readonly onTabChange?:(id:WorkspaceTab)=>void;
 readonly capabilities:ReadinessCapabilities;readonly readiness?:ReadinessResult;readonly program360?:Program360;readonly booking360?:Booking360;readonly queue?:readonly WorkQueueItem[];
 readonly reports?:HajjUmrahReportBundle;readonly closure?:ClosureEvaluation;readonly bookingId:string;readonly onBookingChange:(id:string)=>void;readonly onCloseRequest:()=>void;readonly closing:boolean;
}){
 const selected=props.programs.find(value=>value.id===props.programId);
 const bookings=props.program360?.bookings??[];
 const reportBookingCode=(id:string)=>props.reports?.bookings.find(value=>value.id===id)?.code??'حجز مرتبط';
 const reportTravelerName=(id:string)=>props.reports?.travelers.find(value=>value.traveler.id===id)?.traveler.fullName??'مسافر مرتبط';
 const openTasks=props.program360?.tasks.filter(row=>row.status==='OPEN').length??0;
 const openIncidents=props.program360?.incidents.filter(row=>row.status==='OPEN').length??0;
 return <section dir="rtl" className="ui-dashboard" aria-label="مركز الجاهزية والتشغيل — الحج والعمرة">
  <Card title="مركز الجاهزية والتشغيل — الحج والعمرة">
   <div className="ui-inline"><label>البرنامج<Select aria-label="البرنامج" value={props.programId} onChange={event=>props.onProgramChange(event.target.value)}><option value="">اختر البرنامج</option>{props.programs.map(program=><option key={program.id} value={program.id}>{program.code} — {program.arabicName}</option>)}</Select></label>{selected&&<p>الحالة التشغيلية: <Badge tone={toneForStatus(selected.status)}>{lifecycleLabel[selected.status]??selected.status}</Badge></p>}</div>
  </Card>
  {!props.programId&&<EmptyState title="اختر برنامجًا">سيتم عرض الجاهزية والعمل التشغيلي من المصادر الحقيقية بمجرد اختيار البرنامج.</EmptyState>}
  {props.programId&&<>
   <div className="ui-metric-grid">
    <MetricCard label="حالة الجاهزية" value={props.readiness?.status==='READY'?'جاهز':props.readiness?'غير جاهز':'—'} tone={props.readiness?.status==='READY'?'success':props.readiness?'error':'neutral'}/>
    <MetricCard label="الموانع" value={props.readiness?.blockers.length??0} tone={props.readiness?.blockers.length?'error':'success'}/>
    <MetricCard label="قائمة العمل" value={props.queue?.length??0} tone={props.queue?.length?'warning':'success'}/>
    <MetricCard label="مهام / بلاغات مفتوحة" value={`${openTasks} / ${openIncidents}`} tone={openTasks||openIncidents?'warning':'success'}/>
   </div>
   <SplitWorkspace
    left={<section aria-label="الجاهزية والموانع"><h3>الجاهزية والموانع</h3>{props.capabilities.view?(props.readiness?<><p><Badge tone={props.readiness.status==='READY'?'success':'error'}>{props.readiness.status==='READY'?'جاهز للتشغيل':'غير جاهز للتشغيل'}</Badge></p><Blockers items={props.readiness.blockers}/></>:<LoadingState/>):<EmptyState title="لا توجد صلاحية لعرض الجاهزية"/>}</section>}
    right={<section aria-label="قائمة العمل"><h3>قائمة العمل الحالية</h3>{props.capabilities.view?(props.queue?(props.queue.length?<DataGrid columns={['الأولوية','النوع','العمل المطلوب','المسؤول','الموعد']}>{props.queue.map(item=><tr key={item.key}><td><Badge tone={item.priority==='CRITICAL'?'error':item.priority==='HIGH'?'warning':'info'}>{item.priority==='CRITICAL'?'عاجل':item.priority==='HIGH'?'مرتفع':'عادي'}</Badge></td><td>{categoryLabel[item.category]??item.category}</td><td>{item.title}</td><td>{ownerLabel[item.owner]??item.owner}</td><td>{item.dueAt?new Date(item.dueAt).toLocaleString('ar-EG'):'—'}</td></tr>)}</DataGrid>:<EmptyState title="قائمة العمل خالية">لا توجد أعمال معلقة من المصادر التشغيلية الحالية.</EmptyState>):<LoadingState/>):<EmptyState title="لا توجد صلاحية لعرض قائمة العمل"/>}</section>}
   />
   {props.capabilities.view360?(props.program360?<>
    <div className="ui-metric-grid">
     <MetricCard label="الحجوزات" value={props.program360.bookingSummary.total}/>
     <MetricCard label="التسكين" value={`${props.program360.rooming.filter(row=>row.status==='ASSIGNED').length}/${props.program360.rooming.length}`} />
     <MetricCard label="التأشيرات الصادرة" value={`${props.program360.visas.filter(row=>row.status==='ISSUED').length}/${props.program360.visas.length}`} />
     <MetricCard label="التذاكر الصادرة" value={`${props.program360.tickets.filter(row=>row.status==='ISSUED'||row.status==='REISSUED').length}/${props.program360.tickets.length}`} />
    </div>
    <SplitWorkspace
     left={<section aria-label="الحجوزات والمسافرون"><h3>الحجوزات والمسافرون</h3><DataGrid columns={['الحجز','دورة الحجز','الجاهزية']}>{props.program360.bookings.map(booking=>{const result=props.program360?.readiness.bookingResults[booking.id];return<tr key={booking.id}><td>{booking.code}</td><td><Badge tone={toneForStatus(booking.status)}>{lifecycleLabel[booking.status]??booking.status}</Badge></td><td><Badge tone={result?.status==='READY'?'success':'error'}>{result?.status==='READY'?'جاهز':'غير جاهز'}</Badge></td></tr>})}</DataGrid><h4>المسافرون</h4><DataGrid columns={['الاسم','الجنسية','الجواز','الصلاحية']}>{props.program360.travelers.map(row=><tr key={row.traveler.id}><td>{row.traveler.fullName}</td><td>{row.traveler.nationality??'—'}</td><td>{row.passport?'مسجل':'غير مسجل'}</td><td>{row.passport?.expiryDate??'—'}</td></tr>)}</DataGrid></section>}
     right={<section aria-label="تغطية التوريد والوضع المالي"><h3>تغطية التوريد</h3><DataGrid columns={['المتطلب','المكوّن','الحالة']}>{props.program360.supplyCoverage.map((row,index)=><tr key={row.requirement+row.componentTitle+index}><td>{row.requirement}</td><td>{row.componentTitle}</td><td><Badge tone={row.status==='ALLOCATED'||row.status==='AVAILABLE'?'success':'error'}>{supplyStatusLabel[row.status]??row.status}</Badge>{row.detail?<small className="ui-block">{row.detail}</small>:null}</td></tr>)}</DataGrid><h4>الوضع المالي</h4><AccountingSummary value={props.program360.accounting}/></section>}
    />
    <Card title="مركز الحجز 360°"><label>الحجز<Select aria-label="الحجز" value={props.bookingId} onChange={event=>props.onBookingChange(event.target.value)}><option value="">اختر الحجز</option>{bookings.map(booking=><option key={booking.id} value={booking.id}>{booking.code}</option>)}</Select></label>{props.bookingId?(props.booking360?<>
      <div className="ui-metric-grid"><MetricCard label="دورة الحجز" value={lifecycleLabel[props.booking360.booking.status]??props.booking360.booking.status}/><MetricCard label="الحالة المالية" value={props.booking360.financialReadiness?.ready?'جاهز ماليًا':'غير جاهز ماليًا'} tone={props.booking360.financialReadiness?.ready?'success':'warning'}/><MetricCard label="الجاهزية النهائية" value={props.booking360.readiness.status==='READY'?'جاهز':'غير جاهز'} tone={props.booking360.readiness.status==='READY'?'success':'error'}/></div>
      <SplitWorkspace left={<section><h4>المسافرون والوثائق</h4><DataGrid columns={['المسافر','الجنسية','الجواز','الصلاحية']}>{props.booking360.travelers.map(row=><tr key={row.traveler.id}><td>{row.traveler.fullName}</td><td>{row.traveler.nationality??'—'}</td><td>{row.passport?'مسجل':'غير مسجل'}</td><td>{row.passport?.expiryDate??'—'}</td></tr>)}</DataGrid><h4>التسكين والتأشيرات والتذاكر</h4><DataGrid columns={['المسافر','التسكين','التأشيرة','التذكرة']}>{props.booking360.travelers.map(row=>{const travelerId=row.traveler.id,room=props.booking360?.rooming.find(item=>item.travelerId===travelerId&&item.status==='ASSIGNED'),visa=props.booking360?.visas.find(item=>item.travelerId===travelerId),ticket=props.booking360?.tickets.find(item=>item.travelerId===travelerId);return<tr key={'ops-'+travelerId}><td>{row.traveler.fullName}</td><td>{room?(room.roomLabel??room.roomKey):'غير مكتمل'}</td><td>{visa?operationLabel[visa.status]??visa.status:'غير موجودة'}</td><td>{ticket?operationLabel[ticket.status]??ticket.status:'غير موجودة'}</td></tr>})}</DataGrid></section>} right={<section><h4>موانع الحجز</h4><Blockers items={props.booking360.readiness.blockers}/><h4>النقل والتشغيل</h4><p>تفويجات مرتبطة: {props.booking360.transport.length} — المهام: {props.booking360.tasks.length} — البلاغات: {props.booking360.incidents.length} — الخدمات المنفذة: {props.booking360.services.length}</p></section>}/>
     </>:<LoadingState/>):<EmptyState title="اختر حجزًا من البرنامج"/>}</Card>
   </>:<LoadingState/>):<EmptyState title="لا توجد صلاحية لعرض مركز البرنامج"/>}
   {props.capabilities.reports&&<DisclosureCard title="التقارير التشغيلية والمالية" description="تقارير البرنامج من نفس مصادر الجاهزية والتشغيل؛ لا توجد نسخة بيانات موازية.">{props.reports?<>
    <div className="ui-dashboard-grid">
     <Card title="ملخص الحجوزات"><DataGrid columns={['الحالة','العدد']}>{Object.entries(props.reports.bookingStatus).map(([status,count])=><tr key={status}><td>{lifecycleLabel[status]??status}</td><td>{count}</td></tr>)}</DataGrid></Card>
     <Card title="الملخص المالي المعتمد"><AccountingSummary value={props.reports.financial}/></Card>
    </div>
    <Card title="قائمة التسكين"><DataGrid columns={['الحجز','المسافر','الغرفة','الفترة','الحالة']}>{props.reports.rooming.map(row=><tr key={row.id}><td>{reportBookingCode(row.bookingId)}</td><td>{reportTravelerName(row.travelerId)}</td><td>{row.roomLabel??row.roomKey}</td><td>{row.startDate.slice(0,10)} — {row.endDate.slice(0,10)}</td><td>{row.status==='ASSIGNED'?'مسكن':'غير مسكن'}</td></tr>)}</DataGrid></Card>
    <Card title="التأشيرات والتذاكر"><DataGrid columns={['النوع','الحجز','المسافر','المرجع','الحالة']}>{props.reports.visas.map(row=><tr key={'visa-'+row.id}><td>تأشيرة</td><td>{reportBookingCode(row.bookingId)}</td><td>{reportTravelerName(row.travelerId)}</td><td>{row.visaNumber??'—'}</td><td><Badge tone={toneForStatus(row.status)}>{operationLabel[row.status]??row.status}</Badge></td></tr>)}{props.reports.tickets.map(row=><tr key={'ticket-'+row.id}><td>تذكرة</td><td>{reportBookingCode(row.bookingId)}</td><td>{reportTravelerName(row.travelerId)}</td><td>{row.ticketNumber??row.pnr}</td><td><Badge tone={toneForStatus(row.status)}>{operationLabel[row.status]??row.status}</Badge></td></tr>)}</DataGrid></Card>
    <Card title="النقل والتفويج"><DataGrid columns={['التفويج','المسار','الحالة','عدد المسافرين']}>{props.reports.transport.map(row=><tr key={row.run.id}><td>{row.run.code}</td><td>{row.run.route}</td><td><Badge tone={toneForStatus(row.run.status)}>{operationLabel[row.run.status]??row.run.status}</Badge></td><td>{row.manifest.filter(item=>item.status==='ASSIGNED').length}</td></tr>)}</DataGrid></Card>
    <Card title="المهام والبلاغات"><DataGrid columns={['النوع','الوصف','الحالة / الأولوية','الموعد']}>{props.reports.tasks.map(row=><tr key={'task-'+row.id}><td>مهمة</td><td>{row.title}</td><td>{operationLabel[row.status]??row.status}</td><td>{new Date(row.dueAt).toLocaleString('ar-EG')}</td></tr>)}{props.reports.incidents.map(row=><tr key={'incident-'+row.id}><td>بلاغ</td><td>{row.summary}</td><td>{operationLabel[row.status]??row.status} / {row.severity==='CRITICAL'?'حرج':row.severity==='HIGH'?'مرتفع':row.severity==='MEDIUM'?'متوسط':'منخفض'}</td><td>—</td></tr>)}</DataGrid></Card>
   </>:<LoadingState/>}</DisclosureCard>}
   {props.capabilities.close?<Card title="إغلاق البرنامج بأمان">{props.closure?<><p><Badge tone={props.closure.canClose?'success':'error'}>{props.closure.canClose?'يمكن الإغلاق':'الإغلاق محظور'}</Badge></p><Blockers items={props.closure.blockers}/><ActionBar><Button disabled={!props.closure.canClose||props.closing} loading={props.closing} onClick={props.onCloseRequest}>إغلاق البرنامج بأمان</Button></ActionBar></>:<LoadingState/>}</Card>:null}
  </>}
 </section>;
}

export function HajjUmrahReadinessPage({api=hajjUmrahReadinessApi}:{readonly api?:HajjUmrahReadinessApi}){
 const[programs,setPrograms]=useState<Program[]>([]),[programId,setProgramId]=useState(''),[bookingId,setBookingId]=useState('');
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
 return <>{error&&<Toast tone="error">{error}</Toast>}{notice&&<Toast tone="success">{notice}</Toast>}<ReadinessWorkspaceView programs={programs} programId={programId} onProgramChange={setProgramId} capabilities={capabilities} readiness={readiness} program360={program360} booking360={booking360} queue={queue} reports={reports} closure={closure} bookingId={bookingId} onBookingChange={setBookingId} onCloseRequest={()=>setConfirm(true)} closing={closing}/><ConfirmationDialog open={confirm} onClose={()=>setConfirm(false)} onConfirm={close} title="تأكيد إغلاق البرنامج"><p>سيتم إعادة فحص الأدلة التشغيلية والمالية الحالية قبل تغيير حالة البرنامج. لن يتم الإغلاق إذا ظهر أي مانع.</p><p>{selectedProgram?selectedProgram.code+' — '+selectedProgram.arabicName:''}</p></ConfirmationDialog></>;
}
