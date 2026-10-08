import fs from 'node:fs/promises';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {createIsolatedClient} from '../integration/cloud-harness.js';
const require=createRequire(import.meta.url),cfg=JSON.parse(await fs.readFile('src/config/cloud-environment.json','utf8')),runtime=JSON.parse(await fs.readFile('test-results/v100/private/beta-runtime.json','utf8'));
const app=require('@cloudbase/node-sdk').init({env:cfg.environmentId,region:'ap-shanghai',secretId:process.env.TENCENTCLOUD_FUJI_SECRET_ID,secretKey:process.env.TENCENTCLOUD_FUJI_SECRET_KEY}),db=app.database();
const found=await db.collection('auth_verified').where({'value.emailHash':createHash('sha256').update(runtime.testEmail.trim()).digest('hex')}).limit(2).get();
if(found.code||found.data?.length!==1)throw Error('EXACT_NEW_ACTOR_PROOF_REQUIRED');
const saved=found.data[0],uid=saved.value.ownerId,id=createHash('sha256').update('p:'+uid).digest('hex');if(saved._id!==id||saved.value.betaAdmission?.source!=='invite')throw Error('EXACT_INVITED_ACTOR_REQUIRED');
const proof={...saved.value};delete proof.betaAdmission;
let client,removed=false;
const checks=[];
try{
 client=await createIsolatedClient({envId:cfg.environmentId,publicKey:cfg.publishableKey,sessionPath:'/Users/wenkaiqu/ClaudeInternal/Daily/paw-diary/.worktrees/stage2/test-results/stage2/real-sessions.json',label:'C'});
 const flags=await client.environmentFlags();if(flags.managementCredentialsPresent||flags.sdkTestTokenOverridePresent)throw Error('CLIENT_CREDENTIAL_ISOLATION_FAILED');
 const positive=await client.namedFunction('paw-auth',{action:'auth.session',payload:{}});if(!positive.ok)throw Error('INVITED_ACTOR_NOT_AUTHORIZED');
 await db.collection('auth_verified').doc(id).set({value:proof});removed=true;
 for(const [name,action] of [['paw-auth','auth.session'],['paw-api','health.snapshot'],['paw-files','files.read'],['paw-ai','ai.assistant'],['paw-community','profiles.getOwn']]){
  const r=await client.namedFunction(name,{version:1,action,payload:{betaAdmission:{version:1,source:'invite',grantedAt:new Date().toISOString()}}});
  if(r.ok||r.error?.code!=='BETA_ACCESS_REQUIRED')throw Error('REAL_BETA_GATE_NOT_ENFORCED');
  checks.push({function:name,signedRealActor:true,forgedClientAdmissionRejected:true,errorCode:r.error.code});
 }
}finally{
 if(removed){const latest=await db.collection('auth_verified').doc(id).get();const current=latest.data?.[0]?.value;if(current?.ownerId!==uid||current.emailHash!==proof.emailHash||current.verifiedAt!==proof.verifiedAt)throw Error('PROOF_CHANGED_DURING_GATE_TEST');await db.collection('auth_verified').doc(id).set({value:saved.value});}
 if(client)await client.close();
}
await fs.writeFile('test-results/v100/real-gates.json',JSON.stringify({checks,admissionRestored:true,healthDataNotChanged:true,clientCredentialsIsolated:true},null,2));
console.log(JSON.stringify({fiveRealGates:checks.length,admissionRestored:true,clientCredentialsIsolated:true}));
