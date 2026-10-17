import type {PrismaClient,PcFileUploadSession,PcFileUploadChunk} from '@prisma/client';
import {PlatformError} from '../domain/platform.types.js';
import type {FileUploadRepository,FileUploadSession,FileUploadChunk} from '../application/file-upload.repository.js';
function session(row:PcFileUploadSession):FileUploadSession{if(!['UPLOADING','FINALIZING','COMPLETED'].includes(row.state))throw new PlatformError('CONFLICT','invalid upload state');return{...row,state:row.state as FileUploadSession['state']};}
function chunk(row:PcFileUploadChunk):FileUploadChunk{return{companyId:row.companyId,uploadId:row.uploadId,index:row.index,checksum:row.checksum,content:new Uint8Array(row.content)};}
export class PrismaFileUploadRepository implements FileUploadRepository {
 constructor(private readonly db:PrismaClient){}
 async reserve(value:FileUploadSession){try{return session(await this.db.pcFileUploadSession.create({data:value}));}catch(error){const prior=await this.find(value.companyId,value.id);if(prior)return prior;throw error;}}
 async find(companyId:string,id:string){const row=await this.db.pcFileUploadSession.findUnique({where:{companyId_id:{companyId,id}}});return row?session(row):undefined;}
 async chunks(companyId:string,uploadId:string){return(await this.db.pcFileUploadChunk.findMany({where:{companyId,uploadId},orderBy:{index:'asc'}})).map(chunk);}
 async chunkIndexes(companyId:string,uploadId:string){return(await this.db.pcFileUploadChunk.findMany({where:{companyId,uploadId},select:{index:true},orderBy:{index:'asc'}})).map(x=>x.index);}
 async putChunk(value:FileUploadChunk){return this.db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM pc_file_uploads WHERE company_id=${value.companyId} AND id=${value.uploadId} FOR UPDATE`;
  const where={companyId_uploadId_index:{companyId:value.companyId,uploadId:value.uploadId,index:value.index}},prior=await tx.pcFileUploadChunk.findUnique({where});if(prior)return chunk(prior);
  const parent=await tx.pcFileUploadSession.findUnique({where:{companyId_id:{companyId:value.companyId,id:value.uploadId}}});if(parent?.state!=='UPLOADING')throw new PlatformError('CONFLICT','upload no longer accepts new chunks');
  return chunk(await tx.pcFileUploadChunk.create({data:{...value,content:Buffer.from(value.content)}}));
 });}
 async finalizing(companyId:string,id:string){await this.db.pcFileUploadSession.updateMany({where:{companyId,id,state:'UPLOADING'},data:{state:'FINALIZING'}});}
 async finish(companyId:string,id:string,fileId:string){await this.db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM pc_file_uploads WHERE company_id=${companyId} AND id=${id} FOR UPDATE`;
  const current=await tx.pcFileUploadSession.findUniqueOrThrow({where:{companyId_id:{companyId,id}}});if(current.fileId&&current.fileId!==fileId)throw new PlatformError('CONFLICT','upload has a different retained file receipt');
  await tx.pcFileUploadSession.update({where:{companyId_id:{companyId,id}},data:{state:'COMPLETED',fileId}});await tx.pcFileUploadChunk.deleteMany({where:{companyId,uploadId:id}});
 });}
}
