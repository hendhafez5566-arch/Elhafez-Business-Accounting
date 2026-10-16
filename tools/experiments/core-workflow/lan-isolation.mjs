import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { resolve,join } from 'node:path';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const exec=promisify(execFile),network='elhafez-core-lan-'+process.pid,server='elhafez-core-lan-api-'+process.pid;
const run=(args)=>exec('docker',args,{maxBuffer:2*1024*1024});
let input='';for await(const chunk of process.stdin)input+=chunk;const fixture=JSON.parse(input);
let networkCreated=false,connected=false,started=false;
const tlsRoot=await mkdtemp(join(tmpdir(),'core-lan-tls-'));
try{
 await exec('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(tlsRoot,'ca.key'),'-out',join(tlsRoot,'ca.pem'),'-days','1','-subj','/CN=Core Acceptance LAN CA']);
 await exec('openssl',['req','-newkey','rsa:2048','-nodes','-keyout',join(tlsRoot,'server.key'),'-out',join(tlsRoot,'server.csr'),'-subj','/CN='+server]);
 await writeFile(join(tlsRoot,'extensions.cnf'),'subjectAltName=DNS:'+server+'\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n',{mode:0o600});
 await exec('openssl',['x509','-req','-in',join(tlsRoot,'server.csr'),'-CA',join(tlsRoot,'ca.pem'),'-CAkey',join(tlsRoot,'ca.key'),'-CAcreateserial','-out',join(tlsRoot,'server.pem'),'-days','1','-extfile',join(tlsRoot,'extensions.cnf')]);
 await run(['network','create','--internal',network]);networkCreated=true;
 assert.equal((await run(['network','inspect','--format','{{.Internal}}',network])).stdout.trim(),'true');
 await run(['network','connect',network,'elhafez-core-test']);connected=true;
 await run(['run','--detach','--pull','never','--name',server,'--network',network,'--mount',`type=bind,src=${process.cwd()},dst=/repo,readonly`,'--mount',`type=bind,src=${resolve(fixture.filesRoot)},dst=/files`,'--mount',`type=bind,src=${join(tlsRoot,'server.pem')},dst=/tls/server.pem,readonly`,'--mount',`type=bind,src=${join(tlsRoot,'server.key')},dst=/tls/server.key,readonly`,'--workdir','/repo','--env','SAAS_OWNER_MFA_KEY','--env','HTTP_PROXY','--env','HTTPS_PROXY','--env','NO_PROXY','--env','DATABASE_URL=postgresql://postgres:core-test-only@elhafez-core-test:5432/elhafez_core_test?connection_limit=2','--env','ELHAFEZ_WRITE_AUTHORITY_ID=office-test-000000000001','--env','ELHAFEZ_FILE_STORAGE_ROOT=/files',process.env.CORE_LAN_IMAGE??'elhafez-office-runtime:node24-openssl3','bash','-c','PORT=3300 ELHAFEZ_BIND_HOST=127.0.0.1 node --import ./apps/api/scripts/typescript-runtime.mjs apps/api/src/main.ts & PORT=4188 ELHAFEZ_WEB_BIND_HOST=127.0.0.1 ELHAFEZ_API_BASE_URL=http://127.0.0.1:3300 node deploy/railway/static-proxy.mjs & ELHAFEZ_TLS_CERT=/tls/server.pem ELHAFEZ_TLS_KEY=/tls/server.key ELHAFEZ_TLS_PORT=4443 node deploy/local/tls-proxy.mjs & wait -n']);started=true;
 let ready=false;for(let attempt=0;attempt<60;attempt++){try{await run(['exec',server,'node','-e',"fetch('http://127.0.0.1:3300/health',{signal:AbortSignal.timeout(1000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]);ready=true;break;}catch(error){if(attempt===59)console.error('Isolated readiness failed:',error.message.slice(0,200));}await new Promise(r=>setTimeout(r,250));}
 if(!ready)throw Error('Isolated API not ready: '+JSON.stringify(await run(['logs',server])).slice(-3500));
 const clientCode=`import assert from 'node:assert/strict';import {get} from 'node:https';import {rootCertificates} from 'node:tls';let text='';for await(const part of process.stdin)text+=part;const f=JSON.parse(text),origin='https://'+process.env.CORE_TARGET+':4443';await assert.rejects(()=>new Promise((resolve,reject)=>{get(origin,{servername:'wrong-host.invalid'},resolve).on('error',reject);}),e=>e.code==='ERR_TLS_CERT_ALTNAME_INVALID');await assert.rejects(()=>new Promise((resolve,reject)=>{get(origin,{ca:rootCertificates},resolve).on('error',reject);}),e=>['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(e.code));const r=await fetch(origin+'/api/saas/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({companyCode:f.companyCode,username:'administrator',password:f.password})});assert.equal(r.status,201);const login=await r.json();assert.equal(login.userId,f.userId);const headers={authorization:'Bearer '+login.token,'x-company-id':login.companyId,'x-branch-id':login.defaultBranchId};const bookings=await fetch(origin+'/api/hajj-umrah/operations/bookings',{headers});assert.equal(bookings.status,200);assert.ok((await bookings.json()).some(b=>b.code==='CORE-FINANCIAL'));const attachment=await fetch(origin+'/api/crm/customers/'+f.customerId+'/files/'+f.fileId,{headers});assert.equal(attachment.status,200);assert.ok((await attachment.json()).contentBase64);assert.equal((await fetch(origin+'/hajj-umrah/bookings')).status,200);`;
 await new Promise((resolve,reject)=>{const client=spawn('docker',['run','--rm','--interactive','--pull','never','--network',network,'--mount',`type=bind,src=${join(tlsRoot,'ca.pem')},dst=/tls/ca.pem,readonly`,'--env','NODE_EXTRA_CA_CERTS=/tls/ca.pem','--env','CORE_TARGET='+server,process.env.CORE_LAN_IMAGE??'elhafez-office-runtime:node24-openssl3','node','--input-type=module','-e',clientCode],{stdio:['pipe','pipe','pipe']});let output='';client.stdout.on('data',x=>output+=String(x));client.stderr.on('data',x=>output+=String(x));client.on('error',reject);client.on('exit',code=>code===0?resolve():reject(Error('Isolated LAN client failed: '+output.slice(-2000))));client.stdin.end(JSON.stringify(fixture));});
 await run(['exec',server,'node','--use-env-proxy','-e',"fetch('https://registry.npmjs.org',{signal:AbortSignal.timeout(3000)}).then(()=>process.exit(1),()=>process.exit(0))"]);
 console.log('PASS: cold API/UI artifacts, local password login, retained subscription, owner data and attachment over verified TLS on an internal Docker LAN; rejected wrong hostname and untrusted CA with no Internet route.');
}finally{
 if(started)await run(['rm','--force',server]);
 if(connected)await run(['network','disconnect',network,'elhafez-core-test']);
 if(networkCreated)await run(['network','rm',network]);
 await rm(tlsRoot,{recursive:true,force:true});
}
