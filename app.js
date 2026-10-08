import {createAiClient} from './src/ai/client.js';
import {createCommunityRepository} from './src/data/community-repository.js';
import {mountProfile} from './src/features/profile.js';
import {mountCommunity} from './src/features/community.js';
import {mountNearby} from './src/features/nearby.js';
import {createDraftHandoff} from './src/features/community-draft-handoff.js';
import {createOwnerDraftQueue} from './src/features/community-intents.js';
import {createProfileMenu} from './src/ui/profile-menu.js';
import {createUiPreferences,uiIdentityKey} from './src/data/ui-preferences.js';
import {isInteractionBlocked} from './src/domain/help-lifecycle.js';
import {createHelpCoordinator} from './src/features/help-coordinator.js';
import {mountHelp,createReadonlyDialog} from './src/features/help.js';
import {mountWhatsNew} from './src/features/whats-new.js';
import {mountGuidedTour} from './src/features/guided-tour.js';
import {createInstallController} from './src/features/install.js';
import {createUpdateMonitor} from './src/features/update.js';
import {mountRegionPicker} from './src/ui/region-picker.js';
import {prepareCommunityImage,createCommunityImageLoader} from './src/media/community-images.js';
import {createAiContext} from './src/ai/context.js';
import {createAiEntry} from './src/features/ai-entry.js';
import {recordTypeEntries as catalogEntries} from './src/domain/record-type-catalog.js';
import {recordIntent} from './src/domain/record-intent.js';
import {isHealthTodo} from './src/domain/health-plans.js';
import {growthEntries,exportGrowthCsv} from './src/ui/growth-entries.js';
import {enhanceDateInput} from './src/ui/date-input.js';
import {createDiscardConfirm} from './src/ui/discard-confirm.js';
import {mountRecordDialog} from './src/ui/record-dialog.js';
import {enhanceSelect} from './src/ui/select-control.js';
import {enhanceRecordTypeSelect} from './src/ui/record-type-picker.js';
import {attachmentPickerMarkup,createAttachmentPicker} from './src/ui/attachment-picker.js';
import {createOnboarding} from './src/features/onboarding.js';
import {createWeeklyRecap} from './src/features/weekly-recap.js';
import {createAssistantPanel} from './src/features/assistant-panel.js';
import {stage3Text as S3,stage3Error,refreshStage3Copy,stage3Help} from './src/ui/stage3-copy.js';
import cloudbase from '@cloudbase/js-sdk';
import {createLocalRepository} from './src/data/local-repository.js';
import {createCloudRepository} from './src/data/cloud-repository.js';
import {createCloudbaseAuth} from './src/auth/cloudbase-auth.js';
import {PUBLIC_CONFIG} from './src/config/public-config.js';
import {createSeedState} from './src/data/seed.js';
import {exportArchive,validateArchive,previewArchiveImport,commitArchiveImport} from './src/domain/archive.js';
import {processImage} from './src/media/process-image.js';
import {mountAvatarPicker,createPetAvatarSave,focusDialogTitle} from './src/ui/avatar-picker.js';
import {initialPetSelection,filterRecords as filterPetRecords} from './src/ui/record-pet-filter.js';
import {mountRowSort} from './src/ui/row-sort.js';
import {createPhotoWall} from './src/features/photo-wall.js';
import {createAccountUI} from './src/ui/account.js';
import {t as translate,setLocale,getLocale,subscribeLocale} from './src/ui/i18n.js';
import zhMessages from './src/ui/locales/zh-CN.js';
import enMessages from './src/ui/locales/en.js';
import {localizeError} from './src/ui/error-localization.js';
import {html as UI_HTML,translateUiText as UI_TEXT} from './src/ui/markup-i18n.js';
import {captureFormContext,bindFormRepository} from './src/ui/form-context.js';
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
  drop:'<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>',
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
const shortDate = date => date ? UI_HTML`${Number(date.slice(5,7))}月${Number(date.slice(8,10))}日` : UI_TEXT('未设置');
const types={weight:{get label(){return UI_TEXT('体重');},icon:'weight'},vaccine:{get label(){return UI_TEXT('疫苗');},icon:'vaccine'},deworm:{get label(){return UI_TEXT('驱虫');},icon:'shield'},daily:{get label(){return UI_TEXT('日常');},icon:'camera'},other:{get label(){return UI_TEXT('其他');},icon:'book'}};
const cityOptions=['深圳','北京','上海','广州','杭州','成都'];

let repository, session, state=null, loadError=null;
let workspaceMode='demo',cloudApp=null,auth=null,accountUI=null,authPrincipal=null,photoWall=null,photoHost=null,photoPetId=null;
const localRepositories=new Map(),avatarUrls=new Map(),reauthRequiredOwners=new Set();
let restoreAuthUnsubscribe=null,workspaceTransition=0;
let communityIdentityGeneration=0,communityRepository=null,communityImages=null,publicSurface=null,publicSurfacePage=null,publicProfile=null,profileMenu=null;
const communityHandoff=createDraftHandoff(),communityDraftQueue=createOwnerDraftQueue({getSession:communitySession});let communityContinuation=null,nextCommunityAuthor=null;
let communityBrowseRegion;try{communityBrowseRegion=JSON.parse(localStorage.getItem('paw-diary:community-browse-region')||'null')??{};}catch{communityBrowseRegion={};}
const communityUploads=new WeakMap();
function communitySession(){return {userId:authPrincipal?.userId??null,generation:communityIdentityGeneration};}
function clearPublicSurface(){publicSurface?.destroy?.();publicSurface=null;publicSurfacePage=null;}
function assignAuthPrincipal(principal){const previous=authPrincipal?.userId;authPrincipal=principal?.userId?{userId:principal.userId}:null;if(previous!==authPrincipal?.userId){guidedTour?.stop({reason:'identity'});helpPanel?.close();helpCoordinator?.identityChanged();}changeCommunityIdentity(previous,authPrincipal);}
function changeCommunityIdentity(previous,next){if(previous===next?.userId)return;if(dialog.querySelector('#recap-share-form')){closeModal(true);$('#dialog-body').replaceChildren();}communityDraftQueue.clear();nextCommunityAuthor=null;if(communityContinuation?.kind==='login'&&next?.userId){try{communityHandoff.bindLoginOwner(next.userId);}catch{communityHandoff.clear();communityContinuation=null;}}else if(!communityContinuation){communityHandoff.clear();}communityIdentityGeneration++;communityRepository?.dispose();communityRepository=null;communityImages?.reset();communityImages=null;publicProfile=null;clearPublicSurface();profileMenu?.close(false);}
function getCommunityRepository(){if(communityRepository)return communityRepository;initCloudAccount();communityRepository=createCommunityRepository({getPrincipal:()=>authPrincipal,getGeneration:()=>communityIdentityGeneration,getAuthorization:()=>auth?.getRequestSession(),invoke:request=>{if(!cloudApp||!PUBLIC_CONFIG.communityEnabled)throw Object.assign(new Error('Community unavailable'),{code:'UNAVAILABLE'});return cloudApp.callFunction({name:PUBLIC_CONFIG.communityFunctionName,data:request});}});return communityRepository;}
function getCommunityImages(){communityImages??=createCommunityImageLoader({read:payload=>getCommunityRepository().request('community.media.read',payload)});return communityImages;}
async function uploadCommunityImage(file,kind){const scope=communitySession();if(!scope.userId)throw accountBoundaryError('UNAUTHENTICATED');let pending=communityUploads.get(file);if(!pending||pending.ownerId!==scope.userId||pending.generation!==scope.generation||pending.kind!==kind){pending={ownerId:scope.userId,generation:scope.generation,kind,prepareId:uid(),confirmId:uid(),prepared:null,ticket:null,asset:null};communityUploads.set(file,pending);}const current=()=>{if(authPrincipal?.userId!==scope.userId||communityIdentityGeneration!==scope.generation)throw accountBoundaryError();};if(!pending.prepared){pending.prepared=await prepareCommunityImage(file,{kind});current();}const repo=getCommunityRepository();if(!pending.ticket){pending.ticket=await repo.request('community.media.prepare',pending.prepared.metadata,{operationId:pending.prepareId});current();}if(!pending.asset){pending.asset=await repo.request('community.media.confirm',{ticketId:pending.ticket.ticketId,bytesBase64:pending.prepared.bytesBase64},{operationId:pending.confirmId});current();}return pending.asset;}
function updatePublicIdentityChrome(){const label=getLocale()==='en'?'Account menu':'个人菜单';$('#owner-profile-button').setAttribute('aria-label',label);$('#about-button').setAttribute('aria-label',label);for(const el of [$('#owner-profile-button'),$('#about-button .owner-avatar')])el.textContent=(publicProfile?.nickname||(getLocale()==='en'?'Me':'我')).slice(0,1);if(publicProfile?.nickname){const name=$('#about-button span:nth-child(2)');name.firstChild.textContent=publicProfile.nickname;}}
function setCommunityBrowseRegion(region){communityBrowseRegion={cityId:region.cityId??null,districtId:region.districtId??null,cityName:region.cityName??null,districtName:region.districtName??null};localStorage.setItem('paw-diary:community-browse-region',JSON.stringify(communityBrowseRegion));$('#city-label').textContent=communityBrowseRegion.cityName??(getLocale()==='en'?'Choose a city':'选择城市');}
async function openCommunityLogin(info={}){communityContinuation={kind:'login',...info};try{initCloudAccount();let authorization;try{authorization=await auth?.getRequestSession();}catch(error){if(error.code!=='UNAUTHENTICATED')throw error;}if(authorization?.principal?.userId){await handleAuthIdentityChange(authorization.principal);continueCommunityDraft();return;}await openAccount();if(authPrincipal?.userId&&communityContinuation?.kind==='login'){if(dialog.open)closeModal(true);continueCommunityDraft();}}catch(error){toast(localizeError(error));}}
function openCommunityProfile(info={}){if(info.handoffId)communityContinuation={kind:'profile',...info};location.hash='profile';}
function continueCommunityDraft(){const continuation=communityContinuation;communityContinuation=null;if(continuation?.handoffId){const draft=communityHandoff.consume(authPrincipal?.userId);if(draft){communityDraftQueue.stage(draft);location.hash='community';if(page==='community'){clearPublicSurface();render();}return;}}if(continuation?.returnTo==='profile'){if(page==='profile')render();else location.hash='profile';}}
function showCommunityAuthor(authorId){nextCommunityAuthor=authorId;if(page==='community'&&publicSurface?.openAuthorPosts){publicSurface.openAuthorPosts(authorId);nextCommunityAuthor=null;}else location.hash='community';}
function refreshPublicChrome(){workspaceControls();$('#page-label').textContent=({community:UI_TEXT('社区日常'),nearby:UI_TEXT('附近宠友'),profile:getLocale()==='en'?'Personal profile':'个人资料'})[page];$('#city-label').textContent=communityBrowseRegion.cityName??(getLocale()==='en'?'Choose a city':'选择城市');const launcher=document.getElementById('stage3-assistant-launcher');if(launcher)launcher.innerHTML=icon('comment')+' '+esc(S3('assistant'));stage3Assistant?.refreshLocale?.();updatePublicIdentityChrome();document.querySelector('footer span').textContent=getLocale()==='en'?'Health records stay private. You choose what to publish.':'健康档案始终私有，公开内容由你主动选择。';maintainSelects();}
function renderPublicProfile(){if(publicSurfacePage===page&&publicSurface)return;clearPublicSurface();$('#main').innerHTML='<div id="public-surface"></div>';publicSurfacePage=page;const common={container:$('#public-surface'),repository:getCommunityRepository(),getSession:communitySession,getLocale,onLocaleChange:setLocale,onLogin:openCommunityLogin,onProfile:openCommunityProfile,onEditProfile:()=>openCommunityProfile(),onViewAuthorPosts:showCommunityAuthor,mountRegionPicker,uploadImage:uploadCommunityImage,resolveImage:(assetId,reference)=>getCommunityImages().load(assetId,reference),getBrowseRegion:()=>communityBrowseRegion,onBrowseRegion:setCommunityBrowseRegion,getOwnAuthorId:()=>publicProfile?.authorId??null,onError:error=>{if(!['WORKSPACE_CHANGED','IDENTITY_CHANGED'].includes(error.code))toast(localizeError(error));}};
 if(page==='profile')publicSurface=mountProfile({...common,onLogin:()=>openCommunityLogin({returnTo:'profile'}),resolveImage:assetId=>getCommunityRepository().request('community.media.read',{assetId}),onSaved:profile=>{publicProfile=profile;updatePublicIdentityChrome();toast(getLocale()==='en'?'Profile saved.':'个人资料已保存。');if(communityContinuation?.kind==='profile')continueCommunityDraft();}});
 else if(page==='community'){publicSurface=mountCommunity({...common,draftHandoff:communityHandoff,initialAuthorId:nextCommunityAuthor,initialDraft:communityDraftQueue.consume()});nextCommunityAuthor=null;}
 else publicSurface=mountNearby(common);
 if(authPrincipal?.userId&&!publicProfile){const generation=communityIdentityGeneration;getCommunityRepository().request('profiles.getOwn',{}).then(profile=>{if(generation!==communityIdentityGeneration)return;publicProfile=profile;updatePublicIdentityChrome();if(page==='nearby')publicSurface?.refresh?.();}).catch(()=>{});}
}
function openCommunityBrowseRegion(){const locale=getLocale(),generation=communityIdentityGeneration;if(!modal(locale==='en'?'Browsing region':'浏览地区','<div data-readonly-ai><div id="community-browse-picker"></div><div class="form-actions"><button type="button" class="button secondary" data-action="close">'+(locale==='en'?'Cancel':'取消')+'</button><button type="button" class="button" id="community-browse-apply">'+(locale==='en'?'Use this region':'使用这个地区')+'</button></div></div>'))return;const picker=mountRegionPicker({container:$('#community-browse-picker'),repository:getCommunityRepository(),initialValue:communityBrowseRegion,getLocale,getGeneration:()=>communityIdentityGeneration});$('#community-browse-apply').onclick=()=>{if(generation!==communityIdentityGeneration)return;const region=picker.getValue();picker.destroy();setCommunityBrowseRegion(region);closeModal(true);publicSurface?.setBrowseRegion?.(region);};$('#dialog-body').querySelector('[data-readonly-ai]').__pawCleanup=()=>picker.destroy();}
function editingPetId(form){return form?.__pawContext?.petId??pet()?.id;}
function petTypeLabel(p){return p.type==='other'?p.typeLabel:UI_TEXT(p.type==='cat'?UI_TEXT('猫咪'):UI_TEXT('狗狗'));}
function recordTypeLabel(r){return r.type==='other'?r.typeLabel:UI_TEXT(types[r.type]?.label??UI_TEXT('日常'));}
function recordTypeEntries(){return catalogEntries(session.snapshot()).map(e=>[e.id,{label:e.builtin?types[e.type].label:e.name,icon:e.iconKey,type:e.type}]);}
function assertDemoTypes(snapshot){if((snapshot.pets??[]).some(p=>p.type==='other'))throw Object.assign(new Error('DEMO_TYPE_UNSUPPORTED'),{code:'DEMO_TYPE_UNSUPPORTED',messageKey:'error.demoCustomType'});}
function canonicalUiText(value){const text=String(value??'');if(Object.hasOwn(zhMessages,text))return text;const key=Object.keys(enMessages).find(k=>enMessages[k]===text&&typeof zhMessages[k]==='string');return key?zhMessages[key]:text;}
function applyLocaleChrome(){
 document.documentElement.lang=getLocale();document.title=UI_TEXT('爪爪日记')+' · '+UI_TEXT('让每一次成长都有迹可循');
 $('#locale-select').value=getLocale();$('#dialog-locale-select').value=getLocale();
 const labels={home:UI_TEXT('成长首页'),health:UI_TEXT('健康档案'),nearby:UI_TEXT('附近宠友'),community:UI_TEXT('社区日常')};
 for(const link of document.querySelectorAll('nav a'))link.querySelector('span:last-child').textContent=translate('nav.'+link.dataset.page);
 for(const element of document.querySelectorAll('.sidebar-label,.sidebar-note h3,.sidebar-note p,.skip-link,.breadcrumb')){
  if(element.classList.contains('breadcrumb'))continue;
  if(!element.dataset.uiSource)element.dataset.uiSource=canonicalUiText(element.textContent);element.textContent=UI_TEXT(element.dataset.uiSource);
 }
 document.querySelector('.breadcrumb').firstChild.textContent=UI_TEXT('我的宠物手账')+' ';
 const profile=document.querySelector('#about-button span:nth-child(2)');profile.firstChild.textContent=UI_TEXT('我的成长手账');profile.querySelector('small').textContent=UI_TEXT(workspaceMode==='demo'?'本地体验版':workspaceMode==='local'?'本地档案':'云端档案');
 document.querySelector('nav').setAttribute('aria-label',UI_TEXT('主导航'));$('#close-dialog').setAttribute('aria-label',UI_TEXT('关闭弹窗'));$('#workspace-controls').setAttribute('aria-label',UI_TEXT('档案空间'));
 const badge=$('#workspace-badge');badge.textContent=UI_TEXT(workspaceMode==='demo'?UI_TEXT('示例体验'):workspaceMode==='local'?UI_TEXT('本地档案'):UI_TEXT('云端档案'));
 const footer=document.querySelector('footer');footer.firstChild.textContent=UI_TEXT('每一个普通的日子，都值得被记住。');footer.querySelector('span').textContent=UI_TEXT(workspaceMode==='demo'?UI_TEXT('示例内容 · 新增数据仅保存在当前浏览器'):workspaceMode==='local'?UI_TEXT('个人资料仅保存在当前浏览器'):UI_TEXT('个人健康与照片私有保存'));
}
function localizeOpenDialog(){
 if(!dialog.open)return;const title=$('#dialog-title');title.textContent=UI_TEXT(title.dataset.uiSource??canonicalUiText(title.textContent));const body=$('#dialog-body');refreshStage3Copy(body);for(const form of body.querySelectorAll('form'))form.__pawLocaleRefresh?.();unifiedRecordDialog?.refreshLocale?.();if(body.querySelector('#assistant-form,#recap-share-form')||(body.querySelector('#ai-entry-form')&&!body.querySelector('#unified-record-dialog')))return;if(body.querySelector('[data-account-form]')||body.querySelector('#account-login-form')||body.querySelector('#email-login-form')||body.querySelector('#account-actions-form')){accountUI?.refreshLocale();return;}
 for(const el of body.querySelectorAll('.field>span,.form-tip,.form-actions button,.demo-note,[data-ui-copy],option')){
  if(el.closest('#ai-entry-form')||el.closest('.type-catalog'))continue;
  if(el.tagName==='OPTION'&&/^(custom:|historical:)/.test(el.value))continue;
  if(el.tagName==='OPTION'&&el.closest('select')?.name==='city')continue;
  if(el.tagName==='OPTION'&&!el.hasAttribute('value'))el.setAttribute('value',el.value);
  if(el.children.length&&el.tagName!=='BUTTON')continue;
  if(!el.dataset.uiSource)el.dataset.uiSource=canonicalUiText(el.textContent.trim());
  if(el.tagName==='BUTTON'&&el.querySelector('svg')){const label=el.dataset.uiSource;el.innerHTML=icon('check')+' '+esc(UI_TEXT(label));}else el.textContent=UI_TEXT(el.dataset.uiSource);
 }
 for(const el of body.querySelectorAll('[placeholder],[aria-label]'))for(const attr of ['placeholder','aria-label'])if(el.hasAttribute(attr)){const key='ui'+attr.replace('-','');if(!el.dataset[key])el.dataset[key]=canonicalUiText(el.getAttribute(attr));el.setAttribute(attr,UI_TEXT(el.dataset[key]));}
 accountUI?.refreshLocale();
}
function workspaceControls(){
 const description=workspaceMode==='demo'?UI_TEXT('这是示例档案，你也可以不登录开始记录自己的宠物。'):workspaceMode==='local'?UI_TEXT('资料保存在此浏览器；需要跨设备时再登录，迁移前会由你确认。'):UI_TEXT('云端档案仅自己可见；本地资料不会自动上传。');
 $('#workspace-controls').innerHTML=UI_HTML`<p>${esc(UI_TEXT(description))}</p><div class="workspace-actions">${workspaceMode==='local'?button(UI_TEXT('看看示例'),'workspace-demo','secondary','paw'):button(UI_TEXT('开始记录我的宠物'),'workspace-local','secondary','paw')}${button(workspaceMode==='account'?UI_TEXT('我的账号'):UI_TEXT('登录与云同步'),'account','secondary','community')}</div>`;
 applyLocaleChrome();
}
function getLocalRepository(mode){
 if(!localRepositories.has(mode)){localRepositories.set(mode,mode==='demo'?createDemoRepository({storage:localStorage}):createLocalRepository());}
 return localRepositories.get(mode);
}
function clearAvatarUrls(){for(const item of avatarUrls.values())item.release();avatarUrls.clear();}
async function refreshAvatarViews(){
 if(!repository?.media||!state)return;const gen=session.generation;const current=repository;
 for(const p of state.pets){if(!p.avatarAssetId||avatarUrls.has(p.avatarAssetId))continue;try{const result=await current.media.resolveUrl(p.avatarAssetId);if(session.generation!==gen){result.release();continue;}avatarUrls.set(p.avatarAssetId,result);for(const image of document.querySelectorAll('img[data-avatar-asset]'))if(image.dataset.avatarAsset===p.avatarAssetId)image.src=result.url;}catch{/* image placeholder retains retry through reload */}}
}
function maintainPhotoWall(){
 if(!state||!pet()||workspaceMode==='demo'||!['home','health'].includes(page)){photoWall?.destroy();photoWall=null;photoHost=null;photoPetId=null;return;}
 const old=photoHost;const container=$('#main .photo-wall-panel');if(!container)return;
 if(!photoWall){photoHost=document.createElement('div');photoHost.className='photo-wall-host';container.append(photoHost);photoWall=createPhotoWall({media:repository.media,getPetId:()=>pet()?.id,getGeneration:()=>session.generation,getRevision:()=>repository.getRevision(),t:translate,onChanged:async()=>{await session.load();syncState();render();},onError:e=>toast(localizeError(e)),document});photoPetId=pet().id;photoWall.mount(photoHost).catch(e=>toast(localizeError(e)));}
 else {container.append(old);if(photoPetId!==pet().id){photoPetId=pet().id;photoWall.render().catch(e=>toast(localizeError(e)));}}
}
function accountBoundaryError(code='WORKSPACE_CHANGED'){
 return Object.assign(new Error(code),{code,messageKey:code==='UNAUTHENTICATED'?'errors.unauthenticated':'errors.workspace.changed'});
}
function handleAuthIdentityChange(principal){
 const next=principal?.userId?{userId:principal.userId}:null,previous=authPrincipal?.userId;
 assignAuthPrincipal(next);
 if(workspaceMode!=='account'||previous===next?.userId){if(previous!==next?.userId&&(page==='profile'||PUBLIC_CONFIG.communityEnabled&&['community','nearby'].includes(page)))render();return;}
 // Invalidate visible ownership and drafts synchronously; never carry A's form into B.
 saving=false;dirty=false;if(dialog.open)closeModal(true);$('#dialog-body').replaceChildren();state=null;loadError=null;
 const transition=workspaceTransition+1;return switchWorkspace(next?'account':'local',{force:true}).catch(error=>{if(workspaceTransition!==transition||authPrincipal?.userId!==next?.userId)return;if(workspaceMode==='account'){assignAuthPrincipal(null);switchWorkspace('local',{force:true}).catch(()=>{});}toast(localizeError(error));});
}
function expireCurrentAccount(bound,owner,generation){
 if(repository!==bound||workspaceMode!=='account'||authPrincipal?.userId!==owner.userId||session?.generation!==generation)return false;
 reauthRequiredOwners.add(owner.userId);handleAuthIdentityChange(null);return true;
}
function boundCloudRepository(principal){
 const owner={userId:principal.userId};let bound;
 bound=createCloudRepository({principal:owner,invoke:async request=>{
  const generation=session?.generation;
  if(repository!==bound||workspaceMode!=='account'||authPrincipal?.userId!==owner.userId)throw accountBoundaryError();
  // Read the current raw-verified SDK session immediately before every transport.
  // An unavailable check preserves the same-owner form; a confirmed UID change clears it.
  let authorization;try{authorization=await auth.getRequestSession();if(!authorization&&repository===bound&&session?.generation===generation)authorization=await auth.getRequestSession();}catch(error){if(error.code==='UNAUTHENTICATED')expireCurrentAccount(bound,owner,generation);throw error;}
  if(repository!==bound||workspaceMode!=='account'||session?.generation!==generation)throw accountBoundaryError();
  if(authorization?.principal?.userId!==owner.userId||authorization?.principal?.userId!==authPrincipal?.userId){handleAuthIdentityChange(authorization?.principal??null);throw accountBoundaryError(authorization?'WORKSPACE_CHANGED':'UNAUTHENTICATED');}
  if(repository!==bound||workspaceMode!=='account'||session?.generation!==generation)throw accountBoundaryError();
  const isFileAction=/^(attachments|imports)\./.test(request.action),functionCall=cloudApp.callFunction({name:isFileAction?'paw-files':PUBLIC_CONFIG.functionName,data:{...request,authToken:authorization.authToken}});
  let timer;const result=isFileAction?await Promise.race([functionCall,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('File operation timed out'),{code:'UNAVAILABLE'})),35000);})]).finally(()=>clearTimeout(timer)):await functionCall;
  if(repository!==bound||authPrincipal?.userId!==owner.userId||session?.generation!==generation)throw accountBoundaryError();
  const response=typeof result.result==='string'?JSON.parse(result.result):result,reply=response?.result??response;
  if(reply?.ok===false&&reply.error?.code==='UNAUTHENTICATED'){expireCurrentAccount(bound,owner,generation);throw accountBoundaryError('UNAUTHENTICATED');}
  return response;
 }});return bound;
}
async function switchWorkspace(mode,{newPet=false,fromLogin=false,force=false}={}){
 if(dialog.open&&!fromLogin){if(force)closeModal(true);else if(!closeModal(false,()=>switchWorkspace(mode,{newPet,fromLogin,force}).catch(error=>toast(localizeError(error)))))return false;}
 const transition=++workspaceTransition;
 stage3Assistant?.reset();
 photoWall?.destroy();photoWall=null;photoHost=null;photoPetId=null;clearAvatarUrls();
 const next=mode==='account'?boundCloudRepository(authPrincipal):getLocalRepository(mode);
 workspaceMode=mode;repository=next;loadError=null;state=null;recordPetIds=null;recordPetSelectionManual=false;management=transitionManagement(management,{type:'EXIT'});
 if(!session){session=createAppSession(next);render();await session.load();}
 else {const loading=session.switchWorkspace({mode,repository:next,principal:mode==='account'?authPrincipal:null});render();await loading;}
 if(transition!==workspaceTransition||repository!==next)return false;
 syncState();localStorage.setItem('paw-diary:workspace-mode',mode);render();
 if(newPet&&!pet())petModal(true);return true;
}
function initCloudAccount(){
 if(!PUBLIC_CONFIG.enabled)return null;
 if(auth)return auth;
 cloudApp=cloudbase.init({env:PUBLIC_CONFIG.environmentId,region:PUBLIC_CONFIG.region,accessKey:PUBLIC_CONFIG.publishableKey});auth=createCloudbaseAuth({app:cloudApp,invokeAuth:async request=>{const result=await cloudApp.callFunction({name:'paw-auth',data:request});if(result?.code&&![0,'0','SUCCESS'].includes(result.code))throw Object.assign(new Error('Auth transport unavailable'),{code:'UNAVAILABLE'});return typeof result.result==='string'?JSON.parse(result.result):result.result;}});
 accountUI=createAccountUI({auth,getGeneration:()=>session.generation,modal,closeModal,onSignedIn:async principal=>{const current=await auth.getRequestSession();if(current?.principal?.userId!==principal.userId)throw accountBoundaryError();assignAuthPrincipal(principal);await switchWorkspace('account',{fromLogin:true});if(workspaceMode==='account'&&authPrincipal?.userId===principal.userId)reauthRequiredOwners.delete(principal.userId);if(communityContinuation?.kind==='login')continueCommunityDraft();},onSignedOut:async()=>{communityContinuation=null;communityHandoff.clear();assignAuthPrincipal(null);if(workspaceMode!=='local')await switchWorkspace('local',{force:true});},onImportLocal:()=>openCloudMigration(),t:translate,document,onError:e=>toast(localizeError(e))});
 restoreAuthUnsubscribe=auth.subscribe(handleAuthIdentityChange);return auth;
}
async function openAccount(){
 const originRepository=repository,originGeneration=session?.generation;
 try{if(!initCloudAccount()){modal(UI_TEXT('登录与云同步'),UI_HTML`<div class="profile-details"><p data-ui-copy>云服务尚在验证中。你可以继续本地记录，资料不会自动上传。</p><p data-ui-copy>只开放实际验收通过的邮箱登录。</p></div><div class="form-actions"><button class="button" data-action="close">继续本地记录</button></div>`);return;}
  const principal=await auth.getSession();if(repository!==originRepository||session?.generation!==originGeneration)return;
  if(principal&&reauthRequiredOwners.has(principal.userId)){accountUI.openLogin();return;}
  if(principal&&(workspaceMode!=='account'||authPrincipal?.userId!==principal.userId)){assignAuthPrincipal(principal);if(!await switchWorkspace('account'))return;}
  await accountUI.openAccount();
 }catch(error){
  if(repository!==originRepository||session?.generation!==originGeneration)return;
  if(error.code==='UNAUTHENTICATED'&&accountUI){if(workspaceMode==='account'&&authPrincipal)expireCurrentAccount(repository,authPrincipal,session.generation);accountUI.openLogin();return;}
  toast(localizeError(error));
 }
}
async function avatarModal(petId){
 if(workspaceMode==='demo'){toast(UI_TEXT('请先进入自己的本地档案，再上传私有照片。'));return;}
 const parent=session.snapshot().pets.find(p=>p.id===petId&&p.deletedAt===null);if(!parent)return;
 if(!modal(UI_TEXT('更换宠物头像'),UI_HTML`<form id="avatar-form">${field(UI_TEXT('选择照片'),'<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required>')}<p class="form-tip">支持 JPG / PNG / WebP，最大10MiB，保存用于展示的压缩图片。</p>${formActions(UI_TEXT('保存头像'))}</form>`))return;
 const form=$('#avatar-form'),input=form.querySelector('[name=avatar]');form.__pawContext.petId=petId;
 let choice=0,lastIntent=null,preparedFile=null,preparedImage=null;
 input.addEventListener('change',()=>{choice++;preparedFile=null;preparedImage=null;});
 form.addEventListener('submit',async e=>{e.preventDefault();const context=form.__pawContext;if(saving||!form.isConnected||context.generation!==session.generation)return;const file=input.files[0],selectedChoice=choice;input.disabled=true;
  try{await submitOperation(form,async repo=>{
   if(preparedFile!==file||!preparedImage){preparedImage=await processImage(file,{kind:'avatar'});preparedFile=file;}
   const digest=await crypto.subtle.digest('SHA-256',await preparedImage.blob.arrayBuffer()),sha256=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(context.generation!==session.generation||!form.isConnected||selectedChoice!==choice)throw accountBoundaryError();
   const intent=JSON.stringify({petId:context.petId,kind:'avatar',choice:selectedChoice,sha256});if(intent!==lastIntent){lastIntent=intent;context.operationId=uid();}
   return repo.media.save({petId:context.petId,kind:'avatar',blob:preparedImage.blob,preparedImage,caption:'',baseRevision:context.baseRevision,operationId:context.operationId});
  },UI_TEXT('头像已保存。'));}finally{if(form.isConnected&&context.generation===session.generation)input.disabled=false;}
 });
}

let page='home',healthFilter='all',healthFrom='',healthTo='',reminderFilter='pending',nearbyFilter='all',communityFilter='all',postSearch='';
let modalOrigin=null,dirty=false,saving=false,toastTimer;
let helpPanel=null,whatsNewPanel=null,guidedTour=null,helpCoordinator=null,installController=null,updateMonitor=null,installPanel=null,helpBootReady=false,helpEvaluationQueued=false;
let management={petManage:false,reminderManage:false,selectedPetIds:[],selectedReminderIds:[]};
let draggedPetId=null,recordPetIds=null,recordPetSelectionManual=false,petSorter=null;
const $=selector=>document.querySelector(selector);
const dialog=$('#dialog');

function helpIdentity(){return uiIdentityKey({userId:authPrincipal?.userId});}
function interactionState(){return {dialogOpen:!!document.querySelector('dialog[open]:not(.readonly-dialog)'),dirty:!!dirty,saving:!!saving||busyActions.size>0,aiSaving:!!dialog.querySelector('[data-ai-saving]'),publicDirty:!!publicSurface?.hasUnsavedChanges?.(),publicSaving:!!publicSurface?.isSaving?.(),photoDirty:!!photoWall?.hasUnsavedChanges?.(),photoSaving:!!photoWall?.isSaving?.(),transitioning:!helpBootReady||!state&&!loadError};}
function queueHelpEvaluation(){if(!helpCoordinator||helpEvaluationQueued)return;helpEvaluationQueued=true;queueMicrotask(()=>{helpEvaluationQueued=false;helpCoordinator?.evaluate();});}
function captureHelpView(){return {identity:helpIdentity(),page,scrollX:window.scrollX,scrollY:window.scrollY,focus:token(document.activeElement),healthFilter,healthFrom,healthTo,reminderFilter,recordPetIds:recordPetIds?[...recordPetIds]:null,recordPetSelectionManual,management:structuredClone(management)};}
function restoreHelpView(view){if(!view||view.identity!==helpIdentity())return;page=view.page;healthFilter=view.healthFilter;healthFrom=view.healthFrom;healthTo=view.healthTo;reminderFilter=view.reminderFilter;recordPetIds=view.recordPetIds?new Set(view.recordPetIds):null;recordPetSelectionManual=view.recordPetSelectionManual;management=structuredClone(view.management);history.replaceState(null,'',`#${page}`);render();window.scrollTo({left:view.scrollX,top:view.scrollY,behavior:'instant'});restoreFocus(view.focus);}
function enterHelpHome(){page='home';history.replaceState(null,'','#home');render();window.scrollTo({top:0,behavior:'instant'});}
function markHelpTargets(){
 const map={pets:'#main .pet-hero, #main .empty-health',record:'#main [data-action="record"]',reminders:'#main .home-reminders',recap:'#main .home-recap'};
 for(const [id,selector]of Object.entries(map)){const node=document.querySelector(selector);if(node)node.dataset.tour=id;}
 if(page==='home'&&!$('#main [data-help-home]')){const host=document.createElement('p');host.className='home-help-link';host.dataset.helpHome='';const button=document.createElement('button');button.type='button';button.className='text-button';button.textContent=getLocale()==='en'?'Help and beginner guide':'使用帮助与新手指引';button.onclick=()=>helpPanel?.open();host.append(button);$('#main').append(host);}
}
function openInstallHelp(){
 installPanel??=createReadonlyDialog({document,id:'install-help-dialog',className:'install-help-dialog'});
 const en=getLocale()==='en',copy=(zh,english)=>en?english:zh,d=installPanel.dialog;
 d.innerHTML=`<h2 id="install-help-title" tabindex="-1">${copy('添加到你的设备','Add to your device')}</h2><p>${copy('从桌面或主屏幕便捷启动，仍是同一个网址。','Start from your desktop or home screen using the same website.')}</p><p class="install-data-note">${copy('本地档案属于当前浏览器，安装窗口可能有独立数据。需要同一份资料时，请登录云端，或先导出备份再在新窗口恢复。卸载或清除网站数据前请备份。','Local records belong to this browser. Installed windows may use separate storage. Sign in to your cloud account, or export a backup and restore it in the new window. Back up before uninstalling or clearing website data.')}</p><ol class="install-platforms"><li><strong>Windows · Edge / Chrome</strong><p>${copy('打开浏览器菜单，找到“应用／安装此网站”。安装后从开始菜单启动；删除时在浏览器的应用管理中卸载。','Open the browser menu and choose Apps / Install this site. Launch it from Start, and uninstall using the browser app manager.')}</p></li><li><strong>iPhone · Safari</strong><p>${copy('点击分享 → 添加到主屏幕；若有“作为网页App打开”，请开启，再点添加。从主屏幕图标打开。','Tap Share → Add to Home Screen. Enable Open as Web App if shown, then Add. Open its home-screen icon.')}</p></li><li><strong>Mac · Safari / Chrome</strong><p>${copy('Safari在支持的系统上选择文件 → 添加到Dock；Chrome使用安装菜单。Safari安装窗口不共享原浏览器本地档案。','In supported Safari versions choose File → Add to Dock; in Chrome use the installation menu. A Safari web app does not share local records with the browser.')}</p></li></ol><p>${copy('云同步、AI和社区需要网络；安装不提供系统通知。','Cloud sync, AI and community need a connection. Installation does not add system notifications.')}</p><div class="form-actions"><button type="button" class="button secondary" data-install-close>${copy('返回','Back')}</button><button type="button" class="button" data-install-prompt>${copy('安装','Install')}</button></div>`;
 d.setAttribute('aria-labelledby','install-help-title');d.lang=getLocale();
 const prompt=d.querySelector('[data-install-prompt]'),state=installController.getState();prompt.hidden=state==='manual';prompt.disabled=state==='installed';if(state==='installed')prompt.textContent=copy('已添加','Added');
 prompt.onclick=async()=>{prompt.disabled=true;await installController.requestInstall();openInstallHelp();};d.querySelector('[data-install-close]').onclick=()=>installPanel.close();installPanel.open();
}
function initializeHelp(){
 $('#dialog-help-button').textContent=getLocale()==='en'?'Help':'帮助';
 let storage=null;try{storage=localStorage;}catch{}
 const preferences=createUiPreferences({storage});
 guidedTour=mountGuidedTour({document,t:translate,getLocale,getIdentity:helpIdentity,isBlocked:()=>isInteractionBlocked(interactionState()),captureView:captureHelpView,enterHome:enterHelpHome,restoreView:restoreHelpView,onStatus:(status,identity)=>preferences.setTourStatus(identity,status)});
 whatsNewPanel=mountWhatsNew({document,t:translate,getLocale,onAcknowledge:()=>{void helpCoordinator?.acknowledge();},onDismiss:()=>helpCoordinator?.dismiss()});
 helpPanel=mountHelp({document,t:translate,getLocale,onTour:()=>{if(isInteractionBlocked(interactionState()))return false;helpPanel.close();void guidedTour.start({source:'manual'});return true;},onInstall:openInstallHelp,onWhatsNew:()=>helpCoordinator.openManually()});
 helpCoordinator=createHelpCoordinator({release:PUBLIC_CONFIG.release,previewEnabled:PUBLIC_CONFIG.helpPreview,preferences,getIdentity:helpIdentity,getInteractionState:interactionState,showWhatsNew:release=>whatsNewPanel.open(release),closeWhatsNew:()=>whatsNewPanel.close(),startTour:options=>guidedTour.start(options)});
 installController=createInstallController({window,navigator,onState:()=>{if(installPanel?.isOpen())openInstallHelp();}});
 const banner=document.createElement('button');banner.id='update-available';banner.type='button';banner.className='button secondary update-available';banner.hidden=true;document.querySelector('.top-actions').prepend(banner);
 updateMonitor=createUpdateMonitor({currentRelease:PUBLIC_CONFIG.release,getInteractionState:interactionState,baseUrl:location.href,reload:()=>location.reload(),onUpdate:release=>{banner.hidden=!release;banner.textContent=getLocale()==='en'?'Update available':'新版可用';}});
 banner.onclick=()=>{if(updateMonitor.requestReload()==='blocked')toast(getLocale()==='en'?'Save or close your current edit before updating.':'请先保存或关闭当前编辑，再更新。');};
 document.addEventListener('close',queueHelpEvaluation,true);document.addEventListener('input',queueHelpEvaluation);document.addEventListener('change',queueHelpEvaluation);
}

// 页面只读取可见资料；持久化、JSON备份和回收站始终读取完整V3。
function syncState(){
  const s=session.snapshot(); if(!s){state=null;return;}if(workspaceMode==='demo')assertDemoTypes(s);
  const visible=visibleHealth(s),previousPetId=state?.activePet;
  state={...s,...visible,activePet:visible.activePetId,city:s.profile.city,
    pets:visible.pets.map(p=>({...p,arrival:p.arrivalDate,image:avatarUrls.get(p.avatarAssetId)?.url??p.image})),
    records:visible.records.map(r=>({...r,date:r.occurredDate,createdAt:Date.parse(r.createdAt)})),posts:workspaceMode==='demo'?s.posts:createSeedState().posts};
  if(previousPetId!==state.activePet){guidedTour?.stop({reason:'pet'});management=transitionManagement(management,{type:'PET_CHANGED'});}
  management=transitionManagement(management,{type:'ENTITIES_CHANGED',petIds:state.pets.map(p=>p.id),reminderIds:petReminders(reminderFilter).map(r=>r.id)});
}
function pet(){return state?.pets.find(p=>p.id===state.activePet)||state?.pets[0];}
function petRecords(){return (state?.records||[]).filter(r=>r.petId===pet()?.id).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);}
function filteredRecords(){const full=session.snapshot();if(!recordPetIds||!recordPetSelectionManual)recordPetIds=initialPetSelection(full);return growthEntries(full,{petIds:recordPetIds,type:healthFilter,dateRange:{from:healthFrom,to:healthTo}});}
function recordPetFilterHTML(){if(state.pets.length<2)return '';return `<fieldset class="record-pet-filter"><legend>${esc(getLocale()==='en'?'Pets in this list':'筛选列表中的宠物')}</legend>${state.pets.map(p=>`<label><input type="checkbox" name="record-pet-filter" value="${esc(p.id)}" ${recordPetIds?.has(p.id)?'checked':''}> ${esc(p.name)}</label>`).join('')}</fieldset>`;}
function weights(){return petRecords().filter(r=>r.type==='weight').sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt);}
function latestWeight(){return weights().at(-1)?.value;}
function recordTitle(r){return r.kind==='plan'?r.title:r.type==='weight'?UI_HTML`体重记录 · ${r.value} kg`:(r.title||types[r.type]?.label||UI_TEXT('成长记录'));}
function petReminders(status='pending'){return (state?.reminders||[]).filter(r=>r.petId===pet()?.id&&isHealthTodo(r,{records:state.records})&&(status==='all'||r.status===status)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));}
function pending(){return petReminders();}
function ageText(p){if(!p.birthday)return p.estimatedAgeMonths===null?UI_TEXT('年龄待补充'):UI_HTML`约${Math.floor(p.estimatedAgeMonths/12)}岁${p.estimatedAgeMonths%12}个月`;const days=Math.max(0,-dayDiff(p.birthday));return UI_HTML`${Math.floor(days/365)}岁${Math.floor(days%365/30)}个月`;}
function empty(title,text,action=''){return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;}
function button(label,action,kind='',ico='plus'){return `<button type="button" class="button ${kind}" data-action="${action}">${icon(ico)}${esc(label)}</button>`;}
function heading(title,subtitle,action=''){return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${subtitle}</p></div>${action}</div>`;}
function img(src,alt,cls='',assetId=null){
 const resolved=assetId?avatarUrls.get(assetId)?.url:src;
 if(!resolved&&!assetId)return `<span class="neutral-avatar ${cls}" role="img" aria-label="${esc(alt||UI_TEXT('宠物头像'))}">${icon('paw')}</span>`;
 const placeholder='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#edf3e9"/><g fill="#43674b"><ellipse cx="60" cy="76" rx="20" ry="16"/><ellipse cx="32" cy="45" rx="9" ry="12"/><ellipse cx="53" cy="30" rx="9" ry="12"/><ellipse cx="77" cy="33" rx="9" ry="12"/><ellipse cx="94" cy="51" rx="9" ry="12"/></g></svg>');
 return `<img class="${cls}" src="${esc(resolved||placeholder)}" alt="${esc(alt)}" ${assetId?`data-avatar-asset="${esc(assetId)}"`:''} width="1000" height="750">`;
}

function token(el){return el?.id?{id:el.id}:el?.dataset?.action?{action:el.dataset.action,id:el.dataset.id,value:el.dataset.value}:el?.name?{name:el.name,value:el.value}:el?.dataset?.petDrag?{petDrag:el.dataset.petDrag}:null;}
function restoreFocus(t){
  const selector=t?.name?`[name="${CSS.escape(t.name)}"][value="${CSS.escape(t.value)}"]`:t?.petDrag?`[data-pet-drag="${CSS.escape(t.petDrag)}"]`:t?.id&& !t.action?`#${CSS.escape(t.id)}`:t?.action?`[data-action="${CSS.escape(t.action)}"]${t.id?`[data-id="${CSS.escape(t.id)}"]`:''}${t.value?`[data-value="${CSS.escape(t.value)}"]`:''}`:null;
  const target=selector?[...document.querySelectorAll(selector)].find(e=>e.getClientRects().length&&!e.disabled):null;
  (target||$('#main')).focus({preventScroll:true});
}
function render({focus=false}={}){
  petSorter?.destroy();petSorter=null;
  const activePhotoElement=photoHost?.contains(document.activeElement)?document.activeElement:null;const previous=token(document.activeElement);
  const publicPage=page==='profile'||PUBLIC_CONFIG.communityEnabled&&['community','nearby'].includes(page);if(!publicPage&&publicSurface)clearPublicSurface();
  if(publicPage){renderPublicProfile();}
  else if(loadError){$('#main').innerHTML=heading(UI_TEXT('暂时无法读取档案'),UI_TEXT('原始数据已保留，没有替换为示例。'))+UI_HTML`<section class="panel recovery-panel"><p>${esc(loadError.message)}</p><div class="recovery-actions">${button(UI_TEXT('导出原始数据'),'raw-export','secondary','download')}${button(UI_TEXT('恢复备份'),'import','secondary','book')}${button(UI_TEXT('重试读取'),'retry')}</div><p class="demo-note">可先导出原始文件，再选择有效备份恢复；恢复前会预览并保留原始字符串。</p></section>`;}
  else if(!state){$('#main').innerHTML=heading(UI_TEXT('正在读取档案…'),UI_TEXT('请稍等，保留已有数据。'));}
  else if(!pet()&&['home','health'].includes(page)){$('#main').innerHTML=heading(UI_TEXT('认识你的毛孩子'),UI_TEXT('先建一份宠物档案，开始记录。'),button(UI_TEXT('添加一只宠物'),'new-pet'))+`<section class="panel empty-health">${empty(UI_TEXT('还没有宠物档案'),UI_TEXT('可以添加宠物，或从回收站恢复原有档案。'))}<div class="data-actions">${button(UI_TEXT('回收站'),'trash','secondary','book')}${button(UI_TEXT('导出备份'),'export','secondary','download')}${button(UI_TEXT('恢复备份'),'import','secondary','book')}</div></section>`;}
  else $('#main').innerHTML=({home:homeHTML,health:healthHTML,nearby:nearbyHTML,community:communityHTML}[page])();
  $('#page-label').textContent=({home:UI_TEXT('成长首页'),health:UI_TEXT('健康档案'),nearby:UI_TEXT('附近宠友'),community:UI_TEXT('社区日常'),profile:getLocale()==='en'?'Personal profile':'个人资料'})[page];
  $('#city-label').textContent=publicPage?(communityBrowseRegion.cityName??(getLocale()==='en'?'Choose a city':'选择城市')):state?.city||UI_TEXT('选择城市');$('#city-button').disabled=page==='profile'||(!publicPage&&!state);
  document.querySelectorAll('nav a').forEach(a=>{const active=a.dataset.page===page;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(state&&pet()&&workspaceMode!=='demo'&&['home','health'].includes(page)){$('#main').insertAdjacentHTML('beforeend',UI_HTML`<section class="panel photo-wall-panel"><h2>我们的照片墙</h2><p class="photo-wall-description">当前宠物的私有照片；保存展示版，原图请在设备中另存。</p></section>`);}
  workspaceControls();maintainPhotoWall();refreshAvatarViews();maintainStage3();maintainSelects();updatePublicIdentityChrome();if(publicPage)document.querySelector('footer span').textContent=getLocale()==='en'?'Health records stay private. You choose what to publish.':'健康档案始终私有，公开内容由你主动选择。';
  const sortHost=$('#main .pet-list');if(sortHost)petSorter=mountRowSort({root:sortHost,getIds:()=>state.pets.map(p=>p.id),onCommit:async ids=>{const gen=session.generation,current=repository;if(busyActions.has('reorder-pets'))return;busyActions.add('reorder-pets');try{await session.run(repo=>repo.reorderPets(ids));if(gen!==session.generation||current!==repository)return;syncState();render();toast(UI_TEXT('宠物顺序已保存。'));}finally{busyActions.delete('reorder-pets');}},onError:error=>toast(UI_TEXT('排序未成功：')+error.message)});
  if(activePhotoElement?.isConnected&&!dialog.open)activePhotoElement.focus({preventScroll:true});else if(focus)restoreFocus(null);else if(previous&&!dialog.open)restoreFocus(previous);
  markHelpTargets();guidedTour?.refresh();queueHelpEvaluation();
}
function route(){
  guidedTour?.stop({reason:'route'});
  const target=location.hash.slice(1);if(target==='main'){history.replaceState(null,'',`#${page}`);$('#main').focus();return;}
  if(target!==page&&publicSurface?.isSaving?.()){history.replaceState(null,'',`#${page}`);toast(getLocale()==='en'?'Saving. Please wait.':'正在保存，请等待结果。');return;}
  if(target!==page&&publicSurface?.hasUnsavedChanges?.()){const generation=communityIdentityGeneration;history.replaceState(null,'',`#${page}`);discardConfirmation.ask(accepted=>{if(accepted&&generation===communityIdentityGeneration){clearPublicSurface();history.replaceState(null,'',`#${target}`);route();}});return;}
  if(dialog.open&&!closeModal(false,()=>{history.replaceState(null,'',`#${target}`);route();})){history.replaceState(null,'',`#${page}`);return;}
  page=['home','health','nearby','community','profile'].includes(target)?target:'home';recordPetIds=null;recordPetSelectionManual=false;management=transitionManagement(management,{type:'EXIT'});render({focus:true});window.scrollTo({top:0,behavior:'instant'});
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function modal(title,html,{recovery=false}={}){
  if(dialog.open){const trigger=lastModalTrigger;if(!closeModal(false,()=>{if(trigger?.isConnected)trigger.click();}))return false;}
  modalOrigin=token(document.activeElement);dirty=false;$('#dialog-title').dataset.uiSource=canonicalUiText(title);$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=html;$('#dialog-body').querySelectorAll('input,textarea').forEach(el=>{if(!el.hasAttribute('autocomplete'))el.autocomplete='off';});$('#dialog-body').querySelectorAll('form').forEach(form=>{form.__pawContext=recovery?{generation:session?.generation??0,petId:null,entityId:null,baseRevision:null,operationId:uid(),intent:null}:captureFormContext({repository,getGeneration:()=>session?.generation??0,petId:pet()?.id});});dialog.showModal();focusDialogTitle(dialog);return true;
}
let lastModalTrigger=null;
const discardConfirmation=createDiscardConfirm({getLocale});
document.addEventListener('click',event=>{if(!event.target.closest('#discard-dialog'))lastModalTrigger=event.target.closest('button,a');},true);
function closeModal(force=false,onDiscard=null,{userDismissed=false}={}){const userDismiss=!force||userDismissed;if(!force&&dialog.querySelector('[data-ai-saving]')){toast(UI_TEXT('正在保存，请等待结果后再关闭。'));return false;}if(!force&&(saving||dirty)){if(saving){toast(UI_TEXT('正在保存，请等待结果后再关闭。'));return false;}const generation=session?.generation;discardConfirmation.ask(accepted=>{if(accepted&&generation===session?.generation){closeModal(true,null,{userDismissed:userDismiss});onDiscard?.();}});return false;}if(force)discardConfirmation.dismiss();if(dialog.querySelector('#account-login-form')&&communityContinuation?.kind==='login'&&userDismiss){communityContinuation=null;communityHandoff.clear();}dialog.querySelector('form')?.__pawCleanup?.();dialog.querySelector('[data-readonly-ai]')?.__pawCleanup?.();dialog.close();if(dialog.querySelector('#unified-record-dialog')){unifiedRecordDialog?.destroy();unifiedRecordDialog=null;}dirty=false;restoreFocus(modalOrigin);return true;}
function field(label,html,full=false){return `<label class="field ${full?'full':''}"><span>${esc(label)}</span>${html}</label>`;}
function formActions(label=UI_TEXT('保存记录')){return UI_HTML`<p class="form-error" role="alert" hidden></p><div class="form-actions"><button type="button" class="button secondary" data-action="close">取消</button><button type="submit" class="button">${icon('check')} ${esc(label)}</button></div>`;}
function showFormError(form,error){const el=form?.querySelector('.form-error');const message=UI_TEXT('保存未成功：')+localizeError(error);if(error.code==='CONFLICT')showConflictReview(form);if(el){el.hidden=false;el.textContent=message;el.tabIndex=-1;el.focus();}else toast(message);}
async function submitOperation(form,operation,message,after){
  if(saving)return false;const submittedGeneration=session.generation;saving=true;const b=form.querySelector('[type=submit]'),label=b.innerHTML;b.disabled=true;b.textContent=UI_TEXT('正在保存…');
  try{const context=form.__pawContext??captureFormContext({repository,getGeneration:()=>session.generation,petId:pet()?.id});const result=await session.run(repo=>operation(bindFormRepository(repo,context,()=>session.generation)));syncState();loadError=null;try{await trackStage3Write(form,result);}catch{toast(S3('progressDeferred'));}syncState();closeModal(true);render();toast(message);if(after)after(result);return true;}
  catch(error){if(submittedGeneration===session.generation&&form.isConnected){if(error.code==='ATTACHMENT_PARTIAL'){await session.load();syncState();form.__pawContext.baseRevision=repository.getRevision?.()??form.__pawContext.baseRevision;const alert=form.querySelector('.form-error');alert.hidden=false;alert.textContent=error.message;}else showFormError(form,error);}return false;}
  finally{if(submittedGeneration===session.generation)saving=false;b.disabled=false;b.innerHTML=label;}
}
async function showConflictReview(form){
 if(!form||form.querySelector('.conflict-review'))return;
 const review=document.createElement('section');review.className='conflict-review';review.innerHTML=UI_HTML`<h3>资料已更新</h3><p>正在读取最新数据，当前输入仍保留。</p>`;form.append(review);
 try{await session.refresh();syncState();const context=form.__pawContext,full=session.snapshot(),candidate=context?.entityId?(full.records.find(r=>r.id===context.entityId)||full.reminders.find(r=>r.id===context.entityId)||full.pets.find(r=>r.id===context.entityId)):null;
 review.innerHTML=UI_HTML`<h3>资料已更新</h3><p>${esc(candidate?`${candidate.name||candidate.title} · ${candidate.occurredDate||candidate.dueDate||''} · ${candidate.note||''}`:UI_TEXT('档案中的其他内容发生了变化。'))}</p><p>当前输入没有被覆盖。确认后可按最新版本重试保存。</p><button type="button" class="button secondary" data-review-latest>保留输入，使用最新版本重试</button>`;
 review.querySelector('button').addEventListener('click',()=>{context.baseRevision=repository.getRevision();context.intent=null;review.remove();form.querySelector('.form-error').hidden=true;form.querySelector('[type=submit]').focus();});
 }catch(error){review.innerHTML=UI_HTML`<p>${esc(localizeError(error))}</p>`;}
}
async function update(mutator,form){try{await session.run(repo=>repo.mutate(mutator));syncState();return true;}catch(e){showFormError(form,e);return false;}}

function chartHTML(){
  const list=weights();if(!list.length)return empty(UI_TEXT('还没有体重记录'),UI_TEXT('记录第一次体重，开始看见成长。'),button(UI_TEXT('记一次体重'),'record-weight','secondary','weight'));
  const visible=list.slice(-8),values=visible.map(r=>r.value),min=Math.max(0,Math.floor(Math.min(...values)-1)),max=Math.ceil(Math.max(...values)+1),range=max-min||1;
  const span=dayDiff(visible.at(-1).date,visible[0].date),x=i=>visible.length===1?270:44+(span?dayDiff(visible[i].date,visible[0].date)/span:i/(visible.length-1))*440,y=v=>125-(v-min)/range*100;
  const points=visible.map((r,i)=>`${x(i)},${y(r.value)}`).join(' ');
  return UI_HTML`<div class="weight-summary"><strong>${values.at(-1)} <small>kg</small></strong><small>最近记录于 ${shortDate(visible.at(-1).date)}</small></div><svg class="chart" viewBox="0 0 520 150" role="img" aria-label="${esc(visible.map(r=>UI_HTML`${r.date}：${r.value}千克`).join('，'))}">${[min,(min+max)/2,max].map(v=>`<line x1="42" y1="${y(v)}" x2="494" y2="${y(v)}" stroke="#e8ede4" stroke-dasharray="3 5"/><text x="3" y="${y(v)+4}">${v.toFixed(1)}</text>`).join('')}<polygon points="${x(0)},125 ${points} ${x(visible.length-1)},125" fill="#edf3e9"/><polyline points="${points}" fill="none" stroke="#43674b" stroke-width="2.5"/>${visible.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.value)}" r="4" fill="#fff" stroke="#43674b" stroke-width="2"><title>${r.date} · ${r.value} kg</title></circle>`).join('')}</svg><div class="chart-label"><span>${shortDate(visible[0].date)}</span><span class="legend">体重 · kg</span><span>${shortDate(visible.at(-1).date)}</span></div>`;
}
function remindersHTML(summary=false){
  const list=petReminders(summary?'pending':reminderFilter),shown=summary?list.slice(0,4):list,managing=!summary&&management.reminderManage;
  return `<div class="reminder-list ${summary?'reminder-summary':'reminder-full'}" ${summary?'':UI_HTML`tabindex="0" role="region" aria-label="全部${list.length}项护理事项，可滚动查看"`}>`+(shown.length?shown.map(r=>{
    const days=dayDiff(r.dueDate),isPending=r.status==='pending',selected=management.selectedReminderIds.includes(r.id);
    const status=isPending?(days<0?UI_HTML`已逾期 ${-days} 天`:days===0?UI_TEXT('就是今天'):UI_HTML`${days} 天后`):r.status==='completed'?UI_TEXT('已完成'):UI_TEXT('已取消');
    return UI_HTML`<div class="reminder ${managing?'managed-reminder':''} ${managing&&selected?'is-selected':''}" data-reminder-id="${esc(r.id)}">${managing?UI_HTML`<label class="management-check"><input type="checkbox" name="managed-reminder" value="${esc(r.id)}" ${selected?'checked':''}><span class="sr-only">选择${esc(r.title)}</span></label>`:`<span class="event-icon ${isPending&&days<=7?'orange':''}">${icon('calendar')}</span>`}<div class="reminder-content"><h3>${esc(r.title)}</h3><p>${shortDate(r.dueDate)} · 手动设置${r.legacyCompletionUnknown?UI_TEXT(' · 旧版已完成，日期待核对'):r.completionRecordDeleted?UI_TEXT(' · 旧版关联记录已删除'):''}</p><span class="reminder-status">${esc(status)}</span>${!managing&&isPending?UI_HTML`<div class="reminder-actions"><button class="text-button" data-action="complete" data-id="${esc(r.id)}">记录完成</button>${summary?'':UI_HTML`<button class="text-button" data-action="edit-reminder" data-id="${esc(r.id)}">修改日期</button><button class="text-button danger-text" data-action="cancel-reminder" data-id="${esc(r.id)}">取消事项</button>`}</div>`:''}</div>${managing?`<button class="icon-button reminder-edit" data-action="edit-reminder" data-id="${esc(r.id)}" aria-label="${r.status==='completed'?UI_TEXT('查看'):UI_TEXT('编辑')}${esc(r.title)}">${icon('chevron')}</button>`:''}</div>`;
  }).join(''):empty(summary?UI_TEXT('暂时没有待办'):UI_TEXT('这里还没有事项'),summary?UI_TEXT('可以自己安排下一次护理日期。'):UI_TEXT('切换状态，或添加一个护理事项。')))+'</div>'+(summary?UI_HTML`<a class="text-button reminder-all" href="#health">查看全部 ${list.length} 项待办 ${icon('chevron')}</a>`:'');
}
function petListHTML(){
  return UI_HTML`<div class="pet-list" role="region" tabindex="0" aria-label="${state.pets.length}只宠物，可滚动查看">${state.pets.map((p,index)=>{
    const selected=management.selectedPetIds.includes(p.id),active=p.id===state.activePet;
    return `<div class="pet-entry ${active?'is-active':''} ${management.petManage&&selected?'is-selected':''}" data-id="${esc(p.id)}">${management.petManage?UI_HTML`<label class="management-check"><input type="checkbox" name="managed-pet" value="${esc(p.id)}" ${selected?'checked':''}><span class="sr-only">选择${esc(p.name)}</span></label>`:''}<button class="pet-drag" type="button" data-pet-drag="${esc(p.id)}" aria-label="${esc(getLocale()==='en'?'Reorder '+p.name:'排序'+p.name)}" title="${esc(getLocale()==='en'?'Drag row, or Space then arrow keys and Enter. Escape cancels.':'拖动整行；键盘空格开始、上下移动、回车确认、Esc取消。')}">${icon('drag')}</button><button class="pet-entry-main" data-action="select-pet" data-id="${esc(p.id)}" aria-label="${management.petManage?UI_TEXT('选择'):UI_TEXT('切换到')}${esc(p.name)}" ${management.petManage?`aria-pressed="${selected}"`:`aria-pressed="${active}"`}>${img(p.image,'','',p.avatarAssetId)}<span><strong>${esc(p.name)}${active?UI_HTML(['<small class="current-pet">当前宠物</small>']):''}</strong><small>${petTypeLabel(p)} · ${ageText(p)}</small></span></button>${management.petManage?UI_HTML`<button class="icon-button pet-edit" data-action="edit-pet" data-id="${esc(p.id)}" aria-label="编辑${esc(p.name)}的档案">${icon('chevron')}</button>`:''}</div>`;
  }).join('')}</div>`;
}
function managementToolbar(kind){
  const pets=kind==='pets',managing=pets?management.petManage:management.reminderManage,selected=pets?management.selectedPetIds:management.selectedReminderIds;
  if(!managing)return '';
  return UI_HTML`<div class="management-toolbar"><p class="selection-count" aria-live="polite">已选择 ${selected.length} ${pets?UI_TEXT('只宠物'):UI_TEXT('项事项')}</p><div class="management-actions"><button class="button secondary danger-text" data-action="${pets?'trash-pets':'trash-reminders'}" ${selected.length?'':'disabled'}>移入回收站</button>${pets?'':UI_HTML`<button class="button secondary" data-action="calendar" ${selected.length?'':'disabled'}>${icon('calendar')} 导出日历</button>`}</div>${pets?'':UI_HTML`<p class="demo-note">只导出待完成事项；导入系统日历后由日历设置通知。</p>`}</div>`;
}

function timelineHTML(limit=3){const list=growthEntries(session.snapshot(),{petIds:[pet()?.id],plans:'general'}).slice(0,limit);return list.length?`<ol class="timeline">${list.map(r=>`<li><span class="event-icon">${icon(r.iconKey??types[r.type]?.icon)}</span><div class="timeline-content"><h3>${esc(recordTitle(r))}<time datetime="${r.date}">${shortDate(r.date)}</time></h3><p>${esc(r.note||UI_TEXT('把今天的小小成长记下来。'))}</p><span class="small-badge">${esc(recordTypeLabel(r))}</span>${planBadge(r)}${r.kind==='plan'?`<div class="growth-plan-actions">${recordActions(r)}</div>`:''}</div></li>`).join('')}</ol>`:empty(UI_TEXT('时间线等你写下第一笔'),UI_TEXT('健康记录和日常瞬间都会出现在这里。'));}
function petSummary(){const p=pet();return UI_HTML`<section class="pet-hero"><div class="hero-copy"><button class="pet-picker" data-action="switch-pet">${icon('paw')} 我的毛孩子 ${icon('down')}</button><h2>你好呀，${esc(p.name)}。</h2><p>${p.arrival?UI_HTML`我们已经一起度过 ${Math.max(0,-dayDiff(p.arrival))} 个有你陪伴的日子。`:UI_TEXT('来到家的日期可以稍后补充。')}</p><div class="pet-tags"><span class="tag">${esc(p.breed||(petTypeLabel(p)))}</span><span class="tag">${ageText(p)}</span></div><button class="text-button" data-action="edit-pet">查看宠物档案 ${icon('chevron')}</button></div><div class="hero-image">${img(p.image,p.name+UI_TEXT('的宠物照片'),'',p.avatarAssetId)}<span class="hero-caption">一起长大，一直陪伴</span></div></section>`;}
function homeHTML(){return heading(UI_TEXT('每一天，都是成长。'),UI_HTML`和${esc(pet().name)}一起，把平凡的日子变成珍贵的回忆。`,button(UI_TEXT('记一笔'),'record'))+UI_HTML`<section class="panel onboarding-card" data-home-onboarding hidden></section><div class="home-grid care-home">${petSummary()}<section class="panel home-reminders"><div class="panel-title"><div><h2>接下来的小事</h2><p>日期由你设置，照顾按自己的节奏</p></div>${icon('calendar')}</div>${remindersHTML(true)}</section><div class="stats-strip"><div class="stat"><div class="stat-label">${icon('weight')} 最近体重</div><strong>${latestWeight()??'—'}<small>kg</small></strong><p>${weights().length?UI_TEXT('已记录 ')+weights().length+UI_TEXT(' 次'):UI_TEXT('等待第一次记录')}</p></div><div class="stat"><div class="stat-label">${icon('book')} 成长足迹</div><strong>${petRecords().length}<small>条</small></strong><p>记录平常的日子</p></div><div class="stat"><div class="stat-label">${icon('calendar')} 待办事项</div><strong>${pending().length}<small>项</small></strong><p>由你安排下一次</p></div></div><section class="panel home-chart"><div class="panel-title"><h2>体重的变化</h2><button class="text-button" data-action="record-weight">添加记录 ${icon('plus')}</button></div>${chartHTML()}</section><section class="panel home-recap"><div class="panel-title"><h2>${esc(UI_TEXT('成长回顾'))}</h2>${icon('book')}</div><div data-weekly-recap><p class="demo-note">${esc(UI_TEXT('依据已保存的记录，回看一起成长的日子。'))}</p></div></section><section class="panel home-timeline"><div class="panel-title"><h2>我们的成长时间线</h2><a href="#health" class="text-button">全部足迹 ${icon('chevron')}</a></div>${timelineHTML()}</section><section class="panel community-teaser">${img('assets/walk.jpg',UI_TEXT('两只狗狗一起玩耍'))}<div class="teaser-copy"><h3>快乐，也可以一起长大。</h3><p>探索同城宠友。</p><a href="#nearby" class="text-button">遇见附近的毛孩子 ${icon('chevron')}</a></div></section></div>`;}

let stage3Client,stage3Entry,stage3Onboarding,stage3Recap,stage3Assistant;
function stage3Scope(){return {repository,generation:session?.generation,mode:workspaceMode,workspaceId:repository?.getWorkspaceId?.(),petId:pet()?.id??null,ownerId:workspaceMode==='account'?authPrincipal?.userId:null};}
async function stage3Request(action,payload={}){
 if(!PUBLIC_CONFIG.aiEnabled)throw Object.assign(new Error('UNAVAILABLE'),{code:'UNAVAILABLE'});
 initCloudAccount();if(!cloudApp)throw Object.assign(new Error('UNAVAILABLE'),{code:'UNAVAILABLE'});
 stage3Client??=createAiClient({getScope:stage3Scope,getAuthorization:()=>auth?.getRequestSession(),invoke:data=>cloudApp.callFunction({name:PUBLIC_CONFIG.aiFunctionName,data})});
 const next={...payload};if(workspaceMode==='account')delete next.context;else if(action!=='ai.quota')next.context=createAiContext(session.snapshot(),pet()?.id??null);
 return stage3Client.request(action,next);
}
async function stage3Changed(){await session.load();syncState();render();}
function stage3Source(source){
 if(source.kind==='help'){const help=stage3Help(source);modal(S3('help'),`<div data-readonly-ai><h3>${esc(help.title)}</h3><p class="form-tip">${esc(help.text)}</p><div class="form-actions"><button type="button" class="button secondary" data-action="close">${esc(S3('close'))}</button></div></div>`);return;}
 const visible=visibleHealth(session.snapshot()),item=(source.kind==='record'?visible.records:visible.reminders).find(r=>r.id===source.id&&r.petId===pet()?.id);
 if(!item){toast(S3('changed'));return;}
 modal(S3('basis'),`<div data-readonly-ai><h3>${esc(item.title)}</h3><p>${esc(item.occurredDate||item.dueDate)}</p><p class="source-note">${esc(item.note||'')}</p><div class="form-actions"><a href="#health" class="button secondary" onclick="document.getElementById('dialog').close()">${esc(S3('viewHealth'))}</a><button type="button" class="button" data-action="close">${esc(S3('close'))}</button></div></div>`);
}
function maintainStage3(){
 if(!state||loadError||!session){document.getElementById('stage3-assistant-launcher')?.setAttribute('hidden','');return;}
 const common={request:stage3Request,getSnapshot:()=>session.snapshot(),getRepository:()=>repository,getScope:stage3Scope,getLocale,openModal:modal,onSource:stage3Source,onChanged:stage3Changed};
 stage3Onboarding??=createOnboarding({...common,onPet:()=>petModal(true),onRecord:()=>recordModal(),onReminder:()=>reminderModal(),onError:message=>toast(message)});
 stage3Entry??=createAiEntry({...common,separatePurposes:true,getTypeEntries:()=>catalogEntries(session.snapshot()).map(e=>({...e,name:e.builtin?types[e.type].label:e.name})),enhanceAll:maintainSelects,enhanceType:(select,{onCatalogUpdated})=>{const control=enhanceRecordTypeSelect(select,{getSnapshot:()=>session.snapshot(),getRepository:()=>repository,onUpdated:async(latest,{revision,priorRevision}={})=>{await session.load();syncState();onCatalogUpdated(revision,priorRevision);},icons:icon,getLocale});selectControllers.set(select,control);return control;},onSaved:async result=>{await session.load();syncState();const ids=result.records.filter(r=>r.petId===pet()?.id).map(r=>r.id);try{if(ids.length)await stage3Onboarding.noteSaved({type:'RECORDS_SAVED',recordIds:ids});}catch{toast(S3('progressDeferred'));}await session.load();syncState();closeModal(true);render();toast(S3('saved'));}});
 stage3Recap??=createWeeklyRecap({...common,getPublicationScope:communitySession,onCommunityShare:(draft,{scope}={})=>{if(workspaceMode==='demo')return;if(!scope||(scope.userId??null)!==(authPrincipal?.userId??null)||scope.generation!==communityIdentityGeneration){closeModal(true);$('#dialog-body').replaceChildren();toast(getLocale()==='en'?'Your account changed. Open a new share preview.':'账号已切换，请重新打开分享预览。');return;}closeModal(true);communityDraftQueue.stage(draft);location.hash='community';if(page==='community'){clearPublicSurface();render();}}});stage3Assistant??=createAssistantPanel(common);stage3Assistant.syncScope();
 if(page==='home'){
  let host=document.querySelector('[data-home-onboarding]');if(!host){const emptyHost=document.querySelector('.empty-health');if(emptyHost){emptyHost.insertAdjacentHTML('afterbegin','<div class="onboarding-card" data-home-onboarding hidden></div>');host=emptyHost.querySelector('[data-home-onboarding]');}}
  stage3Onboarding.mount(host);const recapHost=document.querySelector('[data-weekly-recap]');if(recapHost)stage3Recap.mount(recapHost);
 }
 let launcher=document.getElementById('stage3-assistant-launcher');if(!launcher){launcher=document.createElement('button');launcher.id='stage3-assistant-launcher';launcher.type='button';launcher.className='button assistant-launcher';launcher.dataset.action='open-assistant';document.body.append(launcher);}launcher.hidden=!PUBLIC_CONFIG.aiEnabled;launcher.innerHTML=icon('comment')+' '+esc(S3('assistant'));
}
async function trackStage3Write(form,result){
 if(!stage3Onboarding||!form?.isConnected||form.__pawContext?.generation!==session.generation)return;
 if(form.id==='pet-form')await stage3Onboarding.noteSaved({type:'PET_SAVED',petId:result.id});
 else if(form.id==='record-form')await stage3Onboarding.noteSaved(result.dueDate?{type:'REMINDER_SAVED',reminderId:result.id}:{type:'RECORDS_SAVED',recordIds:[result.id]});
 else if(form.id==='reminder-form')await stage3Onboarding.noteSaved({type:'REMINDER_SAVED',reminderId:result.id});
}

function planBadge(r){return r.kind==='plan'?`<span class="growth-plan-badge">${esc(UI_TEXT(r.status==='cancelled'?'计划 · 已取消':'计划 · 未完成'))}</span>`:'';}
function recordActions(r){if(r.kind==='plan')return (r.status==='pending'?UI_HTML`<button class="text-button" data-action="complete" data-id="${esc(r.id)}">记录完成</button>`:'')+UI_HTML`<button class="text-button" data-action="edit-reminder" data-id="${esc(r.id)}">编辑计划</button>${r.status==='pending'?UI_HTML`<button class="text-button" data-action="cancel-reminder" data-id="${esc(r.id)}">取消计划</button>`:''}<button class="delete-button" data-action="trash-plan" data-id="${esc(r.id)}">移入回收站</button>`;return UI_HTML`<button class="text-button" data-action="edit-record" data-id="${esc(r.id)}">编辑</button><button class="delete-button" data-action="delete-record" data-id="${esc(r.id)}">移入回收站</button>`;}
function healthHTML(){
  const records=filteredRecords();
  return heading(UI_TEXT('照顾它的每一件小事。'),UI_TEXT('把健康放在心上，把记录留在这里。'),button(UI_TEXT('添加记录'),'record'))+UI_HTML`<div class="health-grid local-health"><section class="panel health-profile"><div class="panel-title"><div><h2>宠物档案</h2><p>${state.pets.length}只宠物 · ${management.petManage?UI_TEXT('选择管理，不切换当前宠物'):UI_TEXT('点击切换当前档案')}</p></div><div class="pet-card-actions">${button(UI_TEXT('添加宠物'),'new-pet','secondary')}<button class="text-button" data-action="${management.petManage?'finish-pets':'manage-pets'}">${management.petManage?UI_TEXT('完成'):UI_TEXT('管理宠物')}</button></div></div>${petListHTML()}${managementToolbar('pets')}</section><section class="panel health-reminders"><div class="panel-title"><h2>健康待办</h2><div class="care-header-actions"><button class="text-button" data-action="${management.reminderManage?'finish-reminders':'manage-reminders'}">${management.reminderManage?UI_TEXT('完成'):UI_TEXT('管理与导出')}</button><button class="text-button card-entry-action" data-action="new-reminder">添加待办 ${icon('plus')}</button></div></div><div class="tabs reminder-tabs">${[['pending','待完成'],['completed','已完成'],['cancelled','已取消'],['all','全部事项']].map(([k,v])=>`<button class="tab ${reminderFilter===k?'active':''}" data-action="reminder-filter" data-value="${k}">${esc(UI_TEXT(v))}</button>`).join('')}</div>${remindersHTML()}${managementToolbar('reminders')}</section><section class="panel health-chart"><div class="panel-title"><h2>体重趋势</h2><button class="text-button card-entry-action" data-action="record-weight">添加称重 ${icon('plus')}</button></div>${chartHTML()}</section><section class="panel health-timeline"><div class="panel-title"><h2>成长足迹</h2><button class="text-button card-entry-action" data-action="record-daily">添加记录 ${icon('plus')}</button></div>${timelineHTML(4)}</section><section class="panel full health-records"><div class="panel-title"><h2>全部记录与计划</h2><div class="data-actions"><button class="text-button" data-action="trash">${icon('book')} 回收站</button><button class="text-button" data-action="export">${icon('download')} 导出备份</button><button class="text-button" data-action="import">恢复备份</button><button class="text-button" data-action="csv">导出 CSV</button></div></div>${recordPetFilterHTML()}<div class="tabs">${[['all','全部'],...recordTypeEntries().map(([k,v])=>[k,v.label])].map(([k,v])=>`<button class="tab ${healthFilter===k?'active':''}" data-action="health-filter" data-value="${k}">${esc(UI_TEXT(v))}</button>`).join('')}</div><div class="date-filter"><label>从<input id="health-from" type="date" value="${healthFrom}"></label><label>到<input id="health-to" type="date" value="${healthTo}"></label><button class="text-button" data-action="clear-health">清空筛选</button><span>${records.length} 条记录</span></div>${records.length?UI_HTML`<div class="table-wrap records-table"><table><thead><tr>${state.pets.length>1?`<th>${esc(getLocale()==='en'?'Pet':'宠物')}</th>`:''}<th>日期</th><th>类型</th><th>记录内容</th><th>备注</th><th>操作</th></tr></thead><tbody>${records.map(r=>`<tr>${state.pets.length>1?`<td>${esc(state.pets.find(p=>p.id===r.petId)?.name||'')}</td>`:''}<td>${r.date}${planBadge(r)}</td><td>${esc(recordTypeLabel(r))}</td><td>${esc(recordTitle(r))}</td><td class="note-cell">${esc(r.note||'—')}</td><td>${recordActions(r)}</td></tr>`).join('')}</tbody></table></div><div class="records-cards">${records.map(r=>`<article class="record-card"><div class="record-meta">${state.pets.length>1?`<span class="record-pet-name">${esc(state.pets.find(p=>p.id===r.petId)?.name||'')}</span>`:''}<time datetime="${r.date}">${r.date}</time><span>${esc(recordTypeLabel(r))}</span>${planBadge(r)}</div><h3>${esc(recordTitle(r))}</h3><p>${esc(r.note||UI_TEXT('没有备注'))}</p><div class="record-actions">${recordActions(r)}</div></article>`).join('')}</div>`:empty(UI_TEXT('这里还没有记录'),UI_TEXT('点击“添加记录”，开始完善健康档案。'))}</section></div>`;
}

let unifiedRecordDialog=null;
const selectControllers=new Map();
const dateControllers=new Map();
const selectorObserver=new MutationObserver(()=>maintainSelects());
selectorObserver.observe(document.body,{childList:true,subtree:true});
function maintainSelects(){
 for(const [input,controller] of dateControllers){if(!input.isConnected){controller.destroy();dateControllers.delete(input);}else{controller.setLocale(getLocale());controller.sync();}}
 for(const input of document.querySelectorAll('input[type=date]'))if(!dateControllers.has(input))dateControllers.set(input,enhanceDateInput(input,{getLocale}));
 for(const [select,control] of selectControllers){
  if(!select.isConnected){control.destroy();selectControllers.delete(select);continue;}
  const label=select.options[select.selectedIndex]?.textContent??'';
  if((control.trigger.querySelector('.select-value')?.textContent??'')!==label)control.setValue(select.value);
 }
 for(const select of document.querySelectorAll('select'))if(!select.dataset.enhanced){
  const label=select.closest('label')?.querySelector('span')?.textContent;if(label&&!select.hasAttribute('aria-label'))select.setAttribute('aria-label',label);
  selectControllers.set(select,enhanceSelect(select,{icons:icon}));
 }
}
function recordModal(type='daily',editing=null,{purpose='record',reminder=null,completion=null}={}){
 const previousDialog=unifiedRecordDialog;
 const r=editing,linked=r?state.reminders.find(x=>x.petId===r.petId&&x.originRecordId===r.id&&x.status==='pending'):null,sourceReminder=reminder??linked,petId=r?.petId??reminder?.petId??pet()?.id;
 const originalPlan=completion??(r?state.reminders.find(x=>x.completionRecordId===r.id):null);
 if(!petId)return;
 if(!modal(r?UI_TEXT('编辑成长记录'):UI_TEXT('记下这一次成长'),'<div id="unified-record-dialog"></div>'))return;
 previousDialog?.destroy();unifiedRecordDialog=null;
 const entries=()=>catalogEntries(session.snapshot(),{includeHistoricalRecord:r??reminder});
 unifiedRecordDialog=mountRecordDialog({host:$('#unified-record-dialog'),petId,type,purpose,existing:r,reminder:sourceReminder,completion,today:today(),getLocale,getEntries:entries,
  enhanceType:select=>{select.__historicalRecord=r??reminder;const control=enhanceRecordTypeSelect(select,{getSnapshot:()=>session.snapshot(),getRepository:()=>repository,onUpdated:async()=>{await session.load();syncState();const context=select.form?.__pawContext;if(context?.generation===session.generation){context.baseRevision=repository.getRevision?.()??context.baseRevision;context.intent=null;}},icons:icon,getLocale});selectControllers.set(select,control);return control;},enhanceAll:maintainSelects,
  attachmentMarkup:workspaceMode==='demo'?`<p class="form-tip">${esc(getLocale()==='en'?'Use My local records or your account to attach files.':'添加附件请切换到我的本地档案或云端档案。')}</p>`:attachmentPickerMarkup({locale:getLocale()})+(originalPlan?`<section class="attachment-readonly" data-original-plan-attachments><h3>${esc(getLocale()==='en'?'Original plan attachments':'原计划附件')}</h3>${attachmentPickerMarkup({locale:getLocale()})}</section>`:''),
  mountAttachments:form=>{if(workspaceMode==='demo')return null;const picker=createAttachmentPicker({root:form,repository,petId,parentKind:purpose==='plan'?'reminder':'record',parentId:r?.id??(purpose==='plan'?reminder?.id:null),locale:getLocale(),onChanged:async()=>{await session.load();syncState();const context=form.__pawContext;if(context?.generation===session.generation){context.baseRevision=repository.getRevision?.()??context.baseRevision;context.intent=null;}}});if(originalPlan){const original=createAttachmentPicker({root:form.querySelector('[data-original-plan-attachments]'),repository,petId,parentKind:'reminder',parentId:originalPlan.id,locale:getLocale()}),dispose=picker.dispose;picker.dispose=()=>{original?.dispose();dispose();};}return picker;},
  onAi:(host,getPurpose)=>{if(r||reminder){host.innerHTML=`<p class="form-tip">${esc(getLocale()==='en'?'Use manual entry to edit this item without creating a duplicate.':'编辑或完成已有事项请使用手动填写，保留原关联。')}</p>`;return;}stage3Entry?.open({host,purpose:getPurpose,beforeSave:()=>{if(unifiedRecordDialog?.picker?.pendingCount)throw new Error(getLocale()==='en'?'Save your pending attachments using manual entry first.':'还有待上传附件，请切回手动填写保存，或先移除附件。');}});},
  onSubmit:async(form,values,api)=>{
   try{const intent=recordIntent({...values,...(form.__savedParent&&!completion?{id:form.__savedParent.id}:{})},{today:today(),catalog:entries()});
    await submitOperation(form,async repo=>{
     const saved=completion?await repo.completeReminder(completion.id,{...intent.input,idempotencyKey:form.__pawContext.operationId}):intent.kind==='reminder'?await repo.saveReminder(intent.input):await repo.saveRecord(intent.input);
     const parent=completion?saved.record:saved;form.__savedParent=parent;form.__pawContext.baseRevision=repository.getRevision?.()??form.__pawContext.baseRevision;
     if(api.picker)try{await api.picker.save({parentKind:intent.kind,parentId:parent.id});}catch(error){syncState();const message=getLocale()==='en'?'The entry is saved; some attachments failed. Retry to upload the remaining files.':'记录已保存，部分附件上传失败。重试只补上传，不会重复记录。';throw Object.assign(new Error(message),{code:'ATTACHMENT_PARTIAL'});}
     return parent;
    },UI_TEXT('已保存记录，档案与时间线已更新。'));
   }catch(error){showFormError(form,error);}
  }
 });
 const form=unifiedRecordDialog.form;form.__pawContext=captureFormContext({repository,getGeneration:()=>session.generation,petId,entityId:r?.id??reminder?.id??null});
 maintainSelects();focusDialogTitle(dialog);
}
function petModal(isNew=false,petId=pet()?.id){
  const p=isNew?{name:'',type:'dog',breed:'',sex:'暂不确定',birthday:null,estimatedAgeMonths:null,arrivalDate:null}:session.snapshot().pets.find(x=>x.id===petId);
  if(!p)return;
  if(!modal(isNew?UI_TEXT('认识新的毛孩子'):UI_TEXT('宠物档案'),`<form id="pet-form"><div class="form-grid">${field(UI_TEXT('宠物名字'),`<input name="name" value="${esc(p.name)}" maxlength="20" required>`)}${field(UI_TEXT('宠物类型'),UI_HTML`<select name="type" id="pet-type"><option value="dog" ${p.type==='dog'?'selected':''}>狗狗</option><option value="cat" ${p.type==='cat'?'selected':''}>猫咪</option>${workspaceMode==='demo'?'':UI_HTML`<option value="other" ${p.type==='other'?'selected':''}>其他</option>`}</select>`)}<div class="field" id="pet-type-label"></div>${field(UI_TEXT('品种 · 可选'),`<input name="breed" value="${esc(p.breed)}" maxlength="30">`)}${field(UI_TEXT('性别'),`<select name="sex">${['男孩子','女孩子','暂不确定'].map(v=>`<option value="${esc(v)}" ${p.sex===v?'selected':''}>${esc(UI_TEXT(v))}</option>`).join('')}</select>`)}${field(UI_TEXT('年龄填写方式'),UI_HTML`<select name="ageMethod" id="age-method"><option value="birthday" ${p.birthday?'selected':''}>知道生日</option><option value="estimated" ${!p.birthday?'selected':''}>估计年龄</option></select>`)}<div id="age-field" class="field"></div>${field(UI_TEXT('来到家的日期 · 可选'),`<input name="arrivalDate" type="date" value="${p.arrivalDate||''}" max="${today()}">`)}</div>${formActions(UI_TEXT('保存档案'))}${!isNew&&workspaceMode!=='demo'?UI_HTML`<button type="button" class="text-button" data-action="avatar-pet" data-id="${esc(p.id)}">更换头像</button>`:''}</form>`))return;
  $('#pet-form').__pawContext.entityId=isNew?null:p.id;
  const petForm=$('#pet-form'),petContext=petForm.__pawContext,petRepository=repository;
  petForm.insertAdjacentHTML('afterbegin','<div data-pet-avatar-picker></div>');petForm.querySelector('[data-action="avatar-pet"]')?.remove();
  const picker=mountAvatarPicker({root:petForm.querySelector('[data-pet-avatar-picker]'),petType:p.type,initialAvatar:isNew?null:(avatarUrls.get(p.avatarAssetId)?.url??p.image),onChange:()=>{dirty=true;},onError:error=>showFormError(petForm,error)});petForm.__pawCleanup=()=>picker.destroy();petForm.__pawLocaleRefresh=()=>picker.refreshLocale();
  $('#pet-type').addEventListener('change',()=>picker.setPetType($('#pet-type').value));
  let avatarOperation=uid(),avatarSelection=null;
  const petSave=createPetAvatarSave({savePet:async input=>{const saved=await bindFormRepository(petRepository,petContext,()=>session.generation).savePet(input);petContext.entityId=saved.id;petContext.petId=saved.id;petContext.baseRevision=petRepository.getRevision?.();return saved;},saveAvatar:async(saved,selection)=>{
   if(workspaceMode==='demo')return;if(petContext.generation!==session.generation||repository!==petRepository)throw accountBoundaryError();
   if(avatarSelection!==selection){avatarSelection=selection;avatarOperation=uid();}
   let preparedImage=selection.preparedImage;if(!preparedImage){const response=await fetch(`assets/${selection.preset}.jpg`);if(!response.ok)throw new Error('Avatar image unavailable');preparedImage=await processImage(await response.blob(),{kind:'avatar'});}
   await petRepository.media.save({petId:saved.id,kind:'avatar',blob:preparedImage.blob,preparedImage,baseRevision:petRepository.getRevision?.(),operationId:avatarOperation});petContext.baseRevision=petRepository.getRevision?.();
  }});
  function petTypeField(){const isOther=$('#pet-type').value==='other';$('#pet-type-label').hidden=!isOther;$('#pet-type-label').innerHTML=isOther?field(UI_TEXT('自定义宠物类型'),UI_HTML`<input name="typeLabel" maxlength="20" value="${esc(p.typeLabel??'')}" placeholder="例如：兔子" required>`):'';}petTypeField();$('#pet-type').addEventListener('change',petTypeField);
  function ageField(){$('#age-field').innerHTML=$('#age-method').value==='birthday'?field(UI_TEXT('生日'),`<input name="birthday" type="date" value="${p.birthday||''}" max="${today()}" required>`):field(UI_TEXT('估计年龄（月）'),UI_HTML`<input name="estimatedAgeMonths" type="number" inputmode="numeric" min="0" max="1200" step="1" value="${p.estimatedAgeMonths??''}" placeholder="例如：12…" required>`);}
  ageField();$('#age-method').addEventListener('change',ageField);
  petForm.addEventListener('submit',async e=>{e.preventDefault();if(saving||petContext.generation!==session.generation||repository!==petRepository)return;if(picker.isPreparing()){showFormError(petForm,new Error(getLocale()==='en'?'Please wait for the image preview.':'请等待头像预览处理完成。'));return;}const d=new FormData(petForm),selection=picker.getSelection(),input=petSave.getSavedPet()??{...(!isNew?{id:p.id}:{}),makeActive:isNew,name:d.get('name').trim(),type:d.get('type'),...(d.get('type')==='other'?{typeLabel:d.get('typeLabel')}:{}),breed:d.get('breed').trim(),sex:d.get('sex'),birthday:d.get('ageMethod')==='birthday'?d.get('birthday'):null,estimatedAgeMonths:d.get('ageMethod')==='estimated'?Number(d.get('estimatedAgeMonths')):null,arrivalDate:d.get('arrivalDate')||null};
   const submit=petForm.querySelector('[type=submit]');saving=true;submit.disabled=true;try{
    if(workspaceMode==='demo'&&selection.kind==='preset')input.image=`assets/${selection.preset}.jpg`;
    if(workspaceMode==='demo'&&selection.kind==='upload')input.image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(selection.blob);});
    const result=await session.run(async()=>{const saved=await petSave.save(input,selection);if(isNew)await petRepository.selectPet(saved.id);return saved;});if(petContext.generation!==session.generation)return;syncState();try{await trackStage3Write(petForm,result);}catch{}closeModal(true);render();toast(UI_TEXT('宠物档案已保存。'));
   }catch(error){if(petContext.generation===session.generation&&petForm.isConnected){await session.load();syncState();if(petSave.getSavedPet()){render();for(const control of petForm.querySelectorAll('.form-grid input,.form-grid select'))control.disabled=true;const message=petForm.querySelector('.form-error');message.hidden=false;message.textContent=getLocale()==='en'?'Profile saved. Avatar upload failed; retry to upload the avatar.':'档案已保存，头像上传失败；再次保存只重试头像。';submit.textContent=getLocale()==='en'?'Retry avatar':'重试头像';}else showFormError(petForm,error);}}
   finally{if(petContext.generation===session.generation)saving=false;if(petForm.isConnected)submit.disabled=false;}
  });
}
function switchPet(){modal(UI_TEXT('我的毛孩子'),state.pets.map(p=>`<button class="pet-option" data-action="select-pet" data-id="${esc(p.id)}">${img(p.image,'','',p.avatarAssetId)}<span><strong>${esc(p.name)} ${p.id===pet()?.id?UI_TEXT('· 正在记录'):''}</strong><small>${esc(p.breed||(petTypeLabel(p)))} · ${ageText(p)}</small></span></button>`).join('')+button(UI_TEXT('添加一只宠物'),'new-pet','soft'));}
function reminderModal(id=null,defaults={}){const r=id?state.reminders.find(x=>x.id===id):null;if(r?.status==='completed'){reminderDetails(r);return;}const origin=r?state.records.find(x=>x.id===r.originRecordId):null,kind=r?.recordType??origin?.type??(r?'daily':'deworm');recordModal(kind,null,{purpose:'plan',reminder:r?{...r,includeInHealth:isHealthTodo(r,{records:state.records}),recordType:kind,customTypeId:r.customTypeId??origin?.customTypeId,typeLabel:r.typeLabel??origin?.typeLabel,iconKey:r.iconKey??origin?.iconKey}:defaults.title?{title:defaults.title,petId:pet()?.id,recordType:'deworm',dueDate:''}:null});}
function completeModal(id){const r=state.reminders.find(x=>x.id===id);if(!r||r.status!=='pending')return;const origin=state.records.find(x=>x.id===r.originRecordId);recordModal(r.recordType??origin?.type??'daily',null,{purpose:'record',reminder:{...r,recordType:r.recordType??origin?.type??'daily',customTypeId:r.customTypeId??origin?.customTypeId,typeLabel:r.typeLabel??origin?.typeLabel,iconKey:r.iconKey??origin?.iconKey},completion:r});}
function cancelReminder(id){const r=state.reminders.find(x=>x.id===id);if(!r)return;modal(UI_TEXT('取消这项护理安排？'),UI_HTML`<form id="cancel-form"><p class="demo-note">取消“${esc(r.title)}”会保留历史记录，不会删除健康档案。</p>${formActions(UI_TEXT('确认取消'))}</form>`);$('#cancel-form').addEventListener('submit',async e=>{e.preventDefault();await submitOperation(e.target,repo=>repo.saveReminder({...r,status:'cancelled'}),UI_TEXT('事项已取消，历史记录仍保留。'));});}
function cityModal(){if(!state)return;modal(UI_TEXT('选择你的城市'),UI_HTML`<form id="city-form">${field(UI_TEXT('所在城市'),`<select name="city">${cityOptions.map(c=>`<option ${state.city===c?'selected':''}>${c}</option>`).join('')}</select>`)}<p class="form-tip">筛选同城示例，不获取精确位置。</p>${formActions(UI_TEXT('确认城市'))}</form>`);$('#city-form').addEventListener('submit',async e=>{e.preventDefault();const city=new FormData(e.target).get('city');await submitOperation(e.target,repo=>workspaceMode==='demo'?repo.mutate(s=>{s.profile.city=city;}):repo.saveProfile({city}),UI_HTML`已切换到${city}。`);});}
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
function nearbyHTML(){const list=friends.filter(f=>f.city===state.city&&(nearbyFilter==='all'||f.type===nearbyFilter));return heading(UI_TEXT('附近，刚好也有人爱它。'),UI_TEXT('从一段散步开始，认识同城的毛孩子和它们的朋友。'),button(UI_TEXT('切换城市'),'city','secondary','pin'))+UI_HTML`<div class="section-intro">${icon('pin')}<div>正在发现 ${esc(state.city)} 的宠友<small>按城市匹配的示例宠友 · 仅展示区级地域，不获取精确位置</small></div></div><div class="filter-bar"><div class="tabs">${[['all','全部宠友'],['dog','狗狗伙伴'],['cat','猫咪朋友']].map(([k,v])=>`<button class="tab ${nearbyFilter===k?'active':''}" data-action="nearby-filter" data-value="${k}">${esc(UI_TEXT(v))}</button>`).join('')}</div><small class="demo-note">${list.length} 位示例宠友</small></div><div class="nearby-grid">${list.length?list.map(f=>UI_HTML`<article class="friend-card"><div class="friend-image"><img width="1000" height="750" src="${esc(f.image)}" alt="${esc(f.name)}的示例宠物照片" loading="lazy"><span class="tag">${esc(f.breed)}</span></div><div class="friend-body"><h3>${esc(f.name)}<small>${esc(f.city)} · ${esc(f.area)}</small></h3><p>${esc(f.desc)}</p><div class="friend-tags">${f.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><button class="button soft" data-action="friend" data-id="${f.id}">${icon('community')} 认识一下</button></div></article>`).join(''):empty(UI_TEXT('这个筛选下暂时没有宠友'),UI_TEXT('试试选择全部宠友，或者切换城市。'),button(UI_TEXT('切换城市'),'city','secondary','pin'))}</div>`;}
function postHTML(post){return UI_HTML`<article class="post">${post.image?`<img width="1000" height="750" class="post-image" src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy">`:''}<div class="post-content"><div class="post-user"><img width="1000" height="750" class="post-avatar" src="${esc(post.avatar)}" alt=""><div><strong>${esc(post.author)}</strong><small>${esc(post.city)} · ${shortDate(post.date)}${post.own?UI_TEXT(' · 我的本地发布'):UI_TEXT(' · 示例')}</small></div></div><h3>${esc(post.title)}</h3><p class="post-text">${esc(post.text)}</p><div class="post-topic"># ${esc(post.topic)}</div><div class="post-actions"><button class="${post.liked?'liked':''}" aria-label="${post.liked?UI_TEXT('取消点赞'):UI_TEXT('点赞')} ${esc(post.title)}" aria-pressed="${!!post.liked}" data-action="like" data-id="${esc(post.id)}">${icon('like')} ${post.likes}</button><button data-action="comments" data-id="${esc(post.id)}">${icon('comment')} ${post.comments.length} 评论</button>${post.own?UI_HTML`<button data-action="delete-post" data-id="${esc(post.id)}">删除</button>`:''}</div></div></article>`;}
function communityHTML(){let list=state.posts.filter(p=>communityFilter==='all'||(communityFilter==='local'?p.city===state.city:p.topic===communityFilter));if(postSearch)list=list.filter(p=>(p.title+p.text+p.author+p.topic).toLowerCase().includes(postSearch.toLowerCase()));return heading(UI_TEXT('把毛茸茸的快乐，分享出去。'),UI_TEXT('记录你的养宠日常，也收集别人的小小幸福。'),button(UI_TEXT('发布日常'),'post','', 'camera'))+UI_HTML`<div class="filter-bar"><div class="tabs">${[['all','推荐日常'],['local',state.city+'同城'],['今日萌宠','今日萌宠'],['养宠心得','养宠心得']].map(([k,v])=>`<button class="tab ${communityFilter===k?'active':''}" data-action="community-filter" data-value="${k}">${esc(UI_TEXT(v))}</button>`).join('')}</div><label class="search">${icon('search')}<input id="post-search" aria-label="搜索社区内容" placeholder="搜索日常、经验或宠友" value="${esc(postSearch)}" maxlength="60"></label></div><div class="community-layout"><div class="feed">${list.length?list.map(postHTML).join(''):empty(UI_TEXT('这里暂时安静了一点'),UI_TEXT('换个关键词，或者分享第一篇日常。'),button(UI_TEXT('发布日常'),'post','','camera'))}</div><aside class="community-side"><section class="panel"><div class="panel-title"><h2>聊聊这些小事</h2></div>${['今日萌宠','遛宠搭子','养宠心得'].map(t=>UI_HTML`<button class="topic-item" style="width:100%;background:none;color:var(--green);text-align:left" data-action="community-filter" data-value="${t}"><span># ${t}</span><small>${state.posts.filter(p=>p.topic===t).length} 篇</small></button>`).join('')}</section><section class="panel demo-note"><h3>让社区温柔一点</h3><p>分享真实的陪伴，尊重不同的养宠方式。不公开住址和联系方式，遇到健康问题及时咨询兽医。</p></section><section class="panel demo-note"><h3>关于这个体验版</h3><p>这里预置了示例日常。你可以发布、点赞和评论，新增内容保存在当前浏览器。真实用户共享与交流将在后续版本接入。</p></section></aside></div>`;}

async function compressPhoto(file){if(!file)return '';if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error(UI_TEXT('请选择 JPG、PNG 或 WebP 图片。'));if(file.size>10*1024*1024)throw Error(UI_TEXT('图片超过 10MB，请选择小一点的图片。'));return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{try{const ratio=Math.min(1,1000/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*ratio);canvas.height=Math.round(image.height*ratio);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.7));}catch{reject(Error(UI_TEXT('无法读取图片，请换一张。')));}finally{URL.revokeObjectURL(url);}};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error(UI_TEXT('图片无法读取，请换一张。')));};image.src=url;});}
function postModal(){if(!pet()){toast(UI_TEXT('请先添加一只宠物，再发布它的日常。'));return;}modal(UI_TEXT('分享今天的毛茸茸'),UI_HTML`<form id="post-form"><div class="form-grid">${field(UI_TEXT('标题'),UI_HTML(['<input name="title" maxlength="60" placeholder="给今天的小美好起个名字…" required>']),true)}${field(UI_TEXT('日常内容'),UI_HTML(['<textarea name="text" maxlength="1500" placeholder="分享今天的日常…" required></textarea>']),true)}${field(UI_TEXT('话题'),`<select name="topic">${['今日萌宠','遛宠搭子','养宠心得'].map(t=>`<option>${t}</option>`).join('')}</select>`)}${field(UI_TEXT('城市'),`<select name="city">${cityOptions.map(c=>`<option ${c===state.city?'selected':''}>${c}</option>`).join('')}</select>`)}${field(UI_TEXT('照片 · 可选'),UI_HTML(['<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"><small>支持 JPG / PNG / WebP，最大 10MB。</small>']),true)}</div><p class="form-tip">发布到本地示例，保存在当前浏览器，不向其他访客共享。</p>${formActions(UI_TEXT('发布日常'))}</form>`);$('#post-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.target,d=new FormData(form);await submitOperation(form,async repo=>{const file=d.get('photo'),image=await compressPhoto(file?.size?file:null);return repo.mutate(s=>s.posts.unshift({id:uid(),author:'我与'+pet().name,pet:pet().name,city:d.get('city'),topic:d.get('topic'),title:d.get('title').trim(),text:d.get('text').trim(),image,avatar:pet().image,likes:0,liked:false,date:today(),comments:[],own:true}));},UI_TEXT('日常已保存到本地示例。'),()=>{communityFilter='all';postSearch='';location.hash='community';render();});});}
function commentsModal(id){const p=state.posts.find(x=>x.id===id);if(!p)return;modal(UI_TEXT('聊聊这篇日常'),UI_HTML`<div class="comments">${p.comments.length?p.comments.map(c=>`<div class="comment"><strong>${esc(c.author)}</strong><p>${esc(c.text)}</p></div>`).join(''):UI_HTML(['<p class="demo-note">还没有评论，留下第一句友好的回应吧。</p>'])}</div><form id="comment-form">${field(UI_TEXT('我的评论'),UI_HTML(['<textarea name="comment" maxlength="400" placeholder="分享你的想法…" required></textarea>']))}<p class="form-tip">评论仅保存在当前浏览器。</p>${formActions(UI_TEXT('发送评论'))}</form>`);$('#comment-form').addEventListener('submit',async e=>{e.preventDefault();const text=new FormData(e.target).get('comment').trim();await submitOperation(e.target,repo=>repo.mutate(s=>s.posts.find(x=>x.id===id).comments.push({author:'我',text})),UI_TEXT('评论已保存到当前浏览器。'));});}
function friendModal(id){const f=friends.find(x=>x.id===id);if(!f)return;modal(UI_HTML`认识${f.name}`,UI_HTML`<div class="pet-profile">${img(f.image,f.name)}<div><h3>${esc(f.owner)}</h3><p>${esc(f.city)} · ${esc(f.area)}<br>${esc(f.breed)}</p></div></div><p class="profile-details">${esc(f.desc)}</p><p class="form-tip">这是示例宠友，暂不提供真实私信。你可以发布同城日常，演示寻找伙伴的流程。</p><div class="form-actions"><button class="button secondary" data-action="close">返回</button><button class="button" data-action="invite-post">写一篇找搭子的日常</button></div>`);}
function reminderDetails(r){
  const full=session.snapshot(),record=full.records.find(item=>item.id===r.completionRecordId),parent=full.pets.find(item=>item.id===r.petId);
  modal(UI_TEXT('护理完成详情'),UI_HTML`<div class="profile-details"><h3>${esc(r.title)}</h3><p>宠物：${esc(parent?.name||UI_TEXT('未找到'))}<br>原定日期：${esc(r.dueDate)}<br>状态：已完成<br>实际完成日期：${record?esc(record.occurredDate):r.completedAt?esc(localDate(new Date(r.completedAt))):UI_TEXT('旧版没有保存，待核对')}</p>${record?`<p>${record.deletedAt?UI_TEXT('关联记录已移入回收站。'):UI_TEXT('关联记录：')+esc(record.title)}<br>${esc(record.note||UI_TEXT('没有备注'))}</p>`:UI_HTML(['<p>没有可查看的关联记录，保留原完成历史。</p>'])}</div><div class="form-actions"><button class="button secondary" data-action="close">关闭详情</button></div>`);
}
function confirmDelete(kind,id){
  if(kind==='record'){trashConfirm('record',[id]);return;}
  if(!modal(UI_TEXT('删除这篇本地日常？'),UI_HTML`<form id="delete-form"><p class="demo-note">社区日常删除后无法撤回，建议先导出备份；它不会进入健康回收站。</p>${formActions(UI_TEXT('确认删除'))}</form>`))return;
  $('#delete-form .secondary').textContent=UI_TEXT('保留');
  $('#delete-form').addEventListener('submit',async e=>{e.preventDefault();await submitOperation(e.target,repo=>repo.mutate(s=>{s.posts=s.posts.filter(x=>x.id!==id);}),UI_TEXT('日常已删除。'));});
}
function trashConfirm(kind,ids){
  if(!ids.length){toast(UI_TEXT('请先选择要移入回收站的项目。'));return;}
  const full=session.snapshot(),items=full[{pet:'pets',record:'records',reminder:'reminders'}[kind]].filter(item=>ids.includes(item.id));
  const description=kind==='pet'?UI_TEXT('关联记录与事项会一起隐藏。恢复宠物后会重新显示，之前单独移入的内容仍保留在回收站。'):kind==='record'?UI_TEXT('记录可以恢复，来源关联的待完成事项会取消；恢复记录不会自动重新安排护理。'):UI_TEXT('事项可以恢复，原日期、状态和完成记录会保留。');
  if(!modal(UI_TEXT('移入回收站？'),UI_HTML`<form id="trash-form"><p class="trash-confirm-names">${items.map(item=>esc(item.name||item.title)).join('、')}</p><p class="demo-note">将移入 ${ids.length} ${kind==='pet'?UI_TEXT('只宠物'):kind==='record'?UI_TEXT('条记录'):UI_TEXT('项事项')}。${description}</p>${formActions(UI_TEXT('确认移入'))}</form>`))return;
  $('#trash-form .secondary').textContent=UI_TEXT('保留');
  $('#trash-form').addEventListener('submit',async e=>{e.preventDefault();await submitOperation(e.target,repo=>repo.moveToTrash({kind,ids,...(kind==='reminder'?{petId:editingPetId(e.target)}:{})}),UI_TEXT('已移入回收站，可随时恢复。'));});
}
function trashModal(){
  const full=session.snapshot(),parentMap=new Map(full.pets.map(p=>[p.id,p])),groups=[['pet','宠物',full.pets],['record','记录',full.records],['reminder','护理事项',full.reminders]];
  let count=0;
  const html=groups.map(([kind,label,entities])=>{
    const hidden=entities.filter(item=>item.deletedAt);count+=hidden.length;
    return hidden.length?`<section class="trash-group"><h3>${esc(UI_TEXT(label))} · ${hidden.length}</h3>${hidden.map(item=>{
      const parent=kind==='pet'?item:parentMap.get(item.petId),blocked=kind!=='pet'&&!!parent?.deletedAt;
      const recordCount=kind==='pet'?full.records.filter(r=>r.petId===item.id).length:0,reminderCount=kind==='pet'?full.reminders.filter(r=>r.petId===item.id).length:kind==='record'?full.reminders.filter(r=>r.originRecordId===item.id||r.completionRecordId===item.id).length:0;
      const details=kind==='pet'?UI_HTML`${recordCount} 条关联记录 · ${reminderCount} 项护理事项`:kind==='record'?UI_HTML`${item.occurredDate} · ${types[item.type].label} · ${reminderCount} 项关联事项`:`${item.dueDate} · ${item.status==='pending'?UI_TEXT('待完成'):item.status==='completed'?UI_TEXT('已完成'):UI_TEXT('已取消')}`;
      return UI_HTML`<div class="trash-entry" data-kind="${kind}" data-id="${esc(item.id)}"><div><strong>${esc(item.name||item.title)}</strong><p>${kind==='pet'?'':UI_HTML`所属宠物：${esc(parent?.name||UI_TEXT('未找到'))} · `}${esc(details)}</p><small>移入日期：${esc(localDate(new Date(item.deletedAt)))}</small>${blocked?UI_HTML`<p class="trash-parent-hint">请先恢复宠物“${esc(parent.name)}”，再恢复此项目。</p>`:''}</div><button class="button secondary" data-action="restore-trash" data-kind="${kind}" data-id="${esc(item.id)}" ${blocked?'disabled':''}>恢复</button></div>`;
    }).join('')}</section>`:'';
  }).join('');
  modal(UI_TEXT('回收站'),UI_HTML`<div class="trash-content"><p class="demo-note">不会自动清空。恢复保留原始内容与日期，不会恢复已经单独移入回收站的子记录。</p>${count?html:empty(UI_TEXT('回收站是空的'),UI_TEXT('移入的宠物、记录与护理事项会在这里保留。'))}<p class="form-error" role="alert" hidden></p></div><div class="form-actions"><button class="button secondary" data-action="close">关闭回收站</button></div>`);
}
async function restoreTrash(el){
  const key=`restore:${el.dataset.kind}:${el.dataset.id}`;if(busyActions.has(key))return;
  busyActions.add(key);el.disabled=true;const label=el.textContent;el.textContent=UI_TEXT('正在恢复…');saving=true;
  try{await session.run(repo=>repo.restoreFromTrash({kind:el.dataset.kind,ids:[el.dataset.id]}));syncState();dirty=false;closeModal(true);render();trashModal();toast(UI_TEXT('已恢复，原日期和历史保持不变。'));}
  catch(error){const message=$('.trash-content .form-error');message.hidden=false;message.textContent=UI_TEXT('恢复未成功：')+error.message;message.tabIndex=-1;message.focus();}
  finally{saving=false;busyActions.delete(key);el.disabled=false;el.textContent=label;}
}
async function reorderPet(id,destination){
  if(management.petManage||busyActions.has('reorder-pets'))return;
  const ids=state.pets.map(p=>p.id),from=ids.indexOf(id),to=typeof destination==='number'?from+destination:ids.indexOf(destination);
  if(from<0||to<0||to>=ids.length||from===to)return;
  ids.splice(from,1);ids.splice(to,0,id);
  busyActions.add('reorder-pets');
  try{await session.run(repo=>repo.reorderPets(ids));syncState();render();if(typeof destination==='number'){const action=destination<0?'pet-up':'pet-down',control=document.querySelector(`[data-action="${action}"][data-id="${CSS.escape(id)}"]`);if(control?.disabled)restoreFocus({action:'select-pet',id});}toast(UI_TEXT('宠物顺序已保存。'));}
  finally{busyActions.delete('reorder-pets');}
}

function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportData(){
 try{if(workspaceMode==='demo'){const raw=session.snapshot();download(JSON.stringify(raw,null,2),UI_HTML`爪爪日记-备份-${today()}.json`,'application/json');toast(UI_TEXT('完整本地示例备份已导出。'));return;}
 toast(UI_TEXT('正在准备完整备份，包含照片文件。'));const archive=await exportArchive({repository});download(JSON.stringify(archive,null,2),UI_HTML`爪爪日记-完整备份-${today()}.json`,'application/json');toast(UI_TEXT('完整备份已导出，包含照片和回收站。'));
 }catch(error){toast(localizeError(error));}
}

function emptySnapshot(){return {version:3,mode:'demo',activePetId:null,pets:[],records:[],reminders:[],posts:[],profile:{city:'深圳'}};}
function importModal(){if(workspaceMode!=='demo'){openPersonalImport();return;}
  if(!modal(UI_TEXT('恢复备份'),UI_HTML`<form id="import-form">${field(UI_TEXT('选择 JSON 备份'),'<input name="backup" type="file" accept="application/json,.json" required>')}<p class="form-tip">先预览新增与冲突；确认之前不会修改当前数据。</p>${formActions(UI_TEXT('预览恢复'))}</form>`))return;
  $('#import-form').addEventListener('submit',async e=>{e.preventDefault();if(saving)return;saving=true;const form=e.target,b=form.querySelector('[type=submit]');b.disabled=true;
    try{const file=new FormData(form).get('backup');if(file.size>20*1024*1024)throw new Error(UI_TEXT('备份超过20MB，请缩小文件后再试。'));const incoming=validateBackup(await file.text());if(form.__pawContext.generation!==session.generation||workspaceMode!=='demo'||!form.isConnected)throw accountBoundaryError();assertDemoTypes(incoming);const current=state?session.snapshot():emptySnapshot(),preview=previewImport(current,incoming);saving=false;dirty=false;closeModal(true);
      modal(UI_TEXT('恢复前请核对'),UI_HTML`<form id="restore-form"><p class="restore-summary">新增 ${preview.newPets.length} 只宠物、${preview.newRecords.length} 条记录、${preview.newReminders.length} 项提醒、${preview.newPosts.length} 篇本地日常。</p><p class="demo-note">${state?UI_TEXT('相同内容不会重复导入。冲突默认保留当前版本，勾选才更新；恢复或移入回收站的变化也需确认。'):UI_TEXT('当前档案无法读取，将保存原始字符串后恢复有效备份。')}</p>${preview.conflicts.map(c=>UI_HTML`<label class="conflict-option"><input name="conflict" type="checkbox" value="${esc(c.kind+':'+c.id)}"><span>${c.effect==='restore'?UI_TEXT('恢复已移入回收站的'):c.effect==='trash'?UI_TEXT('移入回收站'):UI_TEXT('更新')} ${esc(c.current.title||c.current.name||c.id)}<small>当前：${esc(c.current.note||c.current.title||c.current.name||'')}<br>备份：${esc(c.incoming.note||c.incoming.title||c.incoming.name||'')}</small></span></label>`).join('')}${formActions(UI_TEXT('确认恢复'))}</form>`);
      $('#restore-form').addEventListener('submit',async event=>{event.preventDefault();try{const accepted=new FormData(event.target).getAll('conflict'),merged=mergeBackup(current,incoming,{acceptedConflictIds:accepted});await submitOperation(event.target,repo=>repo.replaceSnapshot(merged),UI_TEXT('备份已恢复，原始数据已另行保留。'));}catch(error){showFormError(event.target,error);}});
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
  try{if(workspaceMode!=='demo'&&['post','invite-post','like','comments','delete-post'].includes(a)){modal(UI_TEXT('真实社区尚未开放'),UI_HTML`<p class="demo-note">当前可只读浏览示例。真实发布和互动将在社区阶段接通。</p><div class="form-actions"><button class="button secondary" data-action="workspace-demo">去示例体验</button><button class="button" data-action="close">返回</button></div>`);return;}switch(a){
    case 'workspace-local':await switchWorkspace('local',{newPet:true});break;case 'workspace-demo':await switchWorkspace('demo');break;case 'account':await openAccount();break;case 'avatar-pet':await avatarModal(id||pet()?.id);break;case 'record':recordModal();break;case 'ai-entry':if(!$('#unified-record-dialog'))recordModal();unifiedRecordDialog?.setMode('ai');maintainSelects();break;case 'record-mode':unifiedRecordDialog?.setMode(v);maintainSelects();break;case 'open-assistant':stage3Assistant?.open();break;case 'record-weight':recordModal('weight');break;case 'record-daily':recordModal('daily');break;
    case 'edit-record':recordModal(null,state.records.find(r=>r.id===id));break;case 'edit-pet':petModal(false,id||pet()?.id);break;case 'new-pet':if(dialog.open&&!closeModal())break;petModal(true);break;case 'switch-pet':switchPet();break;
    case 'select-pet':if(busyActions.has(a))break;busyActions.add(a);try{await session.run(repo=>repo.selectPet(id));management=transitionManagement(management,{type:'PET_CHANGED'});syncState();if(dialog.open)closeModal(true);render();toast(UI_HTML`开始记录${pet().name}的成长。`);}finally{busyActions.delete(a);}break;
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
    case 'comments':commentsModal(id);break;case 'trash-plan':trashConfirm('reminder',[id]);break;case 'delete-record':confirmDelete('record',id);break;case 'delete-post':confirmDelete('post',id);break;
    case 'export':exportData();break;case 'import':importModal();break;
    case 'csv':download(exportGrowthCsv(filteredRecords(),{pets:session.snapshot().pets}),UI_HTML`爪爪日记-记录与计划-${today()}.csv`,'text/csv;charset=utf-8');toast(UI_TEXT('已导出筛选的记录与计划。'));break;
    case 'calendar':{const s=session.snapshot(),selected=selectedCalendarReminders(s,pet()?.id,management.selectedReminderIds);download(exportRemindersIcs(selected,visibleHealth(s).pets),UI_HTML`爪爪日记-护理-${today()}.ics`,'text/calendar;charset=utf-8');toast(UI_TEXT('日历文件已导出，请在系统日历中导入并设置通知。'));break;}
    case 'raw-export':download(await repository.getRawBackup(),UI_HTML`爪爪日记-原始数据-${today()}.txt`,'text/plain;charset=utf-8');break;
    case 'retry':await boot();break;case 'close':closeModal();break;
  }}catch(error){toast(UI_TEXT('操作未成功：')+error.message);}
});
document.addEventListener('input',e=>{if(dialog.contains(e.target)&&!e.target.closest('[data-readonly-ai]'))dirty=true;if(e.target.id==='post-search'){postSearch=e.target.value;const cursor=e.target.selectionStart;render();$('#post-search').focus();$('#post-search').setSelectionRange(cursor,cursor);}});
document.addEventListener('change',e=>{
  if(e.target.name==='record-pet-filter'){recordPetSelectionManual=true;recordPetIds??=initialPetSelection(session.snapshot());if(e.target.checked)recordPetIds.add(e.target.value);else recordPetIds.delete(e.target.value);render();return;}
  if(e.target.name==='managed-pet'||e.target.name==='managed-reminder'){management=transitionManagement(management,{type:e.target.name==='managed-pet'?'TOGGLE_PET':'TOGGLE_REMINDER',id:e.target.value});render();return;}
  if(e.target.id==='health-from'||e.target.id==='health-to'){const from=$('#health-from').value,to=$('#health-to').value;if(from&&to&&from>to){toast(UI_TEXT('开始日期不能晚于结束日期。'));$('#health-from').value=healthFrom;$('#health-to').value=healthTo;return;}healthFrom=from;healthTo=to;render();}
});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){const placeholder=document.createElement('span');placeholder.className='image-fallback '+e.target.className;placeholder.setAttribute('role','img');placeholder.setAttribute('aria-label',e.target.alt||UI_TEXT('图片暂不可用'));placeholder.textContent=UI_TEXT('图片暂不可用');e.target.replaceWith(placeholder);}},true);
$('#city-button').addEventListener('click',()=>PUBLIC_CONFIG.communityEnabled&&['community','nearby'].includes(page)?openCommunityBrowseRegion():cityModal());$('#close-dialog').addEventListener('click',()=>closeModal());
dialog.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function openAbout(){modal(UI_TEXT('属于你们的成长手账'),UI_HTML`<div class="profile-details"><p>免登录可以使用本地档案，邮箱登录后可私有云同步。公开资料和社区内容由你主动选择发布。</p><p>支持记录编辑、独立护理待办、备份恢复和日历文件导出。</p></div><div class="form-actions">${state?button(UI_TEXT('导出我的数据'),'export','secondary','download'):''}<button class="button" data-action="close">继续记录</button></div>`);}
profileMenu=createProfileMenu({triggers:[$('#about-button'),$('#owner-profile-button')],getLocale,onProfile:()=>{location.hash='profile';},onAccount:openAccount,onAbout:openAbout,onHelp:()=>helpPanel?.open()});
$('#dialog-help-button').addEventListener('click',()=>helpPanel?.open());
window.addEventListener('beforeunload',e=>{if((dialog.open&&(dirty||saving))||publicSurface?.hasUnsavedChanges?.()||publicSurface?.isSaving?.()||photoWall?.hasUnsavedChanges?.()||photoWall?.isSaving?.()){e.preventDefault();e.returnValue='';}});
window.addEventListener('hashchange',route);

function importSummary(preview){const c=preview.counts??{};return translate('backup.countSummary',{pets:c.pets??preview.newPets?.length??0,records:c.records??preview.newRecords?.length??0,reminders:c.reminders??preview.newReminders?.length??0,photos:c.photos??c.assets??preview.newAssets?.length??0});}
function importItemLabel(archive,kind,id){
 if(kind==='asset'){const metadata=archive.assets.find(a=>a.metadata.id===id)?.metadata;if(!metadata)return UI_TEXT('照片');const parent=archive.snapshot.pets.find(p=>p.id===metadata.petId);return metadata.caption||[parent?.name,UI_TEXT(metadata.kind==='avatar'?'头像':'照片')].filter(Boolean).join(' · ');}
 const field={pet:'pets',record:'records',reminder:'reminders'}[kind],item=archive.snapshot[field]?.find(x=>x.id===id);return item?.name||item?.title||UI_TEXT('资料');
}
function importClosureMarkup(archive,preview,selection={}){
 const closure=preview.closure??{petIds:preview.incoming?.snapshot?.pets.map(p=>p.id)??[],recordIds:preview.incoming?.snapshot?.records.map(r=>r.id)??[],reminderIds:preview.incoming?.snapshot?.reminders.map(r=>r.id)??[],assetIds:preview.incoming?.assets.map(a=>a.metadata.id)??[]};
 const items=[];for(const [kind,key,label] of [['pet','petIds','宠物'],['record','recordIds','记录'],['reminder','reminderIds','护理事项'],['asset','assetIds','照片']])for(const id of closure[key]??[]){const dependency=!(selection[key]??[]).includes(id),duplicate=preview.duplicates?.some(d=>d.kind===kind&&d.sourceId===id);items.push(`<li>${esc(UI_TEXT(label))} · ${esc(importItemLabel(archive,kind,id))}${dependency?' · '+esc(UI_TEXT('关联依赖')):''}${duplicate?' · '+esc(UI_TEXT('已有资料')):''}</li>`);}
 return `<section class="import-closure-summary"><h3>${esc(UI_TEXT('本次核对的资料'))}</h3><p class="demo-note" data-ui-copy>${esc(UI_TEXT('包含关联资料；已有内容保留，勾选冲突才更新。'))}</p><ul class="archive-preview-list">${items.join('')}</ul></section>`;
}
async function openPersonalImport({archive:provided=null,sourceMode=null}={}){
 const recovering=!!loadError&&workspaceMode==='local',sourceRepository=repository,sourceWorkspace=workspaceMode;
 if(!modal(UI_TEXT('恢复与迁移备份'),UI_HTML`<form id="personal-import-form">${provided?'':field(UI_TEXT('选择备份文件'),'<input name="backup" type="file" accept=".json,application/json" required>')}<p class="form-tip">${esc(UI_TEXT(recovering?'先核对完整备份；确认之前不会改变损坏数据。':'先预览，不会自动上传示例或复活回收站。'))}</p><div id="personal-import-preview"></div><p class="form-error" role="alert" hidden></p><div class="form-actions"><button type="button" class="button secondary" data-action="close">取消</button><button type="button" id="preview-personal-import" class="button">预览备份</button><button type="submit" id="confirm-personal-import" class="button" hidden>确认导入</button></div></form>`,{recovery:recovering}))return;
 const form=$('#personal-import-form'),previewArea=$('#personal-import-preview'),previewButton=$('#preview-personal-import'),confirmButton=$('#confirm-personal-import'),ctx=form.__pawContext;
 let archive=provided,preview=null,selection=null;
 const current=()=>form.isConnected&&ctx.generation===session.generation&&repository===sourceRepository&&workspaceMode===sourceWorkspace;
 function requireCurrent(){if(!current())throw accountBoundaryError();}
 function inputSelection(){const all=Object.fromEntries(['pet','record','reminder','asset'].map(k=>[k,[]]));for(const el of form.querySelectorAll('[data-import-kind]:checked'))all[el.dataset.importKind].push(el.value);return {petIds:all.pet,recordIds:all.record,reminderIds:all.reminder,assetIds:all.asset,profile:!!form.querySelector('[name=migrate-city]')?.checked};}
 function accepted(){return [...form.querySelectorAll('[data-import-conflict]:checked')].map(el=>el.value);}
 function cloudPayload(){return {sourceWorkspaceId:archive.sourceWorkspaceId,snapshot:archive.snapshot,selection:{petIds:selection.petIds,recordIds:selection.recordIds,reminderIds:selection.reminderIds,assetIds:selection.assetIds},copyCity:selection.profile===true,assets:archive.assets.map(a=>a.metadata),acceptConflicts:accepted()};}
 function showRecovery(){
  const confirmed=!!form.querySelector('[name=confirm-corrupt-recovery]')?.checked;
  previewArea.innerHTML=UI_HTML`<h3>按备份全量恢复</h3><p class="demo-note" data-ui-copy>这是全量替换，不是合并。备份之后的编辑和删除可能回退；照片和回收站将按备份原样恢复。</p><p class="demo-note" data-ui-copy>确认前可下载原坏数据；只有恢复成功后，原坏数据与媒体才会保留到恢复记录。</p><p>${esc(importSummary(preview))}</p>${preview.potentialRestorations.length?UI_HTML`<p>${esc(translate('backup.potentialRestorations',{count:preview.potentialRestorations.length}))}</p>`:''}<ul class="archive-preview-list">${preview.newPets.map(p=>`<li>${esc(p.name)}${p.deletedAt?' · '+esc(UI_TEXT('在回收站')):''}</li>`).join('')}</ul><button type="button" id="download-corrupt-raw" class="button secondary">下载原坏数据</button><label class="archive-option"><input type="checkbox" name="confirm-corrupt-recovery" ${confirmed?'checked':''}><span data-ui-copy>我理解全量恢复可能回退编辑与删除，确认按备份替换当前损坏档案。</span></label>`;
  form.querySelector('#download-corrupt-raw').addEventListener('click',()=>download(preview.rawBackup,`paw-diary-original-${today()}.txt`,'text/plain;charset=utf-8'));
  confirmButton.hidden=false;confirmButton.disabled=!confirmed;confirmButton.textContent=UI_TEXT('确认全量恢复');
 }
 function showNormal(){
  const chosen=new Set(accepted()),conflicts=preview.conflicts??[],result=form.querySelector('#personal-import-result');
  result.innerHTML=UI_HTML`<p data-ui-copy>预览已准备，未保存任何资料。</p><p>${esc(importSummary(preview))}</p>${importClosureMarkup(archive,preview,selection)}${conflicts.map(c=>{const id=sourceWorkspace==='account'?c.sourceId:c.id;if(typeof id!=='string'||!id)throw Object.assign(new Error('INVALID_INPUT'),{code:'INVALID_INPUT'});const key=c.kind+':'+id,label=importItemLabel(archive,c.kind,id),oldLabel=c.current?.name||c.current?.title||c.current?.caption||label;return UI_HTML`<label class="archive-option"><input type="checkbox" data-import-conflict value="${esc(key)}" ${chosen.has(key)?'checked':''}><span>${esc(label)} · ${esc(UI_TEXT(c.effect==='restore'?'恢复':c.effect==='trash'?'移入回收站':'覆盖更新'))}<small>${esc(UI_TEXT('当前：'))}${esc(oldLabel)}<br>${esc(UI_TEXT('备份：'))}${esc(label)}</small></span></label>`;}).join('')}`;
  confirmButton.hidden=false;confirmButton.disabled=false;confirmButton.textContent=UI_TEXT('确认导入');
 }
 form.__pawLocaleRefresh=()=>{if(preview&&current()){if(recovering)showRecovery();else showNormal();previewButton.textContent=UI_TEXT('重新预览');}};
 async function previewNow(){if(saving)return;previewButton.disabled=true;try{
  if(!archive){const file=new FormData(form).get('backup');if(!file?.size)throw Error(UI_TEXT('请选择有效备份文件。'));if(file.size>100*1024*1024)throw Error(UI_TEXT('备份超过100MiB上限'));archive=await validateArchive(await file.text());}else archive=await validateArchive(archive);requireCurrent();
  if(recovering){preview=await sourceRepository.previewCorruptArchiveRestore(archive);requireCurrent();showRecovery();previewButton.textContent=UI_TEXT('重新预览');dirty=true;return;}
  if(!selection){selection={petIds:[],recordIds:[],reminderIds:[],assetIds:[]};let markup=UI_HTML`<p data-ui-copy>选择要导入的内容，关联依赖会在下一次预览中显示。</p><div class="archive-preview-list">`;
   for(const [kind,field] of [['pet','pets'],['record','records'],['reminder','reminders']])for(const item of archive.snapshot[field])markup+=UI_HTML`<label class="archive-option"><input type="checkbox" data-import-kind="${kind}" value="${esc(item.id)}" ${sourceMode==='demo'?'':'checked'}>${esc(item.name||item.title)} ${item.deletedAt?UI_TEXT('· 在回收站'):''}</label>`;
   for(const asset of archive.assets)markup+=UI_HTML`<label class="archive-option"><input type="checkbox" data-import-kind="asset" value="${esc(asset.metadata.id)}" ${sourceMode==='demo'?'':'checked'}>${esc(importItemLabel(archive,'asset',asset.metadata.id))}</label>`;
   markup+=UI_HTML`</div><label><input type="checkbox" name="migrate-city"><span data-ui-copy>同时迁移城市设置</span></label><div id="personal-import-result"></div>`;previewArea.innerHTML=markup;
  }
  selection=inputSelection();
  if(sourceWorkspace==='account')preview=await sourceRepository.request('imports.preview',cloudPayload());else preview=await previewArchiveImport({repository:sourceRepository,archive,selection});
  requireCurrent();showNormal();previewButton.textContent=UI_TEXT('重新预览');dirty=true;
 }catch(error){if(current())showFormError(form,error);}finally{if(current())previewButton.disabled=false;}}
 previewButton.addEventListener('click',previewNow);
 form.addEventListener('change',e=>{if(e.target.name==='backup'){archive=null;selection=null;preview=null;previewArea.replaceChildren();confirmButton.hidden=true;confirmButton.disabled=false;}else if(e.target.name==='confirm-corrupt-recovery'){confirmButton.disabled=!e.target.checked;}else if(e.target.dataset.importKind||e.target.name==='migrate-city'){preview=null;confirmButton.hidden=true;}});
 form.addEventListener('submit',async e=>{e.preventDefault();if(!preview){showFormError(form,Error(UI_TEXT('请先重新预览当前选择。')));return;}if(!current())return;
  if(recovering&&!form.querySelector('[name=confirm-corrupt-recovery]')?.checked){showFormError(form,Object.assign(new Error('RECOVERY_CONFIRMATION_REQUIRED'),{code:'RECOVERY_CONFIRMATION_REQUIRED',messageKey:'error.recoveryConfirmation'}));return;}
  await submitOperation(form,async boundRepo=>{
   if(recovering)return boundRepo.commitCorruptArchiveRestore(preview);
   if(sourceWorkspace==='local')return commitArchiveImport({repository:boundRepo,preview,acceptedConflictIds:accepted()});
   const acceptedKeys=accepted(),prepared=await boundRepo.request('imports.prepare',cloudPayload(),{baseRevision:preview.revision,operationId:ctx.operationId+':prepare'});requireCurrent();
   const preparedPreview=prepared.preview,selected=new Set(preparedPreview.closure.assetIds),duplicates=new Set((preparedPreview.duplicates??[]).filter(d=>d.kind==='asset').map(d=>d.sourceId)),tickets=[];
   for(const asset of archive.assets){const id=asset.metadata.id;if(!selected.has(id))continue;const conflict=(preparedPreview.conflicts??[]).find(c=>c.kind==='asset'&&c.sourceId===id);
    if(duplicates.has(id)&&!(conflict?.effect==='restore'&&acceptedKeys.includes('asset:'+id)))continue;
    tickets.push(await boundRepo.media.stageImport({batchId:prepared.batchId,metadata:asset.metadata,blob:asset.blob,baseRevision:preparedPreview.revision,operationId:ctx.operationId+':asset:'+id}));requireCurrent();}
   return boundRepo.request('imports.commit',{batchId:prepared.batchId,assetTickets:tickets},{baseRevision:preparedPreview.revision,operationId:ctx.operationId+':commit'});
  },UI_TEXT(recovering?'全量恢复已完成，原坏数据和媒体已保留恢复记录。':'导入已完成，原本地资料仍保留。'));
 });
 if(provided)await previewNow();
}
async function openCloudMigration(){
 if(workspaceMode!=='account')return;
 if(!modal(UI_TEXT('选择本地来源'),UI_HTML`<p class="demo-note">只复制你选择的资料；示例默认不勾选，原本地资料不会删除。</p><div class="form-actions"><button class="button secondary" id="migrate-personal">我的本地档案</button><button class="button secondary" id="migrate-demo">示例中的自建资料</button><button class="button" data-action="close">返回</button></div>`))return;
 const originGeneration=session.generation,originRepository=repository,originPicker=$('#migrate-personal');let preparingSource=false;
 const currentPicker=()=>originPicker.isConnected&&dialog.open&&session.generation===originGeneration&&repository===originRepository&&workspaceMode==='account';
 async function choose(mode){if(preparingSource||!currentPicker())return;preparingSource=true;const buttons=[$('#migrate-personal'),$('#migrate-demo')];buttons.forEach(button=>button.disabled=true);try{const source=getLocalRepository(mode);await source.snapshot();if(!currentPicker())return;let archive;if(mode==='demo'){archive=await validateArchive(await source.getRawBackup());archive.sourceWorkspaceId='demo:explicit-selection';}else archive=await exportArchive({repository:source});if(!currentPicker())return;closeModal(true);await openPersonalImport({archive,sourceMode:mode});}catch(error){if(currentPicker())toast(localizeError(error));}finally{preparingSource=false;if(currentPicker())buttons.forEach(button=>button.disabled=false);}}
 $('#migrate-personal').addEventListener('click',()=>choose('local'));$('#migrate-demo').addEventListener('click',()=>choose('demo'));
}

async function boot(){try{if(!repository){const saved=localStorage.getItem('paw-diary:workspace-mode');workspaceMode=saved==='local'?'local':'demo';repository=await getLocalRepository(workspaceMode);session=createAppSession(repository);}loadError=null;render();await session.load();syncState();route();if(localStorage.getItem('paw-diary:workspace-mode')==='account'&&initCloudAccount()){const principal=await auth.getSession();if(principal){assignAuthPrincipal(principal);await switchWorkspace('account');}}}catch(error){loadError=error;render();}finally{helpBootReady=true;helpCoordinator?.ready();void updateMonitor?.check();}}
$('#locale-select').addEventListener('change',e=>setLocale(e.target.value));$('#dialog-locale-select').addEventListener('change',e=>setLocale(e.target.value));
subscribeLocale(()=>{applyLocaleChrome();if(publicSurface){publicSurface.refreshLocale();refreshPublicChrome();}else render();localizeOpenDialog();photoWall?.render().catch(e=>toast(localizeError(e)));helpPanel?.refreshLocale();whatsNewPanel?.refreshLocale();guidedTour?.refresh();if(installPanel?.isOpen())openInstallHelp();$('#dialog-help-button').textContent=getLocale()==='en'?'Help':'帮助';const banner=$('#update-available');if(banner&&!banner.hidden)banner.textContent=getLocale()==='en'?'Update available':'新版可用';});
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&workspaceMode==='account'){try{await session.refresh();syncState();render();}catch(error){if(error.code==='UNAUTHENTICATED'){assignAuthPrincipal(null);await switchWorkspace('local');}else toast(localizeError(error));}}});

initializeHelp();boot();
