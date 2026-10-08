"""Headful synthetic custom profile pet type interaction; no cloud writes."""
import base64,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/v102/profile-custom';OUT.mkdir(parents=True,exist_ok=True)
(OUT/'fixture.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/src/ui/community.css"><main><div id="fixture"></div></main><script type="module">
import {mountProfile} from '/src/features/profile.js';window.language='zh-CN';window.saved=[];window.uploads=0;window.stored={nickname:'合成昵称',bio:'',cityId:'110100',cityName:'北京市',petTypes:['cat','兔子'],purposes:['新手互助'],discoverable:true,avatarAssetId:null,revision:1};window.mount=()=>window.controller=mountProfile({container:document.querySelector('#fixture'),getSession:()=>({userId:'A',generation:1}),getLocale:()=>window.language,uploadImage:async()=>{window.uploads++;return {assetId:'synthetic-avatar'}},repository:{request:async(action,payload)=>{if(action==='profiles.getOwn')return window.stored;if(action==='auth.getOwn')return {};if(action==='community.hidden.list')return {items:[],nextCursor:null};if(action==='profiles.saveOwn'){window.saved.push(payload);window.stored={...payload,revision:2};return window.stored}throw Error(action)}}});window.mount();</script>''')
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=False);report=[];errors=[]
 for width in (1440,390):
  page=browser.new_page(viewport={'width':width,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('PAW_CUSTOM_TEST_ORIGIN','http://127.0.0.1:4198')+'/test-results/v102/profile-custom/fixture.html');page.locator('[name=nickname]').wait_for(timeout=4000)
  custom=page.locator('[name=customPetType]');assert custom.count()==1,'Custom pet type entry is missing'
  assert page.locator('[name=petTypes][value="兔子"]').is_checked();assert '兔子' in page.locator('[data-profile-preview]').inner_text()
  page.locator('[name=nickname]').fill('草稿昵称');page.locator('[name=bio]').fill('保留的介绍');page.locator('[name=avatar]').set_input_files({'name':'synthetic.png','mimeType':'image/png','buffer':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA0kAAAAASUVORK5CYII=')})
  custom.fill('仓鼠');custom.press('Enter');assert page.evaluate('window.saved.length')==0;assert page.locator('[name=petTypes][value="仓鼠"]').is_checked()
  custom.fill(' 猫 ');page.locator('[data-add-pet-type]').click();assert '已有' in page.locator('[data-custom-pet-error]').inner_text();assert custom.evaluate('(el)=>el===document.activeElement')
  custom.fill('');page.locator('[data-add-pet-type]').click();assert '填写' in page.locator('[data-custom-pet-error]').inner_text()
  custom.fill('超'*21);page.locator('[data-add-pet-type]').click();assert '20' in page.locator('[data-custom-pet-error]').inner_text();assert custom.get_attribute('aria-invalid')=='true';assert 'profile-custom-type-error' in custom.get_attribute('aria-describedby')
  custom.fill('🐇'*21);page.locator('[data-add-pet-type]').click();assert '20' in page.locator('[data-custom-pet-error]').inner_text()
  custom.fill('🐇'*20);page.locator('[data-add-pet-type]').click();assert page.locator('[name=petTypes][value="'+('🐇'*20)+'"]').is_checked();page.locator('[data-remove-pet-type="'+('🐇'*20)+'"]').click()
  custom.fill('鹦鹉');page.evaluate("window.language='en';window.controller.refreshLocale()");custom=page.locator('[name=customPetType]');assert custom.input_value()=='鹦鹉';assert page.locator('[name=nickname]').input_value()=='草稿昵称';assert page.locator('[name=bio]').input_value()=='保留的介绍'
  page.get_by_role('button',name='Save profile',exact=True).click();assert page.evaluate('window.saved.length')==0;assert 'Add type' in page.locator('[data-custom-pet-error]').inner_text()
  page.locator('[data-add-pet-type]').click();page.locator('[data-remove-pet-type="兔子"]').click();assert page.locator('[name=petTypes][value="兔子"]').count()==0
  custom.fill('<script>alert(1)</script>');page.locator('[data-add-pet-type]').click();assert page.locator('[data-custom-pet-error]').is_visible()
  custom.fill('Turtle');page.locator('[data-add-pet-type]').click();assert page.locator('[name=petTypes][value="Turtle"]').is_checked()
  page.get_by_role('button',name='Save profile',exact=True).click();page.wait_for_function('window.saved.length===1');assert page.evaluate('window.uploads')==1;assert page.evaluate('window.saved[0].petTypes')==['cat','仓鼠','鹦鹉','Turtle']
  page.evaluate('window.controller.destroy();window.mount()');page.locator('[name=nickname]').wait_for();assert page.locator('[name=petTypes][value="仓鼠"]').is_checked()
  for label in ['A','B','C','D','E','F']:
   page.locator('[name=customPetType]').fill(label);page.locator('[data-add-pet-type]').click()
  page.locator('[name=customPetType]').fill('G');page.locator('[data-add-pet-type]').click();assert '10' in page.locator('[data-custom-pet-error]').inner_text();assert page.locator('[name=petTypes]:checked').count()==10
  assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth');page.screenshot(path=str(OUT/f'{width}.png'),full_page=True);report.append({'width':width,'interactionPassed':True});page.close()
 assert not errors,errors;browser.close();(OUT/'report.json').write_text(json.dumps({'headful':True,'synthetic':True,'checks':report,'pageErrors':errors},ensure_ascii=False,indent=2));print(json.dumps(report))
