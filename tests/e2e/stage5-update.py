"""Stable candidate update UI with explicitly simulated future release metadata.

The running application remains 0.8.0. Only same-origin release.json is mocked;
all nonlocal HTTP requests are aborted. Focus events and five-minute clock jumps
are simulation, while clicks, drafts, blocking, reload and DOM are real Chrome UI.
"""
import json,os
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse,urljoin
from PIL import Image
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4241/paw-diary/')
RELEASE=urljoin(BASE,'release.json');OUT=ROOT/'test-results/stage5/update-ui';OUT.mkdir(parents=True,exist_ok=True)
CHECKS=[];ERRORS=[];NATIVE=[];NAV=[];REQUESTS=[];EXTERNAL=[]
def record(id,status='pass',evidence=None,reason=None):
 check={'id':id,'status':status}
 if evidence:check['evidence']=evidence
 if reason:check['reason']=reason
 CHECKS.append(check);print(json.dumps(check,ensure_ascii=False),flush=True)
def image_payload():
 out=BytesIO();Image.new('RGB',(64,64),(90,140,115)).save(out,format='PNG');return {'name':'synthetic-update-photo.png','mimeType':'image/png','buffer':out.getvalue()}
with sync_playwright() as runtime:
 browser=runtime.chromium.launch(channel='chrome',headless=False)
 context=browser.new_context(viewport={'width':390,'height':900},reduced_motion='reduce')
 page=context.new_page();page.set_default_timeout(6000);page.clock.install()
 actual=page.request.get(RELEASE).json();assert actual['channel']=='stable' and actual['version']=='0.8.0',actual
 remote={'mode':'same'}
 def route_all(route):
  url=urlparse(route.request.url)
  if url.hostname not in ['127.0.0.1','localhost']:
   EXTERNAL.append(route.request.resource_type);route.abort('failed');return
  if route.request.url.split('#')[0]==RELEASE:
   mode=remote['mode'];REQUESTS.append(mode)
   if mode=='network':route.abort('failed');return
   if mode=='json':route.fulfill(status=200,content_type='application/json',body='{synthetic-bad-json');return
   value={**actual,'version':'0.9.0','buildId':'SIMULATED_FUTURE_METADATA'} if mode=='future' else actual
   route.fulfill(status=200,content_type='application/json',body=json.dumps(value));return
  route.continue_()
 context.route('**/*',route_all)
 page.on('pageerror',lambda error:ERRORS.append(str(error)))
 page.on('dialog',lambda dialog:(NATIVE.append(dialog.type),dialog.dismiss()))
 page.on('framenavigated',lambda frame:NAV.append(frame.url) if frame==page.main_frame else None)
 def focus_check(mode):
  remote['mode']=mode;before=len(REQUESTS)
  page.clock.fast_forward(300001)
  with page.expect_response(lambda response:response.url==RELEASE) if mode not in ['network'] else page.expect_request(lambda request:request.url==RELEASE):
   page.evaluate("window.dispatchEvent(new Event('focus'))")
  page.wait_for_function('document.readyState===\"complete\"')
  assert len(REQUESTS)==before+1,(before,REQUESTS)
 def input_stays(caption,file,text,nav_count):
  expect(caption).to_have_value(text);assert file.evaluate('(input)=>input.files.length')==1
  assert file.evaluate('(input)=>input.files[0].name')=='synthetic-update-photo.png'
  assert len(NAV)==nav_count,(nav_count,NAV)
 try:
  page.goto(BASE+'#home',wait_until='networkidle');notice=page.locator('#whats-new-dialog');expect(notice).to_be_visible();notice.locator('[data-whats-new-confirm]').click()
  tour=page.locator('dialog[data-guided-tour]');expect(tour).to_be_visible();tour.locator('[data-tour-skip]').click()
  expect(page.locator('#update-available')).not_to_be_visible();assert REQUESTS==['same'],REQUESTS
  record('same_stable_boot_no_banner',evidence='Actual local stable0.8.0; boot mock returns same metadata; genuine notice confirm and first-tour skip')
  page.get_by_role('button',name='开始记录我的宠物',exact=True).click();pet=page.locator('#pet-form');pet.locator('[name=name]').fill('更新保护合成测试宠物');pet.locator('[name=estimatedAgeMonths]').fill('12');pet.locator('[type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible()
  page.get_by_role('link',name='健康档案',exact=True).click();photo=page.locator('.paw-photo-upload');expect(photo).to_be_visible()
  caption=photo.locator('[name=photo-caption]');file=photo.locator('[name=photos]');text='仅用于更新草稿保护验收的照片说明'
  file.set_input_files(image_payload());caption.fill(text)
  initial=len(REQUESTS);page.evaluate("window.dispatchEvent(new Event('focus'))");page.wait_for_timeout(100);assert len(REQUESTS)==initial
  record('focus_within_interval_no_check',evidence='Synthetic focus before five-minute interval adds no metadata request')
  focus_check('future');banner=page.locator('#update-available');expect(banner).to_be_visible();nav_count=len(NAV)
  banner.click();expect(page.locator('#toast')).to_contain_text('请先保存或关闭');input_stays(caption,file,text,nav_count)
  record('photo_dirty_update_click_blocked',evidence='Synthetic future0.9.0 causes real visible banner; normal click emits save/close toast, no reload, selected file and caption preserved')
  page.screenshot(path=str(OUT/'photo-dirty-blocked-390.png'))
  focus_check('same');expect(banner).not_to_be_visible();input_stays(caption,file,text,nav_count)
  record('valid_stable_rollback_withdraws_banner',evidence='Successful same0.8.0 metadata withdraws synthetic0.9.0 banner while preserving current photo draft and route')
  focus_check('future');expect(banner).to_be_visible()
  focus_check('network');page.wait_for_timeout(200);expect(banner).to_be_visible();input_stays(caption,file,text,nav_count)
  banner.click();expect(page.locator('#toast')).to_contain_text('请先保存或关闭');input_stays(caption,file,text,nav_count)
  record('network_failure_keeps_pending_app_draft',evidence='release.json abort mock does not withdraw pending update or reload; real button remains blocked on same photo draft')
  focus_check('json');page.wait_for_timeout(200);expect(banner).to_be_visible();input_stays(caption,file,text,nav_count)
  record('malformed_json_keeps_pending_app_draft',evidence='release.json invalid JSON mock preserves current app, pending banner, caption and file')
  # A business modal makes the background banner genuinely inert; never force-click it.
  file.set_input_files([]);caption.fill('');page.locator('#main [data-action=record]').first.click();form=page.locator('#record-form');expect(form).to_be_visible();form.locator('[name=title]').fill('主弹窗未保存输入')
  assert page.evaluate("document.querySelector('#update-available').closest('dialog')===null")
  # Native modal focus must remain in its modal after ordinary Tab navigation.
  page.keyboard.press('Tab');assert page.evaluate("document.activeElement.closest('#dialog')!==null")
  record('main_modal_background_update_not_forced',evidence='Main business modal open: Tab stays in native modal and background update button is outside; no forced background click')
  page.locator('#close-dialog').click();page.locator('[data-discard-confirm]').click();expect(page.locator('#dialog')).not_to_be_visible()
  assert file.evaluate('(input)=>input.files.length')==0;expect(caption).to_have_value('')
  remote['mode']='same';before_reload=len(NAV)
  with page.expect_navigation(wait_until='networkidle'):banner.click()
  assert len(NAV)==before_reload+1,(before_reload,NAV)
  assert page.url.endswith('#health'),page.url;expect(page.locator('.pet-entry')).to_contain_text('更新保护合成测试宠物')
  expect(page.locator('#update-available')).not_to_be_visible();expect(page.locator('#whats-new-dialog')).not_to_be_visible()
  record('clean_update_reload_preserves_hash_saved_pet',evidence='After explicitly clearing file/caption and explicitly discarding separate synthetic record draft, real banner click reloads once at #health; local saved pet and 0.8.0 acknowledgement remain')
  assert not ERRORS,ERRORS;assert not NATIVE,NATIVE
 except Exception as error:
  record('update_ui_flow','fail',reason=str(error))
  try:page.screenshot(path=str(OUT/'failure.png'))
  except Exception:pass
 finally:
  report={'schemaVersion':1,'base':BASE,'actualRunningRelease':actual,'simulation':'Future0.9.0 metadata only; Playwright five-minute clock jumps and window focus events; no future app published','checks':CHECKS,'metadataRequestModes':REQUESTS,'externalRequestsBlocked':len(EXTERNAL),'pageErrors':ERRORS,'nativeDialogs':NATIVE,'navigationCount':len(NAV)}
  (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));context.close();browser.close()
print(json.dumps({'pass':sum(check['status']=='pass' for check in CHECKS),'fail':sum(check['status']=='fail' for check in CHECKS),'pageErrors':ERRORS,'nativeDialogs':NATIVE},ensure_ascii=False))
if any(check['status']=='fail' for check in CHECKS) or ERRORS or NATIVE:raise SystemExit(1)
