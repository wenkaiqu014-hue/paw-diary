"""阶段1新管理流程：真实UI、下载、刷新和失败恢复，隔离浏览器数据。"""
from pathlib import Path
from datetime import date, timedelta
import json, os
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4191/')
OUT=Path(os.environ.get('PAW_DIARY_TEST_OUTPUT_DIR',str(Path(__file__).resolve().parents[2]/'test-results'/'stage1-management')))
OUT.mkdir(parents=True,exist_ok=True)
today=date.today().isoformat()
stamp='2026-10-06T00:00:00.000Z'
def pet(i,name):
    return dict(id=i,name=name,type='cat',birthday='2025-01-01',estimatedAgeMonths=None,arrivalDate=None,breed='家猫',sex='暂不确定',image='assets/cat.jpg')
def record(i,pet_id,title,kind='daily',value=None):
    return dict(id=i,petId=pet_id,type=kind,occurredDate=today,value=value,unit='kg' if kind=='weight' else None,title=title,note='管理流程验证',createdAt=stamp,updatedAt=stamp)
def reminder(i,title,status='pending'):
    return dict(id=i,petId='a',title=title,dueDate=(date.today()+timedelta(days=5)).isoformat(),status=status,originRecordId=None,completionRecordId='done-record' if status=='completed' else None,completedAt=stamp if status=='completed' else None)
fixture=dict(version=2,mode='demo',activePetId='a',pets=[pet('a','糯米'),pet('b','豆豆')],records=[record('weight','a','体重记录','weight',4.5),record('keep','a','留存的日常'),record('done-record','a','完成的护理')],reminders=[reminder('todo','待完成护理'),reminder('done','已完成护理','completed'),reminder('cancel','取消的护理','cancelled')],posts=[],profile=dict(city='深圳'))

with sync_playwright() as p:
    browser=p.chromium.launch(headless=os.environ.get('PAW_DIARY_HEADED')!='1',executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ctx=browser.new_context(viewport=dict(width=1440,height=1000),accept_downloads=True)
    page=ctx.new_page();page.set_default_timeout(8000);errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'#health',wait_until='networkidle')
    raw=json.dumps(fixture,ensure_ascii=False)
    page.evaluate("raw=>{localStorage.clear();localStorage.setItem('paw-diary:v2:demo',raw);}",raw)
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('button',name='管理宠物',exact=True)).to_be_visible()
    full=lambda:page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v3:demo'))")
    assert full()['version']==3 and page.evaluate("localStorage.getItem('paw-diary:v2:demo')")==raw
    assert full()['records'][0]['value']==4.5
    entry=lambda i:page.locator(f'.pet-entry[data-id="{i}"]')
    entry('b').get_by_role('button',name='切换到豆豆',exact=True).click()
    assert full()['activePetId']=='b'
    entry('a').get_by_role('button',name='切换到糯米',exact=True).click()
    print('PASS: V2保留原文迁移V3，卡内切换宠物')

    # Move downward through the accessible alternative, then verify actual persisted order.
    entry('a').get_by_role('button',name='下移糯米',exact=True).click()
    assert [x['id'] for x in full()['pets']]==['b','a']
    page.reload(wait_until='networkidle')
    assert page.locator('.pet-entry').first.get_attribute('data-id')=='b'
    page.get_by_role('button',name='管理宠物',exact=True).click()
    page.locator('[name=managed-pet][value="a"]').check()
    assert full()['activePetId']=='a','管理选择不能误切宠物'
    page.get_by_role('button',name='完成',exact=True).click()
    page.get_by_role('button',name='添加宠物',exact=True).click()
    page.locator('[name=name]').fill('第三只')
    page.locator('[name=estimatedAgeMonths]').fill('12')
    page.get_by_role('button',name='保存档案',exact=True).click()
    expect(page.locator('dialog')).not_to_be_visible()
    third=full()['activePetId'];assert third not in ('a','b')
    entry('a').get_by_role('button',name='切换到糯米',exact=True).click()
    print('PASS: 排序刷新保存、管理选择不切换、卡内新增宠物')

    page.get_by_role('button',name='管理与导出',exact=True).click()
    page.locator('[name=managed-reminder][value="todo"]').check()
    with page.expect_download() as dl:
        page.get_by_role('button',name='导出日历',exact=True).click()
    dl.value.save_as(str(OUT/'selected.ics'))
    ics=(OUT/'selected.ics').read_text()
    assert ics.count('BEGIN:VEVENT')==1 and 'UID:todo@paw-diary' in ics and 'UID:done@' not in ics
    page.get_by_role('button',name='已完成',exact=True).click()
    assert page.locator('[name=managed-reminder]:checked').count()==0
    page.locator('[name=managed-reminder][value="done"]').check()
    downloads=[];page.on('download',lambda d:downloads.append(d))
    page.get_by_role('button',name='导出日历',exact=True).click()
    expect(page.locator('#toast')).to_contain_text('待完成')
    assert len(downloads)==0
    print('PASS: 所选pending真实ICS下载，状态切换清空，完成事项不可导出')

    # A saved completed reminder can be deleted/restored without deleting its factual record.
    page.locator('.health-reminders').get_by_role('button',name='移入回收站',exact=True).click()
    page.locator('dialog').get_by_role('button',name='确认移入',exact=True).click()
    assert next(x for x in full()['reminders'] if x['id']=='done')['deletedAt']
    assert next(x for x in full()['records'] if x['id']=='done-record')['deletedAt'] is None
    page.get_by_role('button',name='回收站',exact=True).click()
    trash=lambda kind,i:page.locator(f'.trash-entry[data-kind="{kind}"][data-id="{i}"]')
    trash('reminder','done').get_by_role('button',name='恢复',exact=True).click()
    assert next(x for x in full()['reminders'] if x['id']=='done')['status']=='completed'
    page.get_by_role('button',name='关闭回收站',exact=True).click()

    page.get_by_role('button',name='完成',exact=True).click()
    page.locator('tbody tr').filter(has_text='留存的日常').get_by_role('button',name='移入回收站',exact=True).click()
    page.locator('dialog').get_by_role('button',name='确认移入',exact=True).click()
    assert next(x for x in full()['records'] if x['id']=='keep')['deletedAt']
    page.get_by_role('button',name='管理宠物',exact=True).click()
    page.locator('[name=managed-pet][value="a"]').check()
    page.locator('.health-profile').get_by_role('button',name='移入回收站',exact=True).click()
    page.locator('dialog').get_by_role('button',name='确认移入',exact=True).click()
    assert full()['activePetId']=='b'
    # Restoring just an independently deleted record while its parent is hidden must fail visibly.
    old=OUT/'old-v2.json';old.write_text(raw)
    page.get_by_role('button',name='恢复备份',exact=True).click()
    page.locator('[name=backup]').set_input_files(str(old))
    page.get_by_role('button',name='预览恢复',exact=True).click()
    page.locator('[name=conflict][value="record:keep"]').check()
    hidden_before=full()
    page.get_by_role('button',name='确认恢复',exact=True).click()
    expect(page.locator('.form-error')).to_contain_text('宠物')
    assert full()==hidden_before
    assert page.locator('[name=conflict][value="record:keep"]').is_checked()
    page.once('dialog',lambda d:d.accept())
    page.locator('dialog').get_by_role('button',name='取消',exact=True).click()
    page.get_by_role('button',name='回收站',exact=True).click()
    trash('pet','a').get_by_role('button',name='恢复',exact=True).click()
    assert full()['activePetId']=='b'
    assert next(x for x in full()['records'] if x['id']=='keep')['deletedAt']
    page.get_by_role('button',name='关闭回收站',exact=True).click()
    if page.locator('.health-profile [data-action=finish-pets]').count():page.locator('.health-profile [data-action=finish-pets]').click()
    entry('a').get_by_role('button',name='切换到糯米',exact=True).click()
    expect(page.locator('tbody tr').filter(has_text='留存的日常')).to_have_count(0)
    print('PASS: 提醒恢复保留完成史，宠物恢复保留独立记录删除')

    with page.expect_download() as dl:
        page.get_by_role('button',name='导出备份',exact=True).click()
    dl.value.save_as(str(OUT/'full-v3.json'))
    backup=json.loads((OUT/'full-v3.json').read_text())
    assert backup['version']==3 and next(x for x in backup['records'] if x['id']=='keep')['deletedAt']
    page.get_by_role('button',name='恢复备份',exact=True).click()
    old=OUT/'old-v2.json';old.write_text(raw)
    page.locator('[name=backup]').set_input_files(str(old))
    page.get_by_role('button',name='预览恢复',exact=True).click()
    expect(page.locator('dialog')).to_contain_text('恢复')
    before=full()
    page.get_by_role('button',name='确认恢复',exact=True).click()
    assert next(x for x in full()['records'] if x['id']=='keep')['deletedAt']==next(x for x in before['records'] if x['id']=='keep')['deletedAt']
    print('PASS: 完整V3备份保留回收站，旧V2默认导入不复活已删除记录')

    page.get_by_role('button',name='管理宠物',exact=True).click()
    for checkbox in page.locator('[name=managed-pet]').all():checkbox.check()
    before=page.evaluate("localStorage.getItem('paw-diary:v3:demo')")
    page.locator('.health-profile').get_by_role('button',name='移入回收站',exact=True).click()
    page.evaluate("()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='paw-diary:v3:demo')throw new DOMException('full','QuotaExceededError');return window.savedSetItem.call(this,k,v)};}")
    page.locator('dialog').get_by_role('button',name='确认移入',exact=True).click()
    assert page.evaluate("localStorage.getItem('paw-diary:v3:demo')")==before
    expect(page.locator('dialog')).to_be_visible()
    page.evaluate("()=>{Storage.prototype.setItem=window.savedSetItem;}")
    page.locator('dialog').get_by_role('button',name='确认移入',exact=True).click()
    assert full()['activePetId'] is None
    expect(page.get_by_role('button',name='添加一只宠物',exact=True)).to_be_visible()
    page.get_by_role('button',name='回收站',exact=True).click()
    trash('pet','a').get_by_role('button',name='恢复',exact=True).click()
    assert full()['activePetId']=='a'
    page.get_by_role('button',name='关闭回收站',exact=True).click()
    print('PASS: 批量写失败保留数据/可重试，最后一只真空态可恢复')

    for width in (360,390,768,1440):
        page.set_viewport_size(dict(width=width,height=900))
        page.reload(wait_until='networkidle')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        if width in (390,1440):page.screenshot(path=str(OUT/f'{width}-management.png'),full_page=True)
    assert not errors,errors
    print('PASS: 管理完整流程四宽度无横溢，无JS异常')
    ctx.close();browser.close()
