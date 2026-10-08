const VERSION = typeof __PAW_ACCEPTANCE_VERSION__ === 'string' ? __PAW_ACCEPTANCE_VERSION__ : '0.8.0';
const item = (id,title,platform,operation,expected,cleanup='只清理本次明确标注的验收数据。') => ({id,title,platform,operation,expected,evidence:'记录结果与系统/浏览器版本；截图需遮盖个人资料。',cleanup});
const LEGACY_CHECKS = Object.freeze([
 item('public-version','原网址与当前版本','all','打开原URL，阅读关于/版本新内容。','地址仍为原/paw-diary/；候选版尚未上线时标未能核验，不假称失败。'),
 item('notice-confirm','首次新内容确认','all','新浏览器或新身份查看版本公告，先关闭，再重新启动并点击确定。','关闭不算确认；确定后首次用户立即进入六步指引。'),
 ...Array.from({length:6},(_,i)=>item(`guide-step-${i+1}`,`指引第${i+1}步：下一步`,'all','依序操作该步的下一步按钮，查看目标与提示。','目标可见，文案可读，进度正确；最后一步完成。')),
 item('guide-skip','快速跳过指引','all','点击任一步跳过，重新打开网站。','可继续使用，下次不强制重跑。'),
 ...Array.from({length:6},(_,i)=>item(`guide-skip-${i+1}`,`指引第${i+1}步：跳过`,'all','从帮助重看，到该步点击跳过。','每步可跳过，不改变档案。')),
 item('guide-replay','帮助重看与焦点恢复','all','从头像帮助和首页入口重看，结束回原页。','入口可找到，页面/筛选/焦点恢复合理。'),
 item('local-save','本地测试建档、记录保存刷新','all','在免登录个人空间建立“阶段5验收”测试宠物，保存一条测试记录并刷新。','记录与宠物回读正确，示例空间不混入个人资料。'),
 item('health-plan','护理计划与完成','all','为测试宠物新增疫苗/驱虫计划并标完成。','未来计划进入护理待办，完成状态正确。'),
 item('locale','中英显示','all','切中英，检查帮助、公告、指引和主要表单。','界面语言切换，用户输入原文不被翻译。'),
 item('zoom','原生200%缩放','all','使用浏览器/系统原生缩放至200%，操作帮助与表单。','文本可读，按钮可访问，无关键内容裁切。'),
 item('keyboard','键盘与焦点','all','使用Tab、Shift+Tab、Enter、Esc操作菜单、帮助与表单。','焦点可见、次序合理，弹层关闭焦点返回入口。'),
 item('dirty-update','未保存输入阻挡更新','all','编辑测试记录未保存，再点击实际新版更新入口；没有新版时标未能核验。','输入保留，解释先保存/关闭；不自动弃稿。'),
 item('saving-update','保存中阻挡更新','all','正在保存时尝试实际更新；无法观察保存中状态则标未能核验。','保存期间不能触发页面刷新。'),
 item('cloud-isolation','云端账号与私有边界','all','有已授权测试账号时分别登录两身份查看私有档案；无账号标未能核验。','两身份不共享私有资料；不填邮箱或实际健康内容。'),
 item('windows-install','Windows Edge真实安装','windows','从实际安装入口完成系统安装，观察窗口和图标。','有真实系统安装窗口与可启动图标。','先备份，仅移除本次新建的测试应用。'),
 item('windows-launch','Windows独立启动','windows','关闭浏览器页，从系统图标启动。','独立窗口启动，保存刷新回读正确。'),
 item('windows-update','Windows独立窗口更新','windows','实际新版上线后，在网页与安装窗口分别点击安全更新。','版本正确，保原hash，不丢输入。'),
 item('windows-uninstall','Windows测试App卸载','windows','从edge://apps仅卸载新建测试App。','卸载对象明确，未清全部浏览器数据。','保留原网站资料及备份。'),
 item('windows-narrator','Windows Narrator','windows','开启系统Narrator操作帮助、指引、表单与保存。','标题/按钮/状态能读出，焦点无陷阱。','关闭本次读屏设置如用户希望。'),
 item('iphone-keyboard','iPhone真实软键盘','iphone','实际iPhone输入测试名称和记录，保持键盘打开。','输入与保存按钮可见可操作。'),
 item('iphone-location-allow','iPhone定位允许','iphone','同城页请求定位并允许。','反馈明确，地区选择可继续；报告不填写坐标。'),
 item('iphone-location-deny','iPhone定位拒绝','iphone','真实系统拒绝定位，再选择地区。','拒绝提示明确，手动地区可用。','只恢复本次修改的网站定位权限。'),
 item('iphone-install','iPhone添加主屏幕','iphone','Safari分享→添加到主屏幕；若有作为网页App打开则开启。','主屏幕图标存在，实际独立启动。','只移除本次新增测试图标，先备份。'),
 item('iphone-launch','iPhone独立启动回读','iphone','从主屏幕打开，保存测试记录，关闭重开。','核对当前存储容器和资料，不推断自动迁移。'),
 item('iphone-update','iPhone独立启动更新','iphone','新版上线后从主屏幕窗口安全更新/重开。','核对新版，输入保护符合预期。'),
 item('iphone-voiceover','iPhone VoiceOver','iphone','真实开启VoiceOver，操作帮助、指引、输入和保存。','控件名称和状态可读，无焦点陷阱。','按用户原偏好恢复读屏设置。'),
 item('mac-install','Mac Safari/Chrome安装','mac','分别检查实际Safari添加到Dock与Chrome安装入口。','记录真实系统版本、图标、窗口；不承诺本地数据共享。','仅清本次新建测试App，先备份。'),
 item('mac-launch','Mac独立启动与资料容器','mac','独立启动Safari/Chrome网页App，各自核对资料所在位置。','原浏览器资料保留；需同份资料时登录同账号或备份恢复。'),
 item('mac-update','Mac原网页与独立App更新','mac','实际新版本上线后分别安全更新、重开。','新版正确，原hash保留。'),
 item('mac-voiceover','Mac VoiceOver','mac','真实开启VoiceOver操作网页与独立App。','帮助/表单名称可读，状态播报与焦点合理。','按用户原偏好恢复读屏设置。'),
 item('calendar-login-google','Google日历登录条件','all','核对用户现有Google日历是否已登录且可新建测试日历。','具备条件再测试；否则未能核验，不代注册。'),
 item('calendar-login-outlook','Outlook日历登录条件','all','核对用户现有Outlook日历登录与测试日历权限。','具备条件再测试；否则未能核验。'),
 item('calendar-first','日历首次导入','all','独立“爪爪日记验收”日历导入两个不同日期全天测试事件；分别记录Google/Outlook/Apple结果。','核日期/标题/备注；ICS无VALARM，确认客户端通知默认设置。','只删除本次明确测试日历；不处理旧空Calendar。'),
 item('calendar-repeat','日历重复导入','all','向同一测试日历再次导入同份ICS，分别记录三客户端数量变化。','据实际客户端表现记录，不承诺自动去重。','仅清确切本次测试日历。'),
 item('calendar-reschedule','日历改期后再导入','all','修改测试计划日期，重新导出导入，分别记录三客户端表现。','站内改期不自动同步，记录客户端实际新旧事件。','只清本次测试日历。'),
 ...['google','outlook','apple'].flatMap(client=>[
  item(`${client}-calendar-first`,`${client}日历：首次导入`,'all','有已登录客户端时，在独立测试日历导入两个不同日期全天事件。','分别核日期/标题/备注与客户端默认通知；无账号标未能核验。','只清本次测试日历。'),
  item(`${client}-calendar-repeat`,`${client}日历：重复导入`,'all','同一客户端再次导入同份ICS。','记录实际数量变化，不承诺去重。','只清本次测试日历。'),
  item(`${client}-calendar-reschedule`,`${client}日历：改期后再导入`,'all','修改测试计划日期，导出后再次导入该客户端。','记录新旧事件，站内改期不自动同步。','只清本次测试日历。'),
 ]),
 item('offline-input','弱网/断网输入保护','all','在明确测试输入后暂时断网，尝试云/AI操作再恢复。','失败说明明确，输入不丢；不宣称离线同步。','恢复网络，仅清本次测试数据。'),
 item('cleanup','退出、备份与确切清理','all','导出备份，清理确切“阶段5验收”数据，退出测试账号。','不删除真实档案、不清全部浏览器资料、无意外登录留存。','保留用户自主保存的报告/备份。'),
]);
export const V100_CHECKS = Object.freeze([
 item('public-version','原网址与v1.0.0公共资源','windows','核对固定URL、release/manifest、PS5.1公共资源报告。','公开v1.0.0、manifest身份不变、构件SHA与声明一致；上线前未能核验。'),
 item('beta-login','内测码字段与登录键盘','windows','无码/合成错误码检查字段；正确码请用户私下直接输入，不写报告。','必填、错误就近提示且未发邮件；错误回焦正确；成功/退出后输入清空；语言切换保输入。'),
 item('zoom','原生200%缩放','windows','Edge原生缩放200%，操作菜单、帮助、六步、登录/宠物/记录表单。','关键文本可读，保存/取消可滚动到；结束恢复原缩放。'),
 item('keyboard','完整键盘与回焦','windows','Tab/Shift+Tab/Enter/Esc、菜单方向键；弹层关闭；内测码错误。','焦点可见、次序合理，关闭回入口；错误回字段，无焦点陷阱。'),
 item('dirty-update','真实0.8→1.0：未保存输入','windows','保留原0.8标签页/App及合成草稿；收到上线通知后聚焦检测，点击更新。','真实新版本提示；未保存阻挡刷新且草稿完整；尊重5分钟focus节流。'),
 item('saving-update','真实0.8→1.0：保存中保护','windows','实际云端保存时尝试新版更新，可记录施加的真实网络延迟。','busy期间不能刷新；无法观察就未能核验，不伪造状态。'),
 item('windows-update','既有App真实升级及重开','windows','草稿安全保存/关闭后更新；核对hash、1.0版本与资料，关闭从原图标重开。','网页与既有App均升级成功，原hash/资料保留；保留日常App。'),
 item('photo-draft','照片草稿、说明、改名','windows','只选合成图，填说明/名称，切语言/开关帮助；在升级前后检查并保存回读。','草稿与原文保留、保存后的名称/说明/附件正确。'),
 item('offline-input','真实断网失败与恢复','windows','获用户同意暂时实际断网；已加载云表单保存，恢复网络后重试。','云端失败明确、输入/图片不丢，恢复重试保存回读；本地保存成功不能算云失败验证。','恢复网络；不承诺离线PWA或同步。'),
 item('backup-readback','隔离容器备份、取消与恢复回读','windows','新隔离profile测试App建立合成档案/图/类型/软删除，导出备份，预览取消再确认恢复。','取消不写入；恢复映射、附件字节/自定义类型正确，软删除不复活；备份留本机不回传。'),
 item('windows-uninstall','仅卸载本轮隔离测试App','windows','在隔离profile的edge://apps核对象后卸载新测试App，保网站数据再网页回读。','仅新测试App消失；原日常App仍可用，网站资料/备份保留；实际有数据清理选项需记录选择。','禁止清全部浏览器数据；私密profile不放回传ZIP。'),
 item('windows-narrator','Narrator实际朗读','windows','Win+Ctrl+Enter启Narrator，用户听读标题/字段/错误/状态，并操作退出。','记录实际听到的名称及操作；DOM/截图不代替语音证据。','按原偏好恢复；听不到/不能操作标未能核验并说明。'),
 item('cleanup','脱敏报告与确切清理','windows','导出JSON/HTML至同一结果目录；仅清合成数据、新测试App；保留旧原始报告。','回传仅报告/脱敏截图/公开检测，不含邮箱、码、token、真实健康内容、坐标、profile或备份。'),
]);
export const MANUAL_CHECKS = VERSION === '1.0.0' ? V100_CHECKS : LEGACY_CHECKS;
const statuses = new Set(['pass','fail','not-run','unverified']);
const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key));
const text = (value, max=4000) => typeof value === 'string' && value.length <= max;
function normalizeChecks(checks, manual = false) {
  if (!Array.isArray(checks) || checks.length > 200) throw new Error('Invalid checks');
  const seen = new Set(), validIds = new Set(MANUAL_CHECKS.map(check=>check.id));
  return checks.map(check => {
    if (!keys(check,['id','status','evidence','reason']) || !text(check.id,100) || !/^[a-z][a-z0-9-]*$/.test(check.id) || seen.has(check.id) || manual && !validIds.has(check.id) || !statuses.has(check.status)) throw new Error('Invalid check id/status');
    if (check.evidence !== undefined && !text(check.evidence) || check.reason !== undefined && !text(check.reason)) throw new Error('Invalid check text');
    if (check.status === 'fail' && !check.reason?.trim()) throw new Error('fail requires reason（失败必须填写原因）');
    seen.add(check.id);
    return {id:check.id,status:check.status,...(check.evidence !== undefined?{evidence:check.evidence}:{}),...(check.reason !== undefined?{reason:check.reason}:{})};
  });
}
function environmentValue(environment) {
  if (!keys(environment,['os','browser','browserVersion','mode']) || !['os','browser','browserVersion','mode'].every(key=>text(environment[key],200)&&environment[key].trim())) throw new Error('请填写系统、浏览器、浏览器版本及启动方式（environment）');
  return {...environment};
}
export function localCheckedAt() {
  const date = new Date(), pad = value => String(value).padStart(2,'0');
  const minutes = -date.getTimezoneOffset(), sign = minutes < 0 ? '-' : '+';
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(Math.abs(minutes)/60))}:${pad(Math.abs(minutes)%60)}`;
}
export function buildManualReport({environment,checks=[],notes='',checkedAt=localCheckedAt(),productVersion=VERSION}={}) {
  const manual = Array.isArray(checks) ? checks : checks.manualChecks ?? [];
  const auto = Array.isArray(checks) ? [] : checks.autoChecks ?? [];
  const values = new Map(normalizeChecks(manual,true).map(check=>[check.id,check]));
  return importManualReport({schemaVersion:1,productVersion,checkedAt,environment,autoChecks:normalizeChecks(auto),manualChecks:MANUAL_CHECKS.map(check=>values.get(check.id)??{id:check.id,status:'not-run'}),notes});
}
export function importManualReport(report) {
  if (!keys(report,['schemaVersion','productVersion','checkedAt','environment','autoChecks','manualChecks','notes']) || report.schemaVersion !== 1 || !text(report.productVersion,60) || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(report.productVersion) || !text(report.checkedAt,100) || !Number.isFinite(Date.parse(report.checkedAt)) || !text(report.notes,8000)) throw new Error('报告格式不合法（schema/version/date/notes）');
  return {schemaVersion:1,productVersion:report.productVersion,checkedAt:report.checkedAt,environment:environmentValue(report.environment),autoChecks:normalizeChecks(report.autoChecks),manualChecks:normalizeChecks(report.manualChecks,true),notes:report.notes};
}
