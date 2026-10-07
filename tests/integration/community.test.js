import test from 'node:test';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createIsolatedClient} from './cloud-harness.js';
import {communityRealConfiguration,verifyCommunitySessionFiles,runCommunityAcceptance,persistCommunityReceipt} from '../helpers/community-real-scenario.mjs';
// Run only after closing all GUI sessions for these same A/B actors.
// node --test tests/integration/community.test.js
// A: PAW_DIARY_REAL_SESSIONS_FILE; B: PAW_DIARY_STAGE4_B_SESSIONS_FILE (or same A file).
test('real verified A/B and tokenless public community preserve ownership, receipts, bytes and exact cleanup',{timeout:240000},async()=>{
 const runId='community-real-'+randomUUID(),receiptPath='test-results/stage4/community-integration-receipts/'+runId+'.json',clients={};
 try{
  const config=JSON.parse(await fs.readFile(new URL('../../src/config/cloud-environment.json',import.meta.url),'utf8'));
  const configuration=communityRealConfiguration({config});await verifyCommunitySessionFiles(configuration);
  const common={envId:configuration.envId,publicKey:configuration.publicKey};
  // Separate SDK worker caches; sequential installation never races one actor's refresh token.
  clients.A=await createIsolatedClient({...common,sessionPath:configuration.aPath,label:'A'});
  clients.B=await createIsolatedClient({...common,sessionPath:configuration.bPath,label:'B'});
  clients.anonymous=await createIsolatedClient({...common,label:'unauthenticated'});
  for(const actor of['A','B','anonymous']){const flags=await clients[actor].environmentFlags();if(flags.managementCredentialsPresent||flags.sdkTestTokenOverridePresent)throw Object.assign(Error('REAL_COMMUNITY_WORKER_CREDENTIAL_ISOLATION_FAILED'),{code:'REAL_COMMUNITY_WORKER_CREDENTIAL_ISOLATION_FAILED'});}
  const result=await runCommunityAcceptance({clients,runId,persist:receipt=>persistCommunityReceipt(receiptPath,receipt)});
  console.log(JSON.stringify({ok:true,flags:result.flags,receiptPath}));
 }catch(error){const code=/^[A-Z0-9_]{1,80}$/.test(error?.code??'')?error.code:/^REAL_CLOUD_[A-Z0-9_]{1,80}$/.test(error?.message??'')?error.message:'REAL_COMMUNITY_ACCEPTANCE_FAILED';throw Object.assign(new Error(code),{code});}
 finally{const closed=await Promise.allSettled(Object.values(clients).map(client=>client.close()));if(closed.some(r=>r.status==='rejected'))throw Object.assign(new Error('REAL_COMMUNITY_CLIENT_CLOSE_FAILED'),{code:'REAL_COMMUNITY_CLIENT_CLOSE_FAILED'});}
});
