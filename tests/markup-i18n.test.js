import test from 'node:test';
import assert from 'node:assert/strict';
import {createI18n} from '../src/ui/i18n.js';
let api;try{api=await import('../src/ui/markup-i18n.js');}catch{}
const available=()=>assert.ok(api,'static markup translation helper is required');
const english=()=>{available();const i18n=createI18n({storage:null});i18n.setLocale('en');return api.createMarkupI18n({t:i18n.t,getLocale:i18n.getLocale});};
test('markup tag translates only static UI copy and preserves user text equal to a dictionary value',()=>{
  const {html}=english();
  assert.equal(html`<h2>健康档案</h2><p>${'健康档案'}</p>`,'<h2>Health Records</h2><p>健康档案</p>');
  assert.equal(html`<p>${'<em>健康档案</em>'}</p>`,'<p><em>健康档案</em></p>');
});
test('translation leaves table structure and dynamic row markup in its exact original location',()=>{
  const {html}=english();const rows='<tr><td>健康档案</td></tr>';
  assert.equal(html`<table><thead><tr><th>日期</th></tr></thead><tbody>${rows}</tbody></table>`,'<table><thead><tr><th>Date</th></tr></thead><tbody><tr><td>健康档案</td></tr></tbody></table>');
});
test('only reviewed display attributes translate and dynamic attributes remain unchanged',()=>{
  const {html}=english();
  assert.equal(html`<input name="健康档案" data-value="健康档案" placeholder="分享你的想法…" title="健康档案" aria-label="搜索社区内容" alt="图片暂不可用" value="${'健康档案'}">`,'<input name="健康档案" data-value="健康档案" placeholder="Share your thoughts…" title="Health Records" aria-label="Search community content" alt="Image unavailable" value="健康档案">');
});
test('semantic phrases translate around dynamic markers without translating user arguments',()=>{
  const {html}=english();
  assert.equal(html`<h2>你好呀，${'健康档案'}。</h2>`,'<h2>Hello, 健康档案.</h2>');
  assert.equal(html`<button aria-label="上移${'健康档案'}">上移</button>`,'<button aria-label="Move 健康档案 up">Move up</button>');
});
test('plain UI text translation is exact and Chinese locale leaves source markup unchanged',()=>{
  const {translateUiText}=english();assert.equal(translateUiText('  保存记录  '),'  Save record  ');assert.equal(translateUiText('健康档案原文'),'健康档案原文');
  available();const i18n=createI18n({storage:null});const {html}=api.createMarkupI18n({t:i18n.t,getLocale:i18n.getLocale});
  assert.equal(html`<tbody>${'<tr><td>健康档案</td></tr>'}</tbody>`,'<tbody><tr><td>健康档案</td></tr></tbody>');
});
test('HTML-significant user values remain untouched and markers cannot be forged by another value',()=>{
  const {html}=english();const user='\uE000paw-i18n:1\uE001';
  assert.equal(html`<p>${user}</p><p>${'健康档案'}</p>`,'<p>'+user+'</p><p>健康档案</p>');
});
test('translated attribute apostrophes are escaped without modifying dynamic attribute contents',()=>{
  const {html}=english();assert.equal(html`<button title='把毛茸茸的快乐，分享出去。' aria-label="${'already &amp; escaped'}">返回</button>`,"<button title='Share your pet&#39;s little joys.' aria-label=\"already &amp; escaped\">Back</button>");
});
test('semantic template translation supports compact legacy dates and multiple numeric placeholders',()=>{
  const {html}=english();assert.equal(html`<span>约${2}岁${3}个月</span>`,'<span>About 2 years 3 months</span>');
  assert.equal(html`<p>和${'健康档案'}一起，把平凡的日子变成珍贵的回忆。</p>`,'<p>Turn ordinary days with 健康档案 into precious memories.</p>');
});
test('existing management counters and reminder confirmations translate as semantic phrases',()=>{
  const {html}=english();
  assert.equal(html`<p>已选择 ${2} ${'pets'}</p>`,'<p>2 pets selected</p>');
  assert.equal(html`<p>取消“${'健康档案'}”会保留历史记录，不会删除健康档案。</p>`,'<p>Cancelling “健康档案” keeps its history and does not delete health records.</p>');
  assert.equal(html`<p>新增 ${1} 只宠物、${2} 条记录、${3} 项提醒、${4} 篇本地日常。</p>`,'<p>Add 1 pets, 2 records, 3 reminders and 4 local posts.</p>');
});
test('static labels beside dynamic icon markup translate while every icon and user value stays original',()=>{
  const {html}=english();const icon='<svg aria-hidden="true"><path/></svg>';
  assert.equal(html`<button>${icon} 添加记录 ${icon}</button>`,`<button>${icon} Add record ${icon}</button>`);
  assert.equal(html`<span>${'健康档案'} 评论</span>`,'<span>健康档案 comments</span>');
});
test('display attributes in standalone markup fragments translate without parsing a fake DOM',()=>{
  const {html}=english();assert.equal(html`tabindex="0" role="region" aria-label="编辑${'健康档案'}"`,'tabindex="0" role="region" aria-label="Edit 健康档案"');
});
