import type{CompanyId}from'@elhafez/contracts';
export interface TourismProgramCancellationBlocker{type:string;reference:string;detail?:string}
export interface TourismProgramFinancePort{
 cancel(input:{companyId:CompanyId;branchId:string;commandKey:string;programId:string;travelStarted:boolean;travelEvidence:string;postingDate:string}):Promise<{cancelled:boolean;blockers:readonly TourismProgramCancellationBlocker[]}>
}
export const TOURISM_PROGRAM_FINANCE=Symbol('TOURISM_PROGRAM_FINANCE');
