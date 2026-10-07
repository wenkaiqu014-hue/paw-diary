import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const sdkVersion=JSON.parse(await readFile('node_modules/@cloudbase/node-sdk/package.json','utf8')).version;
for(const name of ['paw-api','paw-auth','paw-ai']){
const target='test-results/stage3/functions/'+name;await mkdir(target,{recursive:true});
await build({entryPoints:['cloudfunctions/'+name+'/index.js'],bundle:true,platform:'node',format:'cjs',target:['node18'],outfile:target+'/index.js',alias:{'lodash.set':'lodash/set.js','lodash.unset':'lodash/unset.js'},plugins:[{name:'sdk-version',setup(b){b.onLoad({filter:/@cloudbase\/node-sdk\/dist\/utils\/version\.js$/},()=>({contents:'exports.version='+JSON.stringify(sdkVersion)+';',loader:'js'}));}}],logLevel:'warning'});
await writeFile(target+'/package.json',JSON.stringify({name,version:'1.0.0',main:'index.js',type:'commonjs'},null,2));
}
console.log('Function bundles ready in ignored test-results directory.');
