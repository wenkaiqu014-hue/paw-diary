import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
const root=process.cwd();
async function files(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())result.push(...await files(file));else result.push(file);}return result;}
test('static build excludes server/private files and management secret values',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'paw-build-'));
 try{
  const secret='PAW_BUILD_TEST_SECRET_SENTINEL_NEVER_PUBLISH';
  const r=spawnSync(process.execPath,['scripts/build.mjs','--outdir',dir],{cwd:root,env:{...process.env,TENCENTCLOUD_FUJI_SECRET_KEY:secret,MINIMAX_API_KEY:secret},encoding:'utf8'});
  assert.equal(r.status,0,'static build must execute successfully');
  const list=await files(dir),names=list.map(f=>relative(dir,f));
  assert.equal(names.some(n=>/^(backend|cloudfunctions|docs|tests|node_modules)\//.test(n)||n.startsWith('.env')||n==='SESSION_LOG.md'),false);
  for(const file of list){if(/\.(js|html|css|json)$/.test(file))assert.equal((await readFile(file,'utf8')).includes(secret),false,relative(dir,file)+' must not contain a secret');}
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('new entry references hashed assets and immutable legacy app graph stays accessible',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'paw-build-'));
 try{
  const r=spawnSync(process.execPath,['scripts/build.mjs','--outdir',dir],{cwd:root,encoding:'utf8'});assert.equal(r.status,0);
  const html=await readFile(join(dir,'index.html'),'utf8');
  assert.match(html,/assets\/app-[a-zA-Z0-9]+\.js/);assert.match(html,/assets\/style-[a-zA-Z0-9]+\.css/);
  for(const hash of ['home','health','nearby','community'])assert.ok(html.includes('#'+hash));
  assert.deepEqual(await readFile(join(dir,'app.js')),execFileSync('git',['show','v0.2.0:app.js'],{cwd:root}));
  assert.deepEqual(await readFile(join(dir,'src/domain/schema.js')),execFileSync('git',['show','v0.2.0:src/domain/schema.js'],{cwd:root}));
  const entry=html.match(/src="([^"]*app-[a-zA-Z0-9]+\.js)"/);assert.ok(entry);assert.ok((await readFile(join(dir,entry[1]),'utf8')).length>100);
 }finally{await rm(dir,{recursive:true,force:true});}
});
