const NAMESPACE = 'paw-diary:ui:v1';
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const statuses = new Set(['unseen', 'skipped', 'completed']);
const defaults = () => ({schemaVersion:1, acknowledgedVersions:[], tourStatus:'unseen'});
const clone = value => ({...value, acknowledgedVersions:[...value.acknowledgedVersions]});
function normalize(value) {
 if (!value || typeof value !== 'object' || value.schemaVersion !== 1) return defaults();
 return {schemaVersion:1, acknowledgedVersions:[...new Set((Array.isArray(value.acknowledgedVersions) ? value.acknowledgedVersions : []).filter(version => typeof version === 'string' && VERSION.test(version)))].slice(-8), tourStatus:statuses.has(value.tourStatus) ? value.tourStatus : 'unseen'};
}
export function uiIdentityKey({userId=null}={}) {
 return typeof userId === 'string' && userId.trim() ? `account:${userId}` : 'guest';
}
export function createUiPreferences({storage, memory=new Map()}={}) {
 const keyFor = identity => `${NAMESPACE}:${typeof identity === 'string' && (identity === 'guest' || identity.startsWith('account:')) ? identity : 'guest'}`;
 // A failed write makes memory authoritative for this page, even if old storage is readable.
 const memoryOnly = new Set();
 function read(identity) {
  const key=keyFor(identity);
  if (!memoryOnly.has(key)) {
   try {
    const raw=storage?.getItem(key);
    if (raw != null) { const value=normalize(JSON.parse(raw)); memory.set(key,value); return clone(value); }
   } catch { memoryOnly.add(key); }
  }
  return clone(normalize(memory.get(key)));
 }
 function write(identity,value) {
  const key=keyFor(identity), normalized=normalize(value); memory.set(key,normalized);
  try { storage?.setItem(key,JSON.stringify(normalized)); } catch { memoryOnly.add(key); }
  return clone(normalized);
 }
 return {
  read,
  acknowledgeVersion(identity,version) {
   const value=read(identity);
   if (typeof version !== 'string' || !VERSION.test(version)) return value;
   if (!value.acknowledgedVersions.includes(version)) value.acknowledgedVersions.push(version);
   return write(identity,value);
  },
  setTourStatus(identity,status) {
   const value=read(identity);
   if (!statuses.has(status)) return value;
   value.tourStatus=status; return write(identity,value);
  }
 };
}
