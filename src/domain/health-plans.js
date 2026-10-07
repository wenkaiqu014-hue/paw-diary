// Defaults affect only new typed plans. Legacy interpretation remains a read view.
export function defaultPlanHealth(type){return type==='vaccine'||type==='deworm';}
export function isHealthTodo(reminder,{records=[]}={}){
 if(typeof reminder?.includeInHealth==='boolean')return reminder.includeInHealth;
 if(reminder?.originRecordId)return true;
 const type=reminder?.recordType;
 if(type!==undefined)return ['weight','vaccine','deworm'].includes(type);
 return true;
}
