import type{ExecutionContext}from'@elhafez/contracts';
export interface TourismProgramAccess{requireBranch(context:ExecutionContext):Promise<void>;requirePermission(context:ExecutionContext,permission:string):Promise<void>;audit(context:ExecutionContext,action:string,id:string,metadata?:Record<string,unknown>):Promise<void>}
export const TOURISM_PROGRAM_ACCESS=Symbol('TOURISM_PROGRAM_ACCESS');
