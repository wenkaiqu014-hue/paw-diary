# coding: utf-8
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright

url=os.environ.get('PAW_PROFILE_TEST_URL','http://127.0.0.1:4220/test-results/stage4/profile-fixture.html')
out=Path('test-results/stage4/profile-ui');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=os.environ.get('PAW_HEADFUL')!='1',executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    errors=[]
    for width in (1440,768,390):
        page=browser.new_page(viewport={'width':width,'height':1000})
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(url,wait_until='networkidle')
        page.get_by_role('button',name='Profile menu').click()
        page.get_by_role('menuitem',name='个人资料',exact=True).click()
        page.wait_for_selector('[data-profile-form]')
        page.locator('[name=nickname]').fill('新昵称')
        assert page.locator('[data-profile-preview]').inner_text().find('新昵称')>=0
        assert 'fixture@example.test' not in page.locator('[data-profile-preview]').inner_text()
        page.get_by_role('button',name='保存资料',exact=True).click()
        page.wait_for_function('window.saved.length === 1')
        assert page.evaluate('window.saved[0].nickname')=='新昵称'
        page.get_by_role('button',name='Profile menu').click()
        page.keyboard.press('Escape')
        assert page.get_by_role('button',name='Profile menu').evaluate('(el)=>el===document.activeElement')
        assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth')
        page.screenshot(path=str(out/f'{width}.png'),full_page=True)
        page.close()
    assert errors==[],errors
    browser.close()
print(json.dumps({'widths':[1440,768,390],'publicEmailExcluded':True,'profileSave':True,'menuEscapeFocus':True,'pageErrors':errors}))
