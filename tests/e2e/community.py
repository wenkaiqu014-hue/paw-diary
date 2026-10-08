"""Synthetic repository UI checks only; never claims public-cloud acceptance."""
import argparse, json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results/stage4/community-ui'
OUT.mkdir(parents=True,exist_ok=True)
FIXTURE=r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/src/ui/community.css"><title>Community synthetic fixture</title><body><main style="max-width:1140px;margin:0 auto"><div id="community-fixture"></div><section class="panel" data-example><h2>示例内容</h2><p>这是独立示例区域，不进入真实社区计数。</p></section></main><script type="module">
let feature={},handoffModule={};try{feature=await import('/src/features/community.js');handoffModule=await import('/src/features/community-draft-handoff.js');}catch(e){window.missingModule=e.message;}window.mountType=typeof feature.mountCommunity;
window.setupFixture=(locale='zh-CN')=>{
 window.community?.destroy();
 let session={userId:null,generation:1},language=locale,hasProfile=false,controller=null,serial=0;
 const handoff=handoffModule.createDraftHandoff(),posts=new Map(),receipts=new Map(),comments=new Map();window.savedPosts=0;window.failSave=false;window.transition=null;window.scriptExecuted=false;window.lastWriteKey=null;window.holdComments=false;window.releaseComment=null;
 function make(id,title,author='B'){return {post:{id,authorId:'author-'+author,title,text:'长正文 '+('养宠交流与新手照顾。'.repeat(22)),topic:'今日萌宠',cityId:'310100',cityName:'上海市',districtId:null,imageAssetId:null,revision:1,likeCount:0,commentCount:0,createdAt:'2026-10-07T13:00:00Z'},identity:{authorId:'author-'+author,nickname:author==='B'?'长昵称新手宠友':'我的昵称',avatarAssetId:null},isOwn:session.userId===author,liked:false};}
 for(const p of [make('p1','养宠第一天'),make('p2','<script>window.scriptExecuted=true<\/script>')])posts.set(p.post.id,p);
 const respond=async(action,p={},options={})=>{
  await new Promise(r=>setTimeout(r,12));
  if(action==='community.list'){let all=[...posts.values()].map(v=>({...v,isOwn:v.identity.authorId==='author-'+session.userId}));if(p.authorId)all=all.filter(v=>v.identity.authorId===p.authorId);if(p.query)all=all.filter(v=>(v.post.title+v.post.text).includes(p.query));if(p.topic)all=all.filter(v=>v.post.topic===p.topic);if(p.scope==='city')all=all.filter(v=>v.post.cityId===p.cityId);return {items:p.cursor?all.slice(1):all.slice(0,2),nextCursor:!p.cursor&&all.length>1?'next':null};}
  if(action==='community.get'){const v=posts.get(p.id);return {...v,isOwn:v.identity.authorId==='author-'+session.userId};}
  if(action==='comments.list')return {items:[...(comments.get(p.postId)??[])],nextCursor:null};
  if(['community.save','comments.save','likes.set','community.report','community.hide','community.delete','comments.delete'].includes(action)&&!session.userId)throw {code:'UNAUTHENTICATED'};
  if(action==='community.save'){window.lastWriteKey=options.operationId;if(!hasProfile)throw {code:'PROFILE_REQUIRED'};if(window.failSave){window.failSave=false;throw {code:'UNAVAILABLE'};}if(receipts.has(options.operationId))return receipts.get(options.operationId);const id=p.id??'saved-'+(++serial),v={...make(id,p.title,'A'),post:{...make(id,p.title,'A').post,...p,id,revision:(posts.get(id)?.post.revision??0)+1},isOwn:true};posts.set(id,v);receipts.set(options.operationId,v);if(!p.id)window.savedPosts++;return v;}
  if(action==='comments.save'){if(window.holdComments)await new Promise(r=>window.releaseComment=r);if(!hasProfile)throw {code:'PROFILE_REQUIRED'};if(receipts.has(options.operationId))return receipts.get(options.operationId);const v={comment:{id:'comment-'+(++serial),postId:p.postId,text:p.text,createdAt:'2026-10-07T13:00:00Z'},identity:{authorId:'author-A',nickname:'我的昵称'},isOwn:true};comments.set(p.postId,[...(comments.get(p.postId)??[]),v]);posts.get(p.postId).post.commentCount++;receipts.set(options.operationId,v);return v;}
  if(action==='likes.set'){const v=posts.get(p.postId);v.liked=p.liked;v.post.likeCount=p.liked?1:0;return {postId:p.postId,liked:p.liked,likeCount:v.post.likeCount};}
  if(action==='community.delete'){posts.delete(p.id);return{id:p.id,deleted:true};}
  if(action==='community.hide'){posts.delete(p.postId);return{postId:p.postId,hidden:true};}
  if(action==='community.report')return{reportId:'reported',status:'queued'};
  if(action==='profiles.getOwn')return{nickname:hasProfile?'我的昵称':'',cityId:'310100',districtId:null};
  throw {code:'INVALID_INPUT'};
 };
 const repository={request:async(...args)=>structuredClone(await respond(...args))};
 const mount=initialDraft=>{controller?.destroy();controller=feature.mountCommunity({container:document.querySelector('#community-fixture'),repository,getSession:()=>({...session}),getLocale:()=>language,draftHandoff:handoff,initialDraft,getBrowseRegion:()=>({cityId:'310100',cityName:'上海市',districtId:null}),onLogin:info=>window.transition={type:'login',...info},onProfile:info=>window.transition={type:'profile',...info}});window.community=controller;};
 window.completeLogin=()=>{session={userId:'A',generation:session.generation+1};handoff.bindLoginOwner('A');mount(handoff.consume('A'));window.transition=null;};
 window.completeProfile=()=>{hasProfile=true;mount(handoff.consume('A'));window.transition=null;};
 window.cancelTransition=()=>{handoff.clear();window.transition=null;};
 window.switchAccount=()=>{session={userId:'B',generation:session.generation+1};handoff.clear();mount();};
 window.useEnglish=()=>{language='en';controller.refreshLocale();};window.useChinese=()=>{language='zh-CN';controller.refreshLocale();};
 window.forceSigned=()=>{session={userId:'A',generation:session.generation+1};hasProfile=true;mount();};
 mount();
};
</script></body></html>'''
(OUT/'fixture.html').write_text(FIXTURE)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--url',default=os.environ.get('PAW_COMMUNITY_UI_TEST_URL','http://127.0.0.1:4194/test-results/stage4/community-ui/fixture.html'));parser.add_argument('--red',action='store_true');args=parser.parse_args()
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='chrome',headless=False)
  page=browser.new_page(viewport={'width':1440,'height':1000})
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(args.url);page.wait_for_load_state('networkidle');page.wait_for_function('window.mountType !== undefined')
  assert page.evaluate('window.mountType')=='function','community public UI mount must exist'
  if args.red:browser.close();return
  page.evaluate('setupFixture()');page.locator('[data-community-post]').first.wait_for()
  page.get_by_role('button',name='写一篇',exact=True).click();page.locator('[name="title"]').fill('访客取消草稿');page.locator('[name="text"]').fill('不会发布');page.get_by_role('button',name='确认发布',exact=True).click();page.wait_for_function("window.transition?.type === 'login'");page.evaluate('cancelTransition()');page.get_by_role('button',name='取消',exact=True).click();page.get_by_role('button',name='确认',exact=True).click();assert page.evaluate('window.savedPosts')==0
  page.evaluate('setupFixture()');page.locator('[data-community-post]').first.wait_for()
  assert page.locator('[data-community-post]').count()==2
  page.get_by_text('<script>window.scriptExecuted=true</script>',exact=True).wait_for()
  assert page.evaluate('window.scriptExecuted') is False
  page.get_by_role('button',name='更多帖子',exact=True).click();page.wait_for_timeout(70)
  assert page.locator('[data-community-post]').count()==2
  page.get_by_role('tab',name='全部',exact=True).focus();page.keyboard.press('ArrowRight');page.wait_for_timeout(70);assert page.get_by_role('tab',name='同城',exact=True).get_attribute('aria-selected')=='true'
  page.locator('[data-community-topic]').select_option('养宠心得');page.wait_for_timeout(70);assert page.locator('[data-community-post]').count()==0
  page.locator('[data-community-topic]').select_option('今日萌宠');page.locator('[data-community-search] [name="query"]').fill('第一天');page.locator('[data-community-search]').get_by_role('button',name='搜索',exact=True).click();page.wait_for_timeout(70);assert page.locator('[data-community-post]').count()==1
  page.locator('[data-community-search] [name="query"]').fill('');page.locator('[data-community-search]').get_by_role('button',name='搜索',exact=True).click();page.wait_for_timeout(70)
  page.get_by_role('tab',name='全部',exact=True).click();page.wait_for_timeout(70)
  assert page.locator('[data-community-post]').first.get_by_role('button',name='编辑',exact=True).count()==0
  page.get_by_role('button',name='写一篇',exact=True).click()
  page.locator('[name="title"]').fill('访客的同一篇草稿')
  page.locator('[name="text"]').fill('登录和补昵称后也要保留的输入');page.evaluate("window.community.setBrowseRegion({cityId:'440300',districtId:'440305'})");assert page.locator('[name="text"]').input_value()=='登录和补昵称后也要保留的输入';assert page.evaluate('window.community.getState().filters.cityId') is None
  page.get_by_role('button',name='确认发布',exact=True).click();page.wait_for_function("window.transition?.type === 'login'")
  page.evaluate('completeLogin()');page.wait_for_function("window.transition?.type === 'profile'");assert page.locator('[name="title"]').count()==0
  page.evaluate('completeProfile()');page.locator('[name="title"]').wait_for();assert page.locator('[name="title"]').input_value()=='访客的同一篇草稿';assert page.locator('[name="text"]').input_value()=='登录和补昵称后也要保留的输入'
  page.evaluate('window.failSave=true');page.get_by_role('button',name='确认发布',exact=True).click();page.locator('[data-community-editor-error]').wait_for(state='visible');assert page.locator('[name="title"]').input_value()=='访客的同一篇草稿'
  failed_key=page.evaluate('window.lastWriteKey');page.get_by_role('button',name='确认发布',exact=True).click();page.wait_for_function('window.savedPosts===1');assert page.evaluate('window.lastWriteKey')==failed_key
  page.locator('[data-community-post]').filter(has_text='访客的同一篇草稿').get_by_role('button',name='查看详情',exact=True).click()
  page.locator('[data-community-detail]').wait_for(state='visible');page.locator('[data-community-detail]').get_by_role('button',name='点赞 0',exact=True).click();page.locator('[data-community-detail]').get_by_role('button',name='已点赞 1',exact=True).wait_for();page.locator('[data-community-detail]').get_by_role('button',name='已点赞 1',exact=True).click();page.locator('[data-community-detail]').get_by_role('button',name='点赞 0',exact=True).wait_for();page.locator('[name="comment"]').fill('待发送评论不能被编辑入口丢掉');page.locator('[data-community-detail]').get_by_role('button',name='编辑',exact=True).click();assert page.get_by_role('alertdialog').is_visible();page.keyboard.press('Escape');assert page.locator('[name="comment"]').input_value()=='待发送评论不能被编辑入口丢掉';page.locator('[name="comment"]').fill('合成评论 <script>window.scriptExecuted=true</script>');page.evaluate('window.holdComments=true');page.get_by_role('button',name='发表评论',exact=True).click();page.wait_for_function('window.releaseComment !== null');assert page.locator('[data-community-detail]').get_by_role('button',name='编辑',exact=True).is_disabled();assert page.locator('[data-community-detail]').get_by_role('button',name='删除',exact=True).is_disabled();page.evaluate('useEnglish()');assert page.locator('[data-community-detail]').get_by_role('button',name='Edit',exact=True).is_disabled();assert page.locator('[data-community-detail]').get_by_role('button',name='Close details',exact=True).is_disabled();page.evaluate('window.releaseComment()');page.wait_for_timeout(70);assert page.evaluate('window.community.getState().detail.comments.length')==1;assert page.evaluate('window.community.getState().detail.item.post.commentCount')==1;assert page.evaluate('window.scriptExecuted') is False
  page.get_by_role('button',name='Close details',exact=True).click();page.evaluate('useChinese()')
  for width in [1440,768,390]:
   page.set_viewport_size({'width':width,'height':1000});page.wait_for_timeout(80);page.screenshot(path=str(OUT/f'community-zh-{width}.png'),full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+2'),f'horizontal overflow at {width}'
  page.evaluate('useEnglish()');page.get_by_role('button',name='Write a post',exact=True).wait_for()
  for width in [1440,768,390]:
   page.set_viewport_size({'width':width,'height':1000});page.wait_for_timeout(70);page.screenshot(path=str(OUT/f'community-en-{width}.png'),full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+2'),f'English horizontal overflow at {width}'
  page.locator('[data-community-post]').filter(has_text='访客的同一篇草稿').get_by_role('button',name='Edit',exact=True).click();page.locator('[name="title"]').fill('Edited draft');page.get_by_role('button',name='Save changes',exact=True).click();page.wait_for_timeout(80)
  own=page.locator('[data-community-post]').filter(has_text='Edited draft');own.get_by_role('button',name='Report',exact=True).click();page.locator('[name="reason"]').select_option('其他');page.get_by_role('button',name='Submit report',exact=True).click();page.wait_for_timeout(70);page.get_by_text('Submitted and awaiting review.',exact=True).wait_for()
  own.get_by_role('button',name='Delete',exact=True).click();page.get_by_role('button',name='Confirm',exact=True).click();page.wait_for_timeout(70);assert page.locator('[data-community-post]').filter(has_text='Edited draft').count()==0
  page.get_by_role('button',name='Write a post',exact=True).click();page.locator('[name="title"]').fill('Account A private draft');page.locator('[name="text"]').fill('Account A only');assert page.get_by_role('button',name='Close editor',exact=True).count()==1;page.evaluate('switchAccount()');assert page.locator('[data-community-editor]').count()==0
  assert not errors,errors
  (OUT/'report.json').write_text(json.dumps({'synthetic':True,'headful':True,'widths':[1440,768,390],'languages':['zh-CN','en'],'savedPosts':page.evaluate('window.savedPosts'),'pageErrors':errors},ensure_ascii=False,indent=2))
  browser.close()
 print(json.dumps({'passed':True,'synthetic':True,'screenshots':str(OUT)},ensure_ascii=False))
if __name__=='__main__':main()
