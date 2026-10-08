"""Real headed DOM regression for the region picker, synthetic directory only."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from functools import partial
import json, os
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results/region-picker-v071';OUT.mkdir(parents=True,exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
base='http://127.0.0.1:'+str(server.server_port)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=os.environ.get('PAW_DIARY_HEADED')!='1')
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.goto(base+'/')
    page.set_content('<link rel="stylesheet" href="'+base+'/style.css"><dialog id="fixture"><div class="dialog-head"><h2>浏览地区</h2></div><div id="regions"></div><div class="form-actions"><button type="button">取消</button><button type="button">使用这个地区</button></div></dialog>')
    page.add_script_tag(type='module',content='''
      import {mountRegionPicker} from '%s/src/ui/region-picker.js';
      import {enhanceSelect} from '%s/src/ui/select-control.js';
      window.calls=[];const cities=Array.from({length:50},(_,i)=>({id:'city'+i,name:'城市'+i}));
      const repository={request:async(action,payload)=>{window.calls.push({action,payload});if(action==='regions.children')return {items:Array.from({length:100},(_,i)=>({id:'d'+i,parentId:payload.parentId,name:'行政区'+i}))};if(payload.query==='slow'){await new Promise(r=>setTimeout(r,500));return {items:[{id:'old',name:'旧结果'}]};}return {items:payload.query?[{id:'matched',name:payload.query+'城市'}]:cities,nextCursor:payload.query?null:'next',updatedAt:1};}};
      window.picker=mountRegionPicker({container:document.querySelector('#regions'),repository,initialValue:{cityId:'city0',cityName:'城市0'},locationSuggest:{suggest:async()=>({reason:'LOCATION_DENIED'})}});
      window.fixture=document.querySelector('#fixture');fixture.showModal();
      const enhanceAll=()=>{for(const s of document.querySelectorAll('select:not([data-enhanced])'))enhanceSelect(s);};
      new MutationObserver(enhanceAll).observe(document.body,{childList:true,subtree:true});enhanceAll();window.ready=true;
    '''%(base,base))
    page.wait_for_function('window.ready && document.querySelector("[data-region-district]").options.length===101')
    city=page.locator('[data-region-city]').locator('..')
    assert not page.locator('.region-picker > .field.full').count(),'Top-level search must be removed'
    city.locator('.select-trigger').click()
    query=city.locator('[data-region-query]')
    expect(query).to_be_visible()
    assert query.evaluate('(x)=>x===document.activeElement'),'Opening city dropdown focuses its first-row search'
    query.fill('北京')
    expect(city.get_by_role('option',name='北京城市',exact=True)).to_be_visible()
    assert page.locator('[data-region-city]').input_value()=='city0','Search must not change selected city'
    query.fill('slow');page.wait_for_timeout(230);query.fill('上海')
    expect(city.get_by_role('option',name='上海城市',exact=True)).to_be_visible()
    page.wait_for_timeout(600)
    assert not city.get_by_role('option',name='旧结果',exact=True).count(),'Late results must not replace current search'
    query.evaluate("e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value='拼音中';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));}")
    before=page.evaluate('calls.length');page.wait_for_timeout(250);assert page.evaluate('calls.length')==before,'IME intermediate text must not request'
    query.evaluate("e=>{e.value='杭州';e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));}")
    expect(city.get_by_role('option',name='杭州城市',exact=True)).to_be_visible()
    page.screenshot(path=str(OUT/'city-search-open.png'))
    page.keyboard.press('ArrowDown');page.keyboard.press('Enter')
    assert page.locator('[data-region-city]').input_value()=='matched'
    measurements=[]
    for width in [1440,768,390]:
      page.set_viewport_size({'width':width,'height':1000})
      district=page.locator('[data-region-district]').locator('..')
      before=page.locator('#fixture').evaluate('(d)=>({height:d.getBoundingClientRect().height,scrollTop:d.scrollTop,scrollHeight:d.scrollHeight})')
      district.locator('.select-trigger').click()
      district.locator('.select-trigger').focus();page.keyboard.press('End')
      after=page.locator('#fixture').evaluate('(d)=>({height:d.getBoundingClientRect().height,scrollTop:d.scrollTop,scrollHeight:d.scrollHeight})')
      assert after==before,{'width':width,'before':before,'after':after}
      options=district.locator('.select-options')
      assert options.evaluate('(x)=>x.scrollTop>0 && x.scrollHeight>x.clientHeight')
      page.screenshot(path=str(OUT/('district-open-'+str(width)+'.png')))
      district.get_by_role('option',name='行政区99',exact=True).click()
      assert page.locator('[data-region-district]').input_value()=='d99'
      district.locator('.select-trigger').click();page.keyboard.press('Escape')
      assert page.locator('#fixture').evaluate('(d)=>d.open'),'Escape closes dropdown without closing parent dialog'
      measurements.append({'width':width,'before':before,'after':after,'innerScrollOnly':True})
      page.screenshot(path=str(OUT/('region-'+str(width)+'.png')))
    page.evaluate('picker.destroy()')
    assert not page.locator('.select-control').count()
    (OUT/'dropdown-report.json').write_text(json.dumps(measurements,indent=2))
    browser.close()
server.shutdown()
print('PASS region picker: embedded search, automatic queries, IME, late requests, keyboard, three-width bounded dropdowns and destroy')
