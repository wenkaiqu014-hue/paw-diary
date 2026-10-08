import test from 'node:test';
import assert from 'node:assert/strict';
import zh from '../src/ui/locales/zh-CN.js';
import en from '../src/ui/locales/en.js';
let topics,notes,help,news;try{topics=(await import('../src/data/help-topics.js')).HELP_TOPICS;notes=(await import('../src/data/release-notes.js')).RELEASE_NOTES;help=await import('../src/features/help.js');news=await import('../src/features/whats-new.js');}catch{}
test('help covers nine independently readable themes in both languages',()=>{
 assert.ok(topics,'help content available');assert.equal(topics.length,9);
 assert.deepEqual(topics.map(topic=>topic.id),['start','pets','records','ai','recap','community','files','calendar','install']);
 for(const topic of topics){assert.ok(topic.bodyKeys.length>=2);for(const key of [topic.titleKey,...topic.bodyKeys]){assert.equal(typeof zh[key],'string',key);assert.equal(typeof en[key],'string',key);assert.ok(zh[key].trim()&&en[key].trim());}}
 assert.ok(Object.isFrozen(topics));
});
test('release notes reference complete bilingual keys and only one current product release',()=>{
 assert.ok(notes,'release notes available');assert.deepEqual(notes.map(note=>note.version),['1.0.4']);
 for(const note of notes){for(const key of [note.titleKey,...note.bulletKeys]){assert.equal(typeof zh[key],'string',key);assert.equal(typeof en[key],'string',key);}}
});
test('standalone controllers do not require pet, AI, account or repository arguments',()=>{
 assert.equal(typeof help?.mountHelp,'function');assert.equal(typeof news?.mountWhatsNew,'function');
 for(const key of ['help.title','help.close','help.tour','help.tourBlocked','help.install','help.whatsNew','whatsNew.confirm','whatsNew.close','whatsNew.title','whatsNew.fallback']){assert.ok(zh[key]);assert.ok(en[key]);}
});
