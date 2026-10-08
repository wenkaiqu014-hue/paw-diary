import test from 'node:test';
import assert from 'node:assert/strict';
import {createNearbyController} from '../src/features/nearby.js';
const profile={authorId:'rabbit-owner',nickname:'合成宠友',petTypes:['cat','兔子'],purposes:['新手互助'],cityId:'310100',discoverable:true};
test('nearby list and detail preserve custom pet categories rather than dropping them',async()=>{
 const c=createNearbyController({repository:{request:async action=>action==='profiles.discover'?{items:[profile],nextCursor:null}:profile}});
 await c.load();assert.deepEqual(c.getState().items[0].petTypes,['cat','兔子']);
 await c.openProfile('rabbit-owner');assert.deepEqual(c.getState().selected.petTypes,['cat','兔子']);
});
test('custom pet category filtering emits its canonical name to the public gateway',async()=>{
 const calls=[];const c=createNearbyController({repository:{request:async(action,payload)=>{calls.push({action,payload});return {items:[],nextCursor:null};}}});
 await c.setFilters({petType:' 仓鼠 '});assert.deepEqual(calls[0].payload.petTypes,['仓鼠']);
 await c.setFilters({petType:'猫咪'});assert.deepEqual(calls[1].payload.petTypes,['cat']);
 await c.setFilters({petType:'all'});assert.deepEqual(calls[2].payload.petTypes,['all']);
});
test('invalid custom category filters never reach the gateway',async()=>{
 let requests=0;const c=createNearbyController({repository:{request:async()=>{requests++;return {items:[]};}}});
 for(const petType of ['','<script>','x'.repeat(21),'兔\u0000子'])await assert.rejects(c.setFilters({petType}),e=>e.code==='INVALID_INPUT');
 assert.equal(requests,0);
});
