// This contract is shared by the private editor and the public gateway.
export const PROFILE_PURPOSES=Object.freeze(['新手互助','遛宠搭子','养猫交流','多宠家庭']);
export const PROFILE_PET_TYPES=Object.freeze(['cat','dog']);
const fields=new Set(['nickname','avatarAssetId','bio','cityId','districtId','petTypes','purposes','discoverable']);
const invalid=()=>{throw Object.assign(new Error('Invalid public profile'),{code:'INVALID_INPUT'});};
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim())||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))invalid();return value.trim();};
const optionalId=value=>{if(value===undefined||value===null||value==='')return null;if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(value))invalid();return value;};
const choices=(value,allowed)=>{if(value===undefined)return[];if(!Array.isArray(value)||value.length>allowed.length||value.some(v=>!allowed.includes(v))||new Set(value).size!==value.length)invalid();return [...value];};
export function validateProfileInput(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.has(k)))invalid();
  if(input.discoverable!==undefined&&typeof input.discoverable!=='boolean')invalid();
  const profile={nickname:text(input.nickname,30,true),avatarAssetId:optionalId(input.avatarAssetId),bio:text(input.bio??'',120),cityId:optionalId(input.cityId),districtId:optionalId(input.districtId),petTypes:choices(input.petTypes,PROFILE_PET_TYPES),purposes:choices(input.purposes,PROFILE_PURPOSES),discoverable:input.discoverable??false};
  if(profile.districtId&&!profile.cityId)invalid();
  if(profile.discoverable&&(!profile.cityId||!profile.petTypes.length||!profile.purposes.length))invalid();
  return profile;
}
export function publicIdentity(profile){return{authorId:profile.authorId,nickname:profile.nickname,avatarAssetId:profile.avatarAssetId??null};}
export function discoverableProfile(profile){return{...publicIdentity(profile),bio:profile.bio??'',cityId:profile.cityId??null,cityName:profile.cityName??null,districtId:profile.districtId??null,districtName:profile.districtName??null,petTypes:[...(profile.petTypes??[])],purposes:[...(profile.purposes??[])]};}
export function ownProfile(profile){return profile?{...discoverableProfile(profile),discoverable:profile.discoverable===true,revision:profile.revision,createdAt:profile.createdAt,updatedAt:profile.updatedAt}:{authorId:null,nickname:'',avatarAssetId:null,bio:'',cityId:null,cityName:null,districtId:null,districtName:null,petTypes:[],purposes:[],discoverable:false,revision:0,createdAt:null,updatedAt:null};}
