import {decideStartupHelp,isInteractionBlocked} from '../domain/help-lifecycle.js';

// Only UI preferences are written here. The caller owns identity and business drafts.
export function createHelpCoordinator({release,previewEnabled=false,preferences,getIdentity,getInteractionState,showWhatsNew,closeWhatsNew,startTour}){
 let enabled=false,shownIdentity=null,pendingTour=null,tourStarting=false,epoch=0;
 const dismissed=new Set();
 const key=identity=>`${identity}:${release.version}`;
 function evaluate(){
  if(!enabled)return 'none';
  const identity=getIdentity(),blocked=isInteractionBlocked(getInteractionState());
  if(shownIdentity&&shownIdentity!==identity){closeWhatsNew();shownIdentity=null;}
  if(pendingTour&&pendingTour!==identity)pendingTour=null;
  if(pendingTour&&!blocked&&!tourStarting){void runPendingTour();return 'tour';}
  if(shownIdentity||dismissed.has(key(identity)))return 'none';
  const decision=decideStartupHelp({release,preferences:preferences.read(identity),blocked,previewEnabled});
  if(decision==='whats-new'){shownIdentity=identity;showWhatsNew(release);}
  return decision;
 }
 async function runPendingTour(){
  if(!pendingTour||tourStarting||isInteractionBlocked(getInteractionState()))return;
  const identity=pendingTour,serial=epoch;tourStarting=true;
  try{
   if(getIdentity()!==identity)return;
   const result=await startTour({source:'automatic'});
   if(serial===epoch&&getIdentity()===identity&&result==='started')pendingTour=null;
  }finally{if(serial===epoch)tourStarting=false;}
 }
 async function acknowledge(){
  const identity=shownIdentity;
  if(!identity)return;
  shownIdentity=null;closeWhatsNew();
  if(getIdentity()!==identity)return;
  preferences.acknowledgeVersion(identity,release.version);
  if(preferences.read(identity).tourStatus==='unseen'){pendingTour=identity;await runPendingTour();}
 }
 function dismiss(){if(shownIdentity)dismissed.add(key(shownIdentity));shownIdentity=null;closeWhatsNew();}
 function identityChanged(){epoch++;pendingTour=null;tourStarting=false;shownIdentity=null;closeWhatsNew();return evaluate();}
 return {ready(){enabled=true;return evaluate();},evaluate,acknowledge,dismiss,identityChanged,openManually(){shownIdentity=getIdentity();showWhatsNew(release);}};
}
