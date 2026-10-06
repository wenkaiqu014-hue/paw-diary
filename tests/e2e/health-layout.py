"""实际验收反馈：图表回到第二排，切换待办状态不引起桌面卡片跳动。"""
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
    for width in (1440,1024,1920,390,768,360):
        page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844})
        page.goto(BASE+'#health',wait_until='networkidle')
        expect(page.get_by_role('heading',name='体重趋势',exact=True)).to_be_visible()
        rect=lambda cls:page.locator(cls).evaluate('(e)=>{const r=e.getBoundingClientRect();return {top:r.top,height:r.height};}')
        profile,reminders,chart,timeline,records=[rect('.'+c) for c in ('health-profile','health-reminders','health-chart','health-timeline','health-records')]
        assert chart['top']<records['top'] and timeline['top']<records['top'],'图表与足迹应在完整记录之前'
        if width>850:
            assert abs(profile['height']-reminders['height'])<1,'第一排档案与待办应等高'
            assert abs(chart['height']-timeline['height'])<1,'第二排趋势与足迹应等高'
            assert chart['top']<1000,'正常待办时图表应在第二排，不被长记录表挤到屏外'
            assert page.locator('.health-profile').evaluate('''e=>{
                const title=e.querySelector('.panel-title').getBoundingClientRect();
                return e.querySelector('.pet-profile').getBoundingClientRect().top-title.bottom<40;
            }'''),'宠物条目应跟随标题靠上排列，不能在大块空白中纵向居中'
            for label in ('已完成','已取消','全部事项','待完成'):
                page.get_by_role('button',name=label,exact=True).click()
                page.wait_for_timeout(400)
                assert abs(rect('.health-reminders')['height']-reminders['height'])<1,f'{width}px下切换{label}不能改变待办卡高度'
                assert abs(rect('.health-chart')['top']-chart['top'])<1,f'{width}px下切换{label}不能移动图表'
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        if width in (1440,390):page.screenshot(path=str(OUT/f'{width}-health.png'),full_page=True)
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto(BASE+'#health',wait_until='networkidle')
    baseline={c:rect('.'+c) for c in ('health-profile','health-reminders','health-chart')}
    states={}
    for label in ('待完成','已完成','已取消','全部事项'):
        page.get_by_role('button',name=label,exact=True).click()
        page.wait_for_timeout(400)
        states[label]={c:rect('.'+c) for c in baseline}
        page.screenshot(path=str(OUT/f'1440-state-{label}.png'),full_page=True)
    print('Desktop state measurements:',states,flush=True)
    for label,measured in states.items():
        for card in ('health-profile','health-reminders'):
            assert abs(measured[card]['height']-baseline[card]['height'])<1,f'{label}不能改变{card}高度：{measured[card]}，基准{baseline[card]}'
        assert abs(measured['health-chart']['top']-baseline['health-chart']['top'])<1,f'{label}不能移动第二排图表'
    page.get_by_role('button',name='待完成',exact=True).click()
    raw=page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v2:demo'))")
    raw['reminders'] += [{'id':f'layout-{i}','petId':raw['activePetId'],'title':f'完整护理事项{i}','dueDate':'2026-10-08','status':'pending','originRecordId':None,'completionRecordId':None,'completedAt':None} for i in range(10)]
    page.evaluate("raw=>localStorage.setItem('paw-diary:v2:demo',JSON.stringify(raw))",raw)
    page.set_viewport_size({'width':1440,'height':1000});page.reload(wait_until='networkidle')
    expect(page.locator('.reminder')).to_have_count(len(raw['reminders']))
    last=page.locator('.reminder').filter(has_text='完整护理事项9').get_by_role('button',name='记录完成',exact=True)
    last.scroll_into_view_if_needed();expect(last).to_be_visible()
    assert rect('.health-chart')['top']<1000,'大量待办不能把统计图挤到页底'
    expect(page.get_by_role('button',name='导出日历',exact=True)).to_be_visible()
    assert abs(rect('.health-reminders')['height']-baseline['health-reminders']['height'])<1,'长待办应在列表内部滚动，不能增高桌面卡片'
    list_box=page.locator('.reminder-full')
    assert list_box.evaluate('(e)=>e.scrollHeight>e.clientHeight'),'大量待办必须可在列表内滚动'
    # 放大文字后，档案、列表和导出仍可达；此检查模拟文字放大，不冒充原生浏览器缩放。
    for width in (1440,390):
        page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844})
        page.reload(wait_until='networkidle')
        page.evaluate('''() => {
            const sizes=[...document.querySelectorAll('body, body *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);
            for(const [e,size] of sizes)e.style.fontSize=(size*2)+'px';
        }''')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'200%文字不得引起整页横向溢出'
        page.get_by_role('button',name='管理我的宠物',exact=True).scroll_into_view_if_needed()
        expect(page.get_by_role('button',name='管理我的宠物',exact=True)).to_be_visible()
        last=page.locator('.reminder').filter(has_text='完整护理事项9').get_by_role('button',name='记录完成',exact=True)
        last.scroll_into_view_if_needed();expect(last).to_be_visible()
        export=page.get_by_role('button',name='导出日历',exact=True)
        export.scroll_into_view_if_needed();expect(export).to_be_visible()
        assert page.locator('.health-reminders').evaluate('''e=>{
            const r=e.getBoundingClientRect();
            return [...e.querySelectorAll('.panel-title,.reminder-tabs,.calendar-download,.demo-note')].every(child=>{
                const c=child.getBoundingClientRect();return c.top>=r.top && c.bottom<=r.bottom;
            });
        }'''),'卡片固定工具区在200%文字下不得被裁剪'
        page.screenshot(path=str(OUT/f'{width}-text-200.png'),full_page=True)
    assert not errors,errors
    print('PASS: restored chart order, stable desktop states, six widths, scrollable long reminders and reachable 200% text')
    b.close()
