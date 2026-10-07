// Test-only SDK observer. Uses production init/storage and genuine setSession.
import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const output=process.argv[process.argv.indexOf('--outfile')+1];
if(!process.argv.includes('--outfile')||!output)throw new Error('BOOTSTRAP_OUTPUT_REQUIRED');
const version=JSON.parse(await readFile(new URL('../../node_modules/@cloudbase/js-sdk/package.json',import.meta.url),'utf8')).version;
await mkdir(dirname(resolve(output)),{recursive:true});
const source=`import cloudbase from '@cloudbase/js-sdk';
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
};globalThis.__realAuthAcceptance.community=async request=>{const sdk=auth(),session=(await sdk.getSession())?.data?.session;const raw=await app.callFunction({name:'paw-community',data:{...request,...(session?.access_token?{authToken:session.access_token}:{})}});let reply=raw.result??raw;if(typeof reply==='string')reply=JSON.parse(reply);return reply;};`;
await build({stdin:{contents:source,resolveDir:resolve(new URL('../..',import.meta.url).pathname),sourcefile:'browser-session-observer.js'},bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,outfile:resolve(output),logLevel:'silent'});
console.log(JSON.stringify({bootstrapBuilt:true,sdkVersionExpected:version==='3.10.1'}));
