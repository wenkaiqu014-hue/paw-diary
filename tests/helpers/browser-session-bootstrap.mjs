// Test-only SDK observer. Uses production init/storage and genuine setSession.
import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const output=process.argv[process.argv.indexOf('--outfile')+1];
if(!process.argv.includes('--outfile')||!output)throw new Error('BOOTSTRAP_OUTPUT_REQUIRED');
const version=JSON.parse(await readFile(new URL('../../node_modules/@cloudbase/js-sdk/package.json',import.meta.url),'utf8')).version;
await mkdir(dirname(resolve(output)),{recursive:true});
const source=`import cloudbase from '@cloudbase/js-sdk';
import {createCloudRepository} from './src/data/cloud-repository.js';
import {createCloudMediaRepository} from './src/data/cloud-media-repository.js';
import {processImage} from './src/media/process-image.js';
const deadline=promise=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('SDK_TIMEOUT')),8000))]);
let app;
const auth=()=>{const c=globalThis.__PAW_PUBLIC_CONFIG__;if(!c?.environmentId||!c?.publishableKey)throw new Error('SDK_CONFIG_MISSING');app??=cloudbase.init({env:c.environmentId,region:c.region,accessKey:c.publishableKey});return app.auth();};
const credentials=s=>{if(!s?.access_token||!s?.refresh_token)return null;const result={access_token:s.access_token,refresh_token:s.refresh_token};for(const k of ['version','token_type','scope','expires_in','expires_at'])if(s[k]!==undefined)result[k]=s[k];return JSON.parse(JSON.stringify(result));};
globalThis.__realAuthAcceptance={
 version:${JSON.stringify(version)},
 async inspect(){
  const sdk=auth(),initial=await deadline(sdk.getSession());
  let reply=initial,userRefreshed=false,profileReadFailed=false;
  if(initial?.data?.session){
   try{const fresh=await deadline(sdk.getUser(true));userRefreshed=!fresh?.error&&!!fresh?.data?.user;profileReadFailed=!userRefreshed;}
   catch{profileReadFailed=true;}
   // Profile reads can auto-renew expired credentials. Always export the
   // current session after that read, including when the profile read failed.
   reply=await deadline(sdk.getSession());
  }
  const s=reply?.data?.session,user=userRefreshed?(reply?.data?.user??s?.user):null;
  return {session:credentials(s),identity:typeof user?.id==='string'?user.id:null,flags:{sdkReady:true,sdkVersionExpected:${JSON.stringify(version)}==='3.10.1',sdkError:!!initial?.error||!!reply?.error||profileReadFailed,userRefreshed,profileReadFailed,hasAccess:!!s?.access_token,hasRefresh:!!s?.refresh_token,signedIn:!!user?.id,isAnonymous:user?.is_anonymous===true}};
 },
 async install(tokens){const result=await deadline(auth().setSession(tokens));return {installed:!result?.error,sdkError:!!result?.error};}
};globalThis.__realAuthAcceptance.community=async request=>{const sdk=auth(),session=(await sdk.getSession())?.data?.session;const raw=await app.callFunction({name:'paw-community',data:{...request,...(session?.access_token?{authToken:session.access_token}:{})}});let reply=raw.result??raw;if(typeof reply==='string')reply=JSON.parse(reply);return reply;};
// Restricted to the one explicitly labelled synthetic B fixture; outputs safe stage flags only.
globalThis.__realAuthAcceptance.avatarDiagnostic=async()=>{
 const stages=[],safeCode=e=>/^[A-Za-z0-9_.-]{1,80}$/.test(e?.code??'')?e.code:'UNAVAILABLE';
 try{
  const sdk=auth(),user=(await sdk.getUser(true))?.data?.user;
  if(!user?.id)throw Object.assign(Error(),{code:'UNAUTHENTICATED'});
  const invoke=async request=>{const start=performance.now(),session=(await sdk.getSession())?.data?.session;try{const raw=await app.callFunction({name:'paw-api',data:{...request,authToken:session?.access_token}});let reply=raw.result??raw;if(typeof reply==='string')reply=JSON.parse(reply);stages.push({stage:request.action,ms:Math.round(performance.now()-start),ok:reply?.ok===true,...(reply?.error?.code?{code:safeCode(reply.error)}:{})});return reply;}catch(e){stages.push({stage:request.action,ms:Math.round(performance.now()-start),ok:false,code:safeCode(e),timeout:/timeout|TIMEOUT|超时/.test(e?.message??'')});throw e;}};
  const repo=createCloudRepository({invoke,principal:{userId:user.id}}),snapshot=await repo.snapshot();
  const pets=snapshot.pets.filter(p=>p.deletedAt===null&&/^纯合成阶段5验收宠物-B-[a-f0-9]{7}$/.test(p.name));
  if(pets.length!==1)throw Object.assign(Error(),{code:'SYNTHETIC_FIXTURE_REQUIRED'});
  const response=await fetch('assets/dog.jpg');if(!response.ok)throw Object.assign(Error(),{code:'PRESET_UNAVAILABLE'});
  const prepared=await processImage(await response.blob(),{kind:'avatar'});
  stages.push({stage:'image.prepared',ok:true});
  const media=createCloudMediaRepository({repository:repo,upload:async(upload,blob)=>{const start=performance.now();try{const result=await fetch(upload.url,{method:'PUT',headers:upload.headers,body:blob});stages.push({stage:'object.put',ms:Math.round(performance.now()-start),ok:result.ok,status:result.status});if(!result.ok)throw Object.assign(Error(),{code:'OBJECT_PUT_FAILED'});}catch(e){stages.push({stage:'object.put.failure',ms:Math.round(performance.now()-start),ok:false,code:safeCode(e)});throw e;}}});
  await media.save({petId:pets[0].id,kind:'avatar',blob:prepared.blob,preparedImage:prepared});
  return {ok:true,stages};
 }catch(e){return {ok:false,code:safeCode(e),stages};}
};`;
await build({stdin:{contents:source,resolveDir:resolve(new URL('../..',import.meta.url).pathname),sourcefile:'browser-session-observer.js'},bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,outfile:resolve(output),logLevel:'silent'});
console.log(JSON.stringify({bootstrapBuilt:true,sdkVersionExpected:version==='3.10.1'}));
