import {moveToTrash} from './lifecycle.js?v=0.2.0';
import {validateSnapshot,normalizeRecord,isoTime,todayAt,validDate,requiredText} from './schema.js?v=0.2.0';
export const defaultId=()=>globalThis.crypto?.randomUUID?.()??`id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function applyRecord(state,input,{now=new Date().toISOString(),idFactory=defaultId}={}) {
  if(input.includeInHealth!==undefined&&typeof input.includeInHealth!=='boolean')throw new Error('健康待办选项需为布尔值');
  const next=validateSnapshot(state),old=input.id?next.records.find(r=>r.id===input.id):null;
  if(input.id&&!old)throw new Error('记录不存在');
  if(old&&input.petId&&input.petId!==old.petId)throw new Error('不能更改记录的宠物归属');
  if(old?.deletedAt!==undefined&&old.deletedAt!==null)throw new Error('记录已在回收站，请先恢复');
  const pet=next.pets.find(p=>p.id===(old?.petId??input.petId));if(!pet||pet.deletedAt!==null)throw new Error('宠物不存在或已在回收站');
  if(input.deletedAt!==undefined&&input.deletedAt!==null)throw new Error('请通过回收站操作移入资料');
  const timestamp=isoTime(now),candidate={...old,...input,id:old?.id??idFactory(),createdAt:old?.createdAt??timestamp,updatedAt:timestamp};
  if(old&&input.type&&input.type!==old.type){if(input.unit===undefined)candidate.unit=input.type==='weight'?'kg':null;if(input.value===undefined&&input.type!=='weight')candidate.value=null;}
  const record=normalizeRecord(candidate);
  if(record.occurredDate>todayAt(timestamp))throw new Error('记录日期不能晚于今天');
  if(old)next.records[next.records.findIndex(r=>r.id===old.id)]=record;else next.records.unshift(record);
  if(input.nextDate!==undefined){
    const linked=next.reminders.filter(r=>r.originRecordId===record.id&&r.status==='pending'&&r.deletedAt===null);
    if(input.nextDate===null){for(const r of linked)r.status='cancelled';}
    else {validDate(input.nextDate,'下一次日期');if(input.nextDate<=record.occurredDate)throw new Error('下一次日期应晚于记录日期');
      if(linked.length){linked[0].dueDate=input.nextDate;linked[0].title=requiredText(record.title,'事项名称');if(input.includeInHealth!==undefined)linked[0].includeInHealth=input.includeInHealth;Object.assign(linked[0],{recordType:record.type,...(record.type==='other'?{typeLabel:record.typeLabel,customTypeId:record.customTypeId,iconKey:record.iconKey}:{})});for(const r of linked.slice(1))r.status='cancelled';}
      else next.reminders.unshift({id:idFactory(),deletedAt:null,petId:record.petId,title:record.title,recordType:record.type,includeInHealth:input.includeInHealth??true,...(record.type==='other'?{typeLabel:record.typeLabel,...(record.customTypeId?{customTypeId:record.customTypeId}:{}),...(record.iconKey?{iconKey:record.iconKey}:{})}:{}),dueDate:input.nextDate,status:'pending',originRecordId:record.id,completionRecordId:null,completedAt:null});
    }
  }
  return validateSnapshot(next);
}
export function removeRecord(state,id,options={}) {
  return moveToTrash(state,{kind:'record',ids:[id]},options);
}
