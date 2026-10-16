import { createHash,randomUUID } from 'node:crypto';
import { PlatformError, type StoredFile, type StoredFileContent } from '../domain/platform.types.js';
import type { PlatformCoreApplicationService } from './platform-core.application-service.js';
import type { EntityFileLinkRecord, EntityFileLinksRepository } from './entity-file-links.repository.js';

export interface EntityFileLink {
  readonly id:string;
  readonly companyId:string;
  readonly entityType:string;
  readonly entityId:string;
  readonly fileId:string;
  readonly label:string|null;
  readonly createdBy:string|null;
  readonly createdAt:Date;
  readonly file:StoredFile;
}

export class EntityFileLinksApplicationService {
  constructor(private readonly repository:EntityFileLinksRepository,private readonly files:Pick<PlatformCoreApplicationService,'uploadFile'|'getFile'|'retireFile'>){}
  private required(value:string,field:string){const result=value.trim();if(!result)throw new PlatformError('VALIDATION_ERROR',`${field} is required`,{field});return result;}

  async attach(input:{companyId:string;entityType:string;entityId:string;createdBy:string;label?:string;contentType:string;content:Uint8Array}):Promise<EntityFileLink>{
    const companyId=this.required(input.companyId,'companyId'),entityType=this.required(input.entityType,'entityType'),entityId=this.required(input.entityId,'entityId'),contentType=this.required(input.contentType,'contentType');
    const file=await this.files.uploadFile({companyId,createdBy:this.required(input.createdBy,'createdBy'),contentType,content:input.content});
    const record:EntityFileLinkRecord={id:randomUUID(),companyId,entityType,entityId,fileId:file.id,label:input.label?.trim()||null,createdBy:input.createdBy,createdAt:new Date()};
    try{await this.repository.save(record);return{...record,file};}
    catch(error){await this.files.retireFile(companyId,file.id).catch(()=>undefined);throw error;}
  }

  /** Link the retained upload receipt once; retries never retire a successfully stored file. */
  async attachExistingOnce(input:{companyId:string;entityType:string;entityId:string;createdBy:string;fileId:string;label?:string}):Promise<EntityFileLink>{
    const companyId=this.required(input.companyId,'companyId'),entityType=this.required(input.entityType,'entityType'),entityId=this.required(input.entityId,'entityId'),file=await this.files.getFile(companyId,this.required(input.fileId,'fileId'));
    if(file.createdBy!==input.createdBy)throw new PlatformError('FORBIDDEN','upload receipt belongs to another actor');
    const label=input.label?.trim()||null,hex=createHash('sha256').update(JSON.stringify([companyId,entityType,entityId,file.id])).digest('hex'),id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-8'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32),record:EntityFileLinkRecord={id,companyId,entityType,entityId,fileId:file.id,label,createdBy:input.createdBy,createdAt:new Date()};
    const verify=(prior:EntityFileLinkRecord)=>{if(prior.createdBy!==input.createdBy||prior.label!==label)throw new PlatformError('CONFLICT','file link identity has different immutable metadata');return{...prior,file};};
    const prior=await this.repository.find(companyId,entityType,entityId,file.id);if(prior)return verify(prior);
    try{await this.repository.save(record);return{...record,file};}catch(error){const current=await this.repository.find(companyId,entityType,entityId,file.id);if(current)return verify(current);throw error;}
  }

  async list(companyId:string,entityType:string,entityId:string):Promise<EntityFileLink[]>{
    const records=await this.repository.list(this.required(companyId,'companyId'),this.required(entityType,'entityType'),this.required(entityId,'entityId'));
    return Promise.all(records.map(async record=>({...record,file:await this.files.getFile(record.companyId,record.fileId)})));
  }

  async content(companyId:string,entityType:string,entityId:string,fileId:string):Promise<StoredFileContent>{
    const record=await this.requireLink(companyId,entityType,entityId,fileId);
    return this.files.getFile(record.companyId,record.fileId,true);
  }

  async detach(companyId:string,entityType:string,entityId:string,fileId:string):Promise<void>{
    const record=await this.requireLink(companyId,entityType,entityId,fileId);
    // pc_entity_file_links.file_id is ON DELETE CASCADE, so Platform Core file
    // retirement is the single operation that owns both physical and metadata cleanup.
    await this.files.retireFile(record.companyId,record.fileId);
  }

  private async requireLink(companyId:string,entityType:string,entityId:string,fileId:string):Promise<EntityFileLinkRecord>{
    const record=await this.repository.find(this.required(companyId,'companyId'),this.required(entityType,'entityType'),this.required(entityId,'entityId'),this.required(fileId,'fileId'));
    if(!record)throw new PlatformError('NOT_FOUND','entity file link was not found');return record;
  }
}
