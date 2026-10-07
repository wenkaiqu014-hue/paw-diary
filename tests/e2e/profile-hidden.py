"""Isolated profile hidden-list fixture: no cloud account or private session."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/stage4/profile-hidden';OUT.mkdir(parents=True,exist_ok=True)
HTML=r'''<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/src/ui/community.css"><body><main style="max-width:1100px;margin:0 auto"><div id="profile"></div></main><script type="module">
import {mountProfile} from '/src/features/profile.js';
let session={userId:'A-hidden-fixture',generation:1},locale='zh-CN',feature;window.failList=true;window.failRestore=true;window.holdRestore=false;window.releaseRestore=null;window.restoreCalls=0;window.keys=[];
const rows=[{postId:'hidden-1',title:'<script>literal title<\/script>',available:true},{postId:'hidden-2',title:null,available:false}];
const repo={request:async(a,p={},o={})=>{await new Promise(r=>setTimeout(r,10));if(a==='profiles.getOwn')return{authorId:'a',nickname:'合成昵称',bio:'',avatarAssetId:null,cityId:null,districtId:null,petTypes:[],purposes:[],discoverable:false,revision:1};if(a==='auth.getOwn')return{email:'synthetic@example.test'};if(a==='community.hidden.list'){if(window.failList){window.failList=false;throw {code:'UNAVAILABLE'};}return{items:structuredClone(rows),nextCursor:null};}if(a==='community.hide'){window.restoreCalls++;window.keys.push(o.operationId);if(window.holdRestore)await new Promise(r=>window.releaseRestore=r);if(window.failRestore){window.failRestore=false;throw {code:'UNAVAILABLE'};}rows.splice(rows.findIndex(r=>r.postId===p.postId),1);return{postId:p.postId,hidden:false};}throw {code:'INVALID_INPUT'};}};
feature=mountProfile({container:document.querySelector('#profile'),repository:repo,getSession:()=>({...session}),getLocale:()=>locale});window.feature=feature;window.english=()=>{locale='en';feature.refreshLocale();};window.switchB=()=>{session={userId:'B-hidden-fixture',generation:2};feature.destroy();};
</script></body></html>'''
(OUT/'fixture.html').write_text(HTML)
parser=argparse.ArgumentParser();parser.add_argument('--red',action='store_true');args=parser.parse_args()
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=False);page=browser.new_page(viewport={'width':390,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4196/test-results/stage4/profile-hidden/fixture.html');page.wait_for_load_state('networkidle');page.get_by_role('button',name='重新读取隐藏列表',exact=True).click();page.locator('[data-hidden-post]').first.wait_for();assert page.locator('[data-hidden-post]').count()==2
 page.evaluate('english()');assert page.get_by_role('heading',name='Hidden posts',exact=True).count()==1,'locale refresh must retain and translate hidden-list UI'
 if not args.red:
  page.screenshot(path=str(OUT/'profile-hidden-en-390-with-rows.png'),full_page=True)
  page.get_by_text('<script>literal title</script>',exact=True).wait_for();page.get_by_role('button',name='Restore visibility',exact=True).click();page.get_by_text('Could not restore. The hidden marker is kept. Retry.',exact=True).wait_for();assert page.locator('[data-hidden-post]').count()==2
  page.evaluate('window.holdRestore=true');page.get_by_role('button',name='Restore visibility',exact=True).click();page.wait_for_function('window.releaseRestore!==null');assert page.get_by_role('button',name='Restoring…',exact=True).is_disabled();assert page.evaluate('window.restoreCalls')==2;page.evaluate('window.releaseRestore()');page.wait_for_timeout(70);assert page.locator('[data-hidden-post]').count()==1;assert page.evaluate('window.keys[0]===window.keys[1]') is True
  page.evaluate('window.holdRestore=false');page.get_by_role('button',name='Remove hidden marker',exact=True).click();page.get_by_text('You have not hidden any posts.',exact=True).wait_for();assert page.evaluate('window.restoreCalls')==3
  for width in [390,768,1440]:
   page.set_viewport_size({'width':width,'height':1000});page.screenshot(path=str(OUT/f'profile-hidden-en-{width}.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  assert not errors,errors
 browser.close()
print(json.dumps({'passed':True,'synthetic':True,'hiddenRecovery':not args.red,'pageErrors':errors}))
