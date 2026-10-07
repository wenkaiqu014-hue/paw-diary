"""Real assistant module in an isolated DOM harness. Provider replies are fake: no model/quotas consumed."""
from pathlib import Path
from functools import partial
import http.server, threading, os
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results/stage3/assistant'
OUT.mkdir(parents=True,exist_ok=True)
class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}'
HTML='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><button id="assistant-open" class="button">记录助手</button><button id="change-pet">Switch pet</button><button id="english">English</button><dialog id="dialog"><h2 id="dialog-title"></h2><button id="close-dialog">Close</button><div id="dialog-body"></div></dialog><script type="module">
import {createAssistantPanel} from '/src/features/assistant-panel.js';
import {getLocale,setLocale} from '/src/ui/i18n.js';
const dialog=document.querySelector('#dialog'),snapshot={version:3,mode:'local',profile:{city:'深圳'},activePetId:'p',pets:[{id:'p',name:'Test Milo',type:'cat',deletedAt:null},{id:'q',name:'Test Luna',type:'cat',deletedAt:null}],records:[],reminders:[],posts:[]};
let scope={petId:'p',generation:1,mode:'local'},origin;
window.TEST={calls:[],delay:0,error:null};
function openModal(title,html){origin=document.activeElement;if(dialog.open)dialog.close();document.querySelector('#dialog-title').textContent=title;document.querySelector('#dialog-body').innerHTML=html;dialog.showModal();return true;}
const panel=createAssistantPanel({getSnapshot:()=>snapshot,getScope:()=>scope,getLocale,openModal,onSource:source=>{window.TEST.source=source;openModal('Source','<p id="source-preview"></p>');document.querySelector('#source-preview').textContent=source.text??source.title;},request:async(action,payload)=>{window.TEST.calls.push({action,payload});if(window.TEST.delay)await new Promise(r=>setTimeout(r,window.TEST.delay));if(window.TEST.error)throw {code:window.TEST.error};return {answer:getLocale()==='en'?'Use Backup to export.':'可在空间入口导出完整备份。 <img src=x onerror=alert(1)>',sources:[{kind:'help',id:'help-backup',title:'备份与恢复',text:'在空间入口导出完整备份。'}],quota:{remaining:2}};}});
window.TEST.panel=panel;
document.querySelector('#assistant-open').onclick=()=>panel.open();
function close(){dialog.close();origin?.focus();}
document.querySelector('#close-dialog').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
document.addEventListener('click',event=>{if(event.target.closest('[data-action=close]'))close();});
document.querySelector('#change-pet').onclick=()=>{scope={...scope,petId:'q',generation:2};panel.syncScope();};
document.querySelector('#english').onclick=()=>{setLocale('en');panel.refreshLocale();};
</script></body></html>'''
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=os.environ.get('PAW_HEADFUL')!='1')
        for width in (1440,390):
            page=browser.new_page(viewport={'width':width,'height':900})
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('**/assistant-harness',lambda route:route.fulfill(content_type='text/html',body=HTML))
            page.goto(BASE+'/assistant-harness',wait_until='networkidle')
            page.locator('#assistant-open').click()
            expect(page.locator('#assistant-form')).to_be_visible()
            expect(page.locator('#assistant-form')).to_contain_text('网站怎么用')
            assert page.locator('[data-assistant-quick]').count()==3
            expect(page.locator('#assistant-question')).to_be_focused()
            page.locator('[data-assistant-quick=helpQuestion]').click()
            expect(page.locator('.assistant-message.assistant')).to_contain_text('可在空间入口')
            assert page.locator('#assistant-messages img').count()==0
            assert page.evaluate('TEST.calls[0].payload.history.length')==0
            page.locator('#assistant-question').fill('然后呢？');page.locator('#assistant-ask').click()
            expect(page.locator('.assistant-message.assistant')).to_have_count(2)
            assert page.evaluate('TEST.calls[1].payload.history.length')==2
            page.locator('[data-assistant-source]').first.click()
            expect(page.locator('#source-preview')).to_have_text('在空间入口导出完整备份。')
            assert page.evaluate('TEST.source.id')=='help-backup'
            page.locator('#close-dialog').click();page.locator('#assistant-open').click()
            page.locator('#assistant-question').fill('unsaved question');page.locator('[data-action=close]').click()
            expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('#assistant-open')).to_be_focused()
            page.locator('#change-pet').click();page.locator('#assistant-open').click()
            expect(page.locator('#assistant-scope')).to_contain_text('Test Luna')
            assert page.locator('.assistant-message').count()==0
            page.evaluate("TEST.error='QUOTA_EXCEEDED'")
            page.locator('#assistant-question').fill('try');page.locator('#assistant-ask').click()
            expect(page.locator('#assistant-form .form-error')).to_contain_text('额度')
            expect(page.locator('#assistant-question')).to_have_value('try')
            assert page.locator('.assistant-message').count()==0
            page.evaluate("TEST.error=null")
            page.evaluate("document.querySelector('#english').click()")
            expect(page.locator('#assistant-ask')).to_have_text('Send')
            expect(page.locator('#dialog-title')).to_have_text('Record assistant')
            expect(page.locator('#assistant-form .form-error')).to_contain_text('quota')
            expect(page.locator('#assistant-consent')).to_contain_text('SiliconFlow')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(OUT/f'assistant-{width}.png'),full_page=True)
            assert not errors,errors
            page.close()
        browser.close()
    print('PASS isolated real-module DOM: welcome, quick questions, sources, short history, literal HTML, scope clear, quota error, bilingual, desktop/mobile; fake provider only')
finally:
    server.shutdown()
