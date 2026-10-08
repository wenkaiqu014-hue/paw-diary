"""Interactive real product UI acceptance; no email is sent without op=request.

Use skill-runtime/run python -u tests/e2e/cloud-auth-real.py (TTY recommended).
stdin JSON: request(label,email), verify(label,code), resume(label), check(label), stop.
check accepts optional mustIncludeText/mustExcludeText; results contain flags only.
No SDK/network substitution, no server identity bypass, no HAR or private logging.
"""
from pathlib import Path
from datetime import date, datetime
import argparse
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
LABELS = ('A', 'B')


class SafeFailure(Exception):
    pass


def emit(**flags):
    print(json.dumps(flags, ensure_ascii=False), flush=True)


def json_default(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    raise TypeError('UNSUPPORTED_SESSION_VALUE')


def read_document(path, env_id):
    try:
        info = path.lstat()
    except FileNotFoundError:
        return {'envId': env_id}
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o77:
        raise SafeFailure('SESSION_FILE_NOT_PRIVATE')
    document = json.loads(path.read_text())
    if document.get('envId') != env_id:
        raise SafeFailure('SESSION_FILE_ENV_MISMATCH')
    return document


def save_session(path, env_id, label, session):
    if not all(isinstance(session.get(k), str) and session[k] for k in ('access_token', 'refresh_token')):
        raise SafeFailure('SESSION_MISSING')
    path.parent.mkdir(parents=True, exist_ok=True)
    lock = Path(str(path) + '.lock')
    until = time.monotonic() + 5
    while True:
        try:
            lock.mkdir(mode=0o700)
            break
        except FileExistsError:
            if time.monotonic() >= until:
                raise SafeFailure('SESSION_FILE_LOCK_TIMEOUT')
            time.sleep(.025)
    temporary = None
    try:
        document = read_document(path, env_id)
        previous = document.get(label, {})
        document[label] = {**(previous if isinstance(previous, dict) else {}), **{k: session[k] for k in ('access_token', 'refresh_token', 'version', 'token_type', 'scope', 'expires_in', 'expires_at') if k in session}}
        fd, temporary = tempfile.mkstemp(prefix=path.name + '.', suffix='.tmp', dir=path.parent)
        with os.fdopen(fd, 'w') as output:
            json.dump(document, output, default=json_default)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
        temporary = None
    finally:
        if temporary:
            Path(temporary).unlink(missing_ok=True)
        lock.rmdir()


class Acceptance:
    def __init__(self, browser, args, bundle):
        self.browser, self.args, self.bundle = browser, args, bundle
        self.actors = {}
        self.stage = 'ready'

    def progress(self, label, stage, **flags):
        self.stage = stage
        emit(label=label, stage=stage, **flags)

    def attach(self, page):
        if not page.evaluate('!!globalThis.__realAuthAcceptance'):
            page.add_script_tag(path=str(self.bundle))

    def context(self, label):
        self.progress(label, 'open_browser', mailSent=False)
        context = self.browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        page = context.new_page()
        page.set_default_timeout(12000)
        actor = {'context': context, 'page': page, 'identity': None, 'errors': 0, 'pending': False, 'saved': False}
        # Register before navigation so a navigation failure does not destroy context.
        self.actors[label] = actor
        page.on('pageerror', lambda _: actor.__setitem__('errors', actor['errors'] + 1))
        page.goto(self.args.url.rstrip('/') + '/#health', wait_until='domcontentloaded', timeout=15000)
        page.locator('[data-action=account]').first.wait_for(timeout=12000)
        self.attach(page)
        config = page.evaluate('()=>{const c=globalThis.__PAW_PUBLIC_CONFIG__??{};return {env:c.environmentId,cloudEnabled:c.enabled===true,envConfigured:!!c.environmentId,publishKeyConfigured:!!c.publishableKey};}')
        actor['env'] = config.pop('env', None)
        actor['config'] = config
        self.progress(label, 'environment', sdkLoaded=True, sdkVersionExpected=page.evaluate('__realAuthAcceptance.version==="3.10.1"'), **config)
        if not config['cloudEnabled']:
            raise SafeFailure('CLOUD_DISABLED')
        if not config['envConfigured'] or not config['publishKeyConfigured']:
            raise SafeFailure('CLOUD_CONFIG_MISSING')
        return actor

    def actor(self, label):
        return self.actors.get(label) or self.context(label)

    def inspect(self, actor):
        self.attach(actor['page'])
        return actor['page'].evaluate('()=>__realAuthAcceptance.inspect()')

    def checkpoint(self, label, actor, stage, required=True):
        self.progress(label, stage, checkpointStarted=True)
        observed = self.inspect(actor)
        if observed.get('session'):
            try:
                save_session(self.args.sessions, actor['env'], label, observed['session'])
            except Exception as error:
                actor['saved'] = False
                raise SafeFailure('SESSION_SAVE_FAILED') from error
            actor['saved'] = True
        else:
            actor['saved'] = False
            if required:
                raise SafeFailure('SESSION_MISSING')
        if observed.get('identity'):
            actor['identity'] = observed['identity']
        self.progress(label, stage, sessionSaved=bool(observed.get('session')), **observed['flags'])
        return observed

    def open_account(self, actor):
        page = actor['page']
        if page.locator('#account-login-form:visible, #account-actions-form:visible').count():
            return
        page.locator('[data-action=account]').first.click()
        page.wait_for_function("!!document.querySelector('#account-login-form, #account-actions-form')", timeout=15000)

    def ui_result(self, actor, success):
        page = actor['page']
        page.wait_for_function("""success=>{const error=document.querySelector('#dialog .form-error:not([hidden])');return !!error||!!document.querySelector(success);}""", arg=success, timeout=18000)
        if page.locator('#dialog .form-error:not([hidden])').count():
            # Product already translates errors; do not relay DOM/private text.
            raise SafeFailure('PRODUCT_UI_REJECTED')

    def request(self, label, command):
        email = command.get('email', '')
        if not isinstance(email, str) or len(email) > 254 or not re.fullmatch(r'\S+@\S+\.\S+', email.strip()):
            raise SafeFailure('EMAIL_INVALID')
        actor = self.actor(label)
        if actor['pending']:
            raise SafeFailure('CHALLENGE_ALREADY_PENDING')
        self.open_account(actor)
        if not actor['page'].locator('#account-login-form:visible').count():
            raise SafeFailure('ACTOR_ALREADY_SIGNED_IN')
        page = actor['page']
        page.locator('#account-login-form [name=email]').fill(email.strip())
        self.progress(label, 'request_ui', sdkEnvironmentReady=True, mailSent=False)
        page.locator('[data-account-action=send]').click()
        self.ui_result(actor, '#account-login-form [name=code]:not([disabled])')
        actor['pending'] = True
        self.progress(label, 'requested', mailRequested=True, codeInputEnabled=True)

    def verify(self, label, command):
        code = command.get('code', '')
        if not isinstance(code, str) or not re.fullmatch(r'[0-9]{4,10}', code.strip()):
            raise SafeFailure('CODE_INVALID')
        actor = self.actor(label)
        if not actor['pending']:
            raise SafeFailure('NO_PENDING_CHALLENGE')
        page = actor['page']
        page.locator('#account-login-form [name=code]').fill(code.strip())
        self.progress(label, 'verify_ui', verificationStarted=True)
        page.locator('#account-login-form [type=submit]').click()
        try:
            self.ui_result(actor, '#account-actions-form')
        finally:
            # Even product-level rejection can follow a successful token rotation.
            self.checkpoint(label, actor, 'verify_checkpoint', required=False)
        actor['pending'] = False
        self.assert_cloud(label, actor)
        self.refresh(label, actor)

    def assert_cloud(self, label, actor):
        page = actor['page']
        if page.locator('#account-actions-form:visible').count():
            page.locator('#account-actions-form [data-account-action=close]').click()
        page.wait_for_function("['云端档案','Cloud journal'].includes(document.querySelector('#workspace-badge')?.textContent?.trim())", timeout=15000)
        # The workspace badge changes before its asynchronous snapshot load.
        # Wait for an actual journal/empty-state view before fixture assertions.
        page.locator('#main .pet-entry, #main .empty-health, #main .recovery-panel').first.wait_for(timeout=15000)
        if page.locator('#main .recovery-panel').count():
            raise SafeFailure('CLOUD_WORKSPACE_LOAD_FAILED')
        self.progress(label, 'product_cloud', privateWorkspace=True)

    def refresh(self, label, actor):
        self.checkpoint(label, actor, 'before_refresh')
        self.progress(label, 'reload', refreshStarted=True)
        try:
            actor['page'].reload(wait_until='domcontentloaded', timeout=15000)
            self.assert_cloud(label, actor)
        finally:
            self.checkpoint(label, actor, 'after_refresh', required=False)
        self.progress(label, 'refresh_verified', refreshPersistence=True)

    def resume(self, label, command):
        old = self.actors.get(label)
        if old:
            self.checkpoint(label, old, 'before_reopen', required=False)
        actor = self.context(label)
        document = read_document(self.args.sessions, actor['env'])
        tokens = document.get(label)
        if not isinstance(tokens, dict):
            raise SafeFailure('SAVED_ACTOR_MISSING')
        self.progress(label, 'install_session', restoreStarted=True)
        try:
            installed = actor['page'].evaluate('tokens=>__realAuthAcceptance.install(tokens)', tokens)
        finally:
            self.checkpoint(label, actor, 'install_checkpoint', required=False)
        if not installed['installed']:
            raise SafeFailure('SESSION_INSTALL_FAILED')
        # This preference does not authenticate: the app independently validates
        # genuine SDK identity and the server ownership proof during boot.
        actor['page'].evaluate("localStorage.setItem('paw-diary:workspace-mode','account')")
        self.refresh(label, actor)
        if old:
            old['context'].close()
        self.progress(label, 'reopen_verified', reopenedBrowserContext=True, sessionSaved=actor['saved'])

    def stage4(self, label, command):
        actor=self.actor(label)
        page=actor['page']
        page.goto(self.args.url.rstrip('/')+'/#profile',wait_until='networkidle')
        page.locator('[data-profile-form]').wait_for(timeout=15000)
        page.locator('[name=nickname]').fill('阶段4页面验收'+label)
        page.locator('[name=bio]').fill('纯合成验收简介')
        if command.get('image'):
            page.locator('[name=avatar]').set_input_files(str(ROOT/command['image']))
        page.locator('[data-profile-form] [type=submit]').click()
        page.wait_for_function('document.querySelector("#toast")?.textContent.includes("资料已保存")',timeout=35000)
        self.checkpoint(label,actor,'stage4_profile_saved')
        page.reload(wait_until='networkidle')
        page.locator('[data-profile-form]').wait_for(timeout=15000)
        if page.locator('[name=nickname]').input_value()!='阶段4页面验收'+label:
            raise SafeFailure('PROFILE_REFRESH_MISMATCH')
        if command.get('image'):
            page.wait_for_function('(()=>{const i=document.querySelector("[data-profile-preview] img");return i?.complete&&i.naturalWidth>0;})()',timeout=20000)
        own_email=page.locator('[data-own-email]').inner_text()
        if own_email and own_email!='—' and own_email in page.locator('[data-profile-preview]').inner_text():
            raise SafeFailure('PUBLIC_PREVIEW_EMAIL_LEAK')
        page.locator('[name=nickname]').fill('尚未保存的名称')
        page.locator('nav [data-page=home]').click()
        page.locator('#discard-dialog').wait_for()
        page.locator('[data-discard-keep]').click()
        if page.locator('[name=nickname]').input_value()!='尚未保存的名称':
            raise SafeFailure('PROFILE_DISCARD_LOST_INPUT')
        page.locator('nav [data-page=community]').click()
        page.locator('[data-discard-confirm]').click()
        page.locator('[data-community-write]').wait_for(timeout=15000)
        page.locator('[data-community-write]').click()
        page.locator('.community-editor-dialog').wait_for()
        page.keyboard.press('Escape')
        for width in (1440,768,390):
            page.set_viewport_size({'width':width,'height':1000})
            for route in ('home','health','nearby','community','profile'):
                page.goto(self.args.url.rstrip('/')+'/#'+route,wait_until='networkidle')
                if page.evaluate('document.documentElement.scrollWidth>document.documentElement.clientWidth+1'):
                    raise SafeFailure('PUBLIC_PAGE_OVERFLOW')
            if not page.locator('#owner-profile-button').is_visible():
                raise SafeFailure('MOBILE_PROFILE_ENTRY_HIDDEN')
        self.checkpoint(label,actor,'stage4_checkpoint')
        emit(label=label,stage='stage4',profileSavedRefresh=True,avatarOwnerRead=bool(command.get('image')),publicEmailExcluded=True,customDiscard=True,publicPagesThreeWidths=True,mobileProfileMenu=True,pageErrors=actor['errors'])

    def discovery(self,label,command):
        actor=self.actor(label);page=actor['page']
        receipt=json.loads((ROOT/'test-results/stage4/ui-recap-receipt.json').read_text())
        page.goto(self.args.url.rstrip('/')+'/#community',wait_until='networkidle')
        card=page.locator('.community-card').filter(has_text=receipt['title']);card.wait_for(timeout=20000)
        card.get_by_role('button',name='\u4e0d\u60f3\u770b\u8fd9\u7bc7',exact=True).click()
        card.wait_for(state='hidden',timeout=20000)
        page.evaluate("location.hash='profile'")
        hidden=page.locator('[data-profile-hidden]');hidden.wait_for(timeout=15000)
        row=hidden.locator('li').filter(has_text=receipt['title']);row.wait_for(timeout=20000)
        row.get_by_role('button',name='\u6062\u590d\u663e\u793a',exact=True).click();row.wait_for(state='hidden',timeout=20000)
        page.evaluate("location.hash='community'")
        card=page.locator('.community-card').filter(has_text=receipt['title']);card.wait_for(timeout=20000)
        page.evaluate("location.hash='profile'")
        form=page.locator('[data-profile-form]');form.wait_for(timeout=15000)
        prior=form.locator('[name=discoverable]').is_checked()
        form.locator('[name=discoverable]').check();form.locator('[type=submit]').click()
        page.wait_for_function('document.querySelector("[data-profile-form] [type=submit]")?.disabled===false',timeout=35000)
        self.attach(page)
        own=page.evaluate("async()=>{const r=await __realAuthAcceptance.community({version:1,action:'profiles.getOwn',payload:{}});if(!r.ok)throw new Error('OWN_PROFILE_FAILED');return {authorId:r.data.authorId,nickname:r.data.nickname};}")
        page.evaluate("location.hash='nearby'")
        page.get_by_text(own['nickname'],exact=True).first.wait_for(timeout=20000)
        page.get_by_text('\u8fd9\u662f\u4f60',exact=True).wait_for(timeout=20000)
        page.evaluate("location.hash='profile'")
        form=page.locator('[data-profile-form]');form.wait_for(timeout=15000)
        form.locator('[name=discoverable]').set_checked(prior);form.locator('[type=submit]').click()
        page.wait_for_function('document.querySelector("[data-profile-form] [type=submit]")?.disabled===false',timeout=35000)
        page.evaluate("location.hash='nearby'")
        page.wait_for_timeout(1500)
        if not prior and page.get_by_text('\u8fd9\u662f\u4f60',exact=True).count():raise SafeFailure('DISCOVERY_OPTOUT_STILL_VISIBLE')
        self.checkpoint(label,actor,'discovery_checkpoint')
        emit(label=label,stage='discovery',hideRestoreUI=True,joinedOwnCard=True,priorDiscoveryRestored=True,pageErrors=actor['errors'])

    def recap(self,label,command):
        actor=self.actor(label);page=actor['page'];title='stage4-recap-ui-'+str(int(time.time()))
        page.goto(self.args.url.rstrip('/')+'/#home',wait_until='networkidle')
        share=page.locator('[data-recap-share]')
        if not share.count():
            generate=page.locator('[data-recap-generate]')
            if not generate.count() or generate.is_disabled():raise SafeFailure('RECAP_REAL_RECORDS_REQUIRED')
            generate.click();share.wait_for(timeout=50000)
        story=page.locator('.recap-story p').first.inner_text()
        share.click();preview=page.locator('#recap-share-text').input_value()
        if story and story in preview:raise SafeFailure('RECAP_FULL_STORY_SHARED')
        page.locator('#recap-share-form').get_by_role('button',name='\u53d1\u5e03\u5230\u793e\u533a',exact=True).click()
        editor=page.locator('.community-editor-dialog');editor.wait_for()
        editor.locator('[name=title]').fill(title)
        editor.locator('[data-dialog-close]').click()
        page.get_by_role('alertdialog').get_by_role('button',name='\u786e\u8ba4',exact=True).click()
        editor.wait_for(state='hidden')
        self.attach(page)
        count=page.evaluate("async title=>{const r=await __realAuthAcceptance.community({version:1,action:'community.list',payload:{scope:'all',query:title,limit:20}});if(!r.ok)throw new Error('PUBLIC_READ_FAILED');return r.data.items.length;}",title)
        if count:raise SafeFailure('CANCELLED_RECAP_PUBLISHED')
        page.evaluate("location.hash='home'")
        page.locator('[data-recap-share]').wait_for(timeout=15000)
        page.locator('[data-recap-share]').click()
        page.locator('#recap-share-form').get_by_role('button',name='\u53d1\u5e03\u5230\u793e\u533a',exact=True).click()
        editor=page.locator('.community-editor-dialog');editor.locator('[name=title]').fill(title)
        editor.locator('[type=submit]').click();editor.wait_for(state='hidden',timeout=35000)
        self.attach(page)
        items=page.evaluate("async title=>{const r=await __realAuthAcceptance.community({version:1,action:'community.list',payload:{scope:'all',query:title,limit:20}});if(!r.ok)throw new Error('PUBLIC_READ_FAILED');return r.data.items;}",title)
        if len(items)!=1:raise SafeFailure('RECAP_CONFIRMED_POST_COUNT')
        item=items[0]['post']
        receipt=ROOT/'test-results/stage4/ui-recap-receipt.json';receipt.write_text(json.dumps({'postId':item['id'],'revision':item['revision'],'title':title}));receipt.chmod(0o600)
        self.checkpoint(label,actor,'recap_checkpoint')
        emit(label=label,stage='recap',briefOnly=True,cancelNoPublish=True,confirmOnePost=True,pageErrors=actor['errors'])

    def social(self,label,command):
        actor=self.actor(label);page=actor['page'];title='stage4-real-ui-'+str(int(time.time()))
        page.goto(self.args.url.rstrip('/')+'/#community',wait_until='networkidle')
        page.locator('[data-community-write]').click()
        editor=page.locator('.community-editor-dialog')
        editor.locator('[name=title]').fill(title)
        editor.locator('[name=text]').fill('Synthetic browser proof <script>literal</script>')
        editor.locator('input[type=file]').set_input_files(str(ROOT/'test-results/stage4/ui-avatar.jpg'))
        editor.locator('[type=submit]').click()
        editor.wait_for(state='hidden',timeout=35000)
        page.get_by_role('heading',name=title,exact=True).wait_for(timeout=15000)
        page.reload(wait_until='networkidle')
        page.get_by_role('heading',name=title,exact=True).wait_for(timeout=15000)
        self.attach(page)
        posts=page.evaluate("async title=>{const r=await __realAuthAcceptance.community({version:1,action:'community.list',payload:{scope:'all',query:title,limit:20}});if(!r.ok)throw new Error('PUBLIC_READ_FAILED');return r.data.items;}",title)
        item=next((x for x in posts if x['post']['title']==title),None)
        if not item:raise SafeFailure('POST_NOT_PERSISTED')
        record={'postId':item['post']['id'],'revision':item['post']['revision'],'assetId':item['post'].get('imageAssetId'),'title':title}
        path=ROOT/'test-results/stage4/ui-social-receipt.json';path.write_text(json.dumps(record));path.chmod(0o600)
        card=page.locator('.community-card').filter(has_text=title)
        card.get_by_role('button',name='\u67e5\u770b\u8be6\u60c5',exact=True).click()
        detail=page.locator('.community-detail-dialog')
        detail.locator('[name=comment]').fill('Synthetic UI comment')
        detail.locator('[data-community-comment-form] [type=submit]').click()
        page.wait_for_function('document.querySelector(".community-detail-dialog [name=comment]")?.value===""',timeout=25000)
        if detail.locator('script').count():raise SafeFailure('PUBLIC_TEXT_EXECUTED')
        detail.locator('[data-dialog-close]').click()
        record['commentPassed']=True;path.write_text(json.dumps(record));path.chmod(0o600)
        self.checkpoint(label,actor,'social_checkpoint')
        emit(label=label,stage='social',uiPostSavedRefresh=True,uiImageUploaded=True,uiComment=True,pureText=True,pageErrors=actor['errors'])

    def check(self, label, command):
        actor = self.actor(label)
        page = actor['page']
        route=command.get('route')
        if route is not None:
            if route not in ('community','nearby','profile'):raise SafeFailure('PUBLIC_ROUTE_INVALID')
            page.evaluate('(route)=>{location.hash=route}',route)
            if route=='community':
                page.wait_for_function('document.querySelector("[data-community-feed]")?.getAttribute("aria-busy")=="false"',timeout=25000)
            elif route=='nearby':
                page.wait_for_function('document.querySelector("[data-nearby-status]")&&!/(Loading|\\u6b63\\u5728\\u8bfb\\u53d6)/.test(document.querySelector("[data-nearby-status]").textContent)',timeout=25000)
            else:
                page.locator('[data-profile-form]').wait_for(timeout=20000)
        viewport = command.get('viewport')
        if viewport is not None:
            if not isinstance(viewport, dict) or not all(isinstance(viewport.get(k), int) and 320 <= viewport[k] <= 2400 for k in ('width', 'height')):
                raise SafeFailure('VIEWPORT_INVALID')
            page.set_viewport_size(viewport)
        locale = command.get('locale')
        if locale is not None:
            if locale not in ('en', 'zh-CN'):
                raise SafeFailure('LOCALE_INVALID')
            select=page.locator('#locale-select')
            option_label=select.evaluate('(s,v)=>Array.from(s.options).find(o=>o.value===v).textContent',locale)
            root=select.locator('..');root.locator('.select-trigger').click()
            root.get_by_role('option',name=option_label,exact=True).click()
            page.wait_for_function('locale=>document.documentElement.lang===locale', arg=locale)
        if isinstance(command.get('petName'), str):
            page.locator('.pet-entry').filter(has_text=command['petName']).first.locator('[data-action=select-pet]').click()
        if command.get('gallery') is True:
            page.locator('.paw-photo-view').first.click()
            page.locator('.paw-slideshow[open]').wait_for()
            page.wait_for_function('(()=>{const image=document.querySelector(".paw-slideshow-image");return image?.complete&&image.naturalWidth>0;})()')
        elif command.get('gallery') is False and page.locator('.paw-slideshow[open]').count():
            page.locator('.paw-slideshow-heading button').first.click()
        observed = self.checkpoint(label, actor, 'check_checkpoint', required=False)
        flags = dict(actor['config'], **observed['flags'], pageErrors=actor['errors'], sessionSaved=actor['saved'])
        if route=='profile':
            own_email=page.locator('[data-own-email]').inner_text()
            flags['ownProfileFormRead']=True
            flags['publicPreviewEmailExcluded']=not own_email or own_email=='—' or own_email not in page.locator('[data-profile-preview]').inner_text()
        flags['galleryOpen'] = bool(page.locator('.paw-slideshow[open]').count())
        flags['photoCount'] = page.locator('.paw-photo-tile').count()
        flags['petCount'] = page.locator('.pet-entry').count()
        flags['horizontalOverflow'] = page.evaluate('document.documentElement.scrollWidth>window.innerWidth+1')
        screenshot = command.get('screenshot')
        if screenshot is not None:
            if not isinstance(screenshot, str):
                raise SafeFailure('SCREENSHOT_PATH_INVALID')
            target = (ROOT / screenshot).resolve()
            if not target.is_relative_to((ROOT / 'test-results').resolve()) or target.suffix != '.png':
                raise SafeFailure('SCREENSHOT_PATH_INVALID')
            if page.locator('#account-login-form:visible').count() or re.search(r'\S+@\S+\.\S+', page.locator('body').inner_text()):
                raise SafeFailure('SCREENSHOT_PRIVATE_FORM_VISIBLE')
            target.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(target), full_page=True)
            flags['screenshotSaved'] = True
        flags['privateWorkspace'] = page.locator('#workspace-badge').inner_text().strip() in ('云端档案', 'Cloud journal')
        text = page.locator('#main').inner_text()
        if isinstance(command.get('mustIncludeText'), str):
            flags['requiredMarkerVisible'] = command['mustIncludeText'] in text
        if isinstance(command.get('mustExcludeText'), str):
            flags['otherActorMarkerAbsent'] = command['mustExcludeText'] not in text
        identities = [self.actors[k].get('identity') for k in LABELS if k in self.actors]
        flags['bothActorsObserved'] = len(identities) == 2 and all(identities)
        flags['actorIdentitiesDistinct'] = len(identities) == 2 and all(identities) and len(set(identities)) == 2
        self.progress(label, 'checked', **flags)

    def stop(self):
        failures = False
        for label, actor in self.actors.items():
            try:
                self.checkpoint(label, actor, 'stop_checkpoint', required=False)
            except Exception:
                failures = True
                emit(label=label, stage='stop_checkpoint', ok=False, errorCode='SESSION_SAVE_FAILED', browserRetained=True)
        if failures:
            raise SafeFailure('STOP_SAVE_FAILED')
        self.browser.close()
        emit(stage='stopped', stopped=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default=os.environ.get('PAW_DIARY_TEST_URL', 'http://127.0.0.1:4193/paw-diary/'))
    parser.add_argument('--sessions', type=Path, default=ROOT / 'test-results/stage2/real-sessions.json')
    parser.add_argument('--headed', action='store_true', help='Only use for a short visual inspection; default is headless.')
    args = parser.parse_args()
    bundle = ROOT / 'test-results/stage2/real-browser/browser-session-bootstrap.js'
    built = subprocess.run(['node', str(ROOT / 'tests/helpers/browser-session-bootstrap.mjs'), '--outfile', str(bundle)], cwd=ROOT, capture_output=True, timeout=25)
    if built.returncode:
        emit(ok=False, stage='bootstrap', errorCode='SDK_BOOTSTRAP_BUILD_FAILED')
        return 1
    echo_state = None
    if sys.stdin.isatty():
        import termios
        echo_state = termios.tcgetattr(sys.stdin)
        quiet = list(echo_state)
        quiet[3] &= ~termios.ECHO
        termios.tcsetattr(sys.stdin, termios.TCSANOW, quiet)
    try:
        with sync_playwright() as runtime:
            launch = {'headless': not args.headed}
            executable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            if Path(executable).exists():
                launch['executable_path'] = executable
            browser = runtime.chromium.launch(**launch)
            helper = Acceptance(browser, args, bundle)
            emit(ready=True, stage='ready', mailSent=False, headless=not args.headed, stdinEchoDisabled=bool(echo_state))
            while True:
                started = time.monotonic()
                try:
                    line = sys.stdin.readline()
                    if not line:
                        helper.stop()
                        break
                    started = time.monotonic()
                    command = json.loads(line)
                    op, label = command.get('op'), command.get('label')
                    if op == 'stop':
                        helper.stop()
                        break
                    if label not in LABELS or op not in ('request', 'verify', 'resume', 'check', 'stage4', 'social', 'recap', 'discovery'):
                        raise SafeFailure('COMMAND_INVALID')
                    helper.stage = op
                    getattr(helper, op)(label, command)
                    emit(ok=True, label=label, stage=helper.stage, elapsedMs=round((time.monotonic() - started) * 1000))
                except KeyboardInterrupt:
                    emit(ok=False, stage='interrupted', errorCode='INTERRUPTED', browserRetained=True)
                except Exception as error:
                    failed_stage = helper.stage
                    safe = str(error) if isinstance(error, SafeFailure) else 'BROWSER_OPERATION_FAILED'
                    for actor_label, actor in helper.actors.items():
                        try:
                            helper.checkpoint(actor_label, actor, 'error_checkpoint', required=False)
                        except Exception:
                            emit(label=actor_label, stage='error_checkpoint', ok=False, errorCode='SESSION_SAVE_FAILED', browserRetained=True)
                    emit(ok=False, stage=failed_stage, errorCode=safe, elapsedMs=round((time.monotonic() - started) * 1000), browserRetained=True)
                    # Keep actors/pending challenges alive. Retrying check/resume
                    # is read/restore only; no automatic resend occurs.
                    if not line:
                        return 1
    finally:
        if echo_state:
            termios.tcsetattr(sys.stdin, termios.TCSANOW, echo_state)
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception:
        emit(ok=False, stage='startup', errorCode='HELPER_STARTUP_FAILED')
        raise SystemExit(1)
