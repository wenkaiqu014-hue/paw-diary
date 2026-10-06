import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionManagement, selectedCalendarReminders} from '../src/features/health-management.js';

const initial = () => ({petManage:false,reminderManage:false,selectedPetIds:[],selectedReminderIds:[]});
const pet = id => ({id,name:id,type:'dog',birthday:null,estimatedAgeMonths:12,arrivalDate:null,breed:'',sex:'',image:'',deletedAt:null});
const reminder = (id,overrides={}) => ({id,petId:'p1',title:id,dueDate:'2026-10-08',status:'pending',originRecordId:null,completionRecordId:null,completedAt:null,deletedAt:null,...overrides});
const snapshot = () => ({version:3,mode:'demo',activePetId:'p1',pets:[pet('p1'),pet('p2')],records:[],reminders:[reminder('m1'),reminder('m2'),reminder('other',{petId:'p2'}),reminder('cancelled',{status:'cancelled'}),reminder('hidden',{deletedAt:'2026-10-07T00:00:00.000Z'})],posts:[],profile:{city:'深圳'}});

test('普通模式不会选择，管理模式选择不改变对方选择且可取消选择', () => {
  const ordinary=initial();
  assert.deepEqual(transitionManagement(ordinary,{type:'TOGGLE_PET',id:'p1'}),ordinary);
  let s=transitionManagement(ordinary,{type:'ENTER_PETS'});
  s=transitionManagement(s,{type:'TOGGLE_PET',id:'p1'});
  s=transitionManagement(s,{type:'ENTER_REMINDERS'});
  s=transitionManagement(s,{type:'TOGGLE_REMINDER',id:'m1'});
  assert.deepEqual(s.selectedPetIds,['p1']);
  assert.deepEqual(s.selectedReminderIds,['m1']);
  assert.deepEqual(transitionManagement(s,{type:'TOGGLE_PET',id:'p1'}).selectedPetIds,[]);
  assert.deepEqual(ordinary,initial(),'转换不改源状态');
});

test('换宠物退出管理并清空选择，换事项筛选只清事项选择，完成可分别退出', () => {
  const managing={petManage:true,reminderManage:true,selectedPetIds:['p1'],selectedReminderIds:['m1']};
  assert.deepEqual(transitionManagement(managing,{type:'PET_CHANGED'}),initial());
  const filtered=transitionManagement(managing,{type:'FILTER_CHANGED'});
  assert.deepEqual(filtered.selectedReminderIds,[]);
  assert.deepEqual(filtered.selectedPetIds,['p1']);
  assert.equal(filtered.reminderManage,true);
  const finished=transitionManagement(managing,{type:'EXIT',target:'pets'});
  assert.equal(finished.petManage,false);
  assert.deepEqual(finished.selectedPetIds,[]);
  assert.deepEqual(finished.selectedReminderIds,['m1']);
  assert.deepEqual(transitionManagement(managing,{type:'EXIT'}),initial());
});

test('实体变化仅清除失效选择，仍有效的选择及模式保留供保存失败重试', () => {
  const managing={petManage:true,reminderManage:true,selectedPetIds:['p1','p2'],selectedReminderIds:['m1','m2']};
  const s=transitionManagement(managing,{type:'ENTITIES_CHANGED',petIds:['p2'],reminderIds:['m2']});
  assert.deepEqual(s.selectedPetIds,['p2']);
  assert.deepEqual(s.selectedReminderIds,['m2']);
  assert.equal(s.petManage,true);
  assert.equal(s.reminderManage,true);
  assert.deepEqual(managing.selectedReminderIds,['m1','m2']);
});

test('日历只返回当前宠物所选可见pending，顺序跟选择并不修改快照', () => {
  const full=snapshot();
  const selected=selectedCalendarReminders(full,'p1',['m2','m1']);
  assert.deepEqual(selected.map(r=>r.id),['m2','m1']);
  assert.equal(full.reminders.length,5);
});

test('日历拒绝空选择、其他宠物、回收站和非pending，说明不能导出的名称', () => {
  const full=snapshot();
  assert.throws(()=>selectedCalendarReminders(full,'p1',[]),/选择|勾选/);
  assert.throws(()=>selectedCalendarReminders(full,'p1',['other']),/宠物|归属/);
  assert.throws(()=>selectedCalendarReminders(full,'p1',['hidden']),/不可见|回收站|不存在/);
  assert.throws(()=>selectedCalendarReminders(full,'p1',['m1','cancelled']),/cancelled.*取消|取消.*cancelled/);
  full.pets[0].deletedAt='2026-10-07T00:00:00.000Z';
  full.activePetId='p2';
  assert.throws(()=>selectedCalendarReminders(full,'p1',['m1']),/宠物|不可见/);
});
