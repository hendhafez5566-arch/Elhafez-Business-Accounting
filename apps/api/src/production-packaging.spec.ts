import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const script=fileURLToPath(new URL('../scripts/prepare-production-workspace.mjs',import.meta.url));
function fixture(withDist=true){
  const root=mkdtempSync(join(tmpdir(),'elhafez-production-package-'));
  const moduleDir=join(root,'modules','demo');
  mkdirSync(join(moduleDir,'dist','public'),{recursive:true});
  writeFileSync(join(moduleDir,'package.json'),JSON.stringify({name:'@elhafez/demo',type:'module',exports:{'.':'./src/public/index.ts','./nest':'./src/public/nest.ts'}},null,2));
  if(withDist){
    writeFileSync(join(moduleDir,'dist','public','index.js'),'export {};\n');
    writeFileSync(join(moduleDir,'dist','public','nest.js'),'export {};\n');
  }
  return root;
}
test('production packaging rewrites workspace exports to compiled dist files only',()=>{
  const root=fixture();
  try{
    const result=spawnSync(process.execPath,[script],{env:{...process.env,PRODUCTION_WORKSPACE_ROOT:root},encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const manifest=JSON.parse(readFileSync(join(root,'modules','demo','package.json'),'utf8')) as {exports:Record<string,string>};
    assert.equal(manifest.exports['.'],'./dist/public/index.js');
    assert.equal(manifest.exports['./nest'],'./dist/public/nest.js');
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('production packaging fails closed when a compiled export is missing',()=>{
  const root=fixture(false);
  try{
    const result=spawnSync(process.execPath,[script],{env:{...process.env,PRODUCTION_WORKSPACE_ROOT:root},encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/compiled export missing/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
