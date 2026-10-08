"""List refresh must not cancel in-flight detail photos or avatar reads."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4197')
parser.add_argument('--label', default='green')
args = parser.parse_args()
OUT = ROOT / 'test-results/v101/image-race' / args.label
OUT.mkdir(parents=True, exist_ok=True)
FIXTURE = r'''<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><body><main><div id="fixture"></div></main><script type="module">
import {mountCommunity} from '/src/features/community.js';
const dataUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA0kAAAAASUVORK5CYII=';
const item={post:{id:'p',title:'合成并发回归',text:'列表读取不能取消详情图片',topic:'今日萌宠',imageAssetId:'photo',revision:1,likeCount:0,commentCount:1},identity:{authorId:'author-A',nickname:'昵称',avatarAssetId:'avatar'},liked:false};
window.holdList=false;window.holdImages=false;window.imageResolvers=[];window.imageReads=[];
const repository={request:async action=>{if(action==='community.list'){if(window.holdList)await new Promise(r=>window.finishList=r);return{items:[item],nextCursor:null};}if(action==='community.get')return item;if(action==='comments.list')return{items:[{comment:{id:'c',postId:'p',text:'评论'},identity:item.identity,isOwn:false}],nextCursor:null};throw{code:'INVALID_INPUT'};}};
window.community=mountCommunity({container:document.querySelector('#fixture'),repository,getSession:()=>({userId:'A',generation:1}),resolveImage:async(id,reference)=>{window.imageReads.push({id,reference});if(window.holdImages)await new Promise(r=>window.imageResolvers.push(r));return dataUrl;}});
window.ready=true;
</script>'''
(OUT / 'fixture.html').write_text(FIXTURE)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':1440, 'height':1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url + '/test-results/v101/image-race/' + args.label + '/fixture.html')
    page.wait_for_function('window.ready===true')
    page.wait_for_function("[...document.querySelectorAll('[data-community-post] img')].length===2 && [...document.querySelectorAll('[data-community-post] img')].every(i=>!i.hidden&&i.naturalWidth>0)")
    page.evaluate('window.holdImages=true;window.holdList=true;void window.community.refresh()')
    page.wait_for_function("typeof window.finishList==='function'")
    page.locator('[data-community-entry]').first.click()
    page.locator('[name="comment"]').fill('正在写的评论必须保留')
    page.wait_for_function("window.imageReads.some(r=>r.reference.kind==='comment')")
    page.evaluate('window.finishList()')
    page.wait_for_function("window.community.getState().status==='ready'")
    page.wait_for_timeout(80)
    page.evaluate('window.holdImages=false;window.imageResolvers.splice(0).forEach(r=>r())')
    page.wait_for_timeout(250)
    images = page.locator('[data-community-detail] img').evaluate_all('els=>els.map(e=>({hidden:e.hidden,decoded:e.complete&&e.naturalWidth>0}))')
    report = {'synthetic':True, 'detailImages':images, 'commentText':page.locator('[name="comment"]').input_value(), 'pageErrors':errors}
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    assert len(images) == 3 and all(not i['hidden'] and i['decoded'] for i in images), 'List refresh cancelled pending detail images: ' + json.dumps(images)
    assert report['commentText'] == '正在写的评论必须保留'
    assert not errors, errors
    browser.close()
print('PASS: pending detail author/photo/comment images survive list refresh; comment remains intact.')
