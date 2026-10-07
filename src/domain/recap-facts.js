import {validDate,clone} from './schema.js?v=0.2.0';
import {normalizeRecap,normalizeStage3State} from './stage3-state.js';
const addDays=(day,count)=>new Date(Date.parse(`${day}T12:00:00Z`)+count*86400000).toISOString().slice(0,10);
const shanghaiDate=value=>new Date(Date.parse(value)+8*3600000).toISOString().slice(0,10);
function sources({snapshot,petId,from,to}){
 validDate(from);validDate(to);if(from>to)throw new Error('回顾日期范围无效');if(!snapshot.pets.some(p=>p.id===petId&&p.deletedAt===null))throw new Error('宠物不存在或已在回收站');
 const records=snapshot.records.filter(r=>r.petId===petId&&r.deletedAt===null&&r.occurredDate>=from&&r.occurredDate<=to).sort((a,b)=>a.occurredDate.localeCompare(b.occurredDate)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 const recordIds=new Set(records.map(r=>r.id)),allVisible=new Set(snapshot.records.filter(r=>r.petId===petId&&r.deletedAt===null).map(r=>r.id));
 const completed=snapshot.reminders.filter(r=>r.petId===petId&&r.deletedAt===null&&r.status==='completed'&&r.completedAt&&allVisible.has(r.completionRecordId)&&shanghaiDate(r.completedAt)>=from&&shanghaiDate(r.completedAt)<=to);
 const upcoming=snapshot.reminders.filter(r=>r.petId===petId&&r.deletedAt===null&&r.status==='pending'&&r.dueDate>=addDays(to,1)&&r.dueDate<=addDays(to,7)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.id.localeCompare(b.id));
 const reminders=snapshot.reminders.filter(r=>r.petId===petId&&r.deletedAt===null&&(completed.some(x=>x.id===r.id)||upcoming.some(x=>x.id===r.id)||recordIds.has(r.originRecordId)||recordIds.has(r.completionRecordId))).sort((a,b)=>a.id.localeCompare(b.id));
 return {records,reminders,completed,upcoming};
}
export function computeRecapFacts(scope){const {records,reminders,completed,upcoming}=sources(scope),weights=records.filter(r=>r.type==='weight');return {recordCount:records.length,weightChangeKg:weights.length<2?null:Math.round((weights.at(-1).value-weights[0].value)*100)/100,completedCareCount:completed.length,upcomingReminders:upcoming.map(({id,title,dueDate})=>({id,title,dueDate})),recordIds:records.map(r=>r.id),reminderIds:reminders.map(r=>r.id)};}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
export async function recapSourceHash(scope,{cryptoImpl=globalThis.crypto}={}){const {records,reminders}=sources(scope);if(!cryptoImpl?.subtle)throw new Error('当前环境不支持回顾依据校验');const encoded=new TextEncoder().encode(JSON.stringify(stable({petId:scope.petId,from:scope.from,to:scope.to,records,reminders,facts:computeRecapFacts(scope)}))),digest=await cryptoImpl.subtle.digest('SHA-256',encoded);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function prepareSavedRecap(snapshot,input,{cryptoImpl=globalThis.crypto}={}){
 const normalized=normalizeRecap(input),scope={snapshot,petId:normalized.petId,from:normalized.from,to:normalized.to},facts=computeRecapFacts(scope),sourceHash=await recapSourceHash(scope,{cryptoImpl});
 if(sourceHash!==normalized.sourceHash)throw new Error('记录已更新，回顾依据过时，请重新生成');
 if(normalized.storySources.some(id=>![...facts.recordIds,...facts.reminderIds].includes(id)))throw new Error('回顾引用来源无效');
 if(!facts.recordCount)throw new Error('没有记录可保存成长回顾');
 return {...normalized,sourceHash,recordIds:facts.recordIds,reminderIds:facts.reminderIds,facts};
}
export function applySavedRecap(snapshot,recap){const next=clone(snapshot);next.profile.stage3=normalizeStage3State(next.profile.stage3);const found=next.profile.stage3.recaps.findIndex(r=>r.id===recap.id);if(found>=0&&next.profile.stage3.recaps[found].petId!==recap.petId)throw new Error('回顾宠物归属不一致');if(found>=0)next.profile.stage3.recaps[found]=clone(recap);else next.profile.stage3.recaps.unshift(clone(recap));return next;}
export function prepareRecapShare(recap,{includeWeights=false}={}){const en=recap.uiLocale==='en',title=en?'Our growth diary':'我们的成长日记';let text=en?`From ${recap.from} to ${recap.to}, we saved ${recap.facts.recordCount} moments together. Keeping a diary of everyday companionship.`:`${recap.from} 至 ${recap.to}，我们记下了 ${recap.facts.recordCount} 个相伴的瞬间。继续记录每一天的小小成长。`;if(includeWeights){text+='\n'+recap.story;}return {title,text};}
