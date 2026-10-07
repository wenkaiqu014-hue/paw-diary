import test from 'node:test';
import assert from 'node:assert/strict';

const snapshot={version:3,mode:'local',activePetId:'p',profile:{city:'深圳'},pets:[{id:'p',name:'Milo',type:'cat',deletedAt:null}],records:[],reminders:[],posts:[]};
const fixture=async request=>{
 const {createAssistantConversation}=await import('../src/features/assistant-panel.js');
 let scope={mode:'local',petId:'p',generation:1,ownerId:null};
 const conversation=createAssistantConversation({request,getSnapshot:()=>snapshot,getScope:()=>scope,getLocale:()=> 'zh-CN'});
 return {conversation,change:patch=>{scope={...scope,...patch};}};
};
test('assistant carries only four successful turns in page memory and does not mutate records',async()=>{
 const calls=[];const {conversation}=await fixture(async(action,payload)=>{calls.push({action,payload});return {answer:'Your record',sources:[{kind:'record',id:'r',title:'Weight'}]};});
 for(let i=0;i<5;i++)await conversation.ask('Question '+i);
 assert.equal(calls.length,5);assert.equal(calls[4].action,'ai.assistant.ask');assert.equal(calls[4].payload.history.length,8);
 assert.equal(conversation.messages().length,8);assert.equal(conversation.messages()[0].content,'Question 1');
 assert.deepEqual(snapshot.records,[]);
});
test('pet or account switch clears the former history before a new request',async()=>{
 const calls=[];const {conversation,change}=await fixture(async(_,payload)=>{calls.push(payload);return {answer:'answer',sources:[]};});
 await conversation.ask('first');change({petId:'other'});conversation.syncScope();assert.deepEqual(conversation.messages(),[]);
 await conversation.ask('second');assert.deepEqual(calls[1].history,[]);change({ownerId:'another-account'});conversation.syncScope();assert.deepEqual(conversation.messages(),[]);
});
test('late answer from a former scope is discarded',async()=>{
 let resolve;const {conversation,change}=await fixture(()=>new Promise(r=>resolve=r));
 const pending=conversation.ask('first');change({generation:2});resolve({answer:'private old answer',sources:[]});
 await assert.rejects(pending,e=>e.code==='WORKSPACE_CHANGED');assert.deepEqual(conversation.messages(),[]);
});
test('failed and duplicate in-flight requests never add incomplete history',async()=>{
 let reject;const {conversation}=await fixture(()=>new Promise((_,r)=>reject=r));
 const pending=conversation.ask('first');await assert.rejects(conversation.ask('duplicate'),e=>e.code==='BUSY');
 reject(Object.assign(new Error('TIMEOUT'),{code:'TIMEOUT'}));await assert.rejects(pending,e=>e.code==='TIMEOUT');assert.deepEqual(conversation.messages(),[]);
});
test('reset invalidates an in-flight response even in the same workspace',async()=>{
 let resolve;const {conversation}=await fixture(()=>new Promise(r=>resolve=r));const pending=conversation.ask('first');conversation.reset();resolve({answer:'late',sources:[]});
 await assert.rejects(pending,e=>e.code==='WORKSPACE_CHANGED');assert.deepEqual(conversation.messages(),[]);
});
test('assistant accepts up to 1000 question characters and rejects longer input',async()=>{
 const {conversation}=await fixture(async()=>({answer:'answer',sources:[]}));
 await conversation.ask('q'.repeat(1000));
 await assert.rejects(conversation.ask('q'.repeat(1001)),e=>e.code==='INVALID_INPUT');
});
