export const CUSTOM_FIELD_TYPES=['TEXT','NUMBER','BOOLEAN','DATE','SELECT'] as const;
export type CustomFieldType=typeof CUSTOM_FIELD_TYPES[number];
export type CustomFieldScalar=string|number|boolean;
export interface CustomFieldDefinition{
 readonly id:string;readonly companyId:string;readonly entityType:string;readonly key:string;readonly label:string;
 readonly fieldType:CustomFieldType;readonly required:boolean;readonly options:readonly string[];readonly active:boolean;
 readonly createdAt:string;readonly updatedAt:string;
}
export interface CustomFieldValue{
 readonly id:string;readonly companyId:string;readonly definitionId:string;readonly entityType:string;readonly entityId:string;
 readonly value:CustomFieldScalar;readonly updatedBy:string;readonly updatedAt:string;
}
