import {processImage} from '../media/process-image.js';
import {localizeError} from '../ui/error-localization.js';
const photoError=code=>Object.assign(new Error(code),{code});
export function validatePhotoSelection(files) {
  const selected=Array.from(files??[]);
  if(selected.length>10)throw photoError('batch_limit');
  for(const file of selected){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw photoError('media_type');
    if(file.size>10*1024*1024)throw photoError('media_size');
  }
  return selected;
}
// Session owns transient URLs. The view never persists signed or blob URLs.
export function createPhotoSession({media,getPetId,getGeneration=()=>0}) {
  let items=[],scope=null,request=0,destroyed=false,urlEpoch=0;
  const urls=new Map(),pending=new Map();
  const current=()=>`${getGeneration()}:${getPetId()??''}`;
  function releaseAll(){urlEpoch++;for(const entry of urls.values())entry.release?.();urls.clear();pending.clear();}
  function isCurrent(token){return !destroyed&&scope===token&&current()===token;}
  async function load(){
    const token=current(),serial=++request;
    if(scope!==token){releaseAll();items=[];scope=token;}
    const petId=getPetId();if(!petId){items=[];return items;}
    const collected=[],seen=new Set();let cursor;
    do {
      const result=await media.list({petId,cursor,limit:20});
      if(!isCurrent(token)||serial!==request)return items;
      const page=Array.isArray(result)?result:result?.items??result?.data?.items??[];
      for(const asset of page)if(asset.petId===petId&&asset.kind==='photo'&&!seen.has(asset.id)){collected.push(asset);seen.add(asset.id);}
      const next=Array.isArray(result)?null:result?.nextCursor??result?.data?.nextCursor;
      if(next===cursor&&next)throw photoError('unavailable');cursor=next;
    }while(cursor);
    if(isCurrent(token)&&serial===request){items=collected;for(const [id,entry]of urls)if(!seen.has(id)){entry.release?.();urls.delete(id);}}
    return items;
  }
  async function resolve(id){
    if(!items.some(item=>item.id===id)||!isCurrent(scope))return null;
    if(urls.has(id))return urls.get(id).url;
    if(pending.has(id))return pending.get(id);
    const token=scope,epoch=urlEpoch;
    const result=(async()=>{const entry=await media.resolveUrl(id);if(!isCurrent(token)||epoch!==urlEpoch||!items.some(item=>item.id===id)){entry.release?.();return null;}urls.set(id,entry);return entry.url;})();
    pending.set(id,result);
    try{return await result;}finally{if(pending.get(id)===result)pending.delete(id);}
  }
  return {load,resolve,releaseAll,getUrl:id=>urls.get(id)?.url??null,get items(){return items;},destroy(){if(destroyed)return;destroyed=true;request++;releaseAll();items=[];}};
}
export function createPhotoWall({media,getPetId,getGeneration=()=>0,getRevision,t,onChanged=()=>{},onError=()=>{},document=globalThis.document,prepareImage=processImage}={}) {
  if(!media||!getPetId||!t)throw new TypeError('Photo wall requires media, getPetId and t');
  const session=createPhotoSession({media,getPetId,getGeneration});
  let host,wall,title,description,form,fileInput,captionInput,uploadButton,filesLabel,captionLabel,hint,status,grid,slideshowButton,dialog,slideImage,slideCaption,counter,play,previous,next,close,deleteSlide;
  let draftScope=null,selected=[],failed=[],saving=false,destroyed=false,renderRequest=0,slideIndex=0,slideOrigin=null,timer=null,playing=false;
  const win=document?.defaultView??globalThis;
  const scope=()=>`${getGeneration()}:${getPetId()??''}`;
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function button(key,handler,className='button secondary'){const node=el('button',className,t(key));node.type='button';node.addEventListener('click',handler);return node;}
  function report(error){if(destroyed)return;status.textContent=localizeError(error,t);status.setAttribute('role','alert');onError(error);}
  function labels(){
    title.textContent=t('photo.title');description.textContent=t('photo.description');filesLabel.textContent=t('photo.files');captionLabel.textContent=t('photo.caption');hint.textContent=t('photo.fileHint');captionInput.placeholder=t('photo.captionPlaceholder');uploadButton.textContent=t(saving?'common.loading':'photo.upload');slideshowButton.textContent=t('photo.slideshow');
    if(dialog){dialog.querySelector('h2').textContent=t('photo.title');dialog.setAttribute('aria-label',t('photo.slideshowLabel'));play.textContent=t(playing?'photo.pause':'photo.play');previous.textContent=t('photo.previous');next.textContent=t('photo.next');close.textContent=t('common.close');deleteSlide.textContent=t('common.delete');}
  }
  function stopPlaying(){playing=false;if(timer!==null){win.clearInterval(timer);timer=null;}if(play){play.textContent=t('photo.play');play.setAttribute('aria-pressed','false');}}
  function showSlide(){
    if(!dialog?.open)return;
    if(!session.items.length){closeSlideshow();return;}
    slideIndex=(slideIndex+session.items.length)%session.items.length;
    const item=session.items[slideIndex],token=scope();
    slideCaption.textContent=item.caption||t('photo.untitled');slideImage.alt=item.caption||t('photo.untitled');counter.textContent=t('photo.counter',{current:slideIndex+1,total:session.items.length});
    const url=session.getUrl(item.id);slideImage.removeAttribute('src');
    if(url)slideImage.src=url;else session.resolve(item.id).then(resolved=>{if(dialog.open&&token===scope()&&session.items[slideIndex]?.id===item.id&&resolved)slideImage.src=resolved;}).catch(report);
    previous.disabled=next.disabled=session.items.length<2;
  }
  function advance(delta){slideIndex+=delta;showSlide();}
  function closeSlideshow(){
    stopPlaying();if(dialog?.open)dialog.close();
    if(slideImage)slideImage.removeAttribute('src');session.releaseAll();
    const target=slideOrigin?.isConnected&&!slideOrigin.disabled?slideOrigin:slideshowButton&&!slideshowButton.disabled?slideshowButton:uploadButton;target?.focus({preventScroll:true});slideOrigin=null;
  }
  function buildDialog(){
    dialog=el('dialog','paw-slideshow');dialog.setAttribute('aria-label',t('photo.slideshowLabel'));
    const heading=el('div','paw-slideshow-heading'),stage=el('div','paw-slideshow-stage'),footer=el('div','paw-slideshow-footer');
    close=button('common.close',closeSlideshow);heading.append(el('h2','',t('photo.title')),close);
    slideImage=el('img','paw-slideshow-image');slideImage.addEventListener('error',()=>{slideCaption.textContent=t('photo.imageError');});stage.append(slideImage);
    slideCaption=el('p','paw-slideshow-caption');counter=el('p','paw-slideshow-counter');counter.setAttribute('aria-live','polite');
    previous=button('photo.previous',()=>advance(-1));next=button('photo.next',()=>advance(1));
    play=button('photo.play',()=>{if(playing){stopPlaying();return;}playing=true;play.textContent=t('photo.pause');timer=win.setInterval(()=>advance(1),4000);});play.setAttribute('aria-pressed','false');
    play.addEventListener('click',()=>play.setAttribute('aria-pressed',String(playing)));
    deleteSlide=button('common.delete',()=>removePhoto(session.items[slideIndex]),'button secondary danger-text');
    footer.append(previous,play,next,deleteSlide,counter);dialog.append(heading,stage,slideCaption,footer);document.body.append(dialog);
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeSlideshow();});
    dialog.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA'].includes(event.target.tagName))return;if(event.key==='ArrowLeft'){event.preventDefault();advance(-1);}if(event.key==='ArrowRight'){event.preventDefault();advance(1);}});
    dialog.addEventListener('close',()=>{stopPlaying();session.releaseAll();});
  }
  function openSlideshow(assetId){
    if(!getPetId()||!session.items.length||destroyed)return;
    if(!dialog)buildDialog();if(dialog.open)return;
    slideOrigin=document.activeElement;slideIndex=Math.max(0,session.items.findIndex(item=>item.id===assetId));stopPlaying();labels();dialog.showModal();showSlide();close.focus();
  }
  async function removePhoto(item){
    if(!item||saving)return;
    if(!win.confirm(t('photo.deleteConfirm',{caption:item.caption||t('photo.untitled')})))return;
    const token=scope();saving=true;uploadButton.disabled=true;
    try{await media.remove({assetId:item.id,...(getRevision?{baseRevision:getRevision()}:{}),operationId:globalThis.crypto?.randomUUID?.()});if(token!==scope())return;await onChanged();saving=false;await render();status.textContent=t('photo.deleted');}
    catch(error){if(token===scope())report(error);}finally{saving=false;if(uploadButton)uploadButton.disabled=!getPetId();}
  }
  async function upload(event){
    event.preventDefault();if(saving||!getPetId())return;
    const entries=failed.length?failed:selected.map(file=>({file,operationId:globalThis.crypto?.randomUUID?.()}));
    if(!entries.length){fileInput.focus();return;}
    const petId=getPetId(),token=scope(),caption=captionInput.value.trim();saving=true;uploadButton.disabled=true;fileInput.disabled=captionInput.disabled=true;failed=[];status.setAttribute('role','status');
    for(let i=0;i<entries.length;i++){
      if(token!==scope()||destroyed)break;
      status.textContent=t('photo.saving',{current:i+1,total:entries.length});
      const entry=entries[i];
      try{if(!entry.blob){const prepared=await prepareImage(entry.file,{kind:'photo'});entry.blob=prepared instanceof Blob?prepared:prepared.blob;}if(token!==scope())break;await media.save({petId,kind:'photo',blob:entry.blob,caption,...(getRevision?{baseRevision:getRevision()}:{}),operationId:entry.operationId});}
      catch(error){failed.push(entry);onError(error);}
    }
    saving=false;if(destroyed)return;if(token!==scope()){uploadButton.disabled=fileInput.disabled=captionInput.disabled=!getPetId();labels();return;}
    selected=failed.map(entry=>entry.file);
    uploadButton.disabled=false;fileInput.disabled=captionInput.disabled=false;
    if(!failed.length){fileInput.value='';captionInput.value='';status.textContent=t('photo.saved');}
    else{status.setAttribute('role','alert');status.textContent=t('photo.partialFailure',{count:failed.length});}
    try{await onChanged();await render();}catch(error){report(error);}
  }
  function build(container){
    host=container;wall=el('section','paw-photo-wall panel');wall.dataset.photoWall='';
    const head=el('div','paw-photo-heading');title=el('h2');description=el('p','paw-photo-description');slideshowButton=button('photo.slideshow',()=>openSlideshow());head.append(title,slideshowButton);
    form=el('form','paw-photo-upload');
    const fileField=el('label','paw-photo-field');filesLabel=el('span');fileInput=el('input');fileInput.type='file';fileInput.multiple=true;fileInput.accept='image/jpeg,image/png,image/webp';fileInput.name='photos';hint=el('small');fileField.append(filesLabel,fileInput,hint);
    const captionField=el('label','paw-photo-field');captionLabel=el('span');captionInput=el('textarea');captionInput.name='photo-caption';captionInput.maxLength=200;captionInput.rows=2;captionField.append(captionLabel,captionInput);
    uploadButton=button('photo.upload',()=>{},'button');uploadButton.type='submit';
    form.append(fileField,captionField,uploadButton);form.addEventListener('submit',upload);
    fileInput.addEventListener('change',()=>{try{selected=validatePhotoSelection(fileInput.files);failed=[];status.textContent='';}catch(error){selected=[];failed=[];report(error);}});
    status=el('p','paw-photo-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');grid=el('div','paw-photo-grid');wall.append(head,description,form,status,grid);host.append(wall);labels();
  }
  async function render(){
    if(!wall||destroyed)return;const serial=++renderRequest,token=scope();
    if(draftScope!==token){draftScope=token;selected=[];failed=[];fileInput.value='';captionInput.value='';status.textContent='';if(dialog?.open)closeSlideshow();}
    labels();uploadButton.disabled=saving||!getPetId();fileInput.disabled=captionInput.disabled=saving||!getPetId();slideshowButton.disabled=true;
    if(!getPetId()){await session.load();grid.replaceChildren(el('p','paw-photo-empty',t('photo.noPet')));return;}
    grid.setAttribute('aria-busy','true');
    try{
      await session.load();if(serial!==renderRequest||token!==scope()||destroyed)return;
      grid.replaceChildren();
      if(!session.items.length){const empty=el('div','paw-photo-empty');empty.append(el('h3','',t('photo.empty')),el('p','',t('photo.emptyHint')));grid.append(empty);}
      for(const item of session.items){
        const tile=el('figure','paw-photo-tile'),view=button('photo.view',()=>openSlideshow(item.id),'paw-photo-view');view.setAttribute('aria-label',t('photo.view',{caption:item.caption||t('photo.untitled')}));view.textContent='';
        const image=el('img');image.loading='lazy';image.alt=item.caption||t('photo.untitled');image.width=480;image.height=360;
        const fallback=el('p','paw-photo-fallback',t('common.loading'));view.append(image,fallback);
        const caption=el('figcaption','paw-photo-caption',item.caption||t('photo.untitled'));
        const remove=button('common.delete',()=>removePhoto(item),'text-button danger-text');remove.setAttribute('aria-label',t('common.delete')+' '+(item.caption||t('photo.untitled')));
        const retry=button('common.retry',async()=>{try{const url=await session.resolve(item.id);if(url&&token===scope()){image.src=url;fallback.hidden=true;retry.hidden=true;}}catch(error){report(error);}},'text-button');retry.hidden=true;
        image.addEventListener('error',()=>{fallback.hidden=false;fallback.textContent=t('photo.imageError');retry.hidden=false;});image.addEventListener('load',()=>{fallback.hidden=true;retry.hidden=true;});
        tile.append(view,caption,remove,retry);grid.append(tile);
        session.resolve(item.id).then(url=>{if(url&&serial===renderRequest&&token===scope()&&!destroyed)image.src=url;}).catch(error=>{if(serial===renderRequest&&token===scope()){fallback.textContent=t('photo.imageError');retry.hidden=false;onError(error);}});
      }
      slideshowButton.disabled=!session.items.length;
      if(dialog?.open){if(!session.items.length)closeSlideshow();else{slideIndex=Math.min(slideIndex,session.items.length-1);showSlide();}}
    }catch(error){if(serial===renderRequest&&token===scope()){grid.replaceChildren(el('p','paw-photo-empty',t('photo.loadError')),button('common.retry',render));report(error);}}
    finally{if(serial===renderRequest)grid.setAttribute('aria-busy','false');}
  }
  return {async mount(container){if(destroyed)throw new Error('Photo wall was destroyed');if(!wall)build(container);await render();},render,openSlideshow,closeSlideshow,destroy(){if(destroyed)return;destroyed=true;renderRequest++;stopPlaying();if(dialog?.open)dialog.close();dialog?.remove();session.destroy();wall?.remove();}};
}
