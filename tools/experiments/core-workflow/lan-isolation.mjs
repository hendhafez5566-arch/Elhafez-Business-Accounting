import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const exec=promisify(execFile),network='elhafez-core-lan-'+process.pid,server='elhafez-core-lan-api-'+process.pid;
const run=(args)=>exec('docker',args,{maxBuffer:2*1024*1024});
let input='';for await(const chunk of process.stdin)input+=chunk;const fixture=JSON.parse(input);
let networkCreated=false,connected=false,started=false;
try{
 await run(['network','create','--internal',network]);networkCreated=true;
 assert.equal((await run(['network','inspect','--format','{{.Internal}}',network])).stdout.trim(),'true');
 await run(['network','connect',network,'elhafez-core-test']);connected=true;
 await run(['run','--detach','--pull','never','--name',server,'--network',network,'--publish','127.0.0.1:54881:4188','--mount',`type=bind,src=${process.cwd()},dst=/repo,readonly`,'--mount',`type=bind,src=${resolve(fixture.filesRoot)},dst=/files`,'--workdir','/repo','--env','SAAS_OWNER_MFA_KEY','--env','HTTP_PROXY','--env','HTTPS_PROXY','--env','NO_PROXY','--env','DATABASE_URL=postgresql://postgres:core-test-only@elhafez-core-test:5432/elhafez_core_test','--env','ELHAFEZ_WRITE_AUTHORITY_ID=office-test-000000000001','--env','ELHAFEZ_FILE_STORAGE_ROOT=/files','node:24-bookworm-slim','bash','-c','PORT=3300 ELHAFEZ_BIND_HOST=0.0.0.0 node --import ./apps/api/scripts/typescript-runtime.mjs apps/api/src/main.ts & PORT=4188 ELHAFEZ_API_BASE_URL=http://127.0.0.1:3300 node deploy/railway/static-proxy.mjs & wait -n']);started=true;
 let ready=false;for(let attempt=0;attempt<60;attempt++){try{if((await fetch('http://127.0.0.1:54881/api/health',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch(error){if(attempt===59)throw error;}await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw Error('Isolated API not ready: '+(await run(['logs',server])).stdout.slice(-2000));
 const response=await fetch('http://127.0.0.1:54881/api/saas/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({companyCode:fixture.companyCode,username:'administrator',password:fixture.password})});assert.equal(response.status,201);const login=await response.json();assert.equal(login.userId,fixture.userId);
 const headers={authorization:'Bearer '+login.token,'x-company-id':login.companyId,'x-branch-id':login.defaultBranchId};
 const bookings=await fetch('http://127.0.0.1:54881/api/hajj-umrah/operations/bookings',{headers});assert.equal(bookings.status,200);assert.ok((await bookings.json()).some(b=>b.code==='CORE-FINANCIAL'));
 const attachment=await fetch(`http://127.0.0.1:54881/api/crm/customers/${fixture.customerId}/files/${fixture.fileId}`,{headers});assert.equal(attachment.status,200);assert.ok((await attachment.json()).contentBase64);
 assert.equal((await fetch('http://127.0.0.1:54881/hajj-umrah/bookings')).status,200);
 await run(['exec',server,'node','--use-env-proxy','-e',"fetch('https://registry.npmjs.org',{signal:AbortSignal.timeout(3000)}).then(()=>process.exit(1),()=>process.exit(0))"]);
 console.log('PASS: cold API/UI artifacts, local password login, retained subscription, owner data and attachment on an internal Docker LAN with no Internet route.');
}finally{
 if(started)await run(['rm','--force',server]);
 if(connected)await run(['network','disconnect',network,'elhafez-core-test']);
 if(networkCreated)await run(['network','rm',network]);
}
