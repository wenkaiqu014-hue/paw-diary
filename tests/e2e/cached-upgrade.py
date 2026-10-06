"""旧HTTP缓存不应使新版UI与旧V2模块混用，导致空白或数据写错。"""
from pathlib import Path
import os, subprocess, json
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4191/')
OLD='61f9998'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    context=browser.new_context();page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def old_cache(route):
        path=route.request.url.split('?',1)[0].split('/src/',1)[1]
        try:
            body=subprocess.check_output(['git','show',f'{OLD}:src/{path}'],cwd=ROOT,text=True,stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            route.continue_();return
        route.fulfill(status=200,content_type='text/javascript',body=body)
    # Represents old modules still fresh in a browser cache; versioned URLs miss this cache.
    context.route('**/src/**/*.js',old_cache)
    page.goto(BASE+'#health',wait_until='networkidle')
    expect(page.get_by_role('button',name='管理宠物',exact=True)).to_be_visible()
    expect(page.get_by_role('button',name='回收站',exact=True)).to_be_visible()
    assert page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v3:demo')).version")==3
    assert not errors,errors
    print('PASS: 新版在旧模块缓存场景正确启动V3与管理，不混用V2模块')
    context.close();browser.close()
