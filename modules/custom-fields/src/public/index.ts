export{CustomFieldsApplicationService,CUSTOM_FIELDS_PERMISSIONS}from'../application/custom-fields.application-service.js';
export type{CustomFieldsContext,CreateCustomFieldDefinitionInput,UpdateCustomFieldDefinitionInput}from'../application/custom-fields.application-service.js';
export{InMemoryCustomFieldsRepository}from'../infrastructure/in-memory-custom-fields.repository.js';
export{PrismaCustomFieldsRepository}from'../infrastructure/prisma-custom-fields.repository.js';
export type{CustomFieldDefinition,CustomFieldScalar,CustomFieldType,CustomFieldValue}from'../domain/custom-fields.js';
