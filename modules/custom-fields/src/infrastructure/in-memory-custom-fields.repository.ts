import{ContractValidationError}from'@elhafez/contracts';
import type{CreateCustomFieldDefinitionRecord,CustomFieldsRepository,UpdateCustomFieldDefinitionRecord}from'../application/custom-fields.repository.js';
import type{CustomFieldDefinition,CustomFieldValue}from'../domain/custom-fields.js';
export class InMemoryCustomFieldsRepository implements CustomFieldsRepository{
 private definitions=new Map<string,CustomFieldDefinition>();private values=new Map<string,CustomFieldValue>();
 async createDefinition(input:CreateCustomFieldDefinitionRecord){if([...this.definitions.values()].some(v=>v.companyId===input.companyId&&v.entityType===input.entityType&&v.key===input.key))throw new ContractValidationError('key','custom field key already exists for entity type');const value:CustomFieldDefinition={...input};this.definitions.set(value.id,value);return value;}
 async updateDefinition(companyId:string,id:string,input:UpdateCustomFieldDefinitionRecord){const current=await this.findDefinition(companyId,id);if(!current)throw new ContractValidationError('definitionId','custom field definition was not found');const next:CustomFieldDefinition={...current,...input};this.definitions.set(id,next);return next;}
 async findDefinition(companyId:string,id:string){const value=this.definitions.get(id);return value?.companyId===companyId?value:undefined;}
 async listDefinitions(companyId:string,entityType?:string){return[...this.definitions.values()].filter(v=>v.companyId===companyId&&(!entityType||v.entityType===entityType)).sort((a,b)=>a.entityType.localeCompare(b.entityType)||a.label.localeCompare(b.label));}
 async hasValues(companyId:string,definitionId:string){return[...this.values.values()].some(v=>v.companyId===companyId&&v.definitionId===definitionId);}
 async upsertValue(input:{id:string;companyId:string;definitionId:string;entityType:string;entityId:string;value:CustomFieldValue['value'];updatedBy:string;updatedAt:string}){const existing=[...this.values.values()].find(v=>v.companyId===input.companyId&&v.definitionId===input.definitionId&&v.entityId===input.entityId);const value:CustomFieldValue={...input,id:existing?.id??input.id};this.values.set(value.id,value);return value;}
 async deleteValue(companyId:string,definitionId:string,entityId:string){for(const[id,value]of this.values)if(value.companyId===companyId&&value.definitionId===definitionId&&value.entityId===entityId)this.values.delete(id);}
 async listValues(companyId:string,entityType:string,entityId:string){return[...this.values.values()].filter(v=>v.companyId===companyId&&v.entityType===entityType&&v.entityId===entityId);}
}
