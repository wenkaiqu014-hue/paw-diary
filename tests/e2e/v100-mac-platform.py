"""Real original-URL Chrome 0.8->1.0 installation baseline; command-file controlled.
Uses genuine headed Chrome/PWA OS install; no release/clock/state mocks.
Only own temporary profile and newly-created launcher may be cleaned up.
"""
import json, os, time, tempfile, plistlib, subprocess, hashlib
from pathlib import Path
from urllib.parse import urljoin
from datetime import datetime
from zoneinfo import ZoneInfo
from io import BytesIO
from PIL import Image
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'test-results/v100/mac';OUT.mkdir(parents=True,exist_ok=True)
BASE='https://wenkaiqu014-hue.github.io/paw-diary/'
REPORT={'base':BASE,'checks':[],'startedAt':datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()}
def record(id,status,evidence):
 REPORT['checks'].append({'id':id,'status':status,'evidence':evidence});(OUT/'report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2));print(json.dumps(REPORT['checks'][-1],ensure_ascii=False),flush=True)
def apps():
 return {str(p) for root in [Path.home()/'Applications',Path('/Applications')] if root.exists() for p in root.rglob('*.app') if any(s in p.name.lower() for s in ['爪爪','paw diary','paw-diary'])}
def intro(page):
 for selector,button in [('#whats-new-dialog[open]','[data-whats-new-confirm]'),('dialog[data-guided-tour][open]','[data-tour-skip]')]:
  if page.locator(selector).count():page.locator(selector).locator(button).click()
def facts(page):
 return page.evaluate("async()=>({url:location.href,standalone:matchMedia('(display-mode: standalone)').matches,scripts:[...document.scripts].map(x=>x.src),workers:(await navigator.serviceWorker.getRegistrations()).length})")
def target(context):
 for _ in range(100):
  for p in context.pages:
   if not p.is_closed() and p.url.startswith(BASE) and p.evaluate("matchMedia('(display-mode: standalone)').matches"):return p
  context.pages[0].wait_for_timeout(100)
 raise RuntimeError('standalone target missing')
before=apps();REPORT['existingApps']=sorted(before)
if before:record('collision','unverified',sorted(before));raise SystemExit(2)
with tempfile.TemporaryDirectory(prefix='paw-v100-upgrade-') as profile:
 with sync_playwright() as runtime:
  ctx=runtime.chromium.launch_persistent_context(profile,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=False,viewport={'width':1200,'height':850},accept_downloads=True,args=['--remote-debugging-port=0'])
  ctx.set_default_timeout(15000);page=ctx.new_page();created=False;session=None
  try:
   page.goto(BASE+'#home',wait_until='networkidle');release=page.request.get(BASE+'release.json').json();assert release['version']=='0.8.0',release
   REPORT['baselineRelease']=release;REPORT['profileName']=Path(profile).name;intro(page)
   session=ctx.new_cdp_session(page);manifest=session.send('Page.getAppManifest')['manifest']['id'];assert manifest==BASE
   try:session.send('PWA.getOsAppState',{'manifestId':manifest})
   except Exception:pass
   else:raise RuntimeError('new profile unexpectedly has app')
   session.send('PWA.install',{'manifestId':manifest});created=True;session.send('PWA.changeAppUserSettings',{'manifestId':manifest,'displayMode':'standalone'});session.send('PWA.launch',{'manifestId':manifest});app=target(ctx);app.wait_for_load_state('networkidle');intro(app)
   REPORT['createdOSApps']=sorted(apps()-before);assert len(REPORT['createdOSApps'])==1
   with open(Path(REPORT['createdOSApps'][0])/'Contents/Info.plist','rb') as f:pl=plistlib.load(f)
   assert Path(pl['CrAppModeUserDataDir']).resolve().is_relative_to(Path(profile).resolve())
   REPORT['osState']=session.send('PWA.getOsAppState',{'manifestId':manifest});record('real08-install','pass',facts(app))
   app.get_by_role('button',name='开始记录我的宠物',exact=True).click();form=app.locator('#pet-form');form.locator('[name=name]').fill('v100升级合成宠物');form.locator('[name=estimatedAgeMonths]').fill('12');form.locator('[type=submit]').click();expect(app.locator('#dialog')).not_to_be_visible()
   page.reload(wait_until='networkidle');intro(page);expect(page.locator('#main')).to_contain_text('v100升级合成宠物');record('08-browser-app-shared-local','pass','UI save in own installed app; independent browser refresh reads synthetic pet')
   for p in [page,app]:
    p.get_by_role('link',name='健康档案',exact=True).click();p.locator('.paw-photo-upload [name=photo-caption]').fill('v100真实升级未保存照片草稿')
   app.screenshot(path=str(OUT/'08-standalone-ready.png'));page.screenshot(path=str(OUT/'08-browser-ready.png'))
   record('baseline-ready','pass',{'page':facts(page),'app':facts(app),'commandFile':str(OUT/'command.json')})
   last=None;hard_stop=datetime(2026,10,8,17,40,50,tzinfo=ZoneInfo('Asia/Shanghai'));deadline=time.monotonic()+max(0,(hard_stop-datetime.now(ZoneInfo('Asia/Shanghai'))).total_seconds())
   while time.monotonic()<deadline:
    page.wait_for_timeout(500)
    command=OUT/'command.json'
    if not command.exists():continue
    cmd=json.loads(command.read_text());key=cmd.get('id')
    if key==last:continue
    last=key
    if cmd['action']=='update':
     remote=page.request.get(BASE+'release.json').json();assert remote['version']=='1.0.0',remote;REPORT['newRelease']=remote
     # Genuine OS focus after five-minute interval; no dispatched synthetic event.
     subprocess.run(['osascript','-e','tell application "Finder" to activate'],check=True);page.wait_for_timeout(300);page.bring_to_front();expect(page.locator('#update-available')).to_be_visible(timeout=20000)
     for p,label in [(page,'browser'),(app,'standalone')]:
      p.bring_to_front();expect(p.locator('#update-available')).to_be_visible(timeout=20000);beforefacts=facts(p);p.locator('#update-available').click();expect(p.locator('#toast')).to_contain_text('请先保存或关闭');expect(p.locator('.paw-photo-upload [name=photo-caption]')).to_have_value('v100真实升级未保存照片草稿');assert facts(p)['scripts']==beforefacts['scripts'];p.screenshot(path=str(OUT/(label+'-draft-blocked.png')));record(label+'-actual-update-draft-block','pass',beforefacts)
      p.locator('.paw-photo-upload [name=photo-caption]').fill('')
      with p.expect_navigation(wait_until='networkidle'):p.locator('#update-available').click()
      assert p.url.endswith('#health');intro(p);expect(p.locator('#main')).to_contain_text('v100升级合成宠物');assert not p.locator('#update-available').is_visible();p.screenshot(path=str(OUT/(label+'-v100-updated.png')));record(label+'-actual-update-clean','pass',facts(p))
     app.close();session.send('PWA.launch',{'manifestId':manifest});app=target(ctx);app.wait_for_load_state('networkidle');intro(app);expect(app.locator('#main')).to_contain_text('v100升级合成宠物');record('v100-standalone-reopen','pass',facts(app))
    elif cmd['action']=='cleanup':break
    elif cmd['action']=='status':record('status','pass',{'page':facts(page),'app':facts(app)})
  except Exception as e:
   record('chrome-flow','fail',str(e))
   try:page.screenshot(path=str(OUT/'chrome-failure.png'))
   except Exception:pass
  finally:
   if created:
    try:session.send('PWA.uninstall',{'manifestId':manifest});record('own-app-uninstall','pass',{'remaining':sorted(apps()-before)})
    except Exception as e:record('own-app-uninstall','unverified',str(e))
   ctx.close();REPORT['finishedAt']=datetime.now(ZoneInfo('Asia/Shanghai')).isoformat();(OUT/'report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
