import test from 'node:test';
import assert from 'node:assert/strict';
let api, zh, en, errors;
try {
  api = await import('../src/ui/i18n.js');
  zh = (await import('../src/ui/locales/zh-CN.js')).default;
  en = (await import('../src/ui/locales/en.js')).default;
  errors = await import('../src/ui/error-localization.js');
} catch {}
const available = () => assert.ok(api, 'language module must be available');
test('Chinese and English provide identical keys and interpolation parameters', () => {
  available();
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const key of Object.keys(zh)) assert.deepEqual(zh[key].match(/\{\w+\}/g)?.sort() || [], en[key].match(/\{\w+\}/g)?.sort() || [], key);
  assert.equal(en['nav.health'], 'Health');
  assert.ok(Object.keys(zh).length > 150, 'four pages and management require broad vocabulary');
});
test('interpolation preserves user text and escapes it only at the HTML boundary', () => {
  available();
  const i18n = api.createI18n({storage:null});
  const text = i18n.t('photo.deleteConfirm', {caption:'<img src=x onerror=alert(1)> & 糯米'});
  assert.ok(text.includes('<img src=x onerror=alert(1)> & 糯米'));
  assert.ok(api.escapeTranslation(text).includes('&lt;img'));
  assert.ok(!api.escapeTranslation(text).includes('<img'));
  assert.equal(i18n.t('missing.key'), 'missing.key');
});
test('language preference survives refresh and notifies once without changing business data', () => {
  available();
  const values = new Map(), storage = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const first=api.createI18n({storage});let calls=0;const stop=first.subscribeLocale(()=>calls++);
  assert.equal(first.getLocale(),'zh-CN');first.setLocale('en');first.setLocale('en');
  assert.equal(calls,1);assert.equal(api.createI18n({storage}).getLocale(),'en');
  stop();first.setLocale('zh-CN');assert.equal(calls,1);
  assert.equal(values.size,1);assert.throws(()=>first.setLocale('fr'),/locale/);
});
test('literal translation does not transform names, custom labels, notes or post text', () => {
  available();const i18n=api.createI18n({storage:null});i18n.setLocale('en');
  assert.equal(i18n.translateLiteral('健康档案'),'Health Records');
  for(const text of ['糯米','自定义护理：晚饭后','今天在公园睡着了','我的帖子原文']) assert.equal(i18n.translateLiteral(text),text);
});
test('known errors localize while unknown server failures never expose raw messages', () => {
  available();const i18n=api.createI18n({storage:null});i18n.setLocale('en');
  assert.equal(errors.localizeError({code:'conflict',message:'private path /users/a'},i18n.t), 'Your data changed elsewhere. Refresh and try again.');
  assert.equal(errors.localizeError({message:'secret database stack trace'},i18n.t),'Something went wrong. Please try again.');
  assert.equal(errors.localizeError({message:'请填写宠物名字。'},i18n.t),'Enter a pet name.');
});
test('backend uppercase codes and audited message keys produce actionable localized errors',()=>{
  available();const i18n=api.createI18n({storage:null});i18n.setLocale('en');
  assert.equal(errors.localizeError({code:'CONFLICT',messageKey:'errors.conflict'},i18n.t),'Your data changed elsewhere. Refresh and try again.');
  assert.equal(errors.localizeError({code:'QUOTA_EXCEEDED'},i18n.t),'Storage is full. Export a backup or delete unneeded photos before retrying.');
  assert.equal(errors.localizeError({message:'体重需在0.01至200 kg之间'},i18n.t),'Weight must be between 0.01 and 200 kg.');
  assert.equal(errors.localizeError({message:'图片格式与MIME不一致，只支持JPEG/PNG/WebP'},i18n.t),'Choose a JPEG, PNG or WebP image.');
});
test('reviewed domain field errors localize without exposing arbitrary backend labels',()=>{
  available();const i18n=api.createI18n({storage:null});i18n.setLocale('en');
  assert.equal(errors.localizeError({message:'宠物名不能为空'},i18n.t),'Enter Pet name.');
  assert.equal(errors.localizeError({message:'自定义记录类型不能超过20字'},i18n.t),'Custom type must be no longer than 20 characters.');
  assert.equal(errors.localizeError({message:'记录日期不是有效日期'},i18n.t),'Enter a valid Record date.');
  assert.equal(errors.localizeError({message:'secret_customer_email不能为空'},i18n.t),'Something went wrong. Please try again.');
});
test('blocked browser storage cannot prevent language use and inherited keys stay plain text',()=>{
  available();const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('storage blocked');}});
  try{const i18n=api.createI18n();assert.equal(i18n.getLocale(),'zh-CN');i18n.setLocale('en');assert.equal(i18n.t('nav.home'),'Home');assert.equal(i18n.t('toString'),'toString');}
  finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});
test('integrated backup count summary and personal workspace copy are available in English',()=>{
  available();const i18n=api.createI18n({storage:null});i18n.setLocale('en');
  assert.equal(i18n.t('backup.countSummary',{pets:1,records:2,reminders:3,photos:4}),'Pets: 1 · Records: 2 · Reminders: 3 · Photos: 4');
  assert.equal(i18n.translateLiteral('开始记录我的宠物'),'Start my pet journal');
  assert.equal(i18n.translateLiteral('个人资料仅保存在当前浏览器'),'Personal data stays in this browser');
});
test('backup restoration refusal gives the parent-pet recovery action without exposing arbitrary similar errors',()=>{
  available();const i18n=api.createI18n({storage:null});
  const refusal=new Error('请先恢复所属宠物，或在本次备份预览中一起确认恢复宠物');
  assert.equal(errors.localizeError(refusal,i18n.t),'请先恢复所属宠物');
  i18n.setLocale('en');
  assert.equal(errors.localizeError(refusal,i18n.t),'Restore the parent pet first.');
  const unknown=new Error('请先恢复所属宠物，或在本次备份预览中一起确认恢复宠物 /private/customer/email');
  assert.equal(errors.localizeError(unknown,i18n.t),'Something went wrong. Please try again.');
});
