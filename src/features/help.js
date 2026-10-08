import {HELP_TOPICS} from '../data/help-topics.js';

// This surface owns its DOM and listeners, but never owns business data or drafts.
export function createReadonlyDialog({document,id,className,onDismiss}) {
 const dialog=document.createElement('dialog');dialog.id=id;dialog.className=`readonly-dialog ${className}`;
 dialog.setAttribute('data-readonly-help','');document.body.append(dialog);
 let trigger=null,opened=false,destroyed=false,expectedCloseEvents=0;
 const focusBack=()=>{
  const target=trigger?.isConnected?trigger:document.querySelector('main');
  if(!target)return;
  const temporary=!target.hasAttribute('tabindex') && target.tagName==='MAIN';
  if(temporary)target.setAttribute('tabindex','-1');
  target.focus({preventScroll:true});if(temporary)target.removeAttribute('tabindex');
 };
 const close=()=>{if(!opened)return;opened=false;if(dialog.open){expectedCloseEvents++;dialog.close();}focusBack();};
 const dismiss=()=>{if(!opened)return;close();onDismiss?.();};
 const cancel=event=>{event.preventDefault();dismiss();};
 const keydown=event=>{
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(node=>!node.hidden && node.getClientRects().length>0);
  if(!controls.length){event.preventDefault();dialog.querySelector('h2')?.focus();return;}
  const first=controls[0],last=controls.at(-1),active=document.activeElement;
  if(event.shiftKey&&(active===first||!controls.includes(active))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(active===last||!controls.includes(active))){event.preventDefault();first.focus();}
 };
 // External dialog.close() is a dismissal too; programmatic controller close has set opened=false.
 const nativeClose=()=>{if(expectedCloseEvents){expectedCloseEvents--;return;}if(opened){opened=false;focusBack();onDismiss?.();}};
 dialog.addEventListener('cancel',cancel);dialog.addEventListener('keydown',keydown);dialog.addEventListener('close',nativeClose);
 return {dialog,open(){if(destroyed||opened)return false;trigger=document.activeElement;opened=true;dialog.showModal();dialog.querySelector('h2')?.focus({preventScroll:true});return true;},close,dismiss,isOpen:()=>opened,destroy(){if(destroyed)return;destroyed=true;opened=false;dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('keydown',keydown);dialog.removeEventListener('close',nativeClose);dialog.remove();}};
}
function element(document,tag,className,text) {const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;}
export function mountHelp({document,t,getLocale,onTour,onInstall,onWhatsNew}) {
 const shell=createReadonlyDialog({document,id:'help-dialog',className:'help-dialog'}),dialog=shell.dialog;
 let topicId='start',statusKey=null,destroyed=false;
 const header=element(document,'div','help-header'),title=element(document,'h2','',t('help.title'));
 title.id='help-title';title.tabIndex=-1;dialog.setAttribute('aria-labelledby',title.id);
 const closeButton=element(document,'button','button secondary',t('help.close'));closeButton.type='button';closeButton.dataset.helpClose='';
 header.append(title,closeButton);
 const layout=element(document,'div','help-layout'),nav=element(document,'nav','help-topics'),content=element(document,'article','help-content');
 content.id='help-content';const actions=element(document,'div','help-actions'),status=element(document,'p','help-status');status.setAttribute('role','status');status.hidden=true;
 for(const action of ['tour','whats-new','install']){const button=element(document,'button','button secondary');button.type='button';button.dataset.helpAction=action;actions.append(button);}
 layout.append(nav,content);const container=element(document,'div','help-shell');container.append(header,layout,status,actions);dialog.append(container);
 function render(){
  const focusedTopic=nav.contains(document.activeElement)?document.activeElement.dataset.helpTopic:null;
  dialog.lang=getLocale();title.textContent=t('help.title');closeButton.textContent=t('help.close');nav.setAttribute('aria-label',t('help.topics'));
  nav.replaceChildren(...HELP_TOPICS.map(topic=>{const button=element(document,'button','help-topic',t(topic.titleKey));button.type='button';button.dataset.helpTopic=topic.id;button.setAttribute('aria-controls',content.id);if(topic.id===topicId)button.setAttribute('aria-current','page');return button;}));
  const topic=HELP_TOPICS.find(value=>value.id===topicId)??HELP_TOPICS[0];const heading=element(document,'h3','',t(topic.titleKey));
  const steps=element(document,'ol','help-steps');topic.bodyKeys.forEach(key=>steps.append(element(document,'li','',t(key))));content.replaceChildren(heading,steps);
  for(const button of actions.children)button.textContent=t(button.dataset.helpAction==='whats-new'?'help.whatsNew':`help.${button.dataset.helpAction}`);
  status.hidden=!statusKey;status.textContent=statusKey?t(statusKey):'';
  if(focusedTopic)nav.querySelector(`[data-help-topic="${focusedTopic}"]`)?.focus({preventScroll:true});
 }
 function click(event){
  const topic=event.target.closest('[data-help-topic]');if(topic){topicId=topic.dataset.helpTopic;statusKey=null;render();nav.querySelector(`[data-help-topic="${topicId}"]`)?.focus();content.scrollTop=0;return;}
  if(event.target.closest('[data-help-close]')){shell.close();return;}
  const action=event.target.closest('[data-help-action]')?.dataset.helpAction;
  if(action==='tour'){if(onTour?.()===false){statusKey='help.tourBlocked';render();actions.querySelector('[data-help-action=tour]')?.focus();}else shell.close();}
  if(action==='install'){shell.close();onInstall?.();}
  if(action==='whats-new'){shell.close();onWhatsNew?.();}
 }
 dialog.addEventListener('click',click);render();
 return {open(requested='start'){if(destroyed)return;topicId=HELP_TOPICS.some(topic=>topic.id===requested)?requested:'start';statusKey=null;render();shell.open();},close:shell.close,refreshLocale(){if(!destroyed)render();},destroy(){if(destroyed)return;destroyed=true;dialog.removeEventListener('click',click);shell.destroy();}};
}
