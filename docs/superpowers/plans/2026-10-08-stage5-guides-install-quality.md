# 阶段5：指南、可安装网页与v0.8.0稳定交付 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在原/paw-diary/网址交付可重看的帮助、六步遮罩指引、平台安装与安全更新、Windows验收包，完成有证据的v0.8.0稳定发布。

**Architecture:** 纯状态机与浏览器UI偏好独立于业务仓储，帮助/公告/指引采用独立只读modal，Root协调现有app生命周期。安装采用manifest与平台能力检测，不引入缓存worker；同源release.json负责更新提示。技术自动验收、真实主体验收、用户三端验收分别记结果，公开验证后再建新tag。

**Tech Stack:** 原生HTML/CSS/ESM、esbuild、node:test、既有Python Playwright、Windows PowerShell5.1只读HTTP探测、GitHub Pages/Actions。

**Spec:** [阶段5设计](../specs/2026-10-08-stage5-guides-install-quality-design.md)。执行者先读spec、本计划、PENDING当前摘要和SESSION_LOG最新段。

**当前状态:** 本轮只规划，全部实施checkbox未勾；公开仍v0.7.1/552历史单元证据。v0.8.0已由用户确定，尚未改版本文件、部署或建tag。用户明确下一轮再实施，无需本轮启动工作树/安装依赖/业务测试。

## Global Constraints

- 截止2026-10-08 20:00 Asia/Shanghai；不重算48小时或搬用旧阶段硬时限。
- 保留GitHub仓库paw-diary、原/paw-diary/路径及#home/#health/#nearby/#community/#profile，旧tag不动。
- 数据丢失、账号越权、核心保存失败、原网址不可用必须修复或撤回候选。
- 用户亲验与技术自动验收独立；缺环境可准确记未验证，已观察到的故障不能记缺环境。
- 首次身份确认新内容后立即进入六步指引；每步含“下一步”“跳过指引”，末步下一步结束；老用户更新不重跑已跳过/完成的指引。
- 浏览器+身份记忆，guest示例/本地共用，已登录可信UID独立；不云同步偏好、不存token/邮箱作键。
- 保持v0.6.2逐条record/plan、原子1–5项、V3回收站、CAS、私有媒体、现有登录和公开边界。
- 本轮不注册service worker、不使用CacheStorage、不拦截请求；不新增离线写入/系统通知/日历订阅/原生安装包承诺。
- 无新增采购/收费调用；管理只FUJI，密钥通过env读取且不输出。LBS/AI仅必要真实验证，不重置配额或复用旧OTP。
- README标题下仍为原体验网址，先用途与体验；文档、日志、验收包、测试、后端和凭证不进入dist。

## Review Focus

1. 已有业务dialog、照片文件/改名、社区/个人资料草稿与保存中：自动帮助延后，导览和更新不弃稿。Task1/5/7。
2. 身份恢复、A→B→退出和存储拒绝：确认记忆不串身份，迟到帮助不落到新身份。Task1/5/7。
3. 空宠物/读取失败、重渲染、滚动、软键盘和200%缩放：指引可读可退、目标与按钮可达。Task3/5/7。
4. Safari安装容器、旧窗口、未来版本和回退版本：不假定资料迁移、不强制reload、回退不循环提示更新。Task4/7/8。
5. 验收包自动200/manifest成功但真实安装失败：报告分开自动/人工，未执行不冒充通过。Task6/7/8。

## 任务依赖、所有权和时间安排

下一轮先用using-git-worktrees准备隔离工作区，从当时main开始，不reset到应用tag；核既有服务后选择空端口，服务按/paw-diary/子路径部署测试。新环境时间由clock工具获取，日志统一Asia/Shanghai。

| 任务 | 交付 | 依赖 | 目标用时（估计） |
| --- | --- | --- | --- |
| 1 | UI偏好、发行元数据与输入阻挡规则 | 新基线检查 | 30–40分钟 |
| 2 | 帮助/公告组件与双语内容 | 1 | 30–45分钟 |
| 3 | 六步spotlight控制器与几何/焦点 | 1；2完成前可独立测试 | 45–60分钟 |
| 4 | manifest/安装与更新监测 | 1 | 40–55分钟 |
| 5 | Root整站接入、生命周期与旧流程兼容 | 2/3/4 | 35–50分钟 |
| 6 | Windows ZIP及三端清单 | 1；5前可做独立包 | 30–45分钟 |
| 7 | 本地集成、真实主体和三端验收/集中修复 | 5/6 | 60–90分钟，用户部分可并行 |
| 8 | 原网址候选、公开复验、tag/Release、交接 | 7的硬门槛通过 | 30–45分钟 |

粗估串行总量5–7小时，独立模块并行可缩短；不是完成保证。目标18:00前候选原网址、18–20点修复缓冲；14:00新功能冻结是历史建议，不能假称已经达成。需求范围现在收口，下一轮不再扩展，开始较晚时按剩余工具时间报告缺口再执行，不删硬门槛。

Root独占`app.js/style.css/index.html`、主仓储/路由、部署与版本整合；可委派独立feature模块、Windows包、只读审查，明确每个worker文件所有权和接口。worker不独占代码库、不回退他人、不自行云部署/Git发行，日志由Root统一。Task4构建/workflow修改由Root整合。每项测试及审查通过再提交，不把子agent口头完成当验收。

## 文件与接口总览

| 文件 | 责任 |
| --- | --- |
| `src/data/ui-preferences.js` | guest/account UI偏好、内存回退 |
| `src/domain/help-lifecycle.js` | 自动公告资格、交互阻挡、合法新稳定版本比较 |
| `src/data/release-notes.js` | 0.8.0已验收新内容词典键，不写历史候选承诺 |
| `src/data/help-topics.js` | 帮助主题ID与标题/正文词典键 |
| `src/features/help.js`、`whats-new.js` | 独立只读帮助/公告dialog |
| `src/domain/tour.js`、`src/ui/tour-position.js`、`src/features/guided-tour.js` | 状态、几何与DOM/焦点控制 |
| `src/data/tour-steps.js` | spec固定六步稳定目标 |
| `src/features/install.js`、`update.js` | 平台安装状态与同源新版本提示 |
| `manifest.webmanifest`、`assets/app-icons/` | 原子路径及品牌图标 |
| `scripts/build.mjs`、Pages workflow | 版本channel注入、manifest/release/图标白名单 |
| `tools/acceptance/windows/`、`scripts/build-acceptance-pack.mjs` | 自包含清单、可选探测、ZIP产物 |
| `tests/e2e/stage5-*.py`、`docs/verification/final-report.md` | 场景证据与最后验收状态 |

以下类型均为ESM JSDoc约定。`Release={version:string,channel:'preview'|'stable',buildId:string}`；`Identity=string`；`Preferences`见spec；`TourStep={id:string,targetSelector:string,titleKey:string,bodyKey:string}`。所列导出必须按名实现，后续任务不自行换名。

### Task 1：基线、UI偏好与交互阻挡规则

**Files:** Create `src/data/ui-preferences.js`、`src/domain/help-lifecycle.js`、`tests/ui-preferences.test.js`、`tests/help-lifecycle.test.js`。Modify `scripts/build.mjs`、`src/config/public-config.js`、`tests/build.test.js`；后者仅扩展公开release配置，原云配置不变。

**Interfaces:**
- `uiIdentityKey({userId=null}) -> 'guest'|'account:<userId>'`，只接可信已恢复身份。
- `createUiPreferences({storage,memory=new Map()}) -> {read(identity),acknowledgeVersion(identity,version),setTourStatus(identity,status)}`；读取默认unseen，版本合法去重最多8个，方法返回规范Preferences。
- `isInteractionBlocked({dialogOpen,dirty,saving,aiSaving,publicDirty,publicSaving,photoDirty,photoSaving,transitioning}) -> boolean`；所有字段boolean，任一true阻挡自动帮助/指引/更新，独立只读帮助不作为业务dialog输入。
- `decideStartupHelp({release,preferences,blocked,previewEnabled=false}) -> 'none'|'defer'|'whats-new'`。只有stable或明确previewEnabled允许自动资格；该版已确认返回none，不能仅因tour unseen重复开遮罩。
- `isNewStableRelease(current,remote) -> boolean`：合法stable x.y.z数字逐位比较，支持0.10大于0.9；不同channel/非法/prerelease/相等/回退均false。
- 构建默认`PAW_RELEASE_CHANNEL=preview`，Pages明确stable；本地`PAW_HELP_PREVIEW=1`仅preview构建允许自动体验。`__PAW_PUBLIC_CONFIG__.release`包含Release；`release.json`公开同一Release。VERSION与package.version不一致构建失败，buildId从当前Git提交读取。

- [ ] **Step 1：执行基线检查** `npm ci`、`npm test`、`npm run build`、`node --check app.js`、`git diff --check`，保存实际数量/输出和开始工具时间；预期552无fail/skip，否则先按systematic-debugging定位。
- [ ] **Step 2：写行为失败测试**：guest示例/本地同键；A/B互不读确认；重复确认只有一个版本；第9个确认淘汰最旧；坏JSON/拒绝读写回内存且不抛；unseen/skip/complete独立；busy任一字段阻挡；preview默认none；确认后不再弹；0.9→0.10 true，0.8→0.7 false，0.8.0-beta false。断言示例：

```js
assert.equal(isNewStableRelease(
 {version:'0.9.0',channel:'stable'},
 {version:'0.10.0',channel:'stable'}),true);
assert.equal(decideStartupHelp({release:{version:'0.8.0',channel:'preview'},
 preferences:{acknowledgedVersions:[],tourStatus:'unseen'},blocked:false}), 'none');
```

- [ ] **Step 3：RED** `node --test tests/ui-preferences.test.js tests/help-lifecycle.test.js`，确认缺失规则造成真实失败，不改正确旧行为制造RED。
- [ ] **Step 4：实现接口并扩展构建**。release字节不包含环境凭证；保持v0.2旧图与云配置。构建测试核版本一致、channel、release.json、日志/后端排除。
- [ ] **Step 5：GREEN** 上述两测＋`node --test tests/build.test.js`；preview/stable各构建一次核注入差异符合预期。提交 `feat: add scoped help preferences and release metadata`。

### Task 2：可重看帮助、公告与双语内容

**Files:** Create `src/data/help-topics.js`、`src/data/release-notes.js`、`src/features/help.js`、`src/features/whats-new.js`、`tests/help-content.test.js`、`tests/e2e/stage5-help-components.py`、`docs/user-guide.md`。Modify中英词典。此项worker不改app/style/index，样式需求交Root。

**Interfaces:**
- `HELP_TOPICS: readonly {id,titleKey,bodyKeys:string[]}[]`，spec九主题；`RELEASE_NOTES: readonly {version,titleKey,bulletKeys:string[]}[]`，最终只填通过验收的0.8.0变化。
- `mountHelp({document,t,getLocale,onTour,onInstall,onWhatsNew}) -> {open(topicId='start'),close(),refreshLocale(),destroy()}`。
- `mountWhatsNew({document,t,getLocale,onAcknowledge,onDismiss}) -> {open(release),close(),refreshLocale(),destroy()}`；关闭/Esc走onDismiss，不调用ack；仅确定调用onAcknowledge一次。
- 两组件自行创建只读dialog，不调用主modal、不写业务库；记录原焦点，目标销毁时返回main。controller不得重复绑定监听。

- [ ] **Step 1：写内容/组件失败用例**：九主题与中英键完整；无宠物/AI关闭仍能看；关闭不确认、双击确定只回调一次；Esc/Tab/焦点恢复；恶意用户原文按textContent展示；帮助主题跳转不写库。
- [ ] **Step 2：RED** `node --test tests/help-content.test.js`，组件浏览器fixture通过下一步Task5前的独立测试入口运行，不以mock当整站已接入。
- [ ] **Step 3：实现两controller与短内容**；指南纳入日历快照/通知由客户端管理、安装容器与备份、AI不可用手动路径。词典键归`help.* / whatsNew.*`，不复制过时“公共示例宠友”。
- [ ] **Step 4：GREEN** `node --test tests/help-content.test.js tests/i18n.test.js tests/markup-i18n.test.js`；skill-runtime/run python跑组件E2E，确认locale切换不关当前主题、不丢输入。通过后提交 `feat: add reusable bilingual help and release notes`。

### Task 3：六步spotlight、焦点与几何

**Files:** Create `src/domain/tour.js`、`src/data/tour-steps.js`、`src/ui/tour-position.js`、`src/features/guided-tour.js`、`tests/tour.test.js`、`tests/tour-position.test.js`、`tests/e2e/stage5-tour-components.py`。样式与data-tour目标由Root Task5添加。

**Interfaces:**
- `TOUR_STEPS`按spec六步ID：workspace/pets/record/reminders/recap/community-nav，selector=`[data-tour="<id>"]`。
- `createTourState(count=6) -> {phase:'idle',index:0,count}`；`advanceTour(state,'START'|'NEXT'|'SKIP'|'ABORT') -> state`；六次NEXT完成，重复事件幂等，SKIP→skipped，ABORT→aborted不记用户完成。
- `positionTourPopover({target:{left,top,width,height}|null,viewport:{left,top,width,height},card:{width,height},gap=12,inset=16}) -> {left,top,placement:'top'|'bottom'|'center'}`，尽量近目标，所有返回值在可用视口内，长内容靠卡片内部滚动。
- `mountGuidedTour({document,t,getLocale,getIdentity,isBlocked,captureView,enterHome,restoreView,onStatus}) -> {start({source:'automatic'|'manual'}),refresh(),stop({reason}),destroy()}`；start返回Promise<'started'|'blocked'>。captureView/enterHome/restoreView由Root定义；onStatus(status,capturedIdentity)仅skipped/completed调用偏好存储。

- [ ] **Step 1：写失败测试**：固定六步；启动/下一步/每步skip/末步结束；ABORT不冒充complete；viewport360/390/768/1440下popover边界，目标缺失center，visualViewport变小仍可达；同一frame多事件只重算一次；销毁后无回调。

```js
let s=advanceTour(createTourState(6),'START');
for(let i=0;i<6;i++)s=advanceTour(s,'NEXT');
assert.equal(s.phase,'completed');
assert.equal(advanceTour(s,'NEXT').phase,'completed');
```

- [ ] **Step 2：RED** `node --test tests/tour.test.js tests/tour-position.test.js`；独立组件E2E先核缺少spotlight/按钮/焦点的失败。
- [ ] **Step 3：实现纯状态、几何、全视口原生modal＋SVG挖空**；tip两个按钮固定文案，包括末步。焦点标题→Tab圈定→Esc跳过。目标最多等1500ms，缺失提供居中同一步说明。scroll/resize/visualViewport/ResizeObserver以rAF合并；reduced-motion无过渡。账号/宠物/外部route变更abort，locale只刷新不回第1步。
- [ ] **Step 4：GREEN** 两单测及有头组件360/390/768/1440、缺目标、滚动/End键、resize、销毁/重挂与按钮可达E2E；实际查看一批截图，集中修复一次后确认，不无限视觉打磨。提交 `feat: add a skippable six-step spotlight guide`。

### Task 4：安装、发行探测与安全更新

**Files:** Create `manifest.webmanifest`、`assets/app-icons/icon-192.png`/`icon-512.png`/`icon-maskable-512.png`/`apple-touch-icon-180.png`、`src/features/install.js`、`src/features/update.js`、`tests/install.test.js`、`tests/update.test.js`、`docs/operations/desktop-install.md`。Modify `index.html`、`scripts/build.mjs`、`.github/workflows/pages.yml`、`tests/build.test.js`由Root整合。

**Interfaces:**
- `createInstallController({window,navigator,onState}) -> {getState(),requestInstall(),destroy()}`，state=`'installed'|'prompt-ready'|'manual'`；无事件不伪造安装按钮能力，prompt取消不installed，一次event消费一次。
- `createUpdateMonitor({currentRelease,fetchImpl,now,getInteractionState,onUpdate,reload,baseUrl}) -> {check(),requestReload(),destroy()}`；check Promise<Release|null>，requestReload返回`'reloaded'|'blocked'|'none'`。只允许同源release.json、5秒Abort、cache:no-store/credentials:omit；focus检查5分钟节流，无固定轮询；阻挡原因通过getInteractionState提供Task1字段。
- manifest值逐项照spec；复制manifest与图标，release.json来自Task1；workflow加入manifest/VERSION输入并以`PAW_RELEASE_CHANNEL=stable`构建，正式本地SHA核对必须使用相同channel。

- [ ] **Step 1：写失败测试**：manifest固定项目id与相对start_url/scope，图标实际尺寸与maskable purpose、apple-touch-icon；dist白名单；不注册worker/无CacheStorage写；beforeinstallprompt、取消/接受、appinstalled、standalone、无事件fallback；版本失败/超时/节流与回退不提醒；dirty/saving禁止reload且保hash。
- [ ] **Step 2：RED** `node --test tests/install.test.js tests/update.test.js tests/build.test.js`，记录真实失败。
- [ ] **Step 3：实现安装与更新接口，复用现有品牌制作图标**；帮助显示平台手动说明，Mac存储边界显著。禁止为了自动提示立刻出现而假造事件或后台prompt。公开静态构建不用worker。
- [ ] **Step 4：GREEN** 上述三测，preview/stable构建与/paw-diary/manifest/icon/release实际HTTP检查；mock安装仅记逻辑通过，实际OS安装留Task7/8。提交 `feat: support installation and draft-safe update prompts`。

### Task 5：整站接入、输入保护与旧测试适配

**Files:** Modify `app.js`、`style.css`、`index.html`、`src/ui/profile-menu.js`、`src/features/photo-wall.js`、`tests/photo-wall.test.js`、`tests/account-ui.test.js`、`test_app.py`与需要适配启动公告的既有E2E。Create `tests/e2e/help_startup.py`、`tests/e2e/stage5-guides.py`、`tests/help-wiring.test.js`。Root负责全部共享改动。

**Interfaces:**
- `createProfileMenu`新增`onHelp`可选回调，旧调用兼容；菜单显示“使用帮助”。
- 照片controller新增`hasUnsavedChanges()`、`isSaving()`；selected/failed文件、名称/说明待上传、重命名编辑归dirty，不能只看主dialog。
- Root `getHelpIdentity()`返回Task1键；`getInteractionState()`收集主dialog/AI/公共页/照片/空间转换；`captureHelpView()`返回spec视图字段+identity+focus token；`enterHelpHome()`仅干净状态进入home；`restoreHelpView(snapshot)`身份未变时还原视图后焦点/滚动，不能走会再次清空recordPetIds/management的普通route。
- Root维护controllers独立于`maintainStage3()`；boot身份恢复结束才`evaluateStartupHelp()`，render/locale/identity/view变更通知controller。公告确定→ack→关闭→unseen且干净立即tour，若状态变化则延后不弃稿。
- `dismiss_startup_help(page)`仅用于非指南回归：使用真实确认/跳过UI，不清业务存储、不一律关闭所有dialog；指南场景不得调用此helper避开首次体验。

- [ ] **Step 1：写整站失败场景**：guest初次公告→确定立即第1步；各步skip后刷新不再开；已确认更新0.8后仍旧tour状态；帮助重看；empty/loadError fallback；读写失败偏好；A→B延迟回调；主/公共/照片草稿与busy下自动提示/重看/更新保输入。
- [ ] **Step 2：RED** 新wiring单测及stage5-guides有头E2E，确保缺少真实集成造成失败。
- [ ] **Step 3：接入六个稳定data-tour区域（包括空状态）与CSS**。帮助只读dialog不替主表单；外部route/身份/宠物变化stop；普通render不得误结束指引。beforeunload保护复用统一状态补照片pending，不改浏览器原生提示成自绘。原日期/下拉/草稿/AI语义保持。
- [ ] **Step 4：适配旧回归的startup helper后GREEN** `npm test`、`npm run build`、`node --check app.js`、`git diff --check`；设置`PAW_DIARY_TEST_URL`指向实际子路径，用skill-runtime/run python跑`test_app.py`、stage5-guides与原region-picker-dropdown/stage4。使用各脚本实际headful变量，不混用PAW_HEADFUL和PAW_DIARY_HEADED。有头本轮至少四宽双语截图与键盘实际操作。若Impeccable detector提示，仅报告/修本轮真实问题，不借机重做品牌。
- [ ] **Step 5：界面完成后一次检测** `node /Users/wenkaiqu/.agents/skills/impeccable/scripts/detect.mjs --json app.js style.css index.html`；按web-design-guidelines补交互/语义/键盘/触控审查。新增回归通过再提交 `feat: integrate help and installation without interrupting pet records`。

### Task 6：Windows验收包与三端用户清单

**Files:** Create `tools/acceptance/windows/START-HERE.html`模板、`report-model.js`、`report-ui.js`、`README.txt`、`check-public.ps1`、`RUN-CHECK.cmd`、`report-schema.json`、`scripts/build-acceptance-pack.mjs`、`tests/acceptance-report.test.js`、`tests/e2e/stage5-acceptance-pack.py`、`docs/verification/stage5-user-checklist.md`。Modify `.gitignore`仅必要时排除产物，不放宽秘密忽略。

**Interfaces:**
- `report-model.js`导出`buildManualReport({environment,checks,notes,checkedAt}) -> Report`、`importManualReport(report) -> validatedReport`，由report-ui调用；schema与status逐字照spec，auto/manual两数组独立。日期来自用户机器，不伪称服务器UTC。打包时用已有esbuild将两个ESM打成IIFE内联模板，交付HTML自包含，file://不依赖module/CORS或本地服务器；单测直接import纯report-model。
- `check-public.ps1 -BaseUrl <固定原URL> -OutFile <明确本地路径>`，仅准许原host＋/paw-diary/子路径；无私有API/凭证参数。PowerShell5.1 UTF-8 JSON输出，网络失败或脚本阻挡不自动pass。
- `buildAcceptancePack({version,outdir,sourceDir}) -> Promise<{archivePath,files,sha256}>`，Node脚本导出并CLI执行；在Mac开发机用已可用zip工具打包，无新npm依赖。产物固定`test-results/stage5/paw-diary-v0.8.0-windows-acceptance.zip`。

- [ ] **Step 1：写报告行为失败测试**：初始manual全not-run；auto成功不改变manual；fail必须有原因；无环境/未知status拒绝导入；UTF-8中文往返、HTML注入安全显示；双击file://、禁localStorage仍能填写导出/导入；无远程报告上传。
- [ ] **Step 2：RED** `node --test tests/acceptance-report.test.js`与包页面E2E。
- [ ] **Step 3：实现自包含HTML和可选探测**，公共metadata版本/hash核对不能访问CloudBase。README先写“解压、打开START-HERE”，再写脚本可选；RUN-CHECK不改全局执行策略/不请求管理员，不可执行时回HTML清单。包内不携带node_modules、账号session或用户数据。
- [ ] **Step 4：写三端分工清单**，spec每条给“操作/预期/证据/清理”；Google/Outlook先核登录，不预勾。指引每步/skip/replay、真实安装启动更新卸载、iPhone键盘/GPS、200%缩放/VoiceOver/Narrator、日历首导/重复/改期均有独立ID。
- [ ] **Step 5：GREEN并构建ZIP**：node测试、HTML有头file://E2E、解压核文件清单/无秘密与SHA。Mac只能验证包逻辑，PowerShell及Windows系统操作记等待用户执行；交付ZIP点击链接与10分钟快速清单，完整三端约30–45分钟为建议。提交 `test: ship a portable Windows acceptance kit and device checklist`。

### Task 7：完整验收、真实主体与集中修复

**Files:** Create `tests/e2e/stage5-failures.py`、`tests/e2e/stage5-install.py`、`docs/verification/final-report.md`。Modify仅实际失败的产品/测试文件及`docs/operations/calendar-clients.md`。既有真实集成`tests/integration/community.test.js`、`tests/integration/photos-private.test.js`及实际认证helper定向复用。

**Consumes:** Tasks1–6与原600会话路径。**Produces:** 技术通过/用户亲验/未验证/失败分列的最终报告、硬门槛判定、发布候选。

- [ ] **Step 1：补有意义的失败场景**：网络阻断AI/上传不丢输入；长中文/200合成记录；登录过期或身份切换不串资料；未来plan不变record；历史删除导入不复活；帮助/更新下主表单、公共草稿和照片pending不丢。fixture只在隔离本地空间，真实测试按exact receipt登记。
- [ ] **Step 2：完整本地验证**：`npm test`、`npm run build`、`node --check app.js`、`git diff --check`；用技能运行入口执行stage5-guides/failures/install、test_app、既有地域与公共App测试。manifest/install event模拟与真实OS安装分开；WebKit模拟补布局但不记为iPhone真机。
- [ ] **Step 3：真实A/B**：先验证原`.worktrees/stage2/test-results/stage2/real-sessions.json`恢复，串行刷新写回；真实用户健康/媒体所有权、公开读/作者权限、账号切换和保存刷新。只需重跑受改动影响的集成，避免全面重复OTP/模型/定位消耗。无有效会话不得skip伪绿，及时记录并依必要实际协作恢复。
- [ ] **Step 4：给用户ZIP与三端操作清单并收结果**。iPhone手工GPS成功/拒绝各必要一次，额度耗尽记真实原因不reset；Windows安装/启动/卸载与Narrator；Mac原生200%与VoiceOver、Safari独立容器。云端与本地备份恢复分别留证；缺账号/平台检查只记unverified。
- [ ] **Step 5：日历真实导入**：独立测试日历2项全天；首导、重复、改期再导、通知默认；每客户端记录日期/数量/表现，不用ICS格式通过替代客户端结果。缺Google/Outlook登录按事实记未验证。只清本轮精确测试Calendar，原旧空Calendar不代删。
- [ ] **Step 6：独立审查与一次集中修复**，按requesting-code-review/receiving-code-review；代码审查不能替用户体验。观察到的故障先systematic-debugging与RED→GREEN，修后重跑受影响用例；无新变化不机械重复所有测试。
- [ ] **Step 7：报告退出判定并提交** `test: verify final guide installation and pet-care journeys`。列精确命令、时间、计数、截图、failure→fix→retest；全部硬门槛通过方可Task8，缺环境项不勾完成。不能用Windows ZIP已生成替用户真跑。

### Task 8：原网址公开复验、v0.8.0与交接

**Files:** Modify `VERSION`、`package.json`、`package-lock.json`、`README.md`、`CHANGELOG.md`、`PENDING.md`、`ROADMAP.md`、`PRODUCT.md`、`DESIGN.md`、总计划、本计划、`SESSION_LOG.md`及发行运维。Create `docs/releases/v0.8.0.md`、`docs/demo-guide.md`。只写真实交付/限制。

**Consumes:** Task7硬门槛通过证据、真实可用的指南/安装范围。**Produces:** 原URL稳定产物/同环境SHA、Pages成功、新annotated tag与公开Release、用户验收报告状态、回退说明。

- [ ] **Step 1：冻结候选与版本元数据**：先核受影响用例，再准备0.8.0版本一致、只列已验能力的发行说明和README；体验路线2–3分钟不强迫匿名完成所有登录/AI步骤。回顾/社区需登录的分支明确标识，不承诺空公开列表有内容。
- [ ] **Step 2：运行stable构建与泄漏/白名单检查** `PAW_RELEASE_CHANNEL=stable npm run build`、完整单测/语法/diff；核manifest/release图标与旧模块图，验收包不进dist。快照已有远端tags目标，确认原URL/仓库未改。明确发布构件与buildId对应source提交，docs-only不改变已部署模块图。
- [ ] **Step 3：按既有授权整合main推送与Pages**，等待Actions真实success；全新npm ci/同stable构建核线上HTML/JS/CSS/release/manifest/图标SHA。以匿名新浏览器验首次公告和tour、老窗口验新版本提示与草稿保护、真实主体保存刷新。若核心故障先恢复v0.7.1前端构件与元数据，健康云数据不删。
- [ ] **Step 4：真实原URL三端安装/启动/更新检查**。更新检测纯逻辑fixture先通过，正式0.7.1→0.8.0网页更新有真实证据；新安装0.8.0的应用对下一版本更新只能在同路径受控候选更新/修复确实发生时实测，否则记“跨后续版本安装更新未实测”，不为测试虚发0.8.1或移动tag。
- [ ] **Step 5：公开验证通过后新annotated `v0.8.0` 与GitHub Release**，核tag解引用source、Release非draft/non-prerelease、旧tag全部不动、链接公开。Windows ZIP核SHA后作为Release附件并保本地点击下载；没有预先建tag代表完成。
- [ ] **Step 6：收口文档与工作区**：准确勾本计划/PENDING/总计划，final-report分别列真机/桌面模拟/真实主体/未验证；SESSION_LOG完整记失败、子agent、提交/推送、部署/Release、时限实际。关闭本轮新服务/context，不动用户LBS窗口或删除唯一旧证据树；按finishing-a-development-branch处理已合并分支，保留必要ignored证据，不force清理。

## 完成标准与下一轮入口

原网址可访问，健康与私有权限硬门槛通过，指南/安装说明与实际能力一致，v0.8.0正式发布且旧tag不动。用户未返回的检查仍为待验，不以最终版本号代表全平台全部通过。

下一轮从main按PENDING→SESSION_LOG最新段→本spec/plan恢复；先报实际剩余时间、检查工作区/服务/会话有效性再创建隔离树执行。本轮只规划，Windows ZIP/图标/manifest/产品controller均未生成，不把文件名列入计划当已交付。

## 计划自检

spec每节映射：来源/门槛→Task1/7/8；帮助/偏好→Task1/2/5；六步→Task3/5；安装/更新→Task4/5/8；Windows/三端/日历→Task6/7；公开发布/回退→Task8。Review Focus五类都有所属测试；接口名字统一，不使用未定义跨任务函数。环境缺口列为Task7事实检查，产品取舍已收口；所有checkbox保持未完成。
