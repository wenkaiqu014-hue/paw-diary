"""Account module DOM acceptance with the real adapter and a controlled external SDK boundary."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4193/').rstrip('/')+'/'
OUT=Path(os.environ.get('PAW_DIARY_TEST_OUTPUT_DIR',str(Path(__file__).resolve().parents[2]/'test-results'/'stage2'/'account-browser')))
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=os.environ.get('PAW_DIARY_HEADED')!='1',executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    page=browser.new_page(viewport=dict(width=390,height=900),reduced_motion='reduce');page.set_default_timeout(6000)
    page.route('**/account-harness',lambda route:route.fulfill(content_type='text/html',body='<html><head><link rel="stylesheet" href="style.css"></head><body><button id="root-open">Login</button><dialog id="dialog"><h2 id="dialog-title"></h2><div id="dialog-body"></div></dialog></body></html>'))
    page.goto(BASE+'account-harness',wait_until='networkidle')
    page.clock.install()
    page.evaluate("""async()=>{
      const {createAccountUI}=await import('./src/ui/account.js');
      const {createCloudbaseAuth}=await import('./src/auth/cloudbase-auth.js');
      const {createI18n}=await import('./src/ui/i18n.js');
      window.i18n=createI18n({storage:null});i18n.setLocale('en');
      window.generation=0;window.sent=0;window.verified=0;window.signedIn=0;window.signedOut=0;window.imports=0;window.sdkUser=null;window.sendSlow=false;window.verifySlow=false;window.failVerify=false;
      const sdk={getSession:async()=>({data:{session:window.sdkUser?{opaque:true}:null}}),getUser:async()=>({data:{user:window.sdkUser}}),getUserInfo:async()=>window.sdkUser?{sub:window.sdkUser.id,is_anonymous:false,email:window.sdkUser.email,email_verified:true,created_at:'2026-10-07T00:00:00Z'}:null,signInWithOtp:async()=>{window.sent++;if(window.sendSlow)await new Promise(resolve=>window.releaseSend=resolve);return {data:{verifyOtp:async()=>{window.verified++;if(window.verifySlow)await new Promise(resolve=>window.releaseVerify=resolve);if(window.failVerify)return {error:{status:401,private:'SDK secret'}};window.sdkUser={id:'verified-user',email:'private-email@example.com',email_confirmed_at:'2026-10-07T00:00:00Z',is_anonymous:false};return {data:{user:window.sdkUser}};}}};},signOut:async()=>{window.sdkUser=null;},onAuthStateChange:()=>({})};
      const auth=createCloudbaseAuth({app:{auth:()=>sdk}});
      const modal=(title,markup)=>{const dialog=document.querySelector('#dialog');if(dialog.open)dialog.close();document.querySelector('#dialog-title').textContent=title;document.querySelector('#dialog-body').innerHTML=markup;dialog.showModal();return true;};
      window.closeModal=()=>{document.querySelector('#dialog').close();return true;};
      window.ui=createAccountUI({auth,getGeneration:()=>window.generation,modal,closeModal,onSignedIn:async({userId})=>{if(userId!=='verified-user')throw Error('wrong principal');window.signedIn++;window.generation++;},onSignedOut:async()=>{window.signedOut++;window.generation++;},onImportLocal:async()=>{window.imports++;},t:i18n.t,document});
      window.ui.openLogin();
    }""")
    page.locator('[data-account-action=send]').click()
    expect(page.locator('.form-error')).to_have_text('Enter your email.')
    page.locator('[name=email]').fill('wrong')
    page.locator('[data-account-action=send]').click()
    expect(page.locator('.form-error')).to_have_text('Enter a valid email address.')
    page.locator('[name=email]').fill('pet@example.com')
    page.evaluate('window.sendSlow=true')
    page.locator('[data-account-action=send]').click()
    expect(page.locator('[data-account-action=send]')).to_be_disabled()
    page.evaluate("document.querySelector('[data-account-action=send]').click()")
    assert page.evaluate('sent')==1
    page.evaluate('window.releaseSend()')
    expect(page.locator('.account-status')).to_have_text('Verification code requested. Check your email.')
    expect(page.locator('[data-account-action=send]')).to_have_text('Resend in 60s')
    expect(page.locator('[name=code]')).to_be_enabled()
    page.locator('[type=submit]').click()
    expect(page.locator('.form-error')).to_have_text('Enter the verification code.')
    page.locator('[name=code]').fill('12ab')
    page.locator('[type=submit]').click()
    expect(page.locator('.form-error')).to_contain_text('4–10 digit')
    page.locator('[name=code]').fill('1234')
    page.evaluate('window.failVerify=true')
    page.locator('[type=submit]').click()
    expect(page.locator('.form-error')).to_have_text('Sign-in verification failed. Check the code or request a new one.')
    expect(page.locator('[name=email]')).to_have_value('pet@example.com')
    expect(page.locator('[name=code]')).to_have_value('1234')
    assert 'SDK secret' not in page.locator('#dialog-body').inner_text()
    page.evaluate("i18n.setLocale('zh-CN');ui.refreshLocale()")
    expect(page.locator('.form-error')).to_have_text('登录验证未成功，请检查验证码或重新发送。')
    expect(page.locator('[name=code]')).to_have_value('1234')
    page.evaluate("i18n.setLocale('en');ui.refreshLocale()")
    page.clock.fast_forward(61000)
    expect(page.locator('[data-account-action=send]')).to_have_text('Resend code')
    page.evaluate('window.sendSlow=false')
    page.locator('[data-account-action=send]').click()
    assert page.evaluate('sent')==2
    expect(page.locator('[data-account-action=send]')).to_have_text('Resend in 60s')
    page.evaluate("i18n.setLocale('zh-CN');ui.refreshLocale()")
    expect(page.locator('[type=submit]')).to_have_text('验证并登录')
    expect(page.locator('[name=email]')).to_have_value('pet@example.com')
    expect(page.locator('[name=code]')).to_have_value('1234')
    page.evaluate("i18n.setLocale('en');ui.refreshLocale()")
    if os.environ.get('PAW_DIARY_CAPTURE')=='1':
        for width in [360,390,768,1440]:
            page.set_viewport_size(dict(width=width,height=900))
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'overflow at {width}'
            page.screenshot(path=str(OUT/f'account-login-{width}.png'),full_page=True)
    print('PASS email/code inline validation, 4-digit OTP, duplicate send guard, 60s cooldown, resend and failure preservation')
    page.evaluate('window.failVerify=false;window.verifySlow=true')
    page.locator('[type=submit]').click()
    page.evaluate("document.querySelector('#account-login-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
    assert page.evaluate('verified')==2
    page.evaluate('window.releaseVerify()')
    expect(page.locator('#account-actions-form')).to_be_visible()
    assert page.evaluate('signedIn')==1 and page.evaluate('generation')==1
    assert 'private-email@example.com' not in page.locator('#dialog-body').inner_text()
    assert page.locator('[type=password]').count()==0
    page.locator('[data-account-action=import]').click();assert page.evaluate('imports')==1
    page.locator('[data-account-action=signout]').click()
    expect(page.locator('#dialog')).not_to_be_visible();assert page.evaluate('signedOut')==1
    print('PASS verify duplicate guard, legitimate onSignedIn generation change, private account actions/import/signout')
    # A late request must not re-open or mutate a root-replaced dialog.
    page.evaluate("ui.openLogin();window.sendSlow=true")
    page.locator('[name=email]').fill('pet@example.com')
    page.clock.fast_forward(61000)
    page.locator('[data-account-action=send]').click()
    page.evaluate("()=>{window.generation++;document.querySelector('#dialog-body').innerHTML='<p id=other-space>Another space</p>';window.releaseSend();}")
    expect(page.locator('#other-space')).to_have_text('Another space')
    assert page.locator('#account-login-form').count()==0
    page.evaluate('ui.openLogin();window.sendSlow=false;window.verifySlow=true;window.sdkUser=null')
    page.clock.fast_forward(61000)
    page.locator('[name=email]').fill('pet@example.com')
    page.locator('[data-account-action=send]').click()
    expect(page.locator('[name=code]')).to_be_enabled()
    page.locator('[name=code]').fill('1234567890')
    page.locator('[type=submit]').click()
    page.evaluate('window.closeModal();window.releaseVerify()')
    expect(page.locator('#dialog')).not_to_be_visible()
    assert page.evaluate('signedIn')==1,'closed login must not switch workspace or re-open account on a late verify reply'
    print('PASS closed login ignores a late verification reply, including no workspace change')
    page.evaluate('ui.destroy();ui.destroy()')
    print('PASS late old-generation response cannot update a root-replaced view; destroy is idempotent')
    browser.close()
