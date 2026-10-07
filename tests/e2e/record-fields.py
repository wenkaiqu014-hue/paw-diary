"""Shared manual and AI review fields: real DOM transition and isolation checks."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
source=Path('src/domain/health-plans.js').read_text()+Path('src/ui/record-fields.js').read_text().replace("import {defaultPlanHealth} from '../domain/health-plans.js';",'')+Path('src/ui/record-dialog.js').read_text().replace("import {isHealthTodo} from '../domain/health-plans.js';",'').replace("import {mountRecordFields} from './record-fields.js';",'')
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=False)
    page=browser.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('<div id="manual"></div><form><div id="ai" class="form-grid"></div></form>')
    page.add_script_tag(type='module',content=source+'''
window.locale='zh-CN';window.entries=[{id:'weight',type:'weight',builtin:true,name:'体重'},{id:'vaccine',type:'vaccine',builtin:true,name:'疫苗'},{id:'deworm',type:'deworm',builtin:true,name:'驱虫'},{id:'daily',type:'daily',builtin:true,name:'日常'},{id:'custom:test',type:'other',builtin:false,name:'护理'}];
const common={getLocale:()=>window.locale,getEntries:()=>window.entries,today:'2026-10-07'};
window.manual=mountRecordDialog({...common,host:document.querySelector('#manual'),petId:'a',type:'weight'});
window.ai=mountRecordFields({...common,root:document.querySelector('#ai'),idPrefix:'ai-row-1',showPet:true,pets:[{id:'a',name:'猫'},{id:'b',name:'狗'}],values:{purpose:'record',type:'daily',petId:'b',date:'',title:'原始标题'}});window.ready=true;
''')
    page.wait_for_function('window.ready')
    expect(page.locator('#record-form [name=title]')).to_have_value('')
    page.locator('#record-form [name=title]').fill('用户标题')
    page.locator('#record-form [name=value]').fill('4.6')
    page.locator('#record-purpose').select_option('plan')
    expect(page.locator('#record-form [name=value]')).to_be_hidden()
    expect(page.locator('#record-form [name=includeInHealth]')).not_to_be_checked()
    page.locator('#record-type').select_option('vaccine')
    expect(page.locator('#record-form [name=includeInHealth]')).to_be_checked()
    page.locator('#record-form [name=includeInHealth]').uncheck()
    page.locator('#record-type').select_option('deworm')
    expect(page.locator('#record-form [name=includeInHealth]')).not_to_be_checked()
    expect(page.locator('#ai [name=type]')).to_have_value('daily')
    expect(page.locator('#ai [name=petId]')).to_have_value('b')
    expect(page.locator('#ai [name=date]')).to_have_value('')
    page.locator('#record-type').select_option('weight')
    page.locator('#record-purpose').select_option('record')
    expect(page.locator('#record-form [name=value]')).to_have_value('4.6')
    expect(page.locator('#record-form [name=title]')).to_have_value('用户标题')
    expect(page.locator('#record-form [name=includeInHealth]')).to_be_hidden()
    page.evaluate("window.ai.setValues({purpose:'plan',type:'unknown',dueDate:'2026-10-09'})")
    expect(page.locator('#ai [name=type]')).to_have_value('')
    assert page.evaluate('window.ai.read().type')==''
    page.locator('#ai [name=type]').select_option('custom:test')
    expect(page.locator('#ai [name=includeInHealth]')).not_to_be_checked()
    page.evaluate("window.locale='en';window.manual.refreshLocale();window.ai.refreshLocale()")
    expect(page.locator('#ai [data-record-copy=purpose]')).to_have_text('Purpose')
    expect(page.locator('#ai [name=title]')).to_have_value('原始标题')
    expect(page.locator('#ai [name=dueDate]')).to_have_value('2026-10-09')
    expect(page.locator('#record-form [name=title]')).to_have_value('用户标题')
    expect(page.locator('#record-form [name=value]')).to_have_value('4.6')
    assert not errors,errors
    browser.close()
print('PASS shared fields: manual/AI purpose parity, user health choice, unknown type, dates, weight title, locale values, independent pet and IDs')
