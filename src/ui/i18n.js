import zh from './locales/zh-CN.js';
import en from './locales/en.js';
const dictionaries = Object.freeze({'zh-CN':zh,en});
export const LOCALE_STORAGE_KEY = 'paw-diary:locale';
export function escapeTranslation(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function createI18n({storage} = {}) {
  if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
  let locale = 'zh-CN';
  const listeners = new Set();
  try { const saved = storage?.getItem(LOCALE_STORAGE_KEY); if (Object.hasOwn(dictionaries,saved)) locale=saved; } catch {}
  const t = (key, params={}) => {
    const template = Object.hasOwn(dictionaries[locale],key)?dictionaries[locale][key]:Object.hasOwn(zh,key)?zh[key]:String(key);
    return template.replace(/\{(\w+)\}/g,(whole,name)=>Object.hasOwn(params,name)?String(params[name]??''):whole);
  };
  function setLocale(next) {
    if (!Object.hasOwn(dictionaries,next)) throw new RangeError('Unsupported locale');
    if(next===locale)return;
    locale=next;
    try {storage?.setItem(LOCALE_STORAGE_KEY,next);} catch {}
    for(const listener of listeners)listener(next);
  }
  return {t,setLocale,getLocale:()=>locale,subscribeLocale(listener){listeners.add(listener);return ()=>listeners.delete(listener);},translateLiteral:text=>Object.hasOwn(zh,text)?t(text):text};
}
const i18n=createI18n();
export const t=i18n.t;
export const setLocale=i18n.setLocale;
export const getLocale=i18n.getLocale;
export const subscribeLocale=i18n.subscribeLocale;
export const translateLiteral=i18n.translateLiteral;
