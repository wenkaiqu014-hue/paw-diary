"""Optimistic likes preserve decoded photo nodes and comment input at the request boundary."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:4197');p.add_argument('--label',default='green');a=p.parse_args()
OUT=ROOT/'test-results/v102/like-static'/a.label;OUT.mkdir(parents=True,exist_ok=True)
FIXTURE='''<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><main><div id="fixture"></div></main><script type="module">
import {mountCommunity} from '/src/features/community.js';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA0kAAAAASUVORK5CYII=';
const item={post:{id:'p',title:'Synthetic like',text:'Preserve decoded image',topic:'今日萌宠',imageAssetId:'photo',revision:1,likeCount:0,commentCount:0},identity:{authorId:'A',nickname:'Synthetic',avatarAssetId:'avatar'},liked:false};
window.imageReads=0;window.likeKeys=[];
const repository={request:async(action,payload,options)=>{if(action==='community.list')return {items:[structuredClone(item)]};if(action==='community.get')return structuredClone(item);if(action==='comments.list')return {items:[]};if(action==='likes.set'){window.likeKeys.push(options.operationId);return await new Promise((resolve,reject)=>window.reply=(ok,count)=>ok?resolve({liked:payload.liked,likeCount:count}):reject({code:'TIMEOUT'}));}throw {code:'INVALID_INPUT'};}};
window.community=mountCommunity({container:document.querySelector('#fixture'),repository,getSession:()=>({userId:'A',generation:1}),resolveImage:async()=>{window.imageReads++;return png;}});window.ready=true;
</script>'''
(OUT/'fixture.html').write_text(FIXTURE)
reports=[]
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=False)
 for width in [1440,390]:
  page=b.new_page(viewport={'width':width,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(a.url+'/test-results/v102/like-static/'+a.label+'/fixture.html');page.wait_for_function("window.ready && [...document.querySelectorAll('[data-community-post] img')].length===2 && [...document.querySelectorAll('[data-community-post] img')].every(i=>i.naturalWidth>0)")
  page.get_by_role('button',name='查看详情',exact=True).click();page.locator('[name="comment"]').fill('Keep this comment');page.wait_for_function("[...document.querySelectorAll('[data-community-detail] img')].length===2 && [...document.querySelectorAll('[data-community-detail] img')].every(i=>i.naturalWidth>0)")
  page.evaluate("window.images=[...document.querySelectorAll('#fixture img,[data-community-detail] img')];window.readCount=window.imageReads;window.comment=document.querySelector('[name=comment]');window.likeButton=document.querySelector('[data-community-detail] [data-like-post]');window.originalSrc=window.images.map(i=>i.src)")
  like=page.locator('[data-community-detail] [data-like-post]');like.click();page.wait_for_function("window.likeKeys.length===1")
  def stable():
   return page.evaluate("window.images.every((i,n)=>i.isConnected && i.naturalWidth>0 && i.src===window.originalSrc[n]) && window.imageReads===window.readCount && window.comment===document.querySelector('[name=comment]') && window.comment.value==='Keep this comment' && document.activeElement===window.likeButton")
  assert stable(),'Like replaced decoded image/comment nodes or lost focus'
  assert like.get_attribute('aria-pressed')=='true' and like.get_attribute('aria-disabled')=='true' and like.inner_text()=='已点赞 1','Not optimistic during pending request'
  like.evaluate('button=>button.click()');assert page.evaluate('window.likeKeys.length===1'), 'Duplicate request while pending'
  page.screenshot(path=str(OUT/f'pending-{width}.png'))
  page.evaluate('window.reply(true,4)');page.wait_for_function("document.querySelector('[data-community-detail] [data-like-post]').textContent==='已点赞 4'");assert stable(),page.evaluate("({images:window.images.map((i,n)=>({connected:i.isConnected,width:i.naturalWidth,src:i.src===window.originalSrc[n]})),reads:window.imageReads,prior:window.readCount,comment:window.comment===document.querySelector('[name=comment]'),focus:document.activeElement.outerHTML,button:window.likeButton.outerHTML})")
  like.click();page.wait_for_function('window.likeKeys.length===2');assert like.inner_text()=='点赞 3';assert stable()
  page.evaluate('window.reply(false)');page.wait_for_function("document.querySelector('[data-community-detail] [data-like-post]').getAttribute('aria-disabled')==='false'");assert like.inner_text()=='已点赞 4' and stable();assert page.locator('[data-community-detail] [data-like-error]').is_visible()
  like.click();page.wait_for_function('window.likeKeys.length===3');assert page.evaluate('window.likeKeys[1]===window.likeKeys[2]')
  page.evaluate('window.reply(true,3)');page.wait_for_function("document.querySelector('[data-community-detail] [data-like-post]').textContent==='点赞 3'");assert stable();assert not errors
  reports.append({'width':width,'decodedNodesPreserved':True,'optimistic':True,'successActualCount':4,'failureRollback':True,'retrySameKey':True,'commentAndFocusPreserved':True,'pageErrors':errors});page.close()
 b.close()
(OUT/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(json.dumps(reports))
