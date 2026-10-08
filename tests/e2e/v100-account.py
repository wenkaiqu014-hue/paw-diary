"""Real account UI with synthetic auth transport; no cloud, email or OS claims."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('PAW_DIARY_TEST_URL','http://127.0.0.1:4243/').rstrip('/')+'/'
OUT=Path(os.environ.get('PAW_DIARY_TEST_OUTPUT_DIR','test-results/v100-account'));OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    for width in [390,1440]:
        page=browser.new_page(viewport=dict(width=width,height=844));page.set_default_timeout(5000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('**/account-harness',lambda r:r.fulfill(content_type='text/html',body='<html><head><link rel="stylesheet" href="style.css"></head><body><button id="opener">Open</button><dialog id="dialog"><h2 id="title"></h2><div id="body"></div></dialog></body></html>'))
        page.goto(BASE+'account-harness');page.clock.install()
        page.evaluate("""async()=>{
          const {createAccountUI}=await import('./src/ui/account.js');const {createI18n}=await import('./src/ui/i18n.js');
          window.i18n=createI18n({storage:null});i18n.setLocale('en');window.sent=[];window.verified=[];window.session=null;window.failure=null;window.slow=false;window.signedIn=0;
          window.auth={getSession:async()=>session,requestEmailCode:async input=>{sent.push(input);if(slow)await new Promise(r=>window.release=r);if(failure)throw {code:failure,params:{retryAfterSeconds:60}};return {id:'synthetic-challenge'};},verifyEmailCode:async input=>{verified.push(input);if(failure)throw {code:failure};session={userId:'synthetic-user'};return session;}};
          const dialog=document.querySelector('#dialog');const modal=(title,markup)=>{if(dialog.open)dialog.close();document.querySelector('#title').textContent=title;document.querySelector('#body').innerHTML=markup;dialog.showModal();return true;};
          window.ui=createAccountUI({auth,betaRequired:true,modal,closeModal:()=>{dialog.querySelector('form')?.__pawCleanup?.();dialog.close();return true;},t:i18n.t,document,onSignedIn:()=>signedIn++});ui.openLogin();
        }""")
        beta=page.locator('[name=betaCode]');email=page.locator('[name=email]');otp=page.locator('[name=code]');send=page.locator('[data-account-action=send]')
        expect(beta).to_have_value('');beta.focus();page.keyboard.press('Tab');expect(email).to_be_focused();page.keyboard.press('Shift+Tab');expect(beta).to_be_focused();assert beta.get_attribute('type')=='text' and beta.get_attribute('inputmode')=='numeric'
        email.fill('synthetic@example.invalid');send.click();expect(page.locator('.form-error')).to_have_text('Enter your beta invitation code.');expect(beta).to_be_focused();assert page.evaluate('sent.length')==0
        beta.fill('12345');send.click();expect(beta).to_be_focused();assert page.evaluate('sent.length')==0
        beta.fill('012349');page.evaluate("i18n.setLocale('zh-CN');ui.refreshLocale()");expect(beta).to_have_value('012349');expect(email).to_have_value('synthetic@example.invalid')
        page.evaluate("i18n.setLocale('en');ui.refreshLocale();failure='BETA_CODE_INVALID'");send.click();expect(page.locator('.form-error')).to_have_text('The beta invitation code is incorrect. Check with your inviter.');expect(beta).to_be_focused();expect(otp).to_be_disabled()
        page.evaluate('failure=null');send.click();expect(otp).to_be_enabled();expect(otp).to_be_focused();assert page.evaluate('sent.at(-1).betaCode')=='012349'
        otp.fill('1234');beta.fill('023459');expect(otp).to_have_value('');expect(otp).to_be_disabled();expect(page.locator('[type=submit]')).to_be_disabled();expect(page.locator('.account-status')).to_have_text('Request a new email code after changing your email or invitation code.')
        page.clock.fast_forward(61000);send.click();otp.fill('1234');page.clock.fast_forward(61000);page.evaluate("failure='BETA_CODE_INVALID'");send.click();expect(otp).to_be_disabled();expect(otp).to_have_value('');expect(beta).to_be_focused();page.evaluate('failure=null');send.click();otp.fill('1234');email.fill('other@example.invalid');expect(otp).to_have_value('');expect(otp).to_be_disabled()
        page.clock.fast_forward(61000);send.click();otp.fill('1234');page.evaluate("failure='BETA_CODE_REQUIRED'");page.locator('[type=submit]').click();expect(beta).to_be_focused();expect(otp).to_be_disabled();expect(otp).to_have_value('')
        page.clock.fast_forward(61000);page.evaluate('failure=null');send.click();otp.fill('1234');page.evaluate('window.oldForm=document.querySelector("#account-login-form")');otp.press('Enter');expect(page.locator('#account-actions-form')).to_be_visible();assert page.evaluate('signedIn')==1;assert page.evaluate('Array.from(oldForm.querySelectorAll("input")).every(x=>x.value==="")')
        page.evaluate('session=null;ui.openLogin()');beta.fill('012349');email.fill('synthetic@example.invalid');page.evaluate('window.oldForm=document.querySelector("#account-login-form")');page.locator('[data-account-action=close]').click();assert page.evaluate('Array.from(oldForm.querySelectorAll("input")).every(x=>x.value==="")')
        page.evaluate('ui.openLogin()');beta.fill('012349');page.keyboard.press('Escape');expect(page.locator('#dialog')).not_to_be_visible();page.clock.run_for(20);expect(beta).to_have_value('')
        page.evaluate('ui.openLogin()');beta.fill('012349');email.fill('synthetic@example.invalid');page.clock.fast_forward(61000);page.evaluate('slow=true');send.click();page.evaluate('document.querySelector("[name=betaCode]").value="023459";document.querySelector("[name=betaCode]").dispatchEvent(new Event("input",{bubbles:true}));release()');expect(otp).to_be_disabled();assert page.evaluate('verified.length')==2
        page.evaluate('slow=false;ui.openLogin()');beta.fill('012349');email.fill('synthetic@example.invalid');page.clock.fast_forward(61000);page.evaluate("failure='RATE_LIMITED'");send.click();expect(page.locator('.form-error')).to_contain_text('60');assert page.locator('.form-error').inner_text().find('undefined')==-1
        page.evaluate('ui.destroy()');expect(beta).to_have_value('');expect(email).to_have_value('')
        page.evaluate('ui.openLogin()');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
        page.screenshot(path=str(OUT/f'account-synthetic-{width}.png'),full_page=True)
        print(f'PASS synthetic account UI {width}: validation/leading0/locale/focus/challenge invalidation/late send/success/cancel/Escape/destroy/rate hint')
        page.close()
    browser.close()
