import test from 'node:test';
import assert from 'node:assert/strict';
test('avatar retry preserves the saved pet and does not create a second profile',async()=>{
 const {createPetAvatarSave}=await import('../src/ui/avatar-picker.js');let parents=0,uploads=0;
 const save=createPetAvatarSave({savePet:async()=>{parents++;return{id:'pet-1'};},saveAvatar:async()=>{uploads++;if(uploads===1)throw Error('offline');}});
 await assert.rejects(save.save({name:'咪'},{kind:'upload',blob:new Blob(['image'])}),/offline/);
 assert.equal(save.getSavedPet().id,'pet-1');await save.save({name:'咪'},{kind:'upload',blob:new Blob(['image'])});
 assert.equal(parents,1);assert.equal(uploads,2);
});
test('dialog initially focuses its title without removing keyboard focus styles',async()=>{
 const {focusDialogTitle}=await import('../src/ui/avatar-picker.js');let focused=false;const title={setAttribute(k,v){assert.equal(k,'tabindex');assert.equal(v,'-1');},focus(){focused=true;}};
 focusDialogTitle({querySelector:()=>title});assert.equal(focused,true);
});
