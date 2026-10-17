/** SSR tests use the production CSS Modules compiler to obtain the real class map.
 * CSS rendering remains browser acceptance; every original test still executes.
 */
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { buildSync } from 'esbuild';
registerHooks({load(url,context,nextLoad){
 if(!url.startsWith('file:')||!url.endsWith('.module.css'))return nextLoad(url,context);
 const path=fileURLToPath(url),built=buildSync({stdin:{contents:`import classes from ${JSON.stringify(path)}; export default classes;`,resolveDir:dirname(path),loader:'js'},bundle:true,write:false,outdir:'/tmp/elhafez-css-module-ssr',format:'esm',platform:'browser',logLevel:'silent'});
 const source=built.outputFiles.find(file=>file.path.endsWith('.js'))?.text;
 if(!source)throw new Error('CSS Modules compilation produced no JavaScript class map');
 return {format:'module',source,shortCircuit:true};
}});
