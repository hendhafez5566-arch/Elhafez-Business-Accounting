import type{ExecutionContext}from'@elhafez/contracts';
export interface ProcurementSourcingAccess{
 requireBranch(context:ExecutionContext):Promise<void>;
 requirePermission(context:ExecutionContext,permission:string):Promise<void>;
 auditOnce(context:ExecutionContext,key:string,action:string,resource:string,entityId:string|null,metadata?:Record<string,unknown>):Promise<void>;
}
export const PROCUREMENT_SOURCING_ACCESS=Symbol('PROCUREMENT_SOURCING_ACCESS');
