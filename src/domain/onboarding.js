import {clone,isoTime} from './schema.js?v=0.2.0';
import {normalizeStage3State,normalizeOnboardingProgress} from './stage3-state.js';
function visible(snapshot,field,petId,id){return snapshot[field].some(x=>x.petId===petId&&x.id===id&&x.deletedAt===null);}
export function advanceOnboarding(progress,event={},snapshot){
 const type=event.type??'RESUME';if(!['PET_SAVED','RECORDS_SAVED','REMINDER_SAVED','REMINDER_SKIPPED','DEFERRED','RESUME'].includes(type))throw new Error('引导事件无效');
 const petId=event.petId??progress?.petId??snapshot.activePetId??null;
 const pet=snapshot.pets.find(p=>p.id===petId&&p.deletedAt===null);
 if(!pet){if(type==='RESUME'||type==='DEFERRED')return {petId:null,step:'pet',recordIds:[],reminderId:null,updatedAt:event.updatedAt??progress?.updatedAt??new Date().toISOString()};throw new Error('宠物不存在或已在回收站');}
 if(progress?.petId&&progress.petId!==petId)throw new Error('引导宠物归属不一致');
 let recordIds=(progress?.recordIds??snapshot.records.filter(r=>r.petId===petId&&r.deletedAt===null).slice(0,1).map(r=>r.id)).filter(id=>visible(snapshot,'records',petId,id));
 if(type==='RESUME'&&!recordIds.length)recordIds=snapshot.records.filter(r=>r.petId===petId&&r.deletedAt===null).slice(0,1).map(r=>r.id);
 let reminderId=progress?.reminderId??null;if(reminderId&&!visible(snapshot,'reminders',petId,reminderId))reminderId=null;
 let step=recordIds.length?(progress?.step==='done'&&(!progress.reminderId||reminderId)?'done':reminderId?'done':'reminder'):'record';
 if(type==='RECORDS_SAVED'){if(!Array.isArray(event.recordIds)||!event.recordIds.length||event.recordIds.some(id=>!visible(snapshot,'records',petId,id)))throw new Error('引导记录不存在或归属无效');recordIds=[...new Set(event.recordIds)];step='reminder';}
 if(type==='REMINDER_SAVED'){if(!recordIds.length)throw new Error('请先保存首笔记录');if(!visible(snapshot,'reminders',petId,event.reminderId))throw new Error('引导提醒不存在或归属无效');reminderId=event.reminderId;step='done';}
 if(type==='REMINDER_SKIPPED'){if(!recordIds.length)throw new Error('请先保存首笔记录');reminderId=null;step='done';}
 return {petId,step,recordIds,reminderId,updatedAt:event.updatedAt??progress?.updatedAt??new Date().toISOString()};
}
export function applyOnboarding(snapshot,input,{now=new Date().toISOString()}={}){
 const next=clone(snapshot),progress=normalizeOnboardingProgress({...input,updatedAt:isoTime(now)});
 if(!next.pets.some(p=>p.id===progress.petId&&p.deletedAt===null))throw new Error('宠物不存在或已在回收站');
 if(progress.recordIds.some(id=>!visible(next,'records',progress.petId,id)))throw new Error('引导记录不存在或归属无效');
 if(progress.reminderId&&!visible(next,'reminders',progress.petId,progress.reminderId))throw new Error('引导提醒不存在或归属无效');
 if(['reminder','done'].includes(progress.step)&&!progress.recordIds.length)throw new Error('请先保存首笔记录');
 next.profile.stage3=normalizeStage3State(next.profile.stage3);Object.defineProperty(next.profile.stage3.onboardingByPet,progress.petId,{value:progress,enumerable:true,writable:true,configurable:true});return {snapshot:next,progress};
}
