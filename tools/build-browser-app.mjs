import {build} from 'esbuild';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import process from 'node:process';

const app=process.argv[2];
const configs={
  web:{entry:'apps/web/src/index.tsx',out:'apps/web/dist',title:'ELHAFEZ BUSINESS PLATFORM'},
  owner:{entry:'apps/owner/src/index.ts',out:'apps/owner/dist',title:'ELHAFEZ Owner Control Center'},
};
const config=configs[app];
if(!config)throw new Error('usage: node tools/build-browser-app.mjs <web|owner>');
const root=process.cwd(),outdir=resolve(root,config.out);
await rm(outdir,{recursive:true,force:true});
await mkdir(resolve(outdir,'assets'),{recursive:true});
await build({
  absWorkingDir:root,
  entryPoints:[config.entry],
  bundle:true,
  outdir:resolve(config.out,'assets'),
  entryNames:'app',
  assetNames:'[name]-[hash]',
  format:'esm',
  platform:'browser',
  target:['es2022'],
  minify:true,
  sourcemap:false,
  legalComments:'none',
  jsx:'automatic',
  define:{'process.env.NODE_ENV':'"production"'},
  logLevel:'info',
});
const html=`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="elhafez-api-base" content="/api">
<meta name="theme-color" content="#123c53">
<title>${config.title}</title>
<link rel="stylesheet" href="./assets/app.css">
</head>
<body>
<div id="root"></div>
<script type="module" src="./assets/app.js"></script>
</body>
</html>
`;
await writeFile(resolve(outdir,'index.html'),html,'utf8');
process.stdout.write(`Built ${app} browser artifact at ${config.out}\n`);
