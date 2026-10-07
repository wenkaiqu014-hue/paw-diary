export const BUILTIN_RECORD_TYPES = Object.freeze([
  {id:'weight',type:'weight',name:'体重',iconKey:'weight',builtin:true},
  {id:'vaccine',type:'vaccine',name:'疫苗',iconKey:'vaccine',builtin:true},
  {id:'deworm',type:'deworm',name:'驱虫',iconKey:'shield',builtin:true},
  {id:'daily',type:'daily',name:'日常',iconKey:'camera',builtin:true},
]);
export const CUSTOM_RECORD_ICONS = Object.freeze(['book','paw','drop']);
export const MAX_CUSTOM_RECORD_TYPES = 3;
const builtinIds=BUILTIN_RECORD_TYPES.map(x=>x.id);
const fail=message=>{throw new Error(message);};
export function normalizeRecordTypeCatalog(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.order)||!Array.isArray(raw.custom))fail('记录类型目录格式无效');
  const seen=new Set(builtinIds);
  const custom=raw.custom.map(item=>{
    if(!item||typeof item.id!=='string'||!/^custom:[^\s]{1,190}$/.test(item.id)||seen.has(item.id))fail('自定义记录类型ID无效或重复');seen.add(item.id);
    if(typeof item.name!=='string'||!item.name.trim()||item.name.trim().length>20)fail('自定义记录类型名称需为1到20字');
    if(!CUSTOM_RECORD_ICONS.includes(item.iconKey))fail('自定义记录类型图标无效');
    const deletedAt=item.deletedAt??null;if(deletedAt!==null&&(typeof deletedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(deletedAt)||!Number.isFinite(Date.parse(deletedAt))))fail('记录类型删除时间无效');
    return {id:item.id,name:item.name.trim(),iconKey:item.iconKey,deletedAt:deletedAt===null?null:new Date(deletedAt).toISOString()};
  });
  const active=custom.filter(x=>x.deletedAt===null);if(active.length>MAX_CUSTOM_RECORD_TYPES)fail('最多添加3个自定义类型');
  const names=new Set(BUILTIN_RECORD_TYPES.map(x=>x.name.toLocaleLowerCase()));for(const item of active){const name=item.name.toLocaleLowerCase();if(names.has(name))fail('记录类型名称不能重复');names.add(name);}
  const allowed=[...builtinIds,...active.map(x=>x.id)];if(raw.order.length!==allowed.length||new Set(raw.order).size!==allowed.length||raw.order.some(id=>!allowed.includes(id)))fail('记录类型排序需包含全部活跃类型且不能重复');
  return {version:1,order:[...raw.order],custom};
}
export function recordTypeEntries(snapshot,{includeHistoricalRecord=null}={}){
  const raw=snapshot?.profile?.recordTypeCatalog,catalog=raw===undefined?{version:1,order:[...builtinIds],custom:[]}:normalizeRecordTypeCatalog(raw);
  const entries=[...BUILTIN_RECORD_TYPES.map(x=>({...x})),...catalog.custom.filter(x=>x.deletedAt===null).map(x=>({id:x.id,type:'other',name:x.name,iconKey:x.iconKey,builtin:false}))];
  const map=new Map(entries.map(x=>[x.id,x]));const result=catalog.order.map(id=>map.get(id));
  if(includeHistoricalRecord?.type==='other'||includeHistoricalRecord?.recordType==='other'){
    const r=includeHistoricalRecord,id=r.customTypeId??'historical:other';if(!map.has(id))result.push({id,type:'other',name:r.typeLabel||'其他',iconKey:r.iconKey||'book',builtin:false,historical:true});
  }
  return result;
}
export function applyRecordTypeCommand(snapshot,command,{idFactory=()=>globalThis.crypto.randomUUID(),now=new Date().toISOString()}={}){
  const next=structuredClone(snapshot);next.profile??={};const current=next.profile.recordTypeCatalog??{version:1,order:[...builtinIds],custom:[]};let catalog=normalizeRecordTypeCatalog(current);
  if(command?.action==='add'){
    if(catalog.custom.filter(x=>x.deletedAt===null).length>=MAX_CUSTOM_RECORD_TYPES)fail('最多添加3个自定义类型，请先在管理中删除一个');
    const id=`custom:${idFactory()}`;catalog.custom.push({id,name:command.name,iconKey:command.iconKey??'book',deletedAt:null});catalog.order.push(id);
  }else if(command?.action==='delete'){
    const ids=command.ids??(command.id?[command.id]:[]);if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)fail('请选择要删除的自定义类型');
    if(ids.some(id=>builtinIds.includes(id)))fail('内置类型不能删除');
    if(ids.some(id=>!catalog.custom.some(x=>x.id===id&&x.deletedAt===null)))fail('自定义类型不存在');
    for(const item of catalog.custom)if(ids.includes(item.id))item.deletedAt=now;catalog.order=catalog.order.filter(id=>!ids.includes(id));
  }else if(command?.action==='reorder'){catalog.order=command.ids;}else fail('类型管理操作无效');
  next.profile.recordTypeCatalog=normalizeRecordTypeCatalog(catalog);return next;
}
