import type{ExecutionContext}from'@elhafez/contracts';
export interface ProcurementAccess{
 requireBranch(c:ExecutionContext):Promise<void>;
 requirePermission(c:ExecutionContext,p:string):Promise<void>;
 audit(c:ExecutionContext,action:string,resource:string,entityId:string|null,metadata?:Record<string,unknown>,idempotencyKey?:string):Promise<void>;
}
export const PROCUREMENT_ACCESS=Symbol('PROCUREMENT_ACCESS');
