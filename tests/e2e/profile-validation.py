"""Synthetic profile validation, actual DOM focus/inline descriptions, no cloud writes."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/v101/profile-validation';OUT.mkdir(parents=True,exist_ok=True)
FIXTURE=r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/src/ui/community.css"><body><main style="max-width:1000px;margin:auto"><div id="fixture"></div></main><script type="module">
import {mountProfile} from '/src/features/profile.js';import {mountRegionPicker} from '/src/ui/region-picker.js';
window.saved=0;window.serverInvalid=false;window.language='zh-CN';window.controller=mountProfile({container:document.querySelector('#fixture'),getSession:()=>({userId:'A',generation:1}),getLocale:()=>window.language,mountRegionPicker,repository:{request:async(action,payload)=>{
if(action==='profiles.getOwn')return {nickname:'测试昵称',bio:'',cityId:null,districtId:null,petTypes:[],purposes:[],discoverable:false,avatarAssetId:null,revision:1};
if(action==='auth.getOwn')return {email:'synthetic@example.test'};
if(action==='community.hidden.list')return {items:[],nextCursor:null};
if(action==='regions.search')return {items:[{id:'310100',name:'上海市',level:'city'}],nextCursor:null,version:'synthetic',updatedAt:'2026-10-08T10:00:00Z'};
if(action==='regions.children')return {items:[]};
if(action==='profiles.saveOwn'){window.saved++;if(window.serverInvalid)throw {code:'INVALID_INPUT'};return {...payload,revision:2};}throw {code:'INVALID_INPUT'};}}});
</script></body></html>'''
(OUT/'fixture.html').write_text(FIXTURE)
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=False);page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('PAW_V101_TEST_ORIGIN','http://127.0.0.1:4197')+'/test-results/v101/profile-validation/fixture.html');page.locator('[name="nickname"]').wait_for(timeout=4000)
 page.locator('[name="nickname"]').fill('   ');page.get_by_role('button',name='保存资料',exact=True).click();page.wait_for_function("document.activeElement?.name==='nickname'");assert page.locator('[data-profile-field-error]').inner_text()=='请填写昵称。';assert page.evaluate('window.saved')==0
 page.locator('[name="nickname"]').fill('测试昵称');page.locator('[name="discoverable"]').check();page.get_by_role('button',name='保存资料',exact=True).click();page.wait_for_function("document.activeElement?.classList.contains('select-trigger')");assert '请选择城市' in page.locator('[data-profile-field-error]').inner_text();assert page.evaluate('window.saved')==0
 page.locator('[name="discoverable"]').uncheck();page.evaluate('window.serverInvalid=true');page.locator('[name="bio"]').fill('保留这条编辑');page.get_by_role('button',name='保存资料',exact=True).click();page.wait_for_function("document.activeElement?.matches('[data-profile-error]')");assert '当前输入和已有资料均已保留' in page.locator('[data-profile-error]').inner_text();assert page.locator('[name="bio"]').input_value()=='保留这条编辑';assert page.locator('[data-profile-field-error]').count()==0
 page.evaluate("window.language='en';window.controller.refreshLocale()");page.locator('[name="nickname"]').fill('   ');page.get_by_role('button',name='Save profile',exact=True).click();page.wait_for_function("document.activeElement?.name==='nickname'");assert page.locator('[data-profile-field-error]').inner_text()=='Enter a nickname.'
 assert not errors,errors;page.screenshot(path=str(OUT/'validation.png'),full_page=True);browser.close()
 report={'synthetic':True,'headfulChromium':True,'nicknameFocus':True,'cityComboboxFocus':True,'unknownServerErrorRetainsInputs':True,'englishFeedback':True,'pageErrors':errors};(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report))
