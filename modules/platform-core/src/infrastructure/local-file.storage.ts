import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {FileStoragePort} from '../application/platform-core.application-service.js';

/** Trusted binary storage adapter. Keys are server-generated and never accepted from clients. */
export class LocalFileStorage implements FileStoragePort {
  constructor(private readonly root=process.env.ELHAFEZ_FILE_STORAGE_ROOT??'/var/lib/elhafez/files'){}
  async put(input:{content:Uint8Array;contentType:string}){await mkdir(this.root,{recursive:true});const key=randomUUID();await writeFile(join(this.root,key),input.content,{flag:'wx'});return{key,size:input.content.byteLength,checksum:createHash('sha256').update(input.content).digest('hex')}}
  async get(key:string){return new Uint8Array(await readFile(this.path(key)))}
  async delete(key:string){await rm(this.path(key),{force:true})}
  private path(key:string){if(!/^[0-9a-f-]{36}$/.test(key))throw new Error('invalid storage key');return join(this.root,key)}
}

/** Fails closed until an infrastructure delivery provider is configured. */
export class UnavailableRecoveryDelivery {
  async deliver():Promise<never>{throw new Error('recovery delivery provider is unavailable')}
}
