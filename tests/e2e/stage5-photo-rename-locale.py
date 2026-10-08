"""Real Chrome DOM regression for photo rename rerenders. Synthetic adapter, no cloud."""
import functools, http.server, json, os, pathlib, threading
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results/stage5/photo-rename-locale'
OUT.mkdir(parents=True, exist_ok=True)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}'
HTML = '''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/photo-wall.css"></head><body><main id="host"></main><script type="module">
import {createPhotoWall} from '/src/features/photo-wall.js';
import {createI18n} from '/src/ui/i18n.js';
window.i18n=createI18n({storage:null});window.pet='a';window.generation=0;window.renameCalls=[];window.changes=0;
window.assets=[{id:'photo-a',petId:'a',kind:'photo',displayName:'original-a.png',caption:'synthetic caption'},{id:'photo-b',petId:'b',kind:'photo',displayName:'original-b.png',caption:''}];
const media={list:async({petId})=>({items:assets.filter(item=>item.petId===petId).map(item=>({...item}))}),resolveUrl:async()=>({url:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',release(){}}),rename:async input=>{renameCalls.push(input);if(window.deferRename)await new Promise(resolve=>window.finishRename=resolve);if(window.failRename)throw Object.assign(new Error('synthetic unavailable'),{code:'unavailable'});const item=assets.find(item=>item.id===input.assetId);if(item)item.displayName=input.displayName;},remove:async()=>{},save:async()=>{throw Error('unexpected save')}};
window.wall=createPhotoWall({media,getPetId:()=>pet,getGeneration:()=>generation,t:i18n.t,onChanged:()=>{changes++}});
await wall.mount(document.querySelector('#host'));window.ready=true;
</script></body></html>'''

def fresh(page):
    page.goto(BASE + '/photo-fixture', wait_until='networkidle')
    page.wait_for_function('window.ready===true')

def edit(page, value='synthetic unsaved rename'):
    page.get_by_role('button', name='重命名', exact=True).click()
    page.locator('.paw-photo-rename-input').fill(value)
    assert page.evaluate('wall.hasUnsavedChanges()')

checks, failures = [], []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=os.environ.get('PAW_HEADFUL', '1') != '1')
        page = browser.new_page(viewport={'width':1000, 'height':900})
        page.set_default_timeout(3000)
        page.route('**/photo-fixture', lambda route:route.fulfill(content_type='text/html', body=HTML))
        errors = []
        page.on('pageerror', lambda error:errors.append(str(error)))

        def check(name, action):
            fresh(page)
            try:
                action()
                checks.append(name)
                print('PASS ' + name, flush=True)
            except Exception as error:
                failures.append({'name':name, 'error':str(error)})
                print('FAIL ' + name + ': ' + str(error), flush=True)

        def locale_draft():
            edit(page)
            page.evaluate('window.originalEditor=document.querySelector(".paw-photo-rename");window.originalInput=document.querySelector(".paw-photo-rename-input")')
            page.evaluate('async()=>{i18n.setLocale("en");await wall.render()}')
            expect(page.locator('.paw-photo-rename')).to_have_count(1)
            expect(page.locator('.paw-photo-rename-input')).to_have_value('synthetic unsaved rename')
            assert page.evaluate('document.querySelector(".paw-photo-rename")===originalEditor && document.querySelector(".paw-photo-rename-input")===originalInput')
            expect(page.locator('.paw-photo-rename input')).to_have_attribute('aria-label', 'Photo name')
            expect(page.locator('.paw-photo-rename label')).to_contain_text('Photo name')
            expect(page.locator('.paw-photo-rename').get_by_role('button', name='Save', exact=True)).to_be_visible()
            expect(page.locator('.paw-photo-rename').get_by_role('button', name='Cancel', exact=True)).to_be_visible()
            assert page.evaluate('wall.hasUnsavedChanges() && !wall.isSaving()')
            assert page.evaluate('renameCalls.length') == 0
            page.screenshot(path=str(OUT/'locale-draft-preserved.png'))
            page.locator('.paw-photo-rename').get_by_role('button', name='Cancel', exact=True).click()
            expect(page.locator('.paw-photo-rename')).to_have_count(0)
            assert not page.evaluate('wall.hasUnsavedChanges()')

        def repeated_render():
            edit(page)
            page.evaluate('async()=>{await wall.render();await wall.render()}')
            expect(page.locator('.paw-photo-rename-input')).to_have_value('synthetic unsaved rename')
            expect(page.locator('.paw-photo-rename')).to_have_count(1)
            page.locator('.paw-photo-rename').get_by_role('button', name='保存', exact=True).click()
            expect(page.locator('.paw-photo-caption')).to_have_text('synthetic unsaved rename')
            assert page.evaluate('renameCalls.length') == 1
            assert page.evaluate('changes') == 1
            assert not page.evaluate('wall.hasUnsavedChanges() || wall.isSaving()')

        def pending_save():
            edit(page, 'pending synthetic rename')
            page.evaluate('window.deferRename=true')
            page.locator('.paw-photo-rename').get_by_role('button', name='保存', exact=True).click()
            page.wait_for_function('typeof finishRename==="function"')
            page.evaluate('async()=>{i18n.setLocale("en");await wall.render();await wall.render()}')
            expect(page.locator('.paw-photo-rename-input')).to_have_value('pending synthetic rename')
            for selector in ['input', 'button[type=submit]', 'button[type=button]']:
                expect(page.locator('.paw-photo-rename '+selector)).to_be_disabled()
            assert page.evaluate('wall.hasUnsavedChanges() && wall.isSaving()')
            page.evaluate('document.querySelector(".paw-photo-rename").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}))')
            assert page.evaluate('renameCalls.length') == 1
            page.screenshot(path=str(OUT/'pending-save-preserved.png'))
            page.evaluate('finishRename()')
            expect(page.locator('.paw-photo-caption')).to_have_text('pending synthetic rename')
            expect(page.locator('.paw-photo-rename')).to_have_count(0)
            assert not page.evaluate('wall.hasUnsavedChanges() || wall.isSaving()')
            assert page.evaluate('changes') == 1

        def failed_save():
            edit(page, 'failed synthetic rename')
            page.evaluate('window.deferRename=true;window.failRename=true')
            page.locator('.paw-photo-rename').get_by_role('button', name='保存', exact=True).click()
            page.wait_for_function('typeof finishRename==="function"')
            page.evaluate('async()=>{await wall.render();finishRename()}')
            expect(page.locator('.paw-photo-rename-input')).to_have_value('failed synthetic rename')
            expect(page.locator('.paw-photo-rename-input')).to_be_enabled()
            expect(page.locator('.paw-photo-status')).to_have_attribute('role','alert')
            assert page.evaluate('wall.hasUnsavedChanges() && !wall.isSaving()')
            expect(page.locator('[name=photos]')).to_be_enabled()
            expect(page.locator('[name=photo-caption]')).to_be_enabled()
            page.locator('.paw-photo-rename').get_by_role('button', name='取消', exact=True).click()
            assert not page.evaluate('wall.hasUnsavedChanges()')

        def scope_change(change):
            edit(page)
            page.evaluate(f'async()=>{{{change};await wall.render()}}')
            expect(page.locator('.paw-photo-rename')).to_have_count(0)
            assert not page.evaluate('wall.hasUnsavedChanges()')
            assert page.evaluate('renameCalls.length') == 0
            expect(page.locator('.paw-photo-caption')).to_have_text('original-b.png' if change=='pet="b"' else 'original-a.png')

        def removed_asset():
            edit(page)
            page.evaluate('async()=>{assets=assets.filter(item=>item.id!=="photo-a");await wall.render()}')
            expect(page.locator('.paw-photo-rename')).to_have_count(0)
            assert not page.evaluate('wall.hasUnsavedChanges()')

        def pending_scope_change():
            edit(page)
            page.evaluate('window.deferRename=true')
            page.locator('.paw-photo-rename').get_by_role('button', name='保存', exact=True).click()
            page.wait_for_function('typeof finishRename==="function"')
            page.evaluate('async()=>{pet="b";await wall.render();finishRename()}')
            expect(page.locator('.paw-photo-caption')).to_have_text('original-b.png')
            expect(page.locator('.paw-photo-rename')).to_have_count(0)
            page.wait_for_function('!wall.isSaving()')
            assert not page.evaluate('wall.hasUnsavedChanges()')
            assert page.evaluate('changes') == 0

        check('locale translates editor chrome and retains user draft; cancel clears dirty', locale_draft)
        check('repeated renders retain one editor and one submit listener', repeated_render)
        check('pending rename survives locale and render with disabled controls; saves once', pending_save)
        check('pending failure retains editable name and cancel clears dirty', failed_save)
        check('pet scope change discards old editor without another write', lambda:scope_change('pet="b"'))
        check('generation scope change discards old editor without another write', lambda:scope_change('generation++'))
        check('deleted current asset clears old editor and draft reference', removed_asset)
        check('late rename completion cannot repaint another pet', pending_scope_change)
        assert not errors, errors
        result={'headful':os.environ.get('PAW_HEADFUL','1')=='1','checks':checks,'failures':failures,'pageErrors':errors}
        (OUT/'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(json.dumps(result, ensure_ascii=False), flush=True)
        browser.close()
        assert not failures, failures
finally:
    server.shutdown()
