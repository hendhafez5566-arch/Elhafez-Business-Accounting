import assert from'node:assert/strict';
import test from'node:test';
import{mkdtemp,readFile,rm,writeFile}from'node:fs/promises';
import{tmpdir}from'node:os';
import{join}from'node:path';
import{PostgresBackupProvider,type BackupCommandRunner}from'./infrastructure/postgres-backup.provider.js';
import{PlatformOperationsError}from'./application/platform-operations.application-service.js';

function fakeRunner(calls:{command:string;args:readonly string[];env:NodeJS.ProcessEnv}[]):BackupCommandRunner{
 return async(command,args,env)=>{
  calls.push({command,args:[...args],env:{...env}});
  if(command==='pg_dump'&&args.includes('--file')){
   const index=args.indexOf('--file');await writeFile(args[index+1]!,Buffer.from('portable-postgres-dump'));
  }
 };
}

test('PostgreSQL provider creates, verifies and deletes one platform backup artifact',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'elhafez-backup-')),calls:{command:string;args:readonly string[];env:NodeJS.ProcessEnv}[]=[];
 try{
  const provider=new PostgresBackupProvider({databaseUrl:'postgresql://backup:secret@localhost:5432/platform',directory,restoreDatabaseUrl:'postgresql://restore:secret2@localhost:5432/recovery',restoreEnabled:true},fakeRunner(calls));
  assert.equal(await provider.health(),true);
  const result=await provider.create({backupId:'12345678-abcd-1234-abcd-123456789012',companyId:null});
  assert.equal(result.manifest.scope,'PLATFORM');assert.ok(result.checksum);assert.equal(await provider.verify(result.providerRef,result.checksum!),true);
  assert.equal(String(await readFile(join(directory,'elhafez-12345678-abcd-1234-abcd-123456789012.dump'))),'portable-postgres-dump');
  await provider.delete(result.providerRef);
  await assert.rejects(readFile(join(directory,'elhafez-12345678-abcd-1234-abcd-123456789012.dump')));
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('physical backup refuses a tenant scope instead of pretending to isolate one company',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'elhafez-backup-'));
 try{
  const provider=new PostgresBackupProvider({databaseUrl:'postgresql://backup:secret@localhost:5432/platform',directory},fakeRunner([]));
  await assert.rejects(provider.create({backupId:'12345678-abcd-1234-abcd-123456789012',companyId:'company-a'}),PlatformOperationsError);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('restore requires explicit safe target and verifies artifact immediately before restore',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'elhafez-backup-')),calls:{command:string;args:readonly string[];env:NodeJS.ProcessEnv}[]=[];
 try{
  const provider=new PostgresBackupProvider({databaseUrl:'postgresql://backup:secret@localhost:5432/platform',restoreDatabaseUrl:'postgresql://restore:restore-secret@localhost:5432/recovery',directory,restoreEnabled:true},fakeRunner(calls));
  const backup=await provider.create({backupId:'12345678-abcd-1234-abcd-123456789012',companyId:null});
  assert.equal(await provider.restoreReady(),true);await provider.restore(backup.providerRef,backup.checksum);
  const restore=calls.find(call=>call.command==='pg_restore'&&call.args.includes('--clean'));assert.ok(restore);assert.ok(restore!.args.includes('recovery'));assert.equal(restore!.env.PGPASSWORD,'restore-secret');
  assert.equal(calls.some(call=>call.args.some(arg=>arg.includes('restore-secret')||arg.includes('secret@'))),false);
  const unsafe=new PostgresBackupProvider({databaseUrl:'postgresql://backup:secret@localhost:5432/platform',restoreDatabaseUrl:'postgresql://backup:secret@localhost:5432/platform',directory,restoreEnabled:true},fakeRunner([]));
  assert.equal(await unsafe.restoreReady(),false);
 }finally{await rm(directory,{recursive:true,force:true});}
});
