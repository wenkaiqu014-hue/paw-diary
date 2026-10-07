import{createRequire}from'node:module';
const require=createRequire(import.meta.url);const{handleCommunity}=require('../../backend/community/gateway.cjs');const{createMemoryCommunityStore}=require('../../backend/community/store.cjs');
let posts={},interactions={};try{posts=require('../../backend/community/posts.cjs');interactions=require('../../backend/community/interactions.cjs');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
export const A={userId:'A',emailVerified:true,isAnonymous:false},B={userId:'B',emailVerified:true,isAnonymous:false},C={userId:'C',emailVerified:true,isAnonymous:false};
export const postDraft={title:'合成养宠心得',text:'今天是明确标注的测试记录。',topic:'养宠心得',cityId:'310100',districtId:'310101'};
export async function communityFixture(){const store=createMemoryCommunityStore();let id=0;const regions={normalize:async input=>{if(input.cityId!=='310100'||input.districtId&&input.districtId!=='310101')throw Object.assign(Error('Invalid region'),{code:'INVALID_INPUT'});return{cityId:input.cityId,districtId:input.districtId??null,cityName:'上海市',districtName:input.districtId?'黄浦区':null};}};
 const handlers={community:(r,d)=>posts.handlePosts?.(r.action,r.payload,d),comments:(r,d)=>interactions.handleInteractions?.(r.action,r.payload,d),likes:(r,d)=>interactions.handleInteractions?.(r.action,r.payload,d)};
 const call=(action,payload={},principal=null,options={})=>handleCommunity({version:1,action,payload,...options},{principal,hasCredential:!!principal,store,regions,clock:()=>new Date('2026-10-07T13:27:00Z'),idFactory:()=>`test-id-${++id}`,handlers});
 for(const principal of[A,B,C])await call('profiles.saveOwn',{nickname:'合成'+principal.userId},principal,{idempotencyKey:'profile-'+principal.userId,expectedRevision:0});
 return{store,call,posts,interactions};
}
