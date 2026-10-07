import {applyRecordTypeCommand} from '../domain/record-type-catalog.js';
import {clone,migrateV1,migrateV2,validateSnapshot,normalizePet,todayAt,isoTime} from '../domain/schema.js?v=0.2.0';
import {applyRecord,removeRecord,defaultId} from '../domain/records.js?v=0.2.0';
import {applyReminder,completeReminder as finishReminder} from '../domain/reminders.js?v=0.2.0';
import {moveToTrash as trash,restoreFromTrash as restore,reorderPets as reorder} from '../domain/lifecycle.js?v=0.2.0';
import {applyRecordBatch,applyEntryBatch} from '../domain/ai-drafts.js';
import {applyOnboarding} from '../domain/onboarding.js';
import {prepareSavedRecap,applySavedRecap} from '../domain/recap-facts.js';
import {createSeedState} from './seed.js?v=0.2.0';
export function createDemoRepository({storage,key='paw-diary:v3:demo',clock=()=>new Date().toISOString(),idFactory=defaultId,seedFactory=createSeedState}={}) {
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new Error('本地存储不可用');
  let state=null,queue=Promise.resolve(),expectedRaw=null,receipts={},revision=0;
  const serial=operation=>{const pending=queue.then(operation);queue=pending.catch(()=>{});return pending;};
  const changed=()=>new Error('资料已在另一窗口更新，请先复制当前输入，再刷新读取后重试。');
  const persist=async (candidate,expected=expectedRaw,sources=[],nextReceipts=receipts)=>{
    const checked=validateSnapshot(candidate);if(checked.mode!=='demo')throw new Error('演示仓储只接受本地演示数据');
    for(const source of sources){const read=storage.getItem(source.key),actual=read&&typeof read.then==='function'?await read:read;if(actual!==source.raw)throw changed();}
    // Keep a synchronous localStorage compare and write in the same task.
    const read=storage.getItem(key),actual=read&&typeof read.then==='function'?await read:read;
    if(actual!==expected)throw changed();
    const raw=JSON.stringify({...checked,_revision:revision+1,...(Object.keys(nextReceipts).length?{_operationReceipts:nextReceipts}:{})});await storage.setItem(key,raw);state=checked;revision++;receipts=clone(nextReceipts);expectedRaw=raw;return checked;
  };
  const preserve=async(prefix,raw)=>{
    const existing=await storage.getItem(prefix);
    if(existing===null){await storage.setItem(prefix,raw);return;}
    if(existing===raw)return;
    const dated=`${prefix}:${isoTime(clock())}`;let backupKey=dated,n=0;
    while(await storage.getItem(backupKey)!==null)backupKey=`${dated}:${++n}`;
    await storage.setItem(backupKey,raw);
  };
  const initialize=async()=>{
    if(state)return state;
    const saved=await storage.getItem(key);
    if(saved!==null){const checked=validateSnapshot(saved);if(checked.mode!=='demo')throw new Error('本地演示数据模式无效');state=checked;revision=JSON.parse(saved)._revision??0;const internal=JSON.parse(saved)._operationReceipts;receipts=internal&&typeof internal==='object'&&!Array.isArray(internal)?internal:{};expectedRaw=saved;return state;}
    const v2Key='paw-diary:v2:demo',v2=await storage.getItem(v2Key);
    if(v2!==null){const migrated=migrateV2(v2);return persist(migrated,null,[{key:v2Key,raw:v2}]);}
    const v1Key='paw-diary:v1',legacy=await storage.getItem(v1Key);
    if(legacy!==null){
      const migrated=migrateV1(legacy,{now:clock()});await preserve('paw-diary:v1:backup',legacy);
      return persist(migrated,null,[{key:v2Key,raw:null},{key:v1Key,raw:legacy}]);
    }
    return persist(await seedFactory({now:clock()}),null,[{key:v2Key,raw:null},{key:v1Key,raw:null}]);
  };
  const operation=fn=>serial(async()=>{await initialize();return fn();});
  return {
    getRevision:()=>revision,
    snapshot:()=>operation(()=>clone(state)),
    savePet:input=>operation(async()=>{
      const next=clone(state),old=input.id?next.pets.find(p=>p.id===input.id):null;if(input.id&&!old)throw new Error('宠物不存在');
      if(old&&old.deletedAt!==null)throw new Error('宠物已在回收站，请先恢复');
      if(input.deletedAt!==undefined&&input.deletedAt!==null)throw new Error('请通过回收站操作移入资料');
      const pet=normalizePet({birthday:null,estimatedAgeMonths:null,arrivalDate:null,breed:'',sex:'',image:input.type==='cat'?'assets/cat.jpg':input.type==='dog'?'assets/dog.jpg':'',...old,...input,id:old?.id??idFactory()});
      const today=todayAt(isoTime(clock()));if(pet.birthday>today||pet.arrivalDate>today)throw new Error('生日或到家日期不能晚于今天');
      if(old)next.pets[next.pets.findIndex(p=>p.id===pet.id)]=pet;else next.pets.push(pet);
      if(input.makeActive===true||!next.activePetId)next.activePetId=pet.id;await persist(next);return clone(pet);
    }),
    manageRecordTypes:(command,options={})=>operation(async()=>{
      const operationId=options.operationId??idFactory();if(typeof operationId!=='string'||!operationId.trim()||operationId.length>200)throw new Error('操作标识无效');const signature=JSON.stringify({action:'recordTypes.manage',command});
      if(Object.hasOwn(receipts,operationId)){if(receipts[operationId].signature!==signature)throw new Error('同一操作标识对应不同内容');return clone(receipts[operationId].result);}
      if(options.baseRevision!==undefined&&options.baseRevision!==revision)throw changed();
      const next=applyRecordTypeCommand(state,command,{now:clock(),idFactory}),data=next.profile.recordTypeCatalog,nextReceipts={...receipts,[operationId]:{signature,result:clone(data)}};await persist(next,expectedRaw,[],nextReceipts);return clone(data);
    }),
    saveRecord:input=>operation(async()=>{const next=applyRecord(state,input,{now:clock(),idFactory});await persist(next);return clone(input.id?state.records.find(r=>r.id===input.id):state.records[0]);}),
    saveRecordBatch:(inputs,options={})=>operation(async()=>{
      const operationId=options.operationId??idFactory();if(typeof operationId!=='string'||!operationId.trim()||operationId.length>200)throw new Error('操作标识无效');const signature=JSON.stringify({action:'records.saveBatch',inputs});
      if(Object.hasOwn(receipts,operationId)){if(receipts[operationId].signature!==signature)throw new Error('同一操作标识对应不同内容');return clone(receipts[operationId].result);}
      const result=applyRecordBatch(state,inputs,{now:clock(),idFactory}),data={records:result.records,reminders:result.reminders};const nextReceipts={...receipts,[operationId]:{signature,result:clone(data)}};await persist(result.snapshot,expectedRaw,[],nextReceipts);return clone(data);
    }),
    saveEntryBatch:(entries,options={})=>operation(async()=>{
      const operationId=options.operationId??idFactory();if(typeof operationId!=='string'||!operationId.trim()||operationId.length>200)throw new Error('操作标识无效');const signature=JSON.stringify({action:'entries.saveBatch',entries});
      if(Object.hasOwn(receipts,operationId)){if(receipts[operationId].signature!==signature)throw new Error('同一操作标识对应不同内容');return clone(receipts[operationId].result);}
      if(options.baseRevision!==undefined&&options.baseRevision!==revision)throw changed();
      const result=applyEntryBatch(state,entries,{now:clock(),idFactory}),data={records:result.records,reminders:result.reminders,entries:result.entries};const nextReceipts={...receipts,[operationId]:{signature,result:clone(data)}};await persist(result.snapshot,expectedRaw,[],nextReceipts);return clone(data);
    }),
    saveOnboarding:input=>operation(async()=>{const result=applyOnboarding(state,input,{now:clock()});await persist(result.snapshot);return clone(result.progress);}),
    saveRecap:input=>operation(async()=>{const recap=await prepareSavedRecap(state,input);await persist(applySavedRecap(state,recap));return clone(recap);}),
    deleteRecord:id=>operation(async()=>{await persist(removeRecord(state,id,{now:clock()}));}),
    moveToTrash:input=>operation(async()=>{await persist(trash(state,input,{now:clock()}));return clone(state);}),
    restoreFromTrash:input=>operation(async()=>{await persist(restore(state,input));return clone(state);}),
    reorderPets:ids=>operation(async()=>{await persist(reorder(state,ids));return clone(state);}),
    saveReminder:(input,options={})=>operation(async()=>{
      const operationId=options.operationId,signature=JSON.stringify({action:'reminders.save',input});if(operationId!==undefined&&(typeof operationId!=='string'||!operationId.trim()||operationId.length>200))throw new Error('操作标识无效');
      if(operationId!==undefined&&Object.hasOwn(receipts,operationId)){if(receipts[operationId].signature!==signature)throw new Error('同一操作标识对应不同内容');return clone(receipts[operationId].result);}
      if(options.baseRevision!==undefined&&options.baseRevision!==revision)throw changed();
      const next=applyReminder(state,input,{now:clock(),idFactory}),data=input.id?next.reminders.find(r=>r.id===input.id):next.reminders[0],nextReceipts=operationId===undefined?receipts:{...receipts,[operationId]:{signature,result:clone(data)}};await persist(next,expectedRaw,[],nextReceipts);return clone(data);
    }),
    completeReminder:(id,input)=>operation(async()=>{const result=finishReminder(state,id,input,{now:clock(),idFactory});await persist(result.state);return clone({reminder:result.reminder,record:result.record});}),
    selectPet:id=>operation(async()=>{if(!state.pets.some(p=>p.id===id&&p.deletedAt===null))throw new Error('宠物不存在或已在回收站');await persist({...clone(state),activePetId:id});}),
    mutate:mutator=>operation(async()=>{const next=clone(state);await mutator(next);await persist(next);return clone(state);}),
    replaceSnapshot:snapshot=>serial(async()=>{
      const checked=validateSnapshot(snapshot);if(checked.mode!=='demo')throw new Error('演示仓储只接受本地演示数据');
      const currentRaw=await storage.getItem(key),sources=[];let original=currentRaw;
      if(original===null){for(const legacyKey of ['paw-diary:v2:demo','paw-diary:v1']){const raw=await storage.getItem(legacyKey);sources.push({key:legacyKey,raw});if(raw!==null){original=raw;break;}}}
      if(state&&currentRaw!==expectedRaw)throw changed();
      if(original!==null){const prefix=`paw-diary:recovery-backup:${isoTime(clock())}`;let backupKey=prefix,n=0;while(await storage.getItem(backupKey)!==null)backupKey=`${prefix}:${++n}`;await storage.setItem(backupKey,original);}
      await persist(checked,currentRaw,sources,{});return clone(state);
    }),
    getRawBackup:()=>serial(async()=>{for(const sourceKey of [key,'paw-diary:v2:demo','paw-diary:v1']){const saved=await storage.getItem(sourceKey);if(saved!==null){if(sourceKey===key){try{const parsed=JSON.parse(saved);if(parsed._operationReceipts!==undefined)return JSON.stringify(validateSnapshot(parsed));}catch{}}return saved;}}return JSON.stringify(state);})
  };
}
