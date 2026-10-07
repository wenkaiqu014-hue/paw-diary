# 记录与档案体验修订 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用统一弹窗完成记录/计划，补齐头像、可复用类型、附件、整行排序和多宠物记录筛选。

**Architecture:** 保留V3与record/reminder两种实体，新增可选类型目录和历史快照字段。原生ESM组件封装选择器、头像与录入状态；附件通过[独立配套计划](2026-10-07-record-attachments.md)和已有媒体存储集成。主agent协调共享文件，独立模块可由worker实施。

**Tech Stack:** 原生HTML/CSS/ESM、esbuild、node:test、fake-indexeddb、Python Playwright、现有CloudBase JS3.10.1/Node3.18.3；不增加前端框架。

**Spec:** [完整设计](../specs/2026-10-07-record-workflow-refinement-design.md)。用户已批准并实施，最终v0.5.1公开验收见[报告](../../verification/record-workflow-report.md)。下文保留实施前的文件/步骤设计，实际调整以执行记录为准。

## Global Constraints

- 可见内置类型只有四个：体重、疫苗、驱虫、日常。
- 每个空间最多3个活跃自定义类型；图标只能book、paw、drop，允许重复使用。
- 不预建「剪指甲」或其他自定义类型；旧type:'other'数据保留。
- AI选项为「一句话记入」，附小字「AI智能生成」；切换不保存、不自动重复调用。
- 默认当前宠物；多宠筛选仅影响全部成长记录及对应CSV。
- 附件JPEG/PNG/WebP/PDF，每项最多3个、单文件≤5MiB，头像/照片/附件共享50MiB空间限额。
- paw-api保持3秒；附件paw-files30秒，读取20秒，客户端35秒；头像/照片原限制不扩大。
- 固定原URL、四个hash路由、既有身份隔离、V3回收站、双语和AI仅服务端密钥均保留。
- 每任务开始查本机及GitHub相关高星skill，优先复用；每任务收尾同步日志/待办并归档Git。
- 单任务30–45分钟目标、不超过1小时；原19:27:31窗口不重新计时，最终2026-10-08 20:00不变，估计不是完成保证。

## Review Focus

1. 有旧「其他」原文或已删自定义类型的记录，编辑与恢复仍保留名称/图标（Task1）。
2. 新建宠物/记录成功而媒体失败，重试不能重复创建父项（Task4与配套Task3）。
3. 筛选另一只宠物后编辑其记录，不清掉其关联待办、不改当前宠物（Task6）。
4. 类型管理满额且图标重复，后端也拒绝第四个，删除仅释放名额（Task1/2）。
5. 打开弹窗和切录入模式，键盘可操作且旧输入/草稿不丢、不多请求AI（Task3/4）。

## 文件与协作边界

新建领域record-type-catalog.js、record-intent.js，UI select-control.js、record-dialog.js、avatar-picker.js、row-sort.js、record-pet-filter.js。沿src/domain及src/ui现有风格；不拆全站路由。

Root独占app.js、style.css、index.html、共享schema/仓储/备份集成与日志。worker可独占类型纯函数及其测试、UI独立组件及其测试、配套附件领域/backend和新函数；不得回退他人改动。共享文件修改由Root串行吸收，不通过并行worker覆盖。实施时新建隔离工作树feature/record-workflow-refinement，保留已有stage3证据。

## Task 1：可保存的类型目录与历史兼容（预计40分钟）

**Files:** Create `src/domain/record-type-catalog.js`、`tests/record-type-catalog.test.js`；Modify `src/domain/schema.js`、`src/domain/records.js`、`src/domain/reminders.js`、`src/domain/backup.js`、`src/domain/archive.js`、`src/data/{demo,local,cloud}-repository.js`、`backend/api.cjs`、`backend/imports.cjs`、`backend/workspace.cjs`；Extend `tests/custom-types.test.js`、`tests/cloud-private.test.js`、`tests/archive.test.js`。

**Interfaces:** `recordTypeEntries(snapshot,{includeHistoricalRecord=null}={}) -> Array<{id,type,name,iconKey,builtin}>`；`applyRecordTypeCommand(snapshot,{action:'add'|'delete'|'reorder',name?,iconKey?,ids?},{idFactory,now}) -> snapshot`；repositories `manageRecordTypes(command,{baseRevision,operationId}) -> receipt`，云action `recordTypes.manage`。Profile目录和记录/待办可选字段严格按spec。新增ID不能由名称充当；旧目录缺失按四个内置初始化，不从旧标签自动生成新类型。

- [ ] 查本机TDD/验证与GitHub obra/superpowers相关skill，将来源和任务开始时间记录日志。
- [ ] 写RED：四内置不能删除；三个自定义可同用book；第四个add失败；删一个后可add；删类型后原记录label/icon及旧other原文不变；两宠共目录、跨空间不串；restore/migration重映射customTypeId、超额预览不删历史。
- [ ] 执行 `node --test tests/record-type-catalog.test.js tests/custom-types.test.js tests/cloud-private.test.js tests/archive.test.js`，确认新增断言失败而非夹具语法错误。
- [ ] 实现目录纯命令、schema可选字段、仓储幂等命令及服务端同等约束；扩展backup/archive/import白名单与映射，不放开其他profile任意写入。记录引用保存label/icon快照；删除只标目录deletedAt。
- [ ] 同命令GREEN，增加独立仓储刷新检查；原无目录V3照常读取。提交 `feat: persist reusable record type catalog`，日志保留实际失败/成功数量。

## Task 2：统一下拉与类型新增/管理（预计35分钟，依赖Task1）

**Files:** Create `src/ui/select-control.js`、`tests/select-control.test.js`、`tests/e2e/record-types.py`；Modify `app.js`、`style.css`、`src/ui/locales/zh-CN.js`、`src/ui/locales/en.js`。

**Interfaces:** `mountSelect({root,name,value,options,onChange,footer=null}) -> {setValue(value),setOptions(options),destroy()}`；option `{value,label,iconKey?,disabled?}`。保留表单值/变更契约；管理页调用Task1.manageRecordTypes；固定选择器footer=null。选项图标取现有SVG registry，补drop与统一paw线条，不上传图标。

- [ ] 查本机Impeccable/WebDesignGuidelines和GitHub vercel-labs/agent-skills，只用选择器/表单相关指南。
- [ ] 写RED真实DOM：选择器显示四内置图标且无「其他」；新增显示三图标；同图标连建三个成功、第四新增灰色且提示可读；内置灰色复选无法勾；删自定义历史仍可读；排序刷新保留。键盘上下/Enter/Escape、表单提交值与语言切换正常。
- [ ] 执行 `node --test tests/select-control.test.js` 与 `/Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/record-types.py`，记录RED。
- [ ] 实现一个共享select组件，类型新增/管理在同一组件内展开，最大3提示兼容鼠标/键盘/触屏。替换现有固定下拉样式但不加新增/管理；移动端触控点击可用，关闭下拉不关dialog。
- [ ] 同命令GREEN；切语言/切空间后销毁旧组件状态。提交 `feat: unify selectors and record type management`。

## Task 3：统一记录/计划弹窗及模式保留（预计45分钟，依赖Task1/2）

**Files:** Create `src/domain/record-intent.js`、`src/ui/record-dialog.js`、`tests/record-intent.test.js`、`tests/e2e/record-dialog.py`；Modify `app.js`、`style.css`、`src/features/ai-entry.js`、`src/domain/ai-drafts.js`、`src/domain/reminders.js`、`backend/ai/record-parser.cjs`、`backend/ai/gateway.cjs`、语言模块；Extend `tests/ai-drafts.test.js`、`tests/ai-gateway.test.js`、`tests/health.test.js`。

**Interfaces:** `entryDefaults(entry:'page'|'todo'|'weight'|'timeline',petId) -> {purpose,type,petId}`；`recordIntent(form,{today,catalog}) -> {kind:'record'|'reminder',input}`；`mountRecordDialog({host,entry,petId,existing=null,services}) -> {getState(),destroy()}`。services复用现有saveRecord/saveReminder/saveRecordBatch/completeReminder、AI client和目录。state保存manual/ai两份输入与draft；AI请求新增purpose:'record'|'plan'，计划候选有dueDate、不要求过去occurredDate；确认记录走原批量事务，确认计划走幂等saveReminder，不增加计划批量接口。

- [ ] 查本机TDD/Impeccable与GitHub既有高星testing技能，记录起点。
- [ ] 写RED四入口初值按spec；未来计划0record/1reminder、完成护理1真实record、计划体重完成必须kg；日常默认不进待办、疫苗默认开关但缺日期禁止提交；关开关取消关联pending而保留完成历史；未知日期不能补猜。
- [ ] 写RED真实DOM模式切换保留手动内容/AI文字及已解析草稿，fake provider计数仍1；purpose=plan候选未来日期通过确认、record未来日期拒绝；切空间清旧state。
- [ ] 执行 `node --test tests/record-intent.test.js tests/ai-drafts.test.js tests/ai-gateway.test.js tests/health.test.js` 和 `/Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/record-dialog.py` 确认RED。
- [ ] 实现同弹窗purpose切换、发生日期/计划日期/下次计划日期、按类型默认待办开关、并排模式按钮和内存保留；扩展parser的显式purpose契约及授权类型目录最小name/id/icon字段，不将文件送AI。完成待办保留类型快照，原来源关系/三步引导/切宠物清上下文不变。
- [ ] 同命令GREEN、原 `tests/e2e/stage3-review.py` 与 `stage3-locale.py` 回归；只fake验证计数，不反复调用模型。提交 `feat: unify record and plan entry workflows`。

## Task 4：初始焦点及建档头像（预计35分钟，可与Task1领域实现并行）

**Files:** Create `src/ui/avatar-picker.js`、`tests/avatar-picker.test.js`、`tests/e2e/dialog-avatars.py`；Modify `app.js`、`index.html`、`style.css`、语言模块；复用 `src/media/process-image.js` 与仓储media.save。

**Interfaces:** `mountAvatarPicker({root,petType,initialAvatar,onChange}) -> {getSelection(),setPetType(type),destroy()}`，selection `{kind:'preset',preset:'cat'|'dog'}|{kind:'upload',blob}|{kind:'keep'}`；`focusDialogTitle(dialog)` 聚焦标题并记录返回入口。云预设通过已有media.save保存现成asset bytes，不通过savePet任意改avatarAssetId；demo用现成素材且保持模式隔离。

- [ ] 查本机systematic-debugging/Impeccable与GitHub webapp-testing原文，继承已经确认的焦点原因，不重新全站诊断。
- [ ] 写RED：新建/编辑均三圆且可选择；取消无media写；保存avatar失败只建1宠物、重试只media写；上传后改猫狗类型不覆盖；预设可覆盖旧avatar；新建/编辑/记录弹窗activeElement是title，语言值不变，Tab能进首字段，关闭回到入口。
- [ ] 执行 `node --test tests/avatar-picker.test.js` 与 `/Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/dialog-avatars.py`，确认RED。
- [ ] 实现头像暂存/预览/Save父项receipt复用、partial failure文案和重试；用已有头像处理边界。只调整初始焦点，保留可见键盘focus样式。
- [ ] 同命令GREEN及 `tests/e2e/personal-media.py` 既有头像/照片墙/备份回归。提交 `fix: improve dialog focus and pet avatar setup`。

## Task 5：记录和计划附件（配套三个小任务，每个≤45分钟）

**Files/Interfaces/RED→GREEN:** 按[配套附件计划](2026-10-07-record-attachments.md)执行，不把它压成一个≤1小时假估计。

- [ ] 依次完成配套Task1本地文件契约、Task2私有云附件、Task3完整备份及表单接入；本地领域可在Task1主计划后与Task2/3UI并行，共享文件由Root集成。
- [ ] 配套真实文件与权限验收通过后才将本任务勾选；mock不算已云接通，原头像/照片规则仍通过。

## Task 6：整行宠物排序与多宠物记录（预计40分钟，依赖Task1/3）

**Files:** Create `src/ui/row-sort.js`、`src/ui/record-pet-filter.js`、`tests/record-pet-filter.test.js`、`tests/e2e/multi-pet-records.py`；Modify `app.js`、`style.css`、`src/domain/backup.js`、语言模块；Extend `tests/export.test.js`。

**Interfaces:** `mountRowSort({root,handleSelector,getIds,onCommit}) -> {destroy()}`，onCommit(ids)调用原order方法；`initialPetSelection(snapshot) -> Set<petId>`；`filterRecords(snapshot,{petIds,type,dateRange}) -> record[]`；扩展既有 `exportRecordsCsv(records,{pets=[]}={}) -> string`，新增petName列而不改全量JSON，原单参数调用仍有效。

- [ ] 查本机WebDesignGuidelines/webapp-testing与GitHub既有交互指南，避免装重动效/拖拽框架。
- [ ] 写RED鼠标/触屏模拟把手拖整行落点、键盘上下/取消、order刷新持久，DOM没有可见上下箭头且添加/管理同在右上；单宠无筛选，多宠默认仅当前；选两个都可见、零选择为空、CSV仅选定宠物；另一宠记录编辑仍绑定其petId/关联待办，上方当前宠物不变。
- [ ] 执行 `node --test tests/record-pet-filter.test.js tests/export.test.js` 与 `/Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/multi-pet-records.py`，确认RED。
- [ ] 实现pointer handle拖动整行占位/反馈、键盘排序、卡片动作统一；列表checkbox集合、首列/手机宠物标识及按行编辑。过滤不复用activePet-only pending，避免错误取消计划。
- [ ] 同命令GREEN及既有health-management回归。提交 `feat: support multi-pet record views and row sorting`。

## Task 7：整合、真实验收、文档和原站发布（预计45分钟）

**Files:** `tests/e2e/record-workflow-public.py`、`docs/verification/record-workflow-report.md`、`SESSION_LOG.md`、`PENDING.md`、`PRODUCT.md`、`DESIGN.md`、`ROADMAP.md`、`README.md`、`CHANGELOG.md`、`VERSION`、`package.json`及现有发布配置。

**Interfaces:** 前六任务与配套附件产物；原Pages入口和可信A轮换会话。候选版本v0.5.0仅全部通过后落地；不能以文档计划提前更新公开能力。

- [ ] 查本机verification-before-completion/WebDesignGuidelines、GitHub对应已用技能；只安排一轮独立整体review并修必要问题，Root复验。
- [ ] `node --check app.js`、`npm test`、`npm run build`、`npm run build:functions`、`git diff --check` 全部退出0；检查媒体、记录、类型、备份、阶段3存量测试无回归、无真实Key出现在tracked/公开构件。
- [ ] 真实有头截图1440/768/390、双语、滚动/弹窗/等宽/触屏模拟；本地刷新、完整恢复；可信A附件上传/下载实际hash与私有owner检查，其他身份及无身份拒绝。不新发验证码、不并发消费A，不将合成夹具视为用户事实。
- [ ] 一次必要真实AI录入确认及模式切换、原引导/回顾/只读助手回归；明确模型费用边界不改。source/console/pageErrors检查，无横溢；真机/读屏待最终阶段单列。
- [ ] 技术验收全过后整合main、推原仓库、等原Pages实际成功、全新匿名原URL回归；新增tag/Release且旧tags不动。记录新部署hash/时间及未验事项；用户亲验仍不代勾。

## 自检与实施交接

类型限制/图标重复/历史兼容覆盖Task1/2；四入口与日期/待办/AI计划覆盖Task3；焦点头像覆盖Task4；附件全链覆盖配套；排序多宠覆盖Task6；状态/时间/发布覆盖Task7。接口与spec字段一致，未预建示例标签。单步目标不是保证，配套三个任务独立计时，实际超时须当时报告。

执行方式沿用户已授权：Root协调、需要时独立worker和浏览器，勿再问协作菜单。按writing-plans先请用户审阅这份具体计划和设计，确认后开始业务实施；本轮文档不部署应用。

## 最终执行状态

用户随后批准实施并将预算改为每编号步骤15分钟、整体1小时；原30–45分钟估计及前轮19:27窗口不再作为本轮约束。18:00:04开始，v0.5.1于18:38:17公开，38分13秒；第7步从提前审查起计超过15分钟，单步时限未全部达到，已明确报告。

- [x] Task1：目录/历史兼容/三仓储/服务端校验及基础恢复。
- [x] Task2：全站select/type picker、四内置/3名额/可重复图标/键盘管理。
- [x] Task3：统一record/plan/complete、日期/待办开关、模式保留；AI缺字段要求补填。
- [x] Task4：标题focus/三圆头像、取消与部分失败仅重试媒体。
- [x] Task5：原文件/可信云/完整恢复，真实5MiB及浏览器签名下载验证。
- [x] Task6：整行排序/键盘、多宠默认当前/CSV/按行编辑。
- [x] Task7：325单测、实际主线/独立审查/必要修复/原URL/v0.5.1 Release；单步时间超限单列。

actual脚本为record-dialog/record-workflow-public、select-control/record-type-picker、pet-avatar-refinement/multi-pet-records及record-ai-plan-real；具体命令/失败/复验/源码hash在SESSION_LOG，未将原计划未执行的逐字命令当执行证据。跨空间目录超3个明确拒绝先调整，无专用活跃选择面板；用户亲验/真机仍待后续阶段。
