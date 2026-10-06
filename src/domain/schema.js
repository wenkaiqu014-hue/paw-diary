export const RECORD_TYPES = ['weight','vaccine','deworm','daily'];
export const clone = value => structuredClone(value);
function fail(message) { throw new Error(message); }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}格式无效`); return value; }
export function requiredText(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label}不能为空`); return value.trim(); }
function text(value, label) { if (value == null) return ''; if (typeof value !== 'string') fail(`${label}格式无效`); return value; }
function limited(value,label,max){if(value.length>max)fail(`${label}不能超过${max}字`);return value;}
export function validDate(value, label='日期') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${label}格式无效`);
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) fail(`${label}不是有效日期`);
  return value;
}
export function isoTime(value, label='时间') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(new Date(value).getTime())) fail(`${label}格式无效`);
  return new Date(value).toISOString();
}
export function todayAt(now) { const d = new Date(isoTime(now)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function nullableDate(value,label){return value==null?null:validDate(value,label);}
function deletedAt(value) { return value === null ? null : isoTime(value,'移入回收站时间'); }
export function validImage(value) {
  if (typeof value !== 'string') fail('图片地址无效');
  if (value === '' || /^(?:\.\/)?assets\/[A-Za-z0-9_./-]+$/.test(value) && !value.includes('..') || /^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=\s]+$/.test(value)) return value;
  try { const url = new URL(value); if(url.protocol==='https:' && !url.username && !url.password) return value; } catch {}
  fail('图片需使用本地素材、图片数据或 HTTPS 地址');
}
export function normalizePet(raw) {
  object(raw,'宠物'); const id=requiredText(raw.id,'宠物ID'), name=limited(requiredText(raw.name,'宠物名'),'宠物名',20);
  if(!['cat','dog'].includes(raw.type)) fail('宠物类型无效');
  const birthday=nullableDate(raw.birthday,'生日'), estimatedAgeMonths=raw.estimatedAgeMonths??null;
  const arrivalDate=nullableDate(raw.arrivalDate,'到家日期');
  if(birthday && arrivalDate && birthday>arrivalDate)fail('生日不能晚于来到家的日期');
  if(estimatedAgeMonths!==null && (!Number.isInteger(estimatedAgeMonths)||estimatedAgeMonths<0||estimatedAgeMonths>1200)) fail('估计月龄需为0到1200的整数');
  if(birthday && estimatedAgeMonths!==null) fail('生日和估计月龄只能填写一个');
  return {id,name,deletedAt:raw.deletedAt===undefined?null:deletedAt(raw.deletedAt),type:raw.type,birthday,estimatedAgeMonths,arrivalDate,breed:limited(text(raw.breed,'品种'),'品种',30),sex:text(raw.sex,'性别'),image:validImage(raw.image??'')};
}
export function normalizeRecord(raw) {
  object(raw,'记录'); if(!RECORD_TYPES.includes(raw.type)) fail('未知记录类型');
  const weight=raw.type==='weight'; let value=null;
  if(raw.unit!=null && (weight?raw.unit!=='kg':true))fail('记录单位不受支持，请核对后再导入');
  if(!weight && raw.value!=null)fail('本类型不支持数值字段，请将说明填写在备注中');
  if(weight){if((typeof raw.value!=='number'&&typeof raw.value!=='string')||String(raw.value).trim()==='')fail('体重需为数字');value=Number(raw.value);if(!Number.isFinite(value)||value<0.01||value>200)fail('体重需在0.01至200 kg之间');}
  return {id:requiredText(raw.id,'记录ID'),deletedAt:raw.deletedAt===undefined?null:deletedAt(raw.deletedAt),petId:requiredText(raw.petId,'宠物ID'),type:raw.type,occurredDate:validDate(raw.occurredDate,'记录日期'),value,unit:weight?'kg':null,title:limited(weight?text(raw.title??'体重记录','记录名称'):requiredText(raw.title,'记录名称'),'记录名称',60),note:limited(text(raw.note,'备注'),'备注',500),createdAt:isoTime(raw.createdAt,'创建时间'),updatedAt:isoTime(raw.updatedAt,'更新时间'),...(raw.legacyCreatedAtUnknown===true?{legacyCreatedAtUnknown:true}:{})};
}
function normalizeReminder(raw) {
  object(raw,'事项'); if(!['pending','completed','cancelled'].includes(raw.status))fail('事项状态无效');
  const result={id:requiredText(raw.id,'事项ID'),deletedAt:raw.deletedAt===undefined?null:deletedAt(raw.deletedAt),petId:requiredText(raw.petId,'宠物ID'),title:limited(requiredText(raw.title,'事项名称'),'事项名称',60),dueDate:validDate(raw.dueDate,'事项日期'),status:raw.status,originRecordId:raw.originRecordId==null?null:requiredText(raw.originRecordId,'来源记录ID'),completionRecordId:raw.completionRecordId==null?null:requiredText(raw.completionRecordId,'完成记录ID'),completedAt:raw.completedAt==null?null:isoTime(raw.completedAt,'完成时间')};
  if(raw.legacyCompletionUnknown===true)result.legacyCompletionUnknown=true;
  if(raw.completionRecordDeleted===true)result.completionRecordDeleted=true;
  if(result.status==='completed' && (!result.completionRecordId||!result.completedAt) && !(result.legacyCompletionUnknown && result.completionRecordId===null && result.completedAt===null) && !(result.completionRecordDeleted && result.completionRecordId===null && result.completedAt!==null))fail('完成事项缺少完成记录');
  if(result.status!=='completed' && (result.completionRecordId||result.completedAt||result.legacyCompletionUnknown||result.completionRecordDeleted))fail('未完成事项包含完成历史');
  return result;
}
function unique(items,label){const ids=new Set();for(const item of items){if(ids.has(item.id))fail(`${label}ID重复`);ids.add(item.id);}return ids;}
export function validateSnapshot(raw) {
  if(typeof raw==='string')raw=JSON.parse(raw);object(raw,'备份');
  if(raw.version!==3)fail('不支持此数据版本');if(!['demo','account'].includes(raw.mode))fail('数据模式无效');
  for(const key of ['pets','records','reminders','posts'])if(!Array.isArray(raw[key]))fail(`${key}必须为数组`);
  for(const key of ['pets','records','reminders'])for(const item of raw[key]){object(item,key);if(!Object.hasOwn(item,'deletedAt'))fail('V3资料缺少回收站标记');deletedAt(item.deletedAt);}
  const pets=raw.pets.map(normalizePet),records=raw.records.map(normalizeRecord),reminders=raw.reminders.map(normalizeReminder),petIds=unique(pets,'宠物');unique(records,'记录');unique(reminders,'事项');
  const recordMap=new Map(records.map(r=>[r.id,r]));
  for(const r of records)if(!petIds.has(r.petId))fail('记录没有对应宠物');
  for(const r of reminders){if(!petIds.has(r.petId))fail('事项没有对应宠物');for(const field of ['originRecordId','completionRecordId']){if(!r[field])continue;const record=recordMap.get(r[field]);if(!record && (field==='completionRecordId'||r.status==='pending'))fail('事项没有对应记录');if(record&&record.petId!==r.petId)fail('事项与记录宠物归属不一致');}}
  const activePetId=raw.activePetId??null;if(activePetId!==null&&!petIds.has(activePetId))fail('当前宠物不存在');if(activePetId!==null&&pets.find(p=>p.id===activePetId).deletedAt!==null)fail('当前宠物已在回收站');if(pets.some(p=>p.deletedAt===null)&&activePetId===null)fail('请选择当前宠物');
  object(raw.profile,'个人资料');const profile=clone(raw.profile);profile.city=profile.city==null?'深圳':requiredText(profile.city,'城市');
  for(const p of raw.posts){
    object(p,'帖子');requiredText(p.id,'帖子ID');limited(requiredText(p.title,'帖子标题'),'帖子标题',60);limited(requiredText(p.text,'帖子正文'),'帖子正文',1500);requiredText(p.author,'帖子作者');validDate(p.date,'帖子日期');
    if(!Number.isInteger(p.likes)||p.likes<0||typeof p.liked!=='boolean')fail('帖子点赞数据无效');
    if(!Array.isArray(p.comments))fail('帖子评论必须为数组');
    for(const comment of p.comments){object(comment,'评论');requiredText(comment.author,'评论作者');limited(requiredText(comment.text,'评论正文'),'评论正文',400);}
    validImage(p.image);validImage(p.avatar);
  }
  unique(raw.posts,'帖子');
  return {version:3,mode:raw.mode,activePetId,pets,records,reminders,posts:clone(raw.posts),profile};
}
export function migrateV1(raw,{now=new Date().toISOString()}={}) {
  if(typeof raw==='string')raw=JSON.parse(raw);object(raw,'旧数据');if(raw.version!==1)fail('不是有效的旧版数据');
  for(const key of ['pets','records','posts'])if(!Array.isArray(raw[key]))fail(`旧数据${key}无效`);
  isoTime(now);
  const knownTimes=raw.records.map(r=>typeof r?.createdAt==='number'?r.createdAt:Date.parse(r?.createdAt)).filter(Number.isFinite);
  const fallback=Math.min(0,...knownTimes)-1, reminders=[];
  const records=raw.records.map((r,i)=>{
    object(r,'旧记录');let createdAt;
    if(r.createdAt==null)createdAt=new Date(fallback-i).toISOString();
    else if(typeof r.createdAt==='number'&&Number.isFinite(r.createdAt)){createdAt=new Date(r.createdAt).toISOString();}
    else createdAt=isoTime(r.createdAt);
    if(r.nextDate){reminders.push({id:`legacy-reminder:${r.id}`,petId:r.petId,title:r.title||(r.type==='weight'?'体重记录':'护理事项'),dueDate:r.nextDate,status:r.reminderDone?'completed':'pending',originRecordId:r.id,completionRecordId:null,completedAt:null,...(r.reminderDone?{legacyCompletionUnknown:true}:{})});}
    return {id:r.id,petId:r.petId,type:r.type,occurredDate:r.date,value:r.value,title:r.title,note:r.note,createdAt,updatedAt:r.updatedAt==null?createdAt:typeof r.updatedAt==='number'?new Date(r.updatedAt).toISOString():r.updatedAt,...(r.createdAt==null?{legacyCreatedAtUnknown:true}:{})};
  });
  const pets=raw.pets.map(p=>({...p,estimatedAgeMonths:p.estimatedAgeMonths??null,arrivalDate:p.arrivalDate??p.arrival??null}));
  return migrateV2({version:2,mode:'demo',activePetId:raw.activePet??raw.activePetId??pets[0]?.id??null,pets,records,reminders,posts:raw.posts,profile:{...(raw.profile??{}),city:raw.city??raw.profile?.city??'深圳'}});
}

export function migrateV2(raw) {
  if(typeof raw==='string')raw=JSON.parse(raw);object(raw,'旧数据');if(raw.version!==2)fail('不是有效的V2数据');
  const next=clone(raw);next.version=3;
  for(const key of ['pets','records','reminders']){if(!Array.isArray(next[key]))fail(`旧数据${key}无效`);next[key]=next[key].map(item=>{object(item,key);return {...item,deletedAt:Object.hasOwn(item,'deletedAt')?item.deletedAt:null};});}
  return validateSnapshot(next);
}
