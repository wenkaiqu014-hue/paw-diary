import {computeRecapFacts,prepareRecapShare} from '../domain/recap-facts.js';
export function createCommunityRecapDraft({snapshot,petId,from,to,locale='zh-CN',editedText}={}){
 const facts=computeRecapFacts({snapshot,petId,from,to}),preview=prepareRecapShare({from,to,facts,uiLocale:locale},{includeWeights:false});
 if(editedText!==undefined){const lines=String(editedText).trim().split('\n'),title=(lines.shift()||preview.title).trim(),text=lines.join('\n').trim()||preview.text;return {title,text,topic:'养宠心得'};}
 return {title:preview.title,text:preview.text,topic:'养宠心得'};
}
