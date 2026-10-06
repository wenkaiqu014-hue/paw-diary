"""Actual app + actual repositories/backend, with a controlled SDK/platform boundary. No real cloud."""
from pathlib import Path
import json, os, traceback, urllib.request
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('PAW_UI_CONTRACT_URL','http://127.0.0.1:4197/')
OUT=Path(__file__).resolve().parents[2]/'test-results'/'stage2'/'ui-contract'
OUT.mkdir(parents=True,exist_ok=True)
def server_state():return json.load(urllib.request.urlopen(BASE+'__state'))
def reset():urllib.request.urlopen(BASE+'__reset').read()
def login(page):
    page.locator('[data-action=account]').first.click()
    page.locator('#account-login-form [name=email]').fill('fixture@example.invalid')
    page.locator('[data-account-action=send]').click()
    expect(page.locator('#account-login-form [name=code]')).to_be_enabled()
    page.locator('#account-login-form [name=code]').fill('1234')
    page.locator('#account-login-form [type=submit]').click()
    expect(page.locator('#account-actions-form')).to_be_visible()
    page.locator('[data-account-action=close]').click()
    expect(page.locator('.pet-entry')).to_contain_text('Alpha private pet')
def source(page):
    return page.evaluate("""async()=>{const {createLocalRepository}=await import('/src/data/local-repository.js');const {processImage}=await import('/src/media/process-image.js');const repo=createLocalRepository();const pet=await repo.savePet({name:'Imported Rover',type:'dog',estimatedAgeMonths:12});await repo.saveProfile({city:'北京'});const canvas=document.createElement('canvas');canvas.width=48;canvas.height=48;canvas.getContext('2d').fillRect(8,8,20,20);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const image=await processImage(blob,{kind:'avatar'});await repo.media.save({petId:pet.id,kind:'avatar',blob:image.blob,caption:'Profile portrait'});const archive=await repo.exportArchive();await repo.close();return archive;}""")
def migration(page):
    page.locator('[data-action=account]').first.click();expect(page.locator('#account-actions-form')).to_be_visible()
    page.locator('[data-account-action=import]').click();page.locator('#migrate-personal').click()
    expect(page.locator('#confirm-personal-import')).to_be_visible()
def commit(page):
    page.locator('#confirm-personal-import').click();expect(page.locator('#dialog')).not_to_be_visible()
def identity_notify(page):
    login(page);page.locator('[data-action=record]').first.click();page.locator('[name=type]').select_option('daily');page.locator('[name=title]').fill('OLD-A-DRAFT')
    old_generation=page.locator('#record-form').evaluate('(form)=>form.__pawContext.generation')
    page.evaluate("__contract.switchUser('B')")
    expect(page.locator('#dialog')).not_to_be_visible()
    assert 'Alpha private pet' not in page.locator('#main').inner_text()
    # Auth adapter may clear to local before asynchronously verifying B; user explicitly reopens cloud sync.
    if not page.locator('.pet-entry').count():
        expect(page.locator('#workspace-badge')).to_have_text('本地档案')
        page.locator('[data-action=account]').first.click();expect(page.locator('#account-actions-form')).to_be_visible();page.locator('[data-account-action=close]').click()
    expect(page.locator('.pet-entry')).to_contain_text('Beta private pet')
    page.locator('[data-action=record]').first.click()
    assert page.locator('#record-form').evaluate('(form)=>form.__pawContext.generation')>old_generation
    expect(page.locator('[name=value]')).to_have_value('')
def identity_guard(page):
    login(page);page.locator('[data-action=record]').first.click();page.locator('[name=type]').select_option('daily');page.locator('[name=title]').fill('OLD-A-DRAFT')
    page.evaluate("__contract.switchUser('B',{notify:false})")
    page.locator('#record-form [type=submit]').click()
    expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('.pet-entry')).to_contain_text('Beta private pet')
    data=server_state();assert not [call for call in data['calls'] if call['user']=='B' and call['action']=='records.save'],'frontend must reject before issuing an A-draft write as B'
    assert not data['owners']['B']['workspace']['snapshot']['records']
    assert all(call['hasAuthToken'] and not call['tokenInPayload'] for call in data['calls']),'current validated token belongs only at request top level'
def copy_city(page):
    source(page);login(page);migration(page);page.locator('[name=migrate-city]').check();page.locator('#preview-personal-import').click()
    expect(page.locator('#confirm-personal-import')).to_be_visible()
    latest=[call for call in server_state()['calls'] if call['action']=='imports.preview'][-1]
    assert latest['payload'].get('copyCity') is True,'copyCity must be an explicit backend field'
    commit(page);assert server_state()['owners']['A']['workspace']['snapshot']['profile']['city']=='北京'
def avatar_closure(page):
    archive=source(page);login(page);migration(page);page.locator('[data-import-kind=asset]').uncheck();page.locator('#preview-personal-import').click()
    expect(page.locator('#confirm-personal-import')).to_be_visible();commit(page)
    owner=server_state()['owners']['A'];pet=next(p for p in owner['workspace']['snapshot']['pets'] if p['name']=='Imported Rover')
    assert pet['avatarAssetId'] and pet['avatarAssetId'] in owner['media'],'selected pet brings the actual unselected avatar dependency'
    assert owner['media'][pet['avatarAssetId']]['sha256']==archive['assets'][0]['metadata']['sha256']
def duplicate_asset(page):
    source(page);login(page);migration(page);commit(page)
    count=lambda:len([call for call in server_state()['calls'] if call['action']=='media.prepare' and call['payload'].get('importBatchId')])
    assert count()==1;migration(page);commit(page);assert count()==1,'a healthy mapped duplicate must not upload or reserve storage again'
def conflict_accept(page):
    archive=source(page);login(page);migration(page);commit(page)
    archive['snapshot']['pets'][0]['name']='Edited Rover'
    page.locator('[data-action=import]').first.click()
    page.locator('#personal-import-form [name=backup]').set_input_files(dict(name='edited.json',mimeType='application/json',buffer=json.dumps(archive).encode()))
    page.locator('#preview-personal-import').click();expect(page.locator('[data-import-conflict]')).to_be_visible()
    page.locator('[data-import-conflict]').check();commit(page)
    assert any(p['name']=='Edited Rover' for p in server_state()['owners']['A']['workspace']['snapshot']['pets']),'accepted sourceId conflict must update the mapped pet'
def demo_compatibility(page):
    before=page.evaluate("localStorage.getItem('paw-diary:v3:demo')")
    page.locator('[data-action=new-pet]').first.click()
    assert page.locator('#pet-form [name=type] option[value=other]').count()==0,'demo must remain readable by v0.2.0 frozen schema'
    page.locator('#close-dialog').click()
    archive=json.loads(before);archive['pets'][0]['type']='other';archive['pets'][0]['typeLabel']='兔子'
    page.locator('[data-action=import]').first.click();page.locator('#import-form [name=backup]').set_input_files(dict(name='other.json',mimeType='application/json',buffer=json.dumps(archive).encode()))
    page.locator('#import-form [type=submit]').click();expect(page.locator('#import-form .form-error')).to_be_visible()
    assert page.evaluate("localStorage.getItem('paw-diary:v3:demo')")==before
    assert page.evaluate("async()=>{const {validateSnapshot}=await import('/__legacy_schema.js');return validateSnapshot(JSON.parse(localStorage.getItem('paw-diary:v3:demo'))).version}")==3
def offline_same_user(page):
    login(page);page.locator('[data-action=record]').first.click();page.locator('[name=type]').select_option('daily');page.locator('[name=title]').fill('OFFLINE-A-DRAFT')
    page.context.set_offline(True);page.locator('#record-form [type=submit]').click();expect(page.locator('#record-form .form-error')).to_be_visible()
    expect(page.locator('[name=title]')).to_have_value('OFFLINE-A-DRAFT');expect(page.locator('.pet-entry')).to_contain_text('Alpha private pet')
    assert not [call for call in server_state()['calls'] if call['action']=='records.save']
    page.context.set_offline(False);page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible()
    assert server_state()['owners']['A']['workspace']['snapshot']['records'][0]['title']=='OFFLINE-A-DRAFT'
def auth_attributes(page):
    page.locator('[data-action=account]').first.click()
    for field in ['email','code']:
        expect(page.locator('#account-login-form [name='+field+']')).to_have_attribute('spellcheck','false')
        expect(page.locator('#account-login-form [name='+field+']')).to_have_attribute('autocapitalize','none')
    expect(page.locator('[name=email]')).to_have_attribute('autocomplete','email')
    expect(page.locator('[name=code]')).to_have_attribute('autocomplete','one-time-code')
    expect(page.locator('[name=code]')).to_have_attribute('inputmode','numeric')
def stale_source_picker(page):
    source(page);login(page);page.locator('[data-action=account]').first.click();expect(page.locator('#account-actions-form')).to_be_visible();page.locator('[data-account-action=import]').click()
    page.evaluate("""()=>{const original=crypto.subtle.digest.bind(crypto.subtle);window.__holdArchiveHash=true;crypto.subtle.digest=async(...args)=>{if(window.__holdArchiveHash)await new Promise(resolve=>window.__releaseArchiveHash=resolve);const result=await original(...args);window.__archiveHashesCompleted=(window.__archiveHashesCompleted??0)+1;return result;};}""")
    page.locator('#migrate-personal').click();page.wait_for_function('typeof window.__releaseArchiveHash===\"function\"')
    page.evaluate("__contract.switchUser('B')");expect(page.locator('#dialog')).not_to_be_visible()
    page.locator('[data-action=account]').first.click();expect(page.locator('#account-actions-form')).to_be_visible();page.locator('[data-account-action=close]').click()
    expect(page.locator('.pet-entry')).to_contain_text('Beta private pet')
    page.locator('[data-action=record]').first.click();page.locator('[name=type]').select_option('daily');page.locator('[name=title]').fill('B FRESH INPUT')
    page.evaluate('window.__holdArchiveHash=false;window.__releaseArchiveHash()')
    page.wait_for_function('(window.__archiveHashesCompleted??0)>=2')
    expect(page.locator('#record-form')).to_be_visible();expect(page.locator('#record-form [name=title]')).to_have_value('B FRESH INPUT')
    assert page.locator('#personal-import-form').count()==0
    assert not [call for call in server_state()['calls'] if call['user']=='B' and call['action'].startswith('imports.')]
def upload_archive(page,archive):
    page.locator('[data-action=import]').first.click();page.locator('#personal-import-form [name=backup]').set_input_files(dict(name='asset-review.json',mimeType='application/json',buffer=json.dumps(archive).encode()));page.locator('#preview-personal-import').click();expect(page.locator('[data-import-conflict]')).to_be_visible()
def metadata_update(page):
    archive=source(page);login(page);migration(page);commit(page);archive['assets'][0]['metadata']['caption']='Edited portrait';upload_archive(page,archive)
    expect(page.locator('[data-import-conflict]')).to_have_count(1);page.locator('[data-import-conflict]').check();commit(page)
    owner=server_state()['owners']['A'];assert any(asset['caption']=='Edited portrait' and not asset.get('deletedAt') for asset in owner['media'].values())
    assert len([call for call in server_state()['calls'] if call['action']=='media.prepare'])==1,'healthy metadata updates must not stage identical bytes again'
def asset_restore(page):
    archive=source(page);login(page);migration(page);commit(page);data=server_state();owner=data['owners']['A'];pet=next(p for p in owner['workspace']['snapshot']['pets'] if p['name']=='Imported Rover');asset_id=pet['avatarAssetId']
    workspace_id=next(call['expectedWorkspaceId'] for call in data['calls'] if call.get('expectedWorkspaceId'))
    request=dict(version=1,action='media.remove',payload=dict(assetId=asset_id),expectedRevision=owner['workspace']['revision'],expectedWorkspaceId=workspace_id,idempotencyKey='external-avatar-delete',authToken='fixture-token-A')
    reply=json.load(urllib.request.urlopen(urllib.request.Request(BASE+'__contract_api',data=json.dumps(request).encode(),headers={'content-type':'application/json','x-fixture-principal':'A'})));assert reply['ok']
    migration(page);expect(page.locator('[data-import-conflict]')).to_have_count(2)
    for box in page.locator('[data-import-conflict]').all():box.check()
    commit(page);owner=server_state()['owners']['A'];pet=next(p for p in owner['workspace']['snapshot']['pets'] if p['name']=='Imported Rover')
    assert pet['avatarAssetId']==asset_id,'restore keeps stable mapped avatar identity'
    assert not owner['media'][asset_id].get('deletedAt') and owner['media'][asset_id]['sha256']==archive['assets'][0]['metadata']['sha256']
    assert len([call for call in server_state()['calls'] if call['action']=='media.prepare'])==2,'accepted deleted-asset restore requires one new verified ticket'
def control(values):
    urllib.request.urlopen(urllib.request.Request(BASE+'__control',data=json.dumps(values).encode(),headers={'content-type':'application/json'})).read()
def expired_session(page,server=False):
    page.clock.install();login(page);page.locator('[data-action=record]').first.click();page.locator('[name=type]').select_option('daily');page.locator('[name=title]').fill('EXPIRED A DRAFT')
    if server:control(dict(deniedA=True))
    else:page.evaluate('__contract.setSessionError(401)')
    page.locator('#record-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible();expect(page.locator('#workspace-badge')).to_have_text('本地档案')
    assert 'Alpha private pet' not in page.locator('#main').inner_text()
    page.locator('[data-action=account]').first.click();expect(page.locator('#account-login-form')).to_be_visible();assert page.evaluate('__contract.signOutCount()')==0;page.clock.fast_forward(61000)
    page.locator('[name=email]').fill('fixture@example.invalid');page.locator('[data-account-action=send]').click();expect(page.locator('[name=code]')).to_be_enabled();page.locator('[name=code]').fill('1234');page.locator('#account-login-form [type=submit]').click();expect(page.locator('#account-actions-form')).to_be_visible();page.locator('[data-account-action=close]').click();expect(page.locator('.pet-entry')).to_contain_text('Alpha private pet')
    assert not server_state()['owners']['A']['workspace']['snapshot']['records'],'expired draft must not be migrated or auto-submitted after verification'
def sdk_expired(page):expired_session(page)
def server_expired(page):expired_session(page,server=True)
def stale_expired_reply(page):
    login(page);page.locator('[data-action=record]').first.click();page.locator('[name=type]').select_option('daily');page.locator('[name=title]').fill('OLD A EXPIRED REQUEST');control(dict(deniedA=True,holdA=True));page.locator('#record-form [type=submit]').click()
    with page.expect_response(lambda response:response.url.endswith('/__contract_api') and response.request.post_data_json.get('action')=='records.save') as pending:
        # Response for A is held; switch to verified B before releasing it.
        page.wait_for_function("document.querySelector('#record-form [type=submit]').disabled")
        page.evaluate("__contract.switchUser('B')");expect(page.locator('#dialog')).not_to_be_visible();page.locator('[data-action=account]').first.click();expect(page.locator('#account-actions-form')).to_be_visible();page.locator('[data-account-action=close]').click();expect(page.locator('.pet-entry')).to_contain_text('Beta private pet');page.locator('[data-action=record]').first.click();page.locator('[name=type]').select_option('daily');page.locator('[name=title]').fill('B NEW INPUT');urllib.request.urlopen(BASE+'__release').read()
    expect(page.locator('#record-form [name=title]')).to_have_value('B NEW INPUT');expect(page.locator('.pet-entry')).to_contain_text('Beta private pet');assert page.evaluate('__contract.current()')=='B' and page.evaluate('__contract.signOutCount()')==0
cases={'identity_notify':identity_notify,'identity_guard':identity_guard,'copy_city':copy_city,'avatar_closure':avatar_closure,'duplicate_asset':duplicate_asset,'conflict_accept':conflict_accept,'demo_compatibility':demo_compatibility,'offline_same_user':offline_same_user,'auth_attributes':auth_attributes,'stale_source_picker':stale_source_picker,'metadata_update':metadata_update,'asset_restore':asset_restore,'sdk_expired':sdk_expired,'server_expired':server_expired,'stale_expired_reply':stale_expired_reply}
selected=os.environ.get('PAW_UI_CONTRACT_CASE');failures=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    for name,run in cases.items():
        if selected and selected!=name:continue
        reset();context=browser.new_context(viewport=dict(width=1440,height=1000));page=context.new_page();page.set_default_timeout(5000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        try:
            page.goto(BASE+'#health',wait_until='networkidle');run(page);assert not errors,errors;print('PASS',name,flush=True)
        except Exception:
            failures.append(name);(OUT/(name+'.txt')).write_text(traceback.format_exc());(OUT/(name+'-state.json')).write_text(json.dumps(server_state(),ensure_ascii=False,indent=2));(OUT/(name+'-trace.json')).write_text(json.dumps(page.evaluate('window.__contractTrace??[]'),ensure_ascii=False,indent=2));print('FAIL',name,flush=True)
        finally:context.close()
    browser.close()
assert not failures,failures
