import {clone,migrateV1,validateSnapshot,normalizePet,todayAt,isoTime} from '../domain/schema.js';
import {applyRecord,removeRecord,defaultId} from '../domain/records.js';
import {applyReminder,completeReminder as finishReminder} from '../domain/reminders.js';
import {createSeedState} from './seed.js';
export function createDemoRepository({storage,key='paw-diary:v2:demo',clock=()=>new Date().toISOString(),idFactory=defaultId,seedFactory=createSeedState}={}) {
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new Error('本地存储不可用');
  let state=null,queue=Promise.resolve(),expectedRaw=null;
  const serial=operation=>{const pending=queue.then(operation);queue=pending.catch(()=>{});return pending;};
  const persist=async (candidate,expected=expectedRaw)=>{
    const checked=validateSnapshot(candidate);if(checked.mode!=='demo')throw new Error('演示仓储只接受本地演示数据');
    const read=storage.getItem(key),actual=read&&typeof read.then==='function'?await read:read;
    if(actual!==expected)throw new Error('资料已在另一窗口更新，请先复制当前输入，再刷新读取后重试。');
    const raw=JSON.stringify(checked);await storage.setItem(key,raw);state=checked;expectedRaw=raw;return checked;
  };
  const initialize=async()=>{
    if(state)return state;
    const saved=await storage.getItem(key);
    if(saved!==null){const checked=validateSnapshot(saved);if(checked.mode!=='demo')throw new Error('本地演示数据模式无效');state=checked;expectedRaw=saved;return state;}
    const legacy=await storage.getItem('paw-diary:v1');
    if(legacy!==null){
      const migrated=migrateV1(legacy,{now:clock()}),existing=await storage.getItem('paw-diary:v1:backup');
      if(existing===null)await storage.setItem('paw-diary:v1:backup',legacy);
      else if(existing!==legacy){const prefix=`paw-diary:v1:backup:${isoTime(clock())}`;let backupKey=prefix,n=0;while(await storage.getItem(backupKey)!==null)backupKey=`${prefix}:${++n}`;await storage.setItem(backupKey,legacy);}
      return persist(migrated);
    }
    return persist(await seedFactory({now:clock()}));
  };
  const operation=fn=>serial(async()=>{await initialize();return fn();});
  return {
    snapshot:()=>operation(()=>clone(state)),
    savePet:input=>operation(async()=>{
      const next=clone(state),old=input.id?next.pets.find(p=>p.id===input.id):null;if(input.id&&!old)throw new Error('宠物不存在');
      const pet=normalizePet({birthday:null,estimatedAgeMonths:null,arrivalDate:null,breed:'',sex:'',image:input.type==='cat'?'assets/cat.jpg':'assets/dog.jpg',...old,...input,id:old?.id??idFactory()});
      const today=todayAt(isoTime(clock()));if(pet.birthday>today||pet.arrivalDate>today)throw new Error('生日或到家日期不能晚于今天');
      if(old)next.pets[next.pets.findIndex(p=>p.id===pet.id)]=pet;else next.pets.push(pet);
      if(input.makeActive===true||!next.activePetId)next.activePetId=pet.id;await persist(next);return clone(pet);
    }),
    saveRecord:input=>operation(async()=>{const next=applyRecord(state,input,{now:clock(),idFactory});await persist(next);return clone(input.id?state.records.find(r=>r.id===input.id):state.records[0]);}),
    deleteRecord:id=>operation(async()=>{await persist(removeRecord(state,id));}),
    saveReminder:input=>operation(async()=>{await persist(applyReminder(state,input,{now:clock(),idFactory}));return clone(input.id?state.reminders.find(r=>r.id===input.id):state.reminders[0]);}),
    completeReminder:(id,input)=>operation(async()=>{const result=finishReminder(state,id,input,{now:clock(),idFactory});await persist(result.state);return clone({reminder:result.reminder,record:result.record});}),
    selectPet:id=>operation(async()=>{if(!state.pets.some(p=>p.id===id))throw new Error('宠物不存在');await persist({...clone(state),activePetId:id});}),
    mutate:mutator=>operation(async()=>{const next=clone(state);await mutator(next);await persist(next);return clone(state);}),
    replaceSnapshot:snapshot=>serial(async()=>{
      const checked=validateSnapshot(snapshot);if(checked.mode!=='demo')throw new Error('演示仓储只接受本地演示数据');
      const currentRaw=await storage.getItem(key),original=currentRaw??await storage.getItem('paw-diary:v1');
      if(original!==null){const prefix=`paw-diary:recovery-backup:${isoTime(clock())}`;let backupKey=prefix,n=0;while(await storage.getItem(backupKey)!==null)backupKey=`${prefix}:${++n}`;await storage.setItem(backupKey,original);}
      if(state&&currentRaw!==expectedRaw)throw new Error('资料已在另一窗口更新，请重新读取后再次预览备份。');
      await persist(checked,currentRaw);return clone(state);
    }),
    getRawBackup:()=>serial(async()=>{const saved=await storage.getItem(key);if(saved!==null)return saved;const legacy=await storage.getItem('paw-diary:v1');return legacy??JSON.stringify(state);})
  };
}
