import {createHash} from 'node:crypto';
import type {ExecutionContext} from '@elhafez/contracts';
import {PlatformError,type StoredFile} from '../domain/platform.types.js';
import type {PlatformCoreApplicationService} from './platform-core.application-service.js';
import {FILE_UPLOAD_CHUNK_BYTES,type FileUploadRepository,type FileUploadSession} from './file-upload.repository.js';
export interface BeginFileUpload {readonly requestId:string;readonly entityType:string;readonly entityId:string;readonly label?:string;readonly contentType:string;readonly size:number;readonly checksum:string;}
export interface FileUploadStatus {readonly id:string;readonly label:string|null;readonly state:FileUploadSession['state'];readonly chunkBytes:number;readonly chunkCount:number;readonly receivedChunks:readonly number[];readonly fileId:string|null;}
const invalid=(message:string):never=>{throw new PlatformError('VALIDATION_ERROR',message);};
function uuid(value:unknown){const hex=createHash('sha256').update(JSON.stringify(value)).digest('hex');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-8'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);}
/** Owns durable upload staging; calling entity owners remain responsible for their entity permissions. */
export class FileUploadApplicationService {
 constructor(private readonly repo:FileUploadRepository,private readonly platform:Pick<PlatformCoreApplicationService,'requireBranchAccess'|'uploadFileOnce'|'getFile'>,private readonly now:()=>Date=()=>new Date()){}
 async begin(c:ExecutionContext,input:BeginFileUpload):Promise<FileUploadStatus>{
  await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);
  if(!input||typeof input!=='object')invalid('upload metadata is required');
  if(typeof input.requestId!=='string'||typeof input.checksum!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(input.requestId)||!Number.isSafeInteger(input.size)||input.size<1||input.size>50*1024*1024||!/^[a-f0-9]{64}$/.test(input.checksum))invalid('stable request, SHA-256 checksum and file size 1..50 MiB required');
  if(typeof input.entityType!=='string'||!input.entityType.trim()||input.entityType.length>40||typeof input.entityId!=='string'||!input.entityId.trim()||input.entityId.length>200||typeof input.contentType!=='string'||!input.contentType.trim()||input.contentType.length>150||input.label!==undefined&&typeof input.label!=='string'||(input.label?.length??0)>200)invalid('valid entity, content type and label required');
  const identity={companyId:c.companyId,branchId:c.branchId,actorId:c.actorId,requestId:input.requestId,entityType:input.entityType.trim(),entityId:input.entityId.trim(),contentType:input.contentType.trim(),label:input.label?.trim()||null,size:input.size,checksum:input.checksum};
  const payloadHash=createHash('sha256').update(JSON.stringify(identity)).digest('hex'),value=await this.repo.reserve({...identity,id:uuid([c.companyId,c.branchId,c.actorId,input.requestId]),payloadHash,chunkCount:Math.ceil(input.size/FILE_UPLOAD_CHUNK_BYTES),state:'UPLOADING',fileId:null,createdAt:this.now()});
  if(value.payloadHash!==payloadHash)throw new PlatformError('CONFLICT','upload identity has different immutable metadata');return this.status(value);
 }
 private async required(c:ExecutionContext,id:string){await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);const value=await this.repo.find(c.companyId,id);if(!value||value.actorId!==c.actorId||value.branchId!==c.branchId)throw new PlatformError('NOT_FOUND','upload not found in current device actor scope');return value;}
 private async status(value:FileUploadSession):Promise<FileUploadStatus>{return{id:value.id,label:value.label,state:value.state,chunkBytes:FILE_UPLOAD_CHUNK_BYTES,chunkCount:value.chunkCount,receivedChunks:await this.repo.chunkIndexes(value.companyId,value.id),fileId:value.fileId};}
 async get(c:ExecutionContext,id:string,entityType:string,entityId:string):Promise<FileUploadStatus>{const value=await this.scoped(c,id,entityType,entityId);return this.status(value);}
 private async scoped(c:ExecutionContext,id:string,entityType:string,entityId:string){const value=await this.required(c,id);if(value.entityType!==entityType||value.entityId!==entityId)throw new PlatformError('NOT_FOUND','upload does not belong to this entity');return value;}
 async chunk(c:ExecutionContext,id:string,entityType:string,entityId:string,index:number,content:Uint8Array):Promise<{index:number;checksum:string}>{
  const value=await this.scoped(c,id,entityType,entityId);if(!Number.isSafeInteger(index)||index<0||index>=value.chunkCount||content.byteLength!==Math.min(FILE_UPLOAD_CHUNK_BYTES,value.size-index*FILE_UPLOAD_CHUNK_BYTES))invalid('chunk index or exact byte length is invalid');
  if(value.state==='COMPLETED')throw new PlatformError('CONFLICT','upload is already complete; use its retained file receipt');
  const checksum=createHash('sha256').update(content).digest('hex'),stored=await this.repo.putChunk({companyId:c.companyId,uploadId:id,index,checksum,content});
  if(stored.checksum!==checksum||!Buffer.from(stored.content).equals(content))throw new PlatformError('CONFLICT','chunk identity already contains different bytes');return{index,checksum};
 }
 async complete(c:ExecutionContext,id:string,entityType:string,entityId:string):Promise<StoredFile>{
  const value=await this.scoped(c,id,entityType,entityId);if(value.state==='COMPLETED'&&value.fileId)return this.platform.getFile(c.companyId,value.fileId);
  const chunks=[...await this.repo.chunks(c.companyId,id)].sort((a,b)=>a.index-b.index);
  if(chunks.length!==value.chunkCount||chunks.some((x,index)=>x.index!==index)){const current=await this.required(c,id);if(current.state==='COMPLETED'&&current.fileId)return this.platform.getFile(c.companyId,current.fileId);invalid('upload is incomplete; resume missing chunks');}
  const content=Buffer.concat(chunks.map(x=>Buffer.from(x.content)));if(content.byteLength!==value.size||createHash('sha256').update(content).digest('hex')!==value.checksum)invalid('complete upload checksum does not match immutable request');
  await this.repo.finalizing(c.companyId,id);
  const file=await this.platform.uploadFileOnce({companyId:c.companyId,createdBy:c.actorId,requestId:value.id,contentType:value.contentType,content});await this.repo.finish(c.companyId,id,file.id);return file;
 }
}
