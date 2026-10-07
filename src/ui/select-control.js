let sequence=0;
const mounted=new WeakMap();
export function nextEnabledOption(options,index,direction){
  for(let count=1;count<=options.length;count++){const next=(index+direction*count+options.length*2)%options.length;if(!options[next].disabled)return next;}return -1;
}
export function enhanceSelect(select,{icons=null,footer=null,onChange=null}={}){
  if(mounted.has(select))return mounted.get(select);
  const doc=select.ownerDocument,win=doc.defaultView;
  const root=doc.createElement('div');root.className='select-control';
  const trigger=doc.createElement('button');trigger.type='button';trigger.className='select-trigger';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  const panel=doc.createElement('div');panel.className='select-panel';panel.hidden=true;
  const list=doc.createElement('div');list.className='select-options';list.id=`paw-select-${++sequence}`;list.setAttribute('role','listbox');trigger.setAttribute('aria-controls',list.id);panel.append(list);
  if(footer){const foot=doc.createElement('div');foot.className='select-footer';foot.append(footer);panel.append(foot);}
  const label=select.labels?.[0]?.childNodes;const text=select.getAttribute('aria-label')??(label?[...label].filter(x=>x.nodeType===3).map(x=>x.textContent).join('').trim():'');if(text)trigger.setAttribute('aria-label',text);
  select.before(root);root.append(select,trigger,panel);const wasHidden=select.hidden,oldTabIndex=select.tabIndex;select.hidden=true;select.tabIndex=-1;select.dataset.enhanced='true';
  let active=-1,rows=[],destroyed=false;
  const options=()=>[...select.options];
  function iconFor(option,target){const key=option.dataset.icon;if(!key||!icons)return;const markup=typeof icons==='function'?icons(key):icons[key];if(markup){const i=doc.createElement('span');i.className='select-icon';i.setAttribute('aria-hidden','true');i.innerHTML=markup;target.append(i);}}
  function activeRow(index){active=index;for(let i=0;i<rows.length;i++)rows[i].classList.toggle('highlighted',i===index);if(index>=0){trigger.setAttribute('aria-activedescendant',rows[index].id);rows[index].scrollIntoView?.({block:'nearest'});}else trigger.removeAttribute('aria-activedescendant');}
  function close(returnFocus=false){panel.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant');root.classList.remove('open');if(returnFocus)trigger.focus();}
  function open(){if(select.disabled)return;panel.hidden=false;trigger.setAttribute('aria-expanded','true');root.classList.add('open');activeRow(select.selectedIndex>=0&&!select.options[select.selectedIndex]?.disabled?select.selectedIndex:nextEnabledOption(options(),-1,1));}
  function render(){
    if(destroyed)return;if(select.disabled)close();trigger.replaceChildren();const selected=select.options[select.selectedIndex];if(selected){iconFor(selected,trigger);const caption=doc.createElement('span');caption.className='select-value';caption.textContent=selected.textContent;trigger.append(caption);}const arrow=doc.createElement('span');arrow.className='select-arrow';arrow.setAttribute('aria-hidden','true');arrow.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9 6 6 6-6"/></svg>';trigger.append(arrow);trigger.disabled=select.disabled;
    list.replaceChildren();rows=options().map((option,index)=>{const row=doc.createElement('button');row.type='button';row.tabIndex=-1;row.className='select-option';row.id=`${list.id}-${index}`;row.setAttribute('role','option');row.setAttribute('aria-selected',String(index===select.selectedIndex));row.disabled=option.disabled;iconFor(option,row);const caption=doc.createElement('span');caption.textContent=option.textContent;row.append(caption);row.addEventListener('click',()=>choose(index));row.addEventListener('pointermove',()=>{if(!option.disabled)activeRow(index);});list.append(row);return row;});
  }
  function choose(index){if(select.disabled||index<0||select.options[index]?.disabled)return;select.selectedIndex=index;select.dispatchEvent(new win.Event('input',{bubbles:true}));select.dispatchEvent(new win.Event('change',{bubbles:true}));close(true);}
  function changed(event){render();onChange?.(select.value,event);}
  function keydown(event){
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(panel.hidden)open();const opts=options();if(event.key==='Home')activeRow(nextEnabledOption(opts,-1,1));else if(event.key==='End')activeRow(nextEnabledOption(opts,0,-1));else activeRow(nextEnabledOption(opts,active,event.key==='ArrowDown'?1:-1));}
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();panel.hidden?open():choose(active);}
    else if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopPropagation();close(true);}
    else if(event.key==='Tab'&&!footer)close();
    else if(event.key.length===1&&!event.ctrlKey&&!event.altKey&&!event.metaKey){const prefix=event.key.toLocaleLowerCase(),opts=options(),index=opts.findIndex(o=>!o.disabled&&o.textContent.trim().toLocaleLowerCase().startsWith(prefix));if(index>=0){event.preventDefault();if(panel.hidden)open();activeRow(index);}}
  }
  const panelKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}},click=()=>panel.hidden?open():close(),outside=event=>{if(!root.contains(event.target))close();},invalid=event=>{event.preventDefault();trigger.focus();trigger.setAttribute('aria-invalid','true');},reset=()=>win.setTimeout(render,0);
  panel.addEventListener('keydown',panelKey);trigger.addEventListener('click',click);trigger.addEventListener('keydown',keydown);select.addEventListener('change',changed);select.addEventListener('invalid',invalid);doc.addEventListener('pointerdown',outside);doc.addEventListener('focusin',outside);select.form?.addEventListener('reset',reset);
  const observer=win.MutationObserver?new win.MutationObserver(render):null;observer?.observe(select,{attributes:true,childList:true,subtree:true,characterData:true});render();
  const api={root,trigger,panel,open,close,setValue(value){select.value=value;render();},setOptions(entries){const value=select.value;select.replaceChildren(...entries.map(entry=>{const option=doc.createElement('option');option.value=entry.value;option.textContent=entry.label;option.disabled=!!entry.disabled;if(entry.iconKey)option.dataset.icon=entry.iconKey;return option;}));select.value=value;if(select.selectedIndex<0)select.selectedIndex=0;render();},destroy(){if(destroyed)return;destroyed=true;observer?.disconnect();doc.removeEventListener('pointerdown',outside);doc.removeEventListener('focusin',outside);select.removeEventListener('change',changed);select.removeEventListener('invalid',invalid);select.form?.removeEventListener('reset',reset);root.before(select);root.remove();select.hidden=wasHidden;select.tabIndex=oldTabIndex;delete select.dataset.enhanced;mounted.delete(select);}};
  mounted.set(select,api);return api;
}
export function mountSelect({root,name,value,options=[],onChange,footer=null,icons=null}){
  const select=root.ownerDocument.createElement('select');select.name=name??'';for(const entry of options){const o=root.ownerDocument.createElement('option');o.value=entry.value;o.textContent=entry.label;o.disabled=!!entry.disabled;if(entry.iconKey)o.dataset.icon=entry.iconKey;select.append(o);}if(value!==undefined)select.value=value;root.append(select);return enhanceSelect(select,{onChange,footer,icons});
}
