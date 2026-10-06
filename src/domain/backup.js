import { migrateV1, validateSnapshot } from './schema.js';

// A legacy file with no timestamps must produce the same IDs/order on every import.
const LEGACY_IMPORT_TIME = '1970-01-01T00:00:00.000Z';
const collections = [
  { field: 'pets', kind: 'pet', output: 'newPets' },
  { field: 'records', kind: 'record', output: 'newRecords' },
  { field: 'reminders', kind: 'reminder', output: 'newReminders' },
  { field: 'posts', kind: 'post', output: 'newPosts' }
];

export function validateBackup(raw) {
  let parsed = raw;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); }
    catch { throw new Error('备份不是有效的 JSON 文件'); }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('备份格式无效');
  if (parsed.version !== 1 && parsed.version !== 2) throw new Error('不支持此备份版本');
  if ((parsed.mode !== undefined && parsed.mode !== 'demo') || parsed.ownerId != null || parsed.profile?.ownerId != null) {
    throw new Error('本阶段仅支持本地示例备份，请勿导入账户资料');
  }
  for (const { field } of collections) {
    if (Array.isArray(parsed[field]) && parsed[field].some(item => item?.ownerId != null)) {
      throw new Error('账户归属需要另行确认，本阶段不可导入');
    }
  }
  const snapshot = validateSnapshot(parsed.version === 1 ? migrateV1(parsed, { now: LEGACY_IMPORT_TIME }) : parsed);
  const postIds = new Set();
  for (const post of snapshot.posts) {
    if (typeof post.id !== 'string' || !post.id.trim() || postIds.has(post.id)) throw new Error('备份中的帖子标识无效或重复');
    postIds.add(post.id);
  }
  return snapshot;
}

function comparable(value) {
  if (Array.isArray(value)) return value.map(comparable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, comparable(value[key])]));
  }
  return value;
}

function same(left, right) {
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

function importPreview(local, incoming) {
  const result = { newPets: [], newRecords: [], newReminders: [], newPosts: [], conflicts: [] };
  for (const { field, kind, output } of collections) {
    const existing = new Map(local[field].map(item => [item.id, item]));
    for (const item of incoming[field]) {
      const previous = existing.get(item.id);
      if (!previous) {
        result[output].push(item);
        continue;
      }
      // A confirmation may edit content, never transfer an existing object's pet.
      if ((kind === 'record' || kind === 'reminder') && previous.petId !== item.petId) {
        throw new Error(`备份中的${kind === 'record' ? '记录' : '提醒'} ${item.id} 与本地宠物归属冲突`);
      }
      if (!same(previous, item)) result.conflicts.push({ kind, id: item.id, current: previous, incoming: item });
    }
  }
  return result;
}

export function previewImport(current, backup) {
  return importPreview(validateBackup(current), validateBackup(backup));
}

export function mergeBackup(current, backup, { acceptedConflictIds = [] } = {}) {
  if (!Array.isArray(acceptedConflictIds) || acceptedConflictIds.some(id => typeof id !== 'string')) {
    throw new Error('请按预览逐项确认冲突');
  }
  const local = validateBackup(current);
  const incoming = validateBackup(backup);
  const hadLocalPets = local.pets.length > 0;
  const preview = importPreview(local, incoming);
  const accepted = new Set(acceptedConflictIds);
  for (const { field, kind, output } of collections) {
    const changes = new Map(preview.conflicts.filter(conflict => conflict.kind === kind && accepted.has(`${kind}:${conflict.id}`)).map(conflict => [conflict.id, conflict.incoming]));
    local[field] = local[field].map(item => changes.get(item.id) || item).concat(preview[output]);
  }
  if (!hadLocalPets && local.pets.length > 0) {
    local.activePetId = local.pets.some(pet => pet.id === incoming.activePetId) ? incoming.activePetId : local.pets[0].id;
  }
  // Validate combined links too: independently valid snapshots may conflict after merging.
  return validateSnapshot(local);
}

const csvFields = ['id', 'petId', 'type', 'occurredDate', 'value', 'unit', 'title', 'note', 'createdAt', 'updatedAt'];
function csvCell(value) {
  let text = String(value ?? '');
  // CSV quoting alone does not disable spreadsheet formulas. Preserve text as text.
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/u.test(value)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportRecordsCsv(records) {
  if (!Array.isArray(records)) throw new Error('请选择要导出的记录');
  return '\ufeff' + [csvFields.map(csvCell).join(','), ...records.map(record => csvFields.map(field => csvCell(record[field])).join(','))].join('\r\n') + '\r\n';
}
