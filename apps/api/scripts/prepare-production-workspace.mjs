import {existsSync,readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=resolve(process.env.PRODUCTION_WORKSPACE_ROOT??process.cwd());

function packageDirectories(parent){
  if(!existsSync(parent))return[];
  return readdirSync(parent,{withFileTypes:true})
    .filter(entry=>entry.isDirectory())
    .map(entry=>join(parent,entry.name))
    .filter(directory=>existsSync(join(directory,'package.json')));
}
function compiledTarget(target){
  if(typeof target!=='string'||!target.startsWith('./src/')||!target.endsWith('.ts'))return target;
  return './dist/'+target.slice('./src/'.length,-3)+'.js';
}
function rewrite(value){
  if(typeof value==='string')return compiledTarget(value);
  if(Array.isArray(value))return value.map(rewrite);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,rewrite(item)]));
  return value;
}
function targets(value,result=[]){
  if(typeof value==='string'){if(value.startsWith('./dist/'))result.push(value);return result;}
  if(Array.isArray(value)){for(const item of value)targets(item,result);return result;}
  if(value&&typeof value==='object')for(const item of Object.values(value))targets(item,result);
  return result;
}

const directories=[...packageDirectories(join(root,'modules')),...packageDirectories(join(root,'packages'))];
if(!directories.length)throw new Error('no workspace packages found for production packaging');
let rewritten=0;
for(const directory of directories){
  const path=join(directory,'package.json');
  const manifest=JSON.parse(readFileSync(path,'utf8'));
  if(manifest.exports===undefined)continue;
  const next=rewrite(manifest.exports);
  for(const target of targets(next)){
    const absolute=join(directory,target.slice(2));
    if(!existsSync(absolute)||!statSync(absolute).isFile())throw new Error(`compiled export missing: ${manifest.name??directory} -> ${target}`);
  }
  manifest.exports=next;
  writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
  rewritten+=1;
}
if(!rewritten)throw new Error('no workspace exports were packaged for compiled production');
process.stdout.write(`Production workspace packaged: ${rewritten} manifests now resolve compiled dist exports.\n`);
