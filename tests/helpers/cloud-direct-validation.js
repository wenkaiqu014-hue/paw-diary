import {createHash} from 'node:crypto';
const failure = code => Object.assign(new Error(code),{code});
const permissionCodes = {
  storage: new Set(['STORAGE_EXCEED_AUTHORITY','PERMISSION_DENIED']),
  database: new Set(['DATABASE_PERMISSION_DENIED','PERMISSION_DENIED']),
};
// Only exact codes documented by CloudBase count; malformed refs and transport errors never do.
export async function requireDirectDenial(operation,{kind}={}) {
  if(!permissionCodes[kind])throw failure('REAL_CLOUD_DIRECT_PROBE_FAILED');
  let result;
  try { result=await operation(); }
  catch(error) {
    if(permissionCodes[kind].has(error?.code))return {denied:true,code:error.code};
    throw failure('REAL_CLOUD_DIRECT_PROBE_FAILED');
  }
  if(result?.allowed===false&&permissionCodes[kind].has(result.code))return {denied:true,code:result.code};
  throw failure('REAL_CLOUD_DIRECT_PROBE_FAILED');
}
async function loadOneManagedAsset({envId,assetId}) {
  // This main-process fixture lookup does not provide an actor or a business authorization path.
  const secretId=process.env.TENCENTCLOUD_FUJI_SECRET_ID,secretKey=process.env.TENCENTCLOUD_FUJI_SECRET_KEY;
  if(!secretId||!secretKey)throw failure('REAL_CLOUD_FIXTURE_LOOKUP_NOT_CONFIGURED');
  try {
    const cloudbase=(await import('@cloudbase/node-sdk')).default;
    const app=cloudbase.init({env:envId,region:'ap-shanghai',secretId,secretKey});
    const result=await app.database().collection('media_assets').where({'value.id':assetId}).limit(1).get();
    if(result?.code||!Array.isArray(result?.data)||result.data.length!==1)throw failure('REAL_CLOUD_FIXTURE_LOOKUP_FAILED');
    return result.data[0];
  }catch {throw failure('REAL_CLOUD_FIXTURE_LOOKUP_FAILED');}
}
export async function bindConfirmedFixture({envId,assetId,petId,sha256,bytes,ownerUidHash,actors,loadDocument=loadOneManagedAsset}={}) {
  if(typeof envId!=='string'||!/^[a-z0-9-]{1,80}$/.test(envId)||typeof assetId!=='string'||!assetId||
      typeof petId!=='string'||!petId||!/^[a-f0-9]{64}$/.test(sha256??'')||!Number.isInteger(bytes)||bytes<1||
      !/^[a-f0-9]{64}$/.test(ownerUidHash??'')||!Array.isArray(actors)||!actors.length)
    throw failure('REAL_CLOUD_FIXTURE_MISMATCH');
  const doc=await loadDocument({envId,assetId}),asset=doc?.value;
  const ownerMatches=typeof doc?.ownerId==='string'&&doc.ownerId===asset?.ownerId&&
      createHash('sha256').update(`${envId}\0${doc.ownerId}`).digest('hex')===ownerUidHash;
  if(!ownerMatches||asset?.id!==assetId||asset.staging!==false||asset.deletedAt!==null||
      asset.petId!==petId||asset.sha256!==sha256||asset.bytes!==bytes||
      typeof asset.fileRef!=='string'||!asset.fileRef.startsWith(`cloud://${envId}.`)||!asset.fileRef.includes('/'))
    throw failure('REAL_CLOUD_FIXTURE_MISMATCH');
  for(const actor of actors) {
    if(typeof actor?.bindFixtureObject!=='function')throw failure('REAL_CLOUD_FIXTURE_MISMATCH');
    await actor.bindFixtureObject({assetId,fileRef:asset.fileRef});
  }
  return {bound:true}; // Never return owner, fileRef or raw managed document to assertions/output.
}
