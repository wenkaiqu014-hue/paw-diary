import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as validation from './helpers/cloud-direct-validation.js';
const fail = code => Object.assign(new Error(code),{code});
test('direct permission gate never treats invalid refs, nonexistent objects, network or timeout as denial',async()=>{
  for(const code of ['INVALID_PARAMS','STORAGE_SIGN_PARAM_INVALID','STORAGE_FILE_NONEXIST','NETWORK_ERROR','ECONNRESET','REAL_CLOUD_OPERATION_TIMED_OUT','SOME_UNDOCUMENTED_ERROR'])
    await assert.rejects(validation.requireDirectDenial(async()=>{throw fail(code);},{kind:'storage'}),e=>e.code==='REAL_CLOUD_DIRECT_PROBE_FAILED');
});
test('direct permission gate requires an explicit documented permission response and rejects empty/allowed replies',async()=>{
  assert.equal((await validation.requireDirectDenial(async()=>{throw fail('STORAGE_EXCEED_AUTHORITY');},{kind:'storage'})).denied,true);
  assert.equal((await validation.requireDirectDenial(async()=>({allowed:false,code:'DATABASE_PERMISSION_DENIED'}),{kind:'database'})).denied,true);
  for(const value of [undefined,{}, {allowed:true}, {allowed:false}, {allowed:false,code:'STORAGE_FILE_NONEXIST'}])
    await assert.rejects(validation.requireDirectDenial(async()=>value,{kind:'storage'}),e=>e.code==='REAL_CLOUD_DIRECT_PROBE_FAILED');
});
test('ground truth requires one committed matching owner/pet/hash/size asset before binding private ref to SDK workers',async()=>{
  const envId='test-environment',uid='fixture-owner',uidHash=createHash('sha256').update(`${envId}\0${uid}`).digest('hex');
  const value={id:'asset',ownerId:uid,petId:'pet',sha256:'a'.repeat(64),bytes:70,mime:'image/png',staging:false,deletedAt:null,fileRef:'cloud://test-environment.bucket/private/object'};
  const document={ownerId:uid,value};let reads=0,binds=0;
  const input={envId,assetId:'asset',petId:'pet',sha256:value.sha256,bytes:70,ownerUidHash:uidHash,actors:[{bindFixtureObject:async ref=>{assert.equal(ref.assetId,'asset');binds++;}}]};
  const bind=loadDocument=>validation.bindConfirmedFixture({...input,loadDocument:async query=>{reads++;assert.equal(query.assetId,'asset');return loadDocument();}});
  assert.deepEqual(await bind(()=>document),{bound:true});assert.equal(reads,1);assert.equal(binds,1);
  for(const patch of [{staging:true},{deletedAt:'2026-10-07'},{petId:'foreign'},{sha256:'b'.repeat(64)},{bytes:71},{fileRef:undefined},{ownerId:'B'}])
    await assert.rejects(bind(()=>({...document,value:{...value,...patch}})),e=>e.code==='REAL_CLOUD_FIXTURE_MISMATCH');
  assert.equal(binds,1);
});
