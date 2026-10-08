import {mkdir,readFile,writeFile,lstat,rename,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const fail=code=>Object.assign(new Error(code),{code});
// Acceptance credentials are rotated by SDK setSession. Merge under a filesystem
// lock because actor Workers share this file, but not their JavaScript heap.
export async function updateSessionFile(path,{envId,label,session}){
 if(typeof envId!=='string'||!envId||!['A','B','C','anonymous'].includes(label)||
    typeof session?.access_token!=='string'||!session.access_token||
    typeof session?.refresh_token!=='string'||!session.refresh_token)throw fail('SESSION_FILE_INVALID');
 const credentials={access_token:session.access_token,refresh_token:session.refresh_token};
 for(const key of ['version','token_type','scope','expires_in','expires_at'])if(session[key]!==undefined)credentials[key]=session[key];
 await mkdir(dirname(path),{recursive:true});
 const lock=path+'.lock',deadline=Date.now()+5000;
 for(;;){try{await mkdir(lock,{mode:0o700});break;}catch(error){if(error.code!=='EEXIST')throw error;if(Date.now()>=deadline)throw fail('SESSION_FILE_LOCK_TIMEOUT');await delay(20);}}
 const temp=path+'.'+randomUUID()+'.tmp';
 try{
  let document={envId};
  try{const info=await lstat(path);if(!info.isFile()||(info.mode&0o77)!==0)throw fail('SESSION_FILE_NOT_PRIVATE');document=JSON.parse(await readFile(path,'utf8'));if(document.envId!==envId)throw fail('SESSION_FILE_ENV_MISMATCH');}catch(error){if(error.code!=='ENOENT')throw error;}
  document[label]={...document[label],...credentials};
  await writeFile(temp,JSON.stringify(document),{flag:'wx',mode:0o600});await rename(temp,path);
 }finally{await rm(temp,{force:true});await rm(lock,{recursive:true,force:true});}
}
