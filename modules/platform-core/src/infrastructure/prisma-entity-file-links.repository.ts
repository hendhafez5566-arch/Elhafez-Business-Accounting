import type {PrismaClient} from '@prisma/client';
import type {EntityFileLinkRecord,EntityFileLinksRepository} from '../application/entity-file-links.repository.js';

type LinkRow={id:string;company_id:string;entity_type:string;entity_id:string;file_id:string;label:string|null;created_by:string|null;created_at:Date};

export class PrismaEntityFileLinksRepository implements EntityFileLinksRepository{
 constructor(private readonly prisma:PrismaClient){}

 async save(record:EntityFileLinkRecord):Promise<void>{
  await this.prisma.$executeRaw`INSERT INTO "pc_entity_file_links" ("id","company_id","entity_type","entity_id","file_id","label","created_by","created_at") VALUES (${record.id},${record.companyId},${record.entityType},${record.entityId},${record.fileId},${record.label},${record.createdBy},${record.createdAt})`;
 }

 async list(companyId:string,entityType:string,entityId:string):Promise<EntityFileLinkRecord[]>{
  const rows=await this.prisma.$queryRaw<LinkRow[]>`SELECT "id","company_id","entity_type","entity_id","file_id","label","created_by","created_at" FROM "pc_entity_file_links" WHERE "company_id"=${companyId} AND "entity_type"=${entityType} AND "entity_id"=${entityId} ORDER BY "created_at" DESC,"id" DESC`;
  return rows.map(publicRow);
 }

 async find(companyId:string,entityType:string,entityId:string,fileId:string):Promise<EntityFileLinkRecord|undefined>{
  const rows=await this.prisma.$queryRaw<LinkRow[]>`SELECT "id","company_id","entity_type","entity_id","file_id","label","created_by","created_at" FROM "pc_entity_file_links" WHERE "company_id"=${companyId} AND "entity_type"=${entityType} AND "entity_id"=${entityId} AND "file_id"=${fileId} LIMIT 1`;
  return rows[0]?publicRow(rows[0]):undefined;
 }
}

function publicRow(row:LinkRow):EntityFileLinkRecord{return{id:row.id,companyId:row.company_id,entityType:row.entity_type,entityId:row.entity_id,fileId:row.file_id,label:row.label,createdBy:row.created_by,createdAt:row.created_at};}
