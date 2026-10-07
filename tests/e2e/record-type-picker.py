from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import re
modules=['src/domain/record-type-catalog.js','src/ui/select-control.js','src/ui/record-type-picker.js']
code='\n'.join(re.sub(r'^import[^\n]+\n','',Path(path).read_text(),flags=re.M) for path in modules)
setup='''
window.state={profile:{city:'深圳'},records:[],reminders:[]};window.writes=0;let generated=0;
window.repo={snapshot:()=>structuredClone(window.state),getRevision:()=>window.writes,manageRecordTypes:async(command,options)=>{window.state=applyRecordTypeCommand(window.state,command,{idFactory:()=>String(++generated),now:'2026-10-07T01:00:00.000Z'});window.writes++;return window.state.profile.recordTypeCatalog;}};
window.picker=enhanceRecordTypeSelect(document.querySelector('select'),{getSnapshot:()=>window.state,getRepository:()=>window.repo,icons:key=>`<svg data-icon="${key}"></svg>`,onUpdated:state=>{window.state=state;}});await window.picker.ready;document.querySelector('select').addEventListener('change',()=>window.changedType=document.querySelector('select').value);window.ready=true;
'''
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=True)
 page=b.new_page();page.set_content('<form><input name="record-title" value="原有未保存内容"><select name="type"><option value="daily">日常</option></select></form>')
 page.add_script_tag(type='module',content=code+'\n'+setup);page.wait_for_function('window.ready')
 assert page.locator('select option').count()==4
 assert page.locator('select option[value="other"]').count()==0
 for index in range(3):
  page.locator('[role=combobox]').click();page.get_by_role('button',name='新增',exact=True).click()
  assert page.locator('.select-options').is_hidden(),'Add replaces the standard options'
  assert page.locator('.type-catalog-icon-option input').count()==0,'Icon choices are icon-only buttons'
  assert page.locator('.type-catalog-icon-option[aria-pressed="true"]').get_attribute('data-icon-key')=='book'
  assert page.locator('.type-catalog-icon-option').all_inner_texts()==['','','']
  assert page.evaluate('[...document.querySelector(".type-catalog-add-panel").children].slice(0,5).map(x=>x.className).join("|").includes("type-catalog-back|type-catalog-name-label|type-catalog-name-input|type-catalog-icons-label|type-catalog-icons")')
  if index==0:
   page.locator('.type-catalog-icon-option').first.focus();page.keyboard.press('ArrowRight')
   assert page.locator('.type-catalog-icon-option[aria-pressed="true"]').get_attribute('data-icon-key')=='paw'
   page.get_by_role('button',name='返回',exact=True).click();page.get_by_role('button',name='新增',exact=True).click()
   assert page.locator('.type-catalog-icon-option[aria-pressed="true"]').get_attribute('data-icon-key')=='book','Entering Add always resets to the first icon'
  page.locator('input[name="catalog-name"]').fill('护理'+str(index));page.get_by_role('button',name='保存类型',exact=True).click()
  page.wait_for_function('(n)=>window.writes===n',arg=index+1)
  expect(page.locator('[role=combobox]')).to_have_attribute('aria-expanded','false')
 page.locator('[role=combobox]').click()
 assert page.get_by_role('button',name='新增',exact=True).is_disabled()
 assert '最多添加3个' in page.locator('.type-catalog-hint').inner_text()
 page.get_by_role('button',name='管理',exact=True).click()
 assert page.locator('.select-options').is_hidden(),'Manage replaces the standard options'
 assert page.locator('.type-catalog-remove').count()==0,'Delete is only shown for a checked row'
 assert page.locator('.type-catalog-plus').count()==1
 checkboxes=page.locator('.type-catalog-row input[type="checkbox"]')
 assert checkboxes.count()==7
 for index in range(4):assert checkboxes.nth(index).is_disabled()
 checkboxes.nth(4).check();page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='删除',exact=True).click();page.wait_for_function('window.writes===4')
 assert page.locator('.type-catalog-row').count()==6
 page.locator('.type-catalog-handle').last.focus();page.keyboard.press('ArrowUp');page.wait_for_function('window.writes===5')
 page.get_by_role('button',name='返回',exact=True).click();assert page.get_by_role('button',name='新增',exact=True).is_enabled()
 assert page.locator('input[name="record-title"]').input_value()=='原有未保存内容'
 page.get_by_role('button',name='管理',exact=True).click()
 page.evaluate('window.picker.setValue([...document.querySelectorAll(".type-catalog-row")].at(-1).dataset.typeId);window.changedType=document.querySelector("select").value')
 page.locator('.type-catalog-row input[type="checkbox"]').last.check();page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='删除',exact=True).click();page.wait_for_function('window.writes===6')
 assert page.evaluate('window.changedType===document.querySelector("select").value'),'deleted current choice must dispatch change for dependent fields'
 page.get_by_role('button',name='返回',exact=True).click()
 page.evaluate('document.querySelector("select").__historicalRecord={type:"other",customTypeId:"custom:1",typeLabel:"护理0",iconKey:"book"};window.picker.refreshCatalog()')
 page.wait_for_function('document.querySelector("select").options.length===6')
 assert page.locator('select option[value="custom:1"]').inner_text()=='护理0'
 assert page.evaluate('window.state.profile.recordTypeCatalog.custom.filter(x=>!x.deletedAt).every(x=>x.iconKey==="book")')
 b.close()
print('record catalog real DOM PASS: 4 built-ins, 3 reused icons, disabled max hint, immutable builtin deletion, custom delete frees slot, keyboard persisted sorting, historic option, unsaved parent fields')
