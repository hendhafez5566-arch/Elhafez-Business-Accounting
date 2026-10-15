// Only the immutable, public build artifact belongs in Cache Storage. No API data.
export function offlineWorker(version, assets, html) {
 return `const CACHE=${JSON.stringify('elhafez.public-shell.'+version)};
const ASSETS=${JSON.stringify(assets)};
const HTML=${JSON.stringify(html)};
const urls=new Set(ASSETS.map(path=>new URL(path,self.location.origin).href));
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try {
  for(const path of ASSETS){
   const response=await fetch(new Request(path,{cache:'reload',credentials:'omit'}));
   const type=response.headers.get('content-type')||'';
   const expected=path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'javascript';
   if(!response.ok||response.redirected||!type.includes(expected))throw new Error('Invalid shell artifact: '+path);
   await cache.put(path,response);
  }
  await cache.put('/index.html',new Response(HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'"}}));
 }catch(error){await caches.delete(CACHE);throw error;}
})()));
// Updates wait for existing tabs to close; do not replace their code mid-operation.
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('elhafez.public-shell.')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(['api','owner','healthz'].includes(url.pathname.split('/')[1]))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(async()=>{
   const cached=await (await caches.open(CACHE)).match('/index.html');
   return cached||Response.error();
  }));return;
 }
 if(!urls.has(url.href))return;
 event.respondWith((async()=>{
  const cached=await (await caches.open(CACHE)).match(request);
  return cached||fetch(request);
 })());
});`;
}
