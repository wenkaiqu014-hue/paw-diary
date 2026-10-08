"""Real mounted UI and asynchronous profile checks; synthetic repository only."""
import ast
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results/v101/preflight'
OUT.mkdir(parents=True, exist_ok=True)
tree = ast.parse((ROOT / 'tests/e2e/community.py').read_text())
fixture = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'FIXTURE' for t in node.targets))
fixture = fixture.replace("if(action==='profiles.getOwn')return", "if(action==='profiles.getOwn'){if(window.failProfileRead)throw {code:'UNAVAILABLE'};if(window.holdProfileRead)await new Promise(r=>window.releaseProfileRead=r);}if(action==='profiles.getOwn')return")
fixture = fixture.replace(' mount();\n};', " window.signedWithoutProfile=()=>{session={userId:'A',generation:session.generation+1};hasProfile=false;mount();};\n window.mountResume=(draft)=>{session={userId:'A',generation:session.generation+1};hasProfile=true;mount(draft);};\n mount();\n};")
(OUT / 'fixture.html').write_text(fixture)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=False)
    page = browser.new_page(viewport={'width':1440,'height':1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:4197/test-results/v101/preflight/fixture.html')
    page.wait_for_load_state('networkidle')
    page.evaluate('setupFixture();signedWithoutProfile()')
    page.get_by_role('button', name='写一篇', exact=True).click()
    page.wait_for_function("window.transition?.type === 'profile'", timeout=2500)
    assert page.locator('.community-editor-dialog[open]').count() == 0, 'nickname guidance must precede composing'
    assert page.evaluate('window.transition.requireNickname') is True
    assert page.evaluate('window.savedPosts') == 0
    page.evaluate('completeProfile()')
    page.locator('[name="title"]').wait_for(state='visible')
    page.locator('[name="title"]').fill('完成昵称后写帖')
    page.locator('[name="text"]').fill('只有公开昵称是发帖前置，不要求宠物或发现。')
    page.get_by_role('button', name='确认发布', exact=True).click()
    page.wait_for_function('window.savedPosts === 1')
    page.screenshot(path=str(OUT / 'after-profile-save.png'))
    page.evaluate('setupFixture();signedWithoutProfile();window.failProfileRead=true')
    page.get_by_role('button', name='写一篇', exact=True).click()
    page.wait_for_function("document.querySelector('[data-community-notice]').hidden === false")
    assert page.locator('.community-editor-dialog[open]').count() == 0
    assert page.evaluate('window.transition') is None
    page.evaluate('window.failProfileRead=false')
    page.get_by_role('button', name='写一篇', exact=True).click()
    page.wait_for_function("window.transition?.type === 'profile'")
    page.evaluate('setupFixture();forceSigned();window.holdProfileRead=true')
    page.get_by_role('button', name='写一篇', exact=True).click()
    page.wait_for_function("typeof window.releaseProfileRead === 'function'")
    page.evaluate('switchAccount();window.releaseProfileRead()')
    page.wait_for_timeout(100)
    assert page.locator('.community-editor-dialog[open]').count() == 0, 'late profile read must not open a new owner draft'
    assert page.evaluate('window.transition') is None
    page.evaluate("setupFixture();window.holdProfileRead=false;window.failProfileRead=true;mountResume({title:'回顾分享标题',text:'登录恢复的正文',topic:'今日萌宠'})")
    page.wait_for_function("document.querySelector('[data-community-notice]').hidden === false && !document.querySelector('[data-community-write]').disabled")
    assert page.locator('.community-editor-dialog[open]').count() == 0
    page.evaluate('window.failProfileRead=false')
    page.get_by_role('button', name='写一篇', exact=True).click()
    page.locator('[name="title"]').wait_for(state='visible')
    assert page.locator('[name="title"]').input_value() == '回顾分享标题'
    assert page.locator('[name="text"]').input_value() == '登录恢复的正文'
    assert not errors, errors
    (OUT / 'report.json').write_text(json.dumps({'profileBeforeCompose':True,'resumeAfterProfile':True,'noPetOrDiscoveryRequired':True,'readFailureBlocksAndRetry':True,'staleOwnerIgnored':True,'initialDraftSurvivesReadFailure':True,'pageErrors':errors}, ensure_ascii=False))
    browser.close()
