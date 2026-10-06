import {clone,validateSnapshot,normalizePet,todayAt,isoTime,requiredText} from '../domain/schema.js?v=0.2.0';
import {applyRecord,removeRecord,defaultId} from '../domain/records.js?v=0.2.0';
import {applyReminder,completeReminder as finishReminder} from '../domain/reminders.js?v=0.2.0';
import {moveToTrash as trash,restoreFromTrash as restore,reorderPets as reorder} from '../domain/lifecycle.js?v=0.2.0';
import {createIndexedDBStore,storageError} from './indexeddb-store.js';
import {createMediaRepository} from './media-repository.js';
import {exportArchive,previewArchiveImport,commitArchiveImport} from '../domain/archive.js';
export function createLocalRepository({indexedDB=globalThis.indexedDB,dbName='paw-diary-personal',clock=()=>new Date().toISOString(),idFactory=defaultId,mediaMaxBytes=50*1024*1024}={}){
  const store=createIndexedDBStore({indexedDB,dbName});let envelope=null,initialization,queue=Promise.resolve();
  const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  const initialize=()=>initialization??=(store.initialize({snapshot:{version:3,mode:'local',pets:[],records:[],reminders:[],posts:[],activePetId:null,profile:{city:'深圳'}},revision:0,workspaceId:idFactory(),receipts:{},importMaps:{}}).then(value=>{value.snapshot=validateSnapshot(value.snapshot);if(value.snapshot.mode!=='local')throw storageError('INVALID_INPUT','个人档案模式无效');envelope=value;}).catch(error=>{initialization=undefined;throw error;}));
  const run=fn=>serial(async()=>{await initialize();return fn();});
  async function write(fn,{baseRevision,incrementRevision=true,idempotency}={}){const expected=baseRevision??envelope.revision;let committed;
    const result=await store.transaction(idempotency?undefined:expected,ctx=>{
      if(idempotency){const receipt=ctx.envelope.receipts?.[idempotency.operationId];if(receipt){if(receipt.signature!==idempotency.signature)throw storageError('INVALID_INPUT','同一操作标识对应不同内容');committed=clone(ctx.envelope);return clone(receipt.result);}if(ctx.envelope.revision!==expected)throw storageError('CONFLICT','资料已在另一窗口更新，请刷新后重试');}
      ctx.envelope.snapshot=validateSnapshot(ctx.envelope.snapshot);
      const result=fn(ctx);
      ctx.envelope.snapshot=validateSnapshot(ctx.envelope.snapshot);
      if(ctx.envelope.snapshot.mode!=='local')throw storageError('INVALID_INPUT','本地仓储只接受个人资料');
      if(incrementRevision&&!ctx.unchanged)ctx.envelope.revision++;
      committed=clone(ctx.envelope);return clone(result);
    });envelope=committed;return result;
  }
  const repo={
    getRevision:()=>envelope?.revision??0,getWorkspaceId:()=>envelope?.workspaceId??null,
    snapshot:()=>run(()=>clone(envelope.snapshot)),
    refresh:()=>run(async()=>{const next=(await store.read()).envelope;next.snapshot=validateSnapshot(next.snapshot);if(next.snapshot.mode!=='local')throw storageError('INVALID_INPUT','个人档案模式无效');envelope=next;return clone(next.snapshot);}),
    savePet:input=>run(()=>write(ctx=>{const next=ctx.envelope.snapshot,old=input.id?next.pets.find(p=>p.id===input.id):null;if(input.id&&!old)throw new Error('宠物不存在');if(old?.deletedAt)throw new Error('宠物已在回收站，请先恢复');if(input.deletedAt!=null)throw new Error('请通过回收站操作移入资料');const pet=normalizePet({birthday:null,estimatedAgeMonths:null,arrivalDate:null,breed:'',sex:'',image:input.type==='cat'?'assets/cat.jpg':input.type==='dog'?'assets/dog.jpg':'',...old,...input,id:old?.id??idFactory()});if(input.avatarAssetId!==undefined&&input.avatarAssetId!==old?.avatarAssetId)throw new Error('请通过头像上传更新头像');const today=todayAt(isoTime(clock()));if(pet.birthday>today||pet.arrivalDate>today)throw new Error('生日或到家日期不能晚于今天');if(old)next.pets[next.pets.indexOf(old)]=pet;else next.pets.push(pet);if(input.makeActive===true||!next.activePetId)next.activePetId=pet.id;return pet;},{baseRevision:input.baseRevision})),
    saveRecord:input=>run(()=>write(ctx=>{ctx.envelope.snapshot=applyRecord(ctx.envelope.snapshot,input,{now:clock(),idFactory});return input.id?ctx.envelope.snapshot.records.find(r=>r.id===input.id):ctx.envelope.snapshot.records[0];},{baseRevision:input.baseRevision})),
    deleteRecord:id=>run(async()=>{await write(ctx=>{ctx.envelope.snapshot=removeRecord(ctx.envelope.snapshot,id,{now:clock()});});}),
    saveReminder:input=>run(()=>write(ctx=>{ctx.envelope.snapshot=applyReminder(ctx.envelope.snapshot,input,{now:clock(),idFactory});return input.id?ctx.envelope.snapshot.reminders.find(r=>r.id===input.id):ctx.envelope.snapshot.reminders[0];},{baseRevision:input.baseRevision})),
    completeReminder:(id,input)=>run(()=>write(ctx=>{const result=finishReminder(ctx.envelope.snapshot,id,input,{now:clock(),idFactory});ctx.envelope.snapshot=result.state;return {reminder:result.reminder,record:result.record};},{baseRevision:input?.baseRevision})),
    moveToTrash:input=>run(()=>write(ctx=>ctx.envelope.snapshot=trash(ctx.envelope.snapshot,input,{now:clock()}),{baseRevision:input.baseRevision})),
    restoreFromTrash:input=>run(()=>write(ctx=>ctx.envelope.snapshot=restore(ctx.envelope.snapshot,input),{baseRevision:input.baseRevision})),
    reorderPets:ids=>run(()=>write(ctx=>ctx.envelope.snapshot=reorder(ctx.envelope.snapshot,ids))),
    selectPet:id=>run(async()=>{await write(ctx=>{if(!ctx.envelope.snapshot.pets.some(p=>p.id===id&&p.deletedAt===null))throw new Error('宠物不存在或已在回收站');ctx.envelope.snapshot.activePetId=id;},{incrementRevision:false});}),
    saveProfile:input=>run(()=>write(ctx=>{ctx.envelope.snapshot.profile.city=requiredText(input.city,'城市');return clone(ctx.envelope.snapshot.profile);},{baseRevision:input.baseRevision})),
    replaceSnapshot:snapshot=>serial(async()=>{
      const checked=validateSnapshot(snapshot);if(checked.mode!=='local')throw new Error('本地仓储只接受个人资料');
      let current=(await store.read()).envelope;if(!current){await initialize();current=clone(envelope);}
      let committed;const expected=envelope?.revision??current.revision;
      await store.transaction(expected,ctx=>{for(const pet of checked.pets)if(pet.avatarAssetId&&!ctx.media.has(pet.avatarAssetId))throw new Error('头像文件缺失，请使用完整备份恢复');
        ctx.envelope.recoverySnapshots??=[];ctx.envelope.recoverySnapshots.push({savedAt:clock(),raw:JSON.stringify(ctx.envelope.snapshot)});
        ctx.envelope.snapshot=checked;ctx.envelope.revision++;committed=clone(ctx.envelope);
      });envelope=committed;initialization=Promise.resolve();return clone(envelope.snapshot);
    }),
    getRawBackup:()=>serial(async()=>{const saved=(await store.read()).envelope;if(saved)return JSON.stringify(saved.snapshot);await initialize();return JSON.stringify(envelope.snapshot);}),
    // Storage-bound helpers. Async hashing/decoding happens before entering the IDB transaction.
    _mediaRead:fn=>run(async()=>fn(await store.read())),
    _mediaWrite:(fn,options)=>run(()=>write(fn,options)),
    _mediaOptions:{clock,idFactory,mediaMaxBytes},
    _archiveCommit:(fn,baseRevision)=>run(()=>write(fn,{baseRevision})),
    close:()=>store.close()
  };
  repo.media=createMediaRepository({repository:repo});
  repo.exportArchive=options=>exportArchive({repository:repo,...options});
  repo.previewArchiveImport=(archive,selection)=>previewArchiveImport({repository:repo,archive,selection});
  repo.commitArchiveImport=(preview,options={})=>commitArchiveImport({repository:repo,preview,...options});
  return repo;
}
