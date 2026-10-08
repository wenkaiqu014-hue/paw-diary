"""Safari-reported mobile chrome checks; ephemeral guest contexts only."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get('PAW_DIARY_TEST_URL', 'http://127.0.0.1:4240/paw-diary/')
OUT = ROOT / 'test-results/stage5/safari-chrome'
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as runtime:
    checks = []
    for engine in ['chromium', 'webkit']:
        launcher = getattr(runtime, engine)
        launch_options = {'headless': True}
        if engine == 'chromium':
            launch_options['executable_path'] = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        try:
            browser = launcher.launch(**launch_options)
        except Exception as error:
            if engine != 'webkit':
                raise
            checks.append({'engine': engine, 'unverified': 'WebKit runtime unavailable', 'reason': str(error).splitlines()[0]})
            continue
        context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page = context.new_page()
        page.goto(BASE + '#home', wait_until='networkidle')
        if page.locator('#whats-new-dialog').is_visible():
            page.locator('[data-whats-new-confirm]').click()
        if page.locator('dialog[data-guided-tour]').is_visible():
            page.locator('[data-tour-skip]').click()
        avatar = page.locator('#owner-profile-button')
        expect(avatar).to_be_visible()
        center = avatar.evaluate("""el=>{const range=document.createRange();range.selectNodeContents(el);const text=range.getBoundingClientRect(),button=el.getBoundingClientRect(),css=getComputedStyle(el);return {deltaX:Math.abs((text.left+text.width/2)-(button.left+button.width/2)),alignItems:css.alignItems,justifyContent:css.justifyContent,width:button.width,height:button.height}}""")
        checks.append({'engine': engine, 'check': 'avatar centered in circle', 'pass': center['deltaX'] <= 1 and center['alignItems'] == 'center' and center['justifyContent'] == 'center', 'actual': center})
        page.screenshot(path=str(OUT / f'{engine}-home.png'))
        page.locator('#main [data-action="edit-pet"]').first.focus()
        page.keyboard.press('Enter')
        title = page.locator('#dialog-title')
        expect(title).to_be_focused()
        outline = title.evaluate('el=>getComputedStyle(el).outlineStyle')
        checks.append({'engine': engine, 'check': 'programmatic title focus has no ring', 'pass': outline == 'none', 'actual': outline})
        page.keyboard.press('Tab')
        focused = page.locator('#dialog :focus')
        expect(focused).to_have_count(1)
        visible_focus = focused.evaluate("el=>({tag:el.tagName,visible:el.matches(':focus-visible'),style:getComputedStyle(el).outlineStyle,width:parseFloat(getComputedStyle(el).outlineWidth)})")
        checks.append({'engine': engine, 'check': 'keyboard interactive focus remains visible', 'pass': visible_focus['tag'] in ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'] and visible_focus['visible'] and visible_focus['style'] != 'none' and visible_focus['width'] > 0, 'actual': visible_focus})
        page.screenshot(path=str(OUT / f'{engine}-dialog-keyboard.png'))
        context.close()
        browser.close()
    (OUT / 'checks.json').write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(checks, ensure_ascii=False, indent=2))
    assert all(check.get('pass', True) for check in checks), 'Mobile chrome regression; see checks.json'
