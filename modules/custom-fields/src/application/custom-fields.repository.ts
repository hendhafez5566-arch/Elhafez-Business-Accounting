import type{CustomFieldDefinition,CustomFieldScalar,CustomFieldValue}from'../domain/custom-fields.js';
export interface CreateCustomFieldDefinitionRecord{
 readonly id:string;readonly companyId:string;readonly entityType:string;readonly key:string;readonly label:string;readonly fieldType:CustomFieldDefinition['fieldType'];
 readonly required:boolean;readonly options:readonly string[];readonly active:boolean;readonly createdAt:string;readonly updatedAt:string;
}
export interface UpdateCustomFieldDefinitionRecord{
 readonly label:string;readonly required:boolean;readonly options:readonly string[];readonly active:boolean;readonly updatedAt:string;
}
export interface CustomFieldsRepository{
 createDefinition(input:CreateCustomFieldDefinitionRecord):Promise<CustomFieldDefinition>;
 updateDefinition(companyId:string,id:string,input:UpdateCustomFieldDefinitionRecord):Promise<CustomFieldDefinition>;
 findDefinition(companyId:string,id:string):Promise<CustomFieldDefinition|undefined>;
 listDefinitions(companyId:string,entityType?:string):Promise<readonly CustomFieldDefinition[]>;
 hasValues(companyId:string,definitionId:string):Promise<boolean>;
 upsertValue(input:{id:string;companyId:string;definitionId:string;entityType:string;entityId:string;value:CustomFieldScalar;updatedBy:string;updatedAt:string}):Promise<CustomFieldValue>;
 deleteValue(companyId:string,definitionId:string,entityId:string):Promise<void>;
 listValues(companyId:string,entityType:string,entityId:string):Promise<readonly CustomFieldValue[]>;
}
export const CUSTOM_FIELDS_REPOSITORY=Symbol('CUSTOM_FIELDS_REPOSITORY');
