"""Actual type subpanels, native file button theme, and mutually exclusive purposes."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4195/')
OUT=Path(__file__).resolve().parents[2]/'test-results'/'ui-polish';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=False);page=b.new_page(viewport={'width':1440,'height':950});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL+'#health',wait_until='networkidle');page.locator('[data-action=workspace-local]').first.click()
 page.locator('#pet-form [name=name]').fill('合成排版验收');page.locator('#pet-form [name=estimatedAgeMonths]').fill('12');page.locator('#pet-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible()
 page.locator('main [data-action=record]').click();expect(page.locator('[name=joinTodo],[name=nextDate]')).to_have_count(0)
 style=page.locator('[data-attachment-input]').evaluate("e=>{const s=getComputedStyle(e,'::file-selector-button');return {radius:s.borderRadius,height:s.minHeight,color:s.color}}")
 assert style['radius']=='8px' and style['height']=='44px',style
 root=page.locator('#record-type').locator('..');root.locator('.select-trigger').click();root.locator('.type-catalog-add').click()
 expect(root.locator('.select-options')).to_be_hidden();expect(root.locator('.type-catalog-icon-option')).to_have_count(3);expect(root.locator('input[type=radio]')).to_have_count(0)
 assert root.locator('.type-catalog-icon-option').first.get_attribute('aria-pressed')=='true'
 assert root.locator('.type-catalog-icon-option').all_text_contents()==['','','']
 shapes=root.locator('.type-catalog-icon-option').evaluate_all("els=>els.map(e=>{const s=getComputedStyle(e);return [s.borderRadius,e.offsetWidth,e.offsetHeight]})");assert all(s==['50%',46,46] for s in shapes),shapes
 rows=['.type-catalog-back','.type-catalog-name-label','.type-catalog-name-input','.type-catalog-icons-label','.type-catalog-icons']
 heights=[root.locator(c).bounding_box()['y'] for c in rows];assert heights==sorted(heights) and len(set(heights))==5,heights
 root.locator('.type-catalog-name-input').fill('自定护理');root.locator('[data-icon-key=paw]').click();root.locator('.type-catalog-save').click();expect(root.locator('.select-trigger')).to_contain_text('自定护理')
 root.locator('.select-trigger').click();root.locator('.type-catalog-manage').click();expect(root.locator('.select-options')).to_be_hidden();expect(root.locator('.type-catalog-row')).to_have_count(5)
 for index in range(4):assert root.locator('.type-catalog-row input[type=checkbox]').nth(index).is_disabled()
 expect(root.locator('.type-catalog-panel>.type-catalog-back')).to_have_count(1);root.locator('.type-catalog-plus').click()
 assert root.locator('.type-catalog-icon-option').first.get_attribute('aria-pressed')=='true';expect(root.locator('.type-catalog-name-input')).to_have_value('')
 for width in [1440,768,390]:
  page.set_viewport_size({'width':width,'height':950});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'add-type-{width}.png'))
 root.locator('.type-catalog-back').click();root.locator('.select-option').filter(has_text='疫苗').click();page.locator('#record-form [name=title]').fill('合成疫苗记录');page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible()
 expect(page.locator('.health-reminders .reminder')).to_have_count(0)
 page.locator('[data-action=new-reminder]').click();page.locator('#record-form [name=title]').fill('合成驱虫计划');page.locator('#record-form [name=dueDate]').fill('2026-11-01');page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('.health-reminders .reminder')).to_have_count(1);expect(page.locator('.health-records .record-card')).to_have_count(1)
 formats=page.locator('.card-entry-action').evaluate_all("els=>els.map(e=>{const s=getComputedStyle(e);return [s.fontSize,s.fontWeight,s.display,s.gap]})");assert len(formats)==3 and all(f==formats[0] for f in formats),formats
 assert not errors,errors
 b.close();print(json.dumps({'fiveRows':True,'iconButtons':True,'inPlaceManage':True,'plusFallback':True,'fileButton':style,'separatePurposes':True,'cardFormats':True,'pageErrors':errors}))
