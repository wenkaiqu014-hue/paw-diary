import test from 'node:test';
import assert from 'node:assert/strict';
let api; try { api = await import('../src/data/ui-preferences.js'); } catch {}
const available = () => assert.ok(api, 'UI preference module is available');
const fixture = () => { const values = new Map(); return { values, storage: {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)} }; };
test('guest spaces share one identity while trusted account ids remain isolated', () => {
 available(); assert.equal(api.uiIdentityKey({}), 'guest'); assert.equal(api.uiIdentityKey({userId:null}), 'guest');
 assert.equal(api.uiIdentityKey({userId:'A'}), 'account:A');
 const {storage,values}=fixture(), prefs=api.createUiPreferences({storage});
 assert.deepEqual(prefs.read('guest'),{schemaVersion:1,acknowledgedVersions:[],tourStatus:'unseen'});
 prefs.acknowledgeVersion('account:A','0.8.0'); prefs.setTourStatus('account:A','completed');
 assert.deepEqual(prefs.read('account:B'),{schemaVersion:1,acknowledgedVersions:[],tourStatus:'unseen'});
 assert.equal(prefs.read('guest').tourStatus,'unseen');
 assert.ok([...values.keys()].every(key=>key.startsWith('paw-diary:ui:v1:')));
});
test('confirmation deduplicates valid versions and keeps the latest eight confirmations', () => {
 available(); const {storage}=fixture(), prefs=api.createUiPreferences({storage});
 prefs.acknowledgeVersion('guest','0.8.0'); prefs.acknowledgeVersion('guest','0.8.0');
 assert.deepEqual(prefs.read('guest').acknowledgedVersions,['0.8.0']);
 for(let i=1;i<=8;i++) prefs.acknowledgeVersion('guest',`0.8.${i}`);
 assert.deepEqual(prefs.read('guest').acknowledgedVersions,['0.8.1','0.8.2','0.8.3','0.8.4','0.8.5','0.8.6','0.8.7','0.8.8']);
 prefs.acknowledgeVersion('guest','0.8.0-beta');
 assert.equal(prefs.read('guest').acknowledgedVersions.length,8);
});
test('tour state survives confirmation without merging with acknowledgement state', () => {
 available();const {storage}=fixture(),prefs=api.createUiPreferences({storage});
 prefs.setTourStatus('guest','skipped');prefs.acknowledgeVersion('guest','0.8.0');
 assert.equal(prefs.read('guest').tourStatus,'skipped');
 prefs.setTourStatus('guest','completed');assert.equal(api.createUiPreferences({storage}).read('guest').tourStatus,'completed');
 prefs.setTourStatus('guest','invalid');assert.equal(prefs.read('guest').tourStatus,'completed');
 const copy=prefs.read('guest');copy.acknowledgedVersions.push('9.9.9');assert.deepEqual(prefs.read('guest').acknowledgedVersions,['0.8.0']);
});
test('denied read and write use the supplied memory and never interrupt use', () => {
 available();const memory=new Map(),storage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
 const prefs=api.createUiPreferences({storage,memory});prefs.acknowledgeVersion('guest','0.8.0');prefs.setTourStatus('guest','skipped');
 assert.equal(api.createUiPreferences({storage,memory}).read('guest').tourStatus,'skipped');
 assert.deepEqual(prefs.read('guest').acknowledgedVersions,['0.8.0']);
});
test('corrupt JSON and malformed persisted values fall back to usable defaults', () => {
 available();const {storage,values}=fixture();values.set('paw-diary:ui:v1:guest','{broken');
 const prefs=api.createUiPreferences({storage});assert.equal(prefs.read('guest').tourStatus,'unseen');
 prefs.setTourStatus('guest','completed');assert.equal(prefs.read('guest').tourStatus,'completed');
 values.set('paw-diary:ui:v1:account:A',JSON.stringify({schemaVersion:1,acknowledgedVersions:['bad','0.8.0','0.8.0'],tourStatus:'bogus'}));
 assert.deepEqual(prefs.read('account:A'),{schemaVersion:1,acknowledgedVersions:['0.8.0'],tourStatus:'unseen'});
});
