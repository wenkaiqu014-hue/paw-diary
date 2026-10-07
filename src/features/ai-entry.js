import {toRecordInputs} from '../domain/ai-drafts.js';
import {createAiContext} from '../ai/context.js';
import {stage3Text as t,escapeStage3 as esc,stage3Error,refreshStage3Copy} from '../ui/stage3-copy.js';
export function createDraftSession({repository,getSnapshot,request,getScope}={}){
 let scope=null,baseRevision,operationId,today;
 const same=()=>!getScope||['repository','generation','petId','workspaceId','mode','ownerId'].every(k=>scope[k]===getScope()[k]);
 return {async parse(text,petId,uiLocale){
   scope=getScope?{...getScope()}:{};baseRevision=repository.getRevision?.();operationId=crypto.randomUUID();
   const result=await request('ai.records.parse',{text,petId,uiLocale,context:createAiContext(getSnapshot(),petId)});
   today=result.today??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());return result;
 },async confirm(drafts,selectedIds){
   if(!same())throw Object.assign(new Error('WORKSPACE_CHANGED'),{code:'WORKSPACE_CHANGED'});
   const inputs=toRecordInputs(drafts,selectedIds,{pets:getSnapshot().pets,today});
   return repository.saveRecordBatch(inputs,{baseRevision,operationId});
 }};
}
export function createAiEntry({request,getRepository,getSnapshot,getScope,getLocale,openModal,onSaved}={}){
 return {open(){
   if(!getScope().petId)return;
   const repo=getRepository(),draftSession=createDraftSession({repository:repo,getSnapshot,getScope,request});let drafts=[],busy=false;
   const label=(key,input)=>`<label class="field"><span data-s3-key="${key}">${esc(t(key))}</span>${input}</label>`;
   const html=`<form id="ai-entry-form"><div class="record-mode-tabs"><button type="button" class="button secondary" data-action="record" data-s3-key="manual">${esc(t('manual'))}</button><span data-s3-key="ai">${esc(t('ai'))}</span></div><p class="demo-note" id="ai-current-pet">${esc(t('currentPet',{name:getSnapshot().pets.find(p=>p.id===getScope().petId)?.name??''}))}</p><p class="form-tip" data-s3-key="consent">${esc(t('consent'))}</p>${label('input',`<textarea id="ai-text" name="aiText" maxlength="1000" rows="4" required placeholder="${esc(t('example'))}"></textarea>`)}<p class="demo-note" id="ai-quota" role="status">${esc(t('quotaLoading'))}</p><button type="button" class="button" id="ai-parse" data-s3-key="parse">${esc(t('parse'))}</button><section id="ai-drafts" aria-live="polite"></section><p class="form-error" role="alert" hidden></p><div class="form-actions"><button type="button" class="button secondary" data-action="close" data-s3-key="cancel">${esc(t('cancel'))}</button><button type="submit" class="button" id="ai-confirm" data-s3-key="confirm" hidden>${esc(t('confirm'))}</button></div></form>`;
   if(!openModal(t('aiTitle'),html))return;
   const form=document.querySelector('#ai-entry-form'),parse=form.querySelector('#ai-parse'),error=form.querySelector('.form-error'),out=form.querySelector('#ai-drafts'),confirm=form.querySelector('#ai-confirm');
   form.__pawLocaleRefresh=()=>{refreshStage3Copy(form);for(const option of form.querySelectorAll('[name=type] option'))option.textContent=t(option.value);document.querySelector('#dialog-title').textContent=t('aiTitle');form.querySelector('#ai-current-pet').textContent=t('currentPet',{name:getSnapshot().pets.find(p=>p.id===getScope().petId)?.name??''});};
   const current=()=>form.isConnected&&form.closest('dialog')?.open;
   const report=e=>{error.hidden=false;error.textContent=stage3Error(e);};
   request('ai.quota',{}).then(q=>{if(current())form.querySelector('#ai-quota').textContent=t('quota',{count:q.remaining??0});}).catch(e=>{if(current())form.querySelector('#ai-quota').textContent=stage3Error(e);});
   parse.addEventListener('click',async()=>{
     const text=form.querySelector('#ai-text').value.trim();if(!text){form.querySelector('#ai-text').focus();return;}if(busy)return;busy=true;parse.disabled=true;parse.textContent=t('loading');error.hidden=true;
     try{const result=await draftSession.parse(text,getScope().petId,getLocale());if(!current())return;drafts=result.drafts;form.querySelector('#ai-quota').textContent=t('quota',{count:result.quota?.remaining??0});
       out.innerHTML=`<h3 data-s3-key="drafts">${esc(t('drafts'))}</h3>`+drafts.map((d,i)=>`<fieldset class="ai-draft" data-draft-index="${i}"><legend><label><input type="checkbox" name="selected" value="${esc(d.draftId)}" checked> <span data-s3-key="select">${esc(t('select'))}</span></label></legend><p class="demo-note"><span data-s3-key="source">${esc(t('source'))}</span>：${esc(d.sourceText||text)}</p>${d.missingFields?.length?`<p class="form-tip" data-s3-key="missing">${esc(t('missing'))}</p>`:''}<div class="form-grid">${label('pet',`<select name="petId" required><option value="" data-s3-key="choosePet">${esc(t('choosePet'))}</option>${getSnapshot().pets.filter(p=>p.deletedAt===null).map(p=>`<option value="${esc(p.id)}" ${p.id===d.petId?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`)}${label('type',`<select name="type">${['weight','vaccine','deworm','daily','other'].map(k=>`<option value="${k}" ${k===d.type?'selected':''}>${esc(t(k))}</option>`).join('')}</select>`)}${label('date',`<input type="date" name="occurredDate" value="${esc(d.occurredDate??'')}" required>`)}${label('value',`<input type="number" name="value" min="0.01" max="200" step="0.01" value="${d.value??''}">`)}${label('typeLabel',`<input name="typeLabel" maxlength="20" value="${esc(d.typeLabel??'')}">`)}${label('title',`<input name="title" maxlength="60" value="${esc(d.title??'')}" required>`)}${label('nextDate',`<input type="date" name="nextDate" value="${esc(d.nextDate??'')}">`)}${d.missingFields?.includes('nextDate')?`<label class="ai-reminder-choice"><input type="checkbox" name="skipNextDate"> <span data-s3-key="skipNextDate">${esc(t('skipNextDate'))}</span></label>`:''}${label('note',`<textarea name="note" maxlength="500">${esc(d.note??'')}</textarea>`)}</div></fieldset>`).join('');
       confirm.hidden=false;parse.hidden=true;form.querySelector('#ai-text').readOnly=true;syncDraftFields();
     }catch(e){if(current())report(e);}finally{busy=false;parse.disabled=false;parse.textContent=t('parse');if(drafts.length&&current())syncDraftFields();}
   });
   function syncDraftFields(){confirm.disabled=busy||!out.querySelector('[name=selected]:checked');for(const row of out.querySelectorAll('fieldset')){const checked=row.querySelector('[name=selected]').checked,type=row.querySelector('[name=type]').value;for(const field of row.querySelectorAll('input,select,textarea'))if(field.name!=='selected')field.disabled=!checked;row.querySelector('[name=value]').closest('label').hidden=type!=='weight';row.querySelector('[name=value]').required=checked&&type==='weight';row.querySelector('[name=typeLabel]').closest('label').hidden=type!=='other';row.querySelector('[name=typeLabel]').required=checked&&type==='other';const skip=row.querySelector('[name=skipNextDate]')?.checked??false;row.querySelector('[name=nextDate]').required=checked&&drafts[Number(row.dataset.draftIndex)].missingFields?.includes('nextDate')&&!skip;row.querySelector('[name=nextDate]').disabled=!checked||skip;}}
   out.addEventListener('change',syncDraftFields);
   form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!drafts.length)return;busy=true;form.setAttribute('data-ai-saving','');for(const control of form.querySelectorAll('button,input,select,textarea'))control.disabled=true;confirm.textContent=t('saving');error.hidden=true;
     try{const edited=drafts.map((d,i)=>{const row=out.querySelector(`[data-draft-index="${i}"]`),value=name=>row.querySelector(`[name=${name}]`).value;const type=value('type');return {...d,petId:value('petId')||null,type,typeLabel:type==='other'?value('typeLabel'):undefined,occurredDate:value('occurredDate')||null,value:type==='weight'?Number(value('value')):null,unit:type==='weight'?'kg':null,title:value('title'),note:value('note'),nextDate:row.querySelector('[name=skipNextDate]')?.checked?null:value('nextDate')||null,missingFields:d.missingFields?.includes('nextDate')?['nextDate']:[],skipNextDate:row.querySelector('[name=skipNextDate]')?.checked===true};});
       const selected=[...out.querySelectorAll('[name=selected]:checked')].map(el=>el.value);const result=await draftSession.confirm(edited,selected);if(current())await onSaved(result);
     }catch(e){if(current())report(e);}finally{busy=false;form.removeAttribute('data-ai-saving');if(current()){for(const control of form.querySelectorAll('button,input,select,textarea'))control.disabled=false;syncDraftFields();confirm.disabled=!out.querySelector('[name=selected]:checked');confirm.textContent=t('confirm');}}
   });form.querySelector('#ai-text').focus();
 }};
}
