import{readFile}from'node:fs/promises';

const [beforePath,afterPath]=process.argv.slice(2);
if(!beforePath||!afterPath)throw new Error('usage: node lockfile-delta.mjs before after');
const before=await readFile(beforePath,'utf8'),after=await readFile(afterPath,'utf8');

function section(text,name){
 const lines=text.split('\n'),start=lines.findIndex(line=>line===name+':');
 if(start<0)return new Map();
 let end=lines.length;
 for(let i=start+1;i<lines.length;i++)if(/^\S[^:]*:$/.test(lines[i]??'')){end=i;break;}
 const map=new Map();
 let i=start+1;
 while(i<end){
  const line=lines[i]??'';
  if(/^  \S.*:$/.test(line)){
   const key=line.trim().slice(0,-1),block=[line];i++;
   while(i<end&&!/^  \S.*:$/.test(lines[i]??'')){block.push(lines[i]??'');i++;}
   map.set(key,block.join('\n').replace(/\n+$/,''));
  }else i++;
 }
 return map;
}
function added(oldMap,newMap){return[...newMap].filter(([key])=>!oldMap.has(key)).map(([key,block])=>({key,block}));}
function changed(oldMap,newMap){return[...newMap].filter(([key,block])=>oldMap.has(key)&&oldMap.get(key)!==block).map(([key,block])=>({key,block}));}

const oldImporters=section(before,'importers'),newImporters=section(after,'importers');
const oldPackages=section(before,'packages'),newPackages=section(after,'packages');
const oldSnapshots=section(before,'snapshots'),newSnapshots=section(after,'snapshots');
const result={
 importerBefore:oldImporters.get('apps/api')??null,
 importerAfter:newImporters.get('apps/api')??null,
 addedPackages:added(oldPackages,newPackages),
 addedSnapshots:added(oldSnapshots,newSnapshots),
 changedNestPackages:changed(oldPackages,newPackages).filter(x=>x.key.includes('@nestjs/')),
 changedNestSnapshots:changed(oldSnapshots,newSnapshots).filter(x=>x.key.includes('@nestjs/')),
};
process.stdout.write('\nLOCK_DELTA_BEGIN\n'+JSON.stringify(result,null,2)+'\nLOCK_DELTA_END\n');
