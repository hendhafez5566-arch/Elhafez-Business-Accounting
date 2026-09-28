import type{CompanyId,ExecutionContext}from'@elhafez/contracts';export const DOCUMENT_ACCESS=Symbol('DOCUMENT_ACCESS'),DOCUMENT_FILES=Symbol('DOCUMENT_FILES');
export interface DocumentAccess{requirePermission(c:ExecutionContext,p:string):Promise<void>;audit(c:ExecutionContext,action:string,entityId:string,metadata?:Record<string,unknown>):Promise<void>}
export interface DocumentFilePort{requireFile(companyId:CompanyId,fileId:string):Promise<void>}
