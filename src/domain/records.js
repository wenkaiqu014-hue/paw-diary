import {clone,validateSnapshot,normalizeRecord,isoTime,todayAt,validDate,requiredText} from './schema.js';
export const defaultId=()=>globalThis.crypto?.randomUUID?.()??`id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function applyRecord(state,input,{now=new Date().toISOString(),idFactory=defaultId}={}) {
  const next=validateSnapshot(state),old=input.id?next.records.find(r=>r.id===input.id):null;
  if(input.id&&!old)throw new Error('记录不存在');
  if(old&&input.petId&&input.petId!==old.petId)throw new Error('不能更改记录的宠物归属');
  const timestamp=isoTime(now),candidate={...old,...input,id:old?.id??idFactory(),createdAt:old?.createdAt??timestamp,updatedAt:timestamp};
  if(old&&input.type&&input.type!==old.type){if(input.unit===undefined)candidate.unit=input.type==='weight'?'kg':null;if(input.value===undefined&&input.type!=='weight')candidate.value=null;}
  const record=normalizeRecord(candidate);
  if(record.occurredDate>todayAt(timestamp))throw new Error('记录日期不能晚于今天');
  if(old)next.records[next.records.findIndex(r=>r.id===old.id)]=record;else next.records.unshift(record);
  if(input.nextDate!==undefined){
    const linked=next.reminders.filter(r=>r.originRecordId===record.id&&r.status==='pending');
    if(input.nextDate===null){for(const r of linked)r.status='cancelled';}
    else {validDate(input.nextDate,'下一次日期');if(input.nextDate<=record.occurredDate)throw new Error('下一次日期应晚于记录日期');
      if(linked.length){linked[0].dueDate=input.nextDate;linked[0].title=requiredText(record.title,'事项名称');for(const r of linked.slice(1))r.status='cancelled';}
      else next.reminders.unshift({id:idFactory(),petId:record.petId,title:record.title,dueDate:input.nextDate,status:'pending',originRecordId:record.id,completionRecordId:null,completedAt:null});
    }
  }
  return validateSnapshot(next);
}
export function removeRecord(state,id) {
  const next=validateSnapshot(state);if(!next.records.some(r=>r.id===id))throw new Error('记录不存在');
  next.records=next.records.filter(r=>r.id!==id);
  for(const r of next.reminders){if(r.originRecordId===id&&r.status==='pending')r.status='cancelled';if(r.completionRecordId===id){r.completionRecordId=null;r.completionRecordDeleted=true;}}
  return validateSnapshot(next);
}
