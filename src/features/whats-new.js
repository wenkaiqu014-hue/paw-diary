import {RELEASE_NOTES} from '../data/release-notes.js';
import {createReadonlyDialog} from './help.js';
export function mountWhatsNew({document,t,getLocale,onAcknowledge,onDismiss}) {
 let release=null,acknowledged=false,destroyed=false;
 const shell=createReadonlyDialog({document,id:'whats-new-dialog',className:'whats-new-dialog',onDismiss:()=>{if(!acknowledged)onDismiss?.(release);}}),dialog=shell.dialog;
 const heading=document.createElement('h2');heading.id='whats-new-title';heading.tabIndex=-1;dialog.setAttribute('aria-labelledby',heading.id);
 const content=document.createElement('div');content.className='whats-new-content';
 const actions=document.createElement('div');actions.className='whats-new-actions';
 const close=document.createElement('button');close.type='button';close.className='button secondary';close.dataset.whatsNewClose='';
 const confirm=document.createElement('button');confirm.type='button';confirm.className='button';confirm.dataset.whatsNewConfirm='';actions.append(close,confirm);dialog.append(heading,content,actions);
 function render(){
  dialog.lang=getLocale();heading.textContent=t('whatsNew.title',{version:release?.version??''});close.textContent=t('whatsNew.close');confirm.textContent=t('whatsNew.confirm');
  const note=RELEASE_NOTES.find(item=>item.version===release?.version);content.replaceChildren();
  const intro=document.createElement('p');intro.textContent=t(note?.titleKey??'whatsNew.fallback');content.append(intro);
  if(note){const list=document.createElement('ul');for(const key of note.bulletKeys){const li=document.createElement('li');li.textContent=t(key);list.append(li);}content.append(list);}
 }
 const click=event=>{
  if(!shell.isOpen())return;
  if(event.target.closest('[data-whats-new-confirm]')){if(acknowledged)return;acknowledged=true;const accepted=release;shell.close();onAcknowledge?.(accepted);}
  else if(event.target.closest('[data-whats-new-close]'))shell.dismiss();
 };
 dialog.addEventListener('click',click);
 return {open(value){if(destroyed||shell.isOpen())return;release=Object.freeze({...value});acknowledged=false;render();shell.open();},close:shell.dismiss,refreshLocale(){if(!destroyed&&release)render();},destroy(){if(destroyed)return;destroyed=true;dialog.removeEventListener('click',click);shell.destroy();}};
}
