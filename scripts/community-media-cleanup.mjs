import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {createCommunityMediaService}=require('../backend/community/media.cjs');
const {createCommunityStore}=require('../backend/community/store.cjs');
const {createCloudbaseStorage}=require('../backend/storage.cjs');
export async function cleanupCommunityMedia({store,storage,clock=Date.now,dryRun=true,limit=100,expiresAtFilter}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Object.assign(Error('INVALID_INPUT'),{code:'INVALID_INPUT'});
 // Query candidates only; the service rechecks expiry, ownership namespace and binding in a transaction.
 const candidates=await store.query('media',{entity:'community-image',binding:null,...(expiresAtFilter===undefined?{}:{expiresAt:expiresAtFilter})},{limit});
 const ids=candidates.filter(a=>a.expiresAt<=clock()).map(a=>a.id);
 return createCommunityMediaService({store,storage,clock}).cleanupCandidates(ids,{dryRun});
}
async function main(){
 const args=process.argv.slice(2);
 if(args.includes('--help')){console.log('Usage: node scripts/community-media-cleanup.mjs [--apply] [--limit 1..100]\nDefaults to dry-run. Uses only TENCENTCLOUD_FUJI_SECRET_ID/KEY for the fixed paw-diary environment. Deletes expired unbound community resources after transactional rechecks; never private workspace files.');return;}
 if(args.some((a,i)=>!['--apply','--limit'].includes(a)&&args[i-1]!=='--limit'))throw Object.assign(Error('INVALID_INPUT'),{code:'INVALID_INPUT'});
 const at=args.indexOf('--limit'),limit=at<0?100:Number(args[at+1]);if(!Number.isInteger(limit)||limit<1||limit>100)throw Object.assign(Error('INVALID_INPUT'),{code:'INVALID_INPUT'});
 if(!process.env.TENCENTCLOUD_FUJI_SECRET_ID||!process.env.TENCENTCLOUD_FUJI_SECRET_KEY)throw Object.assign(Error('CREDENTIALS_MISSING'),{code:'CREDENTIALS_MISSING'});
 const cloudbase=require('@cloudbase/node-sdk');
 const app=cloudbase.init({env:'paw-diary-d8g3p4tlsb305221d',region:'ap-shanghai',secretId:process.env.TENCENTCLOUD_FUJI_SECRET_ID,secretKey:process.env.TENCENTCLOUD_FUJI_SECRET_KEY});
 const db=app.database();
 const result=await cleanupCommunityMedia({store:createCommunityStore({db}),storage:createCloudbaseStorage({app}),dryRun:!args.includes('--apply'),limit,expiresAtFilter:db.command.lte(Date.now())});
 console.log(JSON.stringify({dryRun:result.dryRun,count:result.removed.length,assetIds:result.removed}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(JSON.stringify({error:/^[A-Z_]{1,80}$/.test(error?.code??'')?error.code:'CLEANUP_FAILED'}));process.exitCode=1;});
