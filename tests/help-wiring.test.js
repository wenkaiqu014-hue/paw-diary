import test from 'node:test';
import assert from 'node:assert/strict';
import {createUiPreferences} from '../src/data/ui-preferences.js';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {parse} from 'acorn';
import {createSeedState} from '../src/data/seed.js';
import {visibleHealth} from '../src/domain/lifecycle.js';
import {transitionManagement} from '../src/features/health-management.js';
let createHelpCoordinator;try{({createHelpCoordinator}=await import('../src/features/help-coordinator.js'));}catch{}
function harness(){
 let identity='guest',blocked=false,shown=0,closed=0,tours=0;
 const preferences=createUiPreferences({storage:null});
 assert.equal(typeof createHelpCoordinator,'function','coordinator is implemented');
 const coordinator=createHelpCoordinator({release:{version:'0.8.0',channel:'stable'},preferences,getIdentity:()=>identity,getInteractionState:()=>({dirty:blocked}),showWhatsNew:()=>shown++,closeWhatsNew:()=>closed++,startTour:async()=>{tours++;return 'started';}});
 return {coordinator,preferences,setIdentity:value=>identity=value,setBlocked:value=>blocked=value,counts:()=>({shown,closed,tours})};
}
test('startup waits for restored identity and notice confirmation immediately starts the first guide',async()=>{
 const h=harness();h.coordinator.evaluate();assert.equal(h.counts().shown,0);
 h.coordinator.ready();assert.equal(h.counts().shown,1);
 await h.coordinator.acknowledge();assert.equal(h.counts().tours,1);
 h.coordinator.evaluate();assert.equal(h.counts().shown,1);
 await h.coordinator.acknowledge();assert.equal(h.counts().tours,1);
});
test('busy startup is deferred and previously skipped guides are not rerun',async()=>{
 const h=harness();h.setBlocked(true);h.coordinator.ready();assert.equal(h.counts().shown,0);
 h.preferences.setTourStatus('guest','skipped');h.setBlocked(false);h.coordinator.evaluate();
 await h.coordinator.acknowledge();assert.equal(h.counts().tours,0);
});
test('dismissal suppresses only this visit and an identity change cannot acknowledge another account',async()=>{
 const h=harness();h.coordinator.ready();h.coordinator.dismiss();h.coordinator.evaluate();assert.equal(h.counts().shown,1);
 h.setIdentity('account:B');h.coordinator.identityChanged();assert.equal(h.counts().shown,2);
 h.setIdentity('account:C');await h.coordinator.acknowledge();
 assert.deepEqual(h.preferences.read('account:C').acknowledgedVersions,[]);
 assert.deepEqual(h.preferences.read('account:B').acknowledgedVersions,[]);
});
test('a manually reopened notice can be acknowledged after dismissal',async()=>{
 const h=harness();h.coordinator.ready();h.coordinator.dismiss();h.coordinator.openManually();
 await h.coordinator.acknowledge();
 assert.deepEqual(h.preferences.read('guest').acknowledgedVersions,['0.8.0']);
 assert.equal(h.counts().tours,1);
});
test('the actual app snapshot refresh stops the guide on pet change without writing guide completion',async()=>{
 const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
 const node=ast.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='syncState');
 assert.ok(node);
 for(const changed of [true,false]){
  const snapshot=createSeedState(),stops=[];
  const context={session:{snapshot:()=>snapshot},workspaceMode:'local',state:{activePet:changed?'other-pet':snapshot.activePetId},
   visibleHealth,createSeedState,avatarUrls:new Map(),reminderFilter:'pending',petReminders:()=>[],transitionManagement,
   management:{petManage:false,reminderManage:false,selectedPetIds:[],selectedReminderIds:[]},guidedTour:{stop:event=>stops.push(event.reason)}};
  runInNewContext(source.slice(node.start,node.end)+'\nsyncState();',context);
  assert.deepEqual(stops,changed?['pet']:[]);
  assert.equal(context.state.activePet,snapshot.activePetId);
 }
});
