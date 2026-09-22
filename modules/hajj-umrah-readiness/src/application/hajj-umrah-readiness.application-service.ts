import{createHash,randomUUID}from'node:crypto';
import{ContractValidationError,sourceReference,type ExecutionContext,type SourceReference}from'@elhafez/contracts';
import type{Program,ProgramComponent,Requirement}from'@elhafez/hajj-umrah-programs';
import type{Booking}from'@elhafez/hajj-umrah-bookings';
import type{Traveler,TravelDocument}from'@elhafez/traveler-management';
import type{RoomAssignment}from'@elhafez/hajj-umrah-rooming';
import type{VisaCase}from'@elhafez/hajj-umrah-visa-operations';
import type{TicketRecord}from'@elhafez/hajj-umrah-ticketing';
import type{ManifestAssignment,TransportRun}from'@elhafez/hajj-umrah-transport-operations';
import type{Incident,OperationTask,ServiceExecution,ServiceCategory as TripServiceCategory}from'@elhafez/hajj-umrah-trip-operations';
import type{Allocation,ContractType,ServiceCategory as InventoryServiceCategory}from'@elhafez/tourism-contract-inventory';
import type{ServiceCategory as FinancialServiceCategory}from'@elhafez/tourism-finance-orchestration';
import type{ReadinessRepository}from'./readiness.repository.js';
import type{FinancialReadinessEvidence,ReadinessAccess,ReadinessSources}from'./readiness.ports.js';
import type{ClosureEvidenceRecord,ReadinessBlocker,ReadinessBlockerCategory,ReadinessResult}from'../domain/readiness.js';

export const READINESS_PERMISSIONS=Object.freeze({
 view:'hajj_umrah.readiness.view',
 view360:'hajj_umrah.readiness.360.view',
 reports:'hajj_umrah.readiness.reports.view',
 close:'hajj_umrah.readiness.close',
});

export interface WorkQueueItem{
 readonly key:string;
 readonly priority:'CRITICAL'|'HIGH'|'NORMAL';
 readonly category:ReadinessBlockerCategory;
 readonly title:string;
 readonly detail:string;
 readonly owner:string;
 readonly programId:string;
 readonly bookingId?:string;
 readonly travelerId?:string;
 readonly dueAt?:string;
 readonly reference?:SourceReference;
}
export interface ClosureEvaluation{
 readonly canClose:boolean;
 readonly program:Program;
 readonly blockers:readonly ReadinessBlocker[];
 readonly evidenceReferences:readonly string[];
}
type TravelerEvidence={traveler:Traveler;passport:TravelDocument|null};
type RunEvidence={run:TransportRun;manifest:readonly ManifestAssignment[]};
type LoadedEvidence={
 bookings:readonly Booking[];
 rooming:readonly RoomAssignment[];
 visas:readonly VisaCase[];
 tickets:readonly TicketRecord[];
 transport:readonly RunEvidence[];
 tasks:readonly OperationTask[];
 incidents:readonly Incident[];
 services:readonly ServiceExecution[];
 blockers:readonly ReadinessBlocker[];
};

const financialMap:Readonly<Record<string,FinancialServiceCategory>>={HOTEL:'HOTEL',FLIGHT:'FLIGHT',TRANSPORT:'TRANSPORT',VISA:'VISA'};
const serviceRequirements=new Set<Requirement>(['CAMP','MEAL','VISIT','GUIDE','RAWDA','INSURANCE']);
const tciMap=(requirement:Requirement):{resourceType:ContractType;serviceCategory?:InventoryServiceCategory}|null=>{
 if(requirement==='HOTEL')return{resourceType:'HOTEL'};
 if(requirement==='FLIGHT')return{resourceType:'FLIGHT_BLOCK'};
 if(requirement==='TRANSPORT')return{resourceType:'TRANSPORT'};
 if(requirement==='VISA')return{resourceType:'VISA'};
 if(requirement==='HEALTH')return null;
 return{resourceType:'SERVICE',...(requirement==='PERMIT'?{}:{serviceCategory:requirement as InventoryServiceCategory})};
};
const messageOf=(error:unknown)=>error instanceof Error?error.message:'owner evidence unavailable';

export class HajjUmrahReadinessApplicationService{
 constructor(
  private readonly repo:ReadinessRepository,
  private readonly access:ReadinessAccess,
  private readonly sources:ReadinessSources,
  private readonly now:()=>Date=()=>new Date(),
  private readonly id:()=>string=()=>randomUUID(),
 ){}

 private async permission(c:ExecutionContext,p:string){await this.access.requireBranch(c);await this.access.requirePermission(c,p)}
 private programRef(programId:string){return sourceReference('HAJJ_UMRAH_PROGRAM',programId)}
 private bookingRef(bookingId:string){return sourceReference('HAJJ_UMRAH_BOOKING',bookingId)}
 private block(category:ReadinessBlockerCategory,code:string,message:string,owner:string,responsibility:string,programId:string,extra:Partial<Pick<ReadinessBlocker,'bookingId'|'travelerId'|'reference'|'evidenceReferences'>>={}):ReadinessBlocker{
  return{category,code,message,owner,responsibility,programId,evidenceReferences:extra.evidenceReferences??[],...(extra.bookingId?{bookingId:extra.bookingId}:{}),...(extra.travelerId?{travelerId:extra.travelerId}:{}),...(extra.reference?{reference:extra.reference}:{})};
 }
 private ownerFailure(owner:string,programId:string,error:unknown){return this.block('PROGRAM','OWNER_EVIDENCE_UNAVAILABLE',`تعذر قراءة الدليل التشغيلي من ${owner}: ${messageOf(error)}`,owner,'مسؤول النظام',programId)}
 private uniqueBlockers(values:readonly ReadinessBlocker[]){
  const result=new Map<string,ReadinessBlocker>();
  for(const value of values){const key=[value.category,value.code,value.programId,value.bookingId??'',value.travelerId??'',value.reference?.sourceType??'',value.reference?.sourceId??''].join('|');if(!result.has(key))result.set(key,value)}
  return[...result.values()];
 }
 private result(blockers:readonly ReadinessBlocker[],evidenceReferences:readonly string[]):ReadinessResult{
  const clean=this.uniqueBlockers(blockers);
  return{status:clean.length?'NOT_READY':'READY',blockers:clean,evidenceReferences:[...new Set(evidenceReferences)].sort()};
 }
 private financialCategories(program:Program):FinancialServiceCategory[]{
  const result=new Set<FinancialServiceCategory>();
  for(const requirement of program.snapshot.requirements)result.add(financialMap[requirement]??'OTHER');
  return[...result];
 }

 private async loaded(c:ExecutionContext,programId:string):Promise<LoadedEvidence>{
  const blockers:ReadinessBlocker[]=[];
  const safe=async<T>(owner:string,run:()=>Promise<T>,fallback:T):Promise<T>=>{try{return await run()}catch(error){blockers.push(this.ownerFailure(owner,programId,error));return fallback}};
  const [bookings,rooming,visas,tickets,runs,tasks,incidents,services]=await Promise.all([
   safe('hajj-umrah-bookings',()=>this.sources.bookings(c,programId),[] as Booking[]),
   safe('hajj-umrah-rooming',()=>this.sources.rooming(c,programId),[] as RoomAssignment[]),
   safe('hajj-umrah-visa-operations',()=>this.sources.visas(c,programId),[] as VisaCase[]),
   safe('hajj-umrah-ticketing',()=>this.sources.tickets(c,programId),[] as TicketRecord[]),
   safe('hajj-umrah-transport-operations',()=>this.sources.transportRuns(c,programId),[] as TransportRun[]),
   safe('hajj-umrah-trip-operations',()=>this.sources.tasks(c,programId),[] as OperationTask[]),
   safe('hajj-umrah-trip-operations',()=>this.sources.incidents(c,programId),[] as Incident[]),
   safe('hajj-umrah-trip-operations',()=>this.sources.services(c,programId),[] as ServiceExecution[]),
  ]);
  const transport:RunEvidence[]=[];
  for(const run of runs){
   const manifest=await safe('hajj-umrah-transport-operations',()=>this.sources.manifest(c,run.id),[] as ManifestAssignment[]);
   transport.push({run,manifest});
  }
  return{bookings,rooming,visas,tickets,transport,tasks,incidents,services,blockers};
 }

 private components(program:Program,requirement:Requirement){return program.snapshot.components.filter(component=>component.type===requirement)}
 private async allocation(companyId:string,id:string,cache:Map<string,Allocation|null>){if(cache.has(id))return cache.get(id)??null;const value=await this.sources.allocation(companyId,id);cache.set(id,value);return value}
 private async componentCovered(companyId:string,component:ProgramComponent,allocationId:string,cache:Map<string,Allocation|null>){
  if(!component.inventoryReference)return false;
  const value=await this.allocation(companyId,allocationId,cache);
  return Boolean(value&&value.resourceId===component.inventoryReference&&['CONFIRMED','PARTIALLY_RELEASED','CONSUMED'].includes(value.status));
 }
 private async travelerEvidence(c:ExecutionContext,program:Program,booking:Booking,blockers:ReadinessBlocker[],evidence:string[]):Promise<TravelerEvidence[]>{
  const result:TravelerEvidence[]=[];
  for(const id of booking.travelerIds){
   try{
    const traveler=await this.sources.traveler(c,id);
    const passport=await this.sources.passport(c,id);
    evidence.push(traveler.id);
    if(!passport){
     blockers.push(this.block('TRAVELER_DOCUMENT','PASSPORT_MISSING','لا يوجد جواز سفر ساري مسجل للمسافر.','traveler-management','بيانات المسافرين',program.id,{bookingId:booking.id,travelerId:id,reference:sourceReference('TRAVELER',id)}));
    }else{
     evidence.push(passport.id);
     if(!passport.expiryDate||passport.expiryDate<program.snapshot.returnDate){
      blockers.push(this.block('TRAVELER_DOCUMENT','PASSPORT_EXPIRES_BEFORE_RETURN','صلاحية جواز السفر لا تغطي تاريخ عودة البرنامج.','traveler-management','بيانات المسافرين',program.id,{bookingId:booking.id,travelerId:id,reference:sourceReference('TRAVEL_DOCUMENT',passport.id),evidenceReferences:[passport.id]}));
     }
    }
    result.push({traveler,passport});
   }catch(error){
    blockers.push(this.block('TRAVELER_DOCUMENT','TRAVELER_NOT_ACTIVE',`تعذر اعتماد المسافر: ${messageOf(error)}`,'traveler-management','بيانات المسافرين',program.id,{bookingId:booking.id,travelerId:id,reference:sourceReference('TRAVELER',id)}));
   }
  }
  return result;
 }

 private async supplyBlockers(program:Program,evidence:string[]){
  const blockers:ReadinessBlocker[]=[];
  for(const requirement of program.snapshot.requirements){
   if(requirement==='HEALTH'){
    blockers.push(this.block('PROGRAM','REQUIRED_EVIDENCE_OWNER_MISSING','البرنامج يتطلب دليلًا صحيًا ولا يوجد مالك معتمد لهذا الدليل بعد.','hajj-umrah-programs','إدارة البرنامج',program.id));
    continue;
   }
   const mapping=tciMap(requirement);
   if(!mapping)continue;
   const components=this.components(program,requirement);
   if(!components.length){
    blockers.push(this.block('PROGRAM','REQUIRED_COMPONENT_MISSING',`المتطلب ${requirement} لا يملك مكوّن برنامج معرفًا.`,'hajj-umrah-programs','إدارة البرنامج',program.id));
    continue;
   }
   for(const component of components){
    if(!component.inventoryReference){
     blockers.push(this.block('PROGRAM','SUPPLY_REFERENCE_MISSING',`المكوّن ${component.title} لا يملك مرجع توريد معتمدًا.`,'hajj-umrah-programs','إدارة البرنامج',program.id));
     continue;
    }
    try{
     const supplied=await this.sources.supply({companyId:program.companyId,resourceType:mapping.resourceType,resourceId:component.inventoryReference,serviceDate:component.start??program.snapshot.departureDate,...(component.end?{periodEnd:component.end}:{}),...(mapping.serviceCategory?{serviceCategory:mapping.serviceCategory}:{})});
     if(supplied.contractId)evidence.push(supplied.contractId);
     evidence.push(component.inventoryReference);
     if(!supplied.available)blockers.push(this.block('PROGRAM','SUPPLY_NOT_AVAILABLE',`التوريد المطلوب للمكوّن ${component.title} غير متاح حاليًا.`,'tourism-contract-inventory','التعاقدات والتوريد',program.id,{reference:sourceReference('TOURISM_RESOURCE',component.inventoryReference),evidenceReferences:supplied.contractId?[supplied.contractId]:[]}));
    }catch(error){blockers.push(this.ownerFailure('tourism-contract-inventory',program.id,error))}
   }
  }
  return blockers;
 }

 private financialBlockers(program:Program,bookingId:string|undefined,value:FinancialReadinessEvidence){
  return value.blockers.map(code=>this.block(code.startsWith('APPROVAL_')?'CONTROL':'FINANCIAL',code,'يوجد مانع مالي/رقابي يجب تسويته قبل اعتبار الحالة جاهزة.','tourism-finance-orchestration',code.startsWith('APPROVAL_')?'الرقابة المالية':'المالية',program.id,{...(bookingId?{bookingId}:{}),reference:bookingId?this.bookingRef(bookingId):this.programRef(program.id),evidenceReferences:value.evidenceReferences}));
 }

 private async bookingInternal(c:ExecutionContext,program:Program,booking:Booking,loaded:LoadedEvidence,includeSupply:boolean){
  const blockers:ReadinessBlocker[]=[...loaded.blockers],evidence=[program.id,program.currentVersionId,booking.id],cache=new Map<string,Allocation|null>();
  if(booking.status==='PRELIMINARY')blockers.push(this.block('PROGRAM','BOOKING_NOT_CONFIRMED','الحجز ما زال مبدئيًا ولم يكتمل تأكيده.','hajj-umrah-bookings','الحجوزات',program.id,{bookingId:booking.id,reference:this.bookingRef(booking.id)}));
  if(booking.status==='CANCELLED')blockers.push(this.block('PROGRAM','BOOKING_CANCELLED','الحجز ملغي ولا يمكن اعتباره جاهزًا للسفر.','hajj-umrah-bookings','الحجوزات',program.id,{bookingId:booking.id,reference:this.bookingRef(booking.id)}));
  await this.travelerEvidence(c,program,booking,blockers,evidence);
  if(includeSupply)blockers.push(...await this.supplyBlockers(program,evidence));

  for(const task of loaded.tasks.filter(value=>value.status==='OPEN'&&value.bookingId===booking.id&&value.dueAt<this.now().toISOString())){
   blockers.push(this.block('SERVICE_OPERATION','OVERDUE_TASK','يوجد إجراء تشغيلي متأخر لم يكتمل.','hajj-umrah-trip-operations','التشغيل',program.id,{bookingId:booking.id,...(task.travelerId?{travelerId:task.travelerId}:{}),reference:sourceReference('HAJJ_UMRAH_TASK',task.id),evidenceReferences:[task.id]}));
  }
  for(const incident of loaded.incidents.filter(value=>value.status==='OPEN'&&value.bookingId===booking.id&&['HIGH','CRITICAL'].includes(value.severity))){
   blockers.push(this.block('SERVICE_OPERATION','SERIOUS_INCIDENT_OPEN','يوجد بلاغ تشغيلي مرتفع الخطورة لم يُحل.','hajj-umrah-trip-operations','التشغيل',program.id,{bookingId:booking.id,...(incident.travelerId?{travelerId:incident.travelerId}:{}),reference:sourceReference('HAJJ_UMRAH_INCIDENT',incident.id),evidenceReferences:[incident.id]}));
  }

  if(program.snapshot.requirements.includes('HOTEL')){
   for(const component of this.components(program,'HOTEL')){
    if(!component.inventoryReference)continue;
    for(const travelerId of booking.travelerIds){
     let covered=false;
     for(const assignment of loaded.rooming.filter(value=>value.bookingId===booking.id&&value.travelerId===travelerId&&value.status==='ASSIGNED')){
      if(await this.componentCovered(c.companyId,component,assignment.allocationId,cache)){
       const start=component.start??program.snapshot.departureDate,end=component.end??program.snapshot.returnDate;
       if(assignment.startDate<=start&&assignment.endDate>=end){covered=true;evidence.push(assignment.id);break}
      }
     }
     if(!covered)blockers.push(this.block('ROOMING','ROOMING_REQUIRED','لم يكتمل تسكين المسافر للفترة الفندقية المطلوبة.','hajj-umrah-rooming','التسكين',program.id,{bookingId:booking.id,travelerId,reference:sourceReference('HAJJ_UMRAH_BOOKING',booking.id)}));
    }
   }
  }

  if(program.snapshot.requirements.includes('VISA')){
   for(const component of this.components(program,'VISA')){
    if(!component.inventoryReference)continue;
    for(const travelerId of booking.travelerIds){
     let covered=false;
     for(const visa of loaded.visas.filter(value=>value.bookingId===booking.id&&value.travelerId===travelerId&&value.status==='ISSUED')){
      if(await this.componentCovered(c.companyId,component,visa.allocationId,cache)){covered=true;evidence.push(visa.id);break}
     }
     if(!covered)blockers.push(this.block('VISA','VISA_NOT_ISSUED','التأشيرة المطلوبة للمسافر غير صادرة.','hajj-umrah-visa-operations','التأشيرات',program.id,{bookingId:booking.id,travelerId}));
    }
   }
  }

  if(program.snapshot.requirements.includes('FLIGHT')){
   for(const component of this.components(program,'FLIGHT')){
    if(!component.inventoryReference)continue;
    for(const travelerId of booking.travelerIds){
     const ticket=loaded.tickets.find(value=>value.bookingId===booking.id&&value.travelerId===travelerId&&value.flightBlockId===component.inventoryReference&&['ISSUED','REISSUED'].includes(value.status));
     if(ticket)evidence.push(ticket.id);else blockers.push(this.block('TICKETING','TICKET_NOT_ISSUED','لم تصدر التذكرة المطلوبة للمسافر.','hajj-umrah-ticketing','التذاكر والطيران',program.id,{bookingId:booking.id,travelerId}));
    }
   }
  }

  if(program.snapshot.requirements.includes('TRANSPORT')){
   for(const component of this.components(program,'TRANSPORT')){
    if(!component.inventoryReference)continue;
    for(const travelerId of booking.travelerIds){
     let covered=false;
     for(const row of loaded.transport.filter(value=>value.run.status!=='CANCELLED')){
      const allocation=await this.allocation(c.companyId,row.run.allocationId,cache);
      if(allocation?.resourceId!==component.inventoryReference)continue;
      if(row.manifest.some(value=>value.bookingId===booking.id&&value.travelerId===travelerId&&value.status==='ASSIGNED')){covered=true;evidence.push(row.run.id);break}
     }
     if(!covered)blockers.push(this.block('TRANSPORT','TRANSPORT_ASSIGNMENT_MISSING','المسافر غير مدرج في تفويج النقل المطلوب.','hajj-umrah-transport-operations','النقل والتفويج',program.id,{bookingId:booking.id,travelerId}));
    }
   }
  }

  try{
   const financial=await this.sources.bookingFinancial({companyId:c.companyId,branchId:c.branchId,booking:this.bookingRef(booking.id),program:this.programRef(program.id),requiredCategories:this.financialCategories(program)});
   evidence.push(...financial.evidenceReferences);
   blockers.push(...this.financialBlockers(program,booking.id,financial));
  }catch(error){blockers.push(this.block('FINANCIAL','FINANCIAL_OWNER_UNAVAILABLE',`تعذر تقييم الجاهزية المالية للحجز: ${messageOf(error)}`,'tourism-finance-orchestration','المالية',program.id,{bookingId:booking.id}))}

  return this.result(blockers,evidence);
 }

 private async programInternal(c:ExecutionContext,program:Program,loaded?:LoadedEvidence){
  const source=loaded??await this.loaded(c,program.id),blockers:ReadinessBlocker[]=[...source.blockers],evidence=[program.id,program.currentVersionId];
  blockers.push(...await this.supplyBlockers(program,evidence));
  for(const task of source.tasks.filter(value=>value.status==='OPEN'&&!value.bookingId&&value.dueAt<this.now().toISOString()))blockers.push(this.block('SERVICE_OPERATION','OVERDUE_TASK','يوجد إجراء تشغيلي عام متأخر لم يكتمل.','hajj-umrah-trip-operations','التشغيل',program.id,{reference:sourceReference('HAJJ_UMRAH_TASK',task.id),evidenceReferences:[task.id]}));
  for(const incident of source.incidents.filter(value=>value.status==='OPEN'&&!value.bookingId&&['HIGH','CRITICAL'].includes(value.severity)))blockers.push(this.block('SERVICE_OPERATION','SERIOUS_INCIDENT_OPEN','يوجد بلاغ تشغيلي عام مرتفع الخطورة لم يُحل.','hajj-umrah-trip-operations','التشغيل',program.id,{reference:sourceReference('HAJJ_UMRAH_INCIDENT',incident.id),evidenceReferences:[incident.id]}));

  const bookingResults:Record<string,ReadinessResult>={};
  for(const booking of source.bookings.filter(value=>value.status!=='CANCELLED')){
   const result=await this.bookingInternal(c,program,booking,source,false);
   bookingResults[booking.id]=result;blockers.push(...result.blockers);evidence.push(...result.evidenceReferences);
  }
  try{
   const financial=await this.sources.programFinancial({companyId:c.companyId,branchId:c.branchId,program:this.programRef(program.id),requiredCategories:this.financialCategories(program)});
   evidence.push(...financial.evidenceReferences);blockers.push(...this.financialBlockers(program,undefined,financial));
  }catch(error){blockers.push(this.block('FINANCIAL','FINANCIAL_OWNER_UNAVAILABLE',`تعذر تقييم الجاهزية المالية للبرنامج: ${messageOf(error)}`,'tourism-finance-orchestration','المالية',program.id))}
  return{...this.result(blockers,evidence),bookingResults};
 }

 async bookingReadiness(c:ExecutionContext,bookingId:string){
  await this.permission(c,READINESS_PERMISSIONS.view);
  const booking=await this.sources.booking(c,bookingId),program=await this.sources.program(c,booking.programId),loaded=await this.loaded(c,program.id);
  return this.bookingInternal(c,program,booking,loaded,true);
 }
 async programReadiness(c:ExecutionContext,programId:string){await this.permission(c,READINESS_PERMISSIONS.view);const program=await this.sources.program(c,programId);return this.programInternal(c,program)}

 private async travelerRows(c:ExecutionContext,program:Program,bookings:readonly Booking[]){
  const rows:TravelerEvidence[]=[];
  for(const id of [...new Set(bookings.flatMap(value=>value.travelerIds))]){try{rows.push({traveler:await this.sources.traveler(c,id),passport:await this.sources.passport(c,id)})}catch{/* readiness exposes the blocker; projection never invents a traveler */}}
  return rows;
 }

 async booking360(c:ExecutionContext,bookingId:string){
  await this.permission(c,READINESS_PERMISSIONS.view360);
  const booking=await this.sources.booking(c,bookingId),program=await this.sources.program(c,booking.programId),loaded=await this.loaded(c,program.id);
  const readiness=await this.bookingInternal(c,program,booking,loaded,true);
  const travelers=await this.travelerRows(c,program,[booking]);
  const transport=loaded.transport.filter(row=>row.manifest.some(item=>item.bookingId===booking.id&&item.status==='ASSIGNED'));
  let financial:FinancialReadinessEvidence|undefined;
  try{financial=await this.sources.bookingFinancial({companyId:c.companyId,branchId:c.branchId,booking:this.bookingRef(booking.id),program:this.programRef(program.id),requiredCategories:this.financialCategories(program)})}catch{}
  return{booking,program,travelers,rooming:loaded.rooming.filter(value=>value.bookingId===booking.id),visas:loaded.visas.filter(value=>value.bookingId===booking.id),tickets:loaded.tickets.filter(value=>value.bookingId===booking.id),transport,tasks:loaded.tasks.filter(value=>value.bookingId===booking.id),incidents:loaded.incidents.filter(value=>value.bookingId===booking.id),services:loaded.services.filter(value=>value.bookingId===booking.id),readiness,...(financial?{financialReadiness:financial}:{})};
 }

 async program360(c:ExecutionContext,programId:string){
  await this.permission(c,READINESS_PERMISSIONS.view360);
  const program=await this.sources.program(c,programId),loaded=await this.loaded(c,program.id),readiness=await this.programInternal(c,program,loaded);
  const travelers=await this.travelerRows(c,program,loaded.bookings);
  const statusCounts=Object.fromEntries(['PRELIMINARY','CONFIRMED','READY','TRAVELING','COMPLETED','CANCELLED'].map(status=>[status,loaded.bookings.filter(value=>value.status===status).length]));
  let accounting:unknown;try{accounting=await this.sources.programAccounting({companyId:c.companyId,branchIds:[c.branchId]},program.id)}catch(error){accounting={available:false,reason:messageOf(error)}}
  const closure=await this.closureInternal(c,program,loaded);
  return{program,bookingSummary:{total:loaded.bookings.length,statusCounts},bookings:loaded.bookings,travelers,rooming:loaded.rooming,visas:loaded.visas,tickets:loaded.tickets,transport:loaded.transport,tasks:loaded.tasks,incidents:loaded.incidents,services:loaded.services,readiness,closure,accounting};
 }

 async workQueue(c:ExecutionContext,programId:string){
  await this.permission(c,READINESS_PERMISSIONS.view);
  const program=await this.sources.program(c,programId),loaded=await this.loaded(c,program.id),readiness=await this.programInternal(c,program,loaded),items=new Map<string,WorkQueueItem>();
  const add=(item:WorkQueueItem)=>{if(!items.has(item.key))items.set(item.key,item)};
  for(const blocker of readiness.blockers){
   const key=[blocker.owner,blocker.reference?.sourceType??blocker.code,blocker.reference?.sourceId??blocker.bookingId??'',blocker.travelerId??''].join(':');
   add({key,priority:blocker.category==='FINANCIAL'||blocker.category==='CONTROL'?'HIGH':'NORMAL',category:blocker.category,title:blocker.message,detail:blocker.code,owner:blocker.owner,programId,...(blocker.bookingId?{bookingId:blocker.bookingId}:{}),...(blocker.travelerId?{travelerId:blocker.travelerId}:{}),...(blocker.reference?{reference:blocker.reference}:{})});
  }
  const now=this.now().toISOString();
  for(const task of loaded.tasks.filter(value=>value.status==='OPEN'))add({key:`task:${task.id}`,priority:task.dueAt<now?'HIGH':'NORMAL',category:'SERVICE_OPERATION',title:task.title,detail:task.dueAt<now?'إجراء متأخر':'إجراء مفتوح',owner:'hajj-umrah-trip-operations',programId,...(task.bookingId?{bookingId:task.bookingId}:{}),...(task.travelerId?{travelerId:task.travelerId}:{}),dueAt:task.dueAt,reference:sourceReference('HAJJ_UMRAH_TASK',task.id)});
  for(const incident of loaded.incidents.filter(value=>value.status==='OPEN'))add({key:`incident:${incident.id}`,priority:incident.severity==='CRITICAL'?'CRITICAL':incident.severity==='HIGH'?'HIGH':'NORMAL',category:'SERVICE_OPERATION',title:incident.summary,detail:`بلاغ ${incident.severity}`,owner:'hajj-umrah-trip-operations',programId,...(incident.bookingId?{bookingId:incident.bookingId}:{}),...(incident.travelerId?{travelerId:incident.travelerId}:{}),reference:sourceReference('HAJJ_UMRAH_INCIDENT',incident.id)});
  const rank={CRITICAL:0,HIGH:1,NORMAL:2}as const;
  return[...items.values()].sort((a,b)=>rank[a.priority]-rank[b.priority]||(a.dueAt??'').localeCompare(b.dueAt??'')||a.key.localeCompare(b.key));
 }

 async reports(c:ExecutionContext,programId:string){
  await this.permission(c,READINESS_PERMISSIONS.reports);
  const program=await this.sources.program(c,programId),loaded=await this.loaded(c,program.id),readiness=await this.programInternal(c,program,loaded),travelers=await this.travelerRows(c,program,loaded.bookings);
  let financial:unknown;try{financial=await this.sources.programAccounting({companyId:c.companyId,branchIds:[c.branchId]},program.id)}catch(error){financial={available:false,reason:messageOf(error)}}
  const bookingStatus=Object.fromEntries(['PRELIMINARY','CONFIRMED','READY','TRAVELING','COMPLETED','CANCELLED'].map(status=>[status,loaded.bookings.filter(value=>value.status===status).length]));
  return{generatedAt:this.now().toISOString(),program:{id:program.id,code:program.code,arabicName:program.arabicName,status:program.status},bookingStatus,travelers,rooming:loaded.rooming,visas:loaded.visas,tickets:loaded.tickets,transport:loaded.transport,tasks:loaded.tasks,incidents:loaded.incidents,readiness:{status:readiness.status,blockers:readiness.blockers},financial};
 }

 private async closureInternal(c:ExecutionContext,program:Program,loaded?:LoadedEvidence):Promise<ClosureEvaluation>{
  if(program.status==='CLOSED')return{canClose:true,program,blockers:[],evidenceReferences:[program.id,program.returnRecordedAt??program.updatedAt]};
  const source=loaded??await this.loaded(c,program.id),blockers:ReadinessBlocker[]=[...source.blockers],evidence=[program.id,program.currentVersionId],cache=new Map<string,Allocation|null>();
  if(program.status!=='IN_TRIP'||!program.departureRecordedAt)blockers.push(this.block('PROGRAM','PROGRAM_NOT_IN_TRIP','إغلاق البرنامج يتطلب تسجيل المغادرة أولًا.','hajj-umrah-programs','إدارة البرنامج',program.id,{reference:this.programRef(program.id)}));
  for(const booking of source.bookings.filter(value=>!['COMPLETED','CANCELLED'].includes(value.status)))blockers.push(this.block('PROGRAM','BOOKING_NOT_COMPLETE','يوجد حجز لم يصل إلى مكتمل أو ملغي.','hajj-umrah-bookings','الحجوزات',program.id,{bookingId:booking.id,reference:this.bookingRef(booking.id),evidenceReferences:[booking.id]}));
  for(const task of source.tasks.filter(value=>value.status==='OPEN'))blockers.push(this.block('SERVICE_OPERATION','OPEN_TASK','يوجد إجراء تشغيلي مفتوح يمنع الإغلاق.','hajj-umrah-trip-operations','التشغيل',program.id,{...(task.bookingId?{bookingId:task.bookingId}:{}),...(task.travelerId?{travelerId:task.travelerId}:{}),reference:sourceReference('HAJJ_UMRAH_TASK',task.id),evidenceReferences:[task.id]}));
  for(const incident of source.incidents.filter(value=>value.status==='OPEN'))blockers.push(this.block('SERVICE_OPERATION','OPEN_INCIDENT','يوجد بلاغ تشغيلي مفتوح يمنع الإغلاق.','hajj-umrah-trip-operations','التشغيل',program.id,{...(incident.bookingId?{bookingId:incident.bookingId}:{}),...(incident.travelerId?{travelerId:incident.travelerId}:{}),reference:sourceReference('HAJJ_UMRAH_INCIDENT',incident.id),evidenceReferences:[incident.id]}));

  for(const booking of source.bookings.filter(value=>value.status==='COMPLETED')){
   const current=await this.bookingInternal(c,program,booking,source,false);blockers.push(...current.blockers.filter(value=>!['OVERDUE_TASK','SERIOUS_INCIDENT_OPEN'].includes(value.code)));evidence.push(...current.evidenceReferences);
  }

  for(const requirement of program.snapshot.requirements.filter(value=>serviceRequirements.has(value))){
   const category=requirement as TripServiceCategory;
   for(const component of this.components(program,requirement)){
    if(!component.inventoryReference){blockers.push(this.block('SERVICE_OPERATION','SERVICE_COMPONENT_REFERENCE_MISSING',`الخدمة ${component.title} بلا مرجع تنفيذ معتمد.`,'hajj-umrah-programs','إدارة البرنامج',program.id));continue}
    for(const booking of source.bookings.filter(value=>value.status==='COMPLETED')){
     let executed=false;
     for(const service of source.services.filter(value=>value.bookingId===booking.id&&value.category===category)){
      if(await this.componentCovered(c.companyId,component,service.allocationId,cache)){executed=true;evidence.push(service.id);break}
     }
     if(!executed)blockers.push(this.block('SERVICE_OPERATION','SERVICE_EXECUTION_MISSING',`لم يسجل تنفيذ الخدمة ${component.title} للحجز.`,'hajj-umrah-trip-operations','التشغيل',program.id,{bookingId:booking.id}));
    }
   }
  }

  if(program.snapshot.requirements.includes('TRANSPORT')){
   for(const component of this.components(program,'TRANSPORT')){
    if(!component.inventoryReference)continue;
    for(const booking of source.bookings.filter(value=>value.status==='COMPLETED'))for(const travelerId of booking.travelerIds){
     let complete=false;
     for(const row of source.transport.filter(value=>value.run.status==='COMPLETED')){
      const allocation=await this.allocation(c.companyId,row.run.allocationId,cache);
      if(allocation?.resourceId===component.inventoryReference&&row.manifest.some(value=>value.bookingId===booking.id&&value.travelerId===travelerId&&value.status==='ASSIGNED')){complete=true;evidence.push(row.run.id);break}
     }
     if(!complete)blockers.push(this.block('TRANSPORT','TRANSPORT_NOT_COMPLETED','تفويج النقل المطلوب لم يكتمل للمسافر.','hajj-umrah-transport-operations','النقل والتفويج',program.id,{bookingId:booking.id,travelerId}));
    }
   }
  }

  try{
   const financial=await this.sources.programFinancial({companyId:c.companyId,branchId:c.branchId,program:this.programRef(program.id),requiredCategories:this.financialCategories(program)});
   evidence.push(...financial.evidenceReferences);blockers.push(...this.financialBlockers(program,undefined,financial));
  }catch(error){blockers.push(this.block('FINANCIAL','FINANCIAL_OWNER_UNAVAILABLE',`تعذر تقييم الإغلاق المالي: ${messageOf(error)}`,'tourism-finance-orchestration','المالية',program.id))}
  const clean=this.uniqueBlockers(blockers);
  return{canClose:clean.length===0,program,blockers:clean,evidenceReferences:[...new Set(evidence)].sort()};
 }

 async evaluateClosure(c:ExecutionContext,programId:string){await this.permission(c,READINESS_PERMISSIONS.view);const program=await this.sources.program(c,programId);return this.closureInternal(c,program)}

 private hashEvidence(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex')}
 async closeProgram(c:ExecutionContext,programId:string){
  await this.permission(c,READINESS_PERMISSIONS.close);
  let preview=await this.closureInternal(c,await this.sources.program(c,programId));
  if(!preview.canClose)return{closed:false,program:preview.program,blockers:preview.blockers};
  if(preview.program.status==='CLOSED'){const record=await this.repo.latestForProgram(c.companyId,c.branchId,programId);return{closed:true,idempotent:true,program:preview.program,blockers:[],...(record?{closureEvidenceId:record.id}:{})}}

  const snapshot={programId,programUpdatedAt:preview.program.updatedAt,evidenceReferences:[...preview.evidenceReferences].sort()};
  const at=this.now().toISOString();
  const candidate:ClosureEvidenceRecord={id:this.id(),companyId:c.companyId,branchId:c.branchId,programId,programUpdatedAt:preview.program.updatedAt,commandKey:`HU03:CLOSE:${programId}:${this.id()}`,evidenceHash:this.hashEvidence(snapshot),evidence:snapshot,status:'PREPARED',createdAt:at,updatedAt:at};
  let record=await this.repo.reserve(candidate);
  if(record.status==='COMPLETED'){const program=await this.sources.program(c,programId);return{closed:program.status==='CLOSED',idempotent:true,program,blockers:[],closureEvidenceId:record.id}}
  if(record.evidenceHash!==candidate.evidenceHash){record=await this.repo.save({...record,evidenceHash:candidate.evidenceHash,evidence:snapshot,updatedAt:this.now().toISOString()})}

  preview=await this.closureInternal(c,await this.sources.program(c,programId));
  if(!preview.canClose||preview.program.updatedAt!==record.programUpdatedAt){
   const blockers=preview.program.updatedAt!==record.programUpdatedAt?[...preview.blockers,this.block('PROGRAM','CONCURRENT_PROGRAM_CHANGE','تغير البرنامج أثناء فحص الإغلاق؛ يجب إعادة التقييم.','hajj-umrah-programs','إدارة البرنامج',programId,{reference:this.programRef(programId)})]:preview.blockers;
   return{closed:false,program:preview.program,blockers:this.uniqueBlockers(blockers),closureEvidenceId:record.id};
  }

  if(record.status==='PREPARED'){
   const financial=await this.sources.closeFinancial({companyId:c.companyId,branchId:c.branchId,commandKey:record.commandKey,program:this.programRef(programId),operationalEvidence:JSON.stringify(record.evidence)});
   if(!(financial as{closed?:boolean}|null)?.closed)throw new ContractValidationError('closure','financial orchestration did not confirm closure');
   record=await this.repo.save({...record,status:'FINANCE_CONFIRMED',financialEvidence:financial,updatedAt:this.now().toISOString()});
  }

  preview=await this.closureInternal(c,await this.sources.program(c,programId));
  if(!preview.canClose||preview.program.updatedAt!==record.programUpdatedAt){
   const blockers=preview.program.updatedAt!==record.programUpdatedAt?[...preview.blockers,this.block('PROGRAM','CONCURRENT_PROGRAM_CHANGE','تغير البرنامج أثناء تنفيذ الإغلاق؛ لم يتم تغيير حالة البرنامج.','hajj-umrah-programs','إدارة البرنامج',programId,{reference:this.programRef(programId)})]:preview.blockers;
   return{closed:false,program:preview.program,blockers:this.uniqueBlockers(blockers),closureEvidenceId:record.id};
  }
  const finalSnapshot={programId,programUpdatedAt:record.programUpdatedAt,evidenceReferences:[...preview.evidenceReferences].sort()};
  if(record.evidenceHash!==this.hashEvidence(finalSnapshot))record=await this.repo.save({...record,evidenceHash:this.hashEvidence(finalSnapshot),evidence:finalSnapshot,updatedAt:this.now().toISOString()});
  const program=await this.sources.closeProgramOwner(c,programId,record.programUpdatedAt);
  record=await this.repo.save({...record,status:'COMPLETED',updatedAt:this.now().toISOString(),completedAt:this.now().toISOString()});
  await this.access.auditOnce(c,record.commandKey,'hajj-umrah.program.closed-after-readiness',programId,{closureEvidenceId:record.id,financialEvidence:record.financialEvidence??null});
  return{closed:true,idempotent:false,program,blockers:[],closureEvidenceId:record.id};
 }
}
