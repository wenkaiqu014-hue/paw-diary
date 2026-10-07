"""Real app: independent purposes, mode preservation, and unchanged language selection."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4194/')
OUT=Path(__file__).resolve().parents[2]/'test-results'/'record-refinement';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=False)
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL+'#health',wait_until='networkidle')
 topLocale=page.locator('#locale-select').locator('..');topLocale.locator('.select-trigger').click();topLocale.get_by_role('option',name='English',exact=True).click()
 page.locator('main [data-action=record]').first.click()
 expect(page.locator('#dialog-locale-select').locator('..').locator('.select-value')).to_have_text('English')
 expect(page.locator('#record-type')).to_have_value('daily')
 expect(page.locator('[name=joinTodo]')).not_to_be_checked()
 assert page.evaluate('document.activeElement.id')=='dialog-title'
 page.locator('#record-form [name=title]').fill('合成日常')
 page.locator('#record-form [name=note]').fill('模式切换保留此原文')
 page.locator('[data-action=record-mode][data-value=ai]').click()
 expect(page.locator('#ai-entry-form')).to_be_visible()
 page.locator('#ai-text').fill('合成AI文字，无需调用模型')
 page.locator('[data-action=record-mode][data-value=manual]').click()
 locale=page.locator('#dialog-locale-select').locator('..');locale.locator('.select-trigger').click();locale.get_by_role('option',name='English',exact=True).click()
 expect(page.locator('#record-form')).to_contain_text('Event date')
 expect(page.locator('[data-action=record-mode][data-value=manual]')).to_contain_text('Manual entry')
 expect(page.locator('#record-form [name=note]')).to_have_value('模式切换保留此原文')
 expect(page.locator('#locale-select').locator('..').locator('.select-value')).to_have_text('English')
 expect(page.locator('#record-form [name=title]')).to_have_value('合成日常')
 expect(page.locator('#record-form [name=note]')).to_have_value('模式切换保留此原文')
 page.locator('[data-action=record-mode][data-value=ai]').click()
 expect(page.locator('#ai-text')).to_have_value('合成AI文字，无需调用模型')
 page.locator('[data-action=record-mode][data-value=manual]').click()
 page.screenshot(path=str(OUT/'record-desktop.png'))
 page.once('dialog',lambda d:d.accept());page.locator('#close-dialog').click()
 page.locator('[data-action=new-reminder]').first.click()
 expect(page.locator('#record-purpose')).to_have_value('plan')
 expect(page.locator('#record-type')).to_have_value('deworm')
 expect(page.locator('#record-form [name=date]')).to_be_hidden()
 expect(page.locator('#record-form [name=dueDate]')).to_be_visible()
 assert not errors,errors
 b.close();print(json.dumps({'mode_preserved':True,'plan_fields':True,'focus_title':True,'pageErrors':errors}))
