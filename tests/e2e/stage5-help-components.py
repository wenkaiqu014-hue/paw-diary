"""Isolated real-browser help controllers; no app bootstrap, account or business API."""
import functools,json,os,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results'/'stage5'/'help-components';OUT.mkdir(parents=True,exist_ok=True)
HTML='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><body><main tabindex="-1"><button id="trigger">帮助</button><input id="draft" value="未保存原文"></main><script type="module">
import {mountHelp} from '/src/features/help.js';import {mountWhatsNew} from '/src/features/whats-new.js';import zh from '/src/ui/locales/zh-CN.js';import en from '/src/ui/locales/en.js';
let locale='zh-CN';window.calls={ack:0,dismiss:0,tour:0,install:0,news:0};const t=(key,args={})=>{let text=(locale==='en'?en:zh)[key]??key;for(const [k,v]of Object.entries(args))text=text.replaceAll('{'+k+'}',v);return text;};
window.help=mountHelp({document,t,getLocale:()=>locale,onTour:()=>{calls.tour++;return window.allowTour??false;},onInstall:()=>calls.install++,onWhatsNew:()=>calls.news++});
window.news=mountWhatsNew({document,t,getLocale:()=>locale,onAcknowledge:r=>{calls.ack++;calls.version=r.version;},onDismiss:()=>calls.dismiss++});
window.setLocale=value=>{locale=value;help.refreshLocale();news.refreshLocale();};document.querySelector('#trigger').onclick=()=>help.open();window.ready=true;
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
  browser=p.chromium.launch(channel='chrome',headless=os.environ.get('PAW_HELP_HEADLESS')=='1')
  page=browser.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}/__fixture__',wait_until='networkidle')
  assert page.evaluate('window.ready===true'),errors
  page.locator('#trigger').click();expect(page.locator('#help-dialog')).to_be_visible()
  assert page.locator('[data-help-topic]').count()==9
  page.locator('[data-help-topic=calendar]').click();expect(page.locator('.help-content')).to_contain_text('快照')
  page.evaluate("setLocale('en')");expect(page.locator('.help-content')).to_contain_text('snapshot')
  expect(page.locator('[data-help-topic=calendar]')).to_have_attribute('aria-current','page');expect(page.locator('.help-content')).to_be_focused(timeout=1500);expect(page.locator('#draft')).to_have_value('未保存原文')
  page.locator('[data-help-action=tour]').click();expect(page.locator('.help-status')).to_contain_text('Save')
  page.keyboard.press('Escape');expect(page.locator('#help-dialog')).not_to_be_visible();expect(page.locator('#trigger')).to_be_focused()
  page.locator('#trigger').click();expect(page.locator('#help-title')).to_be_focused();page.keyboard.press('Shift+Tab');expect(page.locator('[data-help-action=install]')).to_be_focused();page.keyboard.press('Tab');expect(page.locator('[data-help-close]')).to_be_focused()
  page.evaluate("help.close();news.open({version:'0.8.0',channel:'stable'})");expect(page.locator('#whats-new-dialog')).to_be_visible()
  page.keyboard.press('Escape');assert page.evaluate('calls.ack')==0;assert page.evaluate('calls.dismiss')==1
  page.evaluate("news.open({version:'0.8.0',channel:'stable'});news.refreshLocale()")
  page.evaluate("const btn=document.querySelector('[data-whats-new-confirm]');btn.click();btn.click()")
  assert page.evaluate('calls.ack')==1;assert page.evaluate('calls.dismiss')==1
  page.evaluate("news.open({version:'<img src=x onerror=alert(1)>',channel:'stable'})")
  assert page.locator('#whats-new-dialog img').count()==0;expect(page.locator('#whats-new-title')).to_contain_text('<img')
  page.locator('[data-whats-new-close]').click();assert page.evaluate('calls.ack')==1;assert page.evaluate('calls.dismiss')==2
  page.locator('#trigger').click();page.locator('[data-help-action=install]').click();assert page.evaluate('calls.install')==1;expect(page.locator('#help-dialog')).not_to_be_visible();page.locator('#trigger').click();page.locator('[data-help-action=whats-new]').click();assert page.evaluate('calls.news')==1;page.locator('#trigger').click();page.evaluate('window.allowTour=true');page.locator('[data-help-action=tour]').click();assert page.evaluate('calls.tour')==2;expect(page.locator('#help-dialog')).not_to_be_visible();page.locator('#trigger').click();page.evaluate("document.querySelector('#trigger').remove();help.close()")
  expect(page.locator('main')).to_be_focused()
  # Reopen/locale preserves topic; destroy removes owned dialog and event listeners.
  page.evaluate("help.open('files')");expect(page.locator('.help-content')).to_contain_text('backup')
  for width in [1440,390]:
   page.set_viewport_size({'width':width,'height':900});page.screenshot(path=str(OUT/f'help-{width}.png'))
  page.evaluate('help.destroy();news.destroy()');assert page.locator('#help-dialog').count()==0;assert page.locator('#whats-new-dialog').count()==0
  assert not errors,errors;browser.close()
  report={'standalone':True,'themes':9,'localePreservesTopicAndDraft':True,'dirtyTourBlocked':True,'dismissDoesNotAcknowledge':True,'doubleConfirmOnce':True,'escapedReleaseText':True,'focusRestoreAndFallback':True,'widths':[1440,390],'pageErrors':errors}
  (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report))
finally:server.shutdown();server.server_close()
