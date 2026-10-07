export function createOwnerDraftQueue({getSession}={}){
 let pending=null;
 return {stage(draft){const session=getSession();pending={ownerId:session?.userId??null,generation:session?.generation??0,draft:structuredClone(draft)};},consume(){const item=pending;pending=null;if(!item)return null;const session=getSession();return item.ownerId===(session?.userId??null)&&item.generation===(session?.generation??0)?item.draft:null;},clear(){pending=null;}};
}
