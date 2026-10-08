"""Synthetic public-post details preserve existing actions in responsive media/content columns."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:4197');p.add_argument('--label',default='green');a=p.parse_args();OUT=ROOT/'test-results/v102/detail-layout'/a.label;OUT.mkdir(parents=True,exist_ok=True)
FIXTURE='''<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><main><div id="fixture"></div></main><script type="module">
import {mountCommunity} from '/src/features/community.js';
const canvas=document.createElement('canvas');canvas.width=600;canvas.height=1000;const ctx=canvas.getContext('2d');ctx.fillStyle='#dabb97';ctx.fillRect(0,0,600,1000);ctx.fillStyle='#315945';ctx.fillRect(0,0,600,30);ctx.fillRect(0,970,600,30);const png=canvas.toDataURL();
let withImage=true,likes=0;
const make=id=>({post:{id,title:'Synthetic portrait detail',text:'Full post text',topic:'今日萌宠',imageAssetId:withImage?'photo':null,revision:1,likeCount:likes,commentCount:1},identity:{authorId:'A',nickname:'Synthetic',avatarAssetId:'avatar'},liked:likes>0,isOwn:true});
const comment=text=>({comment:{id:'c',postId:'p',text},identity:{authorId:'A',nickname:'Synthetic'},isOwn:true});
const repository={request:async(action,payload)=>{if(action==='community.list')return {items:[make('p')]};if(action==='community.get')return make(payload.id);if(action==='comments.list')return {items:[comment('Original comment')],nextCursor:null};if(action==='comments.save')return comment(payload.text);if(action==='likes.set'){likes=payload.liked?1:0;return {liked:payload.liked,likeCount:likes};}if(action==='profiles.getOwn')return {nickname:'Synthetic'};throw {code:'INVALID_INPUT'};}};
window.noImage=()=>withImage=false;
window.community=mountCommunity({container:document.querySelector('#fixture'),repository,getSession:()=>({userId:'A',generation:1}),resolveImage:async()=>png});window.ready=true;
</script>'''
(OUT/'fixture.html').write_text(FIXTURE);reports=[]
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=False)
 for width in [1440,390]:
  page=b.new_page(viewport={'width':width,'height':1000});page.set_default_timeout(5000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(a.url+'/test-results/v102/detail-layout/'+a.label+'/fixture.html');page.wait_for_function('window.ready===true');page.get_by_role('button',name='查看详情',exact=True).click();dialog=page.locator('[data-community-detail]');page.wait_for_function("document.querySelector('[data-community-detail] .photo-preview')?.naturalWidth>0")
  media=dialog.locator('.community-detail-media');content=dialog.locator('.community-detail-content');assert media.count()==1 and content.count()==1,'Missing independent image/content columns'
  assert media.locator('img').count()==1 and content.locator(':scope > article .post-user').count()==1
  for name in ['编辑','删除','举报','不想看这篇','删除评论','发表评论']:assert content.get_by_role('button',name=name,exact=True).count()==1,name
  m=media.bounding_box();c=content.bounding_box();assert (m['x']+m['width']<=c['x']+2 and abs(m['y']-c['y'])<2) if width==1440 else m['y']+m['height']<=c['y']+2,'Incorrect responsive column order'
  page.screenshot(path=str(OUT/f'image-{width}.png'))
  ratio=media.locator('img').evaluate('i=>({w:i.width,h:i.height,nw:i.naturalWidth,nh:i.naturalHeight,fit:getComputedStyle(i).objectFit})');assert abs(ratio['w']/ratio['h']-ratio['nw']/ratio['nh'])<0.02 and ratio['fit']=='contain',ratio
  page.locator('[name="comment"]').fill('Synthetic saved comment');content.get_by_role('button',name='发表评论',exact=True).click();page.get_by_text('Synthetic saved comment',exact=True).wait_for();dialog=page.locator('[data-community-detail]');dialog.get_by_role('button',name='举报',exact=True).click();report=page.locator('.community-report-dialog');assert report.is_visible();report.get_by_role('button',name='关闭举报',exact=True).click();dialog.get_by_role('button',name='编辑',exact=True).click();editor=page.locator('.community-editor-dialog');assert editor.is_visible();assert editor.locator('[name="title"]').input_value()=='Synthetic portrait detail';editor.get_by_role('button',name='取消',exact=True).click();assert not editor.is_visible();assert not dialog.is_visible()
  page.evaluate('window.noImage()');page.get_by_role('button',name='查看详情',exact=True).click();dialog=page.locator('[data-community-detail]');assert dialog.locator('.community-detail-media').count()==0;assert 'has-post-image' not in (dialog.get_attribute('class') or '');assert dialog.locator('.community-detail-content').count()==1
  page.locator('[name="comment"]').focus();page.keyboard.press('Tab');assert page.evaluate("document.activeElement.textContent==='发表评论'");page.screenshot(path=str(OUT/f'noimage-{width}.png'));dialog.get_by_role('button',name='关闭详情',exact=True).click();assert not errors
  reports.append({'width':width,'responsiveColumns':True,'fullImageRatio':ratio,'actionsPreserved':True,'commentSaved':True,'reportAndEditOpened':True,'noImageNoEmptyColumn':True,'keyboardSubmit':True,'pageErrors':errors});page.close()
 b.close()
(OUT/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(json.dumps(reports))
