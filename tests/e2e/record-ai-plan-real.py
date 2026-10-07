"""One actual configured-model request; a future plan saves no occurred record."""
import os,json
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4194/')
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome');page=b.new_page(viewport={'width':390,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL+'#health',wait_until='networkidle');before=page.locator('.health-records tbody tr').count()
 page.locator('[data-action=new-reminder]').click();page.locator('[data-action=record-mode][data-value=ai]').click()
 page.locator('#ai-text').fill('2026年10月20日安排驱虫，名称是合成驱虫计划。');page.locator('#ai-parse').click()
 expect(page.locator('.ai-draft')).to_have_count(1,timeout=40000);dateEdited=not bool(page.locator('.ai-draft [name=dueDate]').input_value())
 if dateEdited:page.locator('.ai-draft [name=dueDate]').fill('2026-10-20')
 expect(page.locator('.ai-draft [name=dueDate]')).to_have_value('2026-10-20')
 page.locator('#ai-confirm').click();expect(page.locator('#dialog')).not_to_be_visible(timeout=15000)
 assert page.locator('.health-records tbody tr').count()==before
 expect(page.locator('.health-reminders')).to_contain_text('合成驱虫计划');assert not errors,errors
 b.close();print(json.dumps({'realModel':True,'futureDueDate':True,'dateEdited':dateEdited,'zeroNewRecord':True,'planSaved':True,'pageErrors':errors}))
