// Isolated browser fixture: real app/domain/backend, controlled external SDK boundary.
import http from 'node:http';
import {readFile,mkdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),{handleRequest}=require('../../backend/api.cjs'),{memoryStore}=require('./cloud-memory.cjs');
const root=process.cwd(),port=Number(process.env.PAW_UI_CONTRACT_PORT??4197),base=`http://127.0.0.1:${port}`,buildRoot=join(tmpdir(),`paw-ui-contract-${process.pid}`);
await mkdir(buildRoot,{recursive:true});
await build({entryPoints:{app:join(root,'app.js'),style:join(root,'style.css')},bundle:true,format:'esm',platform:'browser',outdir:buildRoot,plugins:[{name:'fake-cloud-sdk-boundary',setup(builder){if(process.env.PAW_UI_CONTRACT_TRACE==='1')builder.onLoad({filter:/\/app\.js$/},async(args)=>({contents:(await readFile(args.path,'utf8')).replace('function handleAuthIdentityChange(principal){',"function handleAuthIdentityChange(principal){globalThis.__contractTrace??=[];globalThis.__contractTrace.push({event:'identity',next:principal?.userId,previous:authPrincipal?.userId,mode:workspaceMode,generation:session?.generation});").replace("if(workspaceTransition!==transition||authPrincipal?.userId!==next?.userId)return;","globalThis.__contractTrace.push({event:'transition-error',code:error.code,target:next?.userId,transition,current:workspaceTransition});if(workspaceTransition!==transition||authPrincipal?.userId!==next?.userId)return;").replace('let authorization=await auth.getRequestSession();',"let authorization=await auth.getRequestSession();globalThis.__contractTrace.push({event:'invoke-auth',action:request.action,bound:owner.userId,actual:authorization?.principal?.userId,generation,current:session?.generation});"),loader:'js'}));builder.onResolve({filter:/^@cloudbase\/js-sdk$/},()=>({path:'fake-sdk',namespace:'contract'}));builder.onLoad({filter:/.*/,namespace:'contract'},()=>({contents:'export default {init:()=>globalThis.__cloudContractApp};',loader:'js'}));}}],logLevel:'silent'});
let store,calls,objects,nextId,deniedA=false,holdA=false,held=[];
const principal=user=>({userId:user,emailVerified:true,isAnonymous:false});
const pet=(id,name)=>({id,name,type:'cat',avatarAssetId:null,birthday:null,estimatedAgeMonths:12,arrivalDate:null,breed:'',sex:'',image:'',deletedAt:null});
async function reset(){store=memoryStore();calls=[];objects=new Map();nextId=0;deniedA=false;holdA=false;held=[];for(const user of ['A','B'])await store.transactionOwned(principal(user),async tx=>{tx.workspace={snapshot:{version:3,mode:'account',activePetId:user+'-pet',pets:[pet(user+'-pet',user==='A'?'Alpha private pet':'Beta private pet')],records:[],reminders:[],posts:[],profile:{city:'深圳'}},revision:0};});}
await reset();
const storage={prepare:async path=>({fileRef:path,upload:{url:base+'/__upload/'+encodeURIComponent(path),method:'PUT',headers:{'x-contract-upload':'isolated'}}}),read:async(path,max)=>{const bytes=objects.get(path);if(!bytes||bytes.length>max)throw Error('unavailable');return bytes;},remove:async path=>{objects.delete(path);}};
async function bytes(request){const data=[];for await(const piece of request)data.push(piece);return Buffer.concat(data);}
const sdkSource=`(()=>{
 let current=null;const listeners=new Set();
 const converted=()=>current?{id:current,is_anonymous:false,email:current+'@example.invalid'}:null;
 globalThis.__contract={switchUser(id,{notify=true}={}){current=id;if(notify)for(const listener of listeners)listener('SIGNED_IN',{user:converted()});},current:()=>current,setSessionError(value){globalThis.__sessionError=value;},signOutCount:()=>globalThis.__signOutCount??0};
 const sdk={getSession:async()=>current==='A'&&globalThis.__sessionError?{error:{status:globalThis.__sessionError}}:({data:{session:current?{user:converted(),access_token:'fixture-token-'+current}:null,user:converted()}}),getUser:async()=>({data:{user:converted()}}),getUserInfo:async()=>current?{sub:current,email:current+'@example.invalid',email_verified:true,is_anonymous:false,created_at:'2026-10-07T00:00:00Z'}:null,signInWithOtp:async()=>({data:{verifyOtp:async()=>{current='A';globalThis.__sessionError=null;await fetch('/__auth_renew',{method:'POST'});for(const listener of listeners)listener('SIGNED_IN',{user:converted()});return {data:{user:converted()}};}}}),signOut:async()=>{globalThis.__signOutCount=(globalThis.__signOutCount??0)+1;current=null;for(const listener of listeners)listener('SIGNED_OUT',null);},onAuthStateChange:listener=>{listeners.add(listener);return {data:{subscription:{unsubscribe:()=>listeners.delete(listener)}}};}};
 globalThis.__cloudContractApp={auth:()=>sdk,callFunction:async({data})=>{const response=await fetch('/__contract_api',{method:'POST',headers:{'content-type':'application/json','x-fixture-principal':current??''},body:JSON.stringify(data)});return {result:await response.json()};}};
 globalThis.__PAW_PUBLIC_CONFIG__={enabled:true,environmentId:'isolated-contract',publishableKey:'fixture-public-key'};
})();`;
let html=await readFile(join(root,'index.html'),'utf8');html=html.replace(/src="app\.js[^"]*"/,'src="/app.js"').replace(/href="style\.css[^"]*"/,'href="/style.css"').replace('</head>','<script src="/__contract_sdk.js"></script></head>');
const json=(response,value)=>{response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify(value));};
const server=http.createServer(async(request,response)=>{try{
 const pathname=new URL(request.url,base).pathname;
 if(pathname==='/__reset'){await reset();return json(response,{ok:true});}
 if(pathname==='/__control'){const value=JSON.parse((await bytes(request)).toString());deniedA=value.deniedA===true;holdA=value.holdA===true;return json(response,{ok:true});}
 if(pathname==='/__auth_renew'){deniedA=false;return json(response,{ok:true});}
 if(pathname==='/__release'){holdA=false;for(const resume of held.splice(0))resume();return json(response,{ok:true});}
 if(pathname==='/__state'){const owners={};for(const user of ['A','B'])owners[user]=await store.readOwned(principal(user));return json(response,{calls,owners,objectCount:objects.size,held:held.length});}
 if(pathname==='/__legacy_schema.js'){response.writeHead(200,{'content-type':'text/javascript'});return response.end(execFileSync('git',['show','v0.2.0:src/domain/schema.js'],{cwd:root,encoding:'utf8'}));}
 if(pathname==='/__contract_sdk.js'){response.writeHead(200,{'content-type':'text/javascript'});return response.end(sdkSource);}
 if(pathname==='/__contract_api'){
  const data=JSON.parse((await bytes(request)).toString()),user=request.headers['x-fixture-principal'];
  // Header represents trusted platform context; token presence and exact UI routing are independently asserted.
  const result=user&&(!data.authToken||data.authToken==='fixture-token-'+user)?await handleRequest(data,{principal:deniedA&&user==='A'?null:principal(user),store,storage,clock:()=>new Date().toISOString(),idFactory:()=>`contract-${++nextId}`}):{ok:false,error:{code:'UNAUTHENTICATED',messageKey:'errors.unauthenticated'}};
  calls.push({user,idempotencyKey:data.idempotencyKey,action:data.action,payload:data.payload,hasAuthToken:!!data.authToken,tokenInPayload:!!data.payload?.authToken,expectedWorkspaceId:data.expectedWorkspaceId,ok:result.ok,error:result.error?.code});if(holdA&&user==='A'&&data.action==='records.save')await new Promise(resolve=>held.push(resolve));return json(response,result);
 }
 if(pathname.startsWith('/__upload/')){objects.set(decodeURIComponent(pathname.slice('/__upload/'.length)),await bytes(request));response.writeHead(200);return response.end();}
 if(pathname==='/'||pathname==='/paw-diary/'){response.writeHead(200,{'content-type':'text/html'});return response.end(html);}
 const file=pathname==='/app.js'||pathname==='/style.css'?join(buildRoot,pathname.slice(1)):pathname.startsWith('/src/')||pathname.startsWith('/assets/')?resolve(root,'.'+pathname):null;
 if(!file||file.includes('..')||!file.startsWith(root)&&!file.startsWith(buildRoot)){response.writeHead(404);return response.end();}
 const content=await readFile(file);response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});response.end(content);
 }catch{response.writeHead(500);response.end('Fixture request failed');}});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));console.log('Isolated UI contract fixture ready on '+base);
async function stop(){server.close();await rm(buildRoot,{recursive:true,force:true});process.exit(0);}process.on('SIGTERM',stop);process.on('SIGINT',stop);
