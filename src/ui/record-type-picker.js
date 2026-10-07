import {recordTypeEntries,MAX_CUSTOM_RECORD_TYPES,CUSTOM_RECORD_ICONS} from '../domain/record-type-catalog.js';
import {enhanceSelect} from './select-control.js';
const copy={
 'zh-CN':{add:'新增',manage:'管理',back:'返回',name:'类型名称',save:'保存类型',remove:'删除所选',fixed:'内置类型不可删除',max:'最多添加3个自定义类型，请先在管理中删除一个',book:'打开的书本',paw:'爪爪',drop:'水滴',weight:'体重',vaccine:'疫苗',deworm:'驱虫',daily:'日常',sort:'拖动排序，也可按上下方向键',error:'保存失败，请重试'},
 en:{add:'Add',manage:'Manage',back:'Back',name:'Type name',save:'Save type',remove:'Delete selected',fixed:'Built-in types cannot be deleted',max:'Up to 3 custom types. Delete one in Manage to add another.',book:'Open book',paw:'Paw',drop:'Water drop',weight:'Weight',vaccine:'Vaccine',deworm:'Deworming',daily:'Daily',sort:'Drag to reorder, or use the up and down arrow keys',error:'Could not save. Please try again.'},
};
export function enhanceRecordTypeSelect(select,{getSnapshot,getRepository,onUpdated=()=>{},icons=null,getLocale=()=> 'zh-CN'}={}){
 const doc=select.ownerDocument,footer=doc.createElement('div');footer.className='type-catalog';
 const control=enhanceSelect(select,{icons,footer});let state,entries=[],screen='actions',selected=new Set(),busy=false,destroyed=false,draftName='',draftIcon='book';
 const t=key=>(copy[getLocale()]??copy['zh-CN'])[key]??key;
 const el=(tag,className='',text='')=>{const node=doc.createElement(tag);node.className=className;node.textContent=text;return node;};
 function button(text,run,className=''){const b=el('button',`type-catalog-button ${className}`,text);b.type='button';b.addEventListener('click',run);b.disabled=busy;return b;}
 function svg(key,node){if(!icons)return;const markup=typeof icons==='function'?icons(key):icons[key];if(markup){const i=el('span','type-catalog-icon');i.setAttribute('aria-hidden','true');i.innerHTML=markup;node.append(i);}}
 function error(message){let p=footer.querySelector('.type-catalog-error');if(!p){p=el('p','type-catalog-error');p.setAttribute('role','status');footer.append(p);}p.textContent=message;}
 async function refresh(){
  state=await getSnapshot();if(destroyed)return;
  const old=select.value;entries=recordTypeEntries(state,{includeHistoricalRecord:select.__historicalRecord??null});
  control.setOptions(entries.map(entry=>({value:entry.id,label:entry.builtin?t(entry.type):entry.name,iconKey:entry.iconKey})));
  const desired=entries.some(x=>x.id===old)?old:old==='other'&&select.__historicalRecord?select.__historicalRecord.customTypeId??'historical:other':old;
  if(entries.some(x=>x.id===desired))control.setValue(desired);render();
  if(old&&select.value!==old)select.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
 }
 async function command(payload,{chooseNew=false}={}){
  if(busy)return;busy=true;footer.querySelector('.type-catalog-error')?.remove();for(const b of footer.querySelectorAll('button,input'))b.disabled=true;
  try{
   const repository=getRepository();const prior=new Set(entries.map(e=>e.id));
   await repository.manageRecordTypes(payload,{baseRevision:repository.getRevision?.(),operationId:globalThis.crypto?.randomUUID?.()??`catalog-${Date.now()}-${Math.random()}`});
   const latest=await repository.snapshot();await onUpdated(latest);await refresh();
   if(chooseNew){const added=entries.find(x=>!prior.has(x.id)&&!x.historical);if(added){control.setValue(added.id);select.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));}screen='actions';control.close(true);}
  }catch(e){error(e?.message||t('error'));}
  finally{busy=false;if(!destroyed)render();}
 }
 function show(next){screen=next;selected.clear();render();control.open();if(next==='add')footer.querySelector('input[name="catalog-name"]')?.focus();}
 function render(){
  if(destroyed)return;const previousError=footer.querySelector('.type-catalog-error')?.textContent;footer.replaceChildren();
  if(screen==='actions'){
   const actions=el('div','type-catalog-actions'),wrapper=el('span','type-catalog-add-wrapper'),add=button(t('add'),()=>show('add'),'type-catalog-add');
   const full=entries.filter(x=>!x.builtin&&!x.historical).length>=MAX_CUSTOM_RECORD_TYPES;add.disabled=busy||full;wrapper.append(add);
   if(full){wrapper.tabIndex=0;wrapper.title=t('max');wrapper.setAttribute('aria-label',t('max'));wrapper.addEventListener('click',()=>error(t('max')));const hint=el('small','type-catalog-hint',t('max'));wrapper.append(hint);}
   actions.append(wrapper,button(t('manage'),()=>show('manage'),'type-catalog-manage'));footer.append(actions);
  }else if(screen==='add'){
   const panel=el('div','type-catalog-panel');panel.append(button(t('back'),()=>show('actions'),'type-catalog-back'));
   const label=el('label','type-catalog-name',t('name')),input=doc.createElement('input');input.name='catalog-name';input.type='text';input.maxLength=20;input.autocomplete='off';input.value=draftName;input.addEventListener('input',()=>{draftName=input.value;});label.append(input);panel.append(label);
   const options=el('div','type-catalog-icons');options.setAttribute('role','radiogroup');options.setAttribute('aria-label',t('name'));for(const key of CUSTOM_RECORD_ICONS){const label=el('label','type-catalog-icon-option'),radio=doc.createElement('input');radio.type='radio';radio.name=`catalog-icon-${control.trigger.getAttribute('aria-controls')}`;radio.value=key;radio.checked=key===draftIcon;radio.addEventListener('change',()=>{if(radio.checked)draftIcon=key;});label.append(radio);svg(key,label);label.append(el('span','',t(key)));options.append(label);}panel.append(options);
   panel.append(button(t('save'),()=>{const name=input.value.trim();if(!name){error(t('name'));input.focus();return;}command({action:'add',name,iconKey:panel.querySelector('input[type="radio"]:checked')?.value??'book'},{chooseNew:true});},'type-catalog-save'));footer.append(panel);
  }else{
   const panel=el('div','type-catalog-panel');panel.append(button(t('back'),()=>show('actions'),'type-catalog-back'));const list=el('div','type-catalog-list');
   for(const entry of entries.filter(x=>!x.historical)){
    const row=el('div','type-catalog-row');row.dataset.typeId=entry.id;
    const check=doc.createElement('input');check.type='checkbox';check.disabled=busy||entry.builtin;check.checked=selected.has(entry.id);check.setAttribute('aria-label',`${t('remove')} ${entry.builtin?t(entry.type):entry.name}`);if(entry.builtin)check.title=t('fixed');check.addEventListener('change',()=>{check.checked?selected.add(entry.id):selected.delete(entry.id);const remove=panel.querySelector('.type-catalog-remove');if(remove)remove.disabled=busy||selected.size===0;});row.append(check);svg(entry.iconKey,row);row.append(el('span','type-catalog-label',entry.builtin?t(entry.type):entry.name));
    const handle=button('',()=>{},'type-catalog-handle');handle.setAttribute('aria-label',`${entry.name}: ${t('sort')}`);handle.title=t('sort');handle.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="8" cy="5" r="1.5"/><circle cx="16" cy="5" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/></svg>';handle.style.touchAction='none';row.append(handle);
    handle.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const rows=[...list.children],index=rows.indexOf(row),target=index+(event.key==='ArrowUp'?-1:1);if(target<0||target>=rows.length)return;event.key==='ArrowUp'?list.insertBefore(row,rows[target]):list.insertBefore(rows[target],row);command({action:'reorder',ids:[...list.children].map(x=>x.dataset.typeId)}).then(()=>footer.querySelector(`[data-type-id="${entry.id}"] .type-catalog-handle`)?.focus());});
    handle.addEventListener('pointerdown',event=>{if(event.button!==0||busy)return;event.preventDefault();handle.setPointerCapture?.(event.pointerId);row.classList.add('sorting');const before=[...list.children].map(x=>x.dataset.typeId);const move=e=>{const rows=[...list.children].filter(x=>x!==row);for(const other of rows){const rect=other.getBoundingClientRect();if(e.clientY<rect.top+rect.height/2){list.insertBefore(row,other);return;}}list.append(row);};const finish=()=>{doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',finish);doc.removeEventListener('pointercancel',cancel);row.classList.remove('sorting');const ids=[...list.children].map(x=>x.dataset.typeId);if(ids.join('|')!==before.join('|'))command({action:'reorder',ids});};const cancel=()=>{for(const id of before){const original=[...list.children].find(x=>x.dataset.typeId===id);if(original)list.append(original);}finish();};doc.addEventListener('pointermove',move);doc.addEventListener('pointerup',finish);doc.addEventListener('pointercancel',cancel);});
    list.append(row);
   }
   panel.append(list,el('small','type-catalog-hint',t('fixed')));const remove=button(t('remove'),async()=>{const ids=[...selected];await command({action:'delete',ids});selected.clear();render();},'type-catalog-remove');remove.disabled=busy||selected.size===0;panel.append(remove);footer.append(panel);
  }
  if(previousError)error(previousError);
 }
 const baseDestroy=control.destroy;control.destroy=()=>{destroyed=true;baseDestroy();};control.refreshCatalog=refresh;control.ready=refresh();return control;
}
