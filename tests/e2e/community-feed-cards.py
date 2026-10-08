"""Synthetic DOM verification for compact feed navigation; no cloud writes."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:4201');p.add_argument('--label',default='green');a=p.parse_args()
OUT=ROOT/'test-results/v103/cards'/a.label;OUT.mkdir(parents=True,exist_ok=True)
FIXTURE='''<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><main><div id="fixture"></div></main><script type="module">
import {mountCommunity} from '/src/features/community.js';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA0kAAAAASUVORK5CYII=';
const make=(id,image)=>({post:{id,title:'完整标题 '+id,text:'原文第一段\\n原文第二段 <script> literal',topic:'今日萌宠',cityName:'合成城市',createdAt:'2026-10-08T00:00:00Z',imageAssetId:image,revision:1,likeCount:0,commentCount:0},identity:{authorId:'author-'+id,nickname:'合成昵称 '+id,avatarAssetId:'avatar'},isOwn:true,liked:false});
const items=[make('one','photo'),make('two',null)];window.calls=[];window.authors=[];window.imageReads=0;
const repository={request:async(action,payload)=>{window.calls.push({action,payload});if(action==='community.list')return {items:structuredClone(items)};if(action==='community.get')return structuredClone(items.find(i=>i.post.id===payload.id));if(action==='comments.list')return {items:[]};if(action==='likes.set')return await new Promise(r=>window.likeReply=()=>r({liked:payload.liked,likeCount:1}));throw {code:'INVALID_INPUT'};}};
window.community=mountCommunity({container:document.querySelector('#fixture'),repository,getSession:()=>({userId:'A',generation:1}),onViewAuthorPosts:id=>window.authors.push(id),resolveImage:async()=>{window.imageReads++;return png;}});window.ready=true;
</script>'''
(OUT/'fixture.html').write_text(FIXTURE);reports=[]
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=False)
 for width in [1440,390]:
  page=b.new_page(viewport={'width':width,'height':1000});page.set_default_timeout(5000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(a.url+'/test-results/v103/cards/'+a.label+'/fixture.html');page.wait_for_function('window.ready && document.querySelectorAll("[data-community-post]").length===2')
  feed=page.locator('[data-community-feed]');assert feed.locator('.post-actions,.post-topic,.post-text').count()==0,'Feed still exposes actions, metadata or body'
  assert feed.locator('[data-community-entry]').count()==2,'Every card needs one native detail keyboard entry'
  assert feed.locator('[role="button"]').count()==0,'Do not nest author buttons in button-role cards'
  assert feed.locator('[data-community-post="two"] .post-image').count()==0
  first=feed.locator('[data-community-post="one"]');first.locator('.public-avatar').click();assert page.evaluate('window.authors')==['author-one'];assert page.locator('[data-community-detail]').count()==0
  first.locator('.community-author').filter(has_text='合成昵称').click();assert page.evaluate('window.authors')==['author-one','author-one'];assert page.locator('[data-community-detail]').count()==0
  page.evaluate("const r=document.createRange();r.selectNodeContents(document.querySelector('[data-community-entry]'));getSelection().removeAllRanges();getSelection().addRange(r);document.querySelector('[data-community-post]').dispatchEvent(new MouseEvent('click',{bubbles:true}))")
  assert page.locator('[data-community-detail]').count()==0,'Text selection must not open a post';page.evaluate('getSelection().removeAllRanges()')
  first.locator('.post-image').click();dialog=page.locator('[data-community-detail]');dialog.locator('.post-actions').wait_for();assert dialog.locator('.post-text').inner_text()=='原文第一段\n原文第二段 <script> literal'
  assert '今日萌宠' in dialog.locator('.post-topic').inner_text() and '合成城市' in dialog.locator('.post-topic').inner_text() and '2026/10/8' in dialog.locator('.post-topic').inner_text()
  for label in ['编辑','删除','举报','不想看这篇']:assert dialog.get_by_role('button',name=label,exact=True).count()==1
  page.wait_for_function("[...document.querySelectorAll('[data-community-detail] img')].every(i=>i.naturalWidth>0)");page.locator('[name="comment"]').fill('未发送评论')
  page.evaluate("window.nodes=[...document.querySelectorAll('img')];window.reads=window.imageReads;window.comment=document.querySelector('[name=comment]')")
  like=dialog.locator('[data-like-post]');like.click();page.wait_for_function("document.querySelector('[data-like-post]').getAttribute('aria-busy')==='true'")
  assert page.evaluate("window.nodes.every(i=>i.isConnected) && window.reads===window.imageReads && window.comment===document.querySelector('[name=comment]') && window.comment.value==='未发送评论'")
  page.evaluate('window.likeReply()');page.wait_for_function("document.querySelector('[data-like-post]').getAttribute('aria-busy')==='false'");page.locator('[name="comment"]').fill('')
  dialog.get_by_role('button',name='关闭详情',exact=True).click();assert page.evaluate("document.activeElement.dataset.communityEntry==='one'")
  second=feed.locator('[data-community-entry="two"]');second.focus();page.keyboard.press('Enter');dialog.locator('.post-actions').wait_for();assert dialog.locator('.community-detail-media').count()==0;dialog.get_by_role('button',name='关闭详情',exact=True).click();assert page.evaluate("document.activeElement.dataset.communityEntry==='two'")
  second.focus();page.keyboard.press('Space');dialog.locator('.post-actions').wait_for();page.evaluate('window.community.refreshLocale()');dialog.get_by_role('button',name='关闭详情',exact=True).click();assert page.evaluate("document.activeElement.dataset.communityEntry==='two'")
  page.evaluate("const p=document.createElement('p');p.textContent='页面其他位置的选区';document.body.append(p);const r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r)")
  second.focus();page.keyboard.press('Enter');dialog.locator('.post-actions').wait_for();dialog.get_by_role('button',name='关闭详情',exact=True).click();page.evaluate('getSelection().removeAllRanges()')
  assert not errors,errors;page.screenshot(path=str(OUT/f'cards-{width}.png'));reports.append({'width':width,'compactFeed':True,'avatarAndNicknameAuthorOnly':True,'cardToDetail':True,'selectionGuard':True,'keyboardEntryAndReturnFocus':True,'detailMetadataAndLiteralSource':True,'likePreservesImagesAndDraft':True,'errors':errors});page.close()
 b.close()
(OUT/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(json.dumps(reports))
