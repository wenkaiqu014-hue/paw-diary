"""Actual file:// portable acceptance UI; no account or public-site requests."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[2]
PACK = Path(os.environ.get('PAW_ACCEPTANCE_DIR', ROOT / 'test-results/stage5/windows-acceptance'))
OUT = ROOT / 'test-results/stage5/acceptance-browser'
OUT.mkdir(parents=True, exist_ok=True)
assert (PACK / 'START-HERE.html').is_file(), 'Build the self-contained acceptance pack before the browser check'
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=os.environ.get('PAW_DIARY_HEADED') != '1')
    page = browser.new_page(viewport={'width': 1200, 'height': 900}, accept_downloads=True)
    errors, remote = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: remote.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
    page.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('storage denied')}});Object.defineProperty(window,'sessionStorage',{get(){throw new Error('storage denied')}})")
    page.goto((PACK / 'START-HERE.html').as_uri(), wait_until='networkidle')
    expect(page.locator('#manual-summary')).to_contain_text('全部未开始')
    assert page.locator('[data-check-status]').evaluate_all("nodes=>nodes.every(n=>n.value==='not-run')")
    page.locator('#environment-os').fill('Windows 11（Mac逻辑替身）')
    page.locator('#environment-browser').fill('Edge')
    page.locator('#environment-browserVersion').fill('用户待核对')
    page.locator('[data-check-status="windows-install"]').evaluate("n=>n.closest('details').open=true")
    page.locator('[data-check-status="windows-install"]').select_option('fail')
    page.locator('#export-json').click()
    expect(page.locator('#report-message')).to_contain_text('原因')
    page.locator('[data-check-reason="windows-install"]').fill('尚未完成真实Windows安装')
    page.locator('#notes').fill('<img src=x onerror=window.injected=true> 中文结果')
    with page.expect_download() as download:
        page.locator('#export-json').click()
    download.value.save_as(OUT / 'manual.json')
    report = json.loads((OUT / 'manual.json').read_text('utf-8'))
    assert next(c for c in report['manualChecks'] if c['id'] == 'windows-install')['status'] == 'fail'
    assert all(c['status'] == 'not-run' for c in report['manualChecks'] if c['id'] != 'windows-install')
    page.reload(wait_until='networkidle')
    expect(page.locator('#manual-summary')).to_contain_text('全部未开始')
    page.locator('#import-report').set_input_files(str(OUT / 'manual.json'))
    expect(page.locator('[data-check-status="windows-install"]')).to_have_value('fail')
    assert page.locator('#notes').input_value().startswith('<img')
    assert page.evaluate('window.injected===true') is False
    automatic = {**report, 'manualChecks': [], 'autoChecks': [{'id': 'manifest', 'status': 'pass', 'evidence': 'HTTP200仅为资源证据'}, {'id': 'asset-app', 'status': 'fail', 'reason': 'SHA256 mismatch：声明与下载内容不同'}, {'id': 'asset-style', 'status': 'pass', 'evidence': 'SHA256 matches declaration'}, {'id': 'asset-release', 'status': 'fail', 'reason': 'buildId与release.json不同'}, {'id': 'release-version', 'status': 'unverified', 'reason': '候选尚未部署'}], 'notes': '自动HTTP报告'}
    (OUT / 'automatic.json').write_text(json.dumps(automatic, ensure_ascii=False), encoding='utf-8')
    page.locator('#import-report').set_input_files(str(OUT / 'automatic.json'))
    expect(page.locator('[data-check-status="windows-install"]')).to_have_value('fail')
    expect(page.locator('#auto-checks')).to_contain_text('HTTP200仅为资源证据')
    expect(page.locator('#auto-checks')).to_contain_text('asset-app：失败')
    expect(page.locator('#auto-checks')).to_contain_text('SHA256 mismatch')
    expect(page.locator('#auto-checks')).to_contain_text('asset-release：失败')
    expect(page.locator('#auto-checks')).to_contain_text('release-version：未能核验')
    assert page.locator('[data-check-status]').evaluate_all("nodes=>nodes.filter(n=>n.dataset.checkStatus!=='windows-install').every(n=>n.value==='not-run')")
    invalid = {**report, 'environment': {}}
    (OUT / 'invalid.json').write_text(json.dumps(invalid), encoding='utf-8')
    page.locator('#import-report').set_input_files(str(OUT / 'invalid.json'))
    expect(page.locator('#report-message')).to_contain_text('导入失败')
    expect(page.locator('[data-check-status="windows-install"]')).to_have_value('fail')
    with page.expect_download() as download:
        page.locator('#export-html').click()
    download.value.save_as(OUT / 'report.html')
    html = (OUT / 'report.html').read_text('utf-8')
    assert '<img src=x onerror=' not in html
    assert '&lt;img' in html
    assert '<script' not in html
    page.goto((OUT / 'report.html').as_uri(), wait_until='networkidle')
    expect(page.locator('body')).to_contain_text('尚未完成真实Windows安装')
    assert errors == [], errors
    assert remote == [], remote
    page.screenshot(path=str(OUT / 'readable-report.png'), full_page=True)
    browser.close()
print('PASS file:// no-storage fill, validation, JSON export/import, escaped HTML export; no remote requests')
