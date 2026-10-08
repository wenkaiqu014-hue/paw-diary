const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const valid = value => typeof value === 'string' && VERSION.test(value);
export function isInteractionBlocked({dialogOpen=false,dirty=false,saving=false,aiSaving=false,publicDirty=false,publicSaving=false,photoDirty=false,photoSaving=false,transitioning=false}={}) {
 return [dialogOpen,dirty,saving,aiSaving,publicDirty,publicSaving,photoDirty,photoSaving,transitioning].some(value => value === true);
}
export function decideStartupHelp({release,preferences,blocked,previewEnabled=false}={}) {
 if (!valid(release?.version) || !(release.channel === 'stable' || release.channel === 'preview' && previewEnabled === true)) return 'none';
 if (preferences?.acknowledgedVersions?.includes(release.version)) return 'none';
 return blocked ? 'defer' : 'whats-new';
}
export function isNewStableRelease(current,remote) {
 if (current?.channel !== 'stable' || remote?.channel !== 'stable' || !valid(current.version) || !valid(remote.version)) return false;
 const from=current.version.split('.').map(BigInt),to=remote.version.split('.').map(BigInt);
 for(let i=0;i<3;i++) { if(to[i]>from[i])return true; if(to[i]<from[i])return false; }
 return false;
}
