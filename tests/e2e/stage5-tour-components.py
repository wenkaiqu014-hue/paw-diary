"""Isolated native-modal tour: real Chrome, no credentials or product data."""
import functools, http.server, json, os, pathlib, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results/stage5/tour-components'
OUT.mkdir(parents=True, exist_ok=True)
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}'
HTML = '''<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/guided-tour.css"><style>body{margin:0;font-family:Arial,sans-serif;background:#f7f7f2;padding:24px}button{padding:12px}section{margin:30px 0;padding:20px;background:white}#spacer{height:550px}nav{position:fixed;bottom:0;background:white;padding:10px;left:0;right:0}</style></head><body><button id="trigger">Guide</button><button data-tour="workspace" onclick="window.businessClicks++">Workspace</button><section data-tour="pets">Pets</section><button data-tour="record">Record</button><section data-tour="reminders">Reminders</section><div id="spacer"></div><section data-tour="recap">Recap</section><nav data-tour="community-nav">Community</nav><script type="module">
import {mountGuidedTour} from '/src/features/guided-tour.js';
window.locale='zh';window.identity='guest';window.blocked=false;window.businessClicks=0;window.statuses=[];window.restores=0;
window.options={document,getLocale:()=>window.locale,getIdentity:()=>window.identity,isBlocked:()=>window.blocked,captureView:()=>({scroll:window.scrollY}),enterHome:async()=>{},restoreView:()=>{window.restores++},onStatus:(status,identity)=>window.statuses.push({status,identity})};
window.mountGuidedTour=mountGuidedTour;window.guide=mountGuidedTour(window.options);window.ready=true;
</script></body></html>'''

def fresh(page):
    page.goto(BASE+'/tour-fixture',wait_until='networkidle')
    page.wait_for_function('window.ready===true',timeout=5000)
    page.locator('#trigger').focus()

def bounds(page):
    box=page.locator('.guided-tour-card').bounding_box()
    view=page.viewport_size
    assert box['x']>=15 and box['y']>=15,box
    assert box['x']+box['width']<=view['width']-15,(box,page.evaluate('({width:innerWidth,vv:visualViewport.width,frame:window.frame,style:document.querySelector(".guided-tour-card").style.cssText})'))
    assert box['y']+box['height']<=view['height']-15,box

try:
  with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=os.environ.get('PAW_HEADFUL')!='1')
    page=browser.new_page(viewport={'width':390,'height':700})
    page.route('**/tour-fixture',lambda route:route.fulfill(content_type='text/html',body=HTML))
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    fresh(page)
    assert page.evaluate('guide.start({source:"manual"})')=='started'
    assert page.locator('dialog.guided-tour[open]').count()==1
    assert page.locator('.guided-tour-spotlight').count()==1
    assert page.locator('.guided-tour-title').evaluate('(el)=>el===document.activeElement')
    assert page.locator('.guided-tour-next').inner_text()=='下一步'
    assert page.locator('.guided-tour-skip').inner_text()=='跳过指引'
    page.keyboard.press('Shift+Tab')
    assert page.locator('.guided-tour-skip').evaluate('(el)=>el===document.activeElement')
    page.keyboard.press('Tab')
    assert page.locator('.guided-tour-next').evaluate('(el)=>el===document.activeElement')
    page.keyboard.press('Tab')
    assert page.locator('.guided-tour-skip').evaluate('(el)=>el===document.activeElement')
    page.mouse.click(5,5)
    target_box=page.locator('[data-tour="workspace"]').bounding_box()
    page.mouse.click(target_box['x']+target_box['width']/2,target_box['y']+target_box['height']/2)
    assert page.evaluate('businessClicks')==0
    assert page.locator('.guided-tour-progress').inner_text()=='1 / 6'
    for width in [360,390,768,1440]:
      page.set_viewport_size({'width':width,'height':700})
      page.evaluate('guide.refresh()');page.wait_for_function('document.querySelector(".guided-tour-card").getBoundingClientRect().right <= innerWidth - 15');bounds(page)
      page.screenshot(path=str(OUT/f'tour-{width}.png'))
    page.evaluate('window.locale="en";guide.refresh()');page.wait_for_timeout(80)
    assert page.locator('.guided-tour-next').inner_text()=='Next'
    assert page.locator('.guided-tour-progress').inner_text()=='1 / 6'
    for i in range(6):
      assert page.locator('.guided-tour-progress').inner_text()==f'{i+1} / 6'
      page.locator('.guided-tour-next').click()
      page.wait_for_timeout(100)
    assert page.evaluate('statuses')==[{'status':'completed','identity':'guest'}]
    assert page.locator('#trigger').evaluate('(el)=>el===document.activeElement')
    # Measure all six steps at every width, including scrolled recap and fixed nav.
    for width in [360,390,768,1440]:
      fresh(page);page.set_viewport_size({'width':width,'height':700})
      page.emulate_media(reduced_motion='reduce')
      page.evaluate('guide.start({source:"manual"})')
      for i in range(6):
        page.wait_for_timeout(70);bounds(page)
        assert page.locator('.guided-tour-progress').inner_text()==f'{i+1} / 6'
        assert page.locator('.guided-tour-title').evaluate('(el)=>el===document.activeElement')
        if i in [2,4] and width in [360,1440]:page.screenshot(path=str(OUT/f'tour-{width}-step-{i+1}.png'))
        page.locator('.guided-tour-next').click()
      assert page.evaluate('statuses')==[{'status':'completed','identity':'guest'}]
    fresh(page);page.evaluate('guide.start({source:"manual"})')
    page.locator('.guided-tour-next').click();page.locator('.guided-tour-next').click()
    page.evaluate('locale="en";guide.refresh()');page.wait_for_timeout(60)
    assert page.locator('.guided-tour-progress').inner_text()=='3 / 6'
    assert page.locator('.guided-tour-title').inner_text()=='Record what happened'
    page.keyboard.press('Escape')
    # Scroll/resize/manual refresh in the same event turn schedule one frame.
    fresh(page);page.evaluate('guide.start({source:"manual"})');page.wait_for_timeout(100)
    page.evaluate('window.originalRAF=requestAnimationFrame;window.rafCalls=0;window.requestAnimationFrame=cb=>{rafCalls++;return originalRAF.call(window,cb)};for(let i=0;i<20;i++)guide.refresh();dispatchEvent(new Event("resize"));dispatchEvent(new Event("scroll"));visualViewport.dispatchEvent(new Event("resize"))')
    page.wait_for_timeout(100)
    assert page.evaluate('rafCalls')==1
    page.evaluate('guide.destroy();rafCalls=0;dispatchEvent(new Event("resize"));dispatchEvent(new Event("scroll"));visualViewport.dispatchEvent(new Event("resize"));guide.refresh()')
    page.wait_for_timeout(100)
    assert page.evaluate('rafCalls')==0
    # Changing a step must cancel an already queued geometry frame before destroy.
    fresh(page);page.evaluate('guide.start({source:"manual"})');page.wait_for_timeout(100)
    page.evaluate('window.queuedFrames=new Map();window.frameId=10000;window.requestAnimationFrame=callback=>{queuedFrames.set(++frameId,callback);return frameId};window.cancelAnimationFrame=id=>queuedFrames.delete(id);guide.refresh();document.querySelector("[data-tour-next]").click();guide.destroy()')
    assert page.evaluate('queuedFrames.size')==0,'No obsolete frame may survive step change and destroy'
    # A short visible area plus very long translated copy scrolls internally.
    fresh(page);page.set_viewport_size({'width':360,'height':280})
    page.evaluate('guide.destroy();options.t=key=>key.endsWith(".body")?"护理安排需要核对确认。".repeat(100):key;guide=mountGuidedTour(options);guide.start({source:"manual"})')
    page.wait_for_timeout(100);bounds(page)
    page.keyboard.press('End');page.keyboard.press('Tab')
    assert page.locator('.guided-tour-next').evaluate('(el)=>el===document.activeElement')
    next_box=page.locator('.guided-tour-next').bounding_box()
    assert next_box['y']>=16 and next_box['y']+next_box['height']<=264,next_box
    assert page.locator('.guided-tour-card').evaluate('(el)=>el.scrollTop>0')
    page.screenshot(path=str(OUT/'short-viewport-long-copy.png'))
    page.keyboard.press('Escape');page.set_viewport_size({'width':390,'height':700})
    # Every step offers skip, including final; Escape shares the skip outcome.
    for step in range(6):
      fresh(page);page.evaluate('guide.start({source:"manual"})')
      for _ in range(step):page.locator('.guided-tour-next').click();page.wait_for_timeout(50)
      if step==5:page.keyboard.press('Escape')
      else:page.locator('.guided-tour-skip').click()
      assert page.evaluate('statuses')==[{'status':'skipped','identity':'guest'}]
    fresh(page);page.evaluate('document.querySelector("[data-tour=workspace]").remove();guide.start({source:"manual"})')
    page.wait_for_timeout(1600);bounds(page)
    assert page.locator('.guided-tour-card').get_attribute('data-placement')=='center'
    page.screenshot(path=str(OUT/'missing-target.png'))
    page.keyboard.press('Escape')
    fresh(page);page.evaluate('window.blocked=true')
    assert page.evaluate('guide.start({source:"manual"})')=='blocked'
    assert page.locator('dialog[open]').count()==0
    # Late enterHome completion must not reopen after stop or identity change.
    fresh(page)
    page.evaluate('guide.destroy();window.options.enterHome=()=>new Promise(resolve=>window.resolveHome=resolve);window.guide=mountGuidedTour(options);window.startPromise=guide.start({source:"manual"});void 0')
    page.wait_for_function('typeof window.resolveHome==="function"');page.evaluate('guide.stop({reason:"route"});window.resolveHome()')
    assert page.evaluate('window.startPromise')=='blocked'
    assert page.locator('dialog[open]').count()==0
    assert page.evaluate('statuses.length')==0
    fresh(page)
    page.evaluate('guide.destroy();window.resolvers=[];options.enterHome=()=>new Promise(resolve=>resolvers.push(resolve));guide=mountGuidedTour(options);window.first=guide.start({source:"manual"});void 0')
    page.wait_for_function('resolvers.length===1')
    page.evaluate('guide.stop({reason:"route"});window.second=guide.start({source:"manual"});void 0')
    page.wait_for_function('resolvers.length===2')
    page.evaluate('resolvers[0]()')
    assert page.evaluate('window.first')=='blocked'
    page.evaluate('window.third=guide.start({source:"manual"});void 0')
    page.wait_for_timeout(100)
    assert page.evaluate('resolvers.length')==2,'A stale start must not clear a newer pending start'
    assert page.evaluate('window.third')=='blocked'
    page.evaluate('resolvers[1]()')
    assert page.evaluate('window.second')=='started'
    page.keyboard.press('Escape')
    fresh(page);page.evaluate('guide.start({source:"manual"})')
    page.evaluate('guide.stop({reason:"route"})')
    page.wait_for_timeout(50)
    assert page.evaluate('restores')==0,'External navigation must not restore the old route'
    assert page.evaluate('statuses.length')==0
    fresh(page);page.evaluate('guide.start({source:"manual"})')
    page.evaluate('guide.destroy();window.dispatchEvent(new Event("resize"));guide.refresh()')
    page.wait_for_timeout(100)
    assert page.locator('dialog.guided-tour').count()==0
    assert page.evaluate('statuses.length')==0
    page.evaluate('window.guide=mountGuidedTour(options)')
    assert page.evaluate('guide.start({source:"manual"})')=='started'
    page.keyboard.press('Escape')
    assert not errors,errors
    print(json.dumps({'result':'pass','widths':[360,390,768,1440],'checks':['native modal','focus title/trap/restore','all six steps at every width','background and spotlight clicks inert','six next','skip each step','escape','language preserves third step','rAF merge','short viewport long copy End/Tab','missing target','blocked','late start cancelled','overlapping pending starts','external route no restore','destroy/remount']},ensure_ascii=False))
    browser.close()
finally:server.shutdown()
