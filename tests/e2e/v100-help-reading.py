"""Help reading entry in Chromium DOM/AX; does not assert real VoiceOver speech."""
import functools,json,os,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results'/'v100'/'help-reading';OUT.mkdir(parents=True,exist_ok=True)
HTML='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><body><main tabindex="-1"><button id="trigger">帮助</button><input id="draft" value="未保存原文"></main><script type="module">
import {mountHelp} from '/src/features/help.js';import zh from '/src/ui/locales/zh-CN.js';import en from '/src/ui/locales/en.js';
let locale='zh-CN';const t=key=>(locale==='en'?en:zh)[key]??key;
window.help=mountHelp({document,t,getLocale:()=>locale,onTour:()=>false});
window.setLocale=value=>{locale=value;help.refreshLocale();};document.querySelector('#trigger').onclick=()=>help.open();window.ready=true;
</script></body></html>'''
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/__fixture__':
   value=HTML.encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(value)
  else:super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='chrome',headless=True)
  page=browser.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}/__fixture__',wait_until='networkidle')
  assert page.evaluate('window.ready===true'),errors
  page.locator('#trigger').click();body=page.locator('#help-content')
  # A keyboard-only visitor must reach the reading entry, not skip it for action buttons.
  visited=[]
  for _ in range(15):
   page.keyboard.press('Tab');visited.append(page.evaluate("document.activeElement.id||document.activeElement.dataset.helpTopic||document.activeElement.dataset.helpAction||document.activeElement.tagName"))
   if visited[-1]=='help-content':break
  if 'help-content' not in visited:
   baseline_ax=page.context.new_cdp_session(page).send('Accessibility.getFullAXTree')['nodes']
   baseline={'visited':visited,'articleNames':[n.get('name',{}).get('value') for n in baseline_ax if n.get('role',{}).get('value')=='article'],'visibleStaticTextNodes':sum(n.get('role',{}).get('value')=='StaticText' and not n.get('ignored') for n in baseline_ax)}
   (OUT/'red.json').write_text(json.dumps(baseline,ensure_ascii=False,indent=2))
  assert 'help-content' in visited, f'Help body is absent from keyboard focus path: {visited}'
  expect(body).to_be_focused();expect(body).to_have_attribute('role','region')
  title_id=body.get_attribute('aria-labelledby');assert title_id
  expect(page.locator('#'+title_id)).to_be_visible()
  assert body.locator('li').count()>0
  assert page.evaluate("!document.querySelector('#help-content').closest('[aria-hidden=true],[inert]')")
  session=page.context.new_cdp_session(page)
  ax=session.send('Accessibility.getFullAXTree')['nodes']
  named_regions=[n for n in ax if n.get('role',{}).get('value')=='region' and n.get('name',{}).get('value')==page.locator('#'+title_id).inner_text() and not n.get('ignored')]
  assert named_regions,'No named help body in Chromium accessibility tree'
  paragraph=body.locator('li').first.inner_text()
  assert any(n.get('role',{}).get('value')=='StaticText' and n.get('name',{}).get('value')==paragraph and not n.get('ignored') for n in ax),'Help paragraph absent from AX tree'
  page.locator('[data-help-topic=calendar]').focus();page.keyboard.press('Enter')
  expect(body).to_be_focused();expect(body).to_contain_text('快照')
  expect(page.locator('[data-help-topic=calendar]')).to_have_attribute('aria-current','page')
  page.evaluate("setLocale('en')");expect(body).to_be_focused();expect(body).to_contain_text('snapshot')
  expect(page.locator('#help-dialog')).to_have_attribute('lang','en')
  expect(body).to_have_accessible_name(page.locator('#'+title_id).inner_text())
  page.locator('[data-help-topic=calendar]').focus();page.evaluate("setLocale('zh-CN')")
  expect(page.locator('[data-help-topic=calendar]')).to_be_focused()
  expect(body).to_contain_text('快照');page.evaluate("setLocale('en')")
  # Invalid/outside topic-shaped controls cannot change the selected reading topic.
  page.evaluate("const b=document.createElement('button');b.dataset.helpTopic='records';b.textContent='test';document.querySelector('.help-actions').append(b);b.click();b.remove()")
  expect(page.locator('[data-help-topic=calendar]')).to_have_attribute('aria-current','page')
  # Shift+Tab returns to the TOC; action buttons still wrap inside the modal.
  body.focus()
  page.keyboard.press('Shift+Tab');expect(page.locator('[data-help-topic=install]')).to_be_focused()
  page.locator('[data-help-action=install]').focus();page.keyboard.press('Tab');expect(page.locator('[data-help-close]')).to_be_focused()
  page.locator('[data-help-close]').focus();page.keyboard.press('Shift+Tab');expect(page.locator('[data-help-action=install]')).to_be_focused()
  page.locator('[data-help-action=tour]').click();expect(page.locator('.help-status')).to_contain_text('Save')
  page.keyboard.press('Escape');expect(page.locator('#trigger')).to_be_focused();expect(page.locator('#draft')).to_have_value('未保存原文')
  # At a small viewport, activating a topic scrolls its reading heading into view.
  page.set_viewport_size({'width':390,'height':400});page.locator('#trigger').click()
  page.locator('[data-help-topic=files]').click();expect(body).to_be_focused()
  assert page.evaluate("(()=>{const d=document.querySelector('#help-dialog').getBoundingClientRect(),h=document.querySelector('#help-topic-title').getBoundingClientRect();return h.top>=d.top&&h.bottom<=d.bottom})()"),'Reading heading is outside scroll viewport'
  scroll_before=page.locator('#help-dialog').evaluate('(node)=>node.scrollTop')
  page.keyboard.press('ArrowDown')
  page.wait_for_function("document.querySelector('#help-dialog').scrollTop>"+str(scroll_before))
  page.keyboard.press('Escape');expect(page.locator('#draft')).to_have_value('未保存原文')
  assert not errors,errors
  report={'engine':'Chromium','actualVoiceOver':False,'bodyInTabPath':True,'namedRegionAndParagraphInAX':True,'topicActivationFocus':True,'localeAndDraftPreserved':True,'topicChangeGuard':True,'modalTrapAndEscapePreserved':True,'mobileReadingHeadingVisible':True,'keyboardScrollsReadingBody':True,'pageErrors':errors}
  (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report));browser.close()
finally:server.shutdown();server.server_close()
