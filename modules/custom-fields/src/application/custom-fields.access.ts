export interface CustomFieldsAccess{
 requirePermission(context:{companyId:string;actorId:string},permission:string):Promise<void>;
 auditOnce(context:{companyId:string;actorId:string},key:string,action:string,entityId:string|null,metadata?:Record<string,unknown>):Promise<void>;
}
export const CUSTOM_FIELDS_ACCESS=Symbol('CUSTOM_FIELDS_ACCESS');
