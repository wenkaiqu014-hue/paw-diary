import {build} from 'esbuild';
import {mkdir,readFile,writeFile,rm,cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
const root=process.cwd(),arg=process.argv.indexOf('--outdir');
const outdir=resolve(arg>=0?process.argv[arg+1]:join(root,'dist'));
if(outdir!==join(root,'dist')&&!(outdir.startsWith(resolve(tmpdir())+'/')&&basename(outdir).startsWith('paw-build-')))throw new Error('Output must be project dist or an isolated paw-build temporary directory');
await rm(outdir,{recursive:true,force:true});await mkdir(join(outdir,'assets'),{recursive:true});
await cp(join(root,'assets'),join(outdir,'assets'),{recursive:true});
const bundled=await build({entryPoints:{app:'app.js',style:'style.css'},bundle:true,format:'esm',platform:'browser',target:['es2022'],outdir:join(outdir,'assets'),entryNames:'[name]-[hash]',assetNames:'[name]-[hash]',metafile:true,minify:true,logLevel:'silent'});
const output=Object.keys(bundled.metafile.outputs).map(f=>f.replaceAll('\\','/'));
const app=output.find(f=>/\/app-[A-Z0-9]+\.js$/i.test(f));const style=output.find(f=>/\/style-[A-Z0-9]+\.css$/i.test(f));
if(!app||!style)throw new Error('Missing hashed entry');
let html=await readFile(join(root,'index.html'),'utf8');
html=html.replace(/src="app\.js[^"]*"/,'src="assets/'+basename(app)+'"').replace(/href="style\.css[^"]*"/,'href="assets/'+basename(style)+'"');
let fileConfig={};try{fileConfig=JSON.parse(await readFile(process.env.PAW_CLOUD_CONFIG_PATH??'src/config/cloud-environment.json','utf8'));}catch{}
const config={environmentId:process.env.PAW_CLOUD_ENV_ID??fileConfig.environmentId??fileConfig.env??'paw-diary-d8g3p4tlsb305221d',region:'ap-shanghai',aiEnabled:process.env.PAW_AI_ENABLED!==undefined?process.env.PAW_AI_ENABLED==='true':fileConfig.aiEnabled===true,communityEnabled:process.env.PAW_COMMUNITY_ENABLED!==undefined?process.env.PAW_COMMUNITY_ENABLED==='true':fileConfig.communityEnabled===true,publishableKey:process.env.PAW_CLOUD_PUBLISHABLE_KEY??fileConfig.publishableKey??'',enabled:process.env.PAW_CLOUD_ENABLED!==undefined?process.env.PAW_CLOUD_ENABLED==='true':fileConfig.enabled===true};
const encoded=JSON.stringify(config).replaceAll('<','\\u003c');html=html.replace('</head>','<script>globalThis.__PAW_PUBLIC_CONFIG__='+encoded+';</script>\n</head>');
await writeFile(join(outdir,'index.html'),html);await writeFile(join(outdir,'.nojekyll'),'');
const legacy=execFileSync('git',['ls-tree','-r','--name-only','v0.2.0','--','app.js','style.css','src'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const file of legacy){if(!/^(app\.js|style\.css|src\/[^.].*\.js)$/.test(file)||file.includes('..'))throw new Error('Invalid legacy public path');const target=join(outdir,file);await mkdir(dirname(target),{recursive:true});await writeFile(target,execFileSync('git',['show','v0.2.0:'+file]));}
await writeFile(join(outdir,'asset-manifest.json'),JSON.stringify({app:'assets/'+basename(app),style:'assets/'+basename(style),legacyVersion:'0.2.0'},null,2));
console.log('Static public build ready; no server sources published.');
