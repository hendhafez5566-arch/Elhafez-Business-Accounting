import{randomUUID}from'node:crypto';
import{ContractValidationError}from'@elhafez/contracts';
import type{CustomFieldsAccess}from'./custom-fields.access.js';
import type{CustomFieldsRepository}from'./custom-fields.repository.js';
import{CUSTOM_FIELD_TYPES,type CustomFieldDefinition,type CustomFieldScalar,type CustomFieldType}from'../domain/custom-fields.js';

export const CUSTOM_FIELDS_PERMISSIONS=Object.freeze({read:'platform.custom_fields.read',manage:'platform.custom_fields.manage'} as const);
export interface CustomFieldsContext{readonly companyId:string;readonly actorId:string}
export interface CreateCustomFieldDefinitionInput{readonly entityType:string;readonly key:string;readonly label:string;readonly fieldType:CustomFieldType;readonly required?:boolean;readonly options?:readonly string[]}
export interface UpdateCustomFieldDefinitionInput{readonly label?:string;readonly required?:boolean;readonly options?:readonly string[];readonly active?:boolean}

function required(value:string,field:string){const normalized=value.trim();if(!normalized)throw new ContractValidationError(field,'is required');return normalized;}
function identifier(value:string,field:string){const normalized=required(value,field).normalize('NFKC').toLowerCase();if(!/^[a-z0-9][a-z0-9_.-]{0,63}$/.test(normalized))throw new ContractValidationError(field,'must use 1-64 lowercase letters, numbers, dot, underscore or dash');return normalized;}
function label(value:string){const normalized=required(value,'label');if(normalized.length>120)throw new ContractValidationError('label','must not exceed 120 characters');return normalized;}
function options(fieldType:CustomFieldType,input:readonly string[]|undefined){const normalized=[...new Set((input??[]).map(v=>v.trim()).filter(Boolean))];if(fieldType==='SELECT'&&!normalized.length)throw new ContractValidationError('options','SELECT fields require at least one option');if(fieldType!=='SELECT'&&normalized.length)throw new ContractValidationError('options','options are allowed only for SELECT fields');return normalized;}
function valueFor(definition:CustomFieldDefinition,value:unknown):CustomFieldScalar{
 if(value===null||value===undefined||value===''){throw new ContractValidationError('value',definition.required?'is required':'use clearValue to remove an optional value');}
 switch(definition.fieldType){
  case'TEXT':{if(typeof value!=='string')throw new ContractValidationError('value','must be text');return value;}
  case'NUMBER':{const number=typeof value==='number'?value:Number(value);if(!Number.isFinite(number))throw new ContractValidationError('value','must be a finite number');return number;}
  case'BOOLEAN':{if(typeof value!=='boolean')throw new ContractValidationError('value','must be boolean');return value;}
  case'DATE':{if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z')))throw new ContractValidationError('value','must be an ISO date');return value;}
  case'SELECT':{if(typeof value!=='string'||!definition.options.includes(value))throw new ContractValidationError('value','must be one of the configured options');return value;}
 }
}
export class CustomFieldsApplicationService{
 constructor(private readonly repo:CustomFieldsRepository,private readonly access:CustomFieldsAccess,private readonly now:()=>Date=()=>new Date(),private readonly newId:()=>string=()=>randomUUID()){}
 private async permission(context:CustomFieldsContext,permission:string){if(!context.companyId||!context.actorId)throw new ContractValidationError('context','company and actor are required');await this.access.requirePermission(context,permission);}
 async createDefinition(context:CustomFieldsContext,input:CreateCustomFieldDefinitionInput){
  await this.permission(context,CUSTOM_FIELDS_PERMISSIONS.manage);
  if(!CUSTOM_FIELD_TYPES.includes(input.fieldType))throw new ContractValidationError('fieldType','unsupported custom-field type');
  const now=this.now().toISOString(),definition=await this.repo.createDefinition({id:this.newId(),companyId:context.companyId,entityType:identifier(input.entityType,'entityType'),key:identifier(input.key,'key'),label:label(input.label),fieldType:input.fieldType,required:input.required??false,options:options(input.fieldType,input.options),active:true,createdAt:now,updatedAt:now});
  await this.access.auditOnce(context,'custom-field.definition.created:'+definition.id,'custom-field.definition.created',definition.id,{entityType:definition.entityType,key:definition.key,fieldType:definition.fieldType});
  return definition;
 }
 async updateDefinition(context:CustomFieldsContext,id:string,input:UpdateCustomFieldDefinitionInput){
  await this.permission(context,CUSTOM_FIELDS_PERMISSIONS.manage);
  const current=await this.requireDefinition(context.companyId,id);
  const nextOptions=input.options===undefined?current.options:options(current.fieldType,input.options);
  const updated=await this.repo.updateDefinition(context.companyId,current.id,{label:input.label===undefined?current.label:label(input.label),required:input.required??current.required,options:nextOptions,active:input.active??current.active,updatedAt:this.now().toISOString()});
  await this.access.auditOnce(context,'custom-field.definition.updated:'+updated.id+':'+updated.updatedAt,'custom-field.definition.updated',updated.id,{active:updated.active,required:updated.required});
  return updated;
 }
 async listDefinitions(context:CustomFieldsContext,entityType?:string){await this.permission(context,CUSTOM_FIELDS_PERMISSIONS.read);return this.repo.listDefinitions(context.companyId,entityType?identifier(entityType,'entityType'):undefined);}
 async setValue(context:CustomFieldsContext,definitionId:string,entityId:string,value:unknown){
  await this.permission(context,CUSTOM_FIELDS_PERMISSIONS.manage);
  const definition=await this.requireDefinition(context.companyId,definitionId);if(!definition.active)throw new ContractValidationError('definitionId','custom field is inactive');
  const entity=required(entityId,'entityId'),updatedAt=this.now().toISOString();
  const stored=await this.repo.upsertValue({id:this.newId(),companyId:context.companyId,definitionId:definition.id,entityType:definition.entityType,entityId:entity,value:valueFor(definition,value),updatedBy:context.actorId,updatedAt});
  await this.access.auditOnce(context,'custom-field.value.updated:'+definition.id+':'+entity+':'+updatedAt,'custom-field.value.updated',stored.id,{definitionId:definition.id,entityType:definition.entityType,entityId:entity});
  return stored;
 }
 async clearValue(context:CustomFieldsContext,definitionId:string,entityId:string){
  await this.permission(context,CUSTOM_FIELDS_PERMISSIONS.manage);
  const definition=await this.requireDefinition(context.companyId,definitionId);if(definition.required)throw new ContractValidationError('definitionId','required custom field cannot be cleared');
  const entity=required(entityId,'entityId');await this.repo.deleteValue(context.companyId,definition.id,entity);
  await this.access.auditOnce(context,'custom-field.value.cleared:'+definition.id+':'+entity+':'+this.now().toISOString(),'custom-field.value.cleared',null,{definitionId:definition.id,entityType:definition.entityType,entityId:entity});
 }
 async listEntityValues(context:CustomFieldsContext,entityType:string,entityId:string){await this.permission(context,CUSTOM_FIELDS_PERMISSIONS.read);return this.repo.listValues(context.companyId,identifier(entityType,'entityType'),required(entityId,'entityId'));}
 private async requireDefinition(companyId:string,id:string){return await this.repo.findDefinition(companyId,required(id,'definitionId'))??(()=>{throw new ContractValidationError('definitionId','custom field definition was not found');})();}
}
