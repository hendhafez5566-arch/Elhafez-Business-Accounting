export const FILE_UPLOAD_REPOSITORY=Symbol('FILE_UPLOAD_REPOSITORY');
export const FILE_UPLOAD_CHUNK_BYTES=64*1024;
export interface FileUploadSession {
 readonly id:string;readonly companyId:string;readonly branchId:string;readonly actorId:string;readonly requestId:string;readonly payloadHash:string;
 readonly entityType:string;readonly entityId:string;readonly label:string|null;readonly contentType:string;readonly size:number;readonly checksum:string;readonly chunkCount:number;
 readonly state:'UPLOADING'|'FINALIZING'|'COMPLETED';readonly fileId:string|null;readonly createdAt:Date;
}
export interface FileUploadChunk {readonly companyId:string;readonly uploadId:string;readonly index:number;readonly checksum:string;readonly content:Uint8Array;}
export interface FileUploadRepository {
 reserve(value:FileUploadSession):Promise<FileUploadSession>;
 find(companyId:string,id:string):Promise<FileUploadSession|undefined>;
 chunks(companyId:string,uploadId:string):Promise<readonly FileUploadChunk[]>;
 chunkIndexes(companyId:string,uploadId:string):Promise<readonly number[]>;
 putChunk(value:FileUploadChunk):Promise<FileUploadChunk>;
 finalizing(companyId:string,id:string):Promise<void>;
 finish(companyId:string,id:string,fileId:string):Promise<void>;
}
