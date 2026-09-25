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
function delta(oldMap,newMap){
 const added=[],changed=[],removed=[];
 for(const[key,block]of newMap){if(!oldMap.has(key))added.push({key,block});else if(oldMap.get(key)!==block)changed.push({key,block});}
 for(const key of oldMap.keys())if(!newMap.has(key))removed.push(key);
 return{added,changed,removed};
}
const importers=section(after,'importers');
const oldPackages=section(before,'packages'),newPackages=section(after,'packages');
const oldSnapshots=section(before,'snapshots'),newSnapshots=section(after,'snapshots');
const result={
 importer:importers.get('apps/api')??null,
 packages:delta(oldPackages,newPackages),
 snapshots:delta(oldSnapshots,newSnapshots),
};
process.stdout.write('\n=== LOCKFILE_DELTA_JSON_BEGIN ===\n'+JSON.stringify(result,null,2)+'\n=== LOCKFILE_DELTA_JSON_END ===\n');
