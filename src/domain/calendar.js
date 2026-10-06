// RFC 5545 §§3.1, 3.3.11 and 3.6.1: UTF-8 folding, TEXT escaping, exclusive DTEND.
function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('护理日期无效');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('护理日期无效');
  return date;
}

function text(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
}

function fold(line) {
  const encoder = new TextEncoder();
  const lines = [];
  let part = '';
  let bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      lines.push(part);
      part = ' ';
      bytes = 1;
    }
    part += character;
    bytes += length;
  }
  lines.push(part);
  return lines.join('\r\n');
}

export function exportRemindersIcs(reminders, pets) {
  if (!Array.isArray(reminders) || !Array.isArray(pets)) throw new Error('护理事项或宠物资料无效');
  const petsById = new Map(pets.map(pet => [pet.id, pet]));
  const ids = new Set();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Paw Diary//Care Reminders//ZH', 'CALSCALE:GREGORIAN'];
  for (const reminder of reminders) {
    if (!['pending', 'completed', 'cancelled'].includes(reminder.status)) throw new Error('护理事项状态无效');
    if (reminder.status !== 'pending' || reminder.deletedAt != null) continue;
    const pet = petsById.get(reminder.petId);
    if (!pet) throw new Error('护理事项找不到所属宠物');
    if (pet.deletedAt != null) continue;
    if (typeof reminder.id !== 'string' || !reminder.id || /[\r\n\u0000-\u001f]/.test(reminder.id) || ids.has(reminder.id)) throw new Error('护理事项标识无效或重复');
    ids.add(reminder.id);
    if (typeof reminder.title !== 'string' || !reminder.title.trim() || typeof pet.name !== 'string' || !pet.name.trim()) throw new Error('护理事项或宠物名称无效');
    const date = calendarDate(reminder.dueDate);
    date.setUTCDate(date.getUTCDate() + 1);
    const nextDate = date.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) throw new Error('护理结束日期超出支持范围');
    lines.push('BEGIN:VEVENT', `UID:${text(reminder.id)}@paw-diary`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${reminder.dueDate.replaceAll('-', '')}`,
      `DTEND;VALUE=DATE:${nextDate.replaceAll('-', '')}`,
      `SUMMARY:${text(`${pet.name} · ${reminder.title}`)}`,
      `DESCRIPTION:${text(`宠物：${pet.name}\n事项：${reminder.title}\n原定日期：${reminder.dueDate}`)}`,
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
