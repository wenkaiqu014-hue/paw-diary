"""Actual local workspace, type creation, record attachments and independent care plans."""
import os,json,hashlib,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4194/')
OUT=Path(__file__).resolve().parents[2]/'test-results'/'record-refinement';OUT.mkdir(parents=True,exist_ok=True)
pdf=b'%PDF-1.4\n% synthetic Paw Diary acceptance file\n1 0 obj\n<<>>\nendobj\n%%EOF\n'
def choose(page,selector,label):
 root=page.locator(selector).locator('..');root.locator('.select-trigger').click();root.get_by_role('option',name=label,exact=True).click()
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=False)
 page=b.new_page(viewport={'width':1440,'height':1000},accept_downloads=True);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL+'#health',wait_until='networkidle');page.locator('[data-action=workspace-local]').first.click()
 page.locator('#pet-form [name=name]').fill('合成主线宠物');page.locator('#pet-form [name=estimatedAgeMonths]').fill('12');page.locator('#pet-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible()
 page.locator('main [data-action=record]').first.click();page.locator('#record-form [name=title]').fill('合成陪伴记录')
 typeRoot=page.locator('#record-type').locator('..');typeRoot.locator('.select-trigger').click();typeRoot.locator('.type-catalog-add').click();typeRoot.locator('[name=catalog-name]').fill('陪伴护理');typeRoot.locator('.type-catalog-save').click()
 expect(typeRoot.locator('.select-trigger')).to_contain_text('陪伴护理');assert page.locator('#record-type').input_value().startswith('custom:')
 page.locator('[data-attachment-input]').set_input_files({'name':'synthetic-proof.pdf','mimeType':'application/pdf','buffer':pdf});expect(page.locator('[data-attachment-items]')).to_contain_text('synthetic-proof.pdf')
 page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('.health-records tbody tr')).to_have_count(1)
 page.reload(wait_until='networkidle');row=page.locator('.health-records tbody tr').filter(has_text='合成陪伴记录');row.locator('[data-action=edit-record]').click()
 expect(page.locator('[data-attachment-download]')).to_have_count(1)
 with page.expect_download() as event:page.locator('[data-attachment-download]').click()
 data=Path(event.value.path()).read_bytes();assert hashlib.sha256(data).digest()==hashlib.sha256(pdf).digest()
 page.once('dialog',lambda d:d.accept());page.locator('[data-attachment-remove]').click();expect(page.locator('[data-attachment-download]')).to_have_count(0)
 page.locator('#record-form [name=note]').fill('删除附件后仍可保存');page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('.health-records tbody tr')).to_have_count(1)
 page.locator('[data-action=new-reminder]').first.click();page.locator('#record-form [name=title]').fill('合成未来驱虫');page.locator('#record-form [name=dueDate]').fill('2026-10-20');page.locator('#record-form [name=note]').fill('原计划备注')
 page.locator('[data-attachment-input]').set_input_files({'name':'synthetic-plan.pdf','mimeType':'application/pdf','buffer':pdf});expect(page.locator('[data-attachment-items]')).to_contain_text('synthetic-plan.pdf')
 page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('.health-records tbody tr')).to_have_count(1);expect(page.locator('.health-reminders .reminder')).to_have_count(1)
 page.locator('.health-reminders [data-action=complete]').click();expect(page.locator('#record-type')).to_have_value('deworm');expect(page.locator('#record-form [name=note]')).to_have_value('原计划备注')
 expect(page.locator('[data-original-plan-attachments]')).to_contain_text('synthetic-plan.pdf')
 page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('.health-records tbody tr')).to_have_count(2);expect(page.locator('.health-reminders .reminder')).to_have_count(0)
 page.locator('main [data-action=record]').first.click();page.locator('#record-form [name=note]').fill('双语原文保留');choose(page,'#dialog-locale-select','English')
 expect(page.locator('#record-form [name=note]')).to_have_value('双语原文保留');expect(page.locator('#record-form')).to_contain_text('Event date')
 for width in [1440,768,390]:
  page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'workflow-{width}.png'))
 assert not errors,errors
 b.close();print(json.dumps({'catalog_saved':True,'fileHash':True,'delete_then_save':True,'plan_not_record':True,'completion_type_note':True,'widths':[1440,768,390],'pageErrors':errors}))
