import {createAiContext} from '../ai/context.js';
import {stage3Text as t,escapeStage3 as esc,stage3Error,refreshStage3Copy,stage3Help} from '../ui/stage3-copy.js';

const scopeFields=['repository','generation','mode','workspaceId','petId','ownerId'];
const failure=code=>Object.assign(new Error(code),{code});
export function createAssistantConversation({request,getSnapshot,getScope,getLocale}={}){
 let scope={...getScope()},history=[],generation=0,pending=false;
 const same=current=>scopeFields.every(key=>scope[key]===current[key]);
 const reset=()=>{scope={...getScope()};history=[];generation++;pending=false;};
 const syncScope=()=>{if(!same(getScope())){reset();return true;}return false;};
 return {reset,syncScope,messages:()=>history.map(message=>({...message,sources:message.sources?.map(source=>({...source}))})),
  async ask(value){
   syncScope();const question=String(value??'').trim();if(!question||question.length>1000)throw failure('INVALID_INPUT');
   if(pending)throw failure('BUSY');pending=true;const started=generation;
   try{
    const result=await request('ai.assistant.ask',{petId:scope.petId??null,question,uiLocale:getLocale(),context:createAiContext(getSnapshot(),scope.petId),history:history.map(({role,content})=>({role,content}))});
    if(started!==generation||syncScope())throw failure('WORKSPACE_CHANGED');
    if(typeof result?.answer!=='string'||!result.answer.trim())throw failure('INVALID_MODEL_OUTPUT');
    const sources=Array.isArray(result.sources)?result.sources:[];
    history=[...history,{role:'user',content:question},{role:'assistant',content:result.answer,sources}].slice(-8);
    return {...result,sources};
   }finally{if(started===generation)pending=false;}
  }
 };
}

export function createAssistantPanel({request,getSnapshot,getScope,getLocale,openModal,onSource}={}){
 const conversation=createAssistantConversation({request,getSnapshot,getScope,getLocale});
 let form=null,busy=false,quota=null,pendingQuestion='',uiGeneration=0,lastError=null;
 const current=()=>form?.isConnected&&form.closest('dialog')?.open;
 const consent=()=>getLocale()==='en'?'Sending a question shares it and necessary current-pet record excerpts with SiliconFlow.':'发送问题时，会将问题和当前宠物的必要记录片段发送给硅基流动。';
 const petName=()=>getSnapshot().pets.find(p=>p.id===getScope().petId&&p.deletedAt==null)?.name??t('noPet');
 function renderMessages(){
  if(!current())return;
  const log=form.querySelector('#assistant-messages'),messages=conversation.messages();
  log.innerHTML=messages.map((message,index)=>`<article class="assistant-message ${message.role}"><strong>${esc(t(message.role==='user'?'user':'answer'))}</strong><p>${esc(message.content)}</p>${message.sources?.length?`<div class="assistant-sources"><span>${esc(t('sources'))}</span>${message.sources.map((source,sourceIndex)=>`<button type="button" class="button secondary" data-assistant-source="${index}:${sourceIndex}">${esc(source.kind==='help'?stage3Help(source).title:source.label??source.title??source.id)}</button>`).join('')}</div>`:''}</article>`).join('')+(busy?`<article class="assistant-message user"><strong>${esc(t('user'))}</strong><p>${esc(pendingQuestion)}</p></article><p role="status">${esc(t('thinking'))}</p>`:'');
  form.querySelector('#assistant-scope').textContent=t('assistantScope',{name:petName()});
  form.querySelector('#assistant-consent').textContent=consent();
  form.querySelector('#assistant-quota').textContent=quota?t('quota',{count:quota.remaining??0}):'';
  form.querySelector('#assistant-ask').disabled=busy;
  log.scrollTop=log.scrollHeight;
 }
 function refreshLocale(){
  if(!current())return;refreshStage3Copy(form);renderMessages();
  form.closest('dialog').querySelector('#dialog-title').textContent=t('assistant');
  if(lastError)form.querySelector('.form-error').textContent=stage3Error(lastError);
  form.querySelector('#assistant-messages').setAttribute('aria-label',t('assistant'));
 }
 function reset(){
  conversation.reset();uiGeneration++;busy=false;quota=null;pendingQuestion='';lastError=null;
  if(current()){form.querySelector('#assistant-question').value='';form.querySelector('.form-error').hidden=true;form.querySelector('#assistant-ask').disabled=false;renderMessages();}
 }
 return {reset,refreshLocale,syncScope(){if(conversation.syncScope()){uiGeneration++;busy=false;quota=null;pendingQuestion='';lastError=null;if(current()){form.querySelector('#assistant-question').value='';form.querySelector('.form-error').hidden=true;form.querySelector('#assistant-ask').disabled=false;renderMessages();}return true;}return false;},
  open(){
   if(conversation.syncScope()){uiGeneration++;busy=false;quota=null;pendingQuestion='';lastError=null;}
   const html=`<form id="assistant-form" data-readonly-ai><p class="form-tip" data-s3-key="assistantWelcome">${esc(t('assistantWelcome'))}</p><p class="demo-note" id="assistant-scope"></p><p class="demo-note" data-s3-key="assistantLimited">${esc(t('assistantLimited'))}</p><p class="demo-note" data-s3-key="notMedical">${esc(t('notMedical'))}</p><div class="assistant-quick">${['helpQuestion','recordsQuestion','remindersQuestion'].map(key=>`<button type="button" class="button secondary" data-assistant-quick="${key}" data-s3-key="${key}">${esc(t(key))}</button>`).join('')}</div><section id="assistant-messages" class="assistant-messages" role="log" aria-live="polite" aria-relevant="additions text" aria-label="${esc(t('assistant'))}"></section><label class="field" for="assistant-question"><span data-s3-key="question">${esc(t('question'))}</span><textarea id="assistant-question" name="question" rows="3" maxlength="1000" required></textarea></label><p class="demo-note" id="assistant-consent"></p><p class="demo-note" id="assistant-quota" role="status"></p><p class="form-error" role="alert" hidden></p><div class="form-actions"><button type="button" class="button secondary" data-action="close" data-s3-key="close">${esc(t('close'))}</button><button type="submit" class="button" id="assistant-ask" data-s3-key="ask">${esc(t('ask'))}</button></div></form>`;
   if(!openModal(t('assistant'),html))return;
   form=document.querySelector('#assistant-form');const openedForm=form;
   form.__pawLocaleRefresh=refreshLocale;
   form.addEventListener('click',event=>{
    const quick=event.target.closest('[data-assistant-quick]');
    if(quick&&!busy){form.querySelector('#assistant-question').value=t(quick.dataset.assistantQuick);form.requestSubmit();}
    const sourceButton=event.target.closest('[data-assistant-source]');
    if(sourceButton){const[index,sourceIndex]=sourceButton.dataset.assistantSource.split(':').map(Number),source=conversation.messages()[index]?.sources?.[sourceIndex];if(source)onSource?.(source);}
   });
   form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const input=openedForm.querySelector('#assistant-question'),question=input.value.trim();if(!question){input.focus();return;}
    const started=uiGeneration;lastError=null;busy=true;pendingQuestion=question;openedForm.querySelector('#assistant-ask').disabled=true;openedForm.querySelector('.form-error').hidden=true;renderMessages();
    try{
     const result=await conversation.ask(question);if(started!==uiGeneration)return;quota=result.quota??quota;
     if(form===openedForm&&current())input.value='';
    }catch(error){if(started===uiGeneration&&form===openedForm&&current()){const target=openedForm.querySelector('.form-error');lastError=error;target.hidden=false;target.textContent=stage3Error(error);}}
    finally{if(started===uiGeneration){busy=false;pendingQuestion='';renderMessages();if(form===openedForm&&current())input.focus();}}
   });
   renderMessages();form.querySelector('#assistant-question').focus();
  }
 };
}
