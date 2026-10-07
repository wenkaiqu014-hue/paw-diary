"""Review regressions through Chrome, isolated IDB, shipped UI, and synthetic media.

No account, credentials, cloud calls, forced clicks, or repository imports.
The second-tab conflict scenario creates a second real UI/repository instance.
"""
from io import BytesIO
from pathlib import Path
import argparse
import base64
import hashlib
import json
import os
import random
import re
import traceback
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('PAW_DIARY_TEST_URL', 'http://127.0.0.1:4193/paw-diary/')
OUT = Path(__file__).resolve().parents[2] / 'test-results/stage2/review-local-browser'
OUT.mkdir(parents=True, exist_ok=True)
HEADED = os.environ.get('PAW_DIARY_HEADED') == '1'
STAMP = '2026-10-07T00:00:00.000Z'
DB = 'paw-diary-personal'
checks = []
candidate_manifest = None


def passed(text):
    checks.append(text)
    print('PASS ' + text, flush=True)


def png_bytes(size=(320, 240), noise=False, color=(99,149,117,160)):
    image = Image.frombytes('RGBA', size, random.Random(23).randbytes(size[0]*size[1]*4)) if noise else Image.new('RGBA', size, color)
    image.paste((0, 0, 0, 0), (0, 0, 100, 100))
    output = BytesIO()
    image.save(output, format='PNG')
    return output.getvalue()


def upload(name, data, mime='image/png'):
    return {'name': name, 'mimeType': mime, 'buffer': data}


def archive_fixture():
    pets = [dict(id='restore-cat', name='恢复合成猫', type='cat', deletedAt=None, avatarAssetId='cat-avatar', birthday=None, estimatedAgeMonths=12, arrivalDate=None, breed='', sex='', image=''),
            dict(id='restore-rabbit', name='恢复合成兔', type='other', typeLabel='兔子', deletedAt=STAMP, avatarAssetId='rabbit-avatar', birthday=None, estimatedAgeMonths=18, arrivalDate=None, breed='', sex='', image='')]
    record = dict(id='care-visible', petId='restore-cat', type='other', typeLabel='梳毛', deletedAt=None, occurredDate='2026-10-06', title='合成护理原文', value=None, unit=None, note='只用于隔离验收', createdAt=STAMP, updatedAt=STAMP)
    hidden_record = dict(record, id='care-trash', petId='restore-rabbit', deletedAt=STAMP, title='回收站护理原文')
    reminder = dict(id='due-visible', petId='restore-cat', deletedAt=None, title='合成待办', dueDate='2026-10-08', status='pending', originRecordId='care-visible', completionRecordId=None, completedAt=None)
    assets = []
    for index,(identifier, pet_id, kind) in enumerate([('cat-avatar','restore-cat','avatar'),('cat-photo','restore-cat','photo'),('rabbit-avatar','restore-rabbit','avatar'),('rabbit-photo','restore-rabbit','photo')]):
        image=png_bytes(color=(70+index*30,140,100+index*20,160))
        assets.append(dict(metadata=dict(id=identifier, petId=pet_id, kind=kind, caption='合成透明照片', createdAt=STAMP, mime='image/png', bytes=len(image), sha256=hashlib.sha256(image).hexdigest()), base64=base64.b64encode(image).decode()))
    snapshot = dict(version=3, mode='local', pets=pets, records=[record, hidden_record], reminders=[reminder], posts=[], activePetId='restore-cat', profile=dict(city='上海'))
    return dict(format='paw-diary-archive', formatVersion=1, archiveId='synthetic-review-archive', sourceWorkspaceId='opaque-synthetic-source', exportedAt=STAMP, snapshot=snapshot, assets=assets)


def new_page(browser):
    global candidate_manifest
    context = browser.new_context(viewport={'width':1440,'height':1000}, reduced_motion='reduce', accept_downloads=True)
    # The acceptance fixture never calls a real account or private cloud API.
    context.route(re.compile(r'https?://[^/]*(?:tcloudbasegateway|tencentcloudapi|tcb\.qcloud)\.[^/]+/.*'), lambda route: route.abort())
    page = context.new_page()
    page.set_default_timeout(6000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE, wait_until='networkidle')
    manifest=page.request.get(BASE+'asset-manifest.json').json()
    if candidate_manifest is None:candidate_manifest=manifest
    assert manifest==candidate_manifest, 'Candidate build changed during the browser acceptance run'
    return context, page, errors


READ_DB = """async name=>{
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 const state=await new Promise((resolve,reject)=>{const tx=db.transaction(['workspace','media','blobs'],'readonly'),q=tx.objectStore('workspace').get('singleton'),m=tx.objectStore('media').getAll(),k=tx.objectStore('blobs').getAllKeys(),b=tx.objectStore('blobs').getAll();tx.oncomplete=()=>resolve({envelope:q.result,media:m.result,keys:k.result,blobs:b.result});tx.onabort=()=>reject(tx.error);});db.close();
 const bytes=await Promise.all(state.blobs.map(async(blob,i)=>{const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()),row={id:state.keys[i],size:blob.size,mime:blob.type,sha256:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')};if(blob.type.startsWith('image/')){const bitmap=await createImageBitmap(blob),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);row.width=bitmap.width;row.height=bitmap.height;row.alpha=ctx.getImageData(0,0,1,1).data[3];bitmap.close();}else row.text=await blob.text();return row;}));
 const recovery=await Promise.all((Array.isArray(state.envelope.recoveryArchives)?state.envelope.recoveryArchives:[]).map(async item=>({raw:item.raw,envelope:item.envelope,media:[...item.media.values()],blobs:await Promise.all([...item.blobs].map(async([id,blob])=>({id,size:blob.size,mime:blob.type,text:await blob.text()})))})));
 return {snapshot:state.envelope.snapshot,revision:state.envelope.revision,workspaceId:state.envelope.workspaceId,media:state.media,blobs:bytes,recovery};
}"""


def read_db(page):
    return page.evaluate(READ_DB, DB)


def close_dialog(page):
    page.locator('#dialog [data-action=close]').last.click()
    expect(page.locator('#dialog')).not_to_be_visible()


def fresh_pet(page, name='冲突合成猫'):
    page.get_by_role('button', name='开始记录我的宠物', exact=True).click()
    page.locator('#pet-form [name=name]').fill(name)
    page.locator('#pet-form [name=estimatedAgeMonths]').fill('12')
    page.locator('#pet-form button[type=submit]').click()
    expect(page.locator('#dialog')).not_to_be_visible()
    page.get_by_role('link', name='健康档案', exact=True).click()
    expect(page.locator('.pet-entry')).to_have_count(1)


def edit_pet(page):
    page.locator('[data-action=manage-pets]').click()
    page.locator('.pet-entry [data-action=edit-pet]').click()
    expect(page.locator('#pet-form')).to_be_visible()


def avatar_form(page):
    edit_pet(page)
    page.locator('#pet-form [data-action=avatar-pet]').click()
    expect(page.locator('#avatar-form')).to_be_visible()


def import_preview(page, data):
    page.locator('[data-action=import]').first.click()
    page.locator('#personal-import-form [name=backup]').set_input_files(upload('synthetic-archive.json', json.dumps(data, ensure_ascii=False).encode(), 'application/json'))
    page.locator('#preview-personal-import').click()


def corruption(browser):
    context, page, errors = new_page(browser)
    try:
        original = dict(version=3, mode='local', pets=[dict(id='restore-cat',deletedAt=STAMP)], records='corrupt', broken='synthetic original')
        page.evaluate("""async({name,snapshot})=>{
         const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>{q.result.createObjectStore('workspace');q.result.createObjectStore('media',{keyPath:'id'}).createIndex('petId','petId');q.result.createObjectStore('blobs');};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
         await new Promise((resolve,reject)=>{const tx=db.transaction(['workspace','media','blobs'],'readwrite');tx.objectStore('workspace').put({snapshot,revision:4,workspaceId:'synthetic-corrupt-source',receipts:{keep:'receipt'},importMaps:{keep:'mapping'}},'singleton');tx.objectStore('media').put({id:'old-avatar',petId:'old-pet',kind:'avatar',fileRef:'old-file',caption:'原坏媒体'});tx.objectStore('blobs').put(new Blob(['original synthetic blob'],{type:'application/octet-stream'}),'old-file');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();localStorage.setItem('paw-diary:workspace-mode','local');
        }""", dict(name=DB,snapshot=original))
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('heading', name='暂时无法读取档案', exact=True)).to_be_visible()
        before = read_db(page)
        assert before['snapshot']==original and before['revision']==4 and not before['recovery']
        with page.expect_download() as download:
            page.locator('[data-action=raw-export]').click()
        path=OUT/'synthetic-original.txt'
        download.value.save_as(str(path))
        assert json.loads(path.read_text())==original
        passed('损坏个人IDB不种示例，原坏raw可真实下载')
        backup=archive_fixture()
        import_preview(page,backup)
        # This assertion is the real original RED: old UI preview calls snapshot and stalls.
        expect(page.locator('#confirm-personal-import')).to_be_visible()
        expect(page.locator('#personal-import-preview')).to_contain_text('全量恢复')
        expect(page.locator('#personal-import-preview')).to_contain_text('编辑')
        expect(page.locator('#personal-import-preview')).to_contain_text('删除')
        assert page.locator('[data-import-kind]').count()==0, 'Recovery must not silently omit archive media'
        assert read_db(page)==before, 'Preview modified original corrupt data or recovery records'
        page.screenshot(path=str(OUT/('headed-corrupt-preview.png' if HEADED else 'corrupt-preview.png')),full_page=True)
        close_dialog(page)
        assert read_db(page)==before
        passed('完整恢复警示/取消均不写坏原文、metadata、Blob或恢复记录')
        import_preview(page,backup)
        expect(page.locator('#confirm-personal-import')).to_be_visible()
        checkboxes=page.locator('#personal-import-preview input[type=checkbox]')
        assert checkboxes.count()==1, 'Expected exactly one explicit whole-replacement confirmation'
        assert not checkboxes.first.is_checked()
        if page.locator('#confirm-personal-import').is_enabled():
            page.locator('#confirm-personal-import').click()
        else:
            expect(page.locator('#confirm-personal-import')).to_be_disabled()
        assert read_db(page)==before, 'Whole-replacement ran before explicit acknowledgement'
        expect(page.locator('#dialog')).to_be_visible()
        checkboxes.first.check()
        page.locator('#confirm-personal-import').click()
        expect(page.locator('#dialog')).not_to_be_visible()
        expect(page.get_by_role('heading', name='你好呀，恢复合成猫。',exact=True)).to_be_visible()
        after=read_db(page)
        assert after['snapshot']==backup['snapshot'], 'Backup state changed or soft-deleted data disappeared'
        assert after['revision']==5 and after['workspaceId']=='synthetic-corrupt-source'
        assert len(after['media'])==4 and len(after['blobs'])==4
        assert set(m['id'] for m in after['media'])==set(a['metadata']['id'] for a in backup['assets'])
        actual_bytes={item['id']:item['sha256'] for item in after['blobs']}
        assert actual_bytes=={asset['metadata']['id']:asset['metadata']['sha256'] for asset in backup['assets']}, 'Recovered Blob bytes were missing, duplicated, or misassociated'
        recovery=after['recovery'][0]
        assert json.loads(recovery['raw'])==original and recovery['envelope']['snapshot']==original
        assert recovery['envelope']['receipts']=={'keep':'receipt'} and recovery['envelope']['importMaps']=={'keep':'mapping'}
        assert recovery['media']==before['media']
        assert recovery['blobs'][0]['text']=='original synthetic blob'
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('heading',name='你好呀，恢复合成猫。',exact=True)).to_be_visible()
        assert read_db(page)==after
        expect(page.locator('img[data-avatar-asset]').first).to_have_attribute('src',re.compile('^blob:'))
        page.wait_for_function("Array.from(document.querySelectorAll('img[data-avatar-asset]')).every(i=>i.complete&&i.naturalWidth>0)")
        page.screenshot(path=str(OUT/('headed-corrupt-restored.png' if HEADED else 'corrupt-restored.png')),full_page=True)
        passed('确认全量恢复原备份V3/头像/照片/回收站，单事务保原坏envelope和媒体，刷新仍正确')
        assert not errors,errors
    except Exception:
        page.screenshot(path=str(OUT/'corrupt-failure.png'),full_page=True)
        (OUT/'corrupt-failure.html').write_text(page.content())
        (OUT/'corrupt-page-errors.json').write_text(json.dumps(errors,ensure_ascii=False))
        raise
    finally:
        context.close()


def avatars(browser):
    context,page,errors=new_page(browser)
    try:
        fresh_pet(page,'头像合成猫')
        avatar_form(page)
        large=png_bytes((1400,1000),noise=True)
        assert 1024*1024<len(large)<10*1024*1024
        page.locator('#avatar-form [name=avatar]').set_input_files(upload('transparent-large.png',large))
        page.locator('#avatar-form button[type=submit]').click()
        expect(page.locator('#dialog')).not_to_be_visible()
        saved=read_db(page)
        avatar=next(m for m in saved['media'] if m['kind']=='avatar')
        display=next(b for b in saved['blobs'] if b['id']==avatar['fileRef'])
        assert display['width']==512 and display['height']<=512
        assert display['size']<=1024*1024 and display['mime']=='image/png' and display['alpha']==0
        assert saved['snapshot']['pets'][0]['avatarAssetId']==avatar['id']
        passed(f'真实透明PNG源{len(large)}字节压到512尺寸/{display["size"]}字节，透明边角仍保留')
        if page.locator('[data-action=finish-pets]').count():page.locator('[data-action=finish-pets]').click()
        avatar_form(page)
        for label,data,mime in [('mime-mismatch',png_bytes(),'image/jpeg'),('source-over-limit',png_bytes((2000,1400),noise=True),'image/png')]:
            if label=='source-over-limit':assert len(data)>10*1024*1024
            page.locator('#avatar-form [name=avatar]').set_input_files(upload(label+'.jpg' if label=='mime-mismatch' else label+'.png',data,mime))
            page.locator('#avatar-form button[type=submit]').click()
            expect(page.locator('#avatar-form .form-error')).to_be_visible()
            expect(page.locator('#avatar-form .form-error')).to_contain_text('10 MiB' if label=='source-over-limit' else 'JPEG')
            expect(page.locator('#avatar-form button[type=submit]')).to_be_enabled()
            expect(page.locator('#dialog')).to_be_visible()
            assert read_db(page)==saved, 'Failed source replaced old avatar or changed revision'
            passed(label+'真实UI失败且旧头像/原Blob/资料版本保持')
        close_dialog(page)
        page.screenshot(path=str(OUT/('headed-avatar.png' if HEADED else 'avatar.png')),full_page=True)
        page.reload(wait_until='networkidle')
        assert read_db(page)==saved
        assert not errors,errors
    except Exception:
        page.screenshot(path=str(OUT/'avatar-failure.png'),full_page=True)
        (OUT/'avatar-failure.html').write_text(page.content())
        (OUT/'avatar-page-errors.json').write_text(json.dumps(errors,ensure_ascii=False))
        raise
    finally:
        context.close()


def forms(browser):
    context,page,errors=new_page(browser)
    second=None
    try:
        fresh_pet(page)
        edit_pet(page)
        revision=read_db(page)['revision']
        draft='旧表单草稿仍保留'
        page.locator('#pet-form [name=name]').fill(draft)
        second=context.new_page()
        second.on('pageerror',lambda error:errors.append(str(error)))
        second.goto(BASE+'#health',wait_until='networkidle')
        edit_pet(second)
        second.locator('#pet-form [name=name]').fill('另一窗口新名称')
        second.locator('#pet-form button[type=submit]').click()
        expect(second.locator('#dialog')).not_to_be_visible()
        fresh=read_db(second)
        assert fresh['revision']==revision+1 and fresh['snapshot']['pets'][0]['name']=='另一窗口新名称'
        page.locator('#pet-form button[type=submit]').click()
        expect(page.locator('#pet-form .form-error')).to_be_visible()
        expect(page.locator('#pet-form .conflict-review')).to_contain_text('资料已更新')
        expect(page.locator('#dialog')).to_be_visible()
        assert page.locator('#pet-form [name=name]').input_value()==draft
        assert read_db(page)==fresh, 'Stale first-tab draft overwrote second real UI repository write'
        # Conflict review refreshes the real repository cache. The old captured form
        # revision must still block a second submission until the user acknowledges.
        expect(page.locator('#pet-form [data-review-latest]')).to_be_visible()
        page.locator('#pet-form button[type=submit]').click()
        expect(page.locator('#pet-form button[type=submit]')).to_be_enabled()
        expect(page.locator('#pet-form')).to_be_visible()
        expect(page.locator('#pet-form .form-error')).to_be_visible()
        assert page.locator('#pet-form [name=name]').input_value()==draft
        assert read_db(page)==fresh, 'Cache refresh bypassed the captured old form revision before acknowledgement'
        page.screenshot(path=str(OUT/('headed-stale-form.png' if HEADED else 'stale-form.png')),full_page=True)
        passed('真实两个UI仓储旧表单CONFLICT，冲突自动刷新cache后未确认重提仍不覆盖，新名称/版本/旧草稿保持')
        assert not errors,errors
    except Exception:
        page.screenshot(path=str(OUT/'form-failure.png'),full_page=True)
        (OUT/'form-failure.html').write_text(page.content())
        (OUT/'form-page-errors.json').write_text(json.dumps(errors,ensure_ascii=False))
        raise
    finally:
        context.close()


def export_full(page,filename):
    with page.expect_download() as download:
        page.locator('[data-action=export]').first.click()
    path=OUT/filename
    download.value.save_as(str(path))
    archive=json.loads(path.read_text())
    assert archive['format']=='paw-diary-archive' and archive['assets']
    # Each export assigns a new transport ID/time; compare all actual archive data.
    return {key:value for key,value in archive.items() if key not in ['archiveId','exportedAt']}


def transaction_abort(browser):
    context,page,errors=new_page(browser)
    try:
        fresh_pet(page,'事务合成猫')
        form=page.locator('.paw-photo-upload')
        form.locator('[name=photos]').set_input_files(upload('original-photo.png',png_bytes()))
        form.locator('[name=photo-caption]').fill('原合成照片')
        form.locator('button[type=submit]').click()
        expect(page.locator('.paw-photo-tile')).to_have_count(1)
        expect(form.locator('button[type=submit]')).to_be_enabled()
        before=read_db(page)
        before_archive=export_full(page,'abort-before-full-archive.json')
        page.evaluate("""name=>{
          const original=IDBObjectStore.prototype.put;
          window.__review_restore_idb_put=()=>{IDBObjectStore.prototype.put=original;};
          window.__review_idb_abort_armed=true;window.__review_idb_abort_count=0;
          IDBObjectStore.prototype.put=function(...args){
            const request=original.apply(this,args);
            if(this.name==='blobs'&&this.transaction.db.name===name&&window.__review_idb_abort_armed){
              window.__review_idb_abort_armed=false;window.__review_idb_abort_count++;request.transaction.abort();
            }
            return request;
          };
        }""",DB)
        caption='事务中止后保留的合成说明'
        form.locator('[name=photos]').set_input_files(upload('abort-candidate.png',png_bytes(color=(170,80,100,160))))
        form.locator('[name=photo-caption]').fill(caption)
        form.locator('button[type=submit]').click()
        expect(page.locator('.paw-photo-status')).to_have_attribute('role','alert')
        expect(form.locator('button[type=submit]')).to_be_enabled()
        assert page.evaluate('window.__review_idb_abort_count')==1
        assert form.locator('[name=photos]').evaluate('input=>input.files.length===1&&input.files[0].name==="abort-candidate.png"')
        assert form.locator('[name=photo-caption]').input_value()==caption
        assert read_db(page)==before, 'Actual IDB abort changed snapshot, revision, asset metadata or old Blob'
        after_archive=export_full(page,'abort-failed-full-archive.json')
        assert after_archive==before_archive, 'Full health/media archive differs after aborted browser IDB transaction'
        page.screenshot(path=str(OUT/('headed-transaction-abort.png' if HEADED else 'transaction-abort.png')),full_page=True)
        passed('浏览器真实blobs.put request.transaction.abort，中止后完整export/IDB/原Blob不变，FileList与caption保留')
        page.evaluate('window.__review_restore_idb_put()')
        form.locator('button[type=submit]').click()
        expect(page.locator('.paw-photo-tile')).to_have_count(2)
        expect(form.locator('button[type=submit]')).to_be_enabled()
        expect(page.locator('.paw-photo-grid')).to_contain_text(caption)
        after=read_db(page)
        assert after['revision']==before['revision']+1
        assert len(after['media'])==len(before['media'])+1 and len(after['blobs'])==len(before['blobs'])+1
        original=before['media'][0]
        assert original in after['media'] and before['blobs'][0] in after['blobs']
        retry_archive=export_full(page,'abort-retry-full-archive.json')
        assert len(retry_archive['assets'])==len(before_archive['assets'])+1
        assert before_archive['assets'][0] in retry_archive['assets']
        assert form.locator('[name=photos]').evaluate('input=>input.files.length')==0
        assert form.locator('[name=photo-caption]').input_value()==''
        assert not errors,errors
        passed('解除一次真实IDB abort后原控件重试成功，仅一个新增资产，原照片完整且版本只增一次')
    except Exception:
        page.screenshot(path=str(OUT/'abort-failure.png'),full_page=True)
        (OUT/'abort-failure.html').write_text(page.content())
        (OUT/'abort-page-errors.json').write_text(json.dumps(errors,ensure_ascii=False))
        raise
    finally:
        context.close()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--case',choices=['all','corrupt','avatar','forms','abort'],default='all')
    args=parser.parse_args()
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=not HEADED,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        try:
            for name,action in [('corrupt',corruption),('avatar',avatars),('forms',forms),('abort',transaction_abort)]:
                if args.case in ['all',name]:action(browser)
            (OUT/('headed-results.json' if HEADED else 'results.json')).write_text(json.dumps(dict(base=BASE,candidate=candidate_manifest,headed=HEADED,case=args.case,checks=checks),ensure_ascii=False,indent=2))
        finally:
            browser.close()
    print(f'PASS {len(checks)} checks; headed={HEADED}; case={args.case}',flush=True)


if __name__=='__main__':
    try:main()
    except Exception:
        (OUT/'failure.txt').write_text(traceback.format_exc())
        raise
