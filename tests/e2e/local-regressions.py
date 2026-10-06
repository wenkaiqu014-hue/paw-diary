"""阶段1独立审查发现的实际行为回归。"""
from pathlib import Path
from datetime import date,timedelta
import csv,json,os
from playwright.sync_api import sync_playwright,expect

BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4180/')
OUT=Path(os.environ.get('PAW_DIARY_TEST_OUTPUT_DIR', str(Path(__file__).resolve().parents[2]/'test-results'/'stage1')))
OUT.mkdir(parents=True,exist_ok=True)

def care_edit(browser):
    c=browser.new_context(viewport={'width':1440,'height':1000});page=c.new_page()
    try:
        page.goto(BASE+'#health',wait_until='networkidle')
        page.get_by_role('button',name='添加护理事项',exact=True).click()
        page.locator('[name=title]').fill('回归梳毛事项')
        page.locator('[name=dueDate]').fill((date.today()+timedelta(days=5)).isoformat())
        page.get_by_role('button',name='保存事项',exact=True).click()
        page.locator('.reminder').filter(has_text='回归梳毛事项').get_by_role('button',name='记录完成',exact=True).click()
        page.get_by_role('button',name='保存记录',exact=True).click()
        page.get_by_role('button',name='安排下一次',exact=True).click()
        page.locator('[name=dueDate]').fill((date.today()+timedelta(days=10)).isoformat())
        page.get_by_role('button',name='保存事项',exact=True).click()
        before=page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v2:demo')).reminders.find(r=>r.title==='回归梳毛事项'&&r.status==='pending')")
        page.locator('tbody tr').filter(has_text='回归梳毛事项').get_by_role('button',name='编辑',exact=True).click()
        page.locator('[name=note]').fill('只修改这次完成的备注')
        page.get_by_role('button',name='保存记录',exact=True).click()
        expect(page.locator('dialog')).not_to_be_visible()
        after=page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v2:demo')).reminders")
        assert next(r for r in after if r['id']==before['id'])['status']=='pending','修改完成记录备注不应取消下一次护理'
    finally:c.close()

def imported_id(browser):
    c=browser.new_context(viewport={'width':1440,'height':1000});page=c.new_page()
    try:
        page.goto(BASE+'#health',wait_until='networkidle')
        raw=page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v2:demo'))")
        raw['posts'].append({'id':'probe" onclick="window.__pawReviewMarker=1" data-probe="','title':'备份字段安全回归','text':'仅验证属性转义','author':'隔离测试','date':date.today().isoformat(),'image':'','avatar':'','city':'深圳','topic':'今日萌宠','likes':0,'liked':False,'comments':[],'own':True})
        f=OUT/'id-safety.json';f.write_text(json.dumps(raw,ensure_ascii=False))
        page.get_by_role('button',name='恢复备份',exact=True).click();page.locator('[name=backup]').set_input_files(str(f))
        page.get_by_role('button',name='预览恢复',exact=True).click();page.get_by_role('button',name='确认恢复',exact=True).click()
        page.get_by_role('link',name='社区日常',exact=True).click()
        button=page.get_by_role('button',name='点赞 备份字段安全回归',exact=True)
        assert not button.evaluate("e=>e.hasAttribute('onclick')"),'备份ID不能变成可执行HTML属性'
        button.click()
        expect(page.get_by_role('button',name='取消点赞 备份字段安全回归',exact=True)).to_be_visible()
        assert page.evaluate('window.__pawReviewMarker || 0')==0
    finally:c.close()

def invalid_range(browser):
    c=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True);page=c.new_page()
    try:
        page.goto(BASE+'#health',wait_until='networkidle')
        page.locator('#health-from').fill((date.today()-timedelta(days=7)).isoformat())
        page.locator('#health-from').press('Tab')
        visible=page.locator('tbody tr').count();assert visible>0
        page.locator('#health-to').fill((date.today()-timedelta(days=30)).isoformat())
        page.locator('#health-to').press('Tab')
        with page.expect_download() as info:page.get_by_role('button',name='导出 CSV',exact=True).click()
        f=OUT/'range-check.csv';info.value.save_as(str(f))
        with f.open(encoding='utf-8-sig',newline='') as stream:exported=list(csv.DictReader(stream))
        assert len(exported)==visible,'无效日期不能让显示记录与CSV导出条数不一致'
    finally:c.close()

with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    failures=[]
    for fn in (care_edit,imported_id,invalid_range):
        try:fn(b);print('PASS:',fn.__name__,flush=True)
        except Exception as e:failures.append(fn.__name__+': '+str(e));print('FAIL:',failures[-1],flush=True)
    b.close()
    assert not failures,'\n'.join(failures)
