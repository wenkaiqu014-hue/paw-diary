"""Production UI modules + real IndexedDB, with only AI gateway replies replaced."""
import os,json
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4211/')
OUT=Path(__file__).resolve().parents[2]/'test-results/ai062-parity'
OUT.mkdir(parents=True,exist_ok=True)
today=datetime.now(ZoneInfo('Asia/Shanghai')).date(); future=str(today+timedelta(days=2)); today=str(today)
requests=[]
def snapshot(page):
    return page.evaluate("""async ()=>await new Promise((resolve,reject)=>{const q=indexedDB.open('paw-diary-personal');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,r=db.transaction('workspace').objectStore('workspace').get('singleton');r.onsuccess=()=>{resolve(r.result.snapshot);db.close();};};})""")
def choose(page,row,name,option):
    box=row.locator('[name='+name+']').locator('..')
    box.locator('.select-trigger').click()
    box.get_by_role('option',name=option,exact=True).click()
def close_discard(page):
    page.locator('#close-dialog').click()
    if page.locator('#discard-dialog').is_visible():page.locator('[data-discard-confirm]').click()
    expect(page.locator('#dialog')).not_to_be_visible()
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=os.environ.get('PAW_HEADFUL')!='1')
    page=browser.new_page(viewport={'width':1440,'height':1100});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    # Only the model boundary is injected. Mount production modules with real
    # IndexedDB/catalog/select/date/discard implementations, not a fake repository.
    manifest=json.loads(Path('dist/asset-manifest.json').read_text())
    source=Path('app.js').read_text();icon_source=source[source.index('const icons = {'):source.index('};',source.index('const icons = {'))+2]
    markup='<meta charset="utf-8"><link rel="stylesheet" href="'+BASE+manifest['style']+'"><button data-action="record">添加记录</button><dialog id="dialog"><div class="dialog-head"><h2 id="dialog-title">记下这一次成长</h2><label><select id="dialog-locale-select"><option value="zh-CN">中文</option><option value="en">English</option></select></label><button id="close-dialog">关闭</button></div><div id="host"></div></dialog>'
    page.route(BASE+'ai-parity-harness',lambda r:r.fulfill(content_type='text/html',body=markup))
    page.route(BASE+'src/**',lambda r:r.fulfill(path=str(Path.cwd()/r.request.url.split(BASE,1)[1].split('?',1)[0]),content_type='text/javascript'))
    page.route('https://**/*',lambda r:r.abort())
    page.goto(BASE+'ai-parity-harness',wait_until='networkidle')
    page.evaluate("""async ({today,future,iconsSource})=>{
      const {createAiEntry}=await import('./src/features/ai-entry.js');
      const {mountRecordDialog}=await import('./src/ui/record-dialog.js');
      const {createLocalRepository}=await import('./src/data/local-repository.js');
      const {recordTypeEntries}=await import('./src/domain/record-type-catalog.js');
      const {enhanceRecordTypeSelect}=await import('./src/ui/record-type-picker.js');
      const {enhanceSelect}=await import('./src/ui/select-control.js');
      const {enhanceDateInput}=await import('./src/ui/date-input.js');
      const {createDiscardConfirm}=await import('./src/ui/discard-confirm.js');
      const {getLocale,setLocale,subscribeLocale}=await import('./src/ui/i18n.js');
      const icons=Function(iconsSource+';return icons')();const icon=k=>'<svg class="icon" viewBox="0 0 24 24">'+(icons[k]??'')+'</svg>';
      const repo=createLocalRepository();const pet=await repo.savePet({name:'AI对齐合成验收宠物',type:'cat'});let snap=await repo.snapshot(),generation=1,ui,dirty=false;
      window.mockCalls=[];window.bumpScope=()=>generation++;
      const scope=()=>({repository:repo,generation,petId:pet.id,mode:'local',workspaceId:repo.getWorkspaceId()});
      const enhanceAll=()=>{for(const e of document.querySelectorAll('select:not([data-enhanced])'))enhanceSelect(e,{icons:icon});for(const e of document.querySelectorAll('input[type=date]'))enhanceDateInput(e,{getLocale});};
      const enhanceType=(select,{onCatalogUpdated}={})=>enhanceRecordTypeSelect(select,{getRepository:()=>repo,getSnapshot:()=>repo.snapshot(),getLocale,icons:icon,onUpdated:async (latest,{revision,priorRevision}={})=>{snap=latest;onCatalogUpdated?.(revision,priorRevision);}});
      const request=async(action,payload)=>{window.mockCalls.push(action);if(action==='ai.quota')return {remaining:12};if(action!=='ai.records.parse')throw Error('Unexpected action');return {today,quota:{remaining:11},drafts:[
        {draftId:'past-weight',purpose:'record',petId:pet.id,type:'weight',occurredDate:today,value:4.6,unit:'kg',title:'',note:'称重原备注',missingFields:[],sourceText:'今天4.6公斤'},
        {draftId:'future-daily',purpose:'plan',petId:pet.id,type:'daily',dueDate:future,title:'未来游玩计划',note:'计划原备注',missingFields:[],sourceText:'后天出去玩'},
        {draftId:'future-custom',purpose:'plan',petId:pet.id,type:null,dueDate:future,title:'未来护理计划',note:'自定义原备注',suggestedTypeLabel:'护理',missingFields:['type'],sourceText:'后天护理'}]};};
      const ai=createAiEntry({request,getRepository:()=>repo,getSnapshot:()=>snap,getScope:scope,getLocale,getTypeEntries:()=>recordTypeEntries(snap),enhanceAll,enhanceType,onSaved:async()=>{snap=await repo.snapshot();document.querySelector('#dialog').close();dirty=false;}});
      const discard=createDiscardConfirm({getLocale});const close=()=>dirty?discard.ask(ok=>{if(ok){document.querySelector('#dialog').close();dirty=false;}}):document.querySelector('#dialog').close();
      document.querySelector('#close-dialog').onclick=close;
      document.addEventListener('input',e=>{if(e.target.closest('#dialog'))dirty=true;});
      document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='record'){dirty=false;ui=mountRecordDialog({host:document.querySelector('#host'),petId:pet.id,type:'daily',today,getLocale,getEntries:()=>recordTypeEntries(snap),enhanceAll,enhanceType,onAi:(host,purpose)=>ai.open({host,purpose})});document.querySelector('#dialog').showModal();enhanceAll();}else if(b.dataset.action==='record-mode')ui.setMode(b.dataset.value);else if(b.dataset.action==='close')close();});
      document.querySelector('#dialog-locale-select').addEventListener('change',e=>setLocale(e.target.value));
      subscribeLocale(()=>{ui?.refreshLocale();document.querySelector('#ai-entry-form')?.__pawLocaleRefresh();enhanceAll();});enhanceAll();window.ready=true;
    }""",{'today':today,'future':future,'iconsSource':icon_source})
    page.wait_for_function('window.ready')
    before=snapshot(page)
    page.locator('[data-action=record]').first.click()
    page.locator('[data-action=record-mode][data-value=ai]').click()
    expect(page.locator('#ai-quota')).to_contain_text('12',timeout=10000)
    page.locator('#ai-text').fill('今天4.6公斤，后天出去玩并护理。')
    page.locator('#ai-parse').click()
    expect(page.locator('.ai-draft')).to_have_count(3,timeout=10000)
    rows=page.locator('.ai-draft');weight=rows.nth(0);daily=rows.nth(1);custom=rows.nth(2)
    expect(weight.locator('[name=purpose]')).to_have_value('record')
    expect(weight.locator('[name=title]')).to_have_value('')
    expect(weight.locator('[name=includeInHealth]')).to_be_hidden()
    weight.locator('[name=title]').fill('手写称重标题')
    choose(page,weight,'purpose','安排计划');expect(weight.locator('[name=value]')).to_be_hidden()
    weight.locator('[name=dueDate]').fill(future)
    choose(page,weight,'purpose','记录已发生')
    expect(weight.locator('[name=value]')).to_have_value('4.6');expect(weight.locator('[name=date]')).to_have_value(today)
    expect(weight.locator('[name=title]')).to_have_value('手写称重标题')
    expect(daily.locator('[name=includeInHealth]')).not_to_be_checked()
    choose(page,daily,'type','疫苗');expect(daily.locator('[name=includeInHealth]')).to_be_checked()
    daily.locator('[name=includeInHealth]').uncheck()
    choose(page,daily,'type','驱虫');expect(daily.locator('[name=includeInHealth]')).not_to_be_checked()
    choose(page,daily,'type','日常');expect(daily.locator('[name=includeInHealth]')).not_to_be_checked()
    expect(custom.locator('[name=type]')).to_have_value('')
    typebox=custom.locator('[name=type]').locator('..')
    typebox.locator('.select-trigger').click();typebox.locator('.type-catalog-add').click()
    typebox.locator('[name=catalog-name]').fill('护理验收类型')
    typebox.locator('[data-icon-key=paw]').click();typebox.locator('.type-catalog-save').click()
    expect(custom.locator('[name=type]')).not_to_have_value('')
    typebox.locator('.select-trigger').click();typebox.locator('.type-catalog-manage').click()
    expect(typebox.locator('.type-catalog-list input:disabled')).to_have_count(4)
    expect(typebox.locator('.type-catalog-list input:not(:disabled)')).to_have_count(1)
    typebox.locator('.type-catalog-back').click();typebox.locator('.select-trigger').click()
    # Language refresh keeps every row value and translates shared quota.
    language=page.locator('#dialog-locale-select').locator('..')
    language.locator('.select-trigger').click();language.get_by_role('option',name='English',exact=True).click()
    expect(page.locator('#ai-quota')).to_contain_text('Write a sentence')
    expect(weight.locator('[name=title]')).to_have_value('手写称重标题')
    expect(daily.locator('[name=dueDate]')).to_have_value(future)
    expect(custom.locator('[name=title]')).to_have_value('未来护理计划')
    page.locator('[data-action=record-mode][data-value=manual]').click()
    page.locator('[data-action=record-mode][data-value=ai]').click()
    expect(rows).to_have_count(3);expect(weight.locator('[name=title]')).to_have_value('手写称重标题')
    requests=page.evaluate('window.mockCalls');assert requests.count('ai.records.parse')==1,requests
    page.screenshot(path=str(OUT/'1440-review.png'),full_page=True)
    page.locator('#ai-confirm').click();expect(page.locator('#dialog')).not_to_be_visible(timeout=10000)
    saved=snapshot(page)
    new_records=[r for r in saved['records'] if r['id'] not in {r['id'] for r in before['records']}]
    new_plans=[r for r in saved['reminders'] if r['id'] not in {r['id'] for r in before['reminders']}]
    assert len(new_records)==1 and len(new_plans)==2,(new_records,new_plans)
    assert new_records[0]['type']=='weight' and new_records[0]['value']==4.6 and new_records[0]['title']=='手写称重标题'
    assert all(r.get('includeInHealth') is False for r in new_plans),new_plans
    assert any(r.get('recordType')=='other' and r.get('typeLabel')=='护理验收类型' and r.get('iconKey')=='paw' for r in new_plans),new_plans
    # A new unconfirmed parse followed by cancellation must not write business entries.
    page.locator('[data-action=record]').first.click();page.locator('[data-action=record-mode][data-value=ai]').click()
    page.locator('#ai-text').fill('未确认合成草稿');page.locator('#ai-parse').click();expect(page.locator('.ai-draft')).to_have_count(3)
    close_discard(page)
    cancelled=snapshot(page)
    assert cancelled['records']==saved['records'] and cancelled['reminders']==saved['reminders']
    # A stale owner/pet scope cannot commit otherwise valid selected drafts.
    page.locator('[data-action=record]').first.click();page.locator('[data-action=record-mode][data-value=ai]').click()
    page.locator('#ai-text').fill('作用域切换合成草稿');page.locator('#ai-parse').click();expect(page.locator('.ai-draft')).to_have_count(3)
    page.locator('.ai-draft').nth(2).locator('[name=selected]').uncheck()
    page.evaluate('window.bumpScope()')
    page.locator('#ai-confirm').click()
    expect(page.locator('#ai-entry-form .form-error')).to_contain_text('workspace changed')
    stale=snapshot(page)
    assert stale['records']==saved['records'] and stale['reminders']==saved['reminders']
    close_discard(page)
    page.set_viewport_size({'width':390,'height':1000})
    page.screenshot(path=str(OUT/'390-saved.png'),full_page=True)
    assert not errors,errors
    requests=page.evaluate('window.mockCalls');assert set(requests)=={'ai.quota','ai.records.parse'},requests
    (OUT/'result.json').write_text(json.dumps({'gatewayRequests':requests,'newRecords':len(new_records),'newPlans':len(new_plans),'errors':errors},ensure_ascii=False,indent=2))
    browser.close()
print('PASS production UI: mixed purposes, retained edits, health rules, unknown/custom/catalog, locale/mode, atomic local saves, cancellation and stale scope rejection')
