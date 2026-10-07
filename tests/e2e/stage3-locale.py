"""Actual product UI: language changes preserve unsubmitted text; no model calls."""
import os
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4199/')
def choose_locale(page, selector, value):
    select=page.locator(selector)
    label=select.locator('option[value="'+value+'"]').text_content()
    root=select.locator('..');root.locator('.select-trigger').click()
    root.get_by_role('option',name=label,exact=True).click()

with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome');page=b.new_page(viewport={'width':390,'height':844})
    page.on('dialog',lambda dialog:dialog.accept())
    page.goto(BASE+'#home',wait_until='networkidle')
    page.locator('[data-action=record]').first.click();page.locator('[data-action=record-mode][data-value=ai]').click()
    page.locator('#ai-text').fill('合成原句保持中文，不自动翻译。')
    choose_locale(page,'#dialog-locale-select','en')
    expect(page.locator('[data-action=record-mode][data-value=ai]')).to_contain_text('Write a sentence')
    expect(page.locator('#ai-text')).to_have_value('合成原句保持中文，不自动翻译。')
    choose_locale(page,'#dialog-locale-select','zh-CN')
    expect(page.locator('#ai-current-pet')).to_contain_text('当前宠物')
    expect(page.locator('#ai-entry-form [data-s3-key=consent]')).to_contain_text('点击整理')
    page.locator('#dialog [data-action=close]:visible').click()
    page.locator('#stage3-assistant-launcher').click()
    page.locator('#assistant-question').fill('合成问题保持中文。')
    choose_locale(page,'#dialog-locale-select','en')
    expect(page.locator('#dialog-title')).to_have_text('Record assistant')
    choose_locale(page,'#dialog-locale-select','zh-CN')
    expect(page.locator('#assistant-consent')).to_contain_text('发送问题时')
    expect(page.locator('#assistant-question')).to_have_value('合成问题保持中文。')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    b.close()
    print('PASS: actual AI and assistant dialogs preserve original text and refresh bilingual copy')
