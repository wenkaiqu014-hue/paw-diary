"""Whole-app personal-media acceptance through the shipped DOM and downloads.

Uses isolated ephemeral browser contexts and synthetic PNG fixtures. No repo
imports, cloud login, credentials, user profile, server changes, or forced clicks.
"""
from copy import deepcopy
from io import BytesIO
import json
import os
from pathlib import Path
import re
import traceback
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('PAW_DIARY_TEST_URL', 'http://127.0.0.1:4193/paw-diary/')
OUT = Path(__file__).resolve().parents[2] / 'test-results/stage2/media-e2e'
OUT.mkdir(parents=True, exist_ok=True)
HEADED = os.environ.get('PAW_DIARY_HEADED') == '1'
A, B = '媒体验收小橘', '媒体验收小黑'
CAPTION_A1, CAPTION_A2, CAPTION_B = '小橘窗边合成照片', '小橘玩耍合成照片', '小黑散步合成照片'
RECORD = '小橘第一次散步记录'
checks = []


def passed(text):
    checks.append(text)
    print('PASS ' + text, flush=True)


def png(name, color):
    buffer = BytesIO()
    Image.new('RGB', (900, 600), color).save(buffer, format='PNG')
    return {'name': name, 'mimeType': 'image/png', 'buffer': buffer.getvalue()}


def context_page(browser):
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', accept_downloads=True)
    # Enforce this task's local-only scope even if a future config regresses.
    context.route(re.compile(r'https?://[^/]*(?:tcloudbasegateway|tencentcloudapi|tcb\.qcloud)\.[^/]+/.*'), lambda route: route.abort())
    page = context.new_page()
    page.set_default_timeout(8000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE, wait_until='networkidle')
    expect(page.get_by_role('button', name='开始记录我的宠物', exact=True)).to_be_visible()
    demo_before = page.evaluate("localStorage.getItem('paw-diary:v3:demo')")
    return context, page, errors, demo_before


def close_dialog(page):
    page.locator('#dialog [data-action=close]').last.click()
    expect(page.locator('#dialog')).not_to_be_visible()


def create_pet(page, name):
    form = page.locator('#pet-form')
    expect(form).to_be_visible()
    form.locator('[name=name]').fill(name)
    form.locator('[name=type]').select_option('cat' if name == A else 'dog')
    form.locator('[name=estimatedAgeMonths]').fill('12')
    form.locator('button[type=submit]').click()
    expect(page.locator('#dialog')).not_to_be_visible()


def health(page):
    page.get_by_role('link', name='健康档案', exact=True).click()
    page.wait_for_function("location.hash === '#health'")
    expect(page.locator('.health-profile')).to_be_visible()


def pet_entry(page, name):
    return page.locator('.pet-entry').filter(has=page.locator('strong', has_text=name))


def select_pet(page, name):
    page.get_by_role('button', name='切换到' + name, exact=True).click()
    expect(page.get_by_role('button', name='切换到' + name, exact=True)).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('.paw-photo-upload')).to_be_visible()


def add_photo(page, caption, payload, count):
    form = page.locator('.paw-photo-upload')
    form.locator('[name=photos]').set_input_files(payload)
    form.locator('[name=photo-caption]').fill(caption)
    form.locator('button[type=submit]').click()
    expect(page.locator('.paw-photo-tile')).to_have_count(count)
    expect(page.locator('.paw-photo-grid')).to_contain_text(caption)
    page.wait_for_function("Array.from(document.querySelectorAll('.paw-photo-tile img')).every(i=>i.complete && i.naturalWidth>0)")


def assert_demo_unchanged(page, original):
    assert page.evaluate("localStorage.getItem('paw-diary:v3:demo')") == original, 'Original demo raw key changed'


def export_download(page, filename):
    with page.expect_download() as download_info:
        page.locator('[data-action=export]').first.click()
    target = OUT / filename
    download_info.value.save_as(str(target))
    archive = json.loads(target.read_text(encoding='utf8'))
    assert archive['format'] == 'paw-diary-archive' and archive['formatVersion'] == 1
    return archive, target


def trash_pet(page, name):
    page.locator('[data-action=manage-pets]').click()
    entry = pet_entry(page, name)
    expect(entry.locator('[name=managed-pet]')).to_be_visible()
    entry.locator('[name=managed-pet]').check()
    page.locator('[data-action=trash-pets]').click()
    expect(page.locator('#trash-form')).to_be_visible()
    page.locator('#trash-form button[type=submit]').click()
    expect(page.locator('#dialog')).not_to_be_visible()
    expect(pet_entry(page, name)).to_have_count(0)


def restore_pet(page, name):
    page.locator('[data-action=trash]').first.click()
    row = page.locator('.trash-entry[data-kind=pet]').filter(has_text=name)
    expect(row).to_be_visible()
    row.locator('[data-action=restore-trash]').click()
    expect(page.locator('.trash-entry[data-kind=pet]').filter(has_text=name)).to_have_count(0)
    close_dialog(page)
    expect(pet_entry(page, name)).to_have_count(1)


def import_preview(page, payload):
    page.locator('[data-action=import]').first.click()
    expect(page.locator('#personal-import-form')).to_be_visible()
    expect(page.locator('#confirm-personal-import')).not_to_be_visible()
    page.locator('#personal-import-form [name=backup]').set_input_files(payload)
    page.locator('#preview-personal-import').click()


def run():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not HEADED, executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        contexts = []
        page = None
        try:
            source_context, page, source_errors, source_demo = context_page(browser)
            contexts.append(source_context)
            page.get_by_role('button', name='开始记录我的宠物', exact=True).click()
            create_pet(page, A)
            health(page)
            expect(page.locator('.pet-entry')).to_have_count(1)
            expect(page.locator('.paw-photo-tile')).to_have_count(0)
            passed('fresh个人空间从空档案开始，新增宠物进入整站照片墙')

            page.locator('[data-action=record]').first.click()
            page.locator('#record-form [name=type]').select_option('daily')
            page.locator('#record-form [name=title]').fill(RECORD)
            page.locator('#record-form [name=note]').fill('仅合成验收资料')
            page.locator('#record-form button[type=submit]').click()
            expect(page.locator('#dialog')).not_to_be_visible()
            expect(page.locator('.health-records')).to_contain_text(RECORD)

            page.locator('[data-action=manage-pets]').click()
            pet_entry(page, A).locator('[data-action=edit-pet]').click()
            page.locator('#pet-form [data-action=avatar-pet]').click()
            expect(page.locator('#avatar-form')).to_be_visible()
            page.locator('#avatar-form [name=avatar]').set_input_files(png('avatar-a.png', '#dd9064'))
            page.locator('#avatar-form button[type=submit]').click()
            expect(page.locator('#dialog')).not_to_be_visible()
            if page.locator('[data-action=finish-pets]').count():
                page.locator('[data-action=finish-pets]').click()
            avatar = pet_entry(page, A).locator('img[data-avatar-asset]')
            expect(avatar).to_have_attribute('src', re.compile(r'^blob:'))
            page.wait_for_function("Array.from(document.querySelectorAll('img[data-avatar-asset]')).every(i=>i.complete && i.naturalWidth>0)")
            add_photo(page, CAPTION_A1, png('photo-a1.png', '#d28850'), 1)
            add_photo(page, CAPTION_A2, png('photo-a2.png', '#668d74'), 2)
            passed('整站宠物编辑头像与照片上传，真实PNG在IndexedDB中保存并显示')

            page.locator('[data-action=new-pet]').first.click()
            create_pet(page, B)
            expect(page.locator('.paw-photo-tile')).to_have_count(0)
            add_photo(page, CAPTION_B, png('photo-b.png', '#42688b'), 1)
            select_pet(page, A)
            expect(page.locator('.paw-photo-tile')).to_have_count(2)
            assert CAPTION_B not in page.locator('.paw-photo-grid').inner_text()
            select_pet(page, B)
            expect(page.locator('.paw-photo-tile')).to_have_count(1)
            assert CAPTION_A1 not in page.locator('.paw-photo-grid').inner_text()
            assert_demo_unchanged(page, source_demo)
            passed('切换当前宠物图库不混，原demo原文保持不变')

            trash_pet(page, A)
            if page.locator('[data-action=finish-pets]').count():
                page.locator('[data-action=finish-pets]').click()
            expect(page.locator('.paw-photo-tile')).to_have_count(1)
            archive, backup_path = export_download(page, 'parent-trash-full-archive.json')
            pet_a = next(p for p in archive['snapshot']['pets'] if p['name'] == A)
            assert pet_a['deletedAt'] is not None, 'Export silently revived trashed parent'
            assert any(r['title'] == RECORD and r['petId'] == pet_a['id'] for r in archive['snapshot']['records'])
            assert len(archive['assets']) == 4 and all(a['base64'] for a in archive['assets'])
            avatar_id = pet_a['avatarAssetId']
            assert any(a['metadata']['id'] == avatar_id and a['metadata']['kind'] == 'avatar' for a in archive['assets'])
            passed('实际JSON下载保留父宠物回收状态、记录和全部4份媒体字节')

            restore_pet(page, A)
            select_pet(page, A)
            expect(page.locator('.paw-photo-tile')).to_have_count(2)
            expect(pet_entry(page, A).locator('img[data-avatar-asset]')).to_have_attribute('src', re.compile(r'^blob:'))
            expect(page.locator('.health-records')).to_contain_text(RECORD)
            page.reload(wait_until='networkidle')
            expect(page.locator('.paw-photo-tile')).to_have_count(2)
            passed('父宠物回收/恢复后头像、两张照片与记录保留，刷新持久')

            for width in (1440, 390):
                page.set_viewport_size({'width': width, 'height': 1000 if width == 1440 else 844})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), f'Media page overflow at {width}'
                page.evaluate('window.scrollTo(0,0)')
                page.screenshot(path=str(OUT / f'personal-health-{width}.png'), full_page=True)
            page.set_viewport_size({'width': 1440, 'height': 1000})
            page.locator('.paw-photo-tile').filter(has_text=CAPTION_A1).get_by_role('button', name='删除 ' + CAPTION_A1, exact=True).click()
            expect(page.locator('.paw-photo-tile')).to_have_count(1)
            page.get_by_role('button', name='全屏幻灯片', exact=True).click()
            expect(page.locator('dialog.paw-slideshow')).to_be_visible()
            page.locator('dialog.paw-slideshow').get_by_role('button', name='删除', exact=True).click()
            expect(page.locator('.paw-photo-tile')).to_have_count(0)
            expect(page.locator('dialog.paw-slideshow')).not_to_be_visible()
            assert page.evaluate('document.activeElement.textContent') == '保存照片'
            deleted_archive, _ = export_download(page, 'after-permanent-photo-delete.json')
            assert not [a for a in deleted_archive['assets'] if a['metadata']['petId'] == pet_a['id'] and a['metadata']['kind'] == 'photo']
            passed('单照片永久删除移除字节，删最后图退出幻灯片并恢复可用焦点')

            target_context, target, target_errors, target_demo = context_page(browser)
            contexts.append(target_context)
            page = target
            target.get_by_role('button', name='开始记录我的宠物', exact=True).click()
            expect(target.locator('#pet-form')).to_be_visible()
            close_dialog(target)
            target.get_by_role('link', name='健康档案', exact=True).click()
            target.wait_for_function("location.hash === '#health'")
            expect(target.locator('.pet-entry')).to_have_count(0)
            import_preview(target, str(backup_path))
            expect(target.locator('#confirm-personal-import')).to_be_visible()
            expect(target.locator('#personal-import-result')).to_contain_text('未保存任何资料')
            # Preview is read-only, and all asset selections come from actual UI.
            expect(target.locator('.pet-entry')).to_have_count(0)
            assert target.locator('[data-import-kind=asset]:checked').count() == 4
            target.locator('#confirm-personal-import').click()
            expect(target.locator('#dialog')).not_to_be_visible()
            expect(pet_entry(target, B)).to_have_count(1)
            expect(pet_entry(target, A)).to_have_count(0)
            expect(target.locator('.paw-photo-tile')).to_have_count(1)
            target.reload(wait_until='networkidle')
            expect(target.locator('.paw-photo-tile')).to_have_count(1)
            restore_pet(target, A)
            select_pet(target, A)
            expect(target.locator('.paw-photo-tile')).to_have_count(2)
            expect(pet_entry(target, A).locator('img[data-avatar-asset]')).to_have_attribute('src', re.compile(r'^blob:'))
            expect(target.locator('.health-records')).to_contain_text(RECORD)
            target.reload(wait_until='networkidle')
            expect(target.locator('.paw-photo-tile')).to_have_count(2)
            expect(pet_entry(target, A).locator('img[data-avatar-asset]')).to_have_attribute('src', re.compile(r'^blob:'))
            expect(target.locator('.health-records')).to_contain_text(RECORD)
            assert_demo_unchanged(target, target_demo)
            passed('另一空个人context预览/确认恢复，回收宠物不默认复活，明确恢复后头像/图库/记录刷新不丢')

            baseline, _ = export_download(target, 'restored-baseline.json')
            missing = deepcopy(archive)
            missing['assets'] = [a for a in missing['assets'] if a['metadata']['id'] != avatar_id]
            corrupt = deepcopy(archive)
            corrupt['assets'][0]['metadata']['sha256'] = '0' * 64
            for label, invalid in (('missing-avatar-asset', missing), ('invalid-photo-hash', corrupt)):
                payload = {'name': label + '.json', 'mimeType': 'application/json', 'buffer': json.dumps(invalid, ensure_ascii=False).encode('utf8')}
                import_preview(target, payload)
                expect(target.locator('#personal-import-form .form-error')).to_be_visible()
                expect(target.locator('#confirm-personal-import')).not_to_be_visible()
                close_dialog(target)
                after, _ = export_download(target, label + '-state-unchanged.json')
                assert after['snapshot'] == baseline['snapshot'], label + ' changed health state'
                assert after['assets'] == baseline['assets'], label + ' changed media bytes'
            target.reload(wait_until='networkidle')
            expect(target.locator('.paw-photo-tile')).to_have_count(2)
            assert_demo_unchanged(target, target_demo)
            passed('缺头像asset和坏hash备份拒绝，真实导出对比证明原健康/媒体字节不变')
            assert not source_errors, source_errors
            assert not target_errors, target_errors
            passed('两个隔离context无pageerror，1440/390截图与无横向溢出检查通过')
            (OUT / 'result.json').write_text(json.dumps({'passed': checks, 'headed': HEADED, 'base': BASE, 'cloudValidated': False}, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
        except Exception:
            if page is not None:
                page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
                (OUT / 'failure-dom.html').write_text(page.content(), encoding='utf8')
            print('FAIL ' + traceback.format_exc(), flush=True)
            raise
        finally:
            for context in contexts:
                context.close()
            browser.close()


if __name__ == '__main__':
    run()
