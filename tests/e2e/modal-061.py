import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4198/')
OUT=Path(__file__).resolve().parents[2]/'test-results'/'modal-061';OUT.mkdir(parents=True,exist_ok=True)
def choose(page,value):
 root=page.locator('#record-type').locator('..');label=page.locator(f'#record-type option[value="{value}"]').text_content();root.locator('.select-trigger').click();root.get_by_role('option',name=label,exact=True).click()
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=False);page=b.new_page(viewport={'width':1440,'height':900});native=[];errors=[]
 page.on('dialog',lambda d:(native.append(d.type),d.dismiss()));page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL+'#health',wait_until='networkidle');page.locator('main [data-action=record]').click();choose(page,'weight');expect(page.locator('#record-form [name=title]')).to_have_value('')
 choose(page,'daily');expect(page.locator('#record-form [name=title]')).to_have_value('');page.locator('#record-form [name=title]').fill('用户自己的名称');choose(page,'weight');choose(page,'vaccine');expect(page.locator('#record-form [name=title]')).to_have_value('用户自己的名称')
 page.locator('#close-dialog').click();expect(page.locator('#discard-dialog')).to_be_visible();assert not native,native
 for width in [1440,390]:
  page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(250);box=page.locator('#discard-dialog').bounding_box();assert abs(box['x']+box['width']/2-page.evaluate('document.documentElement.clientWidth')/2)<2;assert abs(box['y']+box['height']/2-450)<2;page.screenshot(path=str(OUT/f'discard-{width}.png'))
 page.locator('[data-discard-keep]').click();expect(page.locator('#discard-dialog')).not_to_be_visible();expect(page.locator('#record-form [name=title]')).to_have_value('用户自己的名称')
 page.locator('#close-dialog').click();page.keyboard.press('Escape');expect(page.locator('#record-form')).to_be_visible();page.locator('#close-dialog').click();page.locator('[data-discard-confirm]').click();expect(page.locator('#dialog')).not_to_be_visible()
 page.locator('main [data-action=record]').click();choose(page,'weight');page.locator('#record-form [name=value]').fill('4.6');page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();assert not errors,errors;assert not native,native
 b.close();print(json.dumps({'noWeightPrefill':True,'userTitlePreserved':True,'customDiscard':True,'keepAndEscape':True,'discardCloses':True,'centeredWidths':[1440,390],'blankWeightTitleSaves':True,'nativeDialogs':native,'pageErrors':errors}))
