import {visibleHealth} from '../domain/lifecycle.js?v=0.2.0';

const initial=()=>({petManage:false,reminderManage:false,selectedPetIds:[],selectedReminderIds:[]});
const toggle=(ids,id)=>ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];

export function transitionManagement(state,event){
  const next={...state,selectedPetIds:[...state.selectedPetIds],selectedReminderIds:[...state.selectedReminderIds]};
  switch(event.type){
    case 'ENTER_PETS':next.petManage=true;next.selectedPetIds=[];break;
    case 'ENTER_REMINDERS':next.reminderManage=true;next.selectedReminderIds=[];break;
    case 'TOGGLE_PET':if(next.petManage)next.selectedPetIds=toggle(next.selectedPetIds,event.id);break;
    case 'TOGGLE_REMINDER':if(next.reminderManage)next.selectedReminderIds=toggle(next.selectedReminderIds,event.id);break;
    case 'PET_CHANGED':return initial();
    case 'FILTER_CHANGED':next.selectedReminderIds=[];break;
    case 'EXIT':
      if(!event.target)return initial();
      if(event.target==='pets'){next.petManage=false;next.selectedPetIds=[];}
      if(event.target==='reminders'){next.reminderManage=false;next.selectedReminderIds=[];}
      break;
    case 'ENTITIES_CHANGED':
      next.selectedPetIds=next.selectedPetIds.filter(id=>event.petIds.includes(id));
      next.selectedReminderIds=next.selectedReminderIds.filter(id=>event.reminderIds.includes(id));
      break;
  }
  return next;
}

export function selectedCalendarReminders(snapshot,petId,ids){
  if(!Array.isArray(ids)||!ids.length)throw new Error('请先勾选至少一项待办。');
  const visible=visibleHealth(snapshot);
  if(!visible.pets.some(pet=>pet.id===petId))throw new Error('当前宠物不可见，请先恢复宠物档案。');
  const selected=ids.map(id=>{
    const reminder=visible.reminders.find(item=>item.id===id);
    if(!reminder)throw new Error('所选事项不存在或已移入回收站，请重新选择。');
    if(reminder.petId!==petId)throw new Error('所选事项属于其他宠物，请重新选择。');
    return reminder;
  });
  const blocked=selected.filter(reminder=>reminder.status!=='pending');
  if(blocked.length)throw new Error(`只能导出待完成事项：${blocked.map(reminder=>`“${reminder.title}”（${reminder.status==='completed'?'已完成':'已取消'}）`).join('、')}不能导出。请取消勾选后再试。`);
  return selected;
}
