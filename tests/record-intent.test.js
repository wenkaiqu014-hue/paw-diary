import test from 'node:test';
import assert from 'node:assert/strict';
const catalog=[{id:'weight',type:'weight',name:'体重',iconKey:'weight',builtin:true},{id:'vaccine',type:'vaccine',name:'疫苗',iconKey:'vaccine',builtin:true},{id:'deworm',type:'deworm',name:'驱虫',iconKey:'shield',builtin:true},{id:'daily',type:'daily',name:'日常',iconKey:'camera',builtin:true},{id:'custom:a',type:'other',name:'护理',iconKey:'drop',builtin:false}];
const deps={today:'2026-10-07',catalog};
test('entry defaults select daily record and deworm plan without conflating entities',async()=>{
 const {entryDefaults}=await import('../src/domain/record-intent.js');
 assert.deepEqual(entryDefaults('page','p'),{purpose:'record',type:'daily',petId:'p'});
 assert.deepEqual(entryDefaults('todo','p'),{purpose:'plan',type:'deworm',petId:'p'});
 assert.equal(entryDefaults('weight','p').type,'weight');
});
test('plan requires dueDate but no occurredDate or weight result',async()=>{
 const {recordIntent}=await import('../src/domain/record-intent.js');
 const result=recordIntent({purpose:'plan',type:'weight',petId:'p',dueDate:'2026-10-15',title:'称重计划'},deps);
 assert.equal(result.kind,'reminder');assert.equal(result.input.recordType,'weight');assert.equal(result.input.dueDate,'2026-10-15');assert.equal(result.input.occurredDate,undefined);
 assert.throws(()=>recordIntent({purpose:'plan',type:'daily',petId:'p',title:'出去玩'},deps),/日期/);
});
test('daily does not create a reminder; vaccine checked requires a later date',async()=>{
 const {recordIntent}=await import('../src/domain/record-intent.js');
 const base={purpose:'record',petId:'p',date:'2026-10-07',title:'出去玩',note:''};
 assert.equal(recordIntent({...base,type:'daily',joinTodo:false},deps).input.nextDate,null);
 assert.throws(()=>recordIntent({...base,type:'vaccine',joinTodo:true},deps),/日期/);
 assert.equal(recordIntent({...base,type:'vaccine',joinTodo:true,nextDate:'2026-11-07'},deps).input.nextDate,'2026-11-07');
 assert.throws(()=>recordIntent({...base,type:'daily',date:'2026-10-08'},deps),/今天/);
});
test('custom catalog selection stamps immutable display facts',async()=>{
 const {recordIntent}=await import('../src/domain/record-intent.js');
 const result=recordIntent({type:'custom:a',petId:'p',purpose:'record',date:'2026-10-07',title:'护理'},deps);
 assert.equal(result.input.type,'other');assert.equal(result.input.customTypeId,'custom:a');assert.equal(result.input.typeLabel,'护理');assert.equal(result.input.iconKey,'drop');
});
