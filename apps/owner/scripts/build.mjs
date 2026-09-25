import{build}from'esbuild';import{readFile,writeFile,rm,mkdir}from'node:fs/promises';import{dirname,relative,resolve}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
const result=await build({entryPoints:[resolve(root,'src/index.ts')],bundle:true,format:'esm',platform:'browser',target:['es2022'],outdir:dist,entryNames:'assets/app-[hash]',assetNames:'assets/[name]-[hash]',chunkNames:'assets/chunk-[hash]',splitting:true,minify:true,sourcemap:true,metafile:true,legalComments:'none'});
const outputs=Object.keys(result.metafile.outputs),js=outputs.find(value=>value.endsWith('.js')&&result.metafile.outputs[value]?.entryPoint),css=outputs.find(value=>value.endsWith('.css'));
if(!js)throw new Error('browser JavaScript output was not generated');
let html=await readFile(resolve(root,'index.template.html'),'utf8');const url=(value)=>'/'+relative(dist,resolve(value)).split('\\').join('/');
html=html.replace('__SCRIPT__',url(js)).replace('__STYLE__',css?'<link rel="stylesheet" href="'+url(css)+'">':'');
await writeFile(resolve(dist,'index.html'),html,'utf8');process.stdout.write('Production browser build: '+relative(process.cwd(),dist)+'\n');
