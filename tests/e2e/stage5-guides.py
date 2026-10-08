"""Real application guide journeys; no authenticated writes or model calls."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4240/paw-diary/')
OUT=ROOT/'test-results/stage5/guides';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as runtime:
 browser=runtime.chromium.launch(headless=os.environ.get('PAW_HEADFUL')!='1',executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 for width in [1440,768,390,360]:
  context=browser.new_context(viewport={'width':width,'height':900},accept_downloads=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(BASE+'#home',wait_until='networkidle')
  notice=page.locator('#whats-new-dialog');expect(notice).to_be_visible()
  notice.get_by_role('button',name='确定',exact=True).click()
  tour=page.locator('dialog[data-guided-tour]');expect(tour).to_be_visible()
  assert tour.evaluate("el=>getComputedStyle(el,'::backdrop').backdropFilter")=='none','Spotlight targets must stay readable and unblurred'
  for index in range(6):
   expect(tour.locator('[data-tour-next]')).to_be_visible()
   expect(tour.locator('[data-tour-skip]')).to_be_visible()
   expect(tour.locator('[data-tour-progress]')).to_contain_text(str(index+1))
   rect=tour.locator('[data-tour-next]').bounding_box();assert rect and rect['x']>=0 and rect['x']+rect['width']<=width
   if index in [0,3,5]:page.screenshot(path=str(OUT/f'{width}-step-{index+1}.png'))
   tour.locator('[data-tour-next]').click()
  expect(tour).not_to_be_visible()
  page.reload(wait_until='networkidle');expect(notice).not_to_be_visible();expect(tour).not_to_be_visible()
  page.locator('#owner-profile-button').click();page.get_by_role('menuitem',name='使用帮助',exact=True).click()
  help_dialog=page.locator('#help-dialog');expect(help_dialog).to_be_visible()
  help_dialog.locator('[data-help-action=tour]').click();expect(tour).to_be_visible()
  tour.locator('[data-tour-skip]').click();expect(tour).not_to_be_visible()
  page.reload(wait_until='networkidle');expect(tour).not_to_be_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  print(f'PASS guide first/replay/skip/reload {width}px')
  context.close()
 context=browser.new_context(viewport={'width':390,'height':900})
 context.add_init_script("localStorage.setItem('paw-diary:locale','en')")
 page=context.new_page();page.goto(BASE+'#home',wait_until='networkidle')
 page.locator('[data-whats-new-confirm]').click()
 expect(page.locator('[data-tour-next]')).to_have_text('Next')
 page.locator('[data-tour-skip]').click()
 page.locator('#main [data-action=record]').first.click()
 expect(page.locator('[data-dialog-help]')).to_have_text('Help')
 page.locator('[data-dialog-help]').click()
 expect(page.locator('#help-title')).to_have_text('Help')
 page.keyboard.press('Escape');expect(page.locator('#dialog')).to_be_visible()
 print('PASS restored English locale: announcement, guide and draft-help control')
 context.close()
 browser.close()
