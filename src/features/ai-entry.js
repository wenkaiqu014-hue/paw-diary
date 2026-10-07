import {toEntryInputs} from '../domain/ai-drafts.js';
import {createAiContext} from '../ai/context.js';
import {mountRecordFields} from '../ui/record-fields.js';
import {stage3Text as t,escapeStage3 as esc,stage3Error,refreshStage3Copy} from '../ui/stage3-copy.js';
export function createDraftSession({repository,getSnapshot,request,getScope,purpose='record'}={}){
 let scope=null,baseRevision,operationId,today,defaultPurpose='record';
 const same=()=>!getScope||['repository','generation','petId','workspaceId','mode','ownerId'].every(k=>scope?.[k]===getScope()[k]);
 return {async parse(text,petId,uiLocale){
   scope=getScope?{...getScope()}:{};baseRevision=repository.getRevision?.();operationId=crypto.randomUUID();defaultPurpose=typeof purpose==='function'?purpose():purpose;
   const result=await request('ai.records.parse',{text,petId,uiLocale,purpose:defaultPurpose,context:createAiContext(getSnapshot(),petId)});
   if(!same())throw Object.assign(new Error('WORKSPACE_CHANGED'),{code:'WORKSPACE_CHANGED'});
   today=result.today??new Date(Date.now()+8*3600000).toISOString().slice(0,10);return result;
 },acceptCatalogRevision(revision,priorRevision){if(!same())throw Object.assign(new Error('WORKSPACE_CHANGED'),{code:'WORKSPACE_CHANGED'});if(priorRevision===baseRevision)baseRevision=revision;},async confirm(drafts,selectedIds){
   if(!same())throw Object.assign(new Error('WORKSPACE_CHANGED'),{code:'WORKSPACE_CHANGED'});
   const snapshot=getSnapshot(),entries=toEntryInputs(drafts.map(d=>({...d,purpose:d.purpose??defaultPurpose})),selectedIds,{pets:snapshot.pets,today,catalog:snapshot.profile?.recordTypeCatalog});
   return repository.saveEntryBatch(entries,{baseRevision,operationId});
 }};
}
export function createAiEntry({request,getRepository,getSnapshot,getScope,getLocale,openModal,onSaved,getTypeEntries=()=>[],enhanceAll=null,enhanceType=null}={}){
 return {open({host=null,purpose='record',beforeSave=null}={}){
   if(!getScope().petId)return;
   const repo=getRepository(),draftSession=createDraftSession({repository:repo,getSnapshot,getScope,request,purpose});let drafts=[],busy=false,fields=[],remaining=null,quotaError=null;
   const html=`<form id="ai-entry-form"><div class="record-mode-tabs"><button type="button" class="button secondary" data-action="record" data-s3-key="manual">${esc(t('manual'))}</button><span data-s3-key="ai">${esc(t('ai'))}</span></div><p class="demo-note" id="ai-current-pet"></p><p class="form-tip" data-s3-key="consent">${esc(t('consent'))}</p><label class="field"><span data-s3-key="input">${esc(t('input'))}</span><textarea id="ai-text" name="aiText" maxlength="1000" rows="4" required placeholder="${esc(t('example'))}"></textarea></label><p class="demo-note" id="ai-quota" role="status"></p><button type="button" class="button" id="ai-parse" data-s3-key="parse">${esc(t('parse'))}</button><section id="ai-drafts" aria-live="polite"></section><p class="form-error" role="alert" hidden></p><div class="form-actions"><button type="button" class="button secondary" data-action="close" data-s3-key="cancel">${esc(t('cancel'))}</button><button type="submit" class="button" id="ai-confirm" data-s3-key="confirm" hidden>${esc(t('confirm'))}</button></div></form>`;
   if(host){host.innerHTML=html;host.querySelector('.record-mode-tabs')?.remove();}else if(!openModal(t('aiTitle'),html))return;
   const form=(host??document).querySelector('#ai-entry-form'),parse=form.querySelector('#ai-parse'),error=form.querySelector('.form-error'),out=form.querySelector('#ai-drafts'),confirm=form.querySelector('#ai-confirm');
   const current=()=>form.isConnected&&form.closest('dialog')?.open;
   const report=e=>{error.hidden=false;error.textContent=stage3Error(e);};
   const refreshQuota=()=>{form.querySelector('#ai-quota').textContent=remaining!==null?t('quota',{count:remaining}):quotaError?stage3Error(quotaError):t('quotaLoading');};
   form.__pawLocaleRefresh=()=>{refreshStage3Copy(form);fields.forEach(f=>f.refreshLocale());syncSelection();refreshQuota();if(!host)document.querySelector('#dialog-title').textContent=t('aiTitle');form.querySelector('#ai-current-pet').textContent=t('currentPet',{name:getSnapshot().pets.find(p=>p.id===getScope().petId)?.name??''});enhanceAll?.();};
   form.__pawLocaleRefresh();
   request('ai.quota',{}).then(q=>{if(current()){remaining=q.remaining??0;refreshQuota();}}).catch(e=>{if(current()){quotaError=e;refreshQuota();}});
   function syncSelection(){confirm.disabled=busy||!out.querySelector('[name=selected]:checked');for(const row of out.querySelectorAll('fieldset')){const checked=row.querySelector('[name=selected]').checked;row.querySelector('.form-grid').hidden=!checked;for(const control of row.querySelectorAll('.form-grid input,.form-grid select,.form-grid textarea')){if(!checked){if(control.dataset.unselectedDisabled===undefined)control.dataset.unselectedDisabled=String(control.disabled);control.disabled=true;}else if(control.dataset.unselectedDisabled!==undefined){control.disabled=control.dataset.unselectedDisabled==='true';delete control.dataset.unselectedDisabled;}}}if(form.hasAttribute('data-ai-saving'))for(const el of form.querySelectorAll('button,input,select,textarea'))el.disabled=true;}
   parse.addEventListener('click',async()=>{
     const text=form.querySelector('#ai-text').value.trim();if(!text){report(new Error(getLocale()==='en'?'Describe an event or plan first.':'请先写下想记入的事情或计划。'));return;}if(busy)return;busy=true;parse.disabled=true;parse.textContent=t('loading');error.hidden=true;
     try{const result=await draftSession.parse(text,getScope().petId,getLocale());if(!current())return;drafts=result.drafts;remaining=result.quota?.remaining??remaining;refreshQuota();fields.forEach(f=>f.destroy());
       out.innerHTML=`<h3 data-s3-key="drafts">${esc(t('drafts'))}</h3>`+drafts.map((d,i)=>`<fieldset class="ai-draft" data-draft-index="${i}"><legend><label><input type="checkbox" name="selected" value="${esc(d.draftId)}" checked> <span data-s3-key="select">${esc(t('select'))}</span></label></legend><p class="demo-note"><span data-s3-key="source">${esc(t('source'))}</span>：${esc(d.sourceText||text)}</p>${d.missingFields?.length?`<p class="form-tip" data-s3-key="missing">${esc(t('missing'))}</p>`:''}${d.suggestedTypeLabel?`<p class="form-tip">${esc(getLocale()==='en'?`Suggested type: ${d.suggestedTypeLabel}. Choose or add a type below.`:`识别到“${d.suggestedTypeLabel}”，请在下方选择或新增类型。`)}</p>`:''}<div class="form-grid"></div></fieldset>`).join('');
       fields=drafts.map((d,i)=>mountRecordFields({root:out.querySelector(`[data-draft-index="${i}"] .form-grid`),idPrefix:`ai-row-${i}`,values:{purpose:d.purpose??(typeof purpose==='function'?purpose():purpose),type:d.customTypeId??d.type??'',petId:d.petId??'',date:d.occurredDate??'',dueDate:d.dueDate??'',value:d.value??'',title:d.title??'',note:d.note??'',...(d.purpose==='plan'&&typeof d.includeInHealth==='boolean'?{includeInHealth:d.includeInHealth}:{})},getEntries:getTypeEntries,getLocale,today:result.today,showPet:true,pets:getSnapshot().pets.filter(p=>p.deletedAt===null),enhanceAll,enhanceType:select=>enhanceType?.(select,{onCatalogUpdated:(revision,priorRevision)=>{draftSession.acceptCatalogRevision(revision,priorRevision);fields.forEach(f=>f.refreshLocale());syncSelection();enhanceAll?.();}})}));
       confirm.hidden=false;parse.hidden=true;form.querySelector('#ai-text').readOnly=true;syncSelection();enhanceAll?.();
     }catch(e){if(current())report(e);}finally{busy=false;parse.disabled=false;parse.textContent=t('parse');if(drafts.length&&current())syncSelection();}
   });
   out.addEventListener('change',event=>{if(event.target.name==='selected')syncSelection();});
   form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!drafts.length)return;
     const selected=[...out.querySelectorAll('[name=selected]:checked')].map(el=>el.value);
     const edited=drafts.map((d,i)=>{const v=fields[i].read(),entry=getTypeEntries().find(e=>e.id===v.type),weight=v.purpose==='record'&&entry?.type==='weight';return {...d,purpose:v.purpose,petId:v.petId||null,type:entry?.type??null,customTypeId:entry&&!entry.builtin?entry.id:undefined,typeLabel:entry&&!entry.builtin?entry.name:undefined,iconKey:entry&&!entry.builtin?entry.iconKey:undefined,occurredDate:v.date||null,dueDate:v.dueDate||null,value:weight&&v.value!==''?Number(v.value):null,unit:weight?'kg':null,title:v.title,note:v.note,includeInHealth:v.includeInHealth,missingFields:[]};});
     busy=true;form.setAttribute('data-ai-saving','');const disabled=[...form.querySelectorAll('button,input,select,textarea')].map(el=>[el,el.disabled]);for(const [el] of disabled)el.disabled=true;confirm.textContent=t('saving');error.hidden=true;
     try{await beforeSave?.();const result=await draftSession.confirm(edited,selected);if(current())await onSaved(result);}
     catch(e){if(current())report(e);}finally{busy=false;form.removeAttribute('data-ai-saving');if(current()){for(const [el,wasDisabled] of disabled)el.disabled=wasDisabled;syncSelection();confirm.textContent=t('confirm');}}
   });if(!host){const title=document.querySelector('#dialog-title');if(title){title.tabIndex=-1;title.focus();}}
 }};
}
