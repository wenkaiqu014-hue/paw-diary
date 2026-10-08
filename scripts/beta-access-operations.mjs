import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {validProof,hasBetaAdmission}=require('../backend/beta-access.cjs');
const ENVIRONMENT='paw-diary-d8g3p4tlsb305221d';
const proofId=uid=>createHash('sha256').update('p:'+uid).digest('hex');
function validTimestamp(value,{canonical=false}={}){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))return false;
 const iso=new Date(value).toISOString();return value===iso||(!canonical&&value===iso.replace('.000Z','Z'));
}
// Older frozen receipts omit kind. They carry selection metadata, not an actual
// identity proof: actual proof.kind is checked on every database read below.
export function validateLegacyReceipt(receipt){
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||receipt.environment!==ENVIRONMENT||!validTimestamp(receipt.cutoff,{canonical:true})||!Array.isArray(receipt.selected))throw Error('INVALID_RECEIPT');
 const ids=new Set();
 for(const item of receipt.selected){
  if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.ownerId!=='string'||!item.ownerId||
   (item.kind!==undefined&&item.kind!=='verified')||typeof item.emailHash!=='string'||!/^[a-f0-9]{64}$/.test(item.emailHash)||
   !validTimestamp(item.verifiedAt)||Date.parse(item.verifiedAt)>Date.parse(receipt.cutoff)||item.id!==proofId(item.ownerId)||ids.has(item.id))throw Error('INVALID_RECEIPT');
  ids.add(item.id);
 }
 return receipt;
}
function matchesFrozenProof(proof,item){return validProof(proof,item.ownerId)&&proof.emailHash===item.emailHash&&proof.verifiedAt===item.verifiedAt;}
export async function verifyLegacyReceipt({db,receipt}){
 validateLegacyReceipt(receipt);let valid=0;
 for(const item of receipt.selected){const reply=await db.collection('auth_verified').doc(item.id).get();const doc=Array.isArray(reply.data)?reply.data[0]:reply.data;
  if(reply.code||!matchesFrozenProof(doc?.value,item)||!hasBetaAdmission(doc?.value,item.ownerId))throw Error('ADMISSION_NOT_VERIFIED');valid++;
 }
 return{valid,expected:receipt.selected.length};
}
export function selectLegacyProofs(documents,cutoff){
 if(!validTimestamp(cutoff,{canonical:true}))throw Error('INVALID_CUTOFF');
 const selected=[],summary={scanned:documents.length,invalid:0,afterCutoff:0,alreadyAdmitted:0};
 for(const doc of documents){const proof=doc.value,uid=proof?.ownerId;
  if(!validProof(proof,uid)||doc._id!==proofId(uid)){summary.invalid++;continue;}
  if(Date.parse(proof.verifiedAt)>Date.parse(cutoff)){summary.afterCutoff++;continue;}
  if(hasBetaAdmission(proof,uid)){summary.alreadyAdmitted++;continue;}
  selected.push({id:doc._id,kind:proof.kind,ownerId:uid,emailHash:proof.emailHash,verifiedAt:proof.verifiedAt});
 }
 return {selected,summary:{...summary,candidates:selected.length}};
}
export async function migrateLegacy({db,receipt,now=new Date().toISOString()}){
 validateLegacyReceipt(receipt);
 if(!validTimestamp(now,{canonical:true}))throw Error('INVALID_MIGRATION_TIME');
 let admitted=0,already=0;
 for(const item of receipt.selected){
  await db.runTransaction(async tx=>{const reply=await tx.collection('auth_verified').doc(item.id).get();if(reply.code)throw Error('READ_FAILED');
   const doc=Array.isArray(reply.data)?reply.data[0]:reply.data,proof=doc?.value;
   if(!matchesFrozenProof(proof,item))throw Error('PROOF_CHANGED');
   if(hasBetaAdmission(proof,item.ownerId)){already++;return;}
   const next={...proof,betaAdmission:{version:1,grantedAt:now,source:'legacy'}};
   const result=await tx.collection('auth_verified').doc(item.id).set({value:next});if(result.code)throw Error('WRITE_FAILED');admitted++;
  });
 }
 return{admitted,already};
}
async function main(){
 const [action,path]=process.argv.slice(2);if(!['dry-run','apply','verify'].includes(action)||!path)throw Error('INVALID_ARGUMENTS');
 if(!process.env.TENCENTCLOUD_FUJI_SECRET_ID||!process.env.TENCENTCLOUD_FUJI_SECRET_KEY)throw Error('MANAGEMENT_CREDENTIALS_MISSING');
 const app=require('@cloudbase/node-sdk').init({env:ENVIRONMENT,region:'ap-shanghai',secretId:process.env.TENCENTCLOUD_FUJI_SECRET_ID,secretKey:process.env.TENCENTCLOUD_FUJI_SECRET_KEY}),db=app.database();
 if(action==='dry-run'){
  const cutoff=new Date().toISOString(),documents=[];
  for(let skip=0;;skip+=100){const reply=await db.collection('auth_verified').skip(skip).limit(100).get();if(reply.code)throw Error('READ_FAILED');documents.push(...reply.data);if(reply.data.length<100)break;}
  const chosen=selectLegacyProofs(documents,cutoff),receipt={environment:ENVIRONMENT,cutoff,...chosen};
  await fs.writeFile(path,JSON.stringify(receipt),{mode:0o600,flag:'wx'});console.log(JSON.stringify({action,cutoff,...chosen.summary,privateReceiptSaved:true}));
 }else{
  const stat=await fs.stat(path);if(stat.mode&0o77)throw Error('RECEIPT_NOT_PRIVATE');const receipt=JSON.parse(await fs.readFile(path,'utf8'));
  validateLegacyReceipt(receipt);
  if(action==='apply')console.log(JSON.stringify({action,...await migrateLegacy({db,receipt})}));
  else console.log(JSON.stringify({action,...await verifyLegacyReceipt({db,receipt})}));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('BETA_OPERATIONS_FAILED');process.exitCode=1;});
