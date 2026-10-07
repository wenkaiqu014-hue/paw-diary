import {validDate,requiredText} from './schema.js';
export function entryDefaults(entry,petId){return {purpose:entry==='todo'?'plan':'record',type:entry==='todo'?'deworm':entry==='weight'?'weight':'daily',petId};}
export function recordIntent(form,{today,catalog=[]}={}){
 const entry=catalog.find(e=>e.id===form.type);if(!entry)throw new Error('请选择记录类型');
 const petId=requiredText(form.petId,'宠物'),title=requiredText(form.title||(entry.type==='weight'?'体重记录':''),'记录名称'),note=form.note??'';
 const custom=entry.builtin?{}:{...(entry.id==='historical:other'?{}:{customTypeId:entry.id}),typeLabel:entry.name,iconKey:entry.iconKey};
 if(form.purpose==='plan')return {kind:'reminder',input:{...(form.id?{id:form.id}:{}),petId,title,note,dueDate:validDate(form.dueDate,'计划日期'),recordType:entry.type,...custom}};
 const occurredDate=validDate(form.date,'发生日期');if(today&&occurredDate>today)throw new Error('发生日期不能晚于今天');
 let nextDate=null;if(form.joinTodo){nextDate=validDate(form.nextDate,'下次计划日期');if(nextDate<=occurredDate)throw new Error('下次计划日期应晚于发生日期');}
 return {kind:'record',input:{...(form.id?{id:form.id}:{}),petId,type:entry.type,...custom,occurredDate,value:entry.type==='weight'?Number(form.value):null,unit:entry.type==='weight'?'kg':null,title,note,nextDate}};
}
