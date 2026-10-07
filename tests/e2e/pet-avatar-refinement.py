"""Local synthetic pet avatar and initial focus; no cloud or model calls."""
import os
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':390,'height':844})
    page.on('dialog',lambda d:d.accept())
    def choose_pet_type(label):
        control=page.locator('#pet-form [name=type]').locator('xpath=..')
        expect(control.locator('.select-trigger')).to_be_visible()
        control.locator('.select-trigger').click();control.get_by_role('option',name=label,exact=True).click()
    page.goto(os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4201/')+'#home',wait_until='networkidle')
    page.locator('[data-action=workspace-local]').first.click()
    expect(page.locator('#dialog-title')).to_be_focused()
    expect(page.locator('.avatar-choice')).to_have_count(3)
    from pathlib import Path
    out=Path(__file__).resolve().parents[2]/'test-results/record-refinement/pets';out.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(out/'avatar-390.png'),full_page=True)
    page.locator('[data-avatar-preset=cat]').click()
    page.locator('#pet-form [name=name]').fill('头像合成猫')
    choose_pet_type('猫咪')
    page.locator('#pet-form [name=estimatedAgeMonths]').fill('12')
    page.locator('#pet-form [type=submit]').click()
    expect(page.locator('#dialog')).not_to_be_visible(timeout=15000)
    page.locator('[data-action=edit-pet]').first.click()
    expect(page.locator('#dialog-title')).to_be_focused()
    expect(page.locator('.avatar-choice')).to_have_count(3)
    page.locator('#dialog [data-action=close]').click()
    page.reload(wait_until='networkidle')
    expect(page.locator('.pet-hero')).to_contain_text('头像合成猫')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page=browser.new_page(viewport={'width':390,'height':844});page.on('dialog',lambda d:d.accept())
    page.goto(os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4201/')+'#home',wait_until='networkidle');page.locator('[data-action=workspace-local]').first.click()
    page.locator('[data-avatar-file]').set_input_files(str(Path(__file__).resolve().parents[2]/'assets/cat.jpg'))
    expect(page.locator('.avatar-upload img')).to_be_visible();preview=page.locator('.avatar-upload img').get_attribute('src')
    choose_pet_type('狗狗');assert page.locator('.avatar-upload img').get_attribute('src')==preview
    page.locator('#dialog [data-action=close]').click()
    def count_pets():
        return page.evaluate('''() => new Promise(resolve=>{const r=indexedDB.open('paw-diary-personal',1);r.onsuccess=()=>{const db=r.result;const get=db.transaction('workspace').objectStore('workspace').get('singleton');get.onsuccess=()=>{resolve(get.result.snapshot.pets.length);db.close();}}})''')
    assert count_pets()==0
    page.locator('[data-action=new-pet]').first.click()
    page.evaluate('''() => new Promise(resolve=>{const r=indexedDB.open('paw-diary-personal',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').put(new Blob([new Uint8Array(51*1024*1024)]),'quota-fixture');tx.oncomplete=()=>{db.close();resolve()}}})''')
    page.locator('#pet-form [name=name]').fill('头像失败重试合成猫');page.locator('#pet-form [name=estimatedAgeMonths]').fill('12');page.locator('#pet-form [type=submit]').click()
    expect(page.locator('#pet-form .form-error')).to_contain_text('档案已保存',timeout=15000);assert count_pets()==1
    page.evaluate('''() => new Promise(resolve=>{const r=indexedDB.open('paw-diary-personal',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').delete('quota-fixture');tx.oncomplete=()=>{db.close();resolve()}}})''')
    page.locator('#pet-form [type=submit]').click();expect(page.locator('#dialog')).not_to_be_visible(timeout=15000);assert count_pets()==1
    browser.close()
print('PASS local create/edit choices, title focus/reload, upload then type retains preview, cancel zero writes and actual quota failure avatar retry creates only one pet')
