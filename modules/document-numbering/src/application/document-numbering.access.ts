export interface DocumentNumberingAccess{
 requirePermission(context:{companyId:string;actorId:string},permission:string):Promise<void>;
 auditOnce(context:{companyId:string;actorId:string},key:string,action:string,entityId:string|null,metadata?:Record<string,unknown>):Promise<void>;
}
export const DOCUMENT_NUMBERING_ACCESS=Symbol('DOCUMENT_NUMBERING_ACCESS');
