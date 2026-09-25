import{createHash}from'node:crypto';
import{spawn}from'node:child_process';
import{createReadStream}from'node:fs';
import{access,mkdir,rename,rm,stat}from'node:fs/promises';
import{basename,resolve,sep}from'node:path';
import type{BackupProvider}from'../application/platform-operations.application-service.js';
import{PlatformOperationsError}from'../application/platform-operations.application-service.js';

export interface PostgresBackupConfig{
 readonly databaseUrl?:string;
 readonly restoreDatabaseUrl?:string;
 readonly directory?:string;
 readonly pgDump?:string;
 readonly pgRestore?:string;
 readonly restoreEnabled?:boolean;
 readonly allowInPlaceRestore?:boolean;
}
export type BackupCommandRunner=(command:string,args:readonly string[],env:NodeJS.ProcessEnv)=>Promise<void>;

const runCommand:BackupCommandRunner=(command,args,env)=>new Promise((resolvePromise,reject)=>{
 const child=spawn(command,[...args],{env,stdio:['ignore','ignore','pipe'],windowsHide:true});
 let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>{stderr+=String(chunk).slice(0,4096)});
 child.once('error',reject);child.once('exit',code=>code===0?resolvePromise():reject(new PlatformOperationsError((stderr.trim()||command+' failed')+' (exit '+String(code)+')')));
});
function connection(value:string):{database:string;env:NodeJS.ProcessEnv}{
 let url:URL;try{url=new URL(value);}catch{throw new PlatformOperationsError('invalid PostgreSQL connection URL');}
 if(url.protocol!=='postgres:'&&url.protocol!=='postgresql:')throw new PlatformOperationsError('PostgreSQL connection URL required');
 const database=decodeURIComponent(url.pathname.replace(/^\//,''));if(!database)throw new PlatformOperationsError('PostgreSQL database name required');
 const sslmode=url.searchParams.get('sslmode');
 return{database,env:{...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:database,...(sslmode?{PGSSLMODE:sslmode}:{})}};
}
function sameDatabase(left:string,right:string){const a=new URL(left),b=new URL(right);return a.hostname===b.hostname&&(a.port||'5432')===(b.port||'5432')&&decodeURIComponent(a.pathname)===decodeURIComponent(b.pathname)&&decodeURIComponent(a.username)===decodeURIComponent(b.username);}
async function sha256(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}

export class PostgresBackupProvider implements BackupProvider{
 static fromEnvironment(env:NodeJS.ProcessEnv=process.env){return new PostgresBackupProvider({
  databaseUrl:env.DATABASE_URL,
  restoreDatabaseUrl:env.ELHAFEZ_RESTORE_DATABASE_URL,
  directory:env.ELHAFEZ_BACKUP_DIR,
  pgDump:env.ELHAFEZ_PG_DUMP,
  pgRestore:env.ELHAFEZ_PG_RESTORE,
  restoreEnabled:env.ELHAFEZ_RESTORE_ENABLED==='true',
  allowInPlaceRestore:env.ELHAFEZ_ALLOW_IN_PLACE_RESTORE==='true',
 });}
 private readonly directory:string;private readonly pgDump:string;private readonly pgRestore:string;
 constructor(private readonly config:PostgresBackupConfig,private readonly runner:BackupCommandRunner=runCommand){
  this.directory=config.directory?.trim()?resolve(config.directory):'';
  this.pgDump=config.pgDump?.trim()||'pg_dump';this.pgRestore=config.pgRestore?.trim()||'pg_restore';
 }
 async health(){if(!this.config.databaseUrl||!this.directory)return false;try{connection(this.config.databaseUrl);await mkdir(this.directory,{recursive:true});await access(this.directory);await this.runner(this.pgDump,['--version'],process.env);await this.runner(this.pgRestore,['--version'],process.env);return true}catch{return false}}
 async restoreReady(){if(!this.config.restoreEnabled||!this.config.restoreDatabaseUrl||!this.config.databaseUrl||!await this.health())return false;try{connection(this.config.restoreDatabaseUrl);if(sameDatabase(this.config.databaseUrl,this.config.restoreDatabaseUrl)&&!this.config.allowInPlaceRestore)return false;return true}catch{return false}}
 async create(input:{backupId:string;companyId:string|null}){
  if(input.companyId!==null)throw new PlatformOperationsError('physical PostgreSQL backup is platform-scoped; use tenant data export for company-scoped portability');
  if(!await this.health()||!this.config.databaseUrl)throw new PlatformOperationsError('PostgreSQL backup provider is unavailable');
  const name=this.safeName(input.backupId),finalPath=this.path(name),tempPath=this.path(name+'.partial'),source=connection(this.config.databaseUrl);
  await rm(tempPath,{force:true});
  try{
   await this.runner(this.pgDump,['--format=custom','--no-owner','--no-privileges','--file',tempPath],source.env);
   const info=await stat(tempPath);if(info.size<=0)throw new PlatformOperationsError('pg_dump produced an empty backup');
   await rename(tempPath,finalPath);const checksum=await sha256(finalPath);
   return{providerRef:'file:'+name,checksum,manifest:{version:1,engine:'postgresql',format:'pg_dump-custom',scope:'PLATFORM',backupId:input.backupId,bytes:info.size,createdAt:new Date().toISOString()}};
  }catch(error){await rm(tempPath,{force:true}).catch(()=>undefined);throw error}
 }
 async verify(providerRef:string,checksum:string){try{const target=this.pathFromRef(providerRef),info=await stat(target);if(info.size<=0||await sha256(target)!==checksum)return false;await this.runner(this.pgRestore,['--list',target],process.env);return true}catch{return false}}
 async restore(providerRef:string,checksum?:string){
  if(!await this.restoreReady()||!this.config.restoreDatabaseUrl)throw new PlatformOperationsError('PostgreSQL restore is disabled or not safely configured');
  const target=this.pathFromRef(providerRef);if(checksum&&!await this.verify(providerRef,checksum))throw new PlatformOperationsError('backup integrity check failed before restore');
  const targetDb=connection(this.config.restoreDatabaseUrl);
  await this.runner(this.pgRestore,['--clean','--if-exists','--no-owner','--no-privileges','--single-transaction','--exit-on-error','--dbname',targetDb.database,target],targetDb.env);
 }
 async delete(providerRef:string){await rm(this.pathFromRef(providerRef),{force:true})}
 private safeName(backupId:string){if(!/^[A-Za-z0-9_-]{8,80}$/.test(backupId))throw new PlatformOperationsError('invalid backup id');return'elhafez-'+backupId+'.dump'}
 private pathFromRef(value:string){if(!value.startsWith('file:'))throw new PlatformOperationsError('unsupported backup reference');const name=basename(value.slice(5));if(!/^elhafez-[A-Za-z0-9_-]{8,80}\.dump$/.test(name))throw new PlatformOperationsError('invalid backup reference');return this.path(name)}
 private path(name:string){if(!this.directory)throw new PlatformOperationsError('backup directory is not configured');const target=resolve(this.directory,name);if(!target.startsWith(this.directory+sep))throw new PlatformOperationsError('invalid backup path');return target}
}
