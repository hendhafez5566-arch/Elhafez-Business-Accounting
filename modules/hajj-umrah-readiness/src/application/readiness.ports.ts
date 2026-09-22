import type{ExecutionContext,SourceReference}from'@elhafez/contracts';
import type{Program}from'@elhafez/hajj-umrah-programs';
import type{Booking}from'@elhafez/hajj-umrah-bookings';
import type{Traveler,TravelDocument}from'@elhafez/traveler-management';
import type{RoomAssignment}from'@elhafez/hajj-umrah-rooming';
import type{VisaCase}from'@elhafez/hajj-umrah-visa-operations';
import type{TicketRecord}from'@elhafez/hajj-umrah-ticketing';
import type{ManifestAssignment,TransportRun}from'@elhafez/hajj-umrah-transport-operations';
import type{Incident,OperationTask,ServiceExecution}from'@elhafez/hajj-umrah-trip-operations';
import type{Allocation,ProgramSupplyEvidence,ProgramSupplyEvidenceInput}from'@elhafez/tourism-contract-inventory';
import type{ServiceCategory as FinancialServiceCategory}from'@elhafez/tourism-finance-orchestration';

export interface FinancialReadinessEvidence{
 readonly ready:boolean;
 readonly blockers:readonly string[];
 readonly warnings:readonly string[];
 readonly evidenceReferences:readonly string[];
}
export interface ReadinessAccess{
 requireBranch(context:ExecutionContext):Promise<void>;
 requirePermission(context:ExecutionContext,permission:string):Promise<void>;
 auditOnce(context:ExecutionContext,key:string,action:string,id:string,metadata?:Record<string,unknown>):Promise<void>;
}
export interface ReadinessSources{
 program(context:ExecutionContext,id:string):Promise<Program>;
 programs(context:ExecutionContext):Promise<Program[]>;
 closeProgramOwner(context:ExecutionContext,id:string,expectedUpdatedAt:string):Promise<Program>;
 booking(context:ExecutionContext,id:string):Promise<Booking>;
 bookings(context:ExecutionContext,programId:string):Promise<Booking[]>;
 traveler(context:ExecutionContext,id:string):Promise<Traveler>;
 passport(context:ExecutionContext,id:string):Promise<TravelDocument|null>;
 rooming(context:ExecutionContext,programId:string):Promise<RoomAssignment[]>;
 visas(context:ExecutionContext,programId:string):Promise<VisaCase[]>;
 tickets(context:ExecutionContext,programId:string):Promise<TicketRecord[]>;
 transportRuns(context:ExecutionContext,programId:string):Promise<TransportRun[]>;
 manifest(context:ExecutionContext,runId:string):Promise<ManifestAssignment[]>;
 tasks(context:ExecutionContext,programId:string):Promise<OperationTask[]>;
 incidents(context:ExecutionContext,programId:string):Promise<Incident[]>;
 services(context:ExecutionContext,programId:string):Promise<ServiceExecution[]>;
 allocation(companyId:string,id:string):Promise<Allocation|null>;
 supply(input:ProgramSupplyEvidenceInput):Promise<ProgramSupplyEvidence>;
 bookingFinancial(input:{companyId:string;branchId:string;booking:SourceReference;program:SourceReference;requiredCategories:readonly FinancialServiceCategory[]}):Promise<FinancialReadinessEvidence>;
 programFinancial(input:{companyId:string;branchId:string;program:SourceReference;requiredCategories:readonly FinancialServiceCategory[]}):Promise<FinancialReadinessEvidence>;
 closeFinancial(input:{companyId:string;branchId:string;commandKey:string;program:SourceReference;operationalEvidence:string}):Promise<unknown>;
 programAccounting(input:{companyId:string;branchIds:readonly string[]},programId:string):Promise<unknown>;
}
