import test from 'node:test';import assert from 'node:assert/strict';import {createRequire,Module} from 'node:module';import {buildSync} from 'esbuild';
const require=createRequire(import.meta.url);
const {emailHash}=require('../backend/email-auth.cjs');
const functions=['paw-auth','paw-api','paw-files','paw-ai','paw-community'];
function entry(name,{proof,profile={sub:'A',email:'a@example.test',email_verified:true}}={}){
 const db={runTransaction:async fn=>fn({collection:()=>({doc:()=>({get:async()=>({data:proof?{value:proof}:undefined}),set:async()=>({})})})})};
 const sdk={init:()=>({auth:()=>({getAuthContext:async()=>({uid:'A'}),getUserInfo:()=>({uid:'A',isAnonymous:false})}),database:()=>db}),getCloudbaseContext:()=>({TCB_UUID:'A',TCB_ISANONYMOUS_USER:'false',TCB_SOURCE_IP:'127.0.0.1'})};
 const compiled=new Module(import.meta.filename);compiled.paths=Module._nodeModulePaths(process.cwd());compiled.require=id=>id==='@cloudbase/node-sdk'?sdk:require(id);
 const built=buildSync({entryPoints:[`cloudfunctions/${name}/index.js`],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'silent'});
 compiled._compile(built.outputFiles[0].text,import.meta.filename);return compiled.exports;
}
async function envRun(flag,fn){const keys=['PAW_BETA_GATE_ENABLED','PAW_BETA_INVITE_CODE','PAW_CLOUD_PUBLISHABLE_KEY'],previous=keys.map(k=>process.env[k]),fetch=globalThis.fetch;try{if(flag===undefined)delete process.env.PAW_BETA_GATE_ENABLED;else process.env.PAW_BETA_GATE_ENABLED=flag;process.env.PAW_BETA_INVITE_CODE='012349';process.env.PAW_CLOUD_PUBLISHABLE_KEY='synthetic-public';globalThis.fetch=async()=>Response.json({sub:'A',email:'a@example.test',email_verified:true});return await fn();}finally{keys.forEach((k,i)=>previous[i]===undefined?delete process.env[k]:process.env[k]=previous[i]);globalThis.fetch=fetch;}}
for(const name of functions){
 test(`${name} production entry rejects absent beta configuration instead of failing open or masking it`,async()=>envRun(undefined,async()=>{const r=await entry(name).main({action:'auth.session',payload:{},authToken:'valid-A'},{});assert.equal(r.error?.code,'BETA_CONFIG_INVALID');assert.equal(r.error?.messageKey,'errors.beta_config_invalid');}));
 test(`${name} production entry rejects verified-email credentials without admission with reviewed error`,async()=>envRun('true',async()=>{const r=await entry(name).main({version:1,action:'auth.session',payload:{},authToken:'valid-A'},{});assert.equal(r.error?.code,'BETA_ACCESS_REQUIRED');assert.equal(r.error?.messageKey,'errors.beta_access_required');}));
}
test('production auth requires configured code while other four entrypoints do not require it',async()=>envRun('true',async()=>{delete process.env.PAW_BETA_INVITE_CODE;const r=await entry('paw-auth').main({action:'auth.requestEmailCode',payload:{email:'a@example.test',betaCode:'012349'}},{});assert.equal(r.error?.code,'BETA_CONFIG_INVALID');for(const name of functions.slice(1)){const r=await entry(name).main({version:1,action:'auth.session',payload:{},authToken:'valid-A'},{});assert.equal(r.error?.code,'BETA_ACCESS_REQUIRED');}}));
test('community factory preserves public anonymous reads but does not downgrade nonadmitted credentials',async()=>{
 const {createCommunityEntrypoint}=entry('paw-community'),{createMemoryCommunityStore}=require('../backend/community/store.cjs');const main=createCommunityEntrypoint({app:{auth:()=>({getAuthContext:async()=>({uid:'A'}),getUserInfo:()=>({uid:'A',isAnonymous:false})})},getPlatformContext:()=>({TCB_UUID:'A',TCB_ISANONYMOUS_USER:'false'}),readVerifiedProfile:async()=>({sub:'A',email:'a@example.test',email_verified:true}),readVerifiedProof:async()=>null,betaPolicy:{enabled:true},store:createMemoryCommunityStore(),storage:{},regions:{}});
 const base={version:1,action:'profiles.discover',payload:{}};assert.equal((await main(base,{})).ok,true);assert.equal((await main({...base,authToken:'valid-A'},{})).error?.code,'BETA_ACCESS_REQUIRED');
});
test('persisted valid legacy admission allows production auth session after code rotation',async()=>envRun('true',async()=>{
 const proof={kind:'verified',ownerId:'A',emailHash:emailHash('a@example.test'),verifiedAt:'2026-10-07T00:00:00Z',betaAdmission:{version:1,source:'legacy',grantedAt:'2026-10-08T00:00:00Z'}};
 assert.deepEqual(await entry('paw-auth',{proof}).main({action:'auth.session',payload:{},authToken:'valid-A'},{}),{ok:true,data:{principal:{userId:'A'}}});
}));
