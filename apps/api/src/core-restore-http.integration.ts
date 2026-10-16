/** Explicit clean-restore HTTP acceptance; credentials arrive only on stdin. */
import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {createHash,createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {AppModule} from './app.module.js';
import {GlobalRequestSafetyPipe} from './global-request-safety.pipe.js';
import {PlatformErrorFilter} from './platform-error.filter.js';
const url=new URL(process.env.DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.pathname!=='/elhafez_core_restore')throw Error('Only the isolated restore database is accepted');
let input='';for await(const chunk of process.stdin)input+=String(chunk);
const fixture=JSON.parse(input) as {companyCode:string;password:string;customerId:string;fileId:string;checksum:string;ownerToken:string;mfaSecret:string;partialUploadId:string;largeFileId:string};
function otp(secret:string){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const key=Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const d=createHmac('sha1',key).update(counter).digest(),offset=d[d.length-1]!&15;return((d.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');}
const app=await NestFactory.create(AppModule,{logger:['error','warn']});app.useGlobalPipes(new GlobalRequestSafetyPipe());app.useGlobalFilters(new PlatformErrorFilter());
try{
 await app.listen(0,'127.0.0.1');const origin=await app.getUrl();
 const login=await fetch(origin+'/saas/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({companyCode:fixture.companyCode,username:'administrator',password:fixture.password})});assert.equal(login.status,201);
 const tenant=await login.json() as {token:string;companyId:string;defaultBranchId:string},headers={authorization:'Bearer '+tenant.token,'x-company-id':tenant.companyId,'x-branch-id':tenant.defaultBranchId};
 const owner=await fetch(origin+'/saas-owner/companies',{headers:{authorization:'Bearer '+fixture.ownerToken,'x-owner-totp':otp(fixture.mfaSecret)}});assert.equal(owner.status,200,'restored MFA encryption key must decrypt the retained owner enrollment');
 const statement=await fetch(origin+'/hajj-umrah/family-statement?reference=FAMILY-4',{headers});assert.equal(statement.status,200);const result=await statement.json() as {totals:Array<{outstanding:string}>};assert.equal(result.totals[0]?.outstanding,String(4000-2500-10-20-200-5));
 const file=await fetch(origin+'/crm/customers/'+fixture.customerId+'/files/'+fixture.fileId,{headers});assert.equal(file.status,200);const content=await file.json() as {contentBase64:string};assert.equal(createHash('sha256').update(Buffer.from(content.contentBase64,'base64')).digest('hex'),fixture.checksum);
 const reviews=await fetch(origin+'/offline/reviews',{headers});assert.equal(reviews.status,200);assert.ok((await reviews.json() as unknown[]).length>=2);
 if(fixture.partialUploadId){const path=origin+'/crm/customers/'+fixture.customerId+'/file-uploads/'+fixture.partialUploadId,status=await fetch(path,{headers});assert.equal(status.status,200);assert.deepEqual((await status.json()).receivedChunks,[0]);const chunk=await fetch(path+'/chunks/1',{method:'PUT',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({contentBase64:Buffer.alloc(19,91).toString('base64')})});assert.equal(chunk.status,200);const completed=await fetch(path+'/complete',{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}'});assert.equal(completed.status,201);const link=await completed.json(),resumed=await fetch(origin+'/crm/customers/'+fixture.customerId+'/files/'+link.fileId,{headers});assert.equal(resumed.status,200);assert.equal(createHash('sha256').update(Buffer.from((await resumed.json()).contentBase64,'base64')).digest('hex'),createHash('sha256').update(Buffer.alloc(65536+19,91)).digest('hex'));}
 if(fixture.largeFileId){const response=await fetch(origin+'/crm/customers/'+fixture.customerId+'/files/'+fixture.largeFileId,{headers});assert.equal(response.status,200);const content=Buffer.from((await response.json()).contentBase64,'base64');assert.equal(content.length,2*1024*1024+17);assert.equal(createHash('sha256').update(content).digest('hex'),createHash('sha256').update(Buffer.alloc(content.length,65)).digest('hex'));}
 console.log('PASS: restored AppModule authenticates retained credentials, reads independently calculated balance, unresolved reviews and verified attachment bytes.');
}finally{await app.close();}
