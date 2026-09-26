import{type FormEvent,useEffect,useMemo,useState}from'react';
import{tourismInventoryApi,type ContractRow,type ContractType,type TourismInventoryCapabilities,type TourismInventoryOverview}from'./tourism-inventory-client.js';
import{ActionBar,Badge,Button,Card,DataGrid,DisclosureCard,EmptyState,ErrorState,FormField,Input,LoadingState,MetricCard,Select,Tabs,Textarea,Toast}from'./ui.js';

const typeLabel:Record<ContractType,string>={HOTEL:'فنادق',FLIGHT_BLOCK:'طيران',TRANSPORT:'نقل',VISA:'تأشيرات',SERVICE:'خدمات'};
const err=(e:unknown)=>e instanceof Error?e.message:'تعذر تنفيذ العملية.';
const today=()=>new Date().toISOString().slice(0,10);
type StockTab='contracts'|'stock'|'allocations'|'stop-sales';

export function TourismInventoryPage(){
 const[data,setData]=useState<TourismInventoryOverview|null>(null),[cap,setCap]=useState<TourismInventoryCapabilities>({view:false,manage:false}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[contractId,setContractId]=useState(''),[tab,setTab]=useState<StockTab>('contracts');
 async function reload(selected=contractId){setLoading(true);setError('');try{const[c,d]=await Promise.all([tourismInventoryApi.capabilities(),tourismInventoryApi.overview(selected||undefined)]);setCap(c);setData(d)}catch(e){setError(err(e))}finally{setLoading(false)}}
 async function run(message:string,work:()=>Promise<unknown>){try{await work();setNotice(message);await reload()}catch(e){setNotice(err(e))}}
 useEffect(()=>{void reload('')},[]);
 async function filter(value:string){setContractId(value);await reload(value)}
 if(loading)return<LoadingState label="جارٍ تحميل التعاقدات والمخزون…"/>;
 if(error)return<ErrorState message={error}/>;
 if(!cap.view||!data)return<EmptyState title="لا توجد صلاحية لعرض التعاقدات والمخزون"/>;
 const selected=data.contracts.find(x=>x.id===contractId);
 const available=Number(data.hotels.reduce((s,x)=>s+Number(x.availableQuantity),0))+Number(data.flights.reduce((s,x)=>s+Number(x.availableSeats),0))+Number(data.transport.reduce((s,x)=>s+Math.max(0,Number(x.capacityUnits)-Number(x.consumedUnits)),0))+Number(data.visas.reduce((s,x)=>s+Number(x.quotaRemaining),0))+Number(data.services.reduce((s,x)=>s+Number(x.availableQuantity),0));
 return <section dir="rtl" className="ui-page-stack" aria-label="التعاقدات والمخزون">
  {notice?<Toast tone={notice.startsWith('تعذر')?'error':'success'}>{notice}</Toast>:null}
  <Card title="التعاقدات والمخزون"><p>إدارة موحدة لعقود الفنادق والطيران والنقل والتأشيرات والخدمات والسعات والتخصيصات.</p><ActionBar><Select aria-label="فلترة حسب العقد" value={contractId} onChange={e=>void filter(e.target.value)}><option value="">كل العقود</option>{data.contracts.map(c=><option key={c.id} value={c.id}>{typeLabel[c.type]} — {c.supplierId??c.id.slice(0,8)}</option>)}</Select><Button variant="secondary" onClick={()=>void reload()}>تحديث</Button></ActionBar></Card>
  <div className="ui-metric-grid"><MetricCard label="العقود" value={data.contracts.length}/><MetricCard label="العقود النشطة" value={data.contracts.filter(x=>x.status==='ACTIVE').length}/><MetricCard label="التخصيصات" value={data.allocations.length}/><MetricCard label="السعة المتاحة المعروضة" value={available}/></div>
  <Tabs tabs={[{id:'contracts',label:'العقود'},{id:'stock',label:'المخزون والسعات'},{id:'allocations',label:'التخصيصات'},{id:'stop-sales',label:'إيقاف البيع'}]} active={tab} onChange={id=>setTab(id as StockTab)}/>
  {tab==='contracts'?<ContractsPanel data={data} manage={cap.manage} run={run}/>:null}
  {tab==='stock'?<StockPanel data={data} selected={selected} manage={cap.manage} run={run}/>:null}
  {tab==='allocations'?<AllocationsPanel data={data} manage={cap.manage} run={run}/>:null}
  {tab==='stop-sales'?<StopSalesPanel data={data} selected={selected} manage={cap.manage} run={run}/>:null}
 </section>
}

type Run=(message:string,work:()=>Promise<unknown>)=>Promise<void>;

function ContractsPanel({data,manage,run}:{data:TourismInventoryOverview;manage:boolean;run:Run}){
 const[f,setF]=useState({type:'HOTEL' as ContractType,supplierId:'',effectiveFrom:today(),effectiveTo:today()}),[amend,setAmend]=useState({contractId:'',effectiveFrom:today(),effectiveTo:'',terms:''});
 async function create(e:FormEvent){e.preventDefault();await run('تم إنشاء العقد.',()=>tourismInventoryApi.createContract({...f,...(f.supplierId?{supplierId:f.supplierId}:{})}));setF({...f,supplierId:''})}
 async function amendContract(e:FormEvent){e.preventDefault();let terms:Record<string,unknown>;try{terms=JSON.parse(amend.terms||'{}') as Record<string,unknown>}catch{throw new Error('شروط التعديل يجب أن تكون JSON صالحًا.')}await run('تم إنشاء نسخة تعديل جديدة للعقد.',()=>tourismInventoryApi.amendContract(amend.contractId,{terms,effectiveFrom:amend.effectiveFrom,...(amend.effectiveTo?{effectiveTo:amend.effectiveTo}:{})}));setAmend({...amend,terms:''})}
 return <>{manage?<div className="ui-grid-md"><DisclosureCard title="عقد جديد"><form onSubmit={create}><FormField label="نوع العقد"><Select value={f.type} onChange={e=>setF({...f,type:e.target.value as ContractType})}>{Object.entries(typeLabel).map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select></FormField><FormField label="معرّف المورد"><Input value={f.supplierId} onChange={e=>setF({...f,supplierId:e.target.value})} placeholder="اختياري"/></FormField><FormField label="ساري من"><Input required type="date" value={f.effectiveFrom} onChange={e=>setF({...f,effectiveFrom:e.target.value})}/></FormField><FormField label="ساري حتى"><Input required type="date" value={f.effectiveTo} onChange={e=>setF({...f,effectiveTo:e.target.value})}/></FormField><Button type="submit">إنشاء العقد</Button></form></DisclosureCard>
 <DisclosureCard title="تعديل تعاقدي" description="يحفظ نسخة جديدة ولا يطمس تاريخ العقد."><form onSubmit={amendContract}><FormField label="العقد"><ContractSelect contracts={data.contracts} value={amend.contractId} onChange={value=>setAmend({...amend,contractId:value})}/></FormField><FormField label="سريان التعديل"><Input required type="date" value={amend.effectiveFrom} onChange={e=>setAmend({...amend,effectiveFrom:e.target.value})}/></FormField><FormField label="نهاية السريان"><Input type="date" value={amend.effectiveTo} onChange={e=>setAmend({...amend,effectiveTo:e.target.value})}/></FormField><FormField label="شروط التعديل" hint='مثال: {"rate":"1200","notes":"renewal"}'><Textarea required value={amend.terms} onChange={e=>setAmend({...amend,terms:e.target.value})}/></FormField><Button type="submit">حفظ نسخة التعديل</Button></form></DisclosureCard></div>:null}
 <Card title="سجل العقود">{!data.contracts.length?<EmptyState/>:<DataGrid columns={['النوع','المورد','السريان','الحالة','المعرّف']}>{data.contracts.map(x=><tr key={x.id}><td>{typeLabel[x.type]}</td><td>{x.supplierId??'—'}</td><td>{x.effectiveFrom} — {x.effectiveTo}</td><td><Badge tone={x.status==='ACTIVE'?'success':x.status==='CANCELLED'?'error':'neutral'}>{x.status}</Badge></td><td><small>{x.id}</small></td></tr>)}</DataGrid>}</Card></>
}

function StockPanel({data,selected,manage,run}:{data:TourismInventoryOverview;selected?:ContractRow;manage:boolean;run:Run}){
 const[f,setF]=useState<Record<string,string>>({contractId:'',hotelId:'',roomId:'',serviceDate:today(),quantity:'',flightNumber:'',origin:'',destination:'',departureDate:today(),vehicleId:'',periodStart:today(),periodEnd:today(),visaType:'UMRAH',nationality:'',category:'OTHER',name:'',unit:'UNIT',description:'',releaseDeadline:''});
 useEffect(()=>{if(selected)setF(v=>({...v,contractId:selected.id}))},[selected?.id]);
 const contract=data.contracts.find(x=>x.id===f.contractId)??selected;
 async function submit(e:FormEvent){e.preventDefault();if(!contract)throw new Error('اختر عقدًا أولًا.');const q=f.quantity;
  if(contract.type==='HOTEL')await run('تمت إضافة مخزون الفندق.',()=>tourismInventoryApi.createHotel({contractId:contract.id,hotelId:f.hotelId!,...(f.roomId?{roomId:f.roomId}:{}),serviceDate:f.serviceDate!,contractedQuantity:q!}));
  else if(contract.type==='FLIGHT_BLOCK')await run('تمت إضافة بلوك الطيران.',()=>tourismInventoryApi.createFlight({contractId:contract.id,flightNumber:f.flightNumber!,origin:f.origin!,destination:f.destination!,departureDate:f.departureDate!,totalSeats:q!}));
  else if(contract.type==='TRANSPORT')await run('تمت إضافة سعة النقل.',()=>tourismInventoryApi.createTransport({contractId:contract.id,vehicleId:f.vehicleId!,capacityUnits:q!,periodStart:f.periodStart!,periodEnd:f.periodEnd!}));
  else if(contract.type==='VISA')await run('تمت إضافة حصة التأشيرات.',()=>tourismInventoryApi.createVisa({contractId:contract.id,visaType:f.visaType!,...(f.nationality?{nationality:f.nationality}:{}),quotaTotal:q!,effectiveFrom:f.periodStart!,effectiveTo:f.periodEnd!}));
  else await run('تمت إضافة مخزون الخدمة.',()=>tourismInventoryApi.createService({contractId:contract.id,category:f.category as 'CAMP'|'MEAL'|'VISIT'|'GUIDE'|'RAWDA'|'INSURANCE'|'OTHER',name:f.name!,...(f.description?{description:f.description}:{}),unit:f.unit!,serviceStart:f.periodStart!,serviceEnd:f.periodEnd!,capacity:q!,...(f.releaseDeadline?{releaseDeadline:f.releaseDeadline}:{})}));
  setF(v=>({...v,quantity:''}));
 }
 return <>{manage?<DisclosureCard title="إضافة سعة / مخزون" description="النموذج يتغير حسب نوع العقد المحدد."><form onSubmit={submit}><FormField label="العقد" required><ContractSelect contracts={data.contracts} value={f.contractId??''} onChange={value=>setF({...f,contractId:value})}/></FormField>
 {contract?.type==='HOTEL'?<><FormField label="الفندق" required><Input required value={f.hotelId??''} onChange={e=>setF({...f,hotelId:e.target.value})}/></FormField><FormField label="الغرفة / النوع"><Input value={f.roomId??''} onChange={e=>setF({...f,roomId:e.target.value})}/></FormField><FormField label="تاريخ الخدمة"><Input required type="date" value={f.serviceDate??''} onChange={e=>setF({...f,serviceDate:e.target.value})}/></FormField></>:null}
 {contract?.type==='FLIGHT_BLOCK'?<><FormField label="رقم الرحلة"><Input required value={f.flightNumber??''} onChange={e=>setF({...f,flightNumber:e.target.value})}/></FormField><FormField label="من"><Input required value={f.origin??''} onChange={e=>setF({...f,origin:e.target.value})}/></FormField><FormField label="إلى"><Input required value={f.destination??''} onChange={e=>setF({...f,destination:e.target.value})}/></FormField><FormField label="تاريخ الإقلاع"><Input required type="date" value={f.departureDate??''} onChange={e=>setF({...f,departureDate:e.target.value})}/></FormField></>:null}
 {contract?.type==='TRANSPORT'?<FormField label="المركبة / الباص"><Input required value={f.vehicleId??''} onChange={e=>setF({...f,vehicleId:e.target.value})}/></FormField>:null}
 {contract?.type==='VISA'?<><FormField label="نوع التأشيرة"><Input required value={f.visaType??''} onChange={e=>setF({...f,visaType:e.target.value})}/></FormField><FormField label="الجنسية"><Input value={f.nationality??''} onChange={e=>setF({...f,nationality:e.target.value})}/></FormField></>:null}
 {contract?.type==='SERVICE'?<><FormField label="الفئة"><Select value={f.category??'OTHER'} onChange={e=>setF({...f,category:e.target.value})}>{['CAMP','MEAL','VISIT','GUIDE','RAWDA','INSURANCE','OTHER'].map(x=><option key={x}>{x}</option>)}</Select></FormField><FormField label="اسم الخدمة"><Input required value={f.name??''} onChange={e=>setF({...f,name:e.target.value})}/></FormField><FormField label="الوحدة"><Input required value={f.unit??''} onChange={e=>setF({...f,unit:e.target.value})}/></FormField><FormField label="الوصف"><Textarea value={f.description??''} onChange={e=>setF({...f,description:e.target.value})}/></FormField></>:null}
 {contract&&['TRANSPORT','VISA','SERVICE'].includes(contract.type)?<><FormField label="بداية الفترة"><Input required type="date" value={f.periodStart??''} onChange={e=>setF({...f,periodStart:e.target.value})}/></FormField><FormField label="نهاية الفترة"><Input required type="date" value={f.periodEnd??''} onChange={e=>setF({...f,periodEnd:e.target.value})}/></FormField></>:null}
 {contract?.type==='SERVICE'?<FormField label="موعد الإفراج"><Input type="date" value={f.releaseDeadline??''} onChange={e=>setF({...f,releaseDeadline:e.target.value})}/></FormField>:null}
 {contract?<FormField label={contract.type==='FLIGHT_BLOCK'?'عدد المقاعد':contract.type==='VISA'?'الحصة':'السعة / الكمية'} required><Input required inputMode="decimal" value={f.quantity??''} onChange={e=>setF({...f,quantity:e.target.value})}/></FormField>:null}
 <Button type="submit" disabled={!contract}>إضافة للمخزون</Button></form></DisclosureCard>:null}
 <div className="ui-grid-md">
  <StockTable title="مخزون الفنادق" columns={['الفندق','الغرفة','التاريخ','المتعاقد','المخصص','المتاح']} rows={data.hotels.map(x=>[x.hotelId,x.roomId??'—',x.serviceDate,x.contractedQuantity,x.allocatedQuantity,x.availableQuantity])}/>
  <StockTable title="بلوكات الطيران" columns={['الرحلة','المسار','التاريخ','الإجمالي','المستهلك','المتاح']} rows={data.flights.map(x=>[x.flightNumber,x.origin+' → '+x.destination,x.departureDate,x.totalSeats,x.consumedSeats,x.availableSeats])}/>
  <StockTable title="سعات النقل" columns={['المركبة','الفترة','السعة','المستهلك']} rows={data.transport.map(x=>[x.vehicleId,x.periodStart+' — '+x.periodEnd,x.capacityUnits,x.consumedUnits])}/>
  <StockTable title="حصص التأشيرات" columns={['النوع','الجنسية','الفترة','الإجمالي','المستهلك','المتبقي']} rows={data.visas.map(x=>[x.visaType,x.nationality??'—',x.effectiveFrom+' — '+x.effectiveTo,x.quotaTotal,x.quotaConsumed,x.quotaRemaining])}/>
  <StockTable title="مخزون الخدمات" columns={['الخدمة','الفئة','الفترة','السعة','المخصص','المتاح']} rows={data.services.map(x=>[x.name,x.category,x.serviceStart+' — '+x.serviceEnd,x.capacity,x.allocatedQuantity,x.availableQuantity])}/>
 </div></>
}

function AllocationsPanel({data,manage,run}:{data:TourismInventoryOverview;manage:boolean;run:Run}){
 const[release,setRelease]=useState<Record<string,string>>({});
 return <Card title="التخصيصات">{!data.allocations.length?<EmptyState/>:<DataGrid columns={['النوع','المورد/السعة','التاريخ','الكمية','الحالة','إفراج']}>{data.allocations.map(x=><tr key={x.id}><td>{x.resourceType}</td><td>{x.resourceId}</td><td>{x.serviceDate}{x.periodEnd?' — '+x.periodEnd:''}</td><td>{x.quantity}</td><td><Badge tone={x.status==='CONFIRMED'?'success':x.status==='BLOCKED'?'error':'warning'}>{x.status}</Badge></td><td>{manage&&!['RELEASED','CONSUMED'].includes(x.status)?<span className="ui-inline"><Input aria-label={'كمية الإفراج '+x.id} inputMode="decimal" value={release[x.id]??''} onChange={e=>setRelease({...release,[x.id]:e.target.value})}/><Button variant="secondary" disabled={!release[x.id]} onClick={()=>void run('تم تنفيذ الإفراج وفق الموانع المسجلة.',()=>tourismInventoryApi.releaseAllocation(x.id,release[x.id]!))}>إفراج</Button></span>:'—'}</td></tr>)}</DataGrid>}</Card>
}

function StopSalesPanel({data,selected,manage,run}:{data:TourismInventoryOverview;selected?:ContractRow;manage:boolean;run:Run}){
 const[f,setF]=useState({contractId:selected?.id??'',reason:'',effectiveFrom:today(),effectiveTo:today()});useEffect(()=>{if(selected)setF(v=>({...v,contractId:selected.id}))},[selected?.id]);
 async function submit(e:FormEvent){e.preventDefault();await run('تم تسجيل إيقاف البيع.',()=>tourismInventoryApi.createStopSale(f));setF({...f,reason:''})}
 return <>{manage?<DisclosureCard title="إيقاف بيع" description="يمنع التخصيص داخل نافذة السريان المحددة."><form onSubmit={submit}><FormField label="العقد"><ContractSelect contracts={data.contracts} value={f.contractId} onChange={value=>setF({...f,contractId:value})}/></FormField><FormField label="السبب"><Textarea required value={f.reason} onChange={e=>setF({...f,reason:e.target.value})}/></FormField><FormField label="من"><Input required type="date" value={f.effectiveFrom} onChange={e=>setF({...f,effectiveFrom:e.target.value})}/></FormField><FormField label="إلى"><Input required type="date" value={f.effectiveTo} onChange={e=>setF({...f,effectiveTo:e.target.value})}/></FormField><Button type="submit">تسجيل إيقاف البيع</Button></form></DisclosureCard>:null}
 <Card title="سجل إيقاف البيع">{!data.stopSales.length?<EmptyState/>:<DataGrid columns={['العقد','السبب','الفترة','الحالة']}>{data.stopSales.map(x=><tr key={x.id}><td>{x.contractId}</td><td>{x.reason}</td><td>{x.effectiveFrom} — {x.effectiveTo}</td><td><Badge tone={x.isActive?'warning':'neutral'}>{x.isActive?'نشط':'منتهي'}</Badge></td></tr>)}</DataGrid>}</Card></>
}

function ContractSelect({contracts,value,onChange}:{contracts:ContractRow[];value:string;onChange:(value:string)=>void}){return <Select required value={value} onChange={e=>onChange(e.target.value)}><option value="">اختر العقد</option>{contracts.filter(x=>!['CANCELLED','EXPIRED'].includes(x.status)).map(x=><option key={x.id} value={x.id}>{typeLabel[x.type]} — {x.supplierId??x.id.slice(0,8)}</option>)}</Select>}
function StockTable({title,columns,rows}:{title:string;columns:string[];rows:string[][]}){return <Card title={title}>{!rows.length?<EmptyState/>:<DataGrid columns={columns}>{rows.map((row,index)=><tr key={title+index}>{row.map((value,i)=><td key={i}>{value}</td>)}</tr>)}</DataGrid>}</Card>}
