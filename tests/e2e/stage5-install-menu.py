"""Direct install menu entry, manual instructions and read-only draft protection.

No mocked OS install event; isolated guest profiles and actual browser UI only.
"""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get('PAW_DIARY_TEST_URL', 'http://127.0.0.1:4240/paw-diary/')
OUT = ROOT / 'test-results/stage5/install-menu'
OUT.mkdir(parents=True, exist_ok=True)
DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'
IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
checks = []
with sync_playwright() as runtime:
    browser = runtime.chromium.launch(headless=True, executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    for locale in ['zh-CN', 'en']:
        for mobile in [False, True]:
            context = browser.new_context(viewport={'width': 390 if mobile else 1440, 'height': 900}, user_agent=IPHONE_UA if mobile else DESKTOP_UA, is_mobile=mobile, has_touch=mobile)
            context.add_init_script("localStorage.setItem('paw-diary:locale', " + json.dumps(locale) + ")")
            def gate(route):
                if urlparse(route.request.url).hostname in ['127.0.0.1', 'localhost', urlparse(BASE).hostname]:
                    route.continue_()
                else:
                    route.abort('failed')
            context.route('**/*', gate)
            page = context.new_page()
            page.set_default_timeout(4000)
            page.goto(BASE + '#home', wait_until='networkidle')
            if page.locator('#whats-new-dialog').is_visible():
                page.locator('[data-whats-new-confirm]').click()
            if page.locator('dialog[data-guided-tour]').is_visible():
                page.locator('[data-tour-skip]').click()
            trigger = page.locator('#owner-profile-button')
            trigger.click()
            label = ('Add to Home Screen' if mobile else 'Install desktop app') if locale == 'en' else ('添加到主屏幕' if mobile else '安装桌面版')
            install = page.get_by_role('menuitem', name=label, exact=True)
            expect(install).to_be_visible()
            items = page.locator('.profile-menu [role=menuitem]').all_text_contents()
            help_label = 'Help' if locale == 'en' else '使用帮助'
            assert items.index(label) < items.index(help_label)
            page.keyboard.press('Escape')
            expect(trigger).to_be_focused()
            trigger.click()
            install.click()
            instructions = page.locator('#install-help-dialog')
            expect(instructions).to_be_visible()
            expect(instructions).to_contain_text('iPhone · Safari')
            expect(page.locator('.profile-menu')).to_have_count(0)
            page.screenshot(path=str(OUT / f'{locale}-{mobile}-instructions.png'))
            page.keyboard.press('Escape')
            expect(instructions).not_to_be_visible()
            expect(trigger).to_be_focused()
            page.locator('#main [data-action=record]').first.click()
            form = page.locator('#record-form')
            title = 'Synthetic install help draft'
            form.locator('[name=title]').fill(title)
            page.locator('[data-dialog-help]').click()
            page.locator('[data-help-action=install]').click()
            expect(instructions).to_be_visible()
            page.keyboard.press('Escape')
            if page.locator('#help-dialog').is_visible():
                page.keyboard.press('Escape')
            expect(form).to_be_visible()
            expect(form.locator('[name=title]')).to_have_value(title)
            checks.append({'locale': locale, 'mobileUserAgent': mobile, 'label': label, 'manualInstructions': True, 'escapeRestoresMenuTrigger': True, 'draftPreserved': True, 'osInstalled': 'not tested'})
            context.close()
    browser.close()
(OUT / 'checks.json').write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(checks, ensure_ascii=False, indent=2))
