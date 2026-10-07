"""Whole-app locale acceptance. Requires root's actual language picker integration."""
from pathlib import Path
import os, re
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4191/').rstrip('/')+'/'
PICKER=os.environ.get('PAW_DIARY_LOCALE_SELECTOR','#locale-select')
MODAL_PICKER=os.environ.get('PAW_DIARY_MODAL_LOCALE_SELECTOR','#dialog-locale-select')
OUT=Path(os.environ.get('PAW_DIARY_TEST_OUTPUT_DIR',str(Path(__file__).resolve().parents[2]/'test-results'/'stage2'/'language-browser')))
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=os.environ.get('PAW_DIARY_HEADED')!='1',executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    page=browser.new_page(viewport=dict(width=1440,height=1000),reduced_motion='reduce')
    page.set_default_timeout(8000);errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('dialog',lambda dialog:dialog.accept())
    page.goto(BASE+'#health',wait_until='networkidle')
    expect(page.locator(PICKER)).to_be_visible()
    page.locator(PICKER).select_option('en')
    expect(page.locator('html')).to_have_attribute('lang','en')
    for route,text in [('home','Home'),('health','Health'),('nearby','Nearby'),('community','Community')]:
        expect(page.locator(f'nav [data-page={route}]')).to_contain_text(text)
    # A fresh personal journal makes exact UI-word pet names and custom labels real persisted user data.
    page.locator('[data-action=workspace-local]').first.click()
    expect(page.locator('#pet-form')).to_be_visible()
    page.locator('#dialog [name=name]').fill('健康档案')
    page.locator('#dialog [name=type]').select_option('other')
    page.locator('#dialog [name=typeLabel]').fill('保存记录')
    page.locator('#dialog [name=estimatedAgeMonths]').fill('12')
    page.locator('#dialog [type=submit]').click()
    expect(page.locator('#dialog')).not_to_be_visible()
    expect(page.locator('.pet-entry strong')).to_contain_text('健康档案')
    expect(page.locator('.pet-entry')).to_contain_text('保存记录')
    selected=page.locator('.pet-entry.is-active').get_attribute('data-id')
    names=page.locator('.pet-entry strong').all_text_contents()
    page.locator('[data-action=record]').first.click()
    page.locator('#dialog [name=type]').select_option('other')
    page.locator('#dialog [name=typeLabel]').fill('健康档案')
    page.locator('#dialog [name=title]').fill('健康档案')
    page.locator('#dialog [name=note]').fill('保存记录 用户原文 <script>不是HTML</script>')
    # Switch through a real dialog-accessible control, not evaluate(setLocale).
    expect(page.locator(MODAL_PICKER)).to_be_visible()
    page.locator(MODAL_PICKER).select_option('zh-CN')
    expect(page.locator('#dialog [name=title]')).to_have_value('健康档案')
    expect(page.locator('#dialog [name=note]')).to_have_value('保存记录 用户原文 <script>不是HTML</script>')
    expect(page.locator('#dialog [name=type]')).to_have_value('other')
    expect(page.locator('#dialog [name=typeLabel]')).to_have_value('健康档案')
    expect(page.locator('#dialog [type=submit]')).to_contain_text('保存记录')
    page.locator(MODAL_PICKER).select_option('en')
    expect(page.locator('#dialog [name=title]')).to_have_value('健康档案')
    expect(page.locator('#dialog [name=note]')).to_have_value('保存记录 用户原文 <script>不是HTML</script>')
    expect(page.locator('#dialog [type=submit]')).to_contain_text('Save record')
    page.locator('#dialog [type=submit]').click()
    expect(page.locator('#dialog')).not_to_be_visible()
    assert page.locator('.pet-entry.is-active').get_attribute('data-id')==selected
    assert page.locator('.pet-entry strong').all_text_contents()==names
    expect(page.locator('.records-table tbody tr td').nth(1)).to_have_text('健康档案')
    expect(page.locator('.records-table tbody tr td').nth(2)).to_have_text('健康档案')
    assert page.locator('.pet-entry strong').first.evaluate('(el)=>el.firstChild.textContent')=='健康档案'
    expect(page.locator('.health-records')).to_contain_text('健康档案')
    expect(page.locator('.health-records')).to_contain_text('保存记录 用户原文 <script>不是HTML</script>')
    assert page.locator('.health-records script').count()==0
    page.locator('[name=photos]').set_input_files(str(Path(__file__).resolve().parents[2]/'assets'/'cat.jpg'))
    page.locator('[name=photo-caption]').fill('健康档案')
    page.locator(PICKER).select_option('zh-CN')
    expect(page.locator('[name=photo-caption]')).to_have_value('健康档案')
    assert page.locator('[name=photos]').evaluate('(el)=>el.files.length')==1
    page.locator(PICKER).select_option('en')
    expect(page.locator('[name=photo-caption]')).to_have_value('健康档案')
    assert page.locator('[name=photos]').evaluate('(el)=>el.files.length')==1
    assert page.locator('.pet-entry.is-active').get_attribute('data-id')==selected
    expect(page.locator('.pet-entry')).to_contain_text('保存记录')
    for selector in ['.sidebar-note h3','.sidebar-note p','#workspace-controls p','.breadcrumb','#workspace-badge','#main .photo-wall-panel>h2']:
        copy=page.locator(selector).inner_text()
        assert not re.search(r'[\u4e00-\u9fff]',copy),f'untranslated UI {selector}: {copy}'
    print('PASS real language controls preserve current pet and all unsaved user-original form values')
    for route in ['home','health','nearby','community']:
        page.locator(f'nav [data-page={route}]').click()
        expect(page.locator('#main .page-heading h1')).to_be_visible()
        title=page.locator('#main .page-heading h1').inner_text()
        assert not re.search(r'[\u4e00-\u9fff]',title),f'untranslated {route} title: {title}'
        if os.environ.get('PAW_DIARY_CAPTURE')=='1':
            page.screenshot(path=str(OUT/f'english-{route}.png'),full_page=True)
    page.reload(wait_until='networkidle')
    expect(page.locator(PICKER)).to_have_value('en')
    expect(page.locator('html')).to_have_attribute('lang','en')
    page.locator('nav [data-page=health]').click()
    assert page.locator('.pet-entry strong').first.evaluate('(el)=>el.firstChild.textContent')=='健康档案'
    expect(page.locator('.pet-entry')).to_contain_text('保存记录')
    expect(page.locator('.records-table tbody tr td').nth(1)).to_have_text('健康档案')
    expect(page.locator('.records-table tbody tr td').nth(2)).to_have_text('健康档案')
    expect(page.locator('.health-records')).to_contain_text('保存记录 用户原文 <script>不是HTML</script>')
    assert page.locator('.pet-entry.is-active').get_attribute('data-id')==selected
    page.locator('[data-action=account]').first.click()
    expect(page.locator('#dialog-title')).to_have_text('Sign in and cloud sync')
    cloud_enabled=page.evaluate('globalThis.__PAW_PUBLIC_CONFIG__?.enabled===true')
    if cloud_enabled:
        expect(page.locator('#account-login-form')).to_be_visible()
        expect(page.locator('#account-login-form [name=code]')).to_be_disabled()
        expect(page.locator('#account-login-form [name=email]')).to_have_value('')
    else:
        assert page.locator('#account-login-form').count()==0,'disabled account must not pretend live email login'
        expect(page.locator('#dialog-body')).to_contain_text('Cloud service is being verified.')
    page.locator(MODAL_PICKER).select_option('zh-CN')
    expect(page.locator('#dialog-title')).to_have_text('登录与云同步')
    if cloud_enabled:
        expect(page.locator('#account-login-form')).to_be_visible()
        expect(page.locator('#account-login-form [name=code]')).to_be_disabled()
    else:
        expect(page.locator('#dialog-body')).to_contain_text('云服务尚在验证中。你可以继续本地记录，资料不会自动上传。')
        expect(page.locator('#dialog-body')).to_contain_text('只开放实际验收通过的邮箱登录。')
    page.locator(MODAL_PICKER).select_option('en')
    expect(page.locator('#dialog-title')).to_have_text('Sign in and cloud sync')
    if cloud_enabled:
        expect(page.locator('#account-login-form')).to_be_visible()
        page.locator('#dialog [data-account-action=close]').click()
    else:
        expect(page.locator('#dialog-body')).to_contain_text('Cloud service is being verified.')
        page.locator('#dialog [data-action=close]').click()
    assert page.locator('.pet-entry.is-active').get_attribute('data-id')==selected
    assert not errors,errors
    print('PASS four route interface headings are English and locale preference survives refresh')
    browser.close()
