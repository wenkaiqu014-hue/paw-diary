"""Headful isolated nearby custom category regression; no cloud reads/writes.

Serve the repository root on PAW_CUSTOM_TEST_ORIGIN (default 127.0.0.1:4198).
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results/v102/nearby-custom'
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'fixture.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/src/ui/community.css"><main><div id="fixture"></div></main><script type="module">
import {mountNearby} from '/src/features/nearby.js';
window.language='zh-CN';window.calls=[];window.forceEmpty=false;
window.profiles=[
 {authorId:'custom-owner',nickname:'合成兔子宠友',cityId:'310100',cityName:'上海市',bio:'合成资料',petTypes:['cat','兔子','"& test'],purposes:['新手互助'],discoverable:true},
 {authorId:'all-owner',nickname:'合成all宠友',cityId:'310100',cityName:'上海市',bio:'合成资料',petTypes:['all'],purposes:['新手互助'],discoverable:true}
];
window.controller=mountNearby({container:document.querySelector('#fixture'),getLocale:()=>window.language,repository:{request:async(action,payload)=>{
 window.calls.push({action,payload});
 if(action==='profiles.getPublic')return window.profiles.find(p=>p.authorId===payload.authorId);
 if(action==='profiles.discover')return {items:window.forceEmpty?[]:window.profiles.filter(p=>!payload.petTypes.length||payload.petTypes.some(t=>p.petTypes.includes(t))),nextCursor:null};
 throw Error(action);
}}});</script>''', encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=False)
    report, errors = [], []
    for width in (1440, 390):
        page = browser.new_page(viewport={'width': width, 'height': 1000})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(os.environ.get('PAW_CUSTOM_TEST_ORIGIN', 'http://127.0.0.1:4198') + '/test-results/v102/nearby-custom/fixture.html')
        page.wait_for_load_state('networkidle')
        assert page.locator('[data-nearby-card]').count() == 2
        assert page.locator('[data-nearby-card="custom-owner"] .friend-tags').inner_text() == '猫\n兔子\n"& test\n新手互助'
        assert page.locator('[data-nearby-card="all-owner"] .friend-tags').inner_text() == 'all\n新手互助'
        assert page.locator('script').count() == 1

        def filter_pet(name):
            page.get_by_role('button', name=name, exact=True).click()
            page.wait_for_function('window.calls.at(-1).action=== "profiles.discover"')
            return page.evaluate('window.calls.at(-1).payload.petTypes')

        assert filter_pet('all') == ['all'], 'Literal all category must not become the all-pets sentinel'
        assert page.locator('[data-nearby-card]').count() == 1
        assert page.locator('[data-nearby-card="all-owner"]').count() == 1
        page.locator('[data-nearby-pet=""]').click()
        assert page.evaluate('window.calls.at(-1).payload.petTypes') == []
        assert page.locator('[data-nearby-card]').count() == 2
        assert filter_pet('兔子') == ['兔子']
        assert page.locator('[data-nearby-card="custom-owner"]').count() == 1
        assert filter_pet('"& test') == ['"& test']
        page.locator('[data-view-profile="custom-owner"]').click()
        page.locator('[data-nearby-detail] h2').wait_for()
        assert '兔子' in page.locator('[data-nearby-detail] .friend-tags').inner_text()
        assert '"& test' in page.locator('[data-nearby-detail] .friend-tags').inner_text()
        assert page.locator('[data-nearby-detail]').evaluate('(el)=>el===document.activeElement')
        page.locator('[data-nearby-close]').click()

        page.evaluate("window.language='en';window.controller.refreshLocale()")
        assert page.get_by_role('button', name='兔子', exact=True).count() == 1
        assert page.get_by_role('button', name='"& test', exact=True).count() == 1
        assert 'Cats' in page.locator('[data-nearby-card="custom-owner"] .friend-tags').inner_text()
        page.locator('[data-nearby-pet=""]').click()
        assert filter_pet('all') == ['all']
        assert 'all' in page.locator('[data-nearby-card="all-owner"] .friend-tags').inner_text()
        page.locator('[data-view-profile="all-owner"]').click()
        page.locator('[data-nearby-detail] h2').wait_for()
        assert 'all' in page.locator('[data-nearby-detail] .friend-tags').inner_text()
        page.locator('[data-nearby-close]').click()
        page.locator('[data-nearby-pet=""]').click()
        page.evaluate('window.forceEmpty=true')
        assert filter_pet('兔子') == ['兔子']
        assert page.locator('[data-nearby-empty]').is_visible()
        page.evaluate('window.forceEmpty=false')
        page.locator('[data-nearby-clear]').click()
        assert page.evaluate('window.calls.at(-1).payload.petTypes') == []
        assert page.evaluate('window.calls.at(-1).payload.scope') == 'all'
        assert page.locator('[data-nearby-card]').count() == 2
        assert page.locator('[data-nearby-pet=""]').get_attribute('aria-pressed') == 'true'
        assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth')
        page.screenshot(path=str(OUT / f'{width}.png'), full_page=True)
        report.append({'width': width, 'literalAll': True, 'quotedName': True, 'customListDetail': True, 'englishOriginalName': True, 'emptyClearAll': True})
        page.close()
    assert not errors, errors
    browser.close()
    (OUT / 'report.json').write_text(json.dumps({'headful': True, 'synthetic': True, 'checks': report, 'pageErrors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report))
