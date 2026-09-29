import { randomUUID } from 'node:crypto';
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
