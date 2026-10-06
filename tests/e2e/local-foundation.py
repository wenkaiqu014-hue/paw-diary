"""阶段1浏览器行为回归，只操作隔离的localStorage。"""
from pathlib import Path
from datetime import date, timedelta
import json
import os
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4180/')
OUT=Path(os.environ.get('PAW_DIARY_TEST_OUTPUT_DIR', str(Path(__file__).resolve().parents[2]/'test-results'/'stage1')))
OUT.mkdir(parents=True,exist_ok=True)
today=date.today().isoformat()
next_date=(date.today()+timedelta(days=6)).isoformat()
v1={'version':1,'city':'深圳','activePet':'mine','pets':[{'id':'mine','name':'我的小猫','type':'cat','breed':'家猫','sex':'暂不确定','birthday':'2025-01-01','arrival':'2025-02-01','image':'assets/cat.jpg'}],
    'records':[{'id':'old','petId':'mine','type':'weight','date':'2026-10-01','value':4.5,'note':'这是旧版本真实自建记录','createdAt':1}], 'posts':[]}

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE,wait_until='networkidle')
    page.evaluate("raw=>{localStorage.clear();localStorage.setItem('paw-diary:v1',raw);}",json.dumps(v1,ensure_ascii=False))
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading',name='你好呀，我的小猫。')).to_be_visible()
    migrated=page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v2:demo'))")
    assert migrated and migrated['version']==2,'v1记录尚未非破坏迁移到v2'
    assert migrated['records'][0]['id']=='old' and migrated['records'][0]['value']==4.5
    assert page.evaluate("localStorage.getItem('paw-diary:v1')===localStorage.getItem('paw-diary:v1:backup')")
    print('PASS: v1原始键/迁移前备份保留，多宠资料迁移')

    page.get_by_role('link',name='健康档案',exact=True).click()
    row=page.locator('tbody tr').filter(has_text='这是旧版本真实自建记录')
    row.get_by_role('button',name='编辑',exact=True).click()
    page.locator('[name=value]').fill('4.8')
    page.get_by_role('button',name='保存记录',exact=True).click()
    expect(row).to_contain_text('4.8')
    page.reload(wait_until='networkidle')
    assert page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v2:demo')).records.filter(r=>r.id==='old').length")==1
    page.locator('.skip-link').focus(); page.keyboard.press('Enter')
    expect(page.locator('#page-label')).to_have_text('健康档案')
    assert page.evaluate('document.activeElement.id')=='main'
    page.get_by_role('button',name='体重',exact=True).click()
    assert page.evaluate("document.activeElement.dataset.action")=='health-filter'
    print('PASS: 编辑保留id、刷新保存、skip保持路由、筛选焦点')

    for i in range(6):
        page.get_by_role('button',name='添加护理事项',exact=True).click()
        page.locator('[name=title]').fill(f'独立护理事项{i}')
        page.locator('[name=dueDate]').fill(next_date)
        page.get_by_role('button',name='保存事项',exact=True).click()
        expect(page.locator('dialog')).not_to_be_visible()
    expect(page.locator('.reminder')).to_have_count(6)
    item=page.locator('.reminder').filter(has_text='独立护理事项0')
    item.get_by_role('button',name='修改日期',exact=True).click()
    page.locator('[name=dueDate]').fill((date.today()+timedelta(days=7)).isoformat())
    page.get_by_role('button',name='保存事项',exact=True).click()
    item.get_by_role('button',name='记录完成',exact=True).click()
    page.get_by_role('button',name='保存记录',exact=True).click()
    page.get_by_role('button',name='暂不安排',exact=True).click()
    expect(page.locator('.reminder')).to_have_count(5)
    assert page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v2:demo')).records.filter(r=>r.title==='独立护理事项0').length")==1
    page.locator('.reminder').filter(has_text='独立护理事项1').get_by_role('button',name='取消事项',exact=True).click()
    page.get_by_role('button',name='确认取消',exact=True).click()
    expect(page.locator('.reminder')).to_have_count(4)
    print('PASS: 完整独立待办、改期、关联完成、取消')

    page.get_by_role('button',name='导出备份',exact=True).click()
    # Direct buttons use the same backup entry; downloads are user-triggered only.
    page.get_by_role('button',name='恢复备份',exact=True).click()
    before=page.evaluate("localStorage.getItem('paw-diary:v2:demo')")
    incoming=json.loads(before); incoming['records'].append({'id':'import-new','petId':'mine','type':'daily','occurredDate':today,'value':None,'unit':None,'title':'备份新增瞬间','note':'恢复验证','createdAt':'2026-10-06T00:00:00.000Z','updatedAt':'2026-10-06T00:00:00.000Z'})
    backup_file=OUT/'import.json';backup_file.write_text(json.dumps(incoming,ensure_ascii=False))
    page.locator('[name=backup]').set_input_files(str(backup_file))
    page.get_by_role('button',name='预览恢复',exact=True).click()
    expect(page.get_by_text('恢复前请核对',exact=True)).to_be_visible()
    assert page.evaluate("localStorage.getItem('paw-diary:v2:demo')")==before
    page.get_by_role('button',name='确认恢复',exact=True).click()
    assert page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v2:demo')).records.filter(r=>r.id==='import-new').length")==1
    page.get_by_role('button',name='恢复备份',exact=True).click()
    page.locator('[name=backup]').set_input_files(str(backup_file))
    page.get_by_role('button',name='预览恢复',exact=True).click()
    page.get_by_role('button',name='确认恢复',exact=True).click()
    assert page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v2:demo')).records.filter(r=>r.id==='import-new').length")==1
    with page.expect_download() as info:
        page.get_by_role('button',name='导出 CSV',exact=True).click()
    info.value.save_as(str(OUT/'records.csv'))
    with page.expect_download() as info:
        page.get_by_role('button',name='导出日历',exact=True).click()
    info.value.save_as(str(OUT/'care.ics'))
    assert 'DTSTART;VALUE=DATE:' in (OUT/'care.ics').read_text()
    print('PASS: 恢复先预览后保存、重复恢复不复制、CSV/ICS实际下载')

    page.get_by_role('button',name='添加记录',exact=True).click()
    page.locator('[name=value]').fill('4.9');page.locator('[name=note]').fill('保留输入的验证')
    page.evaluate("()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};}")
    page.get_by_role('button',name='保存记录',exact=True).click()
    expect(page.locator('.form-error')).to_contain_text('保存')
    expect(page.locator('dialog')).to_be_visible()
    assert page.locator('[name=note]').input_value()=='保留输入的验证'
    page.evaluate("()=>{Storage.prototype.setItem=window.originalSetItem;}")
    page.get_by_role('button',name='保存记录',exact=True).click()
    expect(page.locator('dialog')).not_to_be_visible()
    print('PASS: 保存失败不关闭/不丢输入，恢复后重试成功')

    for width in (360,390,768,1440):
        page.set_viewport_size({'width':width,'height':900})
        for route in ('home','health','nearby','community'):
            page.goto(BASE+'#'+route,wait_until='networkidle')
            expect(page.locator('h1')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route)
            if width in (390,1440):page.screenshot(path=str(OUT/f'{width}-{route}.png'),full_page=True)
    assert not errors,errors
    print('PASS: 四宽度四页无横溢，无JS运行异常')

    bad=browser.new_context();bad_page=bad.new_page()
    bad_page.goto(BASE,wait_until='networkidle')
    bad_page.evaluate("()=>{localStorage.clear();localStorage.setItem('paw-diary:v1','{broken');}")
    bad_page.reload(wait_until='networkidle')
    expect(bad_page.get_by_role('heading',name='暂时无法读取档案',exact=True)).to_be_visible()
    assert bad_page.evaluate("localStorage.getItem('paw-diary:v1')")=='{broken'
    assert bad_page.evaluate("localStorage.getItem('paw-diary:v2:demo')") is None
    with bad_page.expect_download() as info:
        bad_page.get_by_role('button',name='导出原始数据',exact=True).click()
    info.value.save_as(str(OUT/'broken-original.txt'))
    assert (OUT/'broken-original.txt').read_text()=='{broken'
    bad_page.get_by_role('button',name='恢复备份',exact=True).click()
    bad_page.locator('[name=backup]').set_input_files(str(backup_file))
    bad_page.get_by_role('button',name='预览恢复',exact=True).click()
    bad_page.get_by_role('button',name='确认恢复',exact=True).click()
    expect(bad_page.get_by_role('heading',name='你好呀，我的小猫。')).to_be_visible()
    assert bad_page.evaluate("localStorage.getItem('paw-diary:v1')")=='{broken'
    assert bad_page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('paw-diary:recovery-backup:')).length")>=1
    print('PASS: 损坏读取不种示例、不覆盖原始数据，原始数据可导出')
    bad.close();context.close();browser.close()
