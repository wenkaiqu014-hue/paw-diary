"""Real-browser public-image lazy loading regression, using synthetic repository bytes."""
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results/v101/community-images'
OUT.mkdir(parents=True,exist_ok=True)
FIXTURE=r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/src/ui/community.css"><body><main style="max-width:1000px;margin:auto"><div id="fixture"></div></main><script type="module">
import {mountCommunity} from '/src/features/community.js';
import {createCommunityImageLoader} from '/src/media/community-images.js';
const dataUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA0kAAAAASUVORK5CYII=';
const bytes=Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0));const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
window.reads=[];window.failImages=false;window.delay=0;window.language='zh-CN';
const item={post:{id:'post-visible',authorId:'author-A',title:'合成图片回归',text:'真实IntersectionObserver须读取照片',topic:'今日萌宠',cityId:null,districtId:null,imageAssetId:'post-image',revision:1,likeCount:0,commentCount:1,createdAt:'2026-10-08T10:00:00Z'},identity:{authorId:'author-A',nickname:'测试昵称',avatarAssetId:'avatar-image'},isOwn:false,liked:false};
const repository={request:async(action,payload)=>{if(action==='community.list')return {items:[structuredClone(item)],nextCursor:null};if(action==='community.get')return structuredClone(item);if(action==='comments.list')return {items:[{comment:{id:'comment-one',postId:item.post.id,text:'评论头像',createdAt:item.post.createdAt},identity:item.identity,isOwn:false}],nextCursor:null};if(action==='likes.set'){item.liked=payload.liked;item.post.likeCount=payload.liked?1:0;return {postId:item.post.id,liked:payload.liked,likeCount:item.post.likeCount};}throw {code:'INVALID_INPUT'};}};
const loader=createCommunityImageLoader({read:async p=>{window.reads.push(p);if(window.delay)await new Promise(r=>setTimeout(r,window.delay));if(window.failImages)throw {code:'UNAVAILABLE'};return {dataUrl,sha256};}});
window.community=mountCommunity({container:document.querySelector('#fixture'),repository,getSession:()=>({userId:'A',generation:1}),getLocale:()=>window.language,resolveImage:(id,reference)=>loader.load(id,reference)});
window.ready=true;
</script></body></html>'''
(OUT/'fixture.html').write_text(FIXTURE)
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4197/test-results/v101/community-images/fixture.html');args=parser.parse_args()
 failures=[];passed=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='chrome',headless=False)
  page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(args.url);page.wait_for_function('window.ready===true');page.locator('[data-community-post]').wait_for()
  try:page.wait_for_function("[...document.querySelectorAll('[data-community-post] img')].length===2&&[...document.querySelectorAll('[data-community-post] img')].every(i=>!i.hidden&&i.complete&&i.naturalWidth>0)",timeout=2000);passed.append('feed-avatar-and-post-image')
  except PlaywrightTimeout:failures.append('feed-avatar-and-post-image: hidden images never loaded')
  page.locator('[data-community-entry]').first.click();page.locator('[data-community-detail]').wait_for(state='visible')
  try:page.wait_for_function("[...document.querySelectorAll('[data-community-detail] img')].length===3&&[...document.querySelectorAll('[data-community-detail] img')].every(i=>!i.hidden&&i.complete&&i.naturalWidth>0)",timeout=2000);passed.append('detail-avatar-post-comment-images')
  except PlaywrightTimeout:failures.append('detail-avatar-post-comment-images: hidden images never loaded')
  page.evaluate('window.delay=150');page.locator('[data-community-detail]').get_by_role('button',name='点赞 0',exact=True).click()
  try:page.wait_for_function("[...document.querySelectorAll('[data-community-detail] img')].every(i=>!i.hidden&&i.complete&&i.naturalWidth>0)",timeout=2000);passed.append('detail-images-after-like-rerender')
  except PlaywrightTimeout:failures.append('detail-images-after-like-rerender')
  page.evaluate("window.language='en';window.community.refreshLocale()")
  try:page.wait_for_function("[...document.querySelectorAll('[data-community-detail] img')].every(i=>!i.hidden&&i.complete&&i.naturalWidth>0)",timeout=2000);passed.append('detail-images-after-locale-rerender')
  except PlaywrightTimeout:failures.append('detail-images-after-locale-rerender')
  page.get_by_role('button',name='Close details',exact=True).click();page.evaluate('window.failImages=true;window.delay=0;window.community.refresh()');page.wait_for_timeout(500)
  if page.locator('.public-avatar').first.inner_text()=='测':passed.append('failed-avatar-retains-nickname')
  else:failures.append('failed-avatar-retains-nickname: avatar blank')
  page.screenshot(path=str(OUT/'browser.png'),full_page=True)
  report={'synthetic':True,'headfulChromium':True,'passed':passed,'failures':failures,'mediaReadCount':page.evaluate('window.reads.length'),'pageErrors':errors}
  (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
 print(json.dumps(report,ensure_ascii=False));assert not failures and not errors,report
if __name__=='__main__':main()
