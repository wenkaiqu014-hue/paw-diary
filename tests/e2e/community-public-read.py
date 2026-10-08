"""Read-only original public site: never posts, signs in or edits user content."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--label',default='online')
parser.add_argument('--expected-version')
parser.add_argument('--observe-only',action='store_true')
args=parser.parse_args()
OUT=Path(__file__).resolve().parents[2]/'test-results/v101/public'
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=False)
 page=browser.new_page(viewport={'width':1440,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('https://wenkaiqu014-hue.github.io/paw-diary/#community')
 page.wait_for_load_state('networkidle')
 release=page.request.get('https://wenkaiqu014-hue.github.io/paw-diary/release.json').json()
 if args.expected_version:assert release['version']==args.expected_version,release
 page.wait_for_function("document.querySelector('[data-community-status]') && !document.querySelector('[data-community-feed]').getAttribute('aria-busy').includes('true')",timeout=25000)
 for dialog in page.locator('dialog[open]').all():
  close=dialog.locator('[data-whats-new-close], [data-dialog-close]')
  if close.count():close.first.click()
 if page.locator('[data-community-post]').count()==0:
  report={'release':release,'publicRouteLoaded':True,'liveMediaSampleAvailable':False,'pageErrors':errors,'readOnly':True}
  (OUT/(args.label+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));page.screenshot(path=str(OUT/(args.label+'.png')))
  print(json.dumps(report));browser.close();raise SystemExit(0)
 page.wait_for_timeout(1500)
 stats=lambda selector:page.locator(selector).evaluate_all('(images)=>images.map(i=>({loaded:i.complete&&i.naturalWidth>0,visible:!i.hidden&&i.getBoundingClientRect().width>0,width:i.naturalWidth,height:i.naturalHeight}))')
 feed=stats('[data-community-feed] img')
 if not args.observe_only:
  page.wait_for_function("[...document.querySelectorAll('[data-community-feed] img')].length>0 && [...document.querySelectorAll('[data-community-feed] img')].every(i=>i.complete&&i.naturalWidth>0&&!i.hidden)",timeout=20000)
  feed=stats('[data-community-feed] img')
 page.locator('[data-community-post]').first.locator('[data-community-entry]').click()
 page.locator('.community-detail-dialog .post-actions').wait_for(timeout=15000)
 page.wait_for_timeout(1500)
 if not args.observe_only:
  page.wait_for_function("[...document.querySelectorAll('.community-detail-dialog img')].length>0 && [...document.querySelectorAll('.community-detail-dialog img')].every(i=>i.complete&&i.naturalWidth>0&&!i.hidden)",timeout=20000)
 detail=stats('.community-detail-dialog img')
 assert not errors,errors
 report={'release':release,'feedImages':feed,'detailImages':detail,'pageErrors':errors,'readOnly':True,'realPublicMedia':True}
 (OUT/(args.label+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
 page.screenshot(path=str(OUT/(args.label+'.png')))
 print(json.dumps({'release':release,'feedImageCount':len(feed),'feedLoaded':sum(i['loaded'] for i in feed),'detailImageCount':len(detail),'detailLoaded':sum(i['loaded'] for i in detail),'pageErrors':len(errors)}))
 browser.close()
