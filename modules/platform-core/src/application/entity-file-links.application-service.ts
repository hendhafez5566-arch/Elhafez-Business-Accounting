import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { PlatformError, type StoredFile, type StoredFileContent } from '../domain/platform.types.js';
import type { PlatformCoreApplicationService } from './platform-core.application-service.js';

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

type LinkRow={id:string;company_id:string;entity_type:string;entity_id:string;file_id:string;label:string|null;created_by:string|null;created_at:Date};

export class EntityFileLinksApplicationService {
  constructor(private readonly prisma:PrismaClient,private readonly files:Pick<PlatformCoreApplicationService,'uploadFile'|'getFile'|'retireFile'>){}
  private required(value:string,field:string){const result=value.trim();if(!result)throw new PlatformError('VALIDATION_ERROR',`${field} is required`,{field});return result;}

  async attach(input:{companyId:string;entityType:string;entityId:string;createdBy:string;label?:string;contentType:string;content:Uint8Array}):Promise<EntityFileLink>{
    const companyId=this.required(input.companyId,'companyId'),entityType=this.required(input.entityType,'entityType'),entityId=this.required(input.entityId,'entityId'),contentType=this.required(input.contentType,'contentType');
    const file=await this.files.uploadFile({companyId,createdBy:this.required(input.createdBy,'createdBy'),contentType,content:input.content});
    const row:LinkRow={id:randomUUID(),company_id:companyId,entity_type:entityType,entity_id:entityId,file_id:file.id,label:input.label?.trim()||null,created_by:input.createdBy,created_at:new Date()};
    try{
      await this.prisma.$executeRaw`INSERT INTO "pc_entity_file_links" ("id","company_id","entity_type","entity_id","file_id","label","created_by","created_at") VALUES (${row.id},${row.company_id},${row.entity_type},${row.entity_id},${row.file_id},${row.label},${row.created_by},${row.created_at})`;
      return{...this.publicRow(row),file};
    }catch(error){await this.files.retireFile(companyId,file.id).catch(()=>undefined);throw error;}
  }

  async list(companyId:string,entityType:string,entityId:string):Promise<EntityFileLink[]>{
    const rows=await this.prisma.$queryRaw<LinkRow[]>`SELECT "id","company_id","entity_type","entity_id","file_id","label","created_by","created_at" FROM "pc_entity_file_links" WHERE "company_id"=${this.required(companyId,'companyId')} AND "entity_type"=${this.required(entityType,'entityType')} AND "entity_id"=${this.required(entityId,'entityId')} ORDER BY "created_at" DESC,"id" DESC`;
    return Promise.all(rows.map(async row=>({...this.publicRow(row),file:await this.files.getFile(row.company_id,row.file_id)})));
  }

  async content(companyId:string,entityType:string,entityId:string,fileId:string):Promise<StoredFileContent>{
    await this.requireLink(companyId,entityType,entityId,fileId);
    return this.files.getFile(companyId,fileId,true);
  }

  async detach(companyId:string,entityType:string,entityId:string,fileId:string):Promise<void>{
    await this.requireLink(companyId,entityType,entityId,fileId);
    // pc_entity_file_links.file_id is ON DELETE CASCADE, so Platform Core file
    // retirement is the single operation that owns both physical and metadata cleanup.
    await this.files.retireFile(companyId,fileId);
  }

  private async requireLink(companyId:string,entityType:string,entityId:string,fileId:string):Promise<LinkRow>{
    const rows=await this.prisma.$queryRaw<LinkRow[]>`SELECT "id","company_id","entity_type","entity_id","file_id","label","created_by","created_at" FROM "pc_entity_file_links" WHERE "company_id"=${this.required(companyId,'companyId')} AND "entity_type"=${this.required(entityType,'entityType')} AND "entity_id"=${this.required(entityId,'entityId')} AND "file_id"=${this.required(fileId,'fileId')} LIMIT 1`;
    const row=rows[0];if(!row)throw new PlatformError('NOT_FOUND','entity file link was not found');return row;
  }
  private publicRow(row:LinkRow){return{id:row.id,companyId:row.company_id,entityType:row.entity_type,entityId:row.entity_id,fileId:row.file_id,label:row.label,createdBy:row.created_by,createdAt:row.created_at};}
}
