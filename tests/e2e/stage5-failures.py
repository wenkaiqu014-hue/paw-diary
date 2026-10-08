"""Stage5 failure/input protection, real local UI in isolated headful Chrome.

External HTTP requests are aborted to prevent any real AI/cloud invocation.
Storage corruption, invalid PNG and network denial are explicitly synthetic.
No production hooks, forced clicks, account impersonation or app imports.
"""
import json,os,time,traceback
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4240/paw-diary/')
OUT=ROOT/'test-results/stage5/failures';OUT.mkdir(parents=True,exist_ok=True)
CHECKS=[];BLOCKED=[];PAGE_ERRORS=[]
def record(id,status,evidence=None,reason=None):
 item={'id':id,'status':status}
 if evidence:item['evidence']=evidence
 if reason:item['reason']=reason
 CHECKS.append(item);print(json.dumps(item,ensure_ascii=False),flush=True)
def fresh(browser,init=None,width=390,slow=False,release_deny=False):
 context=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce',accept_downloads=True)
 def external(route):
  host=urlparse(route.request.url).hostname
  if host not in ['127.0.0.1','localhost']:
   BLOCKED.append({'resourceType':route.request.resource_type,'origin':urlparse(route.request.url).netloc});route.abort('failed')
  else:route.continue_()
 context.route('**/*',external)
 if release_deny:context.route('**/release.json',lambda route:route.abort('failed'))
 if init:context.add_init_script(init)
 page=context.new_page();page.set_default_timeout(6000);page.on('pageerror',lambda error:PAGE_ERRORS.append(str(error)))
 if slow:
  cdp=context.new_cdp_session(page);cdp.send('Network.enable');cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':250,'downloadThroughput':200000,'uploadThroughput':100000})
 page.goto(BASE+'#home',wait_until='networkidle',timeout=30000)
 notice=page.locator('#whats-new-dialog');expect(notice).to_be_visible();notice.locator('[data-whats-new-confirm]').click()
 tour=page.locator('dialog[data-guided-tour]');expect(tour).to_be_visible();tour.locator('[data-tour-skip]').click();expect(tour).not_to_be_visible()
 return context,page
def open_help(page):
 business=page.locator('#dialog[open]')
 if business.count():
  trigger=business.locator('[data-dialog-help]')
  if not trigger.count():raise AssertionError('Main business dialog has no reachable help button; background avatar is inert')
  trigger.click()
 else:
  page.locator('#owner-profile-button').click();page.get_by_role('menuitem',name='使用帮助',exact=True).click()
 expect(page.locator('#help-dialog')).to_be_visible()
def no_tour(page):expect(page.locator('dialog[data-guided-tour]')).not_to_be_visible()
def expect_blocked_replay(page):
 page.locator('[data-help-action=tour]').click();no_tour(page);expect(page.locator('.help-status')).to_contain_text('先保存或关闭')
def create_pet(page):
 page.get_by_role('button',name='开始记录我的宠物',exact=True).click()
 form=page.locator('#pet-form');expect(form).to_be_visible();form.locator('[name=name]').fill('阶段五合成测试宠物')
 form.locator('[name=estimatedAgeMonths]').fill('12');form.locator('[type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible()
 page.get_by_role('link',name='健康档案',exact=True).click();expect(page.locator('.paw-photo-upload')).to_be_visible()
def payload(valid=True):
 if not valid:return {'name':'synthetic-invalid.png','mimeType':'image/png','buffer':b'not a real PNG'}
 buf=BytesIO();Image.new('RGB',(64,64),(80,130,100)).save(buf,format='PNG');return {'name':'synthetic-photo.png','mimeType':'image/png','buffer':buf.getvalue()}
def manual_ai(page):
 page.locator('#main [data-action=record]').first.click();form=page.locator('#record-form');expect(form).to_be_visible()
 title='没有空格的中文草稿名称'*4;note='草稿只在本次浏览器测试使用。'*12
 form.locator('[name=title]').fill(title);form.locator('[name=note]').fill(note)
 open_help(page);expect_blocked_replay(page)
 page.keyboard.press('Escape');expect(page.locator('#help-dialog')).not_to_be_visible();expect(form).to_be_visible()
 expect(form.locator('[name=title]')).to_have_value(title);expect(form.locator('[name=note]')).to_have_value(note)
 expect(page.locator('[data-dialog-help]')).to_be_focused();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/'long-record-draft-390.png'));record('manual_draft_readonly_help_replay_guard','pass','Real help overlays main modal; Esc returns to same visible draft and trigger focus')
 page.locator('[data-action=record-mode][data-value=ai]').click();ai=page.locator('#ai-text');expect(ai).to_be_visible()
 ai_text='今天测试宠物散步十分钟，请保留这段未确认原文。';ai.fill(ai_text)
 open_help(page);expect_blocked_replay(page);page.keyboard.press('Escape');expect(ai).to_have_value(ai_text)
 page.locator('#ai-parse').click();expect(page.locator('#ai-entry-form .form-error')).to_be_visible(timeout=15000);expect(ai).to_have_value(ai_text)
 expect(page.locator('#ai-confirm')).not_to_be_visible();record('ai_network_denial_keeps_input','pass','All external requests aborted; parse shows failure; no model call and no confirmable generated drafts')
 page.locator('[data-action=record-mode][data-value=manual]').click();expect(form.locator('[name=title]')).to_have_value(title);expect(form.locator('[name=note]')).to_have_value(note)
 page.locator('[data-action=record-mode][data-value=ai]').click();expect(ai).to_have_value(ai_text)
 page.locator('#close-dialog').click();expect(page.locator('#discard-dialog')).to_be_visible();page.keyboard.press('Escape');expect(ai).to_have_value(ai_text)
 page.locator('#close-dialog').click();page.locator('[data-discard-confirm]').click();expect(page.locator('#dialog')).not_to_be_visible()
 record('manual_ai_modes_and_discard_keep_drafts','pass','Manual values and AI text stay across mode switches; custom discard Esc keeps input')
def photo(page,context):
 form=page.locator('.paw-photo-upload');file=form.locator('[name=photos]');caption=form.locator('[name=photo-caption]');text='长中文照片说明保留原文'*15
 file.set_input_files(payload());caption.fill(text)
 open_help(page);expect_blocked_replay(page);page.keyboard.press('Escape');expect(caption).to_have_value(text)
 assert file.evaluate('(input)=>input.files.length')==1
 open_help(page);page.locator('[data-help-action=install]').click();expect(page.locator('#install-help-dialog')).to_be_visible();page.keyboard.press('Escape')
 expect(caption).to_have_value(text);assert file.evaluate('(input)=>input.files[0].name')=='synthetic-photo.png'
 record('photo_caption_file_help_replay_install_keep','pass','Real selected PNG and caption retained across help, blocked replay and install guide')
 context.set_offline(True);open_help(page);page.locator('[data-help-topic=files]').click();expect(page.locator('.help-content')).to_contain_text('备份');page.keyboard.press('Escape')
 expect(caption).to_have_value(text);assert file.evaluate('(input)=>input.files.length')==1;context.set_offline(False)
 record('loaded_help_offline_preserves_photo_draft','pass','Network offline simulated after load; help readable and selected file/caption retained; no offline sync claim')
 file.set_input_files(payload(False));caption.fill('合成坏PNG上传失败后保留')
 form.locator('[type=submit]').click();expect(page.locator('.paw-photo-wall [role=alert]')).to_be_visible();expect(caption).to_have_value('合成坏PNG上传失败后保留');assert file.evaluate('(input)=>input.files.length')==1
 open_help(page);expect_blocked_replay(page);page.keyboard.press('Escape');expect(caption).to_have_value('合成坏PNG上传失败后保留')
 record('invalid_local_upload_keeps_caption_file','pass','Synthetic malformed PNG fails local preparation; retry input survives help; this is not cloud-upload network proof')
 page.screenshot(path=str(OUT/'photo-failure-390.png'))
def empty(page):
 page.get_by_role('button',name='开始记录我的宠物',exact=True).click();expect(page.locator('#pet-form')).to_be_visible();page.locator('#close-dialog').click();expect(page.locator('#dialog')).not_to_be_visible()
 open_help(page);page.locator('[data-help-action=tour]').click();tour=page.locator('dialog[data-guided-tour]');expect(tour).to_be_visible()
 for step in range(6):
  expect(tour.locator('[data-tour-progress]')).to_contain_text(str(step+1));expect(tour.locator('[data-tour-next]')).to_be_visible();expect(tour.locator('[data-tour-skip]')).to_be_visible()
  if step==2:
   page.screenshot(path=str(OUT/'empty-record-step-390.png'));expect(page.locator('#main [data-tour=record]')).to_have_count(0);expect(tour.locator('.guided-tour-card')).to_have_attribute('data-placement','center')
  tour.locator('[data-tour-next]').click()
 expect(tour).not_to_be_visible();assert page.locator('.pet-entry').count()==0
 record('empty_local_six_step_fallback_completes','pass','No synthetic pet created by guide; every step remains readable/next/skip reachable, including absent record target')
 open_help(page);page.locator('[data-help-action=tour]').click();expect(tour).to_be_visible();page.keyboard.press('Escape');expect(tour).not_to_be_visible()
 record('empty_local_guide_escape','pass','Guide escapes with no pet and returns to home')
def corrupted(page):
 expect(page.locator('#main')).to_contain_text('暂时无法读取档案');assert page.evaluate("localStorage.getItem('paw-diary:v3:demo')")=='{synthetic-bad-json'
 open_help(page);page.locator('[data-help-action=tour]').click();tour=page.locator('dialog[data-guided-tour]');expect(tour).to_be_visible()
 tour.locator('[data-tour-next]').click();tour.locator('[data-tour-next]').click();expect(tour.locator('.guided-tour-card')).to_have_attribute('data-placement','center')
 page.keyboard.press('Shift+Tab');expect(tour.locator('[data-tour-skip]')).to_be_focused();page.keyboard.press('Tab');expect(tour.locator('[data-tour-next]')).to_be_focused()
 page.keyboard.press('Escape');expect(tour).not_to_be_visible();expect(page.locator('#main')).to_contain_text('暂时无法读取档案')
 assert page.evaluate("localStorage.getItem('paw-diary:v3:demo')")=='{synthetic-bad-json'
 page.screenshot(path=str(OUT/'load-error-390.png'));record('load_error_guide_fallback_escape_preserves_raw','pass','Synthetic corrupt raw stays exact; fallback guide keyboard/Esc exits to recovery without replacing data')
def slow_metadata(page,context):
 expect(page.locator('#update-available')).not_to_be_visible();open_help(page);page.locator('[data-help-topic=install]').click();expect(page.locator('.help-content')).to_contain_text('安装');page.keyboard.press('Escape');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');record('slow_boot_release_failure_help_usable','pass','CDP 250ms / 200KBps network simulation at 360px; release.json abort mock is silent, real startup notice/skip and help remain usable')
def run_case(id,browser,fn,init=None,slow=False,release_deny=False,width=390):
 context=None
 try:
  context,page=fresh(browser,init=init,slow=slow,release_deny=release_deny,width=width);fn(page,context)
 except Exception as error:
  record(id,'fail',reason=str(error));
  if context:
   try:page.screenshot(path=str(OUT/f'{id}-failure.png'))
   except Exception:pass
 finally:
  if context:context.close()
with sync_playwright() as runtime:
 browser=runtime.chromium.launch(channel='chrome',headless=False)
 run_case('manual_ai_draft_flow',browser,lambda page,context:manual_ai(page))
 run_case('photo_flow',browser,lambda page,context:(create_pet(page),photo(page,context)))
 run_case('empty_flow',browser,lambda page,context:empty(page))
 run_case('load_error_flow',browser,lambda page,context:corrupted(page),"localStorage.setItem('paw-diary:v3:demo','{synthetic-bad-json');")
 run_case('slow_metadata_flow',browser,slow_metadata,slow=True,release_deny=True,width=360)
 browser.close()
record('trusted_profile_community_drafts','unverified',reason='Needs real recovered identity; delegated to Root, no credential or impersonation allowed in this block')
record('stable_update_button_draft_guard','unverified',reason='Current candidate channel preview; only stable-to-newer-stable can show actual update banner. Root stable build or update unit coverage needed')
record('cloud_upload_network_failure','unverified',reason='Local photo invalid-file path covered; actual private cloud upload requires real identity and Root')
report={'schemaVersion':1,'base':BASE,'browser':'isolated headful Chrome','networkMock':'all non-local HTTP requests aborted; no model/cloud invocation','checks':CHECKS,'blockedExternalRequestCount':len(BLOCKED),'pageErrors':PAGE_ERRORS}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'pass':sum(c['status']=='pass' for c in CHECKS),'fail':sum(c['status']=='fail' for c in CHECKS),'unverified':sum(c['status']=='unverified' for c in CHECKS),'pageErrors':PAGE_ERRORS},ensure_ascii=False))
if any(check['status']=='fail' for check in CHECKS) or PAGE_ERRORS:raise SystemExit(1)
