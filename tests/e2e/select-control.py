from pathlib import Path
from playwright.sync_api import sync_playwright
code=Path('src/ui/select-control.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True)
    page=browser.new_page()
    page.set_content('<form><label>记录类型<select name="type"><option value="weight" data-icon="weight">体重</option><option value="vaccine" disabled>疫苗</option><option value="daily" data-icon="camera">日常</option></select></label><button type="button" id="outside">外部</button></form>')
    page.add_script_tag(type='module',content=code+'\nwindow.control=enhanceSelect(document.querySelector("select"),{icons:key=>`<svg data-icon="${key}"></svg>`,footer:Object.assign(document.createElement("button"),{type:"button",textContent:"管理"}),onChange:value=>window.changed=value});window.ready=true;')
    page.wait_for_function('window.ready===true')
    assert page.locator('[role=combobox]').inner_text()=='体重'
    assert page.locator('[role=combobox] svg[data-icon=weight]').count()==1
    page.locator('[role=combobox]').focus()
    page.keyboard.press('ArrowDown');page.keyboard.press('Enter')
    assert page.evaluate('document.querySelector("select").value')=='daily'
    assert page.evaluate('new FormData(document.querySelector("form")).get("type")')=='daily'
    assert page.evaluate('window.changed')=='daily'
    page.locator('[role=combobox]').click()
    page.locator('[role=combobox]').focus();page.keyboard.press('Tab')
    assert page.locator('[role=combobox]').get_attribute('aria-expanded')=='true','Tab must retain a footer until focus actually exits the control'
    assert page.evaluate('document.activeElement.textContent')=='管理','Footer actions must be keyboard reachable'
    page.evaluate('window.outerEsc=0;document.addEventListener("keydown",event=>{if(event.key==="Escape")window.outerEsc++})')
    page.keyboard.press('Escape')
    assert page.locator('[role=combobox]').get_attribute('aria-expanded')=='false'
    assert page.evaluate('window.outerEsc')==0,'Escape in footer must not reach the outer dialog'
    page.locator('[role=combobox]').click()
    page.get_by_role('button',name='管理',exact=True).click()
    assert page.locator('[role=combobox]').get_attribute('aria-expanded')=='true'
    page.locator('[role=combobox]').focus();page.keyboard.press('Escape')
    assert page.locator('[role=combobox]').get_attribute('aria-expanded')=='false'
    page.evaluate('window.control.setOptions([{value:"book",label:"护理",iconKey:"book"},{value:"drop",label:"复查",iconKey:"drop"}]);window.control.setValue("drop")')
    assert page.locator('[role=combobox]').inner_text()=='复查'
    page.locator('[role=combobox]').click();page.locator('#outside').click()
    assert page.locator('[role=combobox]').get_attribute('aria-expanded')=='false'
    page.evaluate('window.control.destroy()')
    assert page.locator('[role=combobox]').count()==0
    assert page.locator('select').is_visible()
    browser.close()
print('shared selector real DOM PASS: keyboard, disabled skip, icons, native FormData/change, footer, Escape, outside click, options refresh, destroy')
