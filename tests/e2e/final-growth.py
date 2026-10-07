"""Plans have explicit destinations; all date inputs retain native semantics; photos rename."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4197/')
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'test-results'/'final-growth';OUT.mkdir(parents=True,exist_ok=True)
def choose(page,selector,text):
 root=page.locator(selector).locator('..');root.locator('.select-trigger').click();root.get_by_role('option',name=text,exact=True).click()
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=False);page=b.new_page(viewport={'width':1440,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL+'#health',wait_until='networkidle');page.locator('[data-action=workspace-local]').first.click()
 choose(page,'#age-method','知道生日');assert page.locator('#pet-form input[type=date]').count()==page.locator('#pet-form .date-input-shell').count()
 page.locator('#pet-form [name=name]').fill('最终合成验收');page.locator('#pet-form [name=birthday]').fill('2025-10-07');page.locator('#pet-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible()
 page.locator('[data-action=new-reminder]').click();choose(page,'#record-type','日常');expect(page.locator('[name=includeInHealth]')).not_to_be_checked()
 page.locator('#record-form [name=dueDate]').fill('2026-11-01');page.locator('#record-form [name=title]').fill('合成游玩计划');page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible()
 expect(page.locator('.health-reminders .reminder')).to_have_count(0);expect(page.locator('.health-timeline')).to_contain_text('合成游玩计划');expect(page.locator('.health-timeline')).to_contain_text('计划 · 未完成');expect(page.locator('.health-records')).to_contain_text('合成游玩计划')
 row=page.locator('.health-records tbody tr').filter(has_text='合成游玩计划');row.locator('[data-action=edit-reminder]').click();expect(page.locator('[name=includeInHealth]')).not_to_be_checked();page.locator('[name=includeInHealth]').check();page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('.health-reminders')).to_contain_text('合成游玩计划')
 page.locator('.health-reminders [data-action=edit-reminder]').click();page.locator('[name=includeInHealth]').uncheck();page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('.health-reminders .reminder')).to_have_count(0)
 page.locator('.health-records tbody tr').filter(has_text='合成游玩计划').locator('[data-action=complete]').click();page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('.health-records tbody tr')).to_have_count(1);expect(page.locator('.health-records .growth-plan-badge')).to_have_count(0)
 page.locator('[data-action=new-reminder]').click();choose(page,'#record-type','疫苗');expect(page.locator('[name=includeInHealth]')).to_be_checked();page.locator('#record-form [name=dueDate]').fill('2026-11-03');page.locator('#record-form [name=title]').fill('合成疫苗计划');page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('.health-reminders .reminder')).to_have_count(1)
 file=page.locator('.paw-photo-upload input[type=file]');file.set_input_files(str(ROOT/'assets/cat.jpg'));page.locator('[name=photo-caption]').fill('原照片说明');page.locator('.paw-photo-upload>button').click();expect(page.locator('.paw-photo-tile')).to_have_count(1,timeout=15000)
 page.locator('.paw-photo-actions').get_by_role('button',name='重命名',exact=True).click();page.locator('.paw-photo-rename-input').fill('合成新照片名');page.locator('.paw-photo-rename').get_by_role('button',name='保存',exact=True).click();expect(page.locator('.paw-photo-caption')).to_have_text('合成新照片名');expect(page.locator('.paw-photo-note')).to_have_text('原照片说明')
 page.reload(wait_until='networkidle');expect(page.locator('.paw-photo-caption')).to_have_text('合成新照片名')
 for width in [1440,768,390]:
  page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  h=page.locator('.paw-photo-field input[type=file],.paw-photo-field textarea').evaluate_all('els=>els.map(e=>e.getBoundingClientRect().height)');assert len(h)==2 and h[0]==h[1],h
  assert page.locator('input[type=date]').count()==page.locator('.date-input-shell').count()
  page.screenshot(path=str(OUT/f'final-{width}.png'),full_page=True)
 assert not errors,errors
 b.close();print(json.dumps({'ordinaryPlanDestination':True,'explicitHealthToggle':True,'completedRecordOnly':True,'vaccineDefault':True,'allDatesEnhanced':True,'photoRenameRefresh':True,'photoBoxesEqual':True,'widths':[1440,768,390],'pageErrors':errors}))
