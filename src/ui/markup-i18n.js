import zh from './locales/zh-CN.js';
import {t as defaultT,getLocale as defaultGetLocale} from './i18n.js';
const escapeDisplay=(text,attribute=false)=>text.replace(attribute?/[&<>"']/g:/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayAttributes=new Set(['placeholder','title','aria-label','alt']);
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
let serial=0;
// Tags stay strings: a DOM parser would move placeholder text out of tbody.
const tagPattern=/<(?:[^"'<>]|"[^"]*"|'[^']*')*>/g;
const semantic=Object.entries(zh).filter(([key,value])=>key.includes('.')&&/\{\w+\}/.test(value)).map(([key,value])=>{
  const names=[];
  const pieces=value.split(/(\{\w+\})/g).map(piece=>{
    if(/^\{\w+\}$/.test(piece)){names.push(piece.slice(1,-1));return '(MARKER)';}
    return escapeRegex(piece).replace(/\s+/g,'\\s*');
  });
  return {key,names,source:'^'+pieces.join('')+'$'};
});
export function createMarkupI18n({t=defaultT,getLocale=defaultGetLocale}={}) {
  function translateUiText(value) {
    const original=String(value??'');
    const leading=original.match(/^\s*/)[0],trailing=original.match(/\s*$/)[0],copy=original.trim();
    if(!copy||getLocale()==='zh-CN')return original;
    if(Object.hasOwn(zh,copy))return leading+t(copy)+trailing;
    // A semantic key may be the only dictionary entry for a static piece of UI.
    const key=Object.keys(zh).find(key=>zh[key]===copy);
    return key?leading+t(key)+trailing:original;
  }
  function translateMarkedText(value,markerSource) {
    if(getLocale()==='zh-CN')return value;
    const leading=value.match(/^\s*/)[0],trailing=value.match(/\s*$/)[0],copy=value.trim();
    if(!copy)return value;
    for(const rule of semantic){
      const expression=rule.source.replace(/MARKER/g,markerSource);
      const match=new RegExp(expression).exec(copy);
      if(match){const params={};rule.names.forEach((name,index)=>params[name]=match[index+1]);return leading+t(rule.key,params)+trailing;}
    }
    return value.split(new RegExp('('+markerSource+')','g')).map(piece=>new RegExp('^'+markerSource+'$').test(piece)?piece:translateUiText(piece)).join('');
  }
  function html(strings,...values) {
    // Prefix is unique within this template; value contents are never scanned or retranslated.
    let prefix;do{prefix=`\uE000paw-i18n:${++serial}:`;}while(strings.some(piece=>piece.includes(prefix)));
    const suffix='\uE001',marker=index=>prefix+index+suffix;
    const markerSource=escapeRegex(prefix)+'\\d+'+suffix;
    let source=strings.map((piece,index)=>piece+(index<values.length?marker(index):'')).join('');
    const translateAttributes=tag=>tag.replace(/([\w:-]+)(\s*=\s*)(["'])([\s\S]*?)\3/g,(whole,name,equals,quote,value)=>{
      if(!displayAttributes.has(name.toLowerCase()))return whole;const copy=translateMarkedText(value,markerSource);return name+equals+quote+(copy===value?value:escapeDisplay(copy,true))+quote;
    });
    if(getLocale()!=='zh-CN'){
      if(/^\s*[\w:-]+\s*=/.test(source)&&!source.includes('<'))source=translateAttributes(source);
      let translated='',last=0;
      for(const match of source.matchAll(tagPattern)){
        const before=source.slice(last,match.index),copy=translateMarkedText(before,markerSource);translated+=copy===before?before:escapeDisplay(copy);
        const tag=translateAttributes(match[0]);
        translated+=tag;last=match.index+match[0].length;
      }
      const after=source.slice(last),copy=translateMarkedText(after,markerSource);source=translated+(copy===after?after:escapeDisplay(copy));
    }
    return source.replace(new RegExp(escapeRegex(prefix)+'(\\d+)'+suffix,'g'),(_,index)=>String(values[Number(index)]));
  }
  return {html,translateUiText};
}
const markup=createMarkupI18n();
export const html=markup.html;
export const translateUiText=markup.translateUiText;
