const META_NAME='elhafez-api-base';

function normalized(value:string){
 const trimmed=value.trim();
 if(!trimmed)return'/api';
 return trimmed.endsWith('/')?trimmed.slice(0,-1):trimmed;
}

export function apiBase():string{
 if(typeof document!=='undefined'){
  const configured=document.querySelector<HTMLMetaElement>(`meta[name="${META_NAME}"]`)?.content;
  if(configured?.trim())return normalized(configured);
 }
 return'/api';
}

export function apiUrl(path:string):string{
 const suffix=path.startsWith('/')?path:`/${path}`;
 return apiBase()+suffix;
}
