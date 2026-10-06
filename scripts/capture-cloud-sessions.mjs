// Acceptance helper only. Emails/codes arrive over stdin; tokens never go to stdout.
import {isMainThread,Worker,parentPort,workerData} from 'node:worker_threads';
import {readFile,writeFile,rename,mkdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createInterface} from 'node:readline';

const labels=new Set(['A','B','anonymous']);
const fail=code=>Object.assign(new Error(code),{code});
const codeOf=error=>/^[A-Z_]{1,80}$/.test(error?.code??'')?error.code:'ACCEPTANCE_OPERATION_FAILED';
function validateConfig(config){
 if(typeof config?.env!=='string'||!/^paw-diary(?:-prod)?-[a-z0-9]+$/.test(config.env)||config.region!=='ap-shanghai'||config.keyType!=='publish_key'||typeof config.publishableKey!=='string'||!config.publishableKey)throw fail('ACCEPTANCE_PUBLIC_CONFIG_INVALID');
 return config;
}

if(!isMainThread){
 const cloudbase=(await import('@cloudbase/js-sdk')).default;
 const config=validateConfig(workerData.config),auth=cloudbase.init({env:config.env,region:config.region,accessKey:config.publishableKey,persistence:'none',debug:false}).auth();
 let verify=null;
 parentPort.on('message',async({id,command})=>{
  try{
   let result;
   if(command.op==='request'){
    if(workerData.label==='anonymous'||typeof command.email!=='string'||command.email.length>254||!/^\S+@\S+\.\S+$/.test(command.email.trim()))throw fail('ACCEPTANCE_EMAIL_INVALID');
    if(verify)throw fail('ACCEPTANCE_CHALLENGE_ALREADY_PENDING');
    const reply=await auth.signInWithOtp({email:command.email.trim(),options:{shouldCreateUser:true}});
    if(reply?.error||typeof reply?.data?.verifyOtp!=='function')throw fail('ACCEPTANCE_EMAIL_REQUEST_FAILED');
    verify=reply.data.verifyOtp;result={requested:true};
   }else if(command.op==='verify'||command.op==='anonymous'){
    if(command.op==='verify'){
     if(!verify||typeof command.code!=='string'||!/^[0-9]{4,10}$/.test(command.code.trim()))throw fail('ACCEPTANCE_CODE_INVALID');
     const reply=await verify({token:command.code.trim()});if(reply?.error)throw fail('ACCEPTANCE_CODE_REJECTED');
    }else{
     if(workerData.label!=='anonymous'||command.providerTemporarilyEnabled!==true)throw fail('ACCEPTANCE_ANONYMOUS_PROVIDER_NOT_CONFIRMED');
     const reply=await auth.signInAnonymously();if(reply?.error)throw fail('ACCEPTANCE_ANONYMOUS_LOGIN_FAILED');
    }
    const reply=await auth.getSession(),session=reply?.data?.session,user=session?.user,raw=await auth.getUserInfo();
    if(reply?.error||typeof session?.access_token!=='string'||typeof session?.refresh_token!=='string'||!session.access_token||!session.refresh_token)throw fail('ACCEPTANCE_SESSION_INVALID');
    const anonymous=workerData.label==='anonymous';
    if(typeof user?.id!=='string'||user.id!==(raw?.sub??raw?.uid??raw?.id))throw fail('ACCEPTANCE_IDENTITY_MISMATCH');
    if(anonymous?user.is_anonymous!==true:user.is_anonymous!==false||raw.email_verified!==true||typeof raw.email!=='string'||!raw.email)throw fail('ACCEPTANCE_IDENTITY_NOT_VERIFIED');
    verify=null;
    result={session:{access_token:session.access_token,refresh_token:session.refresh_token},emailVerified:raw.email_verified===true,isAnonymous:anonymous};
   }else throw fail('ACCEPTANCE_COMMAND_INVALID');
   parentPort.postMessage({id,ok:true,result});
  }catch(error){parentPort.postMessage({id,ok:false,errorCode:codeOf(error)});}
 });
 parentPort.postMessage({ready:true});
}else{
 const args=process.argv.slice(2);
 if(args.includes('--help')){
  console.log('Acceptance-only isolated SDK capture. --check validates config without sending email.');
  console.log('Config: test-results/stage2/public-config.json. Output: test-results/stage2/real-sessions.json (0600).');
  console.log('Read JSON stdin: {op:request,label:A|B,email:...}, {op:verify,label:A|B,code:...}.');
  console.log('Anonymous capture requires the explicit providerTemporarilyEnabled flag after a guarded temporary provider change.');
  process.exit(0);
 }
 const root=process.cwd(),config=validateConfig(JSON.parse(await readFile(resolve(root,'test-results/stage2/public-config.json'),'utf8')));
 if(args.includes('--check')){console.log(JSON.stringify({configValid:true,platformSetupReady:config.platformSetupReady===true,networkCalled:false}));process.exit(0);}
 if(config.platformSetupReady!==true)throw fail('ACCEPTANCE_PLATFORM_NOT_READY');
 const output=resolve(root,'test-results/stage2/real-sessions.json'),workers=new Map();
 let sequence=0;
 const environment={TZ:'Asia/Shanghai'};
 for(const key of ['PATH','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy','NODE_EXTRA_CA_CERTS'])if(typeof process.env[key]==='string')environment[key]=process.env[key];
 async function client(label){
  if(workers.has(label))return workers.get(label);
  const worker=new Worker(new URL(import.meta.url),{workerData:{config,label},env:environment,stdout:true,stderr:true});worker.stdout.resume();worker.stderr.resume();
  const pending=new Map();let readyResolve,readyReject;
  const ready=new Promise((yes,no)=>{readyResolve=yes;readyReject=no;});
  const timer=setTimeout(()=>readyReject(fail('ACCEPTANCE_WORKER_START_TIMEOUT')),30000);
  worker.on('message',message=>{if(message.ready){readyResolve();return;}const request=pending.get(message.id);if(!request)return;clearTimeout(request.timer);pending.delete(message.id);message.ok?request.resolve(message.result):request.reject(fail(message.errorCode));});
  worker.on('error',()=>{readyReject(fail('ACCEPTANCE_WORKER_FAILED'));for(const request of pending.values()){clearTimeout(request.timer);request.reject(fail('ACCEPTANCE_WORKER_FAILED'));}pending.clear();});
  const rpc=command=>new Promise((yes,no)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);no(fail('ACCEPTANCE_OPERATION_TIMEOUT'));},30000);pending.set(id,{resolve:yes,reject:no,timer});worker.postMessage({id,command});});
  const value={worker,rpc};workers.set(label,value);
  try{await ready;}catch(error){await worker.terminate();workers.delete(label);throw error;}finally{clearTimeout(timer);}
  return value;
 }
 async function save(label,session){
  let document={envId:config.env};
  try{const info=await stat(output);if(!info.isFile()||(info.mode&0o77)!==0)throw fail('ACCEPTANCE_SESSION_FILE_NOT_PRIVATE');document=JSON.parse(await readFile(output,'utf8'));if(document.envId!==config.env)throw fail('ACCEPTANCE_SESSION_ENV_MISMATCH');}catch(error){if(error.code!=='ENOENT')throw error;}
  document[label]=session;await mkdir(dirname(output),{recursive:true});
  const temp=output+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify(document),{mode:0o600,flag:'wx'});await rename(temp,output);
 }
 const stop=async()=>{await Promise.all([...workers.values()].map(({worker})=>worker.terminate()));};
 process.once('SIGINT',async()=>{await stop();process.exit(130);});
 process.once('SIGTERM',async()=>{await stop();process.exit(143);});
 console.log(JSON.stringify({ready:true,mailSent:false,sessionFilePublic:false}));
 try{
  for await(const line of createInterface({input:process.stdin,terminal:false})){
   try{
    const command=JSON.parse(line);if(!labels.has(command.label))throw fail('ACCEPTANCE_LABEL_INVALID');
    const result=await(await client(command.label)).rpc(command);
    if(result.session){await save(command.label,result.session);console.log(JSON.stringify({label:command.label,saved:true,emailVerified:result.emailVerified,isAnonymous:result.isAnonymous}));}
    else console.log(JSON.stringify({label:command.label,codeRequested:result.requested===true}));
   }catch(error){console.log(JSON.stringify({ok:false,errorCode:codeOf(error)}));}
  }
 }finally{await stop();}
}
