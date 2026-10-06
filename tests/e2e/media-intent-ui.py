"""Real app/backend and real LocalRepository receipts prove retry-intent behavior. No real cloud."""
from pathlib import Path
import os,traceback,urllib.request,json
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('PAW_UI_CONTRACT_URL','http://127.0.0.1:4197/')
OUT=Path(__file__).resolve().parents[2]/'test-results'/'stage2'/'media-intent';OUT.mkdir(parents=True,exist_ok=True)
def state():return json.load(urllib.request.urlopen(BASE+'__state'))
def image(page,color,name):
    data=page.evaluate("""async color=>{const canvas=document.createElement('canvas');canvas.width=80;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(5,5,70,70);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));return Array.from(new Uint8Array(await blob.arrayBuffer()));}""",color)
    return dict(name=name,mimeType='image/png',buffer=bytes(data))
def login(page):
    page.locator('[data-action=account]').first.click();page.locator('[name=email]').fill('fixture@example.invalid');page.locator('[data-account-action=send]').click();expect(page.locator('[name=code]')).to_be_enabled();page.locator('[name=code]').fill('1234');page.locator('#account-login-form [type=submit]').click();expect(page.locator('#account-actions-form')).to_be_visible();page.locator('[data-account-action=close]').click()
def avatar(page):
    login(page);page.locator('[data-action=manage-pets]').click();page.locator('.pet-entry [data-action=edit-pet]').click();page.locator('#pet-form [data-action=avatar-pet]').click();expect(page.locator('#avatar-form')).to_be_visible()
def failed_avatar(page,payload):
    failures=[1]
    def upload(route):
        if failures[0]:failures[0]-=1;route.abort()
        else:route.continue_()
    page.route('**/__upload/**',upload);page.locator('[name=avatar]').set_input_files(payload);page.locator('#avatar-form [type=submit]').click();expect(page.locator('#avatar-form .form-error')).to_be_visible()
    prepares=[c for c in state()['calls'] if c['action']=='media.prepare'];assert prepares and prepares[0]['ok'],'failure must occur after a real durable prepare receipt'
def avatar_same(page):
    payload=image(page,'#b96233','first.png');avatar(page);failed_avatar(page,payload);page.locator('#avatar-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible()
    prepares=[c for c in state()['calls'] if c['action']=='media.prepare'];assert prepares[0]['idempotencyKey']==prepares[1]['idempotencyKey']
    assert state()['owners']['A']['workspace']['snapshot']['pets'][0]['avatarAssetId']
def avatar_changed(page):
    first=image(page,'#b96233','first.png');second=image(page,'#2c5847','second.png');avatar(page);failed_avatar(page,first);page.locator('[name=avatar]').set_input_files(second);page.locator('#avatar-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible()
    prepares=[c for c in state()['calls'] if c['action']=='media.prepare'];assert prepares[0]['idempotencyKey']!=prepares[1]['idempotencyKey'];assert prepares[1]['ok']
def avatar_busy(page):
    payload=image(page,'#b96233','first.png');avatar(page);observed=[]
    def uploading(route):
        observed.append(page.locator('#avatar-form [name=avatar]').is_disabled());route.abort()
    page.route('**/__upload/**',uploading);page.locator('[name=avatar]').set_input_files(payload);page.locator('#avatar-form [type=submit]').click()
    expect(page.locator('#avatar-form .form-error')).to_be_visible();assert observed==[True],'native file input must be locked while the real prepared upload is in flight'
    expect(page.locator('[name=avatar]')).to_be_enabled();assert page.locator('[name=avatar]').evaluate('(el)=>el.files.length')==1

def photo(page,hold=False):
    page.evaluate("""async hold=>{const {createLocalRepository}=await import('/src/data/local-repository.js');const {createPhotoWall}=await import('/src/features/photo-wall.js');const {createI18n}=await import('/src/ui/i18n.js');window.photoRepo=createLocalRepository({dbName:'intent-'+crypto.randomUUID()});window.petA=await photoRepo.savePet({name:'A mock pet',type:'cat',estimatedAgeMonths:12});window.petB=await photoRepo.savePet({name:'B mock pet',type:'cat',estimatedAgeMonths:12});window.photoPetId=petA.id;window.photoGeneration=0;window.photoCalls=[];window.failAfterCommit=true;document.body.innerHTML='<main><div id="intent-wall"></div></main>';const media={...photoRepo.media,save:async input=>{photoCalls.push({key:input.operationId,caption:input.caption});if(hold)await new Promise(resolve=>window.releasePhotoFailure=()=>{hold=false;resolve()});if(window.holdFailedReply)throw Object.assign(new Error('unavailable'),{code:'UNAVAILABLE'});const value=await photoRepo.media.save(input);if(window.failAfterCommit)throw Object.assign(new Error('lost response'),{code:'UNAVAILABLE'});return value;}};window.wall=createPhotoWall({media,getPetId:()=>photoPetId,getGeneration:()=>photoGeneration,getRevision:()=>photoRepo.getRevision(),t:createI18n({storage:null}).t,document});await wall.mount(document.querySelector('#intent-wall'));}""",hold)
def fail_photo(page):
    payload=image(page,'#b96233','photo.png');page.locator('[name=photos]').set_input_files(payload);page.locator('[name=photo-caption]').fill('First caption');page.get_by_role('button',name='保存照片',exact=True).click();expect(page.locator('.paw-photo-status')).to_have_attribute('role','alert');assert page.evaluate("async()=> (await photoRepo.media.list({petId:petA.id})).items.length")==1,'the first actual LocalRepository receipt must have committed before its response is lost';assert page.locator('[name=photos]').evaluate('(el)=>el.files.length')==1

def photo_same(page):
    photo(page);fail_photo(page);page.evaluate('window.failAfterCommit=false');page.get_by_role('button',name='保存照片',exact=True).click();expect(page.locator('.paw-photo-status')).to_have_text('照片已保存。');calls=page.evaluate('photoCalls');assert calls[0]['key']==calls[1]['key'];assert page.evaluate("async()=> (await photoRepo.media.list({petId:petA.id})).items.length")==1

def photo_changed_caption(page):
    photo(page);fail_photo(page);page.evaluate('window.failAfterCommit=false');page.locator('[name=photo-caption]').fill('Changed caption');page.get_by_role('button',name='保存照片',exact=True).click();expect(page.locator('.paw-photo-status')).to_have_text('照片已保存。');calls=page.evaluate('photoCalls');assert calls[0]['key']!=calls[1]['key'];assert page.evaluate("async()=> (await photoRepo.media.list({petId:petA.id})).items.some(a=>a.caption==='Changed caption')")
def photo_old_generation(page):
    photo(page,hold=True);page.evaluate('window.holdFailedReply=true');page.locator('[name=photos]').set_input_files(image(page,'#b96233','A-photo.png'));page.locator('[name=photo-caption]').fill('A old draft');page.get_by_role('button',name='保存照片',exact=True).click();page.wait_for_function('typeof window.releasePhotoFailure===\"function\"')
    page.evaluate('async()=>{photoGeneration++;photoPetId=petB.id;await wall.render();window.releasePhotoFailure();}');expect(page.get_by_role('button',name='保存照片',exact=True)).to_be_enabled();page.evaluate('window.holdFailedReply=false;window.failAfterCommit=false');page.get_by_role('button',name='保存照片',exact=True).click()
    expect(page.locator('.paw-photo-grid')).to_contain_text('还没有照片');assert page.evaluate("async()=> (await photoRepo.media.list({petId:petB.id})).items.length")==0,'failed A entry must not be retried as B with no new selection'
cases={'avatar_same':avatar_same,'avatar_changed':avatar_changed,'avatar_busy':avatar_busy,'photo_same':photo_same,'photo_changed_caption':photo_changed_caption,'photo_old_generation':photo_old_generation}
failures=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    for name,run in cases.items():
        if os.environ.get('PAW_MEDIA_INTENT_CASE') and os.environ['PAW_MEDIA_INTENT_CASE']!=name:continue
        urllib.request.urlopen(BASE+'__reset').read();context=browser.new_context(viewport=dict(width=1440,height=1000));page=context.new_page();page.set_default_timeout(5000)
        try:page.goto(BASE+'#health',wait_until='networkidle');run(page);print('PASS',name,flush=True)
        except Exception:failures.append(name);(OUT/(name+'.txt')).write_text(traceback.format_exc());print('FAIL',name,flush=True)
        finally:context.close()
    browser.close()
assert not failures,failures
