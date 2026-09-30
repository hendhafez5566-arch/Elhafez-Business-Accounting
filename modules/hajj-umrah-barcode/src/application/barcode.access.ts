import type{ExecutionContext}from'@elhafez/contracts';
export const BARCODE_ACCESS=Symbol('BARCODE_ACCESS');export interface BarcodeAccess{requireBranch(context:ExecutionContext):Promise<void>;requirePermission(context:ExecutionContext,permission:string):Promise<void>;audit(context:ExecutionContext,action:string,id:string,metadata?:Record<string,unknown>):Promise<void>;}
export const BARCODE_VISA=Symbol('BARCODE_VISA');export interface BarcodeVisaPort{issued(context:ExecutionContext,programId:string,visaCaseId:string):Promise<{travelerId:string}>;}
