import {validateSnapshot,isoTime} from './schema.js?v=0.2.0';
const fields={pet:'pets',record:'records',reminder:'reminders'};

export function visibleHealth(snapshot) {
  const full=validateSnapshot(snapshot),pets=full.pets.filter(p=>p.deletedAt===null),petIds=new Set(pets.map(p=>p.id));
  return {pets,records:full.records.filter(r=>r.deletedAt===null&&petIds.has(r.petId)),reminders:full.reminders.filter(r=>r.deletedAt===null&&petIds.has(r.petId)),activePetId:full.activePetId};
}

function selection(state,input) {
  if(!input||!Object.hasOwn(fields,input.kind))throw new Error('回收站资料类型无效');
  if(!Array.isArray(input.ids)||!input.ids.length||input.ids.some(id=>typeof id!=='string'||!id.trim()))throw new Error('请选择有效资料');
  const field=fields[input.kind],items=new Map(state[field].map(item=>[item.id,item]));
  const selected=[...new Set(input.ids)].map(id=>{const item=items.get(id);if(!item)throw new Error('所选资料不存在');return item;});
  if(input.petId!==undefined){if(typeof input.petId!=='string'||!state.pets.some(p=>p.id===input.petId))throw new Error('宠物不存在');if(selected.some(item=>input.kind==='pet'?item.id!==input.petId:item.petId!==input.petId))throw new Error('所选资料不属于当前宠物');}
  return selected;
}
function chooseActive(state) {
  if(!state.pets.some(p=>p.id===state.activePetId&&p.deletedAt===null))state.activePetId=state.pets.find(p=>p.deletedAt===null)?.id??null;
}
export function moveToTrash(state,input,{now=new Date().toISOString()}={}) {
  const next=validateSnapshot(state),items=selection(next,input),timestamp=isoTime(now);
  if(input.kind!=='pet'&&items.some(item=>next.pets.find(p=>p.id===item.petId).deletedAt!==null))throw new Error('请先恢复所属宠物');
  const newlyTrashed=items.some(item=>item.deletedAt===null);
  for(const item of items){
    if(item.deletedAt!==null)continue;
    item.deletedAt=timestamp;
    if(input.kind==='record')for(const reminder of next.reminders)if(reminder.originRecordId===item.id&&reminder.status==='pending')reminder.status='cancelled';
  }
  if(input.kind==='pet'&&newlyTrashed)next.activePetId=next.pets.find(p=>p.deletedAt===null)?.id??null;else chooseActive(next);return validateSnapshot(next);
}
export function restoreFromTrash(state,input) {
  const next=validateSnapshot(state),items=selection(next,input);
  if(input.kind!=='pet'&&items.some(item=>next.pets.find(p=>p.id===item.petId).deletedAt!==null))throw new Error('请先恢复所属宠物');
  for(const item of items)item.deletedAt=null;
  chooseActive(next);return validateSnapshot(next);
}
export function reorderPets(state,orderedVisiblePetIds) {
  const next=validateSnapshot(state),visible=next.pets.filter(p=>p.deletedAt===null),map=new Map(visible.map(p=>[p.id,p]));
  if(!Array.isArray(orderedVisiblePetIds)||orderedVisiblePetIds.length!==visible.length||new Set(orderedVisiblePetIds).size!==visible.length||orderedVisiblePetIds.some(id=>!map.has(id)))throw new Error('排序必须包含所有可见宠物且不能重复');
  let index=0;next.pets=next.pets.map(p=>p.deletedAt===null?map.get(orderedVisiblePetIds[index++]):p);return validateSnapshot(next);
}
