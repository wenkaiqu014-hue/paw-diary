"""Real DOM + IndexedDB media module acceptance; independent of app mounting."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4193/').rstrip('/')+'/'
OUT=Path(os.environ.get('PAW_DIARY_TEST_OUTPUT_DIR',str(Path(__file__).resolve().parents[2]/'test-results'/'stage2'/'ui-browser')))
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=os.environ.get('PAW_DIARY_HEADED')!='1',executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    page=browser.new_page(viewport=dict(width=1440,height=1000),reduced_motion='reduce')
    page.set_default_timeout(7000)
    page.route('**/ui-harness',lambda route:route.fulfill(content_type='text/html',body='<html><head><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="src/ui/photo-wall.css"></head><body><main><div id="wall"></div></main></body></html>'))
    page.goto(BASE+'ui-harness',wait_until='networkidle')
    page.evaluate("""async()=>{
      const {createLocalRepository}=await import('./src/data/local-repository.js');
      const {createPhotoWall}=await import('./src/features/photo-wall.js');
      const {createI18n}=await import('./src/ui/i18n.js');
      window.repo=createLocalRepository({dbName:'ui-browser-'+crypto.randomUUID()});
      const a=await repo.savePet({name:'糯米原文',type:'cat',estimatedAgeMonths:12});
      const b=await repo.savePet({name:'豆豆原文',type:'dog',estimatedAgeMonths:24});
      window.petA=a.id;window.petB=b.id;window.currentPet=a.id;window.generation=0;
      window.i18n=createI18n({storage:null});window.failSave=false;window.readFail=false;
      const media={...repo.media,save:async input=>{if(window.deferSave)await new Promise(resolve=>window.finishSave=resolve);if(window.failSave)throw Object.assign(new Error('offline private debug'),{code:'unavailable'});return repo.media.save(input);},resolveUrl:async id=>{if(window.readFail)throw Error('offline');return repo.media.resolveUrl(id);}};
      window.photoWall=createPhotoWall({media,getPetId:()=>window.currentPet,getGeneration:()=>window.generation,getRevision:()=>repo.getRevision(),t:i18n.t});
      await photoWall.mount(document.querySelector('#wall'));
      window.makePhoto=async()=>{const c=document.createElement('canvas');c.width=900;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='#b96233';ctx.fillRect(0,0,900,600);return await new Promise(resolve=>c.toBlob(async blob=>resolve(Array.from(new Uint8Array(await blob.arrayBuffer()))),'image/png'));};
    }""")
    expect(page.get_by_text('还没有照片',exact=True)).to_be_visible()
    payload=dict(name='pet.png',mimeType='image/png',buffer=bytes(page.evaluate('makePhoto()')))
    page.locator('[name=photos]').set_input_files(payload)
    page.locator('[name=photo-caption]').fill('照片原文 <b>不可执行</b> '+('很长的说明'*15))
    page.get_by_role('button',name='保存照片',exact=True).click()
    expect(page.locator('.paw-photo-tile')).to_have_count(1)
    expect(page.locator('.paw-photo-tile img').first).to_have_attribute('src',__import__('re').compile(r'^blob:'))
    expect(page.locator('.paw-photo-tile').get_by_role('button',name='重试',exact=True)).not_to_be_visible()
    print('PASS original image compression saves a real Blob in IndexedDB')
    assert page.locator('.paw-photo-caption b').count()==0
    assert page.locator('[name=photo-caption]').get_attribute('maxlength')=='200'
    # Failed real upload retains its selected file and caption; locale refresh retains both.
    page.evaluate('window.failSave=true')
    page.locator('[name=photos]').set_input_files(payload)
    page.locator('[name=photo-caption]').fill('上传失败原文保留')
    page.get_by_role('button',name='保存照片',exact=True).click()
    expect(page.locator('.paw-photo-status')).to_contain_text('未保存')
    page.evaluate("async()=>{i18n.setLocale('en');await photoWall.render()}")
    expect(page.locator('[name=photo-caption]')).to_have_value('上传失败原文保留')
    assert page.locator('[name=photos]').evaluate('(el)=>el.files.length')==1
    page.evaluate('window.failSave=false')
    page.get_by_role('button',name='Save photos',exact=True).click()
    expect(page.locator('.paw-photo-tile')).to_have_count(2)
    expect(page.locator('.paw-photo-status')).to_have_text('Photos saved.')
    print('PASS failure retains files/caption, locale does not discard draft, retry adds only the failed photo')
    page.get_by_role('button',name='Full-screen slideshow',exact=True).click()
    expect(page.locator('dialog.paw-slideshow')).to_be_visible()
    expect(page.locator('.paw-slideshow').get_by_role('button',name='Play',exact=True)).to_be_visible()
    original=page.locator('.paw-slideshow-caption').inner_text()
    page.wait_for_timeout(4200)
    assert page.locator('.paw-slideshow-caption').inner_text()==original,'slideshow must start paused'
    page.keyboard.press('ArrowRight')
    assert page.locator('.paw-slideshow-caption').inner_text()!=original
    page.locator('.paw-slideshow').get_by_role('button',name='Play',exact=True).click()
    expect(page.locator('.paw-slideshow').get_by_role('button',name='Pause',exact=True)).to_have_attribute('aria-pressed','true')
    page.locator('.paw-slideshow').get_by_role('button',name='Pause',exact=True).click()
    page.keyboard.press('Escape')
    expect(page.locator('dialog.paw-slideshow')).not_to_be_visible()
    assert page.evaluate("document.activeElement.textContent")=='Full-screen slideshow'
    print('PASS slideshow starts paused, keyboard advances, play/pause and Escape restore focus')
    page.evaluate("async()=>{window.currentPet=petB;await photoWall.render()}")
    expect(page.get_by_text('No photos yet',exact=True)).to_be_visible()
    page.evaluate("async()=>{window.currentPet=petA;window.readFail=true;await photoWall.render()}")
    expect(page.locator('.paw-photo-tile').get_by_role('button',name='Retry',exact=True).first).to_be_visible()
    page.evaluate('window.readFail=false')
    page.locator('.paw-photo-tile').get_by_role('button',name='Retry',exact=True).first.click()
    expect(page.locator('.paw-photo-tile img').first).to_have_attribute('src',__import__('re').compile(r'^blob:'))
    print('PASS current-pet isolation and failed image retry')
    # Parent trash hides metadata and retains bytes; restoration returns the same photos.
    page.evaluate("async()=>{await repo.moveToTrash({kind:'pet',ids:[petA]});await photoWall.render()}")
    expect(page.locator('.paw-photo-tile')).to_have_count(0)
    page.evaluate("async()=>{await repo.restoreFromTrash({kind:'pet',ids:[petA]});await photoWall.render()}")
    expect(page.locator('.paw-photo-tile')).to_have_count(2)
    print('PASS parent trash hides photos and restoration retains them')
    for width in [1440,768,390,360]:
        page.set_viewport_size(dict(width=width,height=900))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'overflow at {width}'
        if os.environ.get('PAW_DIARY_CAPTURE')=='1':
            page.screenshot(path=str(OUT/f'photo-wall-{width}.png'),full_page=True)
    page.get_by_role('button',name='Full-screen slideshow',exact=True).click()
    page.on('dialog',lambda dialog:dialog.accept())
    page.locator('.paw-slideshow').get_by_role('button',name='Delete',exact=True).click()
    expect(page.locator('.paw-photo-tile')).to_have_count(1)
    page.locator('.paw-slideshow').get_by_role('button',name='Delete',exact=True).click()
    expect(page.locator('.paw-photo-tile')).to_have_count(0)
    expect(page.locator('dialog.paw-slideshow')).not_to_be_visible()
    assert page.evaluate("document.activeElement.textContent")=='Save photos','last deletion must return to an enabled control'
    assert page.evaluate("async()=> (await repo.media.list({petId:petA})).items.length")==0
    print('PASS explicit permanent delete removes last photo, exits slideshow and restores usable focus')
    page.evaluate('window.deferSave=true')
    page.locator('[name=photos]').set_input_files(payload)
    page.get_by_role('button',name='Save photos',exact=True).click()
    page.wait_for_function('typeof window.finishSave==="function"')
    page.evaluate("async()=>{window.currentPet=petB;await photoWall.render();window.finishSave();}")
    expect(page.get_by_role('button',name='Save photos',exact=True)).to_be_enabled()
    expect(page.locator('[name=photos]')).to_be_enabled()
    expect(page.locator('[name=photo-caption]')).to_be_enabled()
    expect(page.get_by_text('No photos yet',exact=True)).to_be_visible()
    print('PASS switching pet during an in-flight upload clears the old draft without locking the new pet form')
    browser.close()
