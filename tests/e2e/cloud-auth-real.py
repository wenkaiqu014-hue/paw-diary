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
        document[label] = {k: session[k] for k in ('access_token', 'refresh_token', 'version', 'token_type', 'scope', 'expires_in', 'expires_at') if k in session}
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

    def check(self, label, command):
        actor = self.actor(label)
        observed = self.checkpoint(label, actor, 'check_checkpoint', required=False)
        page = actor['page']
        flags = dict(actor['config'], **observed['flags'], pageErrors=actor['errors'], sessionSaved=actor['saved'])
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
                    if label not in LABELS or op not in ('request', 'verify', 'resume', 'check'):
                        raise SafeFailure('COMMAND_INVALID')
                    helper.stage = op
                    getattr(helper, op)(label, command)
                    emit(ok=True, label=label, stage=helper.stage, elapsedMs=round((time.monotonic() - started) * 1000))
                except KeyboardInterrupt:
                    emit(ok=False, stage='interrupted', errorCode='INTERRUPTED', browserRetained=True)
                except Exception as error:
                    safe = str(error) if isinstance(error, SafeFailure) else 'BROWSER_OPERATION_FAILED'
                    emit(ok=False, stage=helper.stage, errorCode=safe, elapsedMs=round((time.monotonic() - started) * 1000), browserRetained=True)
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
