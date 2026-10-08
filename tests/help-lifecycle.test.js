import test from 'node:test';
import assert from 'node:assert/strict';
let api; try { api=await import('../src/domain/help-lifecycle.js'); } catch {}
const available=()=>assert.ok(api,'help lifecycle module is available');
const unseen={acknowledgedVersions:[],tourStatus:'unseen'},stable={version:'0.8.0',channel:'stable'};
test('any active editing or transition field blocks automatic interaction',()=>{
 available();assert.equal(api.isInteractionBlocked({}),false);
 for(const field of ['dialogOpen','dirty','saving','aiSaving','publicDirty','publicSaving','photoDirty','photoSaving','transitioning'])assert.equal(api.isInteractionBlocked({[field]:true}),true,field);
 assert.equal(api.isInteractionBlocked({dirty:false,dialogOpen:false}),false);
});
test('preview is silent unless explicitly enabled and stable unseen versions defer while busy',()=>{
 available();const preview={version:'0.8.0',channel:'preview'};
 assert.equal(api.decideStartupHelp({release:preview,preferences:unseen,blocked:false}),'none');
 assert.equal(api.decideStartupHelp({release:preview,preferences:unseen,blocked:false,previewEnabled:true}),'whats-new');
 assert.equal(api.decideStartupHelp({release:stable,preferences:unseen,blocked:true}),'defer');
 assert.equal(api.decideStartupHelp({release:stable,preferences:unseen,blocked:false}),'whats-new');
 assert.equal(api.decideStartupHelp({release:{...stable,version:'bad'},preferences:unseen,blocked:false}),'none');
});
test('confirmed version stays quiet even when tour has never been seen',()=>{
 available();assert.equal(api.decideStartupHelp({release:stable,preferences:{...unseen,acknowledgedVersions:['0.8.0']},blocked:true}),'none');
});
test('stable updates use numeric semver without upgrading previews, invalid values or rollbacks',()=>{
 available();for(const [current,remote,want] of [
 ['0.9.0','0.10.0',true],['0.8.0','0.7.9',false],['0.8.0','0.8.0',false],['0.8.0','0.8.1',true],['0.8.0','0.8.0-beta',false],['bad','0.8.0',false],['0.8.0','01.8.1',false]
 ])assert.equal(api.isNewStableRelease({version:current,channel:'stable'},{version:remote,channel:'stable'}),want,`${current} → ${remote}`);
 assert.equal(api.isNewStableRelease(stable,{version:'0.9.0',channel:'preview'}),false);
 assert.equal(api.isNewStableRelease({...stable,channel:'preview'},{version:'0.9.0',channel:'stable'}),false);
});
