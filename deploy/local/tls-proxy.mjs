import {createServer} from 'node:https';
import {request} from 'node:http';
import {readFile} from 'node:fs/promises';
const certPath=process.env.ELHAFEZ_TLS_CERT,keyPath=process.env.ELHAFEZ_TLS_KEY;
if(!certPath||!keyPath)throw Error('Configure the trusted LAN certificate and private key paths');
const upstream=new URL(process.env.ELHAFEZ_TLS_UPSTREAM??'http://127.0.0.1:4188');
if(upstream.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(upstream.hostname)||upstream.username||upstream.password)throw Error('TLS upstream must be a loopback HTTP service');
const port=Number(process.env.ELHAFEZ_TLS_PORT??4443);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid TLS port');
const server=createServer({cert:await readFile(certPath),key:await readFile(keyPath),minVersion:'TLSv1.2'},(incoming,outgoing)=>{
 const headers={...incoming.headers,host:upstream.host,'x-forwarded-proto':'https'};
 delete headers['x-forwarded-for'];
 const forward=request({hostname:upstream.hostname,port:upstream.port,method:incoming.method,path:incoming.url,headers,timeout:30000},response=>{
  outgoing.writeHead(response.statusCode??502,{...response.headers,'strict-transport-security':'max-age=86400'});response.pipe(outgoing);
 });
 forward.on('timeout',()=>forward.destroy(Error('Upstream timeout')));
 forward.on('error',()=>{if(!outgoing.headersSent)outgoing.writeHead(502,{'content-type':'application/json'});outgoing.end('{"error":"LOCAL_UPSTREAM_UNAVAILABLE"}');});
 incoming.on('aborted',()=>forward.destroy());incoming.pipe(forward);
});
server.headersTimeout=15000;server.requestTimeout=30000;
server.listen(port,process.env.ELHAFEZ_TLS_BIND_HOST??'0.0.0.0',()=>process.stdout.write('Local TLS gateway ready\n'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
