import {escapeTranslation} from './i18n.js';
import {localizeError} from './error-localization.js';
const localErrorKeys=new Set(['account.emailRequired','account.emailInvalid','account.codeRequired','account.codeInvalid','account.requestFirst','account.verifyFailed','account.betaRequired','account.betaInvalid']);
const safeCodes=new Set(['UNAUTHENTICATED','FORBIDDEN','INVALID_INPUT','CONFLICT','UNAVAILABLE','QUOTA_EXCEEDED','BETA_CODE_REQUIRED','BETA_CODE_INVALID','BETA_ACCESS_REQUIRED','BETA_CONFIG_INVALID','RATE_LIMITED','unauth','forbidden','invalid','conflict','unavailable','quota']);
const invalid=messageKey=>Object.assign(new Error(messageKey),{messageKey});
export function validateEmail(value){const email=String(value??'').trim();if(!email)throw invalid('account.emailRequired');if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw invalid('account.emailInvalid');return email;}
export function validateCode(value){const code=String(value??'').trim();if(!code)throw invalid('account.codeRequired');if(!/^[0-9]{4,10}$/.test(code))throw invalid('account.codeInvalid');return code;}
export function validateBetaCode(value){if(value===undefined||value===null||value==='')throw invalid('account.betaRequired');if(typeof value!=='string'||!/^\d{6}$/.test(value))throw invalid('account.betaInvalid');return value;}
export function createAccountUI({auth,betaRequired=false,getGeneration=()=>0,modal,closeModal,onSignedIn=()=>{},onSignedOut=()=>{},onImportLocal=()=>{},t,document=globalThis.document,onError=()=>{}}={}){
  let destroyed=false,epoch=0,timer=null,challenge=null,cooldownUntil=0,busy=false,activeForm=null,currentMode=null,lastError=null;
  const win=document?.defaultView??globalThis;
  const text=key=>escapeTranslation(t(key));
  const copy=key=>`<span data-account-i18n="${key}">${text(key)}</span>`;
  function clearTimer(){if(timer!==null){win.clearInterval(timer);timer=null;}}
  function formIsOpen(form){const dialog=form?.closest('dialog');return !!form?.isConnected&&(!dialog||dialog.open);}
  function isCurrent(token,generation){return !destroyed&&epoch===token&&getGeneration()===generation&&formIsOpen(activeForm);}
  function begin(form,mode){clearInputs(activeForm);epoch++;clearTimer();challenge=null;busy=false;activeForm=form;currentMode=mode;lastError=null;return epoch;}
  function errorMessage(error){if(localErrorKeys.has(error?.messageKey))return t(error.messageKey);return localizeError(error,t);}
  function clearInputs(form){for(const input of form?.querySelectorAll('input')??[])input.value='';}
  function dialogClosed(event){if(activeForm&&event.target===activeForm.closest('dialog')&&!event.target.open){clearInputs(activeForm);epoch++;challenge=null;clearTimer();activeForm=null;}}
  document?.addEventListener?.('close',dialogClosed,true);
  function invalidateChallenge(form){epoch++;challenge=null;form.querySelector('[name=code]').value='';const status=form.querySelector('.account-status');status.dataset.accountI18n='account.challengeChanged';status.textContent=t('account.challengeChanged');setBusy(false);}
  function report(form,error){if(!formIsOpen(form)||destroyed)return;const output=form.querySelector('.form-error');lastError={...(localErrorKeys.has(error?.messageKey)?{messageKey:error.messageKey}:{}),...(safeCodes.has(error?.code)?{code:error.code}:{}),...(Number.isInteger(error?.params?.retryAfterSeconds)?{params:{retryAfterSeconds:error.params.retryAfterSeconds}}:{})};output.hidden=false;output.textContent=errorMessage(error);output.tabIndex=-1;const betaError=['account.betaRequired','account.betaInvalid'].includes(error?.messageKey)||['BETA_CODE_REQUIRED','BETA_CODE_INVALID'].includes(error?.code);
    const field=betaError?form.querySelector('[name=betaCode]'):error?.messageKey?.startsWith('account.email')?form.querySelector('[name=email]'):['account.codeRequired','account.codeInvalid','account.verifyFailed'].includes(error?.messageKey)?form.querySelector('[name=code]'):null;
    if(field){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',[...new Set(`${field.getAttribute('aria-describedby')??''} account-login-error`.trim().split(/\s+/))].join(' '));}
    (field&&!field.disabled?field:output).focus();onError(error);}
  function setBusy(value){busy=value;if(!formIsOpen(activeForm))return;activeForm.setAttribute('aria-busy',String(value));for(const control of activeForm.querySelectorAll('button,input'))control.disabled=value;if(currentMode==='login'){activeForm.querySelector('[name=code]').disabled=value||!challenge;activeForm.querySelector('[type=submit]').disabled=value||!challenge;updateSend();}}
  function updateSend(){
    if(!formIsOpen(activeForm)||currentMode!=='login'){clearTimer();return;}
    const send=activeForm.querySelector('[data-account-action=send]'),seconds=Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000));
    send.disabled=busy||seconds>0;send.textContent=seconds?t('account.resendCountdown',{seconds}):t(challenge?'account.resendCode':'account.requestCode');
    if(!seconds)clearTimer();
  }
  function refreshLocale(){
    if(!activeForm?.isConnected||destroyed)return;
    for(const node of activeForm.querySelectorAll('[data-account-i18n]'))node.textContent=t(node.dataset.accountI18n);
    const output=activeForm.querySelector('.form-error');if(lastError&&output&&!output.hidden)output.textContent=errorMessage(lastError);
    if(currentMode==='login')updateSend();
  }
  async function sendCode(event){
    event.preventDefault();if(busy||Date.now()<cooldownUntil||destroyed)return;
    const form=activeForm,token=epoch,generation=getGeneration();let sent=false;
    try{const betaCode=betaRequired?validateBetaCode(form.querySelector('[name=betaCode]').value):undefined;const email=validateEmail(form.querySelector('[name=email]').value);setBusy(true);form.querySelector('.form-error').hidden=true;
      const result=await auth.requestEmailCode({email,...(betaRequired?{betaCode}:{})});if(!isCurrent(token,generation))return;
      if(!result?.id||typeof result.id!=='string')throw Object.assign(new Error('unavailable'),{code:'UNAVAILABLE'});
      sent=true;challenge={id:result.id};cooldownUntil=Date.now()+60000;form.querySelector('.account-status').dataset.accountI18n='account.codeSent';form.querySelector('.account-status').textContent=t('account.codeSent');clearTimer();timer=win.setInterval(updateSend,250);form.querySelector('[name=code]').focus();
    }catch(error){if(isCurrent(token,generation)){setBusy(false);if(['BETA_CODE_REQUIRED','BETA_CODE_INVALID','BETA_ACCESS_REQUIRED'].includes(error?.code))invalidateChallenge(form);report(form,error);}}finally{if(isCurrent(token,generation)){setBusy(false);if(sent)form.querySelector('[name=code]').focus();}}
  }
  async function verifyCode(event){
    event.preventDefault();if(busy||destroyed)return;
    const form=activeForm,token=epoch,generation=getGeneration();
    try{const betaCode=betaRequired?validateBetaCode(form.querySelector('[name=betaCode]').value):undefined;validateEmail(form.querySelector('[name=email]').value);if(!challenge)throw invalid('account.requestFirst');const code=validateCode(form.querySelector('[name=code]').value);setBusy(true);form.querySelector('.form-error').hidden=true;
      const result=await auth.verifyEmailCode({challenge,code,...(betaRequired?{betaCode}:{})}).catch(error=>{if(error?.code==='UNAUTHENTICATED')throw invalid('account.verifyFailed');throw error;});if(!isCurrent(token,generation))return;
      if(!result?.userId||typeof result.userId!=='string')throw Object.assign(new Error('unavailable'),{code:'UNAVAILABLE'});
      await onSignedIn({userId:result.userId});
      // onSignedIn intentionally changes workspace generation. Only a replaced/destroyed view cancels this continuation.
      if(destroyed||epoch!==token||!form.isConnected)return;
      clearInputs(form);challenge=null;clearTimer();closeModal(true);activeForm=null;await openAccount();
    }catch(error){if(!destroyed&&epoch===token&&form.isConnected){setBusy(false);if(['BETA_CODE_REQUIRED','BETA_CODE_INVALID','BETA_ACCESS_REQUIRED'].includes(error?.code))invalidateChallenge(form);report(form,error);}}finally{if(!destroyed&&epoch===token&&form.isConnected)setBusy(false);}
  }
  function openLogin(){
    if(destroyed)return false;
    const betaField=betaRequired?`<label class="field full">${copy('account.betaCode')}<input name="betaCode" type="text" spellcheck="false" autocapitalize="none" inputmode="numeric" autocomplete="off" maxlength="6" pattern="[0-9]{6}" aria-describedby="account-beta-hint" required></label><p id="account-beta-hint" class="field full form-tip">${copy('account.betaHint')}</p>`:'';
    const markup=`<form id="account-login-form" novalidate><p class="form-tip">${copy('account.emailOnly')}</p><div class="form-grid">${betaField}<label class="field full">${copy('account.email')}<input name="email" type="email" spellcheck="false" autocapitalize="none" autocomplete="email" maxlength="254" aria-describedby="account-email-hint" required></label><p id="account-email-hint" class="field full form-tip">${copy('account.emailHint')}</p><button class="button secondary" type="button" data-account-action="send">${text('account.requestCode')}</button><label class="field full">${copy('account.code')}<input name="code" type="text" spellcheck="false" autocapitalize="none" inputmode="numeric" autocomplete="one-time-code" maxlength="10" pattern="[0-9]{4,10}" disabled aria-describedby="account-code-hint"></label><p id="account-code-hint" class="field full form-tip">${copy('account.codeHint')}</p></div><p class="account-status form-tip" role="status" aria-live="polite"></p><p id="account-login-error" class="form-error" role="alert" hidden></p><div class="form-actions"><button class="button secondary" type="button" data-account-action="close">${copy('common.cancel')}</button><button class="button" type="submit" disabled>${copy('account.verify')}</button></div></form>`;
    if(!modal(t('account.title'),markup))return false;
    const form=document.querySelector('#account-login-form');begin(form,'login');
    form.__pawCleanup=()=>{clearInputs(form);if(activeForm===form){epoch++;challenge=null;clearTimer();activeForm=null;}};
    form.querySelector('[data-account-action=send]').addEventListener('click',sendCode);form.addEventListener('submit',verifyCode);
    form.querySelector('[data-account-action=close]').addEventListener('click',()=>{if(closeModal(false)!==false){clearInputs(form);clearTimer();challenge=null;epoch++;activeForm=null;}});
    for(const name of ['email',...(betaRequired?['betaCode']:[])])form.querySelector(`[name=${name}]`).addEventListener('input',()=>{invalidateChallenge(form);for(const field of form.querySelectorAll('[aria-invalid]'))field.removeAttribute('aria-invalid');form.querySelector('.form-error').hidden=true;lastError=null;});

    form.querySelector('[name=code]').addEventListener('input',event=>event.target.removeAttribute('aria-invalid'));
    updateSend();if(Date.now()<cooldownUntil)timer=win.setInterval(updateSend,250);return true;
  }
  async function openAccount(){
    if(destroyed)return false;const token=epoch,generation=getGeneration();let session;
    try{session=await auth.getSession();}catch(error){if(!destroyed&&epoch===token&&getGeneration()===generation){onError(error);return openLogin();}return false;}
    if(destroyed||epoch!==token||getGeneration()!==generation)return false;if(!session)return openLogin();
    const markup=`<form id="account-actions-form"><p class="profile-details">${copy('account.signedIn')}</p><p class="form-tip">${copy('account.cloudHint')}</p><p class="form-tip">${copy('account.importHint')}</p><div class="form-actions"><button class="button" type="button" data-account-action="import">${copy('account.importTitle')}</button><button class="button secondary" type="button" data-account-action="signout">${copy('account.signOut')}</button><button class="button secondary" type="button" data-account-action="close">${copy('common.close')}</button></div><p class="form-error" role="alert" hidden></p></form>`;
    if(!modal(t('account.title'),markup))return false;const form=document.querySelector('#account-actions-form');const actionEpoch=begin(form,'account');
    form.querySelector('[data-account-action=close]').addEventListener('click',()=>{closeModal(true);epoch++;activeForm=null;});
    form.querySelector('[data-account-action=import]').addEventListener('click',async()=>{if(busy)return;setBusy(true);try{await onImportLocal();}catch(error){if(!destroyed&&epoch===actionEpoch&&form.isConnected)report(form,error);}finally{if(!destroyed&&epoch===actionEpoch&&form.isConnected)setBusy(false);}});
    form.querySelector('[data-account-action=signout]').addEventListener('click',async()=>{if(busy)return;setBusy(true);const before=getGeneration();try{await auth.signOut();if(!isCurrent(actionEpoch,before))return;await onSignedOut();if(!destroyed&&epoch===actionEpoch&&form.isConnected){closeModal(true);epoch++;activeForm=null;clearTimer();}}catch(error){if(!destroyed&&epoch===actionEpoch&&form.isConnected)report(form,error);}finally{if(!destroyed&&epoch===actionEpoch&&form.isConnected)setBusy(false);}});
    return true;
  }
  return {openLogin,openAccount,refreshLocale,destroy(){if(destroyed)return;destroyed=true;document?.removeEventListener?.('close',dialogClosed,true);epoch++;clearTimer();challenge=null;clearInputs(activeForm);activeForm=null;}};
}
