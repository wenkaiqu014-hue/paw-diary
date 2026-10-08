import {MANUAL_CHECKS,buildManualReport,importManualReport} from './report-model.js';
const $ = id => document.getElementById(id);
const states = [['not-run','未开始'],['pass','通过'],['fail','失败'],['unverified','未能核验']];
let autoChecks = [];
function element(tag,text) { const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node; }
function summary() {
  const values = [...document.querySelectorAll('[data-check-status]')].map(node=>node.value);
  $('manual-summary').textContent=values.every(value=>value==='not-run')?'全部未开始':`人工项目：通过${values.filter(v=>v==='pass').length} / 失败${values.filter(v=>v==='fail').length} / 未能核验${values.filter(v=>v==='unverified').length} / 未开始${values.filter(v=>v==='not-run').length}`;
}
for (const check of MANUAL_CHECKS) {
  const row=element('details'),title=element('summary',check.title+' '),platform=element('small',`[${{all:'三端通用',windows:'Windows',iphone:'iPhone',mac:'Mac'}[check.platform]}]`);
  title.append(platform);row.append(title);
  for(const [key,label] of [['operation','操作'],['expected','预期'],['evidence','证据'],['cleanup','清理']])row.append(element('p',`${label}：${check[key]}`));
  const fields=element('div');fields.className='fields check-fields';
  const statusLabel=element('label','结果'),select=element('select');select.dataset.checkStatus=check.id;select.setAttribute('aria-label',check.title+' 结果');
  for(const [value,label] of states){const option=element('option',label);option.value=value;select.append(option);}select.addEventListener('change',summary);statusLabel.append(select);fields.append(statusLabel);
  for(const [field,label] of [['reason','原因（失败必填）'],['evidence','证据描述（勿填个人资料）']]){const outer=element('label',label),input=element('textarea');input.maxLength=4000;input.dataset[field==='reason'?'checkReason':'checkEvidence']=check.id;input.setAttribute('aria-label',check.title+' '+label);outer.append(input);fields.append(outer);}
  row.append(fields);$('manual-checks').append(row);
}
function message(text){$('report-message').textContent=text;}
function report(){return buildManualReport({productVersion:$('candidate-version').textContent,environment:Object.fromEntries(['os','browser','browserVersion','mode'].map(key=>[key,$('environment-'+key).value.trim()])),checks:{autoChecks,manualChecks:MANUAL_CHECKS.map(check=>({id:check.id,status:document.querySelector(`[data-check-status="${check.id}"]`).value,reason:document.querySelector(`[data-check-reason="${check.id}"]`).value,evidence:document.querySelector(`[data-check-evidence="${check.id}"]`).value}))},notes:$('notes').value});}
function download(body,type,name){const url=URL.createObjectURL(new Blob([body],{type})),a=element('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function printable(value){
  const doc=document.implementation.createHTMLDocument('爪爪日记验收报告');doc.documentElement.lang='zh-CN';const meta=doc.createElement('meta');meta.setAttribute('charset','utf-8');doc.head.prepend(meta);
  doc.body.append(element('h1','爪爪日记验收报告'),element('p',`产品版本：${value.productVersion} · 用户机器时间：${value.checkedAt}`),element('p',`环境：${Object.values(value.environment).join(' / ')}`));
  for(const [title,checks] of [['人工结果',value.manualChecks],['公共资源自动结果',value.autoChecks]]){doc.body.append(element('h2',title));for(const check of checks){const label=MANUAL_CHECKS.find(c=>c.id===check.id)?.title??check.id;doc.body.append(element('h3',`${label}：${states.find(s=>s[0]===check.status)[1]}`));if(check.reason)doc.body.append(element('p','原因：'+check.reason));if(check.evidence)doc.body.append(element('p','证据：'+check.evidence));}}
  doc.body.append(element('h2','补充说明'),element('p',value.notes),element('p','自动HTTP成功不代表人工平台验收通过。此报告没有自动上传。'));
  return '<!doctype html>\n'+doc.documentElement.outerHTML;
}
$('export-json').addEventListener('click',()=>{try{download(JSON.stringify(report(),null,2),'application/json;charset=utf-8','paw-diary-manual-report.json');message('JSON已导出，请保存到你选择的位置。');}catch(error){message(error.message);}});
$('export-html').addEventListener('click',()=>{try{download(printable(report()),'text/html;charset=utf-8','paw-diary-readable-report.html');message('可读HTML已导出。');}catch(error){message(error.message);}});
function showAuto(){const root=$('auto-checks');root.replaceChildren();if(!autoChecks.length)root.append(element('p','尚无自动报告。'));for(const check of autoChecks)root.append(element('p',`${check.id}：${states.find(s=>s[0]===check.status)[1]} ${check.reason??''} ${check.evidence??''}`));}
$('import-report').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>1024*1024)throw new Error('报告超过1MiB，请核对文件。');const value=importManualReport(JSON.parse(await file.text()));
  // Automatic-only reports augment HTTP findings; they never overwrite manual work.
  if(value.manualChecks.length&&value.productVersion!==$('candidate-version').textContent)throw new Error('人工报告版本与本验收包不同，请用对应版本的报告。');
  autoChecks=value.autoChecks;
  if(value.manualChecks.length){for(const key of ['os','browser','browserVersion','mode'])$('environment-'+key).value=value.environment[key];for(const check of MANUAL_CHECKS){const imported=value.manualChecks.find(c=>c.id===check.id);document.querySelector(`[data-check-status="${check.id}"]`).value=imported?.status??'not-run';document.querySelector(`[data-check-reason="${check.id}"]`).value=imported?.reason??'';document.querySelector(`[data-check-evidence="${check.id}"]`).value=imported?.evidence??'';}$('notes').value=value.notes;}
  showAuto();summary();message(value.manualChecks.length?'已恢复人工报告；自动结果保持独立。':'已导入自动结果，人工项目未改变。');
}catch(error){message('导入失败：'+error.message);}finally{event.target.value='';}});
summary();
