"""Shared browsing region on real public directory; no profile or health writes."""
from pathlib import Path
import os, json
from playwright.sync_api import sync_playwright, expect
from help_startup import dismiss_startup_help

BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4240/paw-diary/')
OUT=Path(__file__).resolve().parents[2]/'test-results/stage5/city-sync'
OUT.mkdir(parents=True,exist_ok=True)
def choose(page, selector, value):
 control=page.locator(selector)
 label=control.evaluate('(s,v)=>Array.from(s.options).find(o=>o.value===v).textContent',value)
 parent=control.locator('..');trigger=parent.locator('.select-trigger')
 if trigger.get_attribute('aria-expanded')!='true':trigger.click()
 parent.get_by_role('option',name=label,exact=True).click()
with sync_playwright() as runtime:
 browser=runtime.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=os.environ.get('PAW_HEADFUL')!='1')
 page=browser.new_page(viewport={'width':390,'height':844});errors=[]
 page.on('pageerror',lambda _:errors.append('PAGE_ERROR'))
 page.goto(BASE+'#home',wait_until='networkidle');dismiss_startup_help(page)
 original=page.evaluate("localStorage.getItem('paw-diary:v3:demo')")
 page.locator('#city-button').click()
 city=page.locator('#dialog [data-region-city]')
 expect(city).to_be_attached()
 expect(city.locator('option')).not_to_have_count(1,timeout=25000)
 page.locator('#dialog [data-region-city]').locator('..').locator('.select-trigger').click()
 page.locator('#dialog [data-region-query]').fill('北京')
 page.wait_for_function("Array.from(document.querySelector('#dialog [data-region-city]').options).some(o=>o.textContent.includes('北京'))",timeout=25000)
 beijing=city.evaluate("s=>Array.from(s.options).find(o=>o.textContent.includes('北京')).value")
 choose(page,'#dialog [data-region-city]',beijing)
 page.locator('#community-browse-apply').click()
 expect(page.locator('#city-label')).to_contain_text('北京')
 page.evaluate("location.hash='community'")
 page.locator('[data-community-scope=city]').click()
 expect(page.locator('[data-community-browse-region] [data-region-city]')).to_have_value(beijing)
 # Change the inline community selection and then inspect the top-bar picker.
 inline='[data-community-browse-region] [data-region-city]'
 page.locator(inline).locator('..').locator('.select-trigger').click()
 page.locator('[data-community-browse-region] [data-region-query]').fill('上海')
 page.wait_for_function("Array.from(document.querySelector('[data-community-browse-region] [data-region-city]').options).some(o=>o.textContent.includes('上海'))",timeout=25000)
 shanghai=page.locator(inline).evaluate("s=>Array.from(s.options).find(o=>o.textContent.includes('上海')).value")
 choose(page,inline,shanghai)
 expect(page.locator('#city-label')).to_contain_text('上海')
 page.locator('#city-button').click()
 expect(page.locator('#dialog [data-region-city]')).to_have_value(shanghai)
 # Apply from the top bar while community is mounted: its inline control follows.
 page.locator('#dialog [data-region-city]').locator('..').locator('.select-trigger').click()
 page.locator('#dialog [data-region-query]').fill('北京')
 page.wait_for_function("Array.from(document.querySelector('#dialog [data-region-city]').options).some(o=>o.textContent.includes('北京'))",timeout=25000)
 choose(page,'#dialog [data-region-city]',beijing)
 page.locator('#community-browse-apply').click()
 expect(page.locator(inline)).to_have_value(beijing)
 page.evaluate("location.hash='nearby'")
 page.locator('[data-nearby-status]').wait_for()
 expect(page.locator('#city-label')).to_contain_text('北京')
 page.evaluate("location.hash='health'")
 expect(page.locator('#city-label')).to_contain_text('北京')
 page.reload(wait_until='networkidle');expect(page.locator('#city-label')).to_contain_text('北京')
 assert page.evaluate("localStorage.getItem('paw-diary:v3:demo')")==original,'Browsing region must not write health/profile snapshot'
 assert not errors,errors
 page.screenshot(path=str(OUT/'shared-region-mobile.png'))
 (OUT/'report.json').write_text(json.dumps({'sharedHomeHealthCommunityNearby':True,'bidirectionalTopbarInline':True,'reload':True,'healthSnapshotUnchanged':True,'pageErrors':0},indent=2))
 browser.close()
print('PASS shared browsing city: home, community bidirectional, nearby, health, reload; health snapshot unchanged')
