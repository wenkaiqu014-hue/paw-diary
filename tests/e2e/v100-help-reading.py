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
  page.locator('[data-help-topic=start]').click()
  page.keyboard.press('Tab')
  first_step=body.locator('li').first
  expect(first_step).to_be_focused()
  expect(first_step).to_have_accessible_name(first_step.inner_text())
  # A keyboard-only visitor must reach the actual title and every body step.
  page.locator('#help-topic-title').focus()
  for step in body.locator('li').all():
   page.keyboard.press('Tab');expect(step).to_be_focused();expect(step).to_have_accessible_name(step.inner_text())
  page.keyboard.press('Tab');expect(page.locator('[data-help-action=tour]')).to_be_focused()
  page.locator('[data-help-close]').focus()
  visited=[]
  for _ in range(15):
   page.keyboard.press('Tab');visited.append(page.evaluate("document.activeElement.id||document.activeElement.dataset.helpTopic||document.activeElement.dataset.helpAction||document.activeElement.tagName"))
   if visited[-1]=='help-topic-title':break
  assert 'help-topic-title' in visited, f'Help title is absent from keyboard focus path: {visited}'
  title_id='help-topic-title';heading=page.locator('#'+title_id);expect(heading).to_be_focused()
  assert body.get_attribute('role') is None and body.get_attribute('tabindex') is None
  expect(page.locator('#'+title_id)).to_be_visible()
  assert body.locator('li').count()>0
  assert page.evaluate("!document.querySelector('#help-content').closest('[aria-hidden=true],[inert]')")
  session=page.context.new_cdp_session(page)
  ax=session.send('Accessibility.getFullAXTree')['nodes']
  assert any(n.get('role',{}).get('value')=='heading' and n.get('name',{}).get('value')==heading.inner_text() and not n.get('ignored') for n in ax),'No help heading in Chromium accessibility tree'
  paragraph=body.locator('li').first.inner_text()
  assert any(n.get('role',{}).get('value')=='listitem' and n.get('name',{}).get('value')==paragraph and not n.get('ignored') for n in ax),'Focused body step has no full accessible text'
  assert any(n.get('role',{}).get('value')=='StaticText' and n.get('name',{}).get('value')==paragraph and not n.get('ignored') for n in ax),'Help paragraph absent from AX tree'
  page.locator('[data-help-topic=calendar]').focus();page.keyboard.press('Enter')
  expect(heading).to_be_focused();expect(body).to_contain_text('快照')
  expect(page.locator('[data-help-topic=calendar]')).to_have_attribute('aria-current','page')
  page.keyboard.press('Tab');expect(body.locator('li').first).to_be_focused()
  page.evaluate("setLocale('en')");expect(body.locator('li').first).to_be_focused();expect(body).to_contain_text('snapshot')
  expect(page.locator('#help-dialog')).to_have_attribute('lang','en')
  expect(body.locator('li').first).to_have_accessible_name(body.locator('li').first.inner_text())
  page.locator('[data-help-topic=calendar]').focus();page.evaluate("setLocale('zh-CN')")
  expect(page.locator('[data-help-topic=calendar]')).to_be_focused()
  expect(body).to_contain_text('快照');page.evaluate("setLocale('en')")
  # Invalid/outside topic-shaped controls cannot change the selected reading topic.
  page.evaluate("const b=document.createElement('button');b.dataset.helpTopic='records';b.textContent='test';document.querySelector('.help-actions').append(b);b.click();b.remove()")
  expect(page.locator('[data-help-topic=calendar]')).to_have_attribute('aria-current','page')
  # Shift+Tab returns to the TOC; action buttons still wrap inside the modal.
  heading.focus()
  page.keyboard.press('Shift+Tab');expect(page.locator('[data-help-topic=install]')).to_be_focused()
  page.locator('[data-help-action=install]').focus();page.keyboard.press('Tab');expect(page.locator('[data-help-close]')).to_be_focused()
  page.locator('[data-help-close]').focus();page.keyboard.press('Shift+Tab');expect(page.locator('[data-help-action=install]')).to_be_focused()
  page.locator('[data-help-action=tour]').click();expect(page.locator('.help-status')).to_contain_text('Save')
  page.keyboard.press('Escape');expect(page.locator('#trigger')).to_be_focused();expect(page.locator('#draft')).to_have_value('未保存原文')
  # At a small viewport, activating a topic scrolls its reading heading into view.
  page.set_viewport_size({'width':390,'height':400});page.locator('#trigger').click()
  page.locator('[data-help-topic=files]').click();expect(heading).to_be_focused()
  assert page.evaluate("(()=>{const d=document.querySelector('#help-dialog').getBoundingClientRect(),h=document.querySelector('#help-topic-title').getBoundingClientRect();return h.top>=d.top&&h.bottom<=d.bottom})()"),'Reading heading is outside scroll viewport'
  scroll_before=page.locator('#help-dialog').evaluate('(node)=>node.scrollTop')
  page.keyboard.press('ArrowDown')
  page.wait_for_function("document.querySelector('#help-dialog').scrollTop>"+str(scroll_before))
  page.keyboard.press('Escape');expect(page.locator('#draft')).to_have_value('未保存原文')
  page.locator('#trigger').click();topics=page.locator('[data-help-topic]').evaluate_all('(nodes)=>nodes.map(node=>node.dataset.helpTopic)')
  assert len(topics)==9
  for topic in topics:
   page.locator('[data-help-topic='+topic+']').click();expect(heading).to_be_focused()
   for step in body.locator('li').all():
    page.keyboard.press('Tab');expect(step).to_be_focused();expect(step).to_have_accessible_name(step.inner_text())
   page.keyboard.press('Tab');expect(page.locator('[data-help-action=tour]')).to_be_focused()
  page.keyboard.press('Escape');expect(page.locator('#draft')).to_have_value('未保存原文')
  assert not errors,errors
  report={'engine':'Chromium','actualVoiceOver':False,'headingAndEveryBodyStepInTabPath':True,'topicsTraversed':len(topics),'namedHeadingAndFullBodyStepsInAX':True,'topicActivationFocus':True,'localeAndDraftPreserved':True,'topicChangeGuard':True,'modalTrapAndEscapePreserved':True,'mobileReadingHeadingVisible':True,'keyboardScrollsReadingBody':True,'pageErrors':errors}
  (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report));browser.close()
finally:server.shutdown();server.server_close()
