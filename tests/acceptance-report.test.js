import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
let api = {}, packaging = {};
try { api = await import('../tools/acceptance/windows/report-model.js'); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
try { packaging = await import('../scripts/build-acceptance-pack.mjs'); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
const environment = { os: 'Windows 11', browser: 'Edge', browserVersion: '待用户核对', mode: 'browser' };
const report = options => { assert.equal(typeof api.buildManualReport, 'function'); return api.buildManualReport({ environment, checkedAt: '2026-10-08T13:00:00+08:00', ...options }); };
test('all manual checks start not-run and cover each independent device boundary', () => {
  const value = report();
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.productVersion, '0.8.0');
  assert.equal(value.manualChecks.length, api.MANUAL_CHECKS.length);
  assert.ok(value.manualChecks.length >= 25);
  assert.ok(value.manualChecks.every(check => check.status === 'not-run'));
  for (const id of ['guide-step-1','guide-step-6','guide-skip','guide-replay','windows-install','windows-uninstall','windows-narrator','iphone-keyboard','iphone-location-allow','iphone-location-deny','iphone-voiceover','mac-install','mac-update','mac-voiceover','calendar-first','calendar-repeat','calendar-reschedule']) assert.ok(value.manualChecks.some(check => check.id === id), id);
});
test('automatic success never marks a manual OS operation passed', () => {
  const value = report({ checks: { autoChecks: [{ id: 'manifest', status: 'pass', evidence: 'HTTP200' }] } });
  assert.deepEqual(value.autoChecks, [{ id: 'manifest', status: 'pass', evidence: 'HTTP200' }]);
  assert.ok(value.manualChecks.every(check => check.status === 'not-run'));
});
test('failed checks require a nonblank reason while unverified preserves an explanation', () => {
  assert.throws(() => report({ checks: [{ id: 'windows-install', status: 'fail' }] }), /reason/i);
  assert.throws(() => report({ checks: [{ id: 'windows-install', status: 'fail', reason: ' ' }] }), /reason/i);
  const value = report({ checks: [{ id: 'windows-install', status: 'unverified', reason: '没有Windows设备' }] });
  assert.equal(value.manualChecks.find(check => check.id === 'windows-install').reason, '没有Windows设备');
});
test('missing environment unknown status unknown manual check and duplicate id are rejected', () => {
  for (const value of [{ ...report(), environment: {} }, { ...report(), manualChecks: [{ id: 'windows-install', status: 'probably' }] }, { ...report(), manualChecks: [{ id: 'made-up', status: 'pass' }] }, { ...report(), autoChecks: [{ id: 'manifest', status: 'pass' }, { id: 'manifest', status: 'pass' }] }]) assert.throws(() => api.importManualReport(value));
});
test('UTF8 notes and evidence roundtrip without interpreting markup', () => {
  const original = report({ notes: '中文记录 <img src=x onerror=alert(1)>', checks: [{ id: 'windows-install', status: 'pass', evidence: '系统安装窗口已见' }] });
  assert.deepEqual(api.importManualReport(JSON.parse(JSON.stringify(original))), original);
  assert.equal(api.importManualReport(original).notes, original.notes);
});
test('report imports are copied and reject unknown payload fields', () => {
  const original = report();
  const imported = api.importManualReport(original);
  imported.manualChecks[0].status = 'pass';
  assert.equal(original.manualChecks[0].status, 'not-run');
  assert.throws(() => api.importManualReport({ ...original, authToken: 'not-allowed' }));
  assert.throws(() => api.importManualReport({ ...original, schemaVersion: 2 }));
});
test('automatic-only file can be combined without changing manual progress', () => {
  const original = report({ checks: [{ id: 'guide-step-1', status: 'pass' }] });
  const imported = api.importManualReport({ ...report(), autoChecks: [{ id: 'release-version', status: 'unverified', reason: '公开仍0.7.1；候选0.8.0尚未部署' }] });
  const combined = report({ checks: { manualChecks: original.manualChecks, autoChecks: imported.autoChecks } });
  assert.equal(combined.manualChecks[0].status, original.manualChecks[0].status);
  assert.equal(combined.autoChecks[0].status, 'unverified');
});
test('packaging produces a self-contained offline HTML and an exact safe archive whitelist', async () => {
  assert.equal(typeof packaging.buildAcceptancePack, 'function');
  const outdir = await mkdtemp(join(tmpdir(), 'paw-acceptance-test-'));
  try {
    const result = await packaging.buildAcceptancePack({ version: '0.8.0', outdir });
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    const files = execFileSync('unzip', ['-Z1', result.archivePath], { encoding: 'utf8' }).trim().split('\n');
    assert.deepEqual(files.sort(), ['START-HERE.html','README.txt','check-public.ps1','RUN-CHECK.cmd','report-schema.json','device-checklist.md'].sort());
    const html = await readFile(join(outdir, 'START-HERE.html'), 'utf8');
    assert.ok(html.includes('全部未开始'));
    assert.ok(!html.includes('type="module"'));
    assert.ok(!/<script[^>]+src=/.test(html));
    assert.ok(!html.includes('<!-- INLINE_REPORT_UI -->'));
    assert.ok(!/localStorage|sessionStorage|cloudbase|SECRET_KEY|Authorization/.test(html));
  } finally { await rm(outdir, { recursive: true, force: true }); }
});
test('Windows public checker compares declared digest and release identity before reporting consistency', async () => {
  const script = await readFile(new URL('../tools/acceptance/windows/check-public.ps1', import.meta.url), 'utf8');
  assert.match(script, /\$Assets\.release\.version\s+-c?ne\s+\$Release\.version/, 'asset metadata must compare its version with release.json');
  assert.match(script, /\$Assets\.release\.buildId\s+-c?ne\s+\$Release\.buildId/, 'asset metadata must compare its build with release.json');
  assert.match(script, /\$Assets\.sha256\.\$Kind/, 'each actual entry needs its declared digest');
  assert.match(script, /\$ActualDigest\s+-c?ne\s+\$DeclaredDigest/, 'recording a digest without comparing it is not verification');
  assert.match(script, /SHA256 mismatch/, 'digest mismatch must explain a failed consistency check');
  assert.match(script, /'asset-release'\s+'fail'/, 'release identity mismatch is a failure, not a candidate warning');
  assert.match(script, /'asset-release'\s+'unverified'/, 'legacy metadata without declarations remains unverified');
  assert.match(script, /'asset-'\+\$Kind\)\s+'fail'/, 'public resource corruption cannot report pass');
  assert.match(script, /-MaximumRedirection\s+0/);
  assert.match(script, /\[Text\.UTF8Encoding\]|Text\.UTF8Encoding/);
  assert.doesNotMatch(script, /-UseDefaultCredentials|-Credential|-ExecutionPolicy|Get-ChildItem.+(AppData|profile)|\$env:/i);
});
test('digest mismatch reports preserve failures separately from candidate availability and manual checks', () => {
  const value = report({ checks: { autoChecks: [
    { id: 'asset-app', status: 'fail', reason: 'SHA256 mismatch: declared public digest does not match downloaded bytes' },
    { id: 'asset-style', status: 'pass', evidence: 'SHA256 matched its declaration' },
    { id: 'asset-release', status: 'fail', reason: 'Asset release buildId differs from release.json' },
    { id: 'release-version', status: 'unverified', reason: 'Candidate not yet deployed' },
  ] } });
  const restored = api.importManualReport(JSON.parse(JSON.stringify(value)));
  assert.deepEqual(restored.autoChecks, value.autoChecks);
  assert.ok(restored.manualChecks.every(check => check.status === 'not-run'));
});
test('Windows checker requires the fixed paw-diary app identity while retaining relative launch and scope', async () => {
  const script = await readFile(new URL('../tools/acceptance/windows/check-public.ps1', import.meta.url), 'utf8');
  assert.match(script, /\$Manifest\.id\s+-ne\s+'\/paw-diary\/'/, 'manifest id resolves against origin and must retain the project path');
  assert.match(script, /\$Manifest\.start_url\s+-ne\s+'\.\/#home'/);
  assert.match(script, /\$Manifest\.scope\s+-ne\s+'\.\/'/);
});
test('Windows checker normalizes UTF8 response bytes before parsing JSON or matching index text', async () => {
  const script = await readFile(new URL('../tools/acceptance/windows/check-public.ps1', import.meta.url), 'utf8');
  assert.match(script, /function Get-ResponseText\(\$Response\)/, 'one response decoder owns byte[]/string compatibility');
  assert.match(script, /\$Content\s+-is\s+\[byte\[\]\]/);
  assert.match(script, /\[Text\.Encoding\]::UTF8\.GetString\(\$Content\)/, 'byte Content must decode bytes as UTF8, never cast decimal bytes to a string');
  assert.match(script, /\$Content\s+-is\s+\[string\]/);
  assert.match(script, /function ConvertFrom-PublicJson\(\$Response\)/);
  assert.match(script, /Get-ResponseText\s+\$Response\)\s*\|\s*ConvertFrom-Json/);
  for (const resource of ['release.json','manifest.webmanifest','asset-manifest.json']) {
    assert.ok(script.includes(`ConvertFrom-PublicJson (Get-Public '${resource}')`), `${resource} must use the common byte-safe JSON boundary`);
  }
  assert.match(script, /\$PageText\s*=\s*Get-ResponseText\s+\$Page/);
  assert.match(script, /\$PageText\.Contains\(\$Path\)/);
  assert.doesNotMatch(script, /\.Content\s*\|\s*ConvertFrom-Json|\[string\]\$Page\.Content/, 'raw byte[] response must not reach a text consumer');
  assert.match(script, /RawContentStream\.ToArray\(\)/, 'integrity hashing must keep the original bytes');
});
