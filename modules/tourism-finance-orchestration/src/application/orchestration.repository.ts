import type { CompanyId, SourceReference } from '@elhafez/contracts';
import type {BookingReference,FinancialSetup,ProgramHistory,ServiceFinancialSnapshot,StandaloneFinancialReference,Workflow,WorkflowStep} from '../domain/orchestration.js';
export const TOURISM_FINANCE_REPOSITORY=Symbol('TOURISM_FINANCE_REPOSITORY');
export interface TourismFinanceRepository {
 reserveStandalone(value:StandaloneFinancialReference):Promise<StandaloneFinancialReference>; standalone(companyId:CompanyId,service:SourceReference):Promise<StandaloneFinancialReference|undefined>; saveStandalone(value:StandaloneFinancialReference):Promise<void>;
 reserveWorkflow(value:Workflow):Promise<Workflow>; workflow(companyId:CompanyId,commandKey:string):Promise<Workflow|undefined>; workflowById(companyId:CompanyId,id:string):Promise<Workflow|undefined>; workflowsForProgram(companyId:CompanyId,program:SourceReference):Promise<Workflow[]>; workflowsForBooking(companyId:CompanyId,booking:SourceReference):Promise<Workflow[]>; saveWorkflow(value:Workflow):Promise<void>;
 step(companyId:CompanyId,workflowId:string,name:string):Promise<WorkflowStep|undefined>; reserveStep(value:WorkflowStep):Promise<WorkflowStep>; completeStep(companyId:CompanyId,id:string,ownerReference:string|undefined,result:unknown):Promise<WorkflowStep>;
 saveSetup(value:FinancialSetup):Promise<void>; setup(companyId:CompanyId,category:string):Promise<FinancialSetup|undefined>;
 reserveBooking(value:BookingReference):Promise<BookingReference>; saveBooking(value:BookingReference):Promise<void>; booking(companyId:CompanyId,source:SourceReference):Promise<BookingReference|undefined>; bookingsForProgram(companyId:CompanyId,program:SourceReference):Promise<BookingReference[]>;
 reserveSnapshot(value:ServiceFinancialSnapshot):Promise<ServiceFinancialSnapshot>; latestSnapshot(companyId:CompanyId,service:SourceReference):Promise<ServiceFinancialSnapshot|undefined>;
 saveProgramHistory(value:ProgramHistory):Promise<void>; programHistory(companyId:CompanyId,program:SourceReference):Promise<ProgramHistory[]>;
}
