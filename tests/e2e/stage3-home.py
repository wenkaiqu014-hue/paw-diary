"""Home geometry; isolated demo context, no authentication or private records."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4199/')
OUT=Path(__file__).resolve().parents[2]/'test-results/stage3/home'
OUT.mkdir(parents=True,exist_ok=True)
def choose_locale(page, selector, value):
    select=page.locator(selector)
    label=select.locator('option[value="'+value+'"]').text_content()
    root=select.locator('..');root.locator('.select-trigger').click()
    root.get_by_role('option',name=label,exact=True).click()

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=os.environ.get('PAW_HEADFUL')!='1')
    page=browser.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    for language in ('zh-CN','en'):
        for width in (1440,768,390):
            page.set_viewport_size({'width':width,'height':900})
            page.goto(BASE+'#home',wait_until='networkidle')
            choose_locale(page,'#locale-select',language)
            expect(page.locator('.care-home')).to_be_visible()
            boxes=page.evaluate('''() => Object.fromEntries(['.workspace-controls','.care-home','.pet-hero','.home-reminders','.home-chart','.home-recap','.home-timeline'].map(s=>{const e=document.querySelector(s);if(!e)return[s,null];const r=e.getBoundingClientRect();return[s,{x:r.x,y:r.y,width:r.width,right:r.right}]}))''')
            pet,care=boxes['.pet-hero'],boxes['.home-reminders']
            assert abs(pet['width']-care['width'])<=1,(language,width,'pet/care unequal width',pet,care)
            assert boxes['.home-recap'] is not None,'recap region is missing'
            if width>=1100:
                assert abs(pet['y']-care['y'])<=1
                assert abs(boxes['.home-chart']['width']-boxes['.home-recap']['width'])<=1
                assert abs(boxes['.home-chart']['y']-boxes['.home-recap']['y'])<=1
            else:
                assert care['y']>pet['y']
            for edge in ('x','right'):
                assert abs(boxes['.workspace-controls'][edge]-boxes['.care-home'][edge])<=1,(width,edge,boxes)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(OUT/f'{width}-{language}.png'),full_page=True)
    assert not errors,errors
    browser.close()
    print('PASS: home equal columns, aligned boundaries, both languages and three widths')
