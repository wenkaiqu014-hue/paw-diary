import {createDemoRepository} from './src/data/demo-repository.js?v=0.2.0';
import {createAppSession} from './src/app-session.js?v=0.2.0';
import {validateBackup,previewImport,mergeBackup,exportRecordsCsv} from './src/domain/backup.js?v=0.2.0';
import {exportRemindersIcs} from './src/domain/calendar.js?v=0.2.0';
import {visibleHealth} from './src/domain/lifecycle.js?v=0.2.0';
import {transitionManagement,selectedCalendarReminders} from './src/features/health-management.js?v=0.2.0';
const icons = {
  paw:'<ellipse cx="12" cy="16" rx="5.5" ry="4"/><ellipse cx="4.5" cy="9" rx="2" ry="2.8" transform="rotate(-20 4.5 9)"/><ellipse cx="9.5" cy="5.5" rx="2" ry="2.8"/><ellipse cx="15" cy="5.5" rx="2" ry="2.8"/><ellipse cx="20" cy="9" rx="2" ry="2.8" transform="rotate(20 20 9)"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  heart:'<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 6l-1-1.2a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/><path d="M5 12h4l2-4 2 8 2-4h4"/>',
  pin:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  community:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m1 5a5 5 0 0 1 3 4v2"/>',
  leaf:'<path d="M20 3C7 2 2 7 4 14s10 7 13 1c2-4 2-8 3-12Z"/><path d="M4 21 15 9"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>', down:'<path d="m6 9 6 6 6-6"/>', plus:'<path d="M12 5v14M5 12h14"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
  weight:'<path d="M5 6h14l3 15H2Z"/><path d="M9 6V4a3 3 0 0 1 6 0v2M12 10v5m-3-3h6"/>',
  vaccine:'<path d="m14 3 7 7M16 1l7 7M4 17l3 3m-5 2 3-3m2-3 9-9 4 4-9 9H7v-4Zm5-6 3 3"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18m-13 4h2m4 0h2"/>',
  book:'<path d="M12 5C8 2 4 3 2 4v16c3-2 7-1 10 1 3-2 7-3 10-1V4c-2-1-6-2-10 1Zm0 0v16"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  like:'<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 6l-1-1.2a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',
  comment:'<path d="M21 11.5A9 9 0 0 1 7 19l-5 2 2-5A9 9 0 1 1 21 11.5Z"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  camera:'<path d="M3 6h4l2-3h6l2 3h4v15H3Z"/><circle cx="12" cy="13" r="4"/>',
  check:'<path d="m5 12 4 4L19 6"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  ,drag:'<path d="M8 5h1M15 5h1M8 12h1M15 12h1M8 19h1M15 19h1"/>',up:'<path d="m6 15 6-6 6 6"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.paw}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = () => localDate(new Date());
const dayOffset = n => {const d=new Date(); d.setDate(d.getDate()+n); return localDate(d);};
const dayDiff = (a,b=today()) => Math.round((new Date(a+'T12:00:00')-new Date(b+'T12:00:00'))/86400000);
const shortDate = date => date ? `${Number(date.slice(5,7))}月${Number(date.slice(8,10))}日` : '未设置';
const types={weight:{label:'体重',icon:'weight'},vaccine:{label:'疫苗',icon:'vaccine'},deworm:{label:'驱虫',icon:'shield'},daily:{label:'日常',icon:'camera'}};
const cityOptions=['深圳','北京','上海','广州','杭州','成都'];

let repository, session, state=null, loadError=null;
let page='home',healthFilter='all',healthFrom='',healthTo='',reminderFilter='pending',nearbyFilter='all',communityFilter='all',postSearch='';
let modalOrigin=null,dirty=false,saving=false,toastTimer;
let management={petManage:false,reminderManage:false,selectedPetIds:[],selectedReminderIds:[]};
let draggedPetId=null;
const $=selector=>document.querySelector(selector);
const dialog=$('#dialog');

// 页面只读取可见资料；持久化、JSON备份和回收站始终读取完整V3。
function syncState(){
  const s=session.snapshot(); if(!s){state=null;return;}
  const visible=visibleHealth(s),previousPetId=state?.activePet;
  state={...s,...visible,activePet:visible.activePetId,city:s.profile.city,
    pets:visible.pets.map(p=>({...p,arrival:p.arrivalDate})),
    records:visible.records.map(r=>({...r,date:r.occurredDate,createdAt:Date.parse(r.createdAt)}))};
  if(previousPetId!==state.activePet)management=transitionManagement(management,{type:'PET_CHANGED'});
  management=transitionManagement(management,{type:'ENTITIES_CHANGED',petIds:state.pets.map(p=>p.id),reminderIds:petReminders(reminderFilter).map(r=>r.id)});
}
function pet(){return state?.pets.find(p=>p.id===state.activePet)||state?.pets[0];}
function petRecords(){return (state?.records||[]).filter(r=>r.petId===pet()?.id).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);}
function filteredRecords(){return petRecords().filter(r=>(healthFilter==='all'||r.type===healthFilter)&&(!healthFrom||r.date>=healthFrom)&&(!healthTo||r.date<=healthTo));}
function weights(){return petRecords().filter(r=>r.type==='weight').sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt);}
function latestWeight(){return weights().at(-1)?.value;}
function recordTitle(r){return r.type==='weight'?`体重记录 · ${r.value} kg`:(r.title||types[r.type]?.label||'成长记录');}
function petReminders(status='pending'){return (state?.reminders||[]).filter(r=>r.petId===pet()?.id&&(status==='all'||r.status===status)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));}
function pending(){return petReminders();}
function ageText(p){if(!p.birthday)return p.estimatedAgeMonths===null?'年龄待补充':`约${Math.floor(p.estimatedAgeMonths/12)}岁${p.estimatedAgeMonths%12}个月`;const days=Math.max(0,-dayDiff(p.birthday));return `${Math.floor(days/365)}岁${Math.floor(days%365/30)}个月`;}
function empty(title,text,action=''){return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;}
function button(label,action,kind='',ico='plus'){return `<button type="button" class="button ${kind}" data-action="${action}">${icon(ico)}${esc(label)}</button>`;}
function heading(title,subtitle,action=''){return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${subtitle}</p></div>${action}</div>`;}
function img(src,alt,cls=''){return `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" width="1000" height="750">`;}
function token(el){return el?.id?{id:el.id}:el?.dataset?.action?{action:el.dataset.action,id:el.dataset.id,value:el.dataset.value}:el?.name?{name:el.name,value:el.value}:el?.dataset?.petDrag?{petDrag:el.dataset.petDrag}:null;}
function restoreFocus(t){
  const selector=t?.name?`[name="${CSS.escape(t.name)}"][value="${CSS.escape(t.value)}"]`:t?.petDrag?`[data-pet-drag="${CSS.escape(t.petDrag)}"]`:t?.id&& !t.action?`#${CSS.escape(t.id)}`:t?.action?`[data-action="${CSS.escape(t.action)}"]${t.id?`[data-id="${CSS.escape(t.id)}"]`:''}${t.value?`[data-value="${CSS.escape(t.value)}"]`:''}`:null;
  const target=selector?[...document.querySelectorAll(selector)].find(e=>e.getClientRects().length&&!e.disabled):null;
  (target||$('#main')).focus({preventScroll:true});
}
function render({focus=false}={}){
  const previous=token(document.activeElement);
  if(loadError){$('#main').innerHTML=heading('暂时无法读取档案','原始数据已保留，没有替换为示例。')+`<section class="panel recovery-panel"><p>${esc(loadError.message)}</p><div class="recovery-actions">${button('导出原始数据','raw-export','secondary','download')}${button('恢复备份','import','secondary','book')}${button('重试读取','retry')}</div><p class="demo-note">可先导出原始文件，再选择有效备份恢复；恢复前会预览并保留原始字符串。</p></section>`;}
  else if(!state){$('#main').innerHTML=heading('正在读取档案…','请稍等，保留已有数据。');}
  else if(!pet()&&['home','health'].includes(page)){$('#main').innerHTML=heading('认识你的毛孩子','先建一份本地档案，开始记录。',button('添加一只宠物','new-pet'))+`<section class="panel empty-health">${empty('还没有宠物档案','可以添加宠物，或从回收站恢复原有档案。')}<div class="data-actions">${button('回收站','trash','secondary','book')}${button('导出备份','export','secondary','download')}${button('恢复备份','import','secondary','book')}</div></section>`;}
  else $('#main').innerHTML=({home:homeHTML,health:healthHTML,nearby:nearbyHTML,community:communityHTML}[page])();
  $('#page-label').textContent=({home:'成长首页',health:'健康档案',nearby:'附近宠友',community:'社区日常'})[page];
  $('#city-label').textContent=state?.city||'选择城市';$('#city-button').disabled=!state;
  document.querySelectorAll('nav a').forEach(a=>{const active=a.dataset.page===page;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(focus)restoreFocus(null);else if(previous)restoreFocus(previous);
}
function route(){
  const target=location.hash.slice(1);if(target==='main'){history.replaceState(null,'',`#${page}`);$('#main').focus();return;}
  if(dialog.open&&!closeModal()){history.replaceState(null,'',`#${page}`);return;}
  page=['home','health','nearby','community'].includes(target)?target:'home';management=transitionManagement(management,{type:'EXIT'});render({focus:true});window.scrollTo({top:0,behavior:'instant'});
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function modal(title,html){
  if(dialog.open){if(!closeModal())return false;}
  modalOrigin=token(document.activeElement);dirty=false;$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=html;$('#dialog-body').querySelectorAll('input,textarea').forEach(el=>{if(!el.hasAttribute('autocomplete'))el.autocomplete='off';});dialog.showModal();return true;
}
function closeModal(force=false){if(!force&&(saving||dirty)){if(saving){toast('正在保存，请等待结果后再关闭。');return false;}if(!window.confirm('放弃这次尚未保存的修改？'))return false;}dialog.close();dirty=false;restoreFocus(modalOrigin);return true;}
function field(label,html,full=false){return `<label class="field ${full?'full':''}"><span>${esc(label)}</span>${html}</label>`;}
function formActions(label='保存记录'){return `<p class="form-error" role="alert" hidden></p><div class="form-actions"><button type="button" class="button secondary" data-action="close">取消</button><button type="submit" class="button">${icon('check')} ${esc(label)}</button></div>`;}
function showFormError(form,error){const el=form?.querySelector('.form-error');const message=`保存未成功：${error.message||'请重试或先导出备份。'}`;if(el){el.hidden=false;el.textContent=message;el.tabIndex=-1;el.focus();}else toast(message);}
async function submitOperation(form,operation,message,after){
  if(saving)return false;saving=true;const b=form.querySelector('[type=submit]'),label=b.innerHTML;b.disabled=true;b.textContent='正在保存…';
  try{const result=await session.run(operation);syncState();loadError=null;closeModal(true);render();toast(message);if(after)after(result);return true;}
  catch(error){showFormError(form,error);return false;}
  finally{saving=false;b.disabled=false;b.innerHTML=label;}
}
async function update(mutator,form){try{await session.run(repo=>repo.mutate(mutator));syncState();return true;}catch(e){showFormError(form,e);return false;}}

function chartHTML(){
  const list=weights();if(!list.length)return empty('还没有体重记录','记录第一次体重，开始看见成长。',button('记一次体重','record-weight','secondary','weight'));
  const visible=list.slice(-8),values=visible.map(r=>r.value),min=Math.max(0,Math.floor(Math.min(...values)-1)),max=Math.ceil(Math.max(...values)+1),range=max-min||1;
  const span=dayDiff(visible.at(-1).date,visible[0].date),x=i=>visible.length===1?270:44+(span?dayDiff(visible[i].date,visible[0].date)/span:i/(visible.length-1))*440,y=v=>125-(v-min)/range*100;
  const points=visible.map((r,i)=>`${x(i)},${y(r.value)}`).join(' ');
  return `<div class="weight-summary"><strong>${values.at(-1)} <small>kg</small></strong><small>最近记录于 ${shortDate(visible.at(-1).date)}</small></div><svg class="chart" viewBox="0 0 520 150" role="img" aria-label="${esc(visible.map(r=>`${r.date}：${r.value}千克`).join('，'))}">${[min,(min+max)/2,max].map(v=>`<line x1="42" y1="${y(v)}" x2="494" y2="${y(v)}" stroke="#e8ede4" stroke-dasharray="3 5"/><text x="3" y="${y(v)+4}">${v.toFixed(1)}</text>`).join('')}<polygon points="${x(0)},125 ${points} ${x(visible.length-1)},125" fill="#edf3e9"/><polyline points="${points}" fill="none" stroke="#43674b" stroke-width="2.5"/>${visible.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.value)}" r="4" fill="#fff" stroke="#43674b" stroke-width="2"><title>${r.date} · ${r.value} kg</title></circle>`).join('')}</svg><div class="chart-label"><span>${shortDate(visible[0].date)}</span><span class="legend">体重 · kg</span><span>${shortDate(visible.at(-1).date)}</span></div>`;
}
function remindersHTML(summary=false){
  const list=petReminders(summary?'pending':reminderFilter),shown=summary?list.slice(0,4):list,managing=!summary&&management.reminderManage;
  return `<div class="reminder-list ${summary?'reminder-summary':'reminder-full'}" ${summary?'':`tabindex="0" role="region" aria-label="全部${list.length}项护理事项，可滚动查看"`}>`+(shown.length?shown.map(r=>{
    const days=dayDiff(r.dueDate),isPending=r.status==='pending',selected=management.selectedReminderIds.includes(r.id);
    const status=isPending?(days<0?`已逾期 ${-days} 天`:days===0?'就是今天':`${days} 天后`):r.status==='completed'?'已完成':'已取消';
    return `<div class="reminder ${managing?'managed-reminder':''} ${managing&&selected?'is-selected':''}" data-reminder-id="${esc(r.id)}">${managing?`<label class="management-check"><input type="checkbox" name="managed-reminder" value="${esc(r.id)}" ${selected?'checked':''}><span class="sr-only">选择${esc(r.title)}</span></label>`:`<span class="event-icon ${isPending&&days<=7?'orange':''}">${icon('calendar')}</span>`}<div class="reminder-content"><h3>${esc(r.title)}</h3><p>${shortDate(r.dueDate)} · 手动设置${r.legacyCompletionUnknown?' · 旧版已完成，日期待核对':r.completionRecordDeleted?' · 旧版关联记录已删除':''}</p><span class="reminder-status">${esc(status)}</span>${!managing&&isPending?`<div class="reminder-actions"><button class="text-button" data-action="complete" data-id="${esc(r.id)}">记录完成</button>${summary?'':`<button class="text-button" data-action="edit-reminder" data-id="${esc(r.id)}">修改日期</button><button class="text-button danger-text" data-action="cancel-reminder" data-id="${esc(r.id)}">取消事项</button>`}</div>`:''}</div>${managing?`<button class="icon-button reminder-edit" data-action="edit-reminder" data-id="${esc(r.id)}" aria-label="${r.status==='completed'?'查看':'编辑'}${esc(r.title)}">${icon('chevron')}</button>`:''}</div>`;
  }).join(''):empty(summary?'暂时没有待办':'这里还没有事项',summary?'可以自己安排下一次护理日期。':'切换状态，或添加一个护理事项。'))+'</div>'+(summary?`<a class="text-button reminder-all" href="#health">查看全部 ${list.length} 项待办 ${icon('chevron')}</a>`:'');
}
function petListHTML(){
  return `<div class="pet-list" role="region" tabindex="0" aria-label="${state.pets.length}只宠物，可滚动查看">${state.pets.map((p,index)=>{
    const selected=management.selectedPetIds.includes(p.id),active=p.id===state.activePet;
    return `<div class="pet-entry ${active?'is-active':''} ${management.petManage&&selected?'is-selected':''}" data-id="${esc(p.id)}">${management.petManage?`<label class="management-check"><input type="checkbox" name="managed-pet" value="${esc(p.id)}" ${selected?'checked':''}><span class="sr-only">选择${esc(p.name)}</span></label>`:`<button class="pet-drag icon-button" type="button" draggable="true" data-pet-drag="${esc(p.id)}" aria-label="拖动排序${esc(p.name)}" title="拖动排序；也可使用右侧上移与下移按钮">${icon('drag')}</button>`}<button class="pet-entry-main" data-action="${management.petManage?'toggle-pet':'select-pet'}" data-id="${esc(p.id)}" aria-label="${management.petManage?'选择':'切换到'}${esc(p.name)}" ${management.petManage?`aria-pressed="${selected}"`:`aria-pressed="${active}"`}>${img(p.image,'')}<span><strong>${esc(p.name)}${active?'<small class="current-pet">当前宠物</small>':''}</strong><small>${p.type==='cat'?'猫咪':'狗狗'} · ${ageText(p)}</small></span></button>${management.petManage?`<button class="icon-button pet-edit" data-action="edit-pet" data-id="${esc(p.id)}" aria-label="编辑${esc(p.name)}的档案">${icon('chevron')}</button>`:`<div class="pet-order"><button class="icon-button" data-action="pet-up" data-id="${esc(p.id)}" aria-label="上移${esc(p.name)}" ${index===0?'disabled':''}>${icon('up')}</button><button class="icon-button" data-action="pet-down" data-id="${esc(p.id)}" aria-label="下移${esc(p.name)}" ${index===state.pets.length-1?'disabled':''}>${icon('down')}</button></div>`}</div>`;
  }).join('')}</div>`;
}
function managementToolbar(kind){
  const pets=kind==='pets',managing=pets?management.petManage:management.reminderManage,selected=pets?management.selectedPetIds:management.selectedReminderIds;
  if(!managing)return pets?`<div class="management-toolbar">${button('添加宠物','new-pet','secondary')}</div>`:'';
  return `<div class="management-toolbar"><p class="selection-count" aria-live="polite">已选择 ${selected.length} ${pets?'只宠物':'项事项'}</p><div class="management-actions"><button class="button secondary danger-text" data-action="${pets?'trash-pets':'trash-reminders'}" ${selected.length?'':'disabled'}>移入回收站</button>${pets?'':`<button class="button secondary" data-action="calendar" ${selected.length?'':'disabled'}>${icon('calendar')} 导出日历</button>`}</div>${pets?'':`<p class="demo-note">只导出待完成事项；导入系统日历后由日历设置通知。</p>`}</div>`;
}

function timelineHTML(limit=3){const list=petRecords().slice(0,limit);return list.length?`<ol class="timeline">${list.map(r=>`<li><span class="event-icon">${icon(types[r.type]?.icon)}</span><div class="timeline-content"><h3>${esc(recordTitle(r))}<time datetime="${r.date}">${shortDate(r.date)}</time></h3><p>${esc(r.note||'把今天的小小成长记下来。')}</p><span class="small-badge">${types[r.type]?.label||'日常'}</span></div></li>`).join('')}</ol>`:empty('时间线等你写下第一笔','健康记录和日常瞬间都会出现在这里。');}
function petSummary(){const p=pet();return `<section class="pet-hero"><div class="hero-copy"><button class="pet-picker" data-action="switch-pet">${icon('paw')} 我的毛孩子 ${icon('down')}</button><h2>你好呀，${esc(p.name)}。</h2><p>${p.arrival?`我们已经一起度过 ${Math.max(0,-dayDiff(p.arrival))} 个有你陪伴的日子。`:'来到家的日期可以稍后补充。'}</p><div class="pet-tags"><span class="tag">${esc(p.breed||(p.type==='cat'?'猫咪':'狗狗'))}</span><span class="tag">${ageText(p)}</span></div><button class="text-button" data-action="edit-pet">查看宠物档案 ${icon('chevron')}</button></div><div class="hero-image">${img(p.image,p.name+'的宠物照片')}<span class="hero-caption">一起长大，一直陪伴</span></div></section>`;}
function homeHTML(){return heading('每一天，都是成长。',`和${esc(pet().name)}一起，把平凡的日子变成珍贵的回忆。`,button('记一笔','record'))+`<div class="home-grid care-home">${petSummary()}<section class="panel home-reminders"><div class="panel-title"><div><h2>接下来的小事</h2><p>日期由你设置，照顾按自己的节奏</p></div>${icon('calendar')}</div>${remindersHTML(true)}</section><div class="stats-strip"><div class="stat"><div class="stat-label">${icon('weight')} 最近体重</div><strong>${latestWeight()??'—'}<small>kg</small></strong><p>${weights().length?'已记录 '+weights().length+' 次':'等待第一次记录'}</p></div><div class="stat"><div class="stat-label">${icon('book')} 成长足迹</div><strong>${petRecords().length}<small>条</small></strong><p>记录平常的日子</p></div><div class="stat"><div class="stat-label">${icon('calendar')} 待办事项</div><strong>${pending().length}<small>项</small></strong><p>由你安排下一次</p></div></div><section class="panel home-chart"><div class="panel-title"><h2>体重的变化</h2><button class="text-button" data-action="record-weight">添加记录 ${icon('plus')}</button></div>${chartHTML()}</section><section class="panel home-timeline"><div class="panel-title"><h2>我们的成长时间线</h2><a href="#health" class="text-button">全部足迹 ${icon('chevron')}</a></div>${timelineHTML()}</section><section class="panel community-teaser">${img('assets/walk.jpg','两只狗狗一起玩耍')}<div class="teaser-copy"><h3>快乐，也可以一起长大。</h3><p>探索同城示例宠友。</p><a href="#nearby" class="text-button">遇见附近的毛孩子 ${icon('chevron')}</a></div></section></div>`;}
function recordActions(r){return `<button class="text-button" data-action="edit-record" data-id="${esc(r.id)}">编辑</button><button class="delete-button" data-action="delete-record" data-id="${esc(r.id)}">移入回收站</button>`;}
function healthHTML(){
  const records=filteredRecords();
  return heading('照顾它的每一件小事。','把健康放在心上，把记录留在这里。',button('添加记录','record'))+`<div class="health-grid local-health"><section class="panel health-profile"><div class="panel-title"><div><h2>宠物档案</h2><p>${state.pets.length}只宠物 · ${management.petManage?'选择管理，不切换当前宠物':'点击切换当前档案'}</p></div><button class="text-button" data-action="${management.petManage?'finish-pets':'manage-pets'}">${management.petManage?'完成':'管理宠物'}</button></div>${petListHTML()}${managementToolbar('pets')}</section><section class="panel health-reminders"><div class="panel-title"><h2>健康待办</h2><div class="care-header-actions"><button class="text-button" data-action="${management.reminderManage?'finish-reminders':'manage-reminders'}">${management.reminderManage?'完成':'管理与导出'}</button><button class="text-button" data-action="new-reminder">添加护理事项</button></div></div><div class="tabs reminder-tabs">${[['pending','待完成'],['completed','已完成'],['cancelled','已取消'],['all','全部事项']].map(([k,v])=>`<button class="tab ${reminderFilter===k?'active':''}" data-action="reminder-filter" data-value="${k}">${v}</button>`).join('')}</div>${remindersHTML()}${managementToolbar('reminders')}</section><section class="panel health-chart"><div class="panel-title"><h2>体重趋势</h2><button class="text-button" data-action="record-weight">称重记录 ${icon('plus')}</button></div>${chartHTML()}</section><section class="panel health-timeline"><div class="panel-title"><h2>成长足迹</h2></div>${timelineHTML(4)}</section><section class="panel full health-records"><div class="panel-title"><h2>全部成长记录</h2><div class="data-actions"><button class="text-button" data-action="trash">${icon('book')} 回收站</button><button class="text-button" data-action="export">${icon('download')} 导出备份</button><button class="text-button" data-action="import">恢复备份</button><button class="text-button" data-action="csv">导出 CSV</button></div></div><div class="tabs">${[['all','全部'],...Object.entries(types).map(([k,v])=>[k,v.label])].map(([k,v])=>`<button class="tab ${healthFilter===k?'active':''}" data-action="health-filter" data-value="${k}">${v}</button>`).join('')}</div><div class="date-filter"><label>从<input id="health-from" type="date" value="${healthFrom}"></label><label>到<input id="health-to" type="date" value="${healthTo}"></label><button class="text-button" data-action="clear-health">清空筛选</button><span>${records.length} 条记录</span></div>${records.length?`<div class="table-wrap records-table"><table><thead><tr><th>日期</th><th>类型</th><th>记录内容</th><th>备注</th><th>操作</th></tr></thead><tbody>${records.map(r=>`<tr><td>${r.date}</td><td>${types[r.type].label}</td><td>${esc(recordTitle(r))}</td><td class="note-cell">${esc(r.note||'—')}</td><td>${recordActions(r)}</td></tr>`).join('')}</tbody></table></div><div class="records-cards">${records.map(r=>`<article class="record-card"><div class="record-meta"><time datetime="${r.date}">${r.date}</time><span>${types[r.type].label}</span></div><h3>${esc(recordTitle(r))}</h3><p>${esc(r.note||'没有备注')}</p><div class="record-actions">${recordActions(r)}</div></article>`).join('')}</div>`:empty('这里还没有记录','点击“添加记录”，开始完善健康档案。')}</section></div>`;
}

function recordModal(type='weight',editing=null){
  const r=editing,linked=r?pending().find(x=>x.originRecordId===r.id):null;
  if(!modal(r?'编辑成长记录':'记下这一次成长',`<form id="record-form"><div class="form-grid">${field('记录类型',`<select name="type" id="record-type">${Object.entries(types).map(([k,v])=>`<option value="${k}" ${k===(r?.type||type)?'selected':''}>${v.label}</option>`).join('')}</select>`)}${field('记录日期',`<input name="date" type="date" value="${r?.date||today()}" max="${today()}" required>`)}<div id="type-fields" class="field full"></div>${field('备注 · 可选',`<textarea name="note" maxlength="500" placeholder="记录今天的小细节…">${esc(r?.note||'')}</textarea>`,true)}</div><p class="form-tip">健康事项日期按实际安排填写；编辑不会复制记录。</p>${formActions()}</form>`))return;
  function fill(){const t=$('#record-type').value;$('#type-fields').innerHTML=t==='weight'?field('体重（kg）',`<input name="value" type="number" inputmode="decimal" min="0.01" max="200" step="0.01" value="${r?.type==='weight'?r.value:''}" placeholder="例如：4.6…" required>`):field(t==='daily'?'给这个瞬间起个名字':'记录名称',`<input name="title" maxlength="60" value="${esc(r?.title||'')}" placeholder="例如：今天的护理…" required>`)+((t==='vaccine'||t==='deworm')?field('下一次日期 · 可选',`<input name="nextDate" type="date" value="${linked?.dueDate||''}"><small>清空会取消此记录关联的待办；日期由你决定。</small>`):'');}
  fill();$('#record-type').addEventListener('change',fill);
  $('#record-form').addEventListener('submit',async e=>{
    e.preventDefault();const d=new FormData(e.target),t=d.get('type'),hasNextDate=d.has('nextDate');
    let nextDate=hasNextDate?(d.get('nextDate')||null):undefined;
    if(r&&t!==r.type&&linked&&!hasNextDate){if(!window.confirm('更改记录类型会取消原关联的护理待办，是否继续？'))return;nextDate=null;}
    const input={...(r?{id:r.id}:{}),petId:pet().id,type:t,occurredDate:d.get('date'),value:t==='weight'?Number(d.get('value')):null,title:t==='weight'?'体重记录':d.get('title').trim(),note:d.get('note').trim(),nextDate};
    await submitOperation(e.target,repo=>repo.saveRecord(input),'已保存记录，档案与时间线已更新。');
  });
}
function petModal(isNew=false,petId=pet()?.id){
  const p=isNew?{name:'',type:'dog',breed:'',sex:'暂不确定',birthday:null,estimatedAgeMonths:null,arrivalDate:null}:session.snapshot().pets.find(x=>x.id===petId);
  if(!p)return;
  if(!modal(isNew?'认识新的毛孩子':'宠物档案',`<form id="pet-form"><div class="form-grid">${field('宠物名字',`<input name="name" value="${esc(p.name)}" maxlength="20" required>`)}${field('宠物类型',`<select name="type"><option value="dog" ${p.type==='dog'?'selected':''}>狗狗</option><option value="cat" ${p.type==='cat'?'selected':''}>猫咪</option></select>`)}${field('品种 · 可选',`<input name="breed" value="${esc(p.breed)}" maxlength="30">`)}${field('性别',`<select name="sex">${['男孩子','女孩子','暂不确定'].map(v=>`<option ${p.sex===v?'selected':''}>${v}</option>`).join('')}</select>`)}${field('年龄填写方式',`<select name="ageMethod" id="age-method"><option value="birthday" ${p.birthday?'selected':''}>知道生日</option><option value="estimated" ${!p.birthday?'selected':''}>估计年龄</option></select>`)}<div id="age-field" class="field"></div>${field('来到家的日期 · 可选',`<input name="arrivalDate" type="date" value="${p.arrivalDate||''}" max="${today()}">`)}</div>${formActions('保存档案')}</form>`))return;
  function ageField(){$('#age-field').innerHTML=$('#age-method').value==='birthday'?field('生日',`<input name="birthday" type="date" value="${p.birthday||''}" max="${today()}" required>`):field('估计年龄（月）',`<input name="estimatedAgeMonths" type="number" inputmode="numeric" min="0" max="1200" step="1" value="${p.estimatedAgeMonths??''}" placeholder="例如：12…" required>`);}
  ageField();$('#age-method').addEventListener('change',ageField);
  $('#pet-form').addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(e.target),input={...(!isNew?{id:p.id}:{}),makeActive:isNew,name:d.get('name').trim(),type:d.get('type'),breed:d.get('breed').trim(),sex:d.get('sex'),birthday:d.get('ageMethod')==='birthday'?d.get('birthday'):null,estimatedAgeMonths:d.get('ageMethod')==='estimated'?Number(d.get('estimatedAgeMonths')):null,arrivalDate:d.get('arrivalDate')||null};await submitOperation(e.target,repo=>repo.savePet(input),'宠物档案已保存。');});
}
function switchPet(){modal('我的毛孩子',state.pets.map(p=>`<button class="pet-option" data-action="select-pet" data-id="${esc(p.id)}">${img(p.image,'')}<span><strong>${esc(p.name)} ${p.id===pet()?.id?'· 正在记录':''}</strong><small>${esc(p.breed||(p.type==='cat'?'猫咪':'狗狗'))} · ${ageText(p)}</small></span></button>`).join('')+button('添加一只宠物','new-pet','soft'));}
function reminderModal(id=null,defaults={}){
  const r=id?state.reminders.find(x=>x.id===id):null;if(r?.status==='completed'){reminderDetails(r);return;}const payload={title:r?.title||defaults.title||'',dueDate:r?.dueDate||''};
  if(!modal(r?'修改护理事项':'添加护理事项',`<form id="reminder-form"><div class="form-grid">${field('事项名称',`<input name="title" value="${esc(payload.title)}" maxlength="60" required>`,true)}${field('护理日期',`<input name="dueDate" type="date" value="${payload.dueDate}" required>`,true)}</div><p class="form-tip">日期由你设置，网页不会自动制定医疗周期。</p>${formActions('保存事项')}</form>`))return;
  $('#reminder-form').addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(e.target);await submitOperation(e.target,repo=>repo.saveReminder({...r,...(!r?{petId:pet().id,originRecordId:defaults.originRecordId||null}:{}),title:d.get('title').trim(),dueDate:d.get('dueDate'),status:r?.status||'pending'}),'护理事项已保存。');});
}
function completeModal(id){const r=state.reminders.find(x=>x.id===id);if(!r||r.status!=='pending')return;const origin=state.records.find(x=>x.id===r.originRecordId);
  if(!modal('记录这次护理完成',`<form id="complete-form"><p class="form-tip">${esc(pet().name)} · ${esc(r.title)} · 原定 ${r.dueDate}</p><div class="form-grid">${field('实际完成日期',`<input name="date" type="date" value="${today()}" max="${today()}" required>`,true)}${origin?.type==='weight'?field('本次体重（kg）','<input name="value" type="number" min="0.01" max="200" step="0.01" required>',true):''}${field('备注 · 可选','<textarea name="note" maxlength="500"></textarea>',true)}</div>${formActions()}</form>`))return;
  const key=uid();$('#complete-form').addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(e.target);await submitOperation(e.target,repo=>repo.completeReminder(id,{occurredDate:d.get('date'),note:d.get('note').trim(),idempotencyKey:key,...(origin?.type==='weight'?{value:Number(d.get('value'))}:{})}),'本次护理已完成，关联记录已保存。',()=>{modal('这次护理已完成',`<p class="demo-note">可以自行安排下一次，也可以稍后再设置。</p><div class="form-actions"><button class="button secondary" data-action="close">暂不安排</button><button class="button" data-action="next-reminder" data-id="${esc(id)}">安排下一次</button></div>`);});});
}
function cancelReminder(id){const r=state.reminders.find(x=>x.id===id);if(!r)return;modal('取消这项护理安排？',`<form id="cancel-form"><p class="demo-note">取消“${esc(r.title)}”会保留历史记录，不会删除健康档案。</p>${formActions('确认取消')}</form>`);$('#cancel-form').addEventListener('submit',async e=>{e.preventDefault();await submitOperation(e.target,repo=>repo.saveReminder({...r,status:'cancelled'}),'事项已取消，历史记录仍保留。');});}
function cityModal(){if(!state)return;modal('选择你的城市',`<form id="city-form">${field('所在城市',`<select name="city">${cityOptions.map(c=>`<option ${state.city===c?'selected':''}>${c}</option>`).join('')}</select>`)}<p class="form-tip">筛选同城示例，不获取精确位置。</p>${formActions('确认城市')}</form>`);$('#city-form').addEventListener('submit',async e=>{e.preventDefault();const city=new FormData(e.target).get('city');await submitOperation(e.target,repo=>repo.mutate(s=>{s.profile.city=city;}),`已切换到${city}。`);});}
const friends=[
  {id:'f1',name:'豆豆',owner:'豆豆妈妈',type:'dog',breed:'金毛 · 男孩子',city:'深圳',area:'南山区',image:'assets/dog.jpg',desc:'喜欢草地和接飞盘，想找周末一起遛弯的伙伴。',tags:['周末遛弯','性格友好']},
  {id:'f2',name:'小橘',owner:'小橘的室友',type:'cat',breed:'橘猫 · 女孩子',city:'深圳',area:'福田区',image:'assets/cat.jpg',desc:'新手铲屎官，想交换猫咪日常护理和陪玩经验。',tags:['养猫交流','新手互助']},
  {id:'f3',name:'可乐与饼干',owner:'可乐家',type:'dog',breed:'多宠家庭',city:'深圳',area:'宝安区',image:'assets/walk.jpg',desc:'家里的快乐是双份！一起探索宠物友好的去处。',tags:['多宠家庭','户外散步']},
  {id:'f4',name:'栗子',owner:'栗子同学',type:'cat',breed:'家猫 · 男孩子',city:'上海',area:'徐汇区',image:'assets/cat.jpg',desc:'喜欢晒太阳，也喜欢分享生活里的小发现。',tags:['猫咪日常','摄影记录']},
  {id:'f5',name:'拿铁',owner:'拿铁的朋友',type:'dog',breed:'金毛 · 女孩子',city:'北京',area:'朝阳区',image:'assets/dog.jpg',desc:'每天出门散步，希望找到有相同作息的遛宠搭子。',tags:['日常遛弯','户外散步']},
  {id:'f6',name:'汤圆',owner:'汤圆一家',type:'dog',breed:'多宠家庭',city:'杭州',area:'西湖区',image:'assets/walk.jpg',desc:'喜欢探索绿地，欢迎一起分享周末的散步路线。',tags:['户外散步','路线分享']},
  {id:'f7',name:'芝麻',owner:'芝麻姐姐',type:'cat',breed:'家猫 · 女孩子',city:'广州',area:'天河区',image:'assets/cat.jpg',desc:'把养猫日常记录下来，想认识同城的铲屎官。',tags:['养猫交流','日常记录']},
  {id:'f8',name:'布丁',owner:'布丁爸爸',type:'dog',breed:'金毛 · 男孩子',city:'成都',area:'武侯区',image:'assets/dog.jpg',desc:'周末常在公园散步，爱分享宠物友好场所。',tags:['公园散步','城市探索']}
];
function nearbyHTML(){const list=friends.filter(f=>f.city===state.city&&(nearbyFilter==='all'||f.type===nearbyFilter));return heading('附近，刚好也有人爱它。','从一段散步开始，认识同城的毛孩子和它们的朋友。',button('切换城市','city','secondary','pin'))+`<div class="section-intro">${icon('pin')}<div>正在发现 ${esc(state.city)} 的宠友<small>按城市匹配的示例宠友 · 仅展示区级地域，不获取精确位置</small></div></div><div class="filter-bar"><div class="tabs">${[['all','全部宠友'],['dog','狗狗伙伴'],['cat','猫咪朋友']].map(([k,v])=>`<button class="tab ${nearbyFilter===k?'active':''}" data-action="nearby-filter" data-value="${k}">${v}</button>`).join('')}</div><small class="demo-note">${list.length} 位示例宠友</small></div><div class="nearby-grid">${list.length?list.map(f=>`<article class="friend-card"><div class="friend-image"><img width="1000" height="750" src="${esc(f.image)}" alt="${esc(f.name)}的示例宠物照片" loading="lazy"><span class="tag">${esc(f.breed)}</span></div><div class="friend-body"><h3>${esc(f.name)}<small>${esc(f.city)} · ${esc(f.area)}</small></h3><p>${esc(f.desc)}</p><div class="friend-tags">${f.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><button class="button soft" data-action="friend" data-id="${f.id}">${icon('community')} 认识一下</button></div></article>`).join(''):empty('这个筛选下暂时没有宠友','试试选择全部宠友，或者切换城市。',button('切换城市','city','secondary','pin'))}</div>`;}
function postHTML(post){return `<article class="post">${post.image?`<img width="1000" height="750" class="post-image" src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy">`:''}<div class="post-content"><div class="post-user"><img width="1000" height="750" class="post-avatar" src="${esc(post.avatar)}" alt=""><div><strong>${esc(post.author)}</strong><small>${esc(post.city)} · ${shortDate(post.date)}${post.own?' · 我的本地发布':' · 示例'}</small></div></div><h3>${esc(post.title)}</h3><p class="post-text">${esc(post.text)}</p><div class="post-topic"># ${esc(post.topic)}</div><div class="post-actions"><button class="${post.liked?'liked':''}" aria-label="${post.liked?'取消点赞':'点赞'} ${esc(post.title)}" aria-pressed="${!!post.liked}" data-action="like" data-id="${esc(post.id)}">${icon('like')} ${post.likes}</button><button data-action="comments" data-id="${esc(post.id)}">${icon('comment')} ${post.comments.length} 评论</button>${post.own?`<button data-action="delete-post" data-id="${esc(post.id)}">删除</button>`:''}</div></div></article>`;}
function communityHTML(){let list=state.posts.filter(p=>communityFilter==='all'||(communityFilter==='local'?p.city===state.city:p.topic===communityFilter));if(postSearch)list=list.filter(p=>(p.title+p.text+p.author+p.topic).toLowerCase().includes(postSearch.toLowerCase()));return heading('把毛茸茸的快乐，分享出去。','记录你的养宠日常，也收集别人的小小幸福。',button('发布日常','post','', 'camera'))+`<div class="filter-bar"><div class="tabs">${[['all','推荐日常'],['local',state.city+'同城'],['今日萌宠','今日萌宠'],['养宠心得','养宠心得']].map(([k,v])=>`<button class="tab ${communityFilter===k?'active':''}" data-action="community-filter" data-value="${k}">${esc(v)}</button>`).join('')}</div><label class="search">${icon('search')}<input id="post-search" aria-label="搜索社区内容" placeholder="搜索日常、经验或宠友" value="${esc(postSearch)}" maxlength="60"></label></div><div class="community-layout"><div class="feed">${list.length?list.map(postHTML).join(''):empty('这里暂时安静了一点','换个关键词，或者分享第一篇日常。',button('发布日常','post','','camera'))}</div><aside class="community-side"><section class="panel"><div class="panel-title"><h2>聊聊这些小事</h2></div>${['今日萌宠','遛宠搭子','养宠心得'].map(t=>`<button class="topic-item" style="width:100%;background:none;color:var(--green);text-align:left" data-action="community-filter" data-value="${t}"><span># ${t}</span><small>${state.posts.filter(p=>p.topic===t).length} 篇</small></button>`).join('')}</section><section class="panel demo-note"><h3>让社区温柔一点</h3><p>分享真实的陪伴，尊重不同的养宠方式。不公开住址和联系方式，遇到健康问题及时咨询兽医。</p></section><section class="panel demo-note"><h3>关于这个体验版</h3><p>这里预置了示例日常。你可以发布、点赞和评论，新增内容保存在当前浏览器。真实用户共享与交流将在后续版本接入。</p></section></aside></div>`;}

async function compressPhoto(file){if(!file)return '';if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 图片。');if(file.size>10*1024*1024)throw Error('图片超过 10MB，请选择小一点的图片。');return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{try{const ratio=Math.min(1,1000/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*ratio);canvas.height=Math.round(image.height*ratio);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.7));}catch{reject(Error('无法读取图片，请换一张。'));}finally{URL.revokeObjectURL(url);}};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('图片无法读取，请换一张。'));};image.src=url;});}
function postModal(){if(!pet()){toast('请先添加一只宠物，再发布它的日常。');return;}modal('分享今天的毛茸茸',`<form id="post-form"><div class="form-grid">${field('标题','<input name="title" maxlength="60" placeholder="给今天的小美好起个名字…" required>',true)}${field('日常内容','<textarea name="text" maxlength="1500" placeholder="分享今天的日常…" required></textarea>',true)}${field('话题',`<select name="topic">${['今日萌宠','遛宠搭子','养宠心得'].map(t=>`<option>${t}</option>`).join('')}</select>`)}${field('城市',`<select name="city">${cityOptions.map(c=>`<option ${c===state.city?'selected':''}>${c}</option>`).join('')}</select>`)}${field('照片 · 可选','<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"><small>支持 JPG / PNG / WebP，最大 10MB。</small>',true)}</div><p class="form-tip">发布到本地示例，保存在当前浏览器，不向其他访客共享。</p>${formActions('发布日常')}</form>`);$('#post-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.target,d=new FormData(form);await submitOperation(form,async repo=>{const file=d.get('photo'),image=await compressPhoto(file?.size?file:null);return repo.mutate(s=>s.posts.unshift({id:uid(),author:'我与'+pet().name,pet:pet().name,city:d.get('city'),topic:d.get('topic'),title:d.get('title').trim(),text:d.get('text').trim(),image,avatar:pet().image,likes:0,liked:false,date:today(),comments:[],own:true}));},'日常已保存到本地示例。',()=>{communityFilter='all';postSearch='';location.hash='community';render();});});}
function commentsModal(id){const p=state.posts.find(x=>x.id===id);if(!p)return;modal('聊聊这篇日常',`<div class="comments">${p.comments.length?p.comments.map(c=>`<div class="comment"><strong>${esc(c.author)}</strong><p>${esc(c.text)}</p></div>`).join(''):'<p class="demo-note">还没有评论，留下第一句友好的回应吧。</p>'}</div><form id="comment-form">${field('我的评论','<textarea name="comment" maxlength="400" placeholder="分享你的想法…" required></textarea>')}<p class="form-tip">评论仅保存在当前浏览器。</p>${formActions('发送评论')}</form>`);$('#comment-form').addEventListener('submit',async e=>{e.preventDefault();const text=new FormData(e.target).get('comment').trim();await submitOperation(e.target,repo=>repo.mutate(s=>s.posts.find(x=>x.id===id).comments.push({author:'我',text})),'评论已保存到当前浏览器。');});}
function friendModal(id){const f=friends.find(x=>x.id===id);if(!f)return;modal(`认识${f.name}`,`<div class="pet-profile">${img(f.image,f.name)}<div><h3>${esc(f.owner)}</h3><p>${esc(f.city)} · ${esc(f.area)}<br>${esc(f.breed)}</p></div></div><p class="profile-details">${esc(f.desc)}</p><p class="form-tip">这是示例宠友，暂不提供真实私信。你可以发布同城日常，演示寻找伙伴的流程。</p><div class="form-actions"><button class="button secondary" data-action="close">返回</button><button class="button" data-action="invite-post">写一篇找搭子的日常</button></div>`);}
function reminderDetails(r){
  const full=session.snapshot(),record=full.records.find(item=>item.id===r.completionRecordId),parent=full.pets.find(item=>item.id===r.petId);
  modal('护理完成详情',`<div class="profile-details"><h3>${esc(r.title)}</h3><p>宠物：${esc(parent?.name||'未找到')}<br>原定日期：${esc(r.dueDate)}<br>状态：已完成<br>实际完成日期：${record?esc(record.occurredDate):r.completedAt?esc(localDate(new Date(r.completedAt))):'旧版没有保存，待核对'}</p>${record?`<p>${record.deletedAt?'关联记录已移入回收站。':'关联记录：'+esc(record.title)}<br>${esc(record.note||'没有备注')}</p>`:'<p>没有可查看的关联记录，保留原完成历史。</p>'}</div><div class="form-actions"><button class="button secondary" data-action="close">关闭详情</button></div>`);
}
function confirmDelete(kind,id){
  if(kind==='record'){trashConfirm('record',[id]);return;}
  if(!modal('删除这篇本地日常？',`<form id="delete-form"><p class="demo-note">社区日常删除后无法撤回，建议先导出备份；它不会进入健康回收站。</p>${formActions('确认删除')}</form>`))return;
  $('#delete-form .secondary').textContent='保留';
  $('#delete-form').addEventListener('submit',async e=>{e.preventDefault();await submitOperation(e.target,repo=>repo.mutate(s=>{s.posts=s.posts.filter(x=>x.id!==id);}),'日常已删除。');});
}
function trashConfirm(kind,ids){
  if(!ids.length){toast('请先选择要移入回收站的项目。');return;}
  const full=session.snapshot(),items=full[{pet:'pets',record:'records',reminder:'reminders'}[kind]].filter(item=>ids.includes(item.id));
  const description=kind==='pet'?'关联记录与事项会一起隐藏。恢复宠物后会重新显示，之前单独移入的内容仍保留在回收站。':kind==='record'?'记录可以恢复，来源关联的待完成事项会取消；恢复记录不会自动重新安排护理。':'事项可以恢复，原日期、状态和完成记录会保留。';
  if(!modal('移入回收站？',`<form id="trash-form"><p class="trash-confirm-names">${items.map(item=>esc(item.name||item.title)).join('、')}</p><p class="demo-note">将移入 ${ids.length} ${kind==='pet'?'只宠物':kind==='record'?'条记录':'项事项'}。${description}</p>${formActions('确认移入')}</form>`))return;
  $('#trash-form .secondary').textContent='保留';
  $('#trash-form').addEventListener('submit',async e=>{e.preventDefault();await submitOperation(e.target,repo=>repo.moveToTrash({kind,ids,...(kind==='reminder'?{petId:pet().id}:{})}),'已移入回收站，可随时恢复。');});
}
function trashModal(){
  const full=session.snapshot(),parentMap=new Map(full.pets.map(p=>[p.id,p])),groups=[['pet','宠物',full.pets],['record','记录',full.records],['reminder','护理事项',full.reminders]];
  let count=0;
  const html=groups.map(([kind,label,entities])=>{
    const hidden=entities.filter(item=>item.deletedAt);count+=hidden.length;
    return hidden.length?`<section class="trash-group"><h3>${label} · ${hidden.length}</h3>${hidden.map(item=>{
      const parent=kind==='pet'?item:parentMap.get(item.petId),blocked=kind!=='pet'&&!!parent?.deletedAt;
      const recordCount=kind==='pet'?full.records.filter(r=>r.petId===item.id).length:0,reminderCount=kind==='pet'?full.reminders.filter(r=>r.petId===item.id).length:kind==='record'?full.reminders.filter(r=>r.originRecordId===item.id||r.completionRecordId===item.id).length:0;
      const details=kind==='pet'?`${recordCount} 条关联记录 · ${reminderCount} 项护理事项`:kind==='record'?`${item.occurredDate} · ${types[item.type].label} · ${reminderCount} 项关联事项`:`${item.dueDate} · ${item.status==='pending'?'待完成':item.status==='completed'?'已完成':'已取消'}`;
      return `<div class="trash-entry" data-kind="${kind}" data-id="${esc(item.id)}"><div><strong>${esc(item.name||item.title)}</strong><p>${kind==='pet'?'':`所属宠物：${esc(parent?.name||'未找到')} · `}${esc(details)}</p><small>移入日期：${esc(localDate(new Date(item.deletedAt)))}</small>${blocked?`<p class="trash-parent-hint">请先恢复宠物“${esc(parent.name)}”，再恢复此项目。</p>`:''}</div><button class="button secondary" data-action="restore-trash" data-kind="${kind}" data-id="${esc(item.id)}" ${blocked?'disabled':''}>恢复</button></div>`;
    }).join('')}</section>`:'';
  }).join('');
  modal('回收站',`<div class="trash-content"><p class="demo-note">不会自动清空。恢复保留原始内容与日期，不会恢复已经单独移入回收站的子记录。</p>${count?html:empty('回收站是空的','移入的宠物、记录与护理事项会在这里保留。')}<p class="form-error" role="alert" hidden></p></div><div class="form-actions"><button class="button secondary" data-action="close">关闭回收站</button></div>`);
}
async function restoreTrash(el){
  const key=`restore:${el.dataset.kind}:${el.dataset.id}`;if(busyActions.has(key))return;
  busyActions.add(key);el.disabled=true;const label=el.textContent;el.textContent='正在恢复…';saving=true;
  try{await session.run(repo=>repo.restoreFromTrash({kind:el.dataset.kind,ids:[el.dataset.id]}));syncState();dirty=false;closeModal(true);render();trashModal();toast('已恢复，原日期和历史保持不变。');}
  catch(error){const message=$('.trash-content .form-error');message.hidden=false;message.textContent='恢复未成功：'+error.message;message.tabIndex=-1;message.focus();}
  finally{saving=false;busyActions.delete(key);el.disabled=false;el.textContent=label;}
}
async function reorderPet(id,destination){
  if(management.petManage||busyActions.has('reorder-pets'))return;
  const ids=state.pets.map(p=>p.id),from=ids.indexOf(id),to=typeof destination==='number'?from+destination:ids.indexOf(destination);
  if(from<0||to<0||to>=ids.length||from===to)return;
  ids.splice(from,1);ids.splice(to,0,id);
  busyActions.add('reorder-pets');
  try{await session.run(repo=>repo.reorderPets(ids));syncState();render();if(typeof destination==='number'){const action=destination<0?'pet-up':'pet-down',control=document.querySelector(`[data-action="${action}"][data-id="${CSS.escape(id)}"]`);if(control?.disabled)restoreFocus({action:'select-pet',id});}toast('宠物顺序已保存。');}
  finally{busyActions.delete('reorder-pets');}
}

function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportData(){download(JSON.stringify(session.snapshot(),null,2),`爪爪日记-备份-${today()}.json`,'application/json');toast('备份已导出，包含宠物、记录、事项与本地帖子。');}
function emptySnapshot(){return {version:3,mode:'demo',activePetId:null,pets:[],records:[],reminders:[],posts:[],profile:{city:'深圳'}};}
function importModal(){
  if(!modal('恢复备份',`<form id="import-form">${field('选择 JSON 备份','<input name="backup" type="file" accept="application/json,.json" required>')}<p class="form-tip">先预览新增与冲突；确认之前不会修改当前数据。</p>${formActions('预览恢复')}</form>`))return;
  $('#import-form').addEventListener('submit',async e=>{e.preventDefault();if(saving)return;saving=true;const form=e.target,b=form.querySelector('[type=submit]');b.disabled=true;
    try{const file=new FormData(form).get('backup');if(file.size>20*1024*1024)throw new Error('备份超过20MB，请缩小文件后再试。');const incoming=validateBackup(await file.text()),current=state?session.snapshot():emptySnapshot(),preview=previewImport(current,incoming);saving=false;dirty=false;closeModal(true);
      modal('恢复前请核对',`<form id="restore-form"><p class="restore-summary">新增 ${preview.newPets.length} 只宠物、${preview.newRecords.length} 条记录、${preview.newReminders.length} 项提醒、${preview.newPosts.length} 篇本地日常。</p><p class="demo-note">${state?'相同内容不会重复导入。冲突默认保留当前版本，勾选才更新；恢复或移入回收站的变化也需确认。':'当前档案无法读取，将保存原始字符串后恢复有效备份。'}</p>${preview.conflicts.map(c=>`<label class="conflict-option"><input name="conflict" type="checkbox" value="${esc(c.kind+':'+c.id)}"><span>${c.effect==='restore'?'恢复已移入回收站的':c.effect==='trash'?'移入回收站':'更新'} ${esc(c.current.title||c.current.name||c.id)}<small>当前：${esc(c.current.note||c.current.title||c.current.name||'')}<br>备份：${esc(c.incoming.note||c.incoming.title||c.incoming.name||'')}</small></span></label>`).join('')}${formActions('确认恢复')}</form>`);
      $('#restore-form').addEventListener('submit',async event=>{event.preventDefault();try{const accepted=new FormData(event.target).getAll('conflict'),merged=mergeBackup(current,incoming,{acceptedConflictIds:accepted});await submitOperation(event.target,repo=>repo.replaceSnapshot(merged),'备份已恢复，原始数据已另行保留。');}catch(error){showFormError(event.target,error);}});
    }catch(error){showFormError(form,error);}finally{saving=false;b.disabled=false;}
  });
}
const busyActions=new Set();
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
document.addEventListener('click',async e=>{
  if(e.target.closest('.skip-link')){e.preventDefault();$('#main').focus();return;}
  const el=e.target.closest('[data-action]');
  if(!el){
    if(e.target.closest('.management-check'))return;
    const row=e.target.closest('.managed-reminder');
    if(row){management=transitionManagement(management,{type:'TOGGLE_REMINDER',id:row.dataset.reminderId});render();restoreFocus({name:'managed-reminder',value:row.dataset.reminderId});}
    else if(management.petManage){const petRow=e.target.closest('.pet-entry');if(petRow){management=transitionManagement(management,{type:'TOGGLE_PET',id:petRow.dataset.id});render();restoreFocus({name:'managed-pet',value:petRow.dataset.id});}}
    return;
  }
  const a=el.dataset.action,id=el.dataset.id,v=el.dataset.value;
  try{switch(a){
    case 'record':recordModal();break;case 'record-weight':recordModal('weight');break;case 'record-daily':recordModal('daily');break;
    case 'edit-record':recordModal(null,state.records.find(r=>r.id===id));break;case 'edit-pet':petModal(false,id||pet()?.id);break;case 'new-pet':if(dialog.open&&!closeModal())break;petModal(true);break;case 'switch-pet':switchPet();break;
    case 'select-pet':if(busyActions.has(a))break;busyActions.add(a);try{await session.run(repo=>repo.selectPet(id));management=transitionManagement(management,{type:'PET_CHANGED'});syncState();if(dialog.open)closeModal(true);render();toast(`开始记录${pet().name}的成长。`);}finally{busyActions.delete(a);}break;
    case 'manage-pets':management=transitionManagement(management,{type:'ENTER_PETS'});render();restoreFocus({action:'finish-pets'});break;
    case 'manage-reminders':management=transitionManagement(management,{type:'ENTER_REMINDERS'});render();restoreFocus({action:'finish-reminders'});break;
    case 'finish-pets':management=transitionManagement(management,{type:'EXIT',target:'pets'});render();restoreFocus({action:'manage-pets'});break;
    case 'finish-reminders':management=transitionManagement(management,{type:'EXIT',target:'reminders'});render();restoreFocus({action:'manage-reminders'});break;
    case 'toggle-pet':management=transitionManagement(management,{type:'TOGGLE_PET',id});render();break;
    case 'pet-up':await reorderPet(id,-1);break;case 'pet-down':await reorderPet(id,1);break;
    case 'trash-pets':trashConfirm('pet',[...management.selectedPetIds]);break;case 'trash-reminders':trashConfirm('reminder',[...management.selectedReminderIds]);break;
    case 'trash':trashModal();break;case 'restore-trash':await restoreTrash(el);break;
    case 'complete':completeModal(id);break;case 'new-reminder':reminderModal();break;case 'edit-reminder':reminderModal(id);break;case 'cancel-reminder':cancelReminder(id);break;
    case 'next-reminder':{const r=state.reminders.find(x=>x.id===id);closeModal(true);reminderModal(null,{title:r.title,originRecordId:r.completionRecordId});break;}
    case 'city':cityModal();break;case 'post':postModal();break;case 'invite-post':closeModal(true);postModal();break;case 'friend':friendModal(id);break;
    case 'health-filter':healthFilter=v;render();break;case 'reminder-filter':reminderFilter=v;management=transitionManagement(management,{type:'FILTER_CHANGED'});render();break;case 'nearby-filter':nearbyFilter=v;render();break;case 'community-filter':communityFilter=v;render();break;
    case 'clear-health':healthFilter='all';healthFrom='';healthTo='';render();break;
    case 'like':if(busyActions.has('like:'+id))break;busyActions.add('like:'+id);el.disabled=true;try{if(await update(s=>{const p=s.posts.find(x=>x.id===id);p.liked=!p.liked;p.likes+=p.liked?1:-1;}))render();}finally{busyActions.delete('like:'+id);el.disabled=false;}break;
    case 'comments':commentsModal(id);break;case 'delete-record':confirmDelete('record',id);break;case 'delete-post':confirmDelete('post',id);break;
    case 'export':exportData();break;case 'import':importModal();break;
    case 'csv':{const ids=new Set(filteredRecords().map(r=>r.id));download(exportRecordsCsv(session.snapshot().records.filter(r=>ids.has(r.id))),`爪爪日记-记录-${today()}.csv`,'text/csv;charset=utf-8');toast('已导出当前宠物的筛选记录。');break;}
    case 'calendar':{const s=session.snapshot(),selected=selectedCalendarReminders(s,pet()?.id,management.selectedReminderIds);download(exportRemindersIcs(selected,visibleHealth(s).pets),`爪爪日记-护理-${today()}.ics`,'text/calendar;charset=utf-8');toast('日历文件已导出，请在系统日历中导入并设置通知。');break;}
    case 'raw-export':download(await repository.getRawBackup(),`爪爪日记-原始数据-${today()}.txt`,'text/plain;charset=utf-8');break;
    case 'retry':await boot();break;case 'close':closeModal();break;
  }}catch(error){toast('操作未成功：'+error.message);}
});
document.addEventListener('input',e=>{if(dialog.contains(e.target))dirty=true;if(e.target.id==='post-search'){postSearch=e.target.value;const cursor=e.target.selectionStart;render();$('#post-search').focus();$('#post-search').setSelectionRange(cursor,cursor);}});
document.addEventListener('change',e=>{
  if(e.target.name==='managed-pet'||e.target.name==='managed-reminder'){management=transitionManagement(management,{type:e.target.name==='managed-pet'?'TOGGLE_PET':'TOGGLE_REMINDER',id:e.target.value});render();return;}
  if(e.target.id==='health-from'||e.target.id==='health-to'){const from=$('#health-from').value,to=$('#health-to').value;if(from&&to&&from>to){toast('开始日期不能晚于结束日期。');$('#health-from').value=healthFrom;$('#health-to').value=healthTo;return;}healthFrom=from;healthTo=to;render();}
});
document.addEventListener('dragstart',e=>{const handle=e.target.closest('[data-pet-drag]');if(!handle||management.petManage)return;draggedPetId=handle.dataset.petDrag;e.dataTransfer.setData('text/plain',draggedPetId);e.dataTransfer.effectAllowed='move';handle.closest('.pet-entry').classList.add('is-dragging');});
document.addEventListener('dragover',e=>{if(draggedPetId&&e.target.closest('.pet-entry')&&!management.petManage){e.preventDefault();e.dataTransfer.dropEffect='move';}});
document.addEventListener('drop',async e=>{const row=e.target.closest('.pet-entry');if(!row||!draggedPetId||management.petManage)return;e.preventDefault();const id=draggedPetId;draggedPetId=null;try{await reorderPet(id,row.dataset.id);restoreFocus({action:'select-pet',id});}catch(error){toast('排序未成功：'+error.message);}finally{document.querySelectorAll('.is-dragging').forEach(el=>el.classList.remove('is-dragging'));}});
document.addEventListener('dragend',()=>{draggedPetId=null;document.querySelectorAll('.is-dragging').forEach(el=>el.classList.remove('is-dragging'));});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){const placeholder=document.createElement('span');placeholder.className='image-fallback '+e.target.className;placeholder.setAttribute('role','img');placeholder.setAttribute('aria-label',e.target.alt||'图片暂不可用');placeholder.textContent='图片暂不可用';e.target.replaceWith(placeholder);}},true);
$('#city-button').addEventListener('click',cityModal);$('#close-dialog').addEventListener('click',()=>closeModal());
dialog.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
$('#about-button').addEventListener('click',()=>modal('属于你们的成长手账',`<div class="profile-details"><p>当前是本地示例体验版，数据保存在此浏览器，不支持登录、跨设备同步或真实社区共享。</p><p>支持记录编辑、独立护理待办、备份恢复和日历文件导出。</p></div><div class="form-actions">${state?button('导出我的数据','export','secondary','download'):''}<button class="button" data-action="close">继续记录</button></div>`));
window.addEventListener('beforeunload',e=>{if(dialog.open&&(dirty||saving)){e.preventDefault();e.returnValue='';}});
window.addEventListener('hashchange',route);
async function boot(){try{if(!repository){repository=createDemoRepository({storage:localStorage});session=createAppSession(repository);}loadError=null;render();await session.load();syncState();route();}catch(error){loadError=error;render();}}
boot();
