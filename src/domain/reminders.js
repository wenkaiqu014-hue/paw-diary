import {validateSnapshot,isoTime} from './schema.js';
import {applyRecord,defaultId} from './records.js';
export function applyReminder(state,input,{idFactory=defaultId}={}) {
  const next=validateSnapshot(state),old=input.id?next.reminders.find(r=>r.id===input.id):null;
  if(input.id&&!old)throw new Error('事项不存在');
  if(old&&input.petId&&input.petId!==old.petId)throw new Error('不能更改事项的宠物归属');
  if(input.status==='completed')throw new Error('请通过记录完成操作完成事项');
  if(old?.status==='completed')throw new Error('已完成事项不能改为待办，请新增事项');
  const reminder={id:idFactory(),status:'pending',originRecordId:null,completionRecordId:null,completedAt:null,...old,...input};
  if(old)next.reminders[next.reminders.findIndex(r=>r.id===old.id)]=reminder;else next.reminders.unshift(reminder);
  return validateSnapshot(next);
}
export function completeReminder(state,id,input={},deps={}) {
  let next=validateSnapshot(state);let reminder=next.reminders.find(r=>r.id===id);if(!reminder)throw new Error('事项不存在');
  if(reminder.status==='completed')return {state:next,reminder,record:next.records.find(r=>r.id===reminder.completionRecordId)??null};
  if(reminder.status!=='pending')throw new Error('已取消事项不能完成');
  const origin=next.records.find(r=>r.id===reminder.originRecordId),now=isoTime(deps.now??new Date().toISOString()),idFactory=deps.idFactory??defaultId;
  next=applyRecord(next,{petId:reminder.petId,type:origin?.type??'daily',value:origin?.type==='weight'?input.value:null,title:origin?.title??reminder.title,occurredDate:input.occurredDate,note:input.note??''},{now,idFactory});
  const record=next.records[0];reminder=next.reminders.find(r=>r.id===id);reminder.status='completed';reminder.completedAt=now;reminder.completionRecordId=record.id;
  next=validateSnapshot(next);return {state:next,reminder:next.reminders.find(r=>r.id===id),record:next.records.find(r=>r.id===record.id)};
}
