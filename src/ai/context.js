import {visibleHealth} from '../domain/lifecycle.js';
export function createAiContext(snapshot,petId){
  const view=visibleHealth(snapshot);
  return {version:3,mode:snapshot.mode,activePetId:petId,posts:[],profile:{city:snapshot.profile.city,...(snapshot.profile.recordTypeCatalog?{recordTypeCatalog:structuredClone(snapshot.profile.recordTypeCatalog)}:{})},
    pets:view.pets.map(({id,name,type,typeLabel})=>({id,name,type,...(typeLabel?{typeLabel}:{}),deletedAt:null,birthday:null,estimatedAgeMonths:null,arrivalDate:null,breed:'',sex:'',image:''})),
    records:view.records.filter(r=>r.petId===petId).map(r=>({...r})),reminders:view.reminders.filter(r=>r.petId===petId).map(r=>({...r}))};
}
