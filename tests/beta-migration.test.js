import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import * as operations from '../scripts/beta-access-operations.mjs';
const {selectLegacyProofs,migrateLegacy}=operations;
const valid={kind:'verified',ownerId:'synthetic-user',emailHash:'a'.repeat(64),verifiedAt:'2026-10-07T00:00:00.000Z'};
const id=createHash('sha256').update('p:'+valid.ownerId).digest('hex');
test('legacy selection uses genuine proof owner/id/date and excludes future, malformed, admitted actors',()=>{
 const r=selectLegacyProofs([{_id:id,value:valid},{_id:'forged-id',value:valid},{_id:id,value:{...valid,verifiedAt:'2026-10-09T00:00:00.000Z'}},{_id:id,value:{...valid,betaAdmission:{version:1,source:'invite',grantedAt:'2026-10-07T00:00:00.000Z'}}}],'2026-10-08T00:00:00.000Z');
 assert.equal(r.selected.length,1);assert.deepEqual(r.summary,{scanned:4,invalid:1,afterCutoff:1,alreadyAdmitted:1,candidates:1});
 assert.throws(()=>selectLegacyProofs([],'2026-02-31T00:00:00.000Z'));
});
test('migration preserves original proof and is idempotent; changed proof fails without write',async()=>{
 let value=structuredClone(valid),writes=0;const db={runTransaction:fn=>fn({collection:()=>({doc:()=>({get:async()=>({data:[{value}]}),set:async doc=>{value=doc.value;writes++;return{};}})})})};
 const receipt={environment:'paw-diary-d8g3p4tlsb305221d',cutoff:'2026-10-08T00:00:00.000Z',selected:[{id,ownerId:valid.ownerId,emailHash:valid.emailHash,verifiedAt:valid.verifiedAt}]};
 assert.deepEqual(await migrateLegacy({db,receipt,now:'2026-10-08T00:00:00.000Z'}),{admitted:1,already:0});
 assert.equal(value.verifiedAt,valid.verifiedAt);assert.equal(value.emailHash,valid.emailHash);assert.equal(value.betaAdmission.source,'legacy');
 assert.deepEqual(await migrateLegacy({db,receipt}),{admitted:0,already:1});assert.equal(writes,1);
 value={...valid,emailHash:'b'.repeat(64)};await assert.rejects(migrateLegacy({db,receipt}),/PROOF_CHANGED/);assert.equal(writes,1);
});

const receipt=()=>({environment:'paw-diary-d8g3p4tlsb305221d',cutoff:'2026-10-08T00:00:00.000Z',selected:[{id,ownerId:valid.ownerId,emailHash:valid.emailHash,verifiedAt:valid.verifiedAt}]});
function fixture(proof=valid){let reads=0,writes=0;const documents={collection:()=>({doc:()=>({get:async()=>{reads++;return{data:{value:proof}};},set:async()=>{writes++;return{};}})})};return{db:{...documents,runTransaction:fn=>fn(documents)},counts:()=>({reads,writes})};}
for(const [name,mutate] of [
 ['missing cutoff',r=>delete r.cutoff],
 ['malformed cutoff',r=>r.cutoff='2026-02-31T00:00:00.000Z'],
 ['date-only cutoff',r=>r.cutoff='2026-10-08'],
 ['proof after frozen cutoff',r=>r.selected[0].verifiedAt='2026-10-09T00:00:00.000Z'],
 ['forged document id',r=>r.selected[0].id='b'.repeat(64)],
 ['duplicate document ids',r=>r.selected.push({...r.selected[0]})],
 ['wrong environment',r=>r.environment='other-environment'],
 ['empty owner',r=>r.selected[0].ownerId=''],
 ['invalid email digest',r=>r.selected[0].emailHash='wrong'],
 ['calendar-invalid proof date',r=>r.selected[0].verifiedAt='2026-02-31T00:00:00.000Z'],
 ['nonverified receipt kind',r=>r.selected[0].kind='profile'],
 ])test(`migration refuses ${name} before any database read or write`,async()=>{const r=receipt(),f=fixture();mutate(r);await assert.rejects(migrateLegacy({db:f.db,receipt:r}),/INVALID_RECEIPT/);assert.deepEqual(f.counts(),{reads:0,writes:0});});
test('shared receipt validator accepts legacy receipt shape and new selection carries actual verified kind',()=>{
 assert.equal(typeof operations.validateLegacyReceipt,'function');assert.equal(operations.validateLegacyReceipt(receipt()).selected.length,1);
 assert.equal(selectLegacyProofs([{_id:id,value:valid}],receipt().cutoff).selected[0].kind,'verified');
});
for(const [name,change] of [['email hash',p=>p.emailHash='b'.repeat(64)],['verified timestamp',p=>p.verifiedAt='2026-10-07T01:00:00.000Z'],['owner',p=>p.ownerId='other'],['kind',p=>p.kind='profile'],['missing admission',p=>delete p.betaAdmission]])test(`verification refuses changed ${name} even when supplied receipt originally selected the actor`,async()=>{
 assert.equal(typeof operations.verifyLegacyReceipt,'function');const p={...valid,betaAdmission:{version:1,source:'legacy',grantedAt:'2026-10-08T00:00:00.000Z'}};change(p);const f=fixture(p);await assert.rejects(operations.verifyLegacyReceipt({db:f.db,receipt:receipt()}),/ADMISSION_NOT_VERIFIED/);assert.equal(f.counts().writes,0);
});
test('verify validates environment and frozen receipt before touching the database',async()=>{assert.equal(typeof operations.verifyLegacyReceipt,'function');const r=receipt(),f=fixture();r.environment='forged';await assert.rejects(operations.verifyLegacyReceipt({db:f.db,receipt:r}),/INVALID_RECEIPT/);assert.deepEqual(f.counts(),{reads:0,writes:0});});
test('verify reads frozen email and timestamp with actual persisted valid admission',async()=>{assert.equal(typeof operations.verifyLegacyReceipt,'function');const f=fixture({...valid,betaAdmission:{version:1,source:'legacy',grantedAt:'2026-10-08T00:00:00.000Z'}});assert.deepEqual(await operations.verifyLegacyReceipt({db:f.db,receipt:receipt()}),{valid:1,expected:1});assert.deepEqual(f.counts(),{reads:1,writes:0});});
