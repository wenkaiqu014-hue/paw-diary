import {isHealthTodo} from '../domain/health-plans.js';
export function growthEntries(snapshot,{petIds=[snapshot.activePetId],type='all',dateRange={},plans='all'}={}){
 const selected=new Set(petIds),visible=new Set(snapshot.pets.filter(p=>p.deletedAt===null).map(p=>p.id)),matches=e=>visible.has(e.petId)&&selected.has(e.petId)&&e.deletedAt===null&&(type==='all'||e.type===type||e.customTypeId===type)&&(!dateRange.from||e.date>=dateRange.from)&&(!dateRange.to||e.date<=dateRange.to);
 const records=snapshot.records.map(r=>({...r,kind:'record',date:r.occurredDate}));
 const upcoming=snapshot.reminders.filter(r=>r.status!=='completed'&&(plans!=='general'||r.status==='pending'&&!isHealthTodo(r,{records:snapshot.records}))).map(r=>({...r,kind:'plan',type:r.recordType??snapshot.records.find(x=>x.id===r.originRecordId)?.type??'daily',date:r.dueDate,value:null}));
 return [...records,...upcoming].filter(matches).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt??'').localeCompare(String(a.createdAt??'')));
}
const cell=value=>{let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+\-@]/u.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
export function exportGrowthCsv(entries,{pets=[]}={}){
 const names=new Map(pets.map(p=>[p.id,p.name])),fields=['id','petId','petName','kind','status','type','typeLabel','occurredDate','plannedDate','value','unit','title','note'];
 return '\ufeff'+[fields.map(cell).join(','),...entries.map(r=>fields.map(key=>cell(key==='petName'?names.get(r.petId):key==='plannedDate'?r.kind==='plan'?r.dueDate:'':r[key])).join(','))].join('\r\n')+'\r\n';
}
