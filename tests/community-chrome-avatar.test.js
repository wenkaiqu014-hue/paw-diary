import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const tree=parse(app,{ecmaVersion:'latest',sourceType:'module'});
const declaration=tree.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='updatePublicIdentityChrome');
function element(){let text='';return {children:[],set textContent(v){text=v;this.children=[];},get textContent(){return text;},setAttribute(){},replaceChildren(...items){this.children=items;text='';}};}
function harness(read){
 const top=element(),side=element(),name={firstChild:{textContent:''}},nodes={'#owner-profile-button':top,'#about-button .owner-avatar':side,'#about-button':element(),'#about-button span:nth-child(2)':name};
 const context={publicProfile:{nickname:'QA',authorId:'author-A',avatarAssetId:'avatar-A'},authPrincipal:{userId:'A'},communityIdentityGeneration:1,publicChromeAvatarTurn:0,publicChromeAvatar:null,getLocale:()=> 'zh-CN',$:selector=>nodes[selector],document:{createElement:()=>element()},getCommunityImages:()=>({load:read}),communitySession(){return {userId:context.authPrincipal?.userId??null,generation:context.communityIdentityGeneration};}};
 vm.createContext(context);vm.runInContext(app.slice(declaration.start,declaration.end),context);
 return {context,top,side};
}
const dataUrl='data:image/png;base64,AAAA';
const flush=()=>new Promise(r=>setImmediate(r));
test('saved profile avatar is rendered in both account-menu triggers',async()=>{
 let calls=0;const h=harness(async(asset,reference)=>{calls++;assert.equal(asset,'avatar-A');assert.deepEqual({...reference},{kind:'profile',id:'author-A'});return {dataUrl};});
 h.context.updatePublicIdentityChrome();await flush();
 for(const node of [h.top,h.side]){assert.equal(node.children.length,1);assert.equal(node.children[0].src,dataUrl);assert.equal(node.children[0].alt,'');}
 h.context.updatePublicIdentityChrome();await flush();assert.equal(calls,1,'same-owner avatar should reuse the validated in-memory image');
});
test('late account-A image never paints after identity changes to B',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));h.context.updatePublicIdentityChrome();
 h.context.authPrincipal={userId:'B'};h.context.communityIdentityGeneration=2;h.context.publicProfile={nickname:'B',avatarAssetId:null};h.context.updatePublicIdentityChrome();resolve({dataUrl});await flush();
 assert.equal(h.top.textContent,'B');assert.equal(h.side.textContent,'B');assert.equal(h.top.children.length,0);
});
test('avatar read failure and removed avatar keep the nickname initial',async()=>{
 const h=harness(async()=>{throw Error('offline');});h.context.updatePublicIdentityChrome();await flush();assert.equal(h.top.textContent,'Q');assert.equal(h.side.textContent,'Q');
 h.context.publicProfile={nickname:'Guest',avatarAssetId:null};h.context.updatePublicIdentityChrome();assert.equal(h.top.textContent,'G');
});
