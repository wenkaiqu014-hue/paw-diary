"""真实浏览器验证核心用户流程；截图与备份留在 test-results（不发布）。"""
from pathlib import Path
from datetime import date, timedelta
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('PAW_DIARY_TEST_URL', 'http://127.0.0.1:4178/')
OUT = Path(__file__).parent / 'test-results'
OUT.mkdir(exist_ok=True)

def choose(page, selector, value):
    select=page.locator(selector)
    label=select.evaluate('(s,v)=>Array.from(s.options).find(o=>o.value===v).textContent',value)
    root=select.locator('..')
    root.locator('.select-trigger').click()
    root.get_by_role('option',name=label,exact=True).click()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE, wait_until='networkidle')
    expect(page.get_by_role('heading', name='每一天，都是成长。')).to_be_visible()
    page.screenshot(path=str(OUT / 'desktop-home.png'), full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), '桌面横向溢出'
    assert page.locator('img').evaluate_all('(images) => images.every(i => i.complete && i.naturalWidth > 0)'), '图片未加载'
    print('PASS: 首页、资源、桌面布局')

    page.get_by_role('button', name='记一笔', exact=True).click()
    choose(page,'#record-type','weight')
    page.locator('[name=value]').fill('23.15')
    page.locator('[name=note]').fill('浏览器验证：今天的体重')
    page.locator('#record-form [type=submit]').click()
    expect(page.locator('dialog')).not_to_be_visible()
    expect(page.get_by_role('heading', name='体重记录 · 23.15 kg', exact=False)).to_be_visible()
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading', name='体重记录 · 23.15 kg', exact=False)).to_be_visible()
    print('PASS: 新增体重、时间线同步、刷新持久保存')

    page.get_by_role('button', name='记一笔', exact=True).click()
    choose(page,'#record-type','vaccine')
    page.locator('[name=title]').fill('测试健康提醒')
    page.locator('#record-form [type=submit]').click()
    expect(page.locator('dialog')).not_to_be_visible()
    page.goto(BASE+'#health',wait_until='networkidle')
    page.locator('[data-action=new-reminder]').click()
    choose(page,'#record-type','vaccine')
    page.locator('[name=title]').fill('测试健康提醒')
    page.locator('[name=dueDate]').fill((date.today() + timedelta(days=8)).isoformat())
    page.locator('#record-form [type=submit]').click()
    expect(page.locator('.reminder').filter(has_text='测试健康提醒')).to_be_visible()
    page.locator('.reminder').filter(has_text='测试健康提醒').get_by_role('button', name='记录完成').click()
    page.locator('#record-form [type=submit]').click()
    expect(page.locator('.reminder').filter(has_text='测试健康提醒')).to_have_count(0)
    print('PASS: 疫苗记录、待办生成、完成待办')

    page.get_by_role('link', name='健康档案', exact=True).click()
    page.get_by_role('button', name='体重', exact=True).click()
    expect(page.locator('tbody tr')).to_have_count(5)
    with page.expect_download() as download_info:
        page.get_by_role('button', name='导出备份', exact=True).click()
    download_info.value.save_as(str(OUT / 'backup.json'))
    page.locator('tbody tr').filter(has_text='23.15').get_by_role('button', name='移入回收站').click()
    page.get_by_role('button', name='保留', exact=True).click()
    expect(page.locator('tbody tr')).to_have_count(5)
    print('PASS: 健康记录筛选、导出备份、删除取消')

    page.get_by_role('button', name='添加宠物', exact=True).click()
    page.locator('[name=name]').fill('小团子')
    choose(page,'#pet-type','cat')
    page.locator('[name=estimatedAgeMonths]').fill('12')
    page.get_by_role('button', name='保存档案').click()
    expect(page.get_by_text('这里还没有记录', exact=True)).to_be_visible()
    page.get_by_role('button', name='切换到糯米', exact=True).click()
    expect(page.locator('tbody tr')).to_have_count(5)
    print('PASS: 添加宠物、各宠物数据隔离、切换宠物')

    page.get_by_role('link', name='附近宠友', exact=True).click()
    expect(page.locator('.friend-card')).to_have_count(3)
    page.get_by_role('button', name='猫咪朋友').click()
    expect(page.locator('.friend-card')).to_have_count(1)
    page.get_by_role('button', name='切换城市', exact=True).click()
    choose(page,'[name=city]','上海')
    page.get_by_role('button', name='确认城市').click()
    expect(page.locator('.friend-card')).to_have_count(1)
    expect(page.locator('.friend-card').get_by_text('栗子', exact=False)).to_be_visible()
    page.get_by_role('button', name='认识一下').click()
    expect(page.get_by_text('这是示例宠友，暂不提供真实私信。', exact=False)).to_be_visible()
    page.get_by_role('button', name='返回', exact=True).click()
    print('PASS: 城市筛选、物种筛选、示例宠友详情')

    page.get_by_role('link', name='社区日常', exact=True).click()
    page.get_by_role('button', name='发布日常', exact=True).click()
    page.locator('[name=title]').fill('第一次晒宠测试')
    page.locator('[name=text]').fill('<script>alert("XSS")</script> 今天一起晒太阳。')
    page.locator('[name=photo]').set_input_files(str(Path(__file__).parent / 'assets/cat.jpg'))
    page.locator('dialog').get_by_role('button', name='发布日常', exact=True).click()
    expect(page.get_by_role('heading', name='第一次晒宠测试')).to_be_visible()
    post = page.locator('.post').filter(has_text='第一次晒宠测试')
    expect(post.locator('.post-text')).to_contain_text('<script>')
    assert post.locator('script').count() == 0
    assert post.locator('.post-image').get_attribute('src').startswith('data:image/jpeg;')
    post.get_by_role('button', name='点赞 第一次晒宠测试', exact=True).click()
    expect(post.get_by_role('button', name='取消点赞 第一次晒宠测试', exact=True)).to_have_attribute('aria-pressed', 'true')
    post.get_by_role('button', name='0 评论').click()
    page.locator('[name=comment]').fill('真的好可爱。')
    page.get_by_role('button', name='发送评论').click()
    expect(post.get_by_role('button', name='1 评论')).to_be_visible()
    page.get_by_role('textbox', name='搜索社区内容').fill('第一次晒宠测试')
    expect(page.locator('.post')).to_have_count(1)
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading', name='第一次晒宠测试')).to_be_visible()
    print('PASS: 图片发帖、文本转义、点赞、评论、搜索、刷新保存')

    for route in ('home', 'health', 'nearby', 'community'):
        page.goto(BASE + '#' + route, wait_until='networkidle')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), route + '桌面溢出'
    mobile = context.new_page()
    mobile.set_viewport_size({'width': 390, 'height': 844})
    for route in ('home', 'health', 'nearby', 'community'):
        mobile.goto(BASE + '#' + route, wait_until='networkidle')
        assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth'), route + '手机溢出'
        mobile.screenshot(path=str(OUT / f'mobile-{route}.png'), full_page=True)
    assert not errors, errors
    print('PASS: 四个页面桌面/手机布局；无 JavaScript 运行错误')
    page.goto(BASE + '#home', wait_until='networkidle')
    page.get_by_role('button', name='记一笔', exact=True).click()
    choose(page,'#record-type','weight')
    page.locator('[name=value]').fill('24')
    page.locator('#record-form [type=submit]').click()
    expect(page.locator('.stat').first.locator('strong')).to_have_text('24kg')
    print('PASS: 同一天多次称重，首页显示最后一次')
    browser.close()
