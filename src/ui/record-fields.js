import {defaultPlanHealth} from '../domain/health-plans.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys=['purpose','type','petId','date','dueDate','value','title','note','includeInHealth'];
export function createRecordFieldState({values={},getEntries=()=>[]}={}){
 const state={purpose:'record',type:'',petId:'',date:'',dueDate:'',value:'',title:'',note:'',...values};
 let healthTouched=typeof values.includeInHealth==='boolean';
 const entry=()=>getEntries().find(e=>e.id===state.type);
 if(!healthTouched)state.includeInHealth=defaultPlanHealth(entry()?.type);
 function read(){const plan=state.purpose==='plan';return {...state,type:entry()?state.type:'',date:plan?null:state.date,dueDate:plan?state.dueDate:null,value:!plan&&entry()?.type==='weight'?state.value:null,includeInHealth:plan?state.includeInHealth:undefined};}
 function setType(type){state.type=type;if(!healthTouched)state.includeInHealth=defaultPlanHealth(entry()?.type);}
 function setField(key,value){if(!keys.includes(key))return;if(key==='type')return setType(value);if(key==='includeInHealth'){healthTouched=true;state[key]=!!value;}else state[key]=value;}
 return {read,values:()=>({...state}),setType,setPurpose(purpose){state.purpose=purpose==='plan'?'plan':'record';},setField,setValues(values){for(const key of keys)if(Object.hasOwn(values,key))setField(key,values[key]);}};
}

// Both manual entry and AI review use these exact fields and transition rules.
export function mountRecordFields({root,idPrefix='record',values={},getEntries=()=>[],getLocale=()=> 'zh-CN',today='',enhanceType,enhanceAll,onChange,lockPurpose=false,lockType=false,showPet=false,pets=[]}={}){
 const copy=(zh,en)=>getLocale()==='en'?en:zh;
 const labels={purpose:['用途','Purpose'],type:['记录类型','Record type'],date:['发生日期','Event date'],dueDate:['计划日期','Planned date'],value:['体重（kg）','Weight (kg)'],title:['记录名称','Title'],health:['加入健康待办','Include in health to-dos'],note:['备注 · 可选','Note · optional'],pet:['宠物','Pet']};
 const label=key=>copy(...labels[key]);
 const state=createRecordFieldState({values,getEntries}),initial=state.values(),doc=root.ownerDocument;
 const field=(key,input,extra='')=>`<label class="field ${extra}"><span data-record-copy="${key}">${escape(label(key))}</span>${input}</label>`;
 root.innerHTML=`${showPet?field('pet',`<select name="petId" id="${idPrefix}-pet"><option value="">${copy('请选择宠物','Choose a pet')}</option>${pets.map(p=>`<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('')}</select>`,'full'):''}${field('purpose',`<select id="${idPrefix}-purpose" name="purpose"><option value="record">${copy('记录已发生','Record an event')}</option><option value="plan">${copy('安排计划','Schedule a plan')}</option></select>`)}${field('type',`<select name="type" id="${idPrefix}-type" required data-allow-empty="true"></select>`)}${field('date',`<input name="date" type="date" value="${escape(initial.date)}" ${today?`max="${escape(today)}"`:''}>`,'event-date-field')}${field('dueDate',`<input name="dueDate" type="date" value="${escape(initial.dueDate)}">`,'plan-date-field')}<div id="${idPrefix}-value-field" class="field full">${field('value',`<input name="value" type="number" inputmode="decimal" min="0.01" max="200" step="0.01" value="${escape(initial.value)}" placeholder="4.6">`)}</div>${field('title',`<input name="title" maxlength="60" value="${escape(initial.title)}">`,'full')}<label class="health-plan-choice full"><input type="checkbox" name="includeInHealth"><span data-record-copy="health">${escape(label('health'))}</span></label>${field('note',`<textarea name="note" maxlength="500">${escape(initial.note)}</textarea>`,'full')}`;
 const byName=name=>root.querySelector(`[name="${name}"]`),purpose=byName('purpose'),type=byName('type'),health=byName('includeInHealth');
 let destroyed=false,typeController;
 function renderOptions(){const current=state.values().type;type.innerHTML=`<option value="">${copy('请选择类型','Choose a type')}</option>`+getEntries().map(e=>`<option value="${escape(e.id)}" data-icon="${escape(e.iconKey)}">${escape(e.builtin?copy(e.name,{weight:'Weight',vaccine:'Vaccination',deworm:'Deworming',daily:'Daily'}[e.type]??e.name):e.name)}</option>`).join('');type.value=getEntries().some(e=>e.id===current)?current:'';}
 renderOptions();purpose.value=initial.purpose;purpose.disabled=lockPurpose;type.disabled=lockType;health.checked=initial.includeInHealth;if(showPet)byName('petId').value=initial.petId??'';
 function refresh(){const plan=purpose.value==='plan',entry=getEntries().find(e=>e.id===type.value),weight=!plan&&entry?.type==='weight';byName('title').required=plan||entry?.type!=='weight';root.querySelector('.event-date-field').hidden=plan;byName('date').required=!plan;byName('date').disabled=plan;root.querySelector('.plan-date-field').hidden=!plan;byName('dueDate').required=plan;byName('dueDate').disabled=!plan;root.querySelector('.health-plan-choice').hidden=!plan;health.disabled=!plan;root.querySelector(`#${idPrefix}-value-field`).hidden=!weight;byName('value').required=weight;byName('value').disabled=!weight;if(showPet)byName('petId').required=true;}
 function notify(){onChange?.(api.read());}
 const listeners=[];
 function listen(el,event,fn){el.addEventListener(event,fn);listeners.push([el,event,fn]);}
 listen(purpose,'change',()=>{state.setPurpose(purpose.value);refresh();notify();});
 listen(type,'change',()=>{state.setType(type.value);health.checked=state.values().includeInHealth;refresh();notify();});
 listen(health,'change',()=>{state.setField('includeInHealth',health.checked);notify();});
 for(const name of ['date','dueDate','value','title','note',...(showPet?['petId']:[])])listen(byName(name),name==='petId'?'change':'input',()=>{state.setField(name,byName(name).value);notify();});
 const api={root,read(){for(const name of ['purpose','type','date','dueDate','value','title','note',...(showPet?['petId']:[])])state.setField(name,byName(name).value);return state.read();},setValues(values){state.setValues(values);const next=state.values();for(const name of ['purpose','date','dueDate','value','title','note',...(showPet?['petId']:[])])byName(name).value=next[name]??'';renderOptions();health.checked=next.includeInHealth;refresh();enhanceAll?.();},refreshLocale(){for(const el of root.querySelectorAll('[data-record-copy]'))el.textContent=label(el.dataset.recordCopy);purpose.options[0].textContent=copy('记录已发生','Record an event');purpose.options[1].textContent=copy('安排计划','Schedule a plan');if(showPet)byName('petId').options[0].textContent=copy('请选择宠物','Choose a pet');state.setType(type.value);renderOptions();refresh();},destroy(){if(destroyed)return;destroyed=true;for(const [el,event,fn] of listeners)el.removeEventListener(event,fn);typeController?.destroy?.();}};
 typeController=enhanceType?.(type);enhanceAll?.();refresh();return api;
}
