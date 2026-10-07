"""Synthetic demo data; real record filtering, keyboard and pointer ordering."""
import os
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.goto(os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4201/')+'#health',wait_until='networkidle')
    page.evaluate('''() => {const s=JSON.parse(localStorage.getItem('paw-diary:v3:demo'));s.pets[0].name='Alpha';s.pets.push({...s.pets[0],id:'fixture-beta',name:'Beta',type:'cat',image:'assets/cat.jpg'});const r=s.records[0];s.records.push({...r,id:'fixture-beta-record',petId:'fixture-beta',title:'Beta record'});localStorage.setItem('paw-diary:v3:demo',JSON.stringify(s));}''')
    page.reload(wait_until='networkidle')
    filters=page.locator('[name=record-pet-filter]')
    expect(filters).to_have_count(2)
    assert filters.first.is_checked() and not filters.last.is_checked()
    expect(page.locator('.records-table')).not_to_contain_text('Beta record')
    filters.last.check();expect(page.locator('.records-table')).to_contain_text('Beta')
    filters=page.locator('[name=record-pet-filter]');filters.first.uncheck();page.locator('[name=record-pet-filter]').last.uncheck()
    expect(page.locator('.health-records .empty')).to_be_visible()
    assert page.locator('[data-action=pet-up],[data-action=pet-down]').count()==0
    handle=page.locator('[data-pet-drag]').first;handle.focus();page.keyboard.press('Space');page.keyboard.press('ArrowDown');page.keyboard.press('Enter')
    expect(page.locator('.pet-entry').first).to_have_attribute('data-id','fixture-beta')
    page.reload(wait_until='networkidle');expect(page.locator('.pet-entry').first).to_have_attribute('data-id','fixture-beta')
    rows=page.locator('.pet-entry');a=page.locator('[data-pet-drag]').first.bounding_box();b=rows.last.bounding_box()
    page.mouse.move(a['x']+a['width']/2,a['y']+a['height']/2);page.mouse.down();page.mouse.move(b['x']+20,b['y']+b['height']-2,steps=10);page.mouse.up()
    expect(page.locator('.pet-entry').last).to_have_attribute('data-id','fixture-beta')
    page.reload(wait_until='networkidle');expect(page.locator('.pet-entry').last).to_have_attribute('data-id','fixture-beta')
    before=page.locator('.pet-entry').evaluate_all('(rows)=>rows.map(r=>r.dataset.id)')
    page.locator('[data-pet-drag]').first.focus();page.keyboard.press('Space');page.keyboard.press('ArrowDown');page.keyboard.press('Escape')
    assert page.locator('.pet-entry').evaluate_all('(rows)=>rows.map(r=>r.dataset.id)')==before
    page.evaluate('''() => {const root=document.querySelector('.pet-list'),handle=root.querySelector('[data-pet-drag]'),start=handle.getBoundingClientRect(),end=root.querySelector('.pet-entry:last-child').getBoundingClientRect();handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:22,pointerType:'touch',button:0,clientX:start.x+10,clientY:start.y+20}));root.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:22,pointerType:'touch',clientX:end.x+10,clientY:end.bottom-1}));root.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:22,pointerType:'touch',clientX:end.x+10,clientY:end.bottom-1}));}''')
    expect(page.locator('.pet-entry').first).to_have_attribute('data-id','fixture-beta')
    page.reload(wait_until='networkidle');expect(page.locator('.pet-entry').first).to_have_attribute('data-id','fixture-beta')
    page.set_viewport_size({'width':390,'height':844});locale=page.locator('#locale-select').locator('xpath=..');locale.locator('.select-trigger').click();locale.get_by_role('option',name='English',exact=True).click()
    expect(page.locator('.record-pet-filter')).to_contain_text('Pets in this list')
    page.locator('[name=record-pet-filter]').first.check();page.locator('[name=record-pet-filter]').last.check()
    page.locator('[data-action=select-pet][data-id=fixture-beta]').click()
    assert page.locator('[name=record-pet-filter]:checked').count()==2
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    from pathlib import Path
    out=Path(__file__).resolve().parents[2]/'test-results/record-refinement/pets';out.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(out/'multi-pet-390-en.png'),full_page=True)
    page.set_viewport_size({'width':1440,'height':1000});page.screenshot(path=str(out/'multi-pet-1440-en.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    browser.close()
print('PASS current-only/multi/empty, keyboard save/Escape, mouse and simulated touch row persistence, English390 and manual selections retained across current-pet switch')
