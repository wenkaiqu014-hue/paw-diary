import test from 'node:test';
import assert from 'node:assert/strict';
test('AI transport discards responses after a pet switch and never retries',async()=>{
  const {createAiClient}=await import('../src/ai/client.js');
  let finish,calls=0;let scope={generation:1,mode:'local',workspaceId:'local:a',petId:'a',repository:{}};
  const client=createAiClient({getScope:()=>scope,invoke:async()=>{calls++;return new Promise(r=>finish=r);},visitorId:'visitor-12345678'});
  const pending=client.request('ai.assistant.ask',{question:'records?'});
  await new Promise(r=>setTimeout(r,0));scope={...scope,petId:'b'};finish({ok:true,data:{answer:'A'}});
  await assert.rejects(pending,e=>e.code==='WORKSPACE_CHANGED');assert.equal(calls,1);
});
test('account transport requires the current verified identity and local transport sends no token',async()=>{
  const {createAiClient}=await import('../src/ai/client.js');
  const requests=[];let scope={generation:1,mode:'account',workspaceId:'cloud:a',petId:'a',ownerId:'a',repository:{}};
  const client=createAiClient({getScope:()=>scope,getAuthorization:async()=>({principal:{userId:'b'},authToken:'opaque'}),invoke:async r=>{requests.push(r);return{ok:true,data:{remaining:3}}},visitorId:'visitor-12345678'});
  await assert.rejects(client.request('ai.quota',{}),e=>e.code==='UNAUTHENTICATED');assert.equal(requests.length,0);
  scope={...scope,mode:'local',ownerId:null};await client.request('ai.quota',{});assert.equal(requests[0].authToken,undefined);
});
