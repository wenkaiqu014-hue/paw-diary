import {RECORD_TYPES,requiredText,validDate,clone} from './schema.js?v=0.2.0';
import {applyReminder} from './reminders.js?v=0.2.0';
import {defaultPlanHealth} from './health-plans.js';
import {recordTypeEntries} from './record-type-catalog.js';
import {applyRecord,defaultId} from './records.js?v=0.2.0';
export function validateRecordDraft(raw,{pets=[],today}={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('草稿格式无效');
 const draftId=requiredText(raw.draftId,'草稿ID'),missingFields=[];
 const petId=raw.petId??null;if(petId!==null&&!pets.some(p=>p.id===petId&&p.deletedAt===null))throw new Error('宠物不存在或已在回收站');if(!petId)missingFields.push('petId');
 const type=raw.type??null;if(type!==null&&!RECORD_TYPES.includes(type))throw new Error('记录类型无效');if(!type)missingFields.push('type');
 const typeLabel=type==='other'?(raw.typeLabel??null):undefined;if(type==='other'&&!typeLabel)missingFields.push('typeLabel');if(typeLabel!=null&&(typeof typeLabel!=='string'||typeLabel.length>20))throw new Error('自定义记录类型无效');
 const occurredDate=raw.occurredDate??null;if(occurredDate!==null){validDate(occurredDate);if(today&&occurredDate>today)throw new Error('记录日期不能晚于今天');}else missingFields.push('occurredDate');
 let value=raw.value??null,unit=raw.unit??null;
 if(type==='weight'){if(value===null)missingFields.push('value');else{if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()==='')throw new Error('体重需为数字');value=Number(value);if(!Number.isFinite(value)||value<0.01||value>200)throw new Error('体重需在0.01至200 kg之间');}if(unit!==null&&unit!=='kg')throw new Error('体重单位需为kg');unit='kg';}
 else if(value!==null||unit!==null)throw new Error('本记录类型不支持数值字段');
 const title=raw.title??(type==='weight'?'体重记录':null);if(!title)missingFields.push('title');else if(typeof title!=='string'||title.length>60)throw new Error('记录名称无效');
 const note=raw.note??'',sourceText=raw.sourceText??'';if(typeof note!=='string'||note.length>500||typeof sourceText!=='string'||sourceText.length>1000)throw new Error('草稿文字无效');
 const nextDate=raw.nextDate??null;if(nextDate===null&&Array.isArray(raw.missingFields)&&raw.missingFields.includes('nextDate')&&raw.skipNextDate!==true)missingFields.push('nextDate');if(nextDate!==null){validDate(nextDate,'下一次日期');if(occurredDate&&nextDate<=occurredDate)throw new Error('下一次日期应晚于记录日期');}
 return {draftId,petId,type,...(typeLabel!==undefined?{typeLabel}:{}),...(type==='other'&&raw.customTypeId?{customTypeId:raw.customTypeId,iconKey:raw.iconKey??'book'}:{}),occurredDate,value,unit,title,note,nextDate,missingFields,sourceText,...(raw.skipNextDate===true?{skipNextDate:true}:{})};
}
export function validatePlanDraft(raw,{pets=[]}={}){
 if(!raw||typeof raw!=='object')throw new Error('计划草稿无效');
 const draftId=requiredText(raw.draftId,'草稿ID'),missingFields=[];
 const petId=raw.petId??null;if(petId!==null&&!pets.some(p=>p.id===petId&&p.deletedAt===null))throw new Error('宠物不存在');if(!petId)missingFields.push('petId');
 const type=raw.type??null;if(type!==null&&!RECORD_TYPES.includes(type))throw new Error('记录类型无效');if(!type)missingFields.push('type');
 const dueDate=raw.dueDate??raw.occurredDate??null;if(dueDate)validDate(dueDate,'计划日期');else missingFields.push('dueDate');
 const title=raw.title??null;if(!title)missingFields.push('title');else if(typeof title!=='string'||title.length>60)throw new Error('名称无效');
 const typeLabel=type==='other'?raw.typeLabel??null:undefined;if(type==='other'&&!typeLabel)missingFields.push('typeLabel');
 if(typeLabel&&(typeof typeLabel!=='string'||typeLabel.length>20))throw new Error('类型名称无效');
 const note=raw.note??'',sourceText=raw.sourceText??'';if(typeof note!=='string'||note.length>500||typeof sourceText!=='string'||sourceText.length>1000)throw new Error('草稿文字无效');
 if(raw.includeInHealth!==undefined&&typeof raw.includeInHealth!=='boolean')throw new Error('健康待办选择无效');
 return {draftId,petId,type,dueDate,title,note,sourceText,missingFields,...(raw.includeInHealth!==undefined?{includeInHealth:raw.includeInHealth}:{}),...(typeLabel!==undefined?{typeLabel}:{}),...(type==='other'&&raw.customTypeId?{customTypeId:raw.customTypeId,iconKey:raw.iconKey??'book'}:{})};
}
export function toRecordInputs(drafts,selectedIds,{pets,today}={}){
 if(!Array.isArray(drafts)||drafts.length>5||!Array.isArray(selectedIds)||new Set(selectedIds).size!==selectedIds.length)throw new Error('草稿选择无效，最多5条');
 if(selectedIds.some(id=>!drafts.some(d=>d.draftId===id)))throw new Error('草稿不存在');
 return selectedIds.map(id=>{const d=validateRecordDraft(drafts.find(x=>x.draftId===id),{pets,today});if(d.missingFields.length)throw new Error('请补充草稿缺少的字段');const {draftId,missingFields,sourceText,skipNextDate,...input}=d;return input;});
}
export function applyRecordBatch(snapshot,inputs,{now=new Date().toISOString(),idFactory=defaultId}={}){
 if(!Array.isArray(inputs)||inputs.length<1||inputs.length>5)throw new Error('每批记录需为1至5条');
 if(inputs.some(i=>!i||typeof i!=='object'||Array.isArray(i)||i.id))throw new Error('批量录入只接受新记录');
 let next=clone(snapshot);const records=[],reminders=[];
 for(const input of inputs){const oldIds=new Set(next.records.map(r=>r.id)),oldReminderIds=new Set(next.reminders.map(r=>r.id));next=applyRecord(next,input,{now,idFactory});records.push(...next.records.filter(r=>!oldIds.has(r.id)));reminders.push(...next.reminders.filter(r=>!oldReminderIds.has(r.id)));}
 return {snapshot:next,records,reminders};
}

function activeCustomTypes(catalog){
 if(Array.isArray(catalog))return catalog.filter(c=>c.deletedAt==null).map(c=>({...c,name:c.name??c.typeLabel}));
 return (catalog?.custom??[]).filter(c=>c.deletedAt===null);
}
export function validateEntryDraft(raw,{pets=[],today,catalog}={}){
 if(!raw||!['record','plan'].includes(raw.purpose))throw new Error('草稿用途无效');
 let candidate={...raw},suggestedTypeLabel=typeof raw.suggestedTypeLabel==='string'?raw.suggestedTypeLabel.slice(0,20):undefined;
 if(candidate.type==='other'){
  const custom=activeCustomTypes(catalog).find(c=>c.id===candidate.customTypeId);
  if(custom)Object.assign(candidate,{typeLabel:custom.name,customTypeId:custom.id,iconKey:custom.iconKey});
  else{suggestedTypeLabel=candidate.typeLabel??suggestedTypeLabel;candidate={...candidate,type:null,typeLabel:undefined,customTypeId:undefined,iconKey:undefined};}
 }
 // Occurred records and future plans use independent dates. Legacy nextDate never creates a hidden plan.
 const purpose=candidate.purpose;
 if(purpose==='record'){candidate.nextDate=null;candidate.missingFields=[];if(candidate.type==='weight'&&candidate.title==null)candidate.title='';}
 else{if(candidate.value!=null)throw new Error('计划不能预填未来体重');candidate.dueDate=candidate.dueDate??null;candidate.occurredDate=undefined;candidate.includeInHealth=candidate.includeInHealth??defaultPlanHealth(candidate.type);}
 const normalized=(purpose==='plan'?validatePlanDraft:validateRecordDraft)(candidate,{pets,today});
 if(purpose==='plan'&&candidate.dueDate===null){normalized.dueDate=null;if(!normalized.missingFields.includes('dueDate'))normalized.missingFields.push('dueDate');}
 if(purpose==='record'){delete normalized.nextDate;if(candidate.type==='weight'&&!candidate.title){normalized.title='';normalized.missingFields=normalized.missingFields.filter(field=>field!=='title');}}
 return {...normalized,purpose,...(suggestedTypeLabel?{suggestedTypeLabel}: {})};
}
export function toEntryInputs(drafts,selectedIds,options={}){
 if(!Array.isArray(drafts)||drafts.length>5||!Array.isArray(selectedIds)||new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!drafts.some(d=>d.draftId===id)))throw new Error('草稿选择无效，最多5条');
 return selectedIds.map(draftId=>{
  const d=validateEntryDraft(drafts.find(x=>x.draftId===draftId),options);if(d.missingFields.length)throw new Error('请补充草稿缺少的字段');
  const {purpose,type,missingFields,sourceText,suggestedTypeLabel,...rest}=d;delete rest.draftId;
  if(purpose==='plan'){delete rest.value;delete rest.unit;delete rest.occurredDate;return {draftId,purpose,input:{...rest,recordType:type}};}
  delete rest.includeInHealth;delete rest.dueDate;if(type==='weight'&&!rest.title)rest.title='体重记录';return {draftId,purpose,input:{...rest,type}};
 });
}
export function applyEntryBatch(snapshot,entries,{now=new Date().toISOString(),idFactory=defaultId}={}){
 if(!Array.isArray(entries)||entries.length<1||entries.length>5)throw new Error('每批草稿需为1至5条');
 if(new Set(entries.map(e=>e?.draftId)).size!==entries.length)throw new Error('草稿ID不能重复');
 let next=clone(snapshot);const records=[],reminders=[],savedEntries=[];
 const catalog=next.profile?.recordTypeCatalog,today=new Date(Date.parse(now)+8*3600000).toISOString().slice(0,10);
 for(const entry of entries){
  if(!entry||!entry.input||typeof entry.input!=='object'||Array.isArray(entry.input)||entry.input.id||!['record','plan'].includes(entry.purpose))throw new Error('批量录入只接受新记录或计划');
  requiredText(entry.draftId,'草稿ID');const input=entry.input,type=entry.purpose==='record'?input.type:input.recordType;
  if(input.nextDate!=null||input.originRecordId!=null||input.completionRecordId!=null||input.status&&input.status!=='pending')throw new Error('草稿不能隐式新增关联计划或完成事项');
  const custom=type==='other'?recordTypeEntries(next).find(c=>!c.builtin&&c.id===input.customTypeId):null;
  if(type==='other'&&!custom)throw new Error('请选择已有自定义记录类型');
  const normalized={...input,...(custom?{typeLabel:custom.name,customTypeId:custom.id,iconKey:custom.iconKey}:{})};
  const draft=validateEntryDraft({...normalized,type,purpose:entry.purpose,draftId:entry.draftId},{pets:next.pets,today,catalog});
  if(draft.missingFields.length)throw new Error('请补充草稿缺少的字段');
  const confirmed=toEntryInputs([draft],[draft.draftId],{pets:next.pets,today,catalog})[0].input;
  if(entry.purpose==='record'){next=applyRecord(next,confirmed,{now,idFactory});records.push(next.records[0]);savedEntries.push({draftId:entry.draftId,purpose:'record',entityId:next.records[0].id});}
  else{next=applyReminder(next,confirmed,{now,idFactory});reminders.push(next.reminders[0]);savedEntries.push({draftId:entry.draftId,purpose:'plan',entityId:next.reminders[0].id});}
 }
 return {snapshot:next,records,reminders,entries:savedEntries};
}
