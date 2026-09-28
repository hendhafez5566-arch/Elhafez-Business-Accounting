import { type FormEvent, useEffect, useState } from 'react';
import { ActionBar, Button, Card, DataGrid, FormField, Input, MetricCard, Select, Toast } from './ui.js';
import { tourismContractInventoryApi, type InventoryAllocationRow, type InventoryResourceRow, type InventoryResult, type TourismContractRow } from './tourism-contract-inventory-client.js';
import{EntityPicker}from'./entity-picker.js';
import { TourismContractInventoryCorrectiveSection } from './tourism-contract-inventory-corrective-section.js';

type ResourceType='HOTEL'|'FLIGHT_BLOCK'|'TRANSPORT'|'VISA'|'SERVICE';
const today=()=>new Date().toISOString().slice(0,10);
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'تعذر تنفيذ العملية.';

function Details({title,value}:{title:string;value:InventoryResult|null}){
 if(!value)return null;
 const rows=Object.entries(value).filter(([,v])=>v===null||['string','number','boolean'].includes(typeof v));
 return <Card title={title}>{rows.length?<DataGrid columns={['البيان','القيمة']}>{rows.map(([key,value])=><tr key={key}><td>{key}</td><td>{value===null?'—':String(value)}</td></tr>)}</DataGrid>:<p>تم تحميل السجل من المالك المعتمد.</p>}</Card>;
}

export function TourismContractInventoryPage(){
 const[notice,setNotice]=useState(''),[result,setResult]=useState<InventoryResult|null>(null),[versions,setVersions]=useState<InventoryResult[]>([]);
 const[contracts,setContracts]=useState<TourismContractRow[]>([]),[resources,setResources]=useState<InventoryResourceRow[]>([]),[allocations,setAllocations]=useState<InventoryAllocationRow[]>([]);
 const[contractId,setContractId]=useState(''),[allocationId,setAllocationId]=useState('');
 const[contract,setContract]=useState({type:'HOTEL' as ResourceType,supplierId:'',effectiveFrom:today(),effectiveTo:today()});
 const[resource,setResource]=useState({type:'HOTEL' as ResourceType,resourceId:'',secondary:'',serviceDate:today(),periodEnd:today(),quantity:'1'});
 const[allocation,setAllocation]=useState({contractId:'',resourceType:'HOTEL' as ResourceType,resourceId:'',sourceType:'TOURISM_PROGRAM',sourceId:'',serviceDate:today(),periodEnd:'',quantity:'1'});
 const[stop,setStop]=useState({contractId:'',reason:'',effectiveFrom:today(),effectiveTo:today()});

 async function reloadChoices(selectedContract=contractId){
  const[nextContracts,nextAllocations,nextResources]=await Promise.all([tourismContractInventoryApi.contracts(),tourismContractInventoryApi.allocations(),tourismContractInventoryApi.resources(selectedContract||undefined)]);
  setContracts(nextContracts);setAllocations(nextAllocations);setResources(nextResources);
 }
 useEffect(()=>{void reloadChoices().catch(error=>setNotice(errorMessage(error)));},[]);

 async function run(label:string,operation:()=>Promise<InventoryResult|null>){
  try{const value=await operation();setResult(value??null);setNotice(label);}
  catch(error){setNotice(errorMessage(error));}
 }
 async function createContract(e:FormEvent){e.preventDefault();await run('تم إنشاء العقد.',async()=>{
  const value=await tourismContractInventoryApi.createContract({...contract,...(contract.supplierId?{supplierId:contract.supplierId}:{}),commandKey:crypto.randomUUID()});
  const id=String(value.id??'');setContractId(id);setAllocation(v=>({...v,contractId:id}));setStop(v=>({...v,contractId:id}));await reloadChoices(id);return value;
 });}
 async function openContract(){await run('تم تحميل العقد.',()=>tourismContractInventoryApi.contract(contractId));try{setVersions(await tourismContractInventoryApi.versions(contractId));}catch{setVersions([]);}}
 async function createResource(e:FormEvent){e.preventDefault();const common={contractId,commandKey:crypto.randomUUID()};const op=resource.type==='HOTEL'
  ?()=>tourismContractInventoryApi.createHotel({...common,hotelId:resource.resourceId,...(resource.secondary?{roomId:resource.secondary}:{}),serviceDate:resource.serviceDate,contractedQuantity:resource.quantity})
  :resource.type==='FLIGHT_BLOCK'
  ?()=>tourismContractInventoryApi.createFlight({...common,flightNumber:resource.resourceId,origin:resource.secondary.split('>')[0]?.trim()||'',destination:resource.secondary.split('>')[1]?.trim()||'',departureDate:resource.serviceDate,totalSeats:resource.quantity})
  :resource.type==='TRANSPORT'
  ?()=>tourismContractInventoryApi.createTransport({...common,vehicleId:resource.resourceId,capacityUnits:resource.quantity,periodStart:resource.serviceDate,periodEnd:resource.periodEnd})
  :resource.type==='VISA'
  ?()=>tourismContractInventoryApi.createVisa({...common,visaType:resource.resourceId,...(resource.secondary?{nationality:resource.secondary}:{}),quotaTotal:resource.quantity,effectiveFrom:resource.serviceDate,effectiveTo:resource.periodEnd})
  :null;
 if(!op){setNotice('الخدمات العامة تُدار من شاشة السياحة والخدمات وتستهلك نفس المخزون.');return;}
 await run('تمت إضافة مورد المخزون.',op);
 }
 async function checkAvailability(){await run('تم فحص الإتاحة.',()=>tourismContractInventoryApi.availability({contractId:allocation.contractId,resourceType:allocation.resourceType,resourceId:allocation.resourceId,serviceDate:allocation.serviceDate,...(allocation.periodEnd?{periodEnd:allocation.periodEnd}:{})}));}
 async function allocate(e:FormEvent){e.preventDefault();await run('تم إنشاء التخصيص.',async()=>{
  const value=await tourismContractInventoryApi.allocate({contractId:allocation.contractId,resourceType:allocation.resourceType,resourceId:allocation.resourceId,program:{sourceType:allocation.sourceType,sourceId:allocation.sourceId},serviceDate:allocation.serviceDate,...(allocation.periodEnd?{periodEnd:allocation.periodEnd}:{}),quantity:allocation.quantity,commandKey:crypto.randomUUID()});
  const id=String(value.allocationId??(value.allocation&&typeof value.allocation==='object'?(value.allocation as {id?:string}).id:'')??'');if(id)setAllocationId(id);await reloadChoices(allocation.contractId);return value;
 });}
 async function openAllocation(){await run('تم تحميل التخصيص.',()=>tourismContractInventoryApi.allocation(allocationId));}
 async function release(){await run('تم تنفيذ طلب فك التخصيص.',async()=>{const value=await tourismContractInventoryApi.release(allocationId,{quantity:allocation.quantity,commandKey:crypto.randomUUID()});await reloadChoices(allocation.contractId);return value;});}
 async function stopSale(e:FormEvent){e.preventDefault();await run('تم تسجيل Stop Sale.',()=>tourismContractInventoryApi.stopSale({...stop,commandKey:crypto.randomUUID()}));}

 return <section dir="rtl" className="ui-page-stack" aria-label="التعاقدات والمخزون">
  {notice?<Toast tone={notice.startsWith('تم')?'success':'error'}>{notice}</Toast>:null}
  <Card title="التعاقدات والمخزون"><p>مساحة موحدة لعقود الفنادق والطيران والنقل والتأشيرات والسعات والتخصيصات. نفس المالك يخدم السياحة والحج والعمرة بدون تكرار بيانات.</p></Card>
  <div className="ui-metric-grid"><MetricCard label="العقد الحالي" value={contractId||'—'}/><MetricCard label="التخصيص الحالي" value={allocationId||'—'}/><MetricCard label="نسخ العقد" value={versions.length}/></div>
  <div className="ui-grid-md">
   <Card title="إنشاء عقد"><form onSubmit={createContract}><FormField label="نوع العقد"><Select value={contract.type} onChange={e=>setContract({...contract,type:e.target.value as ResourceType})}><option value="HOTEL">فندق</option><option value="FLIGHT_BLOCK">بلوك طيران</option><option value="TRANSPORT">نقل</option><option value="VISA">تأشيرات</option><option value="SERVICE">خدمة</option></Select></FormField><EntityPicker kind="SUPPLIER" label="المورد" value={contract.supplierId} onChange={supplierId=>setContract({...contract,supplierId})}/><FormField label="من"><Input required type="date" value={contract.effectiveFrom} onChange={e=>setContract({...contract,effectiveFrom:e.target.value})}/></FormField><FormField label="إلى"><Input required type="date" value={contract.effectiveTo} onChange={e=>setContract({...contract,effectiveTo:e.target.value})}/></FormField><Button type="submit">إنشاء العقد</Button></form><hr/><FormField label="العقد"><Select value={contractId} onChange={e=>{const id=e.target.value;setContractId(id);setAllocation(v=>({...v,contractId:id,resourceId:''}));setStop(v=>({...v,contractId:id}));void reloadChoices(id);}}><option value="">اختر عقدًا</option>{contracts.map(row=><option key={row.id} value={row.id}>{row.type} — {row.effectiveFrom.slice(0,10)} → {row.effectiveTo.slice(0,10)} — {row.status}</option>)}</Select></FormField><Button variant="secondary" onClick={()=>void openContract()}>فتح العقد ونسخه</Button></Card>
   <Card title="إضافة سعة / مخزون"><form onSubmit={createResource}><FormField label="نوع المورد"><Select value={resource.type} onChange={e=>setResource({...resource,type:e.target.value as ResourceType})}><option value="HOTEL">غرف فندق</option><option value="FLIGHT_BLOCK">بلوك طيران</option><option value="TRANSPORT">سعة نقل</option><option value="VISA">حصة تأشيرات</option></Select></FormField><FormField label={resource.type==='HOTEL'?'كود / اسم الفندق':resource.type==='FLIGHT_BLOCK'?'رقم الرحلة':resource.type==='TRANSPORT'?'كود المركبة':'نوع التأشيرة'} required><Input required value={resource.resourceId} onChange={e=>setResource({...resource,resourceId:e.target.value})}/></FormField><FormField label={resource.type==='FLIGHT_BLOCK'?'المسار — مثال CAI > JED':resource.type==='VISA'?'الجنسية':'تفصيل إضافي'}><Input value={resource.secondary} onChange={e=>setResource({...resource,secondary:e.target.value})}/></FormField><FormField label="تاريخ البداية"><Input required type="date" value={resource.serviceDate} onChange={e=>setResource({...resource,serviceDate:e.target.value})}/></FormField>{['TRANSPORT','VISA'].includes(resource.type)?<FormField label="تاريخ النهاية"><Input required type="date" value={resource.periodEnd} onChange={e=>setResource({...resource,periodEnd:e.target.value})}/></FormField>:null}<FormField label="الكمية / السعة"><Input required inputMode="decimal" value={resource.quantity} onChange={e=>setResource({...resource,quantity:e.target.value})}/></FormField><Button type="submit">إضافة للمخزون</Button></form></Card>
  </div>
  <div className="ui-grid-md">
   <Card title="الإتاحة والتخصيص"><form onSubmit={allocate}><FormField label="العقد" required><Select required value={allocation.contractId} onChange={e=>{const contractId=e.target.value;setAllocation({...allocation,contractId,resourceId:''});void reloadChoices(contractId);}}><option value="">اختر العقد</option>{contracts.filter(row=>row.status==='ACTIVE'||row.status==='AMENDED').map(row=><option key={row.id} value={row.id}>{row.type} — {row.effectiveFrom.slice(0,10)} → {row.effectiveTo.slice(0,10)}</option>)}</Select></FormField><FormField label="نوع المورد"><Select value={allocation.resourceType} onChange={e=>setAllocation({...allocation,resourceType:e.target.value as ResourceType,resourceId:''})}><option value="HOTEL">فندق</option><option value="FLIGHT_BLOCK">طيران</option><option value="TRANSPORT">نقل</option><option value="VISA">تأشيرة</option><option value="SERVICE">خدمة</option></Select></FormField><FormField label="المورد / السعة" required><Select required value={allocation.resourceId} onChange={e=>{const selected=resources.find(row=>row.id===e.target.value);setAllocation({...allocation,resourceId:e.target.value,...(selected?{serviceDate:selected.serviceDate.slice(0,10),periodEnd:selected.periodEnd?.slice(0,10)??''}:{})});}}><option value="">اختر المورد المتاح</option>{resources.filter(row=>row.contractId===allocation.contractId&&row.type===allocation.resourceType).map(row=><option key={row.id} value={row.id}>{row.label} — متاح {row.availableQuantity}</option>)}</Select></FormField><FormField label="نوع البرنامج"><Select value={allocation.sourceType} onChange={e=>setAllocation({...allocation,sourceType:e.target.value,sourceId:''})}><option value="TOURISM_PROGRAM">برنامج سياحي</option><option value="HAJJ_UMRAH_PROGRAM">حج / عمرة</option></Select></FormField><EntityPicker kind={allocation.sourceType==='HAJJ_UMRAH_PROGRAM'?'HAJJ_PROGRAM':'TOURISM_PROGRAM'} label="البرنامج" required value={allocation.sourceId} onChange={sourceId=>setAllocation({...allocation,sourceId})}/><FormField label="تاريخ الخدمة"><Input required type="date" value={allocation.serviceDate} onChange={e=>setAllocation({...allocation,serviceDate:e.target.value})}/></FormField><FormField label="الكمية"><Input required inputMode="decimal" value={allocation.quantity} onChange={e=>setAllocation({...allocation,quantity:e.target.value})}/></FormField><ActionBar><Button type="button" variant="secondary" onClick={()=>void checkAvailability()}>فحص الإتاحة</Button><Button type="submit">تخصيص السعة</Button></ActionBar></form><hr/><FormField label="التخصيص"><Select value={allocationId} onChange={e=>setAllocationId(e.target.value)}><option value="">اختر تخصيصًا</option>{allocations.filter(row=>row.status!=='RELEASED').map(row=><option key={row.id} value={row.id}>{row.resourceType} — {row.serviceDate.slice(0,10)} — {row.quantity} — {row.status}</option>)}</Select></FormField><ActionBar><Button variant="secondary" onClick={()=>void openAllocation()}>فتح التخصيص</Button><Button variant="danger" onClick={()=>void release()}>فك الكمية المحددة</Button></ActionBar></Card>
   <Card title="إيقاف البيع Stop Sale"><form onSubmit={stopSale}><FormField label="العقد" required><Select required value={stop.contractId} onChange={e=>setStop({...stop,contractId:e.target.value})}><option value="">اختر عقدًا</option>{contracts.filter(row=>row.status==='ACTIVE'||row.status==='AMENDED').map(row=><option key={row.id} value={row.id}>{row.type} — {row.effectiveFrom.slice(0,10)} → {row.effectiveTo.slice(0,10)}</option>)}</Select></FormField><FormField label="السبب" required><Input required value={stop.reason} onChange={e=>setStop({...stop,reason:e.target.value})}/></FormField><FormField label="من"><Input required type="date" value={stop.effectiveFrom} onChange={e=>setStop({...stop,effectiveFrom:e.target.value})}/></FormField><FormField label="إلى"><Input required type="date" value={stop.effectiveTo} onChange={e=>setStop({...stop,effectiveTo:e.target.value})}/></FormField><Button variant="danger" type="submit">تسجيل إيقاف البيع</Button></form></Card>
  </div>
  <TourismContractInventoryCorrectiveSection contractId={contractId}/>
  {versions.length?<Card title="نسخ العقد"><DataGrid columns={['الإصدار','من','إلى']}>{versions.map((v,index)=><tr key={String(v.id??index)}><td>{String(v.version??index+1)}</td><td>{String(v.effectiveFrom??'—')}</td><td>{String(v.effectiveTo??'—')}</td></tr>)}</DataGrid></Card>:null}
  <Details title="آخر نتيجة" value={result}/>
 </section>;
}
