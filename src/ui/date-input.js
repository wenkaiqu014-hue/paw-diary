const enhanced=new WeakMap();
export const dateMaskParts=locale=>locale==='en'?['YYYY','MM','DD']:['年','月','日'];
export function enhanceDateInput(input,{getLocale=()=> 'zh-CN'}={}){
 if(input?.type!=='date')throw new TypeError('Expected a native date input');
 if(enhanced.has(input))return enhanced.get(input);
 const doc=input.ownerDocument,shell=doc.createElement('div'),mask=doc.createElement('span');shell.className='date-input-shell';mask.className='date-input-mask';mask.setAttribute('aria-hidden','true');
 const segments=[];for(let index=0;index<3;index++){if(index){const slash=doc.createElement('span');slash.className='date-input-separator';slash.textContent='/';mask.append(slash);}const segment=doc.createElement('span');segment.className='date-input-segment';segments.push(segment);mask.append(segment);}
 input.before(shell);shell.append(input,mask);input.classList.add('date-input-native');
 let locale=null,editing=false,destroyed=false;
 const toggle=(name,on)=>{if(input.classList.contains(name)!==on)input.classList.toggle(name,on);};
 function sync(){if(destroyed)return;const empty=input.value==='';toggle('date-input-empty',empty);toggle('date-input-editing',editing&&empty);const hidden=!empty||editing;if(mask.hidden!==hidden)mask.hidden=hidden;}
 function setLocale(next){if(destroyed)return;const normalized=next==='en'?'en':'zh-CN';if(locale===normalized)return;locale=normalized;dateMaskParts(locale).forEach((text,index)=>{if(segments[index].textContent!==text)segments[index].textContent=text;});}
 const keydown=event=>{if(input.disabled||input.readOnly||event.ctrlKey||event.altKey||event.metaKey)return;if(event.key.length===1||['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Backspace','Delete','Home','End'].includes(event.key)){editing=true;sync();}};
 const changed=()=>{if(input.value)editing=false;sync();},blur=()=>{editing=false;sync();};
 input.addEventListener('keydown',keydown);input.addEventListener('input',changed);input.addEventListener('change',changed);input.addEventListener('blur',blur);
 const api={sync,setLocale,destroy(){if(destroyed)return;destroyed=true;input.removeEventListener('keydown',keydown);input.removeEventListener('input',changed);input.removeEventListener('change',changed);input.removeEventListener('blur',blur);shell.before(input);shell.remove();input.classList.remove('date-input-native','date-input-empty','date-input-editing');enhanced.delete(input);}};
 enhanced.set(input,api);setLocale(getLocale());sync();return api;
}
