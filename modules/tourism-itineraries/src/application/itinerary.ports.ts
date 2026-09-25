import type{CompanyId,ExecutionContext}from'@elhafez/contracts';import type{TourismProgram}from'@elhafez/tourism-programs';
export interface ItineraryAccess{requireBranch(c:ExecutionContext):Promise<void>;requirePermission(c:ExecutionContext,p:string):Promise<void>;audit(c:ExecutionContext,action:string,id:string,metadata?:Record<string,unknown>):Promise<void>}
export interface ItineraryProgramPort{require(companyId:CompanyId,branchId:string,id:string):Promise<TourismProgram>}
export const ITINERARY_ACCESS=Symbol('ITINERARY_ACCESS'),ITINERARY_PROGRAM_PORT=Symbol('ITINERARY_PROGRAM_PORT');
