"""实际验收反馈：图表回到第二排、同排卡片等高、全部记录置后。"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4178/')
OUT=Path(__file__).resolve().parents[2]/'test-results'/'stage1-layout'
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    page=b.new_page(viewport={'width':1440,'height':1000});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    for width in (1440,390,768,360):
        page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844})
        page.goto(BASE+'#health',wait_until='networkidle')
        expect(page.get_by_role('heading',name='体重趋势',exact=True)).to_be_visible()
        rect=lambda cls:page.locator(cls).evaluate('(e)=>{const r=e.getBoundingClientRect();return {top:r.top,height:r.height};}')
        profile,reminders,chart,timeline,records=[rect('.'+c) for c in ('health-profile','health-reminders','health-chart','health-timeline','health-records')]
        assert chart['top']<records['top'] and timeline['top']<records['top'],'图表与足迹应在完整记录之前'
        if width==1440:
            assert abs(profile['height']-reminders['height'])<1,'第一排档案与待办应等高'
            assert abs(chart['height']-timeline['height'])<1,'第二排趋势与足迹应等高'
            assert chart['top']<1000,'正常待办时图表应在第二排，不被长记录表挤到屏外'
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        if width in (1440,390):page.screenshot(path=str(OUT/f'{width}-health.png'),full_page=True)
    raw=page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v2:demo'))")
    raw['reminders'] += [{'id':f'layout-{i}','petId':raw['activePetId'],'title':f'完整护理事项{i}','dueDate':'2026-10-08','status':'pending','originRecordId':None,'completionRecordId':None,'completedAt':None} for i in range(10)]
    page.evaluate("raw=>localStorage.setItem('paw-diary:v2:demo',JSON.stringify(raw))",raw)
    page.set_viewport_size({'width':1440,'height':1000});page.reload(wait_until='networkidle')
    expect(page.locator('.reminder')).to_have_count(len(raw['reminders']))
    last=page.locator('.reminder').filter(has_text='完整护理事项9').get_by_role('button',name='记录完成',exact=True)
    last.scroll_into_view_if_needed();expect(last).to_be_visible()
    assert rect('.health-chart')['top']<1000,'大量待办不能把统计图挤到页底'
    expect(page.get_by_role('button',name='导出日历',exact=True)).to_be_visible()
    assert not errors,errors
    print('PASS: restored chart order, equal desktop rows, four widths, full scrollable reminders and export')
    b.close()
