import type {EntityFileLinkRecord} from './application/entity-file-links.repository.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executionContext} from '@elhafez/contracts';
import {FileUploadApplicationService} from './application/file-upload.application-service.js';
import {FILE_UPLOAD_CHUNK_BYTES,type FileUploadRepository,type FileUploadSession,type FileUploadChunk} from './application/file-upload.repository.js';
import {LocalFileStorage} from './infrastructure/local-file.storage.js';
import {PlatformCoreApplicationService} from './application/platform-core.application-service.js';
import {InMemoryPlatformRepository} from './infrastructure/in-memory-platform.repository.js';
class Repository implements FileUploadRepository {
 sessions=new Map<string,FileUploadSession>();parts=new Map<string,FileUploadChunk>();failFinish=false;
 async reserve(value:FileUploadSession){const prior=this.sessions.get(value.id);if(prior)return prior;this.sessions.set(value.id,value);return value;}
 async find(companyId:string,id:string){const value=this.sessions.get(id);return value?.companyId===companyId?value:undefined;}
 async chunks(companyId:string,uploadId:string){return[...this.parts.values()].filter(x=>x.companyId===companyId&&x.uploadId===uploadId);}
 async chunkIndexes(companyId:string,uploadId:string){return(await this.chunks(companyId,uploadId)).map(x=>x.index);}
 async putChunk(value:FileUploadChunk){const key=value.uploadId+':'+value.index,prior=this.parts.get(key);if(prior)return prior;if(this.sessions.get(value.uploadId)?.state!=='UPLOADING')throw Error('upload is finalized');this.parts.set(key,value);return value;}
 async finalizing(_companyId:string,id:string){const value=this.sessions.get(id)!;if(value.state==='UPLOADING')this.sessions.set(id,{...value,state:'FINALIZING'});}
 async finish(_companyId:string,id:string,fileId:string){if(this.failFinish){this.failFinish=false;throw Error('lost completion acknowledgement');}const value=this.sessions.get(id)!;this.sessions.set(id,{...value,state:'COMPLETED',fileId});for(const [key,part] of this.parts)if(part.uploadId===id)this.parts.delete(key);}
}
const context=executionContext('company-a','branch-a','actor-a');
const digest=(content:Uint8Array)=>createHash('sha256').update(content).digest('hex');
test('interrupted upload resumes exact chunks after service restart and lost completion acknowledgement creates one verified file',async()=>{
 const root=await mkdtemp(join(tmpdir(),'core-file-upload-'));try{
  const repo=new Repository(),metadata=new InMemoryPlatformRepository(),platform=new PlatformCoreApplicationService(metadata,undefined,undefined,undefined,new LocalFileStorage(root));
  const access={requireBranchAccess:async(actorId:string,companyId:string,branchId:string)=>{assert.equal(actorId,context.actorId);assert.equal(companyId,context.companyId);assert.equal(branchId,context.branchId);},uploadFileOnce:platform.uploadFileOnce.bind(platform),getFile:platform.getFile.bind(platform)};
  const create=()=>new FileUploadApplicationService(repo,access),service=create(),content=new Uint8Array(FILE_UPLOAD_CHUNK_BYTES+17).fill(71),input={requestId:randomUUID(),entityType:'CUSTOMER',entityId:'customer-a',label:'passport',contentType:'application/pdf',size:content.length,checksum:digest(content)};
  const upload=await service.begin(context,input);await service.chunk(context,upload.id,'CUSTOMER','customer-a',0,content.slice(0,FILE_UPLOAD_CHUNK_BYTES));assert.deepEqual((await create().get(context,upload.id,'CUSTOMER','customer-a')).receivedChunks,[0]);
  await assert.rejects(()=>service.complete(context,upload.id,'CUSTOMER','customer-a'),/incomplete/);await assert.rejects(()=>create().begin(context,{...input,label:'altered'}),/different immutable/);await assert.rejects(()=>service.get(context,upload.id,'CUSTOMER','foreign'),/does not belong/);
  const changed=content.slice(0,FILE_UPLOAD_CHUNK_BYTES);changed[0]=72;await assert.rejects(()=>service.chunk(context,upload.id,'CUSTOMER','customer-a',0,changed),/different bytes/);await service.chunk(context,upload.id,'CUSTOMER','customer-a',0,content.slice(0,FILE_UPLOAD_CHUNK_BYTES));await create().chunk(context,upload.id,'CUSTOMER','customer-a',1,content.slice(FILE_UPLOAD_CHUNK_BYTES));
  repo.failFinish=true;await assert.rejects(()=>service.complete(context,upload.id,'CUSTOMER','customer-a'),/lost completion/);const [first,second]=await Promise.all([create().complete(context,upload.id,'CUSTOMER','customer-a'),create().complete(context,upload.id,'CUSTOMER','customer-a')]);assert.equal(first.id,second.id);assert.equal((await metadata.listFiles(context.companyId)).length,1);assert.equal((await readdir(root)).length,1);assert.deepEqual((await platform.getFile(context.companyId,first.id,true)).content,content);assert.equal((await create().get(context,upload.id,'CUSTOMER','customer-a')).state,'COMPLETED');assert.equal(repo.parts.size,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('stable physical storage never replaces bytes for the same identity under concurrent writers',async()=>{const root=await mkdtemp(join(tmpdir(),'core-file-once-'));try{const storage=new LocalFileStorage(root),key=randomUUID(),a=new Uint8Array([1,2]),b=new Uint8Array([3,4]);const results=await Promise.allSettled([storage.putOnce(key,{content:a,contentType:'x'}),storage.putOnce(key,{content:b,contentType:'x'})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const actual=await storage.get(key);assert.ok(Buffer.from(actual).equals(a)||Buffer.from(actual).equals(b));assert.equal((await readdir(root)).length,1);}finally{await rm(root,{recursive:true,force:true});}});
test('a lost link acknowledgement keeps the completed file and reuses one canonical entity link',async()=>{const {EntityFileLinksApplicationService}=await import('./application/entity-file-links.application-service.js');const root=await mkdtemp(join(tmpdir(),'core-file-link-'));try{
 const metadata=new InMemoryPlatformRepository(),platform=new PlatformCoreApplicationService(metadata,undefined,undefined,undefined,new LocalFileStorage(root)),file=await platform.uploadFileOnce({companyId:'company-a',createdBy:'actor-a',requestId:randomUUID(),contentType:'text/plain',content:new Uint8Array([1,2,3])});
 const records=new Map<string,EntityFileLinkRecord>();let attempts=0;
 const repo={async save(record:EntityFileLinkRecord){attempts++;if(attempts===1)throw Error('write failed before link commit');records.set(record.id,record);throw Error('link committed but acknowledgement lost');},async list(){return[...records.values()];},async find(companyId:string,entityType:string,entityId:string,fileId:string){return[...records.values()].find(x=>x.companyId===companyId&&x.entityType===entityType&&x.entityId===entityId&&x.fileId===fileId);}};
 const input={companyId:'company-a',entityType:'CUSTOMER',entityId:'customer-a',createdBy:'actor-a',fileId:file.id,label:'Passport'},create=()=>new EntityFileLinksApplicationService(repo,platform);await assert.rejects(()=>create().attachExistingOnce(input),/before link commit/);assert.ok(await platform.getFile('company-a',file.id));const first=await create().attachExistingOnce(input),second=await create().attachExistingOnce(input);assert.equal(first.id,second.id);assert.equal(attempts,2);assert.equal(records.size,1);assert.equal((await metadata.listFiles('company-a')).length,1);await assert.rejects(()=>create().attachExistingOnce({...input,label:'changed immutable label'}),/different immutable/);
 }finally{await rm(root,{recursive:true,force:true});}});
