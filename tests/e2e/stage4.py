"""Whole application public UI against its configured real cloud, no mail or writes.
Browser denial is simulated solely for the location permission UI assertion.
"""
from pathlib import Path
from help_startup import dismiss_startup_help
import os, json, re
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4221/').rstrip('/')+'/'
OUT=ROOT/'test-results/stage4/public-app';OUT.mkdir(parents=True,exist_ok=True)
def choose(page,selector,value):
    control=page.locator(selector)
    label=control.evaluate('(s,v)=>Array.from(s.options).find(o=>o.value===v).textContent',value)
    root=control.locator('..')
    if not root.locator('.select-trigger').count():
        control.select_option(value);return
    trigger=root.locator('.select-trigger')
    if trigger.get_attribute('aria-expanded')!='true':trigger.click()
    root.get_by_role('option',name=label,exact=True).click()
def ready(page,route):
    page.evaluate('(r)=>{location.hash=r}',route)
    if route=='community':
        expect(page.locator('[data-community-feed]')).to_have_attribute('aria-busy','false',timeout=25000)
    elif route=='nearby':
        page.locator('[data-nearby-status]').wait_for()
        page.wait_for_function('!/(Loading|\\u6b63\\u5728\\u8bfb\\u53d6)/.test(document.querySelector("[data-nearby-status]")?.textContent)',timeout=25000)
    else:page.locator('[data-profile-login]').wait_for()
with sync_playwright() as runtime:
    browser=runtime.chromium.launch(headless=os.environ.get('PAW_DIARY_HEADED')!='1',executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    context.add_init_script("window.__locationCalls=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(ok,fail){window.__locationCalls++;fail({code:1});}},configurable:true});")
    page=context.new_page();page.set_default_timeout(12000);errors=[]
    page.on('pageerror',lambda _:errors.append('PAGE_ERROR'))
    page.goto(BASE+'#community',wait_until='networkidle')
    dismiss_startup_help(page)
    assert page.evaluate('__PAW_PUBLIC_CONFIG__.communityEnabled===true')
    for locale in ['zh-CN','en']:
        choose(page,'#locale-select',locale)
        for route in ['community','nearby','profile']:
            ready(page,route)
            for width in [1440,768,390]:
                page.set_viewport_size({'width':width,'height':1000})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                assert page.locator('#owner-profile-button').is_visible()
                if locale=='en':
                    for selector in ['#page-label','#workspace-controls','#city-label','#stage3-assistant-launcher']:
                        assert not re.search(r'[\u4e00-\u9fff]',page.locator(selector).inner_text()),selector
                page.screenshot(path=str(OUT/(route+'-'+locale+'-'+str(width)+'.png')),full_page=True)
    ready(page,'community');page.set_viewport_size({'width':1440,'height':1000})
    assert page.evaluate('__locationCalls')==0
    page.locator('#city-button').click()
    page.locator('[data-region-city]').locator('..').locator('.select-trigger').click()
    page.locator('[data-region-query]').fill('\u5317\u4eac')
    city=page.locator('[data-region-city]')
    expect(city.locator('option')).not_to_have_count(1,timeout=20000)
    city_id=city.evaluate('(s)=>Array.from(s.options).find(o=>o.textContent.includes("\\u5317\\u4eac"))?.value')
    assert city_id
    choose(page,'[data-region-city]',city_id)
    page.locator('[data-region-locate]').click()
    expect(page.locator('[data-region-status]')).to_contain_text('permission was denied')
    assert page.evaluate('__locationCalls')==1
    page.locator('#dialog [data-action=close]').click()
    page.locator('[data-community-scope=all]').focus();page.keyboard.press('ArrowRight')
    expect(page.locator('[data-community-scope=city]')).to_have_attribute('aria-selected','true')
    expect(page.locator('[data-community-feed]')).to_have_attribute('aria-busy','false',timeout=25000)
    page.keyboard.press('Home')
    expect(page.locator('[data-community-scope=all]')).to_have_attribute('aria-selected','true')
    page.locator('#owner-profile-button').click()
    page.get_by_role('menu').get_by_role('menuitem',name='Personal profile').wait_for()
    page.keyboard.press('Escape');expect(page.get_by_role('menu')).not_to_be_attached()
    assert page.locator('#owner-profile-button').evaluate('(x)=>x===document.activeElement')
    page.locator('[data-community-write]').click()
    editor=page.locator('.community-editor-dialog')
    editor.locator('[name=title]').fill('Unsaved user draft <script>plain</script>')
    editor.locator('[name=text]').fill('User text stays unchanged on locale updates.')
    choose(page,'.community-editor-dialog [data-community-dialog-locale]','zh-CN')
    expect(editor.locator('[name=title]')).to_have_value('Unsaved user draft <script>plain</script>')
    expect(editor.locator('[name=text]')).to_have_value('User text stays unchanged on locale updates.')
    page.keyboard.press('Escape');page.get_by_role('alertdialog').wait_for()
    page.keyboard.press('Escape');expect(editor).to_be_visible()
    editor.locator('[data-dialog-close]').click()
    page.get_by_role('alertdialog').get_by_role('button',name='\u786e\u8ba4',exact=True).click()
    expect(editor).not_to_be_visible()
    assert not errors
    (OUT/'report.json').write_text(json.dumps({'realPublicCloud':True,'noAuthenticationOrWrites':True,'simulatedPermissionDenial':True,'widths':[1440,768,390],'languages':['zh-CN','en'],'keyboardMenuAndTabs':True,'localeDraftPreserved':True,'pageErrors':0},indent=2))
    browser.close()
print('PASS real public application: three widths, two languages, manual city, simulated denied location, keyboard and draft preservation')
