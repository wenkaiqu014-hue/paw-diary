"""Real Chrome date input enhancement, without accounts or model requests."""
from pathlib import Path
from functools import partial
import http.server,threading
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
HTML='''<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/date-input.css"><style>body{margin:20px;font-family:system-ui}label{display:block;max-width:500px}input{width:100%;box-sizing:border-box;padding:12px;height:48px;border:1px solid #ddd;border-radius:8px;font-size:16px}</style><label>Date<input id="date" type="date" name="date" min="2020-01-01" max="2030-12-31" required></label><button id="blur">Leave field</button><button id="picker">Open native picker</button><script type="module">import {enhanceDateInput} from '/src/ui/date-input.js';const input=document.querySelector('#date');window.TEST={events:[]};input.addEventListener('input',()=>TEST.events.push('input'));input.addEventListener('change',()=>TEST.events.push('change'));window.dateControl=enhanceDateInput(input,{getLocale:()=> 'zh-CN'});document.querySelector('#picker').onclick=()=>{try{input.showPicker();TEST.picker=true}catch(e){TEST.pickerError=e.name}};window.TEST.ready=true;</script></html>'''
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    for width in [1440,768,390]:
        page=browser.new_page(viewport={'width':width,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('**/date-harness',lambda r:r.fulfill(content_type='text/html',body=HTML))
        page.goto(f'http://127.0.0.1:{server.server_port}/date-harness',wait_until='networkidle')
        page.wait_for_function('window.TEST?.ready===true',timeout=2000)
        mask=page.locator('.date-input-mask');expect(mask).to_be_visible();assert mask.get_attribute('aria-hidden')=='true'
        assert mask.locator('.date-input-segment').all_text_contents()==['年','月','日']
        widths=mask.locator('.date-input-segment').evaluate_all('(nodes)=>nodes.map(n=>n.getBoundingClientRect().width)')
        assert max(widths)==min(widths),widths
        assert page.locator('#date').input_value()==''
        assert mask.evaluate('(node)=>getComputedStyle(node).pointerEvents')=='none'
        if width==390:
            out=ROOT/'test-results/final-growth';out.mkdir(parents=True,exist_ok=True)
            page.locator('label').screenshot(path=str(out/'date-input-390.png'))
        page.locator('#date').focus();page.keyboard.press('ArrowUp');expect(mask).not_to_be_visible()
        page.locator('#blur').click()
        if page.locator('#date').input_value()=='':expect(mask).to_be_visible()
        page.locator('#date').fill('2026-10-07');expect(mask).not_to_be_visible();assert page.evaluate('TEST.events.includes("input") && TEST.events.includes("change")')
        page.evaluate('dateControl.setLocale("en")');assert page.locator('#date').input_value()=='2026-10-07'
        page.locator('#date').fill('');page.locator('#blur').click();expect(mask).to_be_visible();assert mask.locator('.date-input-segment').all_text_contents()==['YYYY','MM','DD']
        mutations=page.evaluate('''async()=>{let count=0;const observer=new MutationObserver(records=>count+=records.length);observer.observe(document.body,{subtree:true,attributes:true,childList:true,characterData:true});dateControl.sync();dateControl.setLocale('en');dateControl.sync();await Promise.resolve();observer.disconnect();return count;}''');assert mutations==0,mutations
        page.locator('#picker').click();assert page.evaluate('TEST.picker===true && !TEST.pickerError');page.keyboard.press('Escape')
        page.evaluate('document.querySelector("#date").disabled=true;dateControl.sync()');expect(page.locator('#date')).to_be_disabled()
        assert page.locator('#date').get_attribute('name')=='date' and page.locator('#date').get_attribute('min')=='2020-01-01' and page.locator('#date').get_attribute('max')=='2030-12-31' and page.locator('#date').get_attribute('required') is not None
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.evaluate('dateControl.destroy()');assert page.locator('.date-input-shell').count()==0;assert page.locator('#date').count()==1
        assert not errors,errors;page.close()
    browser.close()
 print('PASS date mask 1440/768/390 equal widths, keyboard retreat, native fill/events/picker, locale/value, disabled/attributes and zero-op observer')
finally:server.shutdown()
