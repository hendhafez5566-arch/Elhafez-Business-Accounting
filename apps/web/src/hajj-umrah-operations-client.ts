import { crmRequest } from './crm-core-client.js';

export type BookingStatus='PRELIMINARY'|'CONFIRMED'|'READY'|'TRAVELING'|'COMPLETED'|'CANCELLED';
export type BookingFinancialState='UNCONFIRMED'|'CONFIRMED'|'CANCELLATION_BLOCKED'|'CANCELLED';
export interface Booking{readonly id:string;readonly code:string;readonly programId:string;readonly customerId:string;readonly agentId?:string;readonly travelerIds:readonly string[];readonly status:BookingStatus;readonly financialState:BookingFinancialState;readonly allocationIds:readonly string[];readonly createdAt:string;readonly updatedAt:string;}
export interface CreateBookingInput{readonly code:string;readonly programId:string;readonly customerId:string;readonly agentId?:string;readonly travelerIds:readonly string[];}
export interface BookingInventoryRequest{readonly allocationId:string;readonly contractId:string;readonly resourceType:string;readonly resourceId:string;readonly serviceDate:string;readonly periodEnd?:string;readonly quantity:string;readonly flightSegmentReference?:{sourceType:string;sourceId:string};readonly visaBatchReference?:{sourceType:string;sourceId:string};}
export interface ConfirmBookingInput{readonly commandKey:string;readonly category:'HOTEL'|'FLIGHT'|'TRANSPORT'|'VISA'|'OTHER';readonly costCenterId:string;readonly currency:string;readonly grossAmount:string;readonly discountAmount:string;readonly approvalRequestId?:string;readonly postingDate:string;readonly dueDate:string;readonly invoiceNumber:string;readonly inventories:readonly BookingInventoryRequest[];readonly commissionAmount?:string;}
export interface CancelBookingInput{readonly commandKey:string;readonly postingDate:string;readonly reason:string;}

export interface RoomAssignment{readonly id:string;readonly programId:string;readonly bookingId:string;readonly travelerId:string;readonly allocationId:string;readonly roomKey:string;readonly roomLabel?:string;readonly startDate:string;readonly endDate:string;readonly status:'ASSIGNED'|'UNASSIGNED';}
export interface AssignRoomInput{readonly bookingId:string;readonly travelerId:string;readonly allocationId:string;readonly roomKey:string;readonly roomLabel?:string;readonly startDate:string;readonly endDate:string;}

export type VisaStatus='PREPARING'|'SUBMITTED'|'ISSUED'|'REJECTED'|'CANCELLED';
export interface VisaCase{readonly id:string;readonly bookingId:string;readonly programId:string;readonly travelerId:string;readonly passportDocumentId:string;readonly allocationId:string;readonly status:VisaStatus;readonly attempt:number;readonly applicationReference?:string;readonly visaNumber?:string;readonly rejectionReason?:string;}
export interface CreateVisaInput{readonly bookingId:string;readonly travelerId:string;readonly allocationId:string;}

export type TicketStatus='RESERVED'|'ISSUED'|'REISSUED'|'VOIDED'|'CANCELLED';
export interface TicketRecord{readonly id:string;readonly bookingId:string;readonly programId:string;readonly travelerId:string;readonly flightBlockId:string;readonly flightSegmentReference:{sourceType:string;sourceId:string};readonly pnr:string;readonly ticketNumber?:string;readonly seat?:string;readonly baggage?:string;readonly fareClass?:string;readonly status:TicketStatus;readonly revision:number;}
export interface ReserveTicketInput{readonly bookingId:string;readonly travelerId:string;readonly allocationId:string;readonly pnr:string;readonly seat?:string;readonly baggage?:string;readonly fareClass?:string;}
export interface TicketIssueInput{readonly commandKey:string;readonly ticketNumber:string;readonly amount:string;readonly postingDate:string;readonly pnr?:string;readonly seat?:string;readonly baggage?:string;readonly fareClass?:string;}

export type TransportRunStatus='SCHEDULED'|'DISPATCHED'|'COMPLETED'|'CANCELLED';
export interface TransportRun{readonly id:string;readonly programId:string;readonly allocationId:string;readonly code:string;readonly route:string;readonly startsAt:string;readonly endsAt:string;readonly vehicleReference?:string;readonly driverReference?:string;readonly status:TransportRunStatus;}
export interface ManifestAssignment{readonly id:string;readonly runId:string;readonly bookingId:string;readonly travelerId:string;readonly status:'ASSIGNED'|'REMOVED';}
export interface CreateTransportRunInput{readonly programId:string;readonly allocationId:string;readonly code:string;readonly route:string;readonly startsAt:string;readonly endsAt:string;readonly vehicleReference?:string;readonly driverReference?:string;}

export type TaskStatus='OPEN'|'COMPLETED'|'CANCELLED';
export interface OperationTask{readonly id:string;readonly programId:string;readonly bookingId?:string;readonly travelerId?:string;readonly title:string;readonly assignedTo?:string;readonly dueAt:string;readonly status:TaskStatus;}
export interface CreateTaskInput{readonly programId:string;readonly bookingId?:string;readonly travelerId?:string;readonly title:string;readonly assignedTo?:string;readonly dueAt:string;}
export type IncidentStatus='OPEN'|'RESOLVED'|'CANCELLED';
export interface Incident{readonly id:string;readonly programId:string;readonly bookingId?:string;readonly travelerId?:string;readonly severity:'LOW'|'MEDIUM'|'HIGH'|'CRITICAL';readonly summary:string;readonly details?:string;readonly status:IncidentStatus;}
export interface CreateIncidentInput{readonly programId:string;readonly bookingId?:string;readonly travelerId?:string;readonly severity:Incident['severity'];readonly summary:string;readonly details?:string;}
export type ServiceCategory='CAMP'|'MEAL'|'VISIT'|'GUIDE'|'RAWDA'|'INSURANCE';
export interface ServiceExecution{readonly id:string;readonly programId:string;readonly bookingId:string;readonly travelerId?:string;readonly allocationId:string;readonly category:ServiceCategory;readonly executedAt:string;readonly notes?:string;}
export interface RecordServiceInput{readonly programId:string;readonly bookingId:string;readonly travelerId?:string;readonly allocationId:string;readonly category:ServiceCategory;readonly executedAt:string;readonly evidenceReference?:{sourceType:string;sourceId:string};readonly notes?:string;}

export interface OperationsCapabilities{
 readonly bookingView:boolean;readonly bookingManage:boolean;readonly bookingConfirm:boolean;readonly bookingLifecycle:boolean;readonly bookingCancel:boolean;
 readonly roomingView:boolean;readonly roomingManage:boolean;
 readonly visaView:boolean;readonly visaManage:boolean;readonly visaIssue:boolean;
 readonly ticketView:boolean;readonly ticketManage:boolean;readonly ticketIssue:boolean;
 readonly transportView:boolean;readonly transportManage:boolean;readonly transportDispatch:boolean;
 readonly tripView:boolean;readonly tripManage:boolean;
}

const base='/hajj-umrah/operations', enc=encodeURIComponent;
const get=<T>(path:string)=>crmRequest<T>(`${base}${path}`);
const post=<T>(path:string,body:unknown={})=>crmRequest<T>(`${base}${path}`,{method:'POST',body:JSON.stringify(body)});
const patch=<T>(path:string,body:unknown)=>crmRequest<T>(`${base}${path}`,{method:'PATCH',body:JSON.stringify(body)});

export interface HajjUmrahOperationsApi{
 capabilities():Promise<OperationsCapabilities>;
 listBookings():Promise<Booking[]>;createBooking(i:CreateBookingInput):Promise<Booking>;confirmBooking(id:string,i:ConfirmBookingInput):Promise<Booking>;cancelBooking(id:string,i:CancelBookingInput):Promise<Booking>;markReady(id:string):Promise<Booking>;startTravel(id:string):Promise<Booking>;completeBooking(id:string):Promise<Booking>;
 listRooming(programId?:string):Promise<RoomAssignment[]>;assignRoom(i:AssignRoomInput):Promise<RoomAssignment>;reassignRoom(id:string,i:Omit<AssignRoomInput,'bookingId'|'travelerId'>):Promise<RoomAssignment>;unassignRoom(id:string):Promise<RoomAssignment>;swapRooms(leftId:string,rightId:string):Promise<readonly RoomAssignment[]>;
 listVisas(programId?:string):Promise<VisaCase[]>;createVisa(i:CreateVisaInput):Promise<VisaCase>;submitVisa(id:string,applicationReference:string):Promise<VisaCase>;issueVisa(id:string,i:{commandKey:string;visaNumber:string;amount:string;postingDate:string}):Promise<VisaCase>;rejectVisa(id:string,reason:string):Promise<VisaCase>;cancelVisa(id:string,reason:string):Promise<VisaCase>;
 listTickets(programId?:string):Promise<TicketRecord[]>;reserveTicket(i:ReserveTicketInput):Promise<TicketRecord>;issueTicket(id:string,i:TicketIssueInput):Promise<TicketRecord>;reissueTicket(id:string,i:TicketIssueInput):Promise<TicketRecord>;voidTicket(id:string,reason:string):Promise<TicketRecord>;cancelTicket(id:string,reason:string):Promise<TicketRecord>;
 listRuns(programId?:string):Promise<TransportRun[]>;createRun(i:CreateTransportRunInput):Promise<TransportRun>;manifest(id:string):Promise<ManifestAssignment[]>;assignRun(id:string,bookingId:string,travelerId:string):Promise<ManifestAssignment>;removeRunTraveler(id:string,assignmentId:string):Promise<ManifestAssignment>;dispatchRun(id:string):Promise<TransportRun>;completeRun(id:string):Promise<TransportRun>;cancelRun(id:string,reason:string):Promise<TransportRun>;
 listTasks(programId?:string):Promise<OperationTask[]>;createTask(i:CreateTaskInput):Promise<OperationTask>;completeTask(id:string):Promise<OperationTask>;cancelTask(id:string,reason:string):Promise<OperationTask>;dueTasks(date:string):Promise<OperationTask[]>;overdueTasks(at:string):Promise<OperationTask[]>;
 listIncidents(programId?:string):Promise<Incident[]>;createIncident(i:CreateIncidentInput):Promise<Incident>;resolveIncident(id:string,resolution:string):Promise<Incident>;cancelIncident(id:string,reason:string):Promise<Incident>;
 listServices(programId?:string):Promise<ServiceExecution[]>;recordService(i:RecordServiceInput):Promise<ServiceExecution>;
}

const query=(programId?:string)=>programId?`?programId=${enc(programId)}`:'';
export const hajjUmrahOperationsApi:HajjUmrahOperationsApi={
 capabilities:()=>get('/capabilities'),
 listBookings:()=>get('/bookings'),createBooking:(i)=>post('/bookings',i),confirmBooking:(id,i)=>post(`/bookings/${enc(id)}/confirm`,i),cancelBooking:(id,i)=>post(`/bookings/${enc(id)}/cancel`,i),markReady:(id)=>post(`/bookings/${enc(id)}/ready`),startTravel:(id)=>post(`/bookings/${enc(id)}/travel`),completeBooking:(id)=>post(`/bookings/${enc(id)}/complete`),
 listRooming:(p)=>get(`/rooming${query(p)}`),assignRoom:(i)=>post('/rooming',i),reassignRoom:(id,i)=>patch(`/rooming/${enc(id)}`,i),unassignRoom:(id)=>post(`/rooming/${enc(id)}/unassign`),swapRooms:(leftId,rightId)=>post('/rooming/swap',{leftId,rightId}),
 listVisas:(p)=>get(`/visas${query(p)}`),createVisa:(i)=>post('/visas',i),submitVisa:(id,r)=>post(`/visas/${enc(id)}/submit`,{applicationReference:r}),issueVisa:(id,i)=>post(`/visas/${enc(id)}/issue`,i),rejectVisa:(id,r)=>post(`/visas/${enc(id)}/reject`,{reason:r}),cancelVisa:(id,r)=>post(`/visas/${enc(id)}/cancel`,{reason:r}),
 listTickets:(p)=>get(`/tickets${query(p)}`),reserveTicket:(i)=>post('/tickets',i),issueTicket:(id,i)=>post(`/tickets/${enc(id)}/issue`,i),reissueTicket:(id,i)=>post(`/tickets/${enc(id)}/reissue`,i),voidTicket:(id,r)=>post(`/tickets/${enc(id)}/void`,{reason:r}),cancelTicket:(id,r)=>post(`/tickets/${enc(id)}/cancel`,{reason:r}),
 listRuns:(p)=>get(`/transport/runs${query(p)}`),createRun:(i)=>post('/transport/runs',i),manifest:(id)=>get(`/transport/runs/${enc(id)}/manifest`),assignRun:(id,b,t)=>post(`/transport/runs/${enc(id)}/manifest`,{bookingId:b,travelerId:t}),removeRunTraveler:(id,assignmentId)=>post(`/transport/runs/${enc(id)}/manifest/${enc(assignmentId)}/remove`),dispatchRun:(id)=>post(`/transport/runs/${enc(id)}/dispatch`),completeRun:(id)=>post(`/transport/runs/${enc(id)}/complete`),cancelRun:(id,r)=>post(`/transport/runs/${enc(id)}/cancel`,{reason:r}),
 listTasks:(p)=>get(`/trip/tasks${query(p)}`),createTask:(i)=>post('/trip/tasks',i),completeTask:(id)=>post(`/trip/tasks/${enc(id)}/complete`),cancelTask:(id,r)=>post(`/trip/tasks/${enc(id)}/cancel`,{reason:r}),dueTasks:(d)=>get(`/trip/tasks/due?date=${enc(d)}`),overdueTasks:(at)=>get(`/trip/tasks/overdue?at=${enc(at)}`),
 listIncidents:(p)=>get(`/trip/incidents${query(p)}`),createIncident:(i)=>post('/trip/incidents',i),resolveIncident:(id,r)=>post(`/trip/incidents/${enc(id)}/resolve`,{resolution:r}),cancelIncident:(id,r)=>post(`/trip/incidents/${enc(id)}/cancel`,{reason:r}),
 listServices:(p)=>get(`/trip/services${query(p)}`),recordService:(i)=>post('/trip/services',i),
};

export const emptyOperationsCapabilities:OperationsCapabilities={
 bookingView:false,bookingManage:false,bookingConfirm:false,bookingLifecycle:false,bookingCancel:false,
 roomingView:false,roomingManage:false,visaView:false,visaManage:false,visaIssue:false,ticketView:false,ticketManage:false,ticketIssue:false,
 transportView:false,transportManage:false,transportDispatch:false,tripView:false,tripManage:false,
};
