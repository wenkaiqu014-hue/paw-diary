export function createDiscardConfirm({document=globalThis.document,getLocale=()=> 'zh-CN'}={}){
 let dialog=null,pending=null,origin=null;
 const copy=(zh,en)=>getLocale()==='en'?en:zh;
 const finish=value=>{if(!pending)return;const callback=pending;pending=null;dialog.close();if(!value&&origin?.isConnected)origin.focus({preventScroll:true});callback(value);};
 function build(){
  dialog=document.createElement('dialog');dialog.id='discard-dialog';dialog.className='discard-dialog';dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-labelledby','discard-title');dialog.setAttribute('aria-describedby','discard-description');
  dialog.innerHTML='<h2 id="discard-title"></h2><p id="discard-description"></p><div class="discard-actions"><button type="button" class="button" data-discard-keep></button><button type="button" class="button secondary danger-text" data-discard-confirm></button></div>';
  dialog.querySelector('[data-discard-keep]').addEventListener('click',()=>finish(false));dialog.querySelector('[data-discard-confirm]').addEventListener('click',()=>finish(true));
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)finish(false);}});document.body.append(dialog);
 }
 return {ask(callback){if(pending)return;if(!dialog)build();origin=document.activeElement;pending=callback;dialog.querySelector('h2').textContent=copy('放弃未保存的修改？','Discard unsaved changes?');dialog.querySelector('p').textContent=copy('尚未保存的内容会丢失，已保存的数据不受影响。','Unsaved content will be lost. Saved data will remain unchanged.');dialog.querySelector('[data-discard-keep]').textContent=copy('继续编辑','Keep editing');dialog.querySelector('[data-discard-confirm]').textContent=copy('放弃修改','Discard changes');dialog.showModal();dialog.querySelector('[data-discard-keep]').focus();},dismiss(){if(pending){pending=null;dialog.close();}},get open(){return !!dialog?.open;}};
}
