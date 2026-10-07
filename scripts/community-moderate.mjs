import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {createCommunityStore}=require('../backend/community/store.cjs');
const {moderateReport}=require('../backend/community/reports.cjs');
const ENVIRONMENT_ID='paw-diary-d8g3p4tlsb305221d';
const failure=code=>Object.assign(new Error(code),{code});
export const HELP='Usage: node scripts/community-moderate.mjs --report-id REPORT_ID --action hide|dismiss\n\nUses only TENCENTCLOUD_FUJI_SECRET_ID / TENCENTCLOUD_FUJI_SECRET_KEY.\nNo public administrator route is deployed. --help performs no management request.';
export function parseModerationArgs(argv){
 if(!Array.isArray(argv)||argv.some(v=>typeof v!=='string'))throw failure('INVALID_INPUT');if(argv.length===1&&['--help','-h'].includes(argv[0]))return {help:true};
 const input={};for(let i=0;i<argv.length;i+=2){const key=argv[i],value=argv[i+1];if(!['--report-id','--action'].includes(key)||typeof value!=='string'||value.startsWith('--')||Object.hasOwn(input,key))throw failure('INVALID_INPUT');input[key]=value;}
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(input['--report-id']??'')||!['hide','dismiss'].includes(input['--action']))throw failure('INVALID_INPUT');return {reportId:input['--report-id'],action:input['--action']};
}
export async function runModeration({argv=process.argv.slice(2),environment=process.env,init,clock=()=>new Date()}={}){
 const args=parseModerationArgs(argv);if(args.help)return {help:true};
 // The fixed management identity never falls back to personal/group credentials.
 const secretId=environment.TENCENTCLOUD_FUJI_SECRET_ID,secretKey=environment.TENCENTCLOUD_FUJI_SECRET_KEY;
 if(typeof secretId!=='string'||!secretId.trim()||typeof secretKey!=='string'||!secretKey.trim())throw failure('MANAGEMENT_CREDENTIALS_MISSING');
 if(environment.PAW_CLOUD_ENV_ID&&environment.PAW_CLOUD_ENV_ID!==ENVIRONMENT_ID)throw failure('ENVIRONMENT_MISMATCH');
 try{
  const initialize=init??require('@cloudbase/node-sdk').init;
  const app=initialize({env:ENVIRONMENT_ID,region:'ap-shanghai',secretId,secretKey});
  const store=createCommunityStore({db:app.database()});
  return await moderateReport({store,reportId:args.reportId,action:args.action,managementAuthorized:true,clock});
 }catch(error){const allowed=new Set(['NOT_FOUND','CONFLICT','INVALID_INPUT','FORBIDDEN','UNAVAILABLE']);throw failure(allowed.has(error?.code)?error.code:'UNAVAILABLE');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=await runModeration();if(result.help)console.log(HELP);else console.log(JSON.stringify(result));}
 catch(error){console.error(error.code??'UNAVAILABLE');process.exitCode=1;}
}
