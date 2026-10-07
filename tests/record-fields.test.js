import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordFieldState} from '../src/ui/record-fields.js';
const entries=[{id:'weight',type:'weight'},{id:'vaccine',type:'vaccine'},{id:'deworm',type:'deworm'},{id:'daily',type:'daily'},{id:'custom-a',type:'other'}];
const create=values=>createRecordFieldState({values,getEntries:()=>entries});
test('manual and AI field state preserve values while changing purpose',()=>{
 const state=create({type:'weight',purpose:'record',date:'2026-10-07',dueDate:'2026-10-09',value:'4.6',title:'我写的名字',note:'保留'});
 state.setPurpose('plan');assert.equal(state.read().value,null);assert.equal(state.read().date,null);assert.equal(state.read().dueDate,'2026-10-09');
 state.setPurpose('record');assert.equal(state.read().value,'4.6');assert.equal(state.read().date,'2026-10-07');assert.equal(state.read().title,'我写的名字');assert.equal(state.read().includeInHealth,undefined);
});
test('health defaults follow type until user explicitly changes checkbox',()=>{
 const state=create({purpose:'plan',type:'daily'});assert.equal(state.read().includeInHealth,false);
 state.setType('vaccine');assert.equal(state.read().includeInHealth,true);state.setField('includeInHealth',false);state.setType('deworm');assert.equal(state.read().includeInHealth,false);
});
test('custom and unknown types never become a builtin silently',()=>{
 const state=create({purpose:'plan',type:'unknown',title:'原始标题'});assert.equal(state.read().type,'');assert.equal(state.read().includeInHealth,false);
 state.setType('custom-a');assert.equal(state.read().type,'custom-a');assert.equal(state.read().includeInHealth,false);assert.equal(state.read().title,'原始标题');
});
test('missing model dates remain empty and weight title is never prefilled',()=>{
 const state=create({purpose:'record',type:'weight'});assert.equal(state.read().date,'');assert.equal(state.read().title,'');assert.equal(state.read().value,'');
});
test('explicit model/user health choice is preserved independently across instances',()=>{
 const first=create({purpose:'plan',type:'daily',includeInHealth:true}),second=create({purpose:'plan',type:'daily'});
 first.setType('custom-a');assert.equal(first.read().includeInHealth,true);assert.equal(second.read().includeInHealth,false);
 second.setType('deworm');assert.equal(second.read().includeInHealth,true);assert.equal(first.read().type,'custom-a');
});
