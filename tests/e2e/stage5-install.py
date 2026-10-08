"""Real macOS Chrome PWA lifecycle, in a newly-created disposable profile.

No synthetic install events, service worker, production account or credentials.
PAW_DIARY_TEST_URL selects the local or deployed candidate at its real path.
Stops before install when a matching OS app already exists. Only a PWA this
run creates is uninstalled, always through the same isolated browser session.
"""
import json, os, plistlib, subprocess, tempfile, time, urllib.request
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get('PAW_DIARY_TEST_URL', 'http://127.0.0.1:4240/paw-diary/')
OUT = ROOT/'test-results/stage5/install'
OUT.mkdir(parents=True, exist_ok=True)
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
CHECKS = []
RESULT = {'base': BASE, 'startedAt': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
          'realOSInstall': False, 'source': 'https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json'}
RESULT['macOS'] = {name:subprocess.check_output(['sw_vers',flag],text=True).strip()
                   for name,flag in [('version','-productVersion'),('build','-buildVersion')]}

def record(name, status, evidence):
    entry = {'id': name, 'status': status, 'evidence': evidence}
    CHECKS.append(entry)
    print(json.dumps(entry, ensure_ascii=False), flush=True)

def app_paths():
    found = set()
    for root in [Path.home()/'Applications', Path('/Applications')]:
        if root.exists():
            for path in root.rglob('*.app'):
                if any(word in path.name.lower() for word in ['爪爪', 'paw diary', 'paw-diary']):
                    found.add(str(path))
    return found

def finish_intro(page):
    notice = page.locator('#whats-new-dialog[open]')
    if notice.count(): notice.locator('[data-whats-new-confirm]').click()
    tour = page.locator('dialog[data-guided-tour][open]')
    if tour.count(): tour.locator('[data-tour-skip]').click()

def page_facts(page):
    return page.evaluate("""async () => ({url:location.href,
      standalone:matchMedia('(display-mode: standalone)').matches,
      browser:matchMedia('(display-mode: browser)').matches,
      preference:localStorage.getItem('paw-diary:ui:v1:guest'),
      observedInstallEvents:window.__pawObservedInstallEvents ?? null,
      serviceWorkers:(await navigator.serviceWorker.getRegistrations()).length,
      caches:await caches.keys()})""")

def target_page(context, session, target):
    RESULT.setdefault('launchTargets',[]).append({'requested':target,
        'targets':session.send('Target.getTargets')['targetInfos']})
    for _ in range(100):
        for page in context.pages:
            if page.is_closed(): continue
            probe = context.new_cdp_session(page)
            try:
                if (probe.send('Target.getTargetInfo')['targetInfo']['targetId'] == target
                    or (urlparse(page.url).path == urlparse(BASE).path and
                        page.evaluate("matchMedia('(display-mode: standalone)').matches"))):
                    return page
            finally: probe.detach()
        time.sleep(.1)
    RESULT['launchContextPages'] = [{'url':p.url,'standalone':p.evaluate("matchMedia('(display-mode: standalone)').matches")} for p in context.pages if not p.is_closed()]
    raise RuntimeError('PWA target not available in the isolated Chrome context')

proc = None
browser = None
session = None
created = False
manifest_id = None
before = app_paths()
RESULT['existingMatchingApps'] = sorted(before)
try:
    if before:
        record('os-app-conflict', 'unverified', 'Existing matching OS app found; install/uninstall not attempted')
    else:
        with tempfile.TemporaryDirectory(prefix='paw-stage5-install-') as profile:
            RESULT['temporaryProfile'] = Path(profile).name
            with sync_playwright() as runtime:
                context = runtime.chromium.launch_persistent_context(profile,
                    executable_path=CHROME, headless=False,
                    args=['--remote-debugging-port=0'], viewport={'width':1200,'height':820})
                browser = context.browser
                session = browser.new_browser_cdp_session()
                RESULT['browser'] = session.send('Browser.getVersion')
                RESULT['transport'] = 'local remote-debugging-pipe (Chromium AllowUnsafeOperations true)'
                active = Path(profile)/'DevToolsActivePort'
                port = active.read_text().splitlines()[0]
                with urllib.request.urlopen('http://127.0.0.1:'+port+'/json/protocol', timeout=10) as response:
                    protocol = json.load(response)
                pwa = next((d for d in protocol['domains'] if d['domain']=='PWA'), None)
                (OUT/'current-pwa-protocol.json').write_text(json.dumps(pwa, indent=2))
                RESULT['pwaCommands'] = [c['name'] for c in pwa['commands']] if pwa else []
                context.set_default_timeout(10000)
                context.add_init_script("""window.__pawObservedInstallEvents={beforeinstallprompt:0,appinstalled:0};
                  addEventListener('beforeinstallprompt',()=>window.__pawObservedInstallEvents.beforeinstallprompt++);
                  addEventListener('appinstalled',()=>window.__pawObservedInstallEvents.appinstalled++);""")
                def restrict(route):
                    parsed = urlparse(route.request.url)
                    if parsed.scheme in ['http','https'] and parsed.netloc != urlparse(BASE).netloc:
                        route.abort('failed')
                    else: route.continue_()
                context.route('**/*', restrict)
                page = context.new_page()
                page.goto(BASE+'#home', wait_until='networkidle')
                session = context.new_cdp_session(page)
                RESULT['pwaSessionTarget'] = 'page'
                page.screenshot(path=str(OUT/'browser-first-open.png'))
                manifest_url = urljoin(page.url, page.locator('link[rel=manifest]').get_attribute('href'))
                manifest = page.request.get(manifest_url).json()
                manifest_id = urljoin(manifest_url, manifest['id'])
                RESULT['manifestId'] = manifest_id
                RESULT['manifest'] = manifest
                RESULT['release'] = page.request.get(urljoin(BASE, 'release.json')).json()
                finish_intro(page)
                page_commands = [c['name'] for d in protocol['domains'] if d['domain']=='Page' for c in d['commands']]
                if 'getAppManifest' in page_commands:
                    app_manifest = session.send('Page.getAppManifest')
                    RESULT['browserManifest'] = {k:v for k,v in app_manifest.items() if k!='data'}
                    manifest_id = app_manifest.get('manifest',{}).get('id',manifest_id)
                    RESULT['manifestId'] = manifest_id
                    assert manifest_id == urljoin(BASE,'./'), 'Browser-resolved identity must preserve the exact project path before installing'
                    record('manifest-project-identity','pass',manifest_id)
                if 'getInstallabilityErrors' in page_commands:
                    RESULT['installabilityErrors'] = session.send('Page.getInstallabilityErrors')
                facts_before = page_facts(page)
                record('browser-before-install', 'pass', facts_before)
                if not pwa or not all(name in RESULT['pwaCommands'] for name in ['install','launch','uninstall','getOsAppState']):
                    record('real-install', 'unverified', 'Required PWA CDP commands missing from current Chrome protocol')
                else:
                    try:
                        existing = session.send('PWA.getOsAppState', {'manifestId':manifest_id})
                    except Exception as error:
                        RESULT['preInstallOsStateError'] = str(error)
                    else:
                        raise RuntimeError('PWA already installed in new profile; refusing to touch existing installation: '+json.dumps(existing))
                    try:
                        session.send('PWA.install', {'manifestId':manifest_id})
                        created = True
                        RESULT['realOSInstall'] = True
                        record('real-install', 'pass', {'command':'PWA.install','manifestId':manifest_id,'osState':session.send('PWA.getOsAppState', {'manifestId':manifest_id})})
                        after = app_paths()
                        RESULT['createdOSApps'] = sorted(after-before)
                        RESULT['createdOSAppPlists'] = []
                        for app_path in sorted(after-before):
                            with open(Path(app_path)/'Contents/Info.plist','rb') as stream:
                                plist = plistlib.load(stream)
                            RESULT['createdOSAppPlists'].append({key:value for key,value in plist.items()
                                if key in ['CFBundleIdentifier','CFBundleDisplayName','CFBundleName','CrAppModeShortcutID','CrAppModeProfileDir','CrAppModeUserDataDir','CrAppModeURL','CrAppModeShortcutURL']})
                        record('system-launcher-artifact', 'pass' if after-before else 'unverified', {'createdApps':sorted(after-before)})
                        # DevTools-created installs default to browser launch in this
                        # Chrome. Change the real browser-owned app preference, not
                        # matchMedia or page state, to request a standalone window.
                        session.send('PWA.changeAppUserSettings', {'manifestId':manifest_id,'displayMode':'standalone'})
                        record('browser-owned-launch-preference','pass','PWA.changeAppUserSettings sets installed app displayMode=standalone')
                        launched = session.send('PWA.launch', {'manifestId':manifest_id})
                        app = target_page(context,session,launched['targetId'])
                        app.wait_for_load_state('networkidle')
                        facts_app = page_facts(app)
                        assert facts_app['standalone'] and urlparse(facts_app['url']).path==urlparse(BASE).path
                        assert facts_app['preference']==facts_before['preference']
                        assert not facts_app['serviceWorkers'] and not facts_app['caches']
                        app.screenshot(path=str(OUT/'installed-standalone.png'))
                        record('standalone-path-preferences', 'pass', facts_app)
                        app.get_by_role('button',name='开始记录我的宠物',exact=True).click()
                        form = app.locator('#pet-form')
                        form.locator('[name=name]').fill('安装验收合成宠物')
                        form.locator('[name=estimatedAgeMonths]').fill('12')
                        form.locator('[type=submit]').click()
                        expect(app.locator('#dialog')).not_to_be_visible()
                        page.reload(wait_until='networkidle')
                        expect(page.locator('#main')).to_contain_text('安装验收合成宠物')
                        record('browser-installed-data-boundary', 'pass', 'Real UI saved synthetic pet in installed window; original browser refresh reads it. Guest UI preferences also shared in this Chrome profile.')
                        app.close()
                        launched = session.send('PWA.launch', {'manifestId':manifest_id})
                        app = target_page(context,session,launched['targetId'])
                        app.wait_for_load_state('networkidle')
                        expect(app.locator('#main')).to_contain_text('安装验收合成宠物')
                        reopened = page_facts(app)
                        assert reopened['standalone']
                        app.screenshot(path=str(OUT/'reopened-data.png'))
                        record('reopen-version-data', 'pass', {'facts':reopened,'release':app.request.get(urljoin(BASE,'release.json')).json()})
                        if len(after-before)==1:
                            app.close()
                            shim = next(iter(after-before))
                            shim_info = RESULT['createdOSAppPlists'][0]
                            assert Path(shim_info.get('CrAppModeUserDataDir','/')).resolve().is_relative_to(Path(profile).resolve()), 'Launcher must belong only to this run profile'
                            launcher_attempts=[]
                            for command in [['open','-a',shim],['open',shim]]:
                                launch_result = subprocess.run(command,capture_output=True,text=True,timeout=15)
                                launcher_attempts.append({'command':command,'returncode':launch_result.returncode,'stderr':launch_result.stderr})
                                if launch_result.returncode==0:break
                            RESULT['systemLauncherAttempts']=launcher_attempts
                            if launch_result.returncode!=0:
                                raise RuntimeError('LaunchServices could not open the created app: '+launch_result.stderr.strip())
                            app = target_page(context,session,'os-launcher')
                            app.wait_for_load_state('networkidle')
                            expect(app.locator('#main')).to_contain_text('安装验收合成宠物')
                            app.screenshot(path=str(OUT/'os-launcher-reopened.png'))
                            record('system-launcher-launch','pass',{'createdApp':shim,'facts':page_facts(app)})
                        record('cross-version-update', 'unverified', 'Installed current candidate reopened; no real later release was published. This does not verify a future installed-app update.')
                    except AssertionError as error:
                        record('install-lifecycle', 'fail', str(error))
                    except Exception as error:
                        record('install-lifecycle', 'unverified', str(error))
                    finally:
                        if created:
                            session.send('PWA.uninstall', {'manifestId':manifest_id})
                            created = False
                            try: session.send('PWA.getOsAppState', {'manifestId':manifest_id})
                            except Exception as error:
                                remaining = sorted(app_paths()-before)
                                record('real-uninstall', 'pass' if 'Unknown web-app manifest id' in str(error) and not remaining else 'unverified', {'osStateError':str(error),'remainingCreatedApps':remaining})
                            else: record('real-uninstall','fail','getOsAppState still succeeds after uninstall')
                browser.close()
                browser = None
except Exception as error:
    record('test-run', 'unverified', str(error))
finally:
    if browser:
        try:
            if created and session and manifest_id:
                session.send('PWA.uninstall', {'manifestId':manifest_id})
                created = False
            browser.close()
        except Exception as error: record('cleanup', 'unverified', str(error))
    if proc and proc.poll() is None:
        proc.terminate()
        try: proc.wait(timeout=10)
        except subprocess.TimeoutExpired: proc.kill()
    RESULT['finishedAt'] = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
    RESULT['checks'] = CHECKS
    RESULT['cleanupCreatedInstallationRemaining'] = created
    RESULT['remainingNewOSApps'] = sorted(app_paths()-before)
    (OUT/'results.json').write_text(json.dumps(RESULT, ensure_ascii=False, indent=2))
    print('RESULT '+str(OUT/'results.json'), flush=True)
