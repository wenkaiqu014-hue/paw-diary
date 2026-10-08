// This contract is shared by the private editor and the public gateway.
export const PROFILE_PURPOSES=Object.freeze(['新手互助','遛宠搭子','养猫交流','多宠家庭']);
export const PROFILE_PET_TYPES=Object.freeze(['cat','dog']);
export const MAX_PROFILE_PET_TYPES=10;
export const MAX_PET_TYPE_NAME_LENGTH=20;
const fields=new Set(['nickname','avatarAssetId','bio','cityId','districtId','petTypes','purposes','discoverable']);
const invalid=(field,reason='invalid')=>{throw Object.assign(new Error('Invalid public profile'),{code:'INVALID_INPUT',...(field?{field,messageKey:`profile.${field}.${reason}`}:{})});};
const text=(value,max,required=false,field)=>{if(typeof value!=='string'||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))invalid(field);if(required&&!value.trim())invalid(field,'required');if(value.trim().length>max)invalid(field,'length');return value.trim();};
const optionalId=(value,field)=>{if(value===undefined||value===null||value==='')return null;if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(value))invalid(field);return value;};
const petTypeAliases=new Map([['cat','cat'],['cats','cat'],['猫','cat'],['猫咪','cat'],['dog','dog'],['dogs','dog'],['狗','dog'],['狗狗','dog']]);
export function normalizePetTypeName(value){
  if(typeof value!=='string'||/[\p{Cc}<>]/u.test(value))invalid('petTypes');
  const name=value.normalize('NFKC').trim().replace(/\s+/gu,' ');
  if(!name||/[\p{Cc}<>]/u.test(name))invalid('petTypes');
  if([...name].length>MAX_PET_TYPE_NAME_LENGTH)invalid('petTypes','length');
  return petTypeAliases.get(name.toLowerCase())??name;
}
export function normalizePetTypes(values=[]){
  if(!Array.isArray(values))invalid('petTypes');
  if(values.length>MAX_PROFILE_PET_TYPES)invalid('petTypes','limit');
  const normalized=Array.from(values,normalizePetTypeName);
  if(new Set(normalized).size!==normalized.length)invalid('petTypes','duplicate');
  return normalized;
}
const choices=(value,allowed,field)=>{if(value===undefined)return[];if(!Array.isArray(value)||value.length>allowed.length||value.some(v=>!allowed.includes(v))||new Set(value).size!==value.length)invalid(field);return [...value];};
export function validateProfileInput(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.has(k)))invalid();
  if(input.discoverable!==undefined&&typeof input.discoverable!=='boolean')invalid('discoverable');
  const profile={nickname:text(input.nickname,30,true,'nickname'),avatarAssetId:optionalId(input.avatarAssetId,'avatarAssetId'),bio:text(input.bio??'',120,false,'bio'),cityId:optionalId(input.cityId,'cityId'),districtId:optionalId(input.districtId,'districtId'),petTypes:normalizePetTypes(input.petTypes),purposes:choices(input.purposes,PROFILE_PURPOSES,'purposes'),discoverable:input.discoverable??false};
  if(profile.districtId&&!profile.cityId)invalid('cityId','required');
  if(profile.discoverable){if(!profile.cityId)invalid('cityId','required');if(!profile.petTypes.length)invalid('petTypes','required');if(!profile.purposes.length)invalid('purposes','required');}
  return profile;
}
export function publicIdentity(profile){return{authorId:profile.authorId,nickname:profile.nickname,avatarAssetId:profile.avatarAssetId??null};}
export function discoverableProfile(profile){return{...publicIdentity(profile),bio:profile.bio??'',cityId:profile.cityId??null,cityName:profile.cityName??null,districtId:profile.districtId??null,districtName:profile.districtName??null,petTypes:[...(profile.petTypes??[])],purposes:[...(profile.purposes??[])]};}
export function ownProfile(profile){return profile?{...discoverableProfile(profile),discoverable:profile.discoverable===true,revision:profile.revision,createdAt:profile.createdAt,updatedAt:profile.updatedAt}:{authorId:null,nickname:'',avatarAssetId:null,bio:'',cityId:null,cityName:null,districtId:null,districtName:null,petTypes:[],purposes:[],discoverable:false,revision:0,createdAt:null,updatedAt:null};}
