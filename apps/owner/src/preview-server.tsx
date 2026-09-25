import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {renderToStaticMarkup} from 'react-dom/server';
import {OwnerControlApp} from './owner-control-app.js';
import {OwnerApiClient} from './owner-client.js';
import {previewCompanies,previewPlans} from './preview-data.js';

const port=Number(process.env.PORT??4177);
const css=await readFile(new URL('./styles.css',import.meta.url),'utf8');
const body=renderToStaticMarkup(<OwnerControlApp client={new OwnerApiClient('/api')} initialCompanies={previewCompanies} initialPlans={previewPlans} preview/>);
const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ELHAFEZ Owner Control Center — Preview</title><style>'+css+'</style></head><body>'+body+'</body></html>';
const server=createServer((request,response)=>{if(request.url!=='/'&&request.url!=='/index.html'){response.writeHead(404,{'content-type':'text/plain; charset=utf-8'});response.end('Not found');return;}response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'"});response.end(html);});
server.listen(port,'0.0.0.0',()=>process.stdout.write('Owner Control Center preview: http://localhost:'+port+'\n'));
