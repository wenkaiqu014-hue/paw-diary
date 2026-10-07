function obj(v,label){if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(`${label}格式无效`);return v;}
function txt(v,label,max=200){if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`${label}格式无效`);return v;}
function ids(v,label){if(!Array.isArray(v)||new Set(v).size!==v.length)throw new Error(`${label}格式无效`);return v.map(x=>txt(x,label));}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(`${v}T12:00:00Z`))||new Date(`${v}T12:00:00Z`).toISOString().slice(0,10)!==v)throw new Error('日期格式无效');return v;}
function timestamp(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(v)||!Number.isFinite(Date.parse(v)))throw new Error('时间格式无效');return new Date(v).toISOString();}
export function normalizeOnboardingProgress(raw){
 obj(raw,'引导进度');if(!['pet','record','reminder','done'].includes(raw.step))throw new Error('引导步骤无效');
 return {petId:txt(raw.petId,'宠物ID'),step:raw.step,recordIds:ids(raw.recordIds??[],'记录ID'),reminderId:raw.reminderId==null?null:txt(raw.reminderId,'提醒ID'),updatedAt:timestamp(raw.updatedAt)};
}
export function normalizeRecap(raw){
 obj(raw,'成长回顾');const from=date(raw.from),to=date(raw.to);if(from>to)throw new Error('回顾日期范围无效');
 const recordIds=ids(raw.recordIds,'记录ID'),reminderIds=ids(raw.reminderIds,'提醒ID'),storySources=ids(raw.storySources,'回顾来源');if(storySources.some(id=>![...recordIds,...reminderIds].includes(id)))throw new Error('回顾引用来源无效');
 if(typeof raw.sourceHash!=='string'||!/^([a-f0-9]{64})$/.test(raw.sourceHash))throw new Error('回顾依据无效');
 obj(raw.facts,'回顾事实');for(const key of ['recordCount','completedCareCount'])if(!Number.isSafeInteger(raw.facts[key])||raw.facts[key]<0)throw new Error('回顾数字无效');
 if(raw.facts.weightChangeKg!==null&&!Number.isFinite(raw.facts.weightChangeKg))throw new Error('回顾体重差无效');
 if(!Array.isArray(raw.facts.upcomingReminders))throw new Error('回顾提醒无效');
 const facts={recordCount:raw.facts.recordCount,weightChangeKg:raw.facts.weightChangeKg,completedCareCount:raw.facts.completedCareCount,upcomingReminders:raw.facts.upcomingReminders.map(r=>({id:txt(r.id,'提醒ID'),title:txt(r.title,'提醒标题',60),dueDate:date(r.dueDate)})),recordIds:ids(raw.facts.recordIds??recordIds,'事实记录ID'),reminderIds:ids(raw.facts.reminderIds??reminderIds,'事实提醒ID')};
 if(!['zh-CN','en'].includes(raw.uiLocale))throw new Error('回顾语言无效');
 return {id:txt(raw.id,'回顾ID'),petId:txt(raw.petId,'宠物ID'),from,to,generatedAt:timestamp(raw.generatedAt),sourceHash:raw.sourceHash,recordIds,reminderIds,facts,story:txt(raw.story,'回顾文字',4000),storySources,uiLocale:raw.uiLocale};
}
export function normalizeStage3State(raw){
 if(raw===undefined||raw===null)return {onboardingByPet:{},recaps:[]};obj(raw,'阶段3状态');const map=raw.onboardingByPet??{},recaps=raw.recaps??[];obj(map,'引导进度');if(!Array.isArray(recaps))throw new Error('成长回顾格式无效');
 const onboardingByPet=Object.fromEntries(Object.entries(map).map(([petId,value])=>{const normalized=normalizeOnboardingProgress({...value,petId:value.petId??petId});if(normalized.petId!==petId)throw new Error('引导宠物归属不一致');return [petId,normalized];}));
 const normalizedRecaps=recaps.map(normalizeRecap);if(new Set(normalizedRecaps.map(r=>r.id)).size!==normalizedRecaps.length)throw new Error('回顾ID重复');return {onboardingByPet,recaps:normalizedRecaps};
}
// Metadata follows the selected entity graph. Keep the original sourceHash so
// newly assigned IDs are visibly stale until the user regenerates the recap.
export function mapStage3State(raw,{pet,record,reminder,recap=id=>id}){
 const source=normalizeStage3State(raw),onboardingByPet={},recaps=[];let metadataSkipped=0;
 for(const progress of Object.values(source.onboardingByPet)){
  const petId=pet(progress.petId),recordIds=progress.recordIds.map(record),reminderId=progress.reminderId?reminder(progress.reminderId):null;
  if(!petId||recordIds.some(id=>!id)||(progress.reminderId&&!reminderId)){metadataSkipped++;continue;}
  Object.defineProperty(onboardingByPet,petId,{value:{...progress,petId,recordIds,reminderId},enumerable:true,writable:true,configurable:true});
 }
 for(const entry of source.recaps){
  const petId=pet(entry.petId),recordIds=entry.recordIds.map(record),reminderIds=entry.reminderIds.map(reminder),storySources=entry.storySources.map(id=>entry.recordIds.includes(id)?record(id):reminder(id));
  const factRecordIds=entry.facts.recordIds.map(record),factReminderIds=entry.facts.reminderIds.map(reminder),upcomingReminders=entry.facts.upcomingReminders.map(r=>({...r,id:reminder(r.id)}));
  if(!petId||[...recordIds,...reminderIds,...storySources,...factRecordIds,...factReminderIds,...upcomingReminders.map(r=>r.id)].some(id=>!id)){metadataSkipped++;continue;}
  recaps.push({...entry,id:recap(entry.id),petId,recordIds,reminderIds,storySources,facts:{...entry.facts,recordIds:factRecordIds,reminderIds:factReminderIds,upcomingReminders}});
 }
 return {state:normalizeStage3State({onboardingByPet,recaps}),metadataSkipped};
}
export function mergeStage3State(current,incoming){const previous=normalizeStage3State(current),next=normalizeStage3State(incoming);return {onboardingByPet:{...next.onboardingByPet,...previous.onboardingByPet},recaps:[...previous.recaps,...next.recaps.filter(r=>!previous.recaps.some(old=>old.id===r.id))]};}
