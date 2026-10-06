import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { validateBackup, previewImport, mergeBackup, exportRecordsCsv } from '../src/domain/backup.js';
import { exportRemindersIcs } from '../src/domain/calendar.js';

const now = '2026-10-06T08:00:00.000Z';
const pet = (id = 'p1') => ({ id, name: '糯米', type: 'dog', birthday: null, estimatedAgeMonths: 12, arrivalDate: null, breed: '', sex: '', image: '' });
const record = (id = 'r1', petId = 'p1') => ({ id, petId, type: 'daily', occurredDate: '2026-10-06', value: null, unit: null, title: '海边散步', note: '开心', createdAt: now, updatedAt: now });
const reminder = (id = 'm1', overrides = {}) => ({ id, petId: 'p1', title: '护理复查', dueDate: '2026-10-08', status: 'pending', originRecordId: null, completionRecordId: null, completedAt: null, ...overrides });
const post = (id = 'post1', title = '新日常') => ({ id, author: '我', pet: '糯米', city: '深圳', topic: '今日萌宠', title, text: '散步', image: '', avatar: '', likes: 0, liked: false, date: '2026-10-06', comments: [] });
const state = () => ({ version: 2, mode: 'demo', activePetId: 'p1', pets: [pet()], records: [record()], reminders: [reminder()], posts: [], profile: { city: '深圳' } });
const copy = value => structuredClone(value);

test('CSV does not report internal fallback timestamps as known legacy creation times',()=>{
  const legacy={...record(),createdAt:'1969-12-31T23:59:59.999Z',updatedAt:'1969-12-31T23:59:59.999Z',legacyCreatedAtUnknown:true};
  const result=spawnSync('python3',['-c','import csv,json,sys; print(json.dumps(list(csv.DictReader(sys.stdin))))'],{input:exportRecordsCsv([legacy]).replace(/^\ufeff/,''),encoding:'utf8'});
  assert.equal(result.status,0);const parsed=JSON.parse(result.stdout)[0];
  assert.equal(parsed.createdAt,'');assert.equal(parsed.updatedAt,'');assert.equal(parsed.occurredDate,'2026-10-06');
});

test('重复备份是重复项而非冲突，重复导入不增加记录或提醒', () => {
  const current = state();
  const preview = previewImport(current, JSON.stringify(current));
  assert.equal(preview.newPets.length, 0);
  assert.equal(preview.newRecords.length, 0);
  assert.equal(preview.newReminders.length, 0);
  assert.equal(preview.conflicts.length, 0);
  const first = mergeBackup(current, current);
  const second = mergeBackup(first, current);
  assert.equal(second.records.length, 1);
  assert.equal(second.reminders.length, 1);
  assert.deepEqual(current, state(), '预览与合并不修改源快照');
});

test('新增档案、记录、提醒和本地帖子一起恢复且保留本地当前宠物和城市', () => {
  const incoming = state();
  incoming.pets.push(pet('p2'));
  incoming.records.push(record('r2', 'p2'));
  incoming.reminders.push(reminder('m2', { petId: 'p2', originRecordId: 'r2' }));
  incoming.posts.push(post());
  incoming.activePetId = 'p2';
  incoming.profile.city = '北京';
  const preview = previewImport(state(), incoming);
  assert.deepEqual(preview.newPets.map(p => p.id), ['p2']);
  assert.deepEqual(preview.newRecords.map(r => r.id), ['r2']);
  assert.deepEqual(preview.newReminders.map(r => r.id), ['m2']);
  assert.deepEqual(preview.newPosts.map(p => p.id), ['post1']);
  const merged = mergeBackup(state(), incoming);
  assert.equal(merged.activePetId, 'p1');
  assert.equal(merged.profile.city, '深圳');
  assert.equal(merged.posts[0].title, '新日常');
  assert.equal(mergeBackup(merged, incoming).posts.length, 1);
});

test('空档案恢复有宠物的备份后选中备份当前宠物，保留本地城市', () => {
  const empty = { version: 2, mode: 'demo', activePetId: null, pets: [], records: [], reminders: [], posts: [], profile: { city: '深圳' } };
  const incoming = state();
  incoming.pets.push(pet('p2'));
  incoming.activePetId = 'p2';
  incoming.profile.city = '北京';
  const merged = mergeBackup(empty, incoming);
  assert.equal(merged.activePetId, 'p2');
  assert.equal(merged.pets.length, 2);
  assert.equal(merged.records[0].petId, 'p1');
  assert.equal(merged.profile.city, '深圳');
  assert.equal(empty.activePetId, null, '原始空档案不被修改');
  assert.equal(mergeBackup(empty, empty).activePetId, null);
});

test('同id标题冲突默认保留，仅 kind:id 确认覆盖，字段顺序不产生假冲突', () => {
  const incoming = state();
  incoming.records[0].title = '修改的标题';
  incoming.reminders[0].title = '修改的事项';
  const preview = previewImport(state(), incoming);
  assert.deepEqual(preview.conflicts.map(c => [c.kind, c.id]), [['record', 'r1'], ['reminder', 'm1']]);
  assert.equal(preview.conflicts[0].current.title, '海边散步');
  assert.equal(preview.conflicts[0].incoming.title, '修改的标题');
  assert.equal(mergeBackup(state(), incoming).records[0].title, '海边散步');
  assert.equal(mergeBackup(state(), incoming, { acceptedConflictIds: ['r1'] }).records[0].title, '海边散步');
  const merged = mergeBackup(state(), incoming, { acceptedConflictIds: ['record:r1'] });
  assert.equal(merged.records[0].title, '修改的标题');
  assert.equal(merged.reminders[0].title, '护理复查');
  assert.equal(merged.activePetId, 'p1');
  const reordered = state();
  reordered.records[0] = Object.fromEntries(Object.entries(reordered.records[0]).reverse());
  assert.equal(previewImport(state(), reordered).conflicts.length, 0);
});

test('坏JSON、未知版本、孤儿记录及账户快照拒绝', () => {
  assert.throws(() => validateBackup('{broken'));
  assert.throws(() => validateBackup({ ...state(), version: 99 }));
  assert.throws(() => validateBackup({ ...state(), records: [record('r1', 'missing')] }));
  assert.throws(() => validateBackup({ ...state(), mode: 'account' }));
  const invalid = state();
  invalid.reminders[0].originRecordId = 'missing';
  assert.throws(() => validateBackup(invalid));
});

test('同id对象不得改变宠物归属，包括确认覆盖与通过新提醒关联冲突记录', () => {
  const incoming = state();
  incoming.pets.push(pet('p2'));
  incoming.records[0].petId = 'p2';
  incoming.reminders = [reminder('m2', { petId: 'p2', originRecordId: 'r1' })];
  assert.throws(() => previewImport(state(), incoming));
  assert.throws(() => mergeBackup(state(), incoming, { acceptedConflictIds: ['record:r1'] }));
  const changedReminder = state();
  changedReminder.pets.push(pet('p2'));
  changedReminder.reminders[0].petId = 'p2';
  assert.throws(() => mergeBackup(state(), changedReminder, { acceptedConflictIds: ['reminder:m1'] }));
});

test('帖子必须有唯一id，避免重复或无标识帖子在恢复时悄悄丢失', () => {
  const missingId = post();
  delete missingId.id;
  assert.throws(() => validateBackup({ ...state(), posts: [missingId] }));
  assert.throws(() => validateBackup({ ...state(), posts: [post('post1', '一'), post('post1', '二')] }));
});

test('帖子与记录的id相同也能独立确认冲突，帖子默认保留本地', () => {
  const current = state();
  current.posts.push(post('r1', '本地帖子'));
  const incoming = copy(current);
  incoming.records[0].title = '备份记录';
  incoming.posts[0].title = '备份帖子';
  const preview = previewImport(current, incoming);
  assert.deepEqual(preview.conflicts.map(c => `${c.kind}:${c.id}`), ['record:r1', 'post:r1']);
  assert.equal(mergeBackup(current, incoming).posts[0].title, '本地帖子');
  const merged = mergeBackup(current, incoming, { acceptedConflictIds: ['post:r1'] });
  assert.equal(merged.posts[0].title, '备份帖子');
  assert.equal(merged.records[0].title, '海边散步');
});

test('v1备份迁移保留记录与提醒，缺失创建时间重复导入仍确定', () => {
  const legacy = { version: 1, city: '深圳', activePet: 'p1', pets: [{ id: 'p1', name: '糯米', type: 'dog', birthday: '2025-10-06', arrival: '2025-11-06', breed: '', sex: '', image: '' }], records: [{ id: 'old1', petId: 'p1', type: 'daily', date: '2026-10-06', title: '散步', note: '开心', nextDate: '2026-10-08' }], posts: [] };
  const migrated = validateBackup(JSON.stringify(legacy));
  assert.equal(migrated.version, 3);
  assert.equal(migrated.records[0].occurredDate, '2026-10-06');
  assert.equal(migrated.reminders[0].dueDate, '2026-10-08');
  const merged = mergeBackup(migrated, legacy);
  assert.equal(merged.records.length, 1);
  assert.equal(merged.reminders.length, 1);
  assert.equal(previewImport(merged, legacy).conflicts.length, 0);
});

test('CSV标准解析保留中文、双引号、逗号和换行，并把危险公式作为文本', () => {
  const r = record();
  r.id = 'id-unchanged';
  r.title = '中文,"双引号"';
  r.note = '第一行\n第二行';
  const formula = record('=danger');
  formula.title = '=HYPERLINK("https://example.com")';
  formula.note = '\t+SUM(1,2)';
  const other = record('safe-id');
  other.title = '-2+3';
  other.note = '@SUM(1,2)';
  const csv = exportRecordsCsv([r, formula, other]);
  const parsed = spawnSync('python3', ['-c', 'import csv,io,json,sys; print(json.dumps(list(csv.reader(io.StringIO(sys.stdin.read().lstrip("\\ufeff")))),ensure_ascii=False))'], { input: csv, encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr);
  const rows = JSON.parse(parsed.stdout);
  assert.deepEqual(rows[0], ['id', 'petId', 'type', 'occurredDate', 'value', 'unit', 'title', 'note', 'createdAt', 'updatedAt']);
  assert.deepEqual(rows[1], ['id-unchanged', 'p1', 'daily', '2026-10-06', '', '', '中文,"双引号"', '第一行\n第二行', now, now]);
  assert.equal(rows[2][0], "'=danger");
  assert.equal(rows[2][6], '\'=HYPERLINK("https://example.com")');
  assert.equal(rows[2][7], "'\t+SUM(1,2)");
  assert.equal(rows[3][6], "'-2+3");
  assert.equal(rows[3][7], "'@SUM(1,2)");
});

test('ICS只导出待办，全天日期无时区偏移且使用稳定UID', () => {
  const reminders = [reminder(), reminder('completed', { status: 'completed' }), reminder('cancelled', { status: 'cancelled' })];
  const ics = exportRemindersIcs(reminders, [pet()]);
  assert.match(ics, /DTSTART;VALUE=DATE:20261008\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261009\r\n/);
  assert.match(ics, /UID:m1@paw-diary\r\n/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.doesNotMatch(ics, /TZID|VTIMEZONE|VALARM|UID:completed|UID:cancelled/);
  assert.match(ics, /DTSTAMP:\d{8}T\d{6}Z/);
  assert.equal(exportRemindersIcs(reminders, [pet()]).match(/UID:([^\r]+)/)[1], 'm1@paw-diary');
});

test('ICS中文文本正确转义并按UTF8字节折行，不割裂字符', () => {
  const title = '复查,疫苗;\\护理\n第二行' + '中文'.repeat(35);
  const ics = exportRemindersIcs([reminder('m1', { title })], [pet()]);
  const unfolded = ics.replace(/\r\n[ \t]/g, '');
  assert.match(unfolded, /SUMMARY:糯米 · 复查\\,疫苗\\;\\\\护理\\n第二行/);
  assert.match(unfolded, /DESCRIPTION:宠物：糯米\\n事项：复查\\,疫苗\\;\\\\护理\\n第二行/);
  assert.ok(ics.split('\r\n').some(line => line.startsWith(' ')));
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `行过长：${Buffer.byteLength(line)}`);
  assert.equal(unfolded.includes('\ufffd'), false);
  assert.equal(ics.replaceAll('\r\n', '').includes('\n'), false);
});

test('ICS结束日期跨月年和闰年正确，非法日期或不存在的宠物拒绝', () => {
  for (const [dueDate, expected] of [['2026-10-31', '20261101'], ['2026-12-31', '20270101'], ['2028-02-29', '20280301']]) {
    assert.ok(exportRemindersIcs([reminder('m1', { dueDate })], [pet()]).includes(`DTEND;VALUE=DATE:${expected}\r\n`));
  }
  assert.throws(() => exportRemindersIcs([reminder('m1', { dueDate: '2026-02-30' })], [pet()]));
  assert.throws(() => exportRemindersIcs([reminder('m1', { petId: 'missing' })], [pet()]));
});

test('ICS从完整V3资料导出时排除事项自身的回收站资料', () => {
  const full = validateBackup(state());
  full.reminders.push(reminder('trashed-care', { deletedAt: now }));
  const before = copy(full);
  const ics = exportRemindersIcs(full.reminders, full.pets);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(ics, /UID:m1@paw-diary\r\n/);
  assert.doesNotMatch(ics, /UID:trashed-care@paw-diary/);
  assert.deepEqual(full, before);
});

test('ICS从完整V3资料导出时排除父宠物在回收站的待办', () => {
  const full = validateBackup(state());
  full.pets.push({ ...pet('hidden-pet'), deletedAt: now });
  full.reminders.push(reminder('hidden-parent-care', { petId: 'hidden-pet', deletedAt: null }));
  const ics = exportRemindersIcs(full.reminders, full.pets);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(ics, /UID:m1@paw-diary\r\n/);
  assert.doesNotMatch(ics, /UID:hidden-parent-care@paw-diary/);
  assert.doesNotMatch(exportRemindersIcs([full.reminders[1]], full.pets), /BEGIN:VEVENT/);
});

test('ICS仍兼容没有deletedAt标记的旧V2可见待办', () => {
  const old = state();
  const ics = exportRemindersIcs(old.reminders, old.pets);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(ics, /UID:m1@paw-diary\r\n/);
});
