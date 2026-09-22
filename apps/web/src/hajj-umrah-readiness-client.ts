import{crmRequest}from'./crm-core-client.js';
import type{Program}from'./hajj-umrah-client.js';
import type{Booking,RoomAssignment,VisaCase,TicketRecord,TransportRun,ManifestAssignment,OperationTask,Incident,ServiceExecution}from'./hajj-umrah-operations-client.js';

export type ReadinessStatus='READY'|'NOT_READY';
export type ReadinessBlockerCategory='TRAVELER_DOCUMENT'|'ROOMING'|'VISA'|'TICKETING'|'TRANSPORT'|'SERVICE_OPERATION'|'FINANCIAL'|'CONTROL'|'PROGRAM';
export interface ReadinessBlocker{
 readonly category:ReadinessBlockerCategory;readonly code:string;readonly message:string;readonly owner:string;readonly responsibility:string;
 readonly programId:string;readonly bookingId?:string;readonly travelerId?:string;readonly evidenceReferences:readonly string[];
}
export interface ReadinessResult{readonly status:ReadinessStatus;readonly blockers:readonly ReadinessBlocker[];readonly evidenceReferences:readonly string[];}
export interface FinancialReadiness{readonly ready:boolean;readonly blockers:readonly string[];readonly warnings:readonly string[];readonly evidenceReferences:readonly string[];}
export interface TravelerProjection{readonly traveler:{readonly id:string;readonly fullName:string;readonly nationality:string|null;readonly status:string};readonly passport:{readonly id:string;readonly documentNumber:string;readonly expiryDate:string|null}|null;}
export interface RunProjection{readonly run:TransportRun;readonly manifest:readonly ManifestAssignment[];}
export interface Booking360{
 readonly booking:Booking;readonly program:Program;readonly travelers:readonly TravelerProjection[];readonly supplyCoverage:readonly SupplyCoverageItem[];readonly rooming:readonly RoomAssignment[];readonly visas:readonly VisaCase[];readonly tickets:readonly TicketRecord[];
 readonly transport:readonly RunProjection[];readonly tasks:readonly OperationTask[];readonly incidents:readonly Incident[];readonly services:readonly ServiceExecution[];readonly readiness:ReadinessResult;readonly financialReadiness?:FinancialReadiness;
}
export interface ClosureEvaluation{readonly canClose:boolean;readonly program:Program;readonly blockers:readonly ReadinessBlocker[];readonly evidenceReferences:readonly string[];}
export interface Program360{
 readonly program:Program;readonly bookingSummary:{readonly total:number;readonly statusCounts:Readonly<Record<string,number>>};readonly bookings:readonly Booking[];readonly travelers:readonly TravelerProjection[];readonly supplyCoverage:readonly SupplyCoverageItem[];
 readonly rooming:readonly RoomAssignment[];readonly visas:readonly VisaCase[];readonly tickets:readonly TicketRecord[];readonly transport:readonly RunProjection[];readonly tasks:readonly OperationTask[];readonly incidents:readonly Incident[];
 readonly services:readonly ServiceExecution[];readonly readiness:ReadinessResult&{readonly bookingResults:Readonly<Record<string,ReadinessResult>>};readonly closure:ClosureEvaluation;readonly accounting:unknown;
}
export interface WorkQueueItem{readonly key:string;readonly priority:'CRITICAL'|'HIGH'|'NORMAL';readonly category:ReadinessBlockerCategory;readonly title:string;readonly detail:string;readonly owner:string;readonly programId:string;readonly bookingId?:string;readonly travelerId?:string;readonly dueAt?:string;}
export interface SupplyCoverageItem{readonly requirement:string;readonly componentTitle:string;readonly status:'ALLOCATED'|'AVAILABLE'|'BLOCKED'|'MISSING_COMPONENT'|'MISSING_REFERENCE'|'OWNER_UNAVAILABLE';readonly resourceReference?:string;readonly evidenceReferences:readonly string[];readonly detail?:string;}
export interface ReadinessCapabilities{readonly view:boolean;readonly view360:boolean;readonly reports:boolean;readonly close:boolean;}
export interface HajjUmrahReportBundle{
 readonly generatedAt:string;readonly program:{readonly id:string;readonly code:string;readonly arabicName:string;readonly status:string};readonly bookingStatus:Readonly<Record<string,number>>;readonly bookings:readonly {readonly id:string;readonly code:string;readonly status:string}[];
 readonly travelers:readonly TravelerProjection[];readonly rooming:readonly RoomAssignment[];readonly visas:readonly VisaCase[];readonly tickets:readonly TicketRecord[];readonly transport:readonly RunProjection[];
 readonly tasks:readonly OperationTask[];readonly incidents:readonly Incident[];readonly readiness:{readonly status:ReadinessStatus;readonly blockers:readonly ReadinessBlocker[]};readonly financial:unknown;
}
export interface CloseProgramResult{readonly closed:boolean;readonly idempotent?:boolean;readonly program:Program;readonly blockers:readonly ReadinessBlocker[];readonly closureEvidenceId?:string;}

export interface HajjUmrahReadinessApi{
 capabilities():Promise<ReadinessCapabilities>;
 bookingReadiness(id:string):Promise<ReadinessResult>;
 programReadiness(id:string):Promise<ReadinessResult&{readonly bookingResults:Readonly<Record<string,ReadinessResult>>}>;
 booking360(id:string):Promise<Booking360>;
 program360(id:string):Promise<Program360>;
 workQueue(id:string):Promise<WorkQueueItem[]>;
 reports(id:string):Promise<HajjUmrahReportBundle>;
 closure(id:string):Promise<ClosureEvaluation>;
 closeProgram(id:string):Promise<CloseProgramResult>;
}
export type ReadinessRequest=<T>(path:string,init?:RequestInit)=>Promise<T>;
export function createHajjUmrahReadinessApi(request:ReadinessRequest=crmRequest):HajjUmrahReadinessApi{
 const base='/hajj-umrah/readiness',enc=encodeURIComponent,get=<T>(path:string)=>request<T>(base+path),post=<T>(path:string)=>request<T>(base+path,{method:'POST',body:'{}'});
 return{
  capabilities:()=>get('/capabilities'),
  bookingReadiness:(id)=>get(`/booking/${enc(id)}`),
  programReadiness:(id)=>get(`/program/${enc(id)}`),
  booking360:(id)=>get(`/booking/${enc(id)}/360`),
  program360:(id)=>get(`/program/${enc(id)}/360`),
  workQueue:(id)=>get(`/program/${enc(id)}/work-queue`),
  reports:(id)=>get(`/program/${enc(id)}/reports`),
  closure:(id)=>get(`/program/${enc(id)}/closure`),
  closeProgram:(id)=>post(`/program/${enc(id)}/closure`),
 };
}
export const hajjUmrahReadinessApi=createHajjUmrahReadinessApi();
export const emptyReadinessCapabilities:ReadinessCapabilities={view:false,view360:false,reports:false,close:false};
