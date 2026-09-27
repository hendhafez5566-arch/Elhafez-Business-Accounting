import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  Badge,Button,Card,DataGrid,Dialog,EmptyState,ErrorState,FormField,Input,LoadingState,Select,Textarea,Toast,
} from './ui.js';
import {
  emptyOperationsCapabilities,hajjUmrahOperationsApi,
  type AssignRoomInput,type Booking,type BookingFinancialState,type BookingInventoryRequest,type BookingStatus,
  type ConfirmBookingInput,type HajjUmrahOperationsApi,type OperationsCapabilities,type RoomAssignment,type VisaCase,type VisaStatus,
} from './hajj-umrah-operations-client.js';

const errorMessage=(error:unknown)=>error instanceof Error?error.message:'تعذر تنفيذ العملية.';
export const bookingLifecycleLabels:Record<BookingStatus,string>={PRELIMINARY:'مبدئي',CONFIRMED:'مؤكد',READY:'جاهز',TRAVELING:'مسافر',COMPLETED:'مكتمل',CANCELLED:'ملغي'};
export const bookingFinancialLabels:Record<BookingFinancialState,string>={UNCONFIRMED:'غير مؤكد ماليًا',CONFIRMED:'مؤكد ماليًا',CANCELLATION_BLOCKED:'إلغاء مالي معلق',CANCELLED:'ملغي ماليًا'};
const visaLabels:Record<VisaStatus,string>={PREPARING:'تحت التجهيز',SUBMITTED:'مقدم',ISSUED:'صادر',REJECTED:'مرفوض',CANCELLED:'ملغي'};
const bookingTone=(s:BookingStatus)=>s==='CANCELLED'?'error' as const:s==='COMPLETED'?'neutral' as const:s==='READY'||s==='TRAVELING'?'info' as const:s==='CONFIRMED'?'success' as const:'warning' as const;
const financialTone=(s:BookingFinancialState)=>s==='CANCELLATION_BLOCKED'?'warning' as const:s==='CANCELLED'?'error' as const:s==='CONFIRMED'?'success' as const:'neutral' as const;
const visaTone=(s:VisaStatus)=>s==='ISSUED'?'success' as const:s==='REJECTED'||s==='CANCELLED'?'error' as const:s==='SUBMITTED'?'info' as const:'warning' as const;
const csv=(value:string)=>value.split(',').map(v=>v.trim()).filter(Boolean);

export async function loadBookings(api:HajjUmrahOperationsApi){return api.listBookings();}
export async function createBookingAndReload(api:HajjUmrahOperationsApi,input:Parameters<HajjUmrahOperationsApi['createBooking']>[0]){await api.createBooking(input);return api.listBookings();}
export async function loadRooming(api:HajjUmrahOperationsApi){return api.listRooming();}
export async function loadVisas(api:HajjUmrahOperationsApi){return api.listVisas();}

export function makeOperationCommandKey(operation:string,entityId:string,qualifier:string=''){return ['hu02',operation,entityId,qualifier].map(value=>encodeURIComponent(value)).join(':');}
type InventoryRowForm={allocationId:string;contractId:string;resourceType:string;resourceId:string;serviceDate:string;periodEnd:string;quantity:string;flightSegmentSourceType:string;flightSegmentSourceId:string;visaBatchSourceType:string;visaBatchSourceId:string;};
const emptyInventoryRow=():InventoryRowForm=>({allocationId:'',contractId:'',resourceType:'HOTEL',resourceId:'',serviceDate:'',periodEnd:'',quantity:'1',flightSegmentSourceType:'',flightSegmentSourceId:'',visaBatchSourceType:'',visaBatchSourceId:''});
function inventoryRequest(row:InventoryRowForm):BookingInventoryRequest{return{allocationId:row.allocationId,contractId:row.contractId,resourceType:row.resourceType,resourceId:row.resourceId,serviceDate:row.serviceDate,quantity:row.quantity,...(row.periodEnd?{periodEnd:row.periodEnd}:{}),...(row.flightSegmentSourceType&&row.flightSegmentSourceId?{flightSegmentReference:{sourceType:row.flightSegmentSourceType,sourceId:row.flightSegmentSourceId}}:{}),...(row.visaBatchSourceType&&row.visaBatchSourceId?{visaBatchReference:{sourceType:row.visaBatchSourceType,sourceId:row.visaBatchSourceId}}:{})};}

export function BookingLifecycleState({booking}:{readonly booking:Booking}){return <span data-state-kind="booking-lifecycle"><Badge tone={bookingTone(booking.status)}>{bookingLifecycleLabels[booking.status]}</Badge></span>;}
export function BookingFinancialStateView({booking}:{readonly booking:Booking}){return <span data-state-kind="booking-financial"><Badge tone={financialTone(booking.financialState)}>{bookingFinancialLabels[booking.financialState]}</Badge></span>;}
export function BookingStatusPair({booking}:{readonly booking:Booking}){return <><BookingLifecycleState booking={booking}/><BookingFinancialStateView booking={booking}/></>;}

export function OperationsFailure({message}:{readonly message:string}){return <ErrorState message={message}/>;}

export function PermissionState({allowed,children}:{readonly allowed:boolean;readonly children:ReactNode}){
  return allowed?<>{children}</>:<EmptyState title="لا توجد صلاحية لهذا الجزء"><p>الصلاحية تُحسم من الخادم وفق الشركة والفرع والمستخدم الحالي.</p></EmptyState>;
}

export function BookingsPage({api=hajjUmrahOperationsApi}:{readonly api?:HajjUmrahOperationsApi}={}){
  const [rows,setRows]=useState<Booking[]>([]),[cap,setCap]=useState<OperationsCapabilities>(emptyOperationsCapabilities);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [form,setForm]=useState({code:'',programId:'',customerId:'',agentId:'',travelerIds:''});
  const [confirmId,setConfirmId]=useState<string|null>(null),[cancelId,setCancelId]=useState<string|null>(null);
  const [confirm,setConfirm]=useState({category:'OTHER' as ConfirmBookingInput['category'],costCenterId:'',currency:'SAR',grossAmount:'0',discountAmount:'0',postingDate:'',dueDate:'',invoiceNumber:'',commissionAmount:''});
  const [inventories,setInventories]=useState<InventoryRowForm[]>([emptyInventoryRow()]);
  const [cancel,setCancel]=useState({postingDate:'',reason:''});
  async function reload(){setLoading(true);try{const [data,capabilities]=await Promise.all([api.listBookings(),api.capabilities()]);setRows(data);setCap(capabilities);setError('')}catch(value){setError(errorMessage(value))}finally{setLoading(false)}}
  useEffect(()=>{void reload()},[api]);
  async function create(event:FormEvent){event.preventDefault();try{await api.createBooking({code:form.code,programId:form.programId,customerId:form.customerId,...(form.agentId.trim()?{agentId:form.agentId.trim()}:{}),travelerIds:csv(form.travelerIds)});setForm({code:'',programId:'',customerId:'',agentId:'',travelerIds:''});setNotice('تم إنشاء الحجز المبدئي على الخادم.');await reload()}catch(value){setNotice(errorMessage(value))}}
  function openConfirm(row:Booking){setConfirmId(row.id);setConfirm(value=>({...value,invoiceNumber:`HU-${row.code}`}));setInventories([emptyInventoryRow()]);}
  function updateInventory(index:number,patch:Partial<InventoryRowForm>){setInventories(values=>values.map((value,i)=>i===index?{...value,...patch}:value));}
  async function confirmBooking(event:FormEvent){event.preventDefault();if(!confirmId)return;try{const requests=inventories.map(inventoryRequest);await api.confirmBooking(confirmId,{commandKey:makeOperationCommandKey('booking-confirm',confirmId,confirm.invoiceNumber),category:confirm.category,costCenterId:confirm.costCenterId,currency:confirm.currency,grossAmount:confirm.grossAmount,discountAmount:confirm.discountAmount,postingDate:confirm.postingDate,dueDate:confirm.dueDate,invoiceNumber:confirm.invoiceNumber,inventories:requests,...(confirm.commissionAmount.trim()?{commissionAmount:confirm.commissionAmount.trim()}: {})});setConfirmId(null);setNotice('تم تأكيد الحجز عبر مسار التمويل والمخزون المعتمد.');await reload()}catch(value){setNotice(errorMessage(value))}}
  function openCancel(row:Booking){setCancelId(row.id);setCancel({postingDate:'',reason:''});}
  async function cancelBooking(event:FormEvent){event.preventDefault();if(!cancelId)return;try{const result=await api.cancelBooking(cancelId,{...cancel,commandKey:makeOperationCommandKey('booking-cancel',cancelId,cancel.postingDate)});setCancelId(null);setNotice(result.status==='CANCELLED'?'تم إلغاء الحجز.':'لم يُلغ الحجز؛ يوجد مانع مالي ظاهر في الحالة المالية.');await reload()}catch(value){setNotice(errorMessage(value))}}
  async function lifecycle(row:Booking,action:'ready'|'travel'|'complete'){try{if(action==='ready')await api.markReady(row.id);else if(action==='travel')await api.startTravel(row.id);else await api.completeBooking(row.id);setNotice('تم تحديث دورة الحجز.');await reload()}catch(value){setNotice(errorMessage(value))}}
  return <section aria-label="الحجوزات">
    <PermissionState allowed={cap.bookingView||loading}>
      {cap.bookingManage&&<Card title="حجز جديد"><form onSubmit={create}>
        <FormField label="كود الحجز" required><Input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></FormField>
        <FormField label="معرّف البرنامج" required><Input required value={form.programId} onChange={e=>setForm({...form,programId:e.target.value})}/></FormField>
        <FormField label="معرّف العميل" required><Input required value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})}/></FormField>
        <FormField label="معرّف الوكيل"><Input value={form.agentId} onChange={e=>setForm({...form,agentId:e.target.value})}/></FormField>
        <FormField label="معرّفات المسافرين" required><Input required placeholder="traveler-1, traveler-2" value={form.travelerIds} onChange={e=>setForm({...form,travelerIds:e.target.value})}/></FormField>
        <Button type="submit">إنشاء حجز مبدئي</Button>
      </form></Card>}
      <Card title="الحجوزات التشغيلية">{loading?<LoadingState/>:error?<OperationsFailure message={error}/>:!rows.length?<EmptyState title="لا توجد حجوزات"/>:<DataGrid columns={['الكود','البرنامج','المسافرون','حالة الحجز','الحالة المالية','إجراءات']}>{rows.map(row=><tr key={row.id}><td>{row.code}</td><td>{row.programId}</td><td>{row.travelerIds.length}</td><td><BookingLifecycleState booking={row}/></td><td><BookingFinancialStateView booking={row}/></td><td>{cap.bookingConfirm&&row.status==='PRELIMINARY'&&<Button type="button" onClick={()=>openConfirm(row)}>تأكيد</Button>}{cap.bookingLifecycle&&row.status==='CONFIRMED'&&<Button type="button" onClick={()=>void lifecycle(row,'ready')}>تعيين جاهز</Button>}{cap.bookingLifecycle&&row.status==='READY'&&<Button type="button" onClick={()=>void lifecycle(row,'travel')}>بدء السفر</Button>}{cap.bookingLifecycle&&row.status==='TRAVELING'&&<Button type="button" onClick={()=>void lifecycle(row,'complete')}>إكمال</Button>}{cap.bookingCancel&&!['CANCELLED','COMPLETED'].includes(row.status)&&<Button type="button" onClick={()=>openCancel(row)}>إلغاء</Button>}</td></tr>)}</DataGrid>}</Card>
    </PermissionState>
    {notice&&<Toast tone={notice.includes('تعذر')?'error':'info'}>{notice}</Toast>}
    <Dialog open={Boolean(confirmId)} title="تأكيد الحجز" onClose={()=>setConfirmId(null)}><form onSubmit={confirmBooking}>
      <FormField label="الفئة المالية"><Select value={confirm.category} onChange={e=>setConfirm({...confirm,category:e.target.value as ConfirmBookingInput['category']})}><option value="OTHER">أخرى</option><option value="HOTEL">فندق</option><option value="FLIGHT">طيران</option><option value="TRANSPORT">نقل</option><option value="VISA">تأشيرة</option></Select></FormField>
      <FormField label="مركز التكلفة" required><Input required value={confirm.costCenterId} onChange={e=>setConfirm({...confirm,costCenterId:e.target.value})}/></FormField>
      <FormField label="العملة" required><Input required value={confirm.currency} onChange={e=>setConfirm({...confirm,currency:e.target.value.toUpperCase()})}/></FormField>
      <FormField label="الإجمالي" required><Input required inputMode="decimal" value={confirm.grossAmount} onChange={e=>setConfirm({...confirm,grossAmount:e.target.value})}/></FormField>
      <FormField label="الخصم" required><Input required inputMode="decimal" value={confirm.discountAmount} onChange={e=>setConfirm({...confirm,discountAmount:e.target.value})}/></FormField>
      <FormField label="تاريخ القيد" required><Input required type="date" value={confirm.postingDate} onChange={e=>setConfirm({...confirm,postingDate:e.target.value})}/></FormField>
      <FormField label="تاريخ الاستحقاق" required><Input required type="date" value={confirm.dueDate} onChange={e=>setConfirm({...confirm,dueDate:e.target.value})}/></FormField>
      <FormField label="رقم الفاتورة" required><Input required value={confirm.invoiceNumber} onChange={e=>setConfirm({...confirm,invoiceNumber:e.target.value})}/></FormField>
      <Card title="طلبات المخزون والتخصيص">{inventories.map((row,index)=><section key={index} aria-label={`طلب مخزون ${index+1}`}>
        <FormField label="معرّف التخصيص" required><Input required value={row.allocationId} onChange={e=>updateInventory(index,{allocationId:e.target.value})}/></FormField>
        <FormField label="العقد" required><Input required value={row.contractId} onChange={e=>updateInventory(index,{contractId:e.target.value})}/></FormField>
        <FormField label="نوع المورد"><Select value={row.resourceType} onChange={e=>updateInventory(index,{resourceType:e.target.value})}><option value="HOTEL">فندق</option><option value="FLIGHT_BLOCK">طيران</option><option value="TRANSPORT">نقل</option><option value="VISA">تأشيرة</option><option value="SERVICE">خدمة</option></Select></FormField>
        <FormField label="المورد" required><Input required value={row.resourceId} onChange={e=>updateInventory(index,{resourceId:e.target.value})}/></FormField>
        <FormField label="تاريخ الخدمة" required><Input required type="date" value={row.serviceDate} onChange={e=>updateInventory(index,{serviceDate:e.target.value})}/></FormField>
        <FormField label="نهاية الفترة"><Input type="date" value={row.periodEnd} onChange={e=>updateInventory(index,{periodEnd:e.target.value})}/></FormField>
        <FormField label="الكمية" required><Input required inputMode="decimal" value={row.quantity} onChange={e=>updateInventory(index,{quantity:e.target.value})}/></FormField>
        {row.resourceType==='FLIGHT_BLOCK'&&<><FormField label="نوع مرجع قطاع الطيران" required><Input required value={row.flightSegmentSourceType} onChange={e=>updateInventory(index,{flightSegmentSourceType:e.target.value})}/></FormField><FormField label="مرجع قطاع الطيران" required><Input required value={row.flightSegmentSourceId} onChange={e=>updateInventory(index,{flightSegmentSourceId:e.target.value})}/></FormField></>}
        {row.resourceType==='VISA'&&<><FormField label="نوع مرجع دفعة التأشيرات" required><Input required value={row.visaBatchSourceType} onChange={e=>updateInventory(index,{visaBatchSourceType:e.target.value})}/></FormField><FormField label="مرجع دفعة التأشيرات" required><Input required value={row.visaBatchSourceId} onChange={e=>updateInventory(index,{visaBatchSourceId:e.target.value})}/></FormField></>}
        {inventories.length>1&&<Button type="button" onClick={()=>setInventories(values=>values.filter((_,i)=>i!==index))}>حذف الطلب</Button>}
      </section>)}<Button type="button" onClick={()=>setInventories(values=>[...values,emptyInventoryRow()])}>إضافة طلب مخزون</Button></Card>
      <FormField label="عمولة الوكيل"><Input inputMode="decimal" value={confirm.commissionAmount} onChange={e=>setConfirm({...confirm,commissionAmount:e.target.value})}/></FormField>
      <Button type="submit">تنفيذ التأكيد</Button>
    </form></Dialog>
    <Dialog open={Boolean(cancelId)} title="إلغاء الحجز" onClose={()=>setCancelId(null)}><form onSubmit={cancelBooking}>
      <FormField label="تاريخ القيد" required><Input required type="date" value={cancel.postingDate} onChange={e=>setCancel({...cancel,postingDate:e.target.value})}/></FormField>
      <FormField label="سبب الإلغاء" required><Textarea required value={cancel.reason} onChange={e=>setCancel({...cancel,reason:e.target.value})}/></FormField>
      <Button type="submit">فحص وتنفيذ الإلغاء</Button>
    </form></Dialog>
  </section>;
}

export function RoomingPage({api=hajjUmrahOperationsApi}:{readonly api?:HajjUmrahOperationsApi}={}){
  const [rows,setRows]=useState<RoomAssignment[]>([]),[cap,setCap]=useState<OperationsCapabilities>(emptyOperationsCapabilities),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const empty:AssignRoomInput={bookingId:'',travelerId:'',allocationId:'',roomKey:'',startDate:'',endDate:''};const [form,setForm]=useState<AssignRoomInput>(empty);
  const [move,setMove]=useState<RoomAssignment|null>(null),[moveForm,setMoveForm]=useState({allocationId:'',roomKey:'',roomLabel:'',startDate:'',endDate:''});
  const [swap,setSwap]=useState({leftId:'',rightId:''});
  async function reload(){setLoading(true);try{const[r,c]=await Promise.all([api.listRooming(),api.capabilities()]);setRows(r);setCap(c);setError('')}catch(e){setError(errorMessage(e))}finally{setLoading(false)}}useEffect(()=>{void reload()},[api]);
  async function assign(e:FormEvent){e.preventDefault();try{await api.assignRoom(form);setForm(empty);setNotice('تم حفظ التسكين.');await reload()}catch(e){setNotice(errorMessage(e))}}
  function beginMove(r:RoomAssignment){setMove(r);setMoveForm({allocationId:r.allocationId,roomKey:r.roomKey,roomLabel:r.roomLabel??'',startDate:r.startDate.slice(0,10),endDate:r.endDate.slice(0,10)})}
  async function reassign(e:FormEvent){e.preventDefault();if(!move)return;try{await api.reassignRoom(move.id,{allocationId:moveForm.allocationId,roomKey:moveForm.roomKey,...(moveForm.roomLabel.trim()?{roomLabel:moveForm.roomLabel}:{}),startDate:moveForm.startDate,endDate:moveForm.endDate});setMove(null);setNotice('تم نقل التسكين مع حفظ التاريخ.');await reload()}catch(e){setNotice(errorMessage(e))}}
  async function unassign(id:string){try{await api.unassignRoom(id);setNotice('تم إلغاء التسكين.');await reload()}catch(e){setNotice(errorMessage(e))}}
  return <section aria-label="تسكين الغرف">
    <PermissionState allowed={cap.roomingView||loading}>
      {cap.roomingManage&&<Card title="تسكين مسافر"><form onSubmit={assign}>
        <FormField label="الحجز" required><Input required value={form.bookingId} onChange={e=>setForm({...form,bookingId:e.target.value})}/></FormField>
        <FormField label="المسافر" required><Input required value={form.travelerId} onChange={e=>setForm({...form,travelerId:e.target.value})}/></FormField>
        <FormField label="تخصيص الفندق من TCI" required><Input required value={form.allocationId} onChange={e=>setForm({...form,allocationId:e.target.value})}/></FormField>
        <FormField label="الغرفة / المجموعة" required><Input required value={form.roomKey} onChange={e=>setForm({...form,roomKey:e.target.value})}/></FormField>
        <FormField label="من" required><Input required type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></FormField>
        <FormField label="إلى" required><Input required type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></FormField><Button type="submit">تسكين</Button>
      </form></Card>}
      {cap.roomingManage&&<Card title="تبديل مسافرين"><p>استخدم معرّفي تسكين نشطين من الجدول.</p><FormField label="التسكين الأول"><Input value={swap.leftId} onChange={e=>setSwap({...swap,leftId:e.target.value})}/></FormField><FormField label="التسكين الثاني"><Input value={swap.rightId} onChange={e=>setSwap({...swap,rightId:e.target.value})}/></FormField><Button type="button" disabled={!swap.leftId||!swap.rightId} onClick={async()=>{try{await api.swapRooms(swap.leftId,swap.rightId);setNotice('تم تبديل الغرف مع حفظ التاريخ.');setSwap({leftId:'',rightId:''});await reload()}catch(e){setNotice(errorMessage(e))}}}>تبديل</Button></Card>}
      <Card title="قائمة التسكين">{loading?<LoadingState/>:error?<OperationsFailure message={error}/>:!rows.length?<EmptyState title="لا توجد تسكينات"/>:<DataGrid columns={['المعرّف','الحجز','المسافر','الغرفة','الفترة','الحالة','إجراءات']}>{rows.map(r=><tr key={r.id}><td>{r.id}</td><td>{r.bookingId}</td><td>{r.travelerId}</td><td>{r.roomLabel??r.roomKey}</td><td>{r.startDate.slice(0,10)} — {r.endDate.slice(0,10)}</td><td><Badge tone={r.status==='ASSIGNED'?'success':'neutral'}>{r.status==='ASSIGNED'?'مسكن':'غير مسكن'}</Badge></td><td>{cap.roomingManage&&r.status==='ASSIGNED'&&<><Button type="button" onClick={()=>beginMove(r)}>نقل</Button><Button type="button" onClick={()=>void unassign(r.id)}>إلغاء التسكين</Button></>}</td></tr>)}</DataGrid>}</Card>
    </PermissionState>
    {notice&&<Toast>{notice}</Toast>}
    <Dialog open={Boolean(move)} title="نقل / إعادة تسكين" onClose={()=>setMove(null)}><form onSubmit={reassign}>
      <FormField label="تخصيص الفندق" required><Input required value={moveForm.allocationId} onChange={e=>setMoveForm({...moveForm,allocationId:e.target.value})}/></FormField><FormField label="الغرفة" required><Input required value={moveForm.roomKey} onChange={e=>setMoveForm({...moveForm,roomKey:e.target.value})}/></FormField><FormField label="وصف الغرفة"><Input value={moveForm.roomLabel} onChange={e=>setMoveForm({...moveForm,roomLabel:e.target.value})}/></FormField><FormField label="من" required><Input required type="date" value={moveForm.startDate} onChange={e=>setMoveForm({...moveForm,startDate:e.target.value})}/></FormField><FormField label="إلى" required><Input required type="date" value={moveForm.endDate} onChange={e=>setMoveForm({...moveForm,endDate:e.target.value})}/></FormField><Button type="submit">حفظ النقل</Button>
    </form></Dialog>
  </section>;
}

export function VisasPage({api=hajjUmrahOperationsApi}:{readonly api?:HajjUmrahOperationsApi}={}){
 const [rows,setRows]=useState<VisaCase[]>([]),[cap,setCap]=useState<OperationsCapabilities>(emptyOperationsCapabilities),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [form,setForm]=useState({bookingId:'',travelerId:'',allocationId:''}),[selected,setSelected]=useState<VisaCase|null>(null);
 const [action,setAction]=useState<'submit'|'issue'|'reject'|'cancel'>('submit'),[actionForm,setActionForm]=useState({reference:'',visaNumber:'',amount:'0',postingDate:'',reason:''});
 async function reload(){setLoading(true);try{const[r,c]=await Promise.all([api.listVisas(),api.capabilities()]);setRows(r);setCap(c);setError('')}catch(e){setError(errorMessage(e))}finally{setLoading(false)}}useEffect(()=>{void reload()},[api]);
 async function create(e:FormEvent){e.preventDefault();try{await api.createVisa(form);setForm({bookingId:'',travelerId:'',allocationId:''});setNotice('تم فتح ملف التأشيرة من أدلة الحجز والجواز والتخصيص.');await reload()}catch(e){setNotice(errorMessage(e))}}
 function open(row:VisaCase,a:typeof action){setSelected(row);setAction(a);setActionForm({reference:'',visaNumber:'',amount:'0',postingDate:'',reason:''})}
 async function perform(e:FormEvent){e.preventDefault();if(!selected)return;try{if(action==='submit')await api.submitVisa(selected.id,actionForm.reference);else if(action==='issue')await api.issueVisa(selected.id,{commandKey:`visa-issue:${selected.id}:${selected.attempt}`,visaNumber:actionForm.visaNumber,amount:actionForm.amount,postingDate:actionForm.postingDate});else if(action==='reject')await api.rejectVisa(selected.id,actionForm.reason);else await api.cancelVisa(selected.id,actionForm.reason);setSelected(null);setNotice('تم تحديث حالة التأشيرة وحفظ التاريخ.');await reload()}catch(e){setNotice(errorMessage(e))}}
 return <section aria-label="التأشيرات"><PermissionState allowed={cap.visaView||loading}>
  {cap.visaManage&&<Card title="ملف تأشيرة جديد"><form onSubmit={create}><FormField label="الحجز" required><Input required value={form.bookingId} onChange={e=>setForm({...form,bookingId:e.target.value})}/></FormField><FormField label="المسافر" required><Input required value={form.travelerId} onChange={e=>setForm({...form,travelerId:e.target.value})}/></FormField><FormField label="تخصيص التأشيرة من TCI" required><Input required value={form.allocationId} onChange={e=>setForm({...form,allocationId:e.target.value})}/></FormField><Button type="submit">فتح الملف</Button></form></Card>}
  <Card title="تشغيل التأشيرات">{loading?<LoadingState/>:error?<OperationsFailure message={error}/>:!rows.length?<EmptyState title="لا توجد ملفات تأشيرات"/>:<DataGrid columns={['الحجز','المسافر','الجواز المرجعي','المحاولة','الحالة','إجراءات']}>{rows.map(r=><tr key={r.id}><td>{r.bookingId}</td><td>{r.travelerId}</td><td>{r.passportDocumentId}</td><td>{r.attempt}</td><td><Badge tone={visaTone(r.status)}>{visaLabels[r.status]}</Badge></td><td>{cap.visaManage&&['PREPARING','REJECTED'].includes(r.status)&&<Button onClick={()=>open(r,'submit')}>تقديم</Button>}{cap.visaIssue&&r.status==='SUBMITTED'&&<Button onClick={()=>open(r,'issue')}>إصدار</Button>}{cap.visaManage&&['PREPARING','SUBMITTED'].includes(r.status)&&<Button onClick={()=>open(r,'reject')}>رفض</Button>}{cap.visaManage&&!['ISSUED','CANCELLED'].includes(r.status)&&<Button onClick={()=>open(r,'cancel')}>إلغاء</Button>}</td></tr>)}</DataGrid>}</Card>
 </PermissionState>{notice&&<Toast>{notice}</Toast>}
 <Dialog open={Boolean(selected)} title={action==='submit'?'تقديم التأشيرة':action==='issue'?'إصدار التأشيرة':action==='reject'?'رفض التأشيرة':'إلغاء التأشيرة'} onClose={()=>setSelected(null)}><form onSubmit={perform}>
   {action==='submit'&&<FormField label="مرجع الطلب" required><Input required value={actionForm.reference} onChange={e=>setActionForm({...actionForm,reference:e.target.value})}/></FormField>}
   {action==='issue'&&<><FormField label="رقم التأشيرة" required><Input required value={actionForm.visaNumber} onChange={e=>setActionForm({...actionForm,visaNumber:e.target.value})}/></FormField><FormField label="قيمة التفعيل المالي" required><Input required inputMode="decimal" value={actionForm.amount} onChange={e=>setActionForm({...actionForm,amount:e.target.value})}/></FormField><FormField label="تاريخ القيد" required><Input required type="date" value={actionForm.postingDate} onChange={e=>setActionForm({...actionForm,postingDate:e.target.value})}/></FormField></>}
   {(action==='reject'||action==='cancel')&&<FormField label="السبب" required><Textarea required value={actionForm.reason} onChange={e=>setActionForm({...actionForm,reason:e.target.value})}/></FormField>}
   <Button type="submit">حفظ</Button>
 </form></Dialog>
 </section>;
}
