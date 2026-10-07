import {advanceOnboarding} from '../domain/onboarding.js';
import {stage3Text as t,escapeStage3 as esc,stage3Error} from '../ui/stage3-copy.js';
export function createOnboarding({getSnapshot,getRepository,getScope,onChanged,onPet,onRecord,onReminder,onError}={}){
 let dismissed=null;
 const key=()=>{const s=getScope();return `${s.generation}:${s.mode}:${s.workspaceId}:${s.petId}`;};
 function progress(){
   const snapshot=getSnapshot(),petId=getScope().petId;
   let saved=snapshot.profile.stage3?.onboardingByPet?.[petId];
   if(!saved&&petId){const records=snapshot.records.filter(r=>r.petId===petId&&r.deletedAt===null),reminder=snapshot.reminders.find(r=>r.petId===petId&&r.deletedAt===null);saved={petId,step:records.length&&reminder?'done':records.length?'reminder':'record',recordIds:records.slice(0,1).map(r=>r.id),reminderId:reminder?.id??null,updatedAt:new Date().toISOString()};}
   return advanceOnboarding(saved,{type:'RESUME'},snapshot);
 }
 async function save(next){const repo=getRepository();await repo.saveOnboarding(next,{baseRevision:repo.getRevision?.(),operationId:crypto.randomUUID()});}
 return {getProgress:progress,async noteSaved(event){
   const snapshot=getSnapshot(),petId=getScope().petId,current=progress();
   if(!petId||event.type!=='PET_SAVED'&&current.step==='done')return;
   if(event.type==='RECORDS_SAVED'&&current.step!=='record'&&snapshot.profile.stage3?.onboardingByPet?.[petId]?.step!=='record')return;
   if(event.type==='REMINDER_SAVED'&&current.step!=='reminder')return;
   const previous=snapshot.profile.stage3?.onboardingByPet?.[petId];
   let next=advanceOnboarding(previous,{...event,petId,updatedAt:new Date().toISOString()},snapshot);
   if(event.type==='RECORDS_SAVED'){const reminder=snapshot.reminders.find(r=>r.petId===petId&&r.deletedAt===null&&next.recordIds.includes(r.originRecordId));if(reminder)next=advanceOnboarding(next,{type:'REMINDER_SAVED',reminderId:reminder.id},snapshot);}
   await save(next);
 },mount(host){
   if(!host)return;const current=progress();host.hidden=current.step==='done'||dismissed===key()||getScope().mode==='demo';if(host.hidden)return;
   const action=current.step==='pet'?'start':current.step==='record'?'firstRecord':'setReminder';
   host.innerHTML=`<div class="onboarding-heading"><div><h2>${esc(t('onboarding'))}</h2><p>${esc(t('onboardingDesc'))}</p></div><button type="button" class="text-button" data-s3-later>${esc(t('later'))}</button></div><ol class="onboarding-steps">${[['pet','petStep'],['record','recordStep'],['reminder','reminderStep']].map(([step,label])=>`<li ${step===current.step?'aria-current="step"':''}>${esc(t(label))}</li>`).join('')}</ol><div class="onboarding-actions"><button type="button" class="button secondary" data-s3-continue>${esc(t(action))}</button>${current.step==='reminder'?`<button type="button" class="text-button" data-s3-skip>${esc(t('skipReminder'))}</button>`:''}</div>`;
   host.querySelector('[data-s3-later]').onclick=()=>{dismissed=key();host.hidden=true;};
   host.querySelector('[data-s3-continue]').onclick=()=>{if(current.step==='pet')onPet();else if(current.step==='record')onRecord();else onReminder();};
   const skip=host.querySelector('[data-s3-skip]');if(skip)skip.onclick=async()=>{skip.disabled=true;try{const next=advanceOnboarding(current,{type:'REMINDER_SKIPPED',updatedAt:new Date().toISOString()},getSnapshot());await save(next);await onChanged();}catch(error){onError?.(stage3Error(error));skip.disabled=false;}};
 }};
}
