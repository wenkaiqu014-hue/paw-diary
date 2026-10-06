"""English personal workflows at the planned four widths; isolated local data only."""
import os
import re
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('PAW_DIARY_TEST_URL', 'http://127.0.0.1:4193/paw-diary/')

def fits(page, scope='body'):
    probe = '''scope => {
      const width = document.documentElement.clientWidth;
      const root = document.querySelector(scope);
      const outside = [...root.querySelectorAll('button,input,select,textarea')]
        .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
        .filter(el => {
          const outside = () => { const b=el.getBoundingClientRect(); return b.left < -1 || b.right > width + 1; };
          if (!outside()) return false;
          return true;
        })
        .map(el => ({label: el.getAttribute('name') || el.textContent.trim().slice(0,60),
          rect: el.getBoundingClientRect().toJSON(), disabled:el.disabled,
          action:el.dataset.action,focused:document.activeElement===el,
          ancestors: (() => { const list=[]; for(let node=el.parentElement;node;node=node.parentElement) {
            const css=getComputedStyle(node); if(node.scrollWidth > node.clientWidth + 1)
              list.push({className:node.className,rect:node.getBoundingClientRect().toJSON(),scrollLeft:node.scrollLeft,scroll:node.scrollWidth,client:node.clientWidth,overflow:css.overflowX});
          } return list; })()}));
      return {width, scroll: document.documentElement.scrollWidth, outside};
    }'''
    result = page.evaluate(probe, scope)
    assert result['scroll'] <= result['width'] + 1, result
    if result['outside'] and scope == 'body':
        # Existing tables deliberately scroll inside their cards. Use an actual
        # horizontal wheel gesture, then prove their action buttons are reachable.
        planned = all(any(a['className'] == 'table-wrap records-table'
            and a['overflow'] in ['auto', 'scroll'] and a['rect']['left'] >= -1
            and a['rect']['right'] <= result['width'] + 1
            for a in item['ancestors']) for item in result['outside'])
        if planned:
            table = page.locator('.table-wrap.records-table:visible')
            table.hover()
            page.mouse.wheel(600, 0)
            page.wait_for_function("document.querySelector('.records-table').scrollLeft > 0")
            result = page.evaluate(probe, scope)
    assert not result['outside'], result

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    page.set_default_timeout(8000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE + '#health', wait_until='networkidle')
    original_demo = page.evaluate("localStorage.getItem('paw-diary:v3:demo')")
    page.locator('#locale-select').select_option('en')
    page.locator('[data-action=workspace-local]').first.click()
    page.locator('#pet-form [name=name]').fill('ABCDEFGHIJKLMNOPQRST')
    page.locator('#pet-form [name=type]').select_option('other')
    page.locator('#pet-form [name=typeLabel]').fill('CustomFriendlyRabbit')
    page.locator('#pet-form [name=estimatedAgeMonths]').fill('12')
    page.locator('#pet-form [type=submit]').click()
    expect(page.locator('#dialog')).not_to_be_visible()
    for width in [360, 390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000 if width >= 768 else 844})
        for route in ['home', 'health', 'nearby', 'community']:
            page.locator(f'nav [data-page={route}]').click()
            expect(page.locator(f'nav [data-page={route}]')).to_have_class(re.compile(r'\bactive\b'))
            expect(page.locator('#main h1')).to_be_visible()
            fits(page)
        page.locator('nav [data-page=health]').click()
        expect(page.locator('nav [data-page=health]')).to_have_class(re.compile(r'\bactive\b'))
        page.locator('[data-action=record]').first.click()
        page.locator('#record-form [name=type]').select_option('other')
        page.locator('#record-form [name=typeLabel]').fill('FriendlyCustomCare')
        page.locator('#record-form [name=title]').fill('A complete personal care record with a clear name')
        page.locator('#record-form [name=note]').fill('Private original words stay in this draft.')
        fits(page, '#dialog')
        page.locator('#dialog-locale-select').select_option('zh-CN')
        expect(page.locator('#record-form [name=note]')).to_have_value('Private original words stay in this draft.')
        fits(page, '#dialog')
        page.locator('#dialog-locale-select').select_option('en')
        page.locator('#record-form [type=submit]').click()
        expect(page.locator('#dialog')).not_to_be_visible()
        fits(page)
        if not page.locator('.pet-entry [data-action=edit-pet]').first.is_visible():
            page.locator('[data-action=manage-pets]').click()
        page.locator('.pet-entry [data-action=edit-pet]').first.click()
        expect(page.locator('#pet-form')).to_be_visible()
        fits(page, '#dialog')
        page.locator('#pet-form [data-action=avatar-pet]').click()
        fits(page, '#dialog')
        page.locator('#close-dialog').click()
        expect(page.locator('#dialog')).not_to_be_visible()
        print(f'PASS English four routes, custom-record draft, locale switch, avatar controls: width {width}', flush=True)
    page.reload(wait_until='networkidle')
    expect(page.locator('html')).to_have_attribute('lang', 'en')
    assert page.evaluate("localStorage.getItem('paw-diary:v3:demo')") == original_demo
    assert not errors, errors
    context.close()
    browser.close()
