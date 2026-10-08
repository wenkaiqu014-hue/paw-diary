export const HELP_TOPICS = Object.freeze([
 ['start',3],['pets',3],['records',3],['ai',3],['recap',3],['community',3],['files',3],['calendar',3],['install',4]
].map(([id,count])=>Object.freeze({id,titleKey:`help.${id}.title`,bodyKeys:Object.freeze(Array.from({length:count},(_,i)=>`help.${id}.body${i+1}`))})));
