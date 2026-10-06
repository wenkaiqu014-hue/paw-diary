"""本地档案的空数据、焦点、长文本、图片及放大边界。"""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright,expect

BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4180/')
OUT=Path(os.environ.get('PAW_DIARY_TEST_OUTPUT_DIR', str(Path(__file__).resolve().parents[2]/'test-results'/'stage1')))
OUT.mkdir(parents=True,exist_ok=True)
results={}
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    c=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',accept_downloads=True)
    page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE,wait_until='networkidle')
    page.get_by_role('button',name='记一笔',exact=True).click()
    page.locator('[name=value]').fill('5.11')
    page.once('dialog',lambda dialog:dialog.dismiss())
    page.get_by_role('button',name='取消',exact=True).click()
    expect(page.locator('dialog')).to_be_visible()
    assert page.locator('[name=value]').input_value()=='5.11'
    page.once('dialog',lambda dialog:dialog.accept())
    page.get_by_role('button',name='取消',exact=True).click()
    expect(page.locator('dialog')).not_to_be_visible()
    assert page.evaluate('document.activeElement.dataset.action')=='record'
    results['cancel_and_focus']='pass'

    raw=page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v3:demo'))")
    raw['pets'][0]['name']='毛孩子长名称测试长名称测试长名称测'[:20]
    raw['pets'][0]['image']='assets/missing-stage1.jpg'
    raw['records'][0]['title']='W'*60
    raw['records'][0]['note']='长备注'*166
    page.evaluate("raw=>localStorage.setItem('paw-diary:v3:demo',JSON.stringify(raw))",raw)
    page.reload(wait_until='networkidle')
    expect(page.locator('.image-fallback').first).to_be_visible()
    for route in ('home','health','nearby','community'):
        page.goto(BASE+'#'+route,wait_until='networkidle')
        expect(page.locator('h1')).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),route
    results['long_text_and_image_fallback']='pass'

    page.goto(BASE+'#health',wait_until='networkidle')
    page.get_by_role('button',name='添加记录',exact=True).click()
    page.set_viewport_size({'width':390,'height':430})
    page.get_by_role('button',name='保存记录',exact=True).scroll_into_view_if_needed()
    assert page.get_by_role('button',name='保存记录',exact=True).evaluate('(e)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}')
    results['short_viewport_save_reachable']='pass (keyboard approximation only)'
    page.get_by_role('button',name='取消',exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    page.goto(BASE+'#home',wait_until='networkidle')
    assert page.locator('.home-reminders').evaluate('(e)=>e.getBoundingClientRect().top') < page.locator('.home-chart').evaluate('(e)=>e.getBoundingClientRect().top')
    results['mobile_task_order']='pass'
    assert page.locator('#main').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
    results['reduced_motion']='pass'

    for route in ('home','health','nearby','community'):
        page.goto(BASE+'#'+route,wait_until='networkidle');page.reload(wait_until='networkidle')
        page.evaluate('''()=>{const sizes=[...document.querySelectorAll('body,body *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);sizes.forEach(([e,size])=>e.style.setProperty('font-size',2*size+'px','important'));}''')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),route+' 200% text'
    results['text_200_percent']='no page overflow (not browser-native zoom)'

    page.goto(BASE+'#home',wait_until='networkidle');page.reload(wait_until='networkidle')
    # Chrome layout zoom, separate from the earlier per-element text stress.
    page.evaluate("document.body.style.zoom='2'")
    results['layout_zoom_200_scroll_width']=page.evaluate('({scroll:document.documentElement.scrollWidth,width:innerWidth})')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.evaluate("document.body.style.zoom='1'")
    clean={'version':3,'mode':'demo','activePetId':None,'pets':[],'records':[],'reminders':[],'posts':[],'profile':{'city':'深圳'}}
    page.evaluate("raw=>localStorage.setItem('paw-diary:v3:demo',JSON.stringify(raw))",clean)
    page.reload(wait_until='networkidle')
    expect(page.get_by_text('还没有宠物档案',exact=True)).to_be_visible()
    assert not page.get_by_text('糯米',exact=True).count()
    page.get_by_role('button',name='添加一只宠物',exact=True).click()
    page.locator('[name=name]').fill('估龄新宠')
    page.locator('[name=estimatedAgeMonths]').fill('12')
    page.get_by_role('button',name='保存档案',exact=True).click()
    expect(page.get_by_role('heading',name='你好呀，估龄新宠。')).to_be_visible()
    saved=page.evaluate("JSON.parse(localStorage.getItem('paw-diary:v3:demo')).pets[0]")
    assert saved['birthday'] is None and saved['estimatedAgeMonths']==12 and saved['arrivalDate'] is None
    results['empty_and_estimated_age']='pass'
    assert not errors,errors
    (OUT/'boundaries.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    print(json.dumps(results,ensure_ascii=False))
    c.close();b.close()
