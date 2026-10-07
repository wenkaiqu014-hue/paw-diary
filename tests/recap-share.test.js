import test from 'node:test';import assert from 'node:assert/strict';
import {createCommunityRecapDraft} from '../src/features/recap-community-share.js';
import {createSeedState} from '../src/data/seed.js';
test('community recap is based on current actual records and omits private story and plans',()=>{
 const snapshot=createSeedState(),pet=snapshot.pets[0],from='2026-10-01',to='2026-10-07';
 snapshot.records=[{id:'real',petId:pet.id,type:'daily',title:'Private detail',note:'private note',occurredDate:'2026-10-05',deletedAt:null},{id:'trash',petId:pet.id,type:'daily',title:'Trash detail',occurredDate:'2026-10-04',deletedAt:'2026-10-06T00:00:00Z'}];snapshot.reminders=[];
 const draft=createCommunityRecapDraft({snapshot,petId:pet.id,from,to,locale:'zh-CN'});
 assert.match(draft.text,/1 个/);assert.equal(draft.text.includes('Private detail'),false);assert.equal(draft.text.includes('private note'),false);assert.equal(draft.text.includes('Trash detail'),false);assert.equal(draft.imageAssetId,undefined);assert.equal(draft.petId,undefined);
});
test('explicitly edited recap text stays a plain draft without saving anything',()=>{
 const snapshot=createSeedState();const draft=createCommunityRecapDraft({snapshot,petId:snapshot.pets[0].id,from:'2026-10-01',to:'2026-10-07',locale:'en',editedText:'My title\n<script>literal</script>'});
 assert.equal(draft.title,'My title');assert.equal(draft.text,'<script>literal</script>');assert.equal(Object.hasOwn(draft,'recordIds'),false);
});
test('an edited overlong first line is preserved for the publish form to validate, never silently truncated',()=>{const snapshot=createSeedState(),title='x'.repeat(80),draft=createCommunityRecapDraft({snapshot,petId:snapshot.pets[0].id,from:'2026-10-01',to:'2026-10-07',editedText:title+'\nEdited body'});assert.equal(draft.title,title);assert.equal(draft.text,'Edited body');});
