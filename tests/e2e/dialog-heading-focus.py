"""Real keyboard-opened dialogs keep heading focus without painting a control ring."""
import ast,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/v104/dialog-focus';OUT.mkdir(parents=True,exist_ok=True)
tree=ast.parse((ROOT/'tests/e2e/community-detail-layout.py').read_text())
fixture=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='FIXTURE' for t in n.targets))
(OUT/'fixture.html').write_text(fixture)
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=False);report=[]
 for width in [1440,390]:
  page=browser.new_page(viewport={'width':width,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:4197/test-results/v104/dialog-focus/fixture.html');page.locator('[data-community-entry]').wait_for()
  page.keyboard.press('Tab');page.locator('[data-community-entry]').focus();page.keyboard.press('Enter')
  dialog=page.locator('[data-community-detail]');dialog.locator('.post-actions').wait_for()
  heading=dialog.locator('.dialog-head h2');assert heading.evaluate('e=>e===document.activeElement')
  outline=heading.evaluate('e=>({width:getComputedStyle(e).outlineWidth,style:getComputedStyle(e).outlineStyle})')
  assert outline['style']=='none' or outline['width']=='0px',f'Noninteractive dialog heading paints focus outline {outline}'
  page.keyboard.press('Tab');assert page.evaluate("document.activeElement.tagName==='BUTTON'")
  assert page.evaluate("parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0"),'Keyboard controls must retain a visible focus ring'
  dialog.get_by_role('button',name='关闭详情',exact=True).click()
  page.locator('[data-community-write]').focus();page.keyboard.press('Enter')
  editor=page.locator('.community-editor-dialog');editor.locator('[name=title]').wait_for()
  assert editor.locator('.dialog-head h2').evaluate('e=>e===document.activeElement && getComputedStyle(e).outlineStyle==="none"')
  page.keyboard.press('Tab');assert page.evaluate("parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0")
  page.keyboard.press('Escape');assert not editor.is_visible()
  assert not errors,errors;page.screenshot(path=str(OUT/f'{width}.png'));report.append({'width':width,'headingRetainsFocus':True,'headingOutlineHidden':True,'keyboardControlOutlineKept':True,'pageErrors':errors});page.close()
 browser.close();(OUT/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
