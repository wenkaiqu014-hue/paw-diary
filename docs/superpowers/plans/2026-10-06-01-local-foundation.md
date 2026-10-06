# 稳定发布与本地健康闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保持评审链接可用，将 v0.1.0 转为可测试、可接云端的数据结构，并补齐手动健康记录与提醒操作。

**Architecture:** 保留原生 HTML/CSS 和四个 hash 路由，把纯业务规则、演示存储与页面操作分开。现有 localStorage 在迁移前备份，新增能力先在演示模式验证。前端采用 ESM；云端 SDK 接入前引入轻量打包，不迁移到 React/Vue。

**Tech Stack:** 本地 Node.js 22、浏览器 ESM、node:test、现有 Python Playwright、GitHub Actions；esbuild 仅在第二阶段接 SDK 时使用。

**Spec:** `ROADMAP.md` §2–3、§5–7；`PENDING.md` P0、P1-02、P1-04、P1-07。

## Global Constraints

- 固定地址 `https://wenkaiqu014-hue.github.io/paw-diary/`，仓库名 `paw-diary`；不移动 `v0.1.0` tag。
- 保留 `#home`、`#health`、`#nearby`、`#community`，奶油色与绿色视觉系统继续复用。
- 健康日期由用户确认，不生成诊断、药物剂量或自动医疗周期。
- 本阶段不创建收费资源、不修改登录能力，不将本地演示宣称为云端。
- 测试输出、后端源码、凭证及日志不进入 Pages 发布目录。

## Review Focus

1. v1 旧数据或损坏备份：迁移失败保留原始存储，不能重置用户内容。Task 2 验证。
2. 同日多次称重及改成早期日期：展示按实际日期/创建时间排序的最后有效记录。Task 3 验证。
3. 连续点击完成同一提醒：只生成一条关联完成记录。Task 3 验证。
4. ESM 路径在 `/paw-diary/` 子路径：所有脚本和素材使用相对路径，线上四页不丢资源。Task 1、4 验证。
5. 中文与跨时区日历：日期不前移，说明换行不破坏 ICS。Task 4 验证。

## 文件与接口

新增 `package.json`（`type: module`、`test: node --test`）、`src/domain/{schema,records,reminders,backup,calendar}.js`、`src/data/{seed,demo-repository}.js`、`src/app-session.js`、`tests/*.test.js`。修改 `app.js`、`index.html`、`.github/workflows/pages.yml`、`test_app.py`。不把每个 HTML 拼接函数都拆成单独文件。

`AppSnapshot = {mode:'demo'|'account',activePetId,pets,records,reminders,posts,profile}`；`AppStateV2 = AppSnapshot & {version:2}`。Cloud snapshot的posts不加载公开社区，使用空数组；activePetId为有效id或null；日期是 `YYYY-MM-DD`，时间是 ISO timestamp。`Pet={id,name,type:'cat'|'dog',birthday:null|date,estimatedAgeMonths:null|number,arrivalDate:null|date,breed,sex,image}`。`HealthRecord={id,petId,type,occurredDate,value:null|number,unit:null|'kg',title,note,createdAt,updatedAt}`。`Reminder={id,petId,title,dueDate,status:'pending'|'completed'|'cancelled',originRecordId:null|string,completionRecordId:null|string,completedAt:null|string}`。

所有仓储方法返回 Promise：`snapshot(): Promise<AppSnapshot>`、`savePet(input): Promise<Pet>`、`saveRecord(input): Promise<HealthRecord>`、`deleteRecord(id): Promise<void>`、`saveReminder(input): Promise<Reminder>`、`completeReminder(id,{occurredDate,note,idempotencyKey}): Promise<{reminder,record}>`。输入编辑使用已有 `id`；没有 `id` 为创建。取消事项通过 `saveReminder({id,status:'cancelled',...})`。成功写入后才更新可见 state。

## Task 1 稳定 ESM 发布与可回退部署

**Files:** 修改 `index.html`、`.github/workflows/pages.yml`；新增 `package.json`、`docs/operations/deploy-and-rollback.md`。

**Interfaces:** 前端继续从 `app.js` 启动，但使用 `<script type="module" src="app.js">`。发布白名单在目录存在时复制 `src/`（本任务不创建空目录），配置 paths 只在产品文件、素材、发布配置改变时触发；保留 workflow_dispatch。

- [x] Step 1：先运行现有浏览器基线，记录九组流程结果；本任务是发布配置与模块入口调整，不写镜像YAML内容的测试。
- [x] Step 2：列出产品变更会触发、纯文档变更不会触发的检查清单，在本地构造子路径服务验证模块与图片实际可读。
- [x] Step 3：增加 ESM 入口与白名单。回退说明使用目标稳定版本的网页文件做新提交，不改旧 tag；恢复目录时删除目标版本不存在的模块文件。记录原地址和人工触发部署方法。
- [x] Step 4：运行`node --check app.js`、本地 `test_app.py`和真实发布配置检查；随后检查 `/paw-diary/` 路径下所有资源。预期无资源 404、已有九组流程通过。
- [x] Step 5：提交 `chore: preserve static deployment and document rollback`，追加日志。

## Task 2 非破坏迁移与异步演示仓储

**Files:** 新增 `src/domain/schema.js`、`src/domain/backup.js`、`src/data/seed.js`、`src/data/demo-repository.js`、`src/app-session.js`、`tests/migration.test.js`、`tests/demo-repository.test.js`；修改 `app.js` 的 state/readState/commit/update。

**Interfaces:** `migrateV1(raw,{now}): AppStateV2`；`validateBackup(raw): AppStateV2`；`createDemoRepository({storage,key,clock}): Repository`；`createAppSession(repository): {load(),snapshot(),run(operation)}`。存储键 `paw-diary:v2:demo`，迁移前保留 `paw-diary:v1` 和 `paw-diary:v1:backup`。遗留 `activePet`、`date`、`nextDate` 映射成规范字段；v1 createdAt毫秒数转为ISO时间，缺失时间保持确定的原有排序。无归属或未知类型记录作为导入错误返回，不偷偷丢弃。

- [x] Step 1：写真实 v1 fixture 测试：自建宠物、示例宠物、同日体重和 completed nextDate 迁移后数量及归属不变；损坏 JSON 不覆盖旧键。仓储保存失败不能改变 snapshot，重载能恢复成功保存的内容。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(migrateV1(v1Fixture, {now}).version, 2);
assert.equal(migrateV1(v1Fixture, {now}).records.length, v1Fixture.records.length);
assert.deepEqual(snapshotAfterFailedWrite, snapshotBeforeWrite);
```

- [x] Step 2：运行 `node --test tests/migration.test.js tests/demo-repository.test.js`，确认在接口尚未实现时失败。
- [x] Step 3：实现迁移、先持久化再提交状态、异步 Repository 与页面加载层；`snapshot` 返回克隆，防止页面直接改内部 state。所有保存失败显示恢复操作并保留表单。
- [x] Step 4：运行该组测试、`npm test` 与现有浏览器测试。预期旧资料保留、写入失败不报成功、刷新和四页流程正常。
- [x] Step 5：提交 `refactor: isolate demo storage and migrate health data`，记录变更与迁移结果。

## Task 3 可编辑记录与幂等提醒完成

**Files:** 新增 `src/domain/records.js`、`src/domain/reminders.js`、`tests/health.test.js`；修改 `app.js` 的 recordModal、petModal、healthHTML、remindersHTML；扩展 `test_app.py`。

**Interfaces:** `applyRecord(state,input,{now,idFactory}): AppStateV2`；`removeRecord(state,id): AppStateV2`；`completeReminder(state,id,input,{now,idFactory}): {state,reminder,record}`。删除记录时取消仍待办的 origin 关联提醒，不删除其他记录；completed 提醒再次完成返回同一 completionRecordId。估计年龄和已知生日互斥，未知到家日期允许 null。

- [x] Step 1：写 `health.test.js`，断言体重 0、201、非数字拒绝；22.5kg 修改为23kg后正确排序；改早期日期不覆盖最新体重；删除记录后对应 pending 提醒取消；重复完成的 records 长度只增加1；不同宠物同名仍按 id 隔离。生日未知+估计年龄12个月可保存。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
const first = completeReminder(state, reminderId, input, deps);
const again = completeReminder(first.state, reminderId, input, deps);
assert.equal(first.state.records.length, state.records.length + 1);
assert.equal(again.record.id, first.record.id);
```

- [x] Step 2：运行 `node --test tests/health.test.js`，确认缺失行为失败。
- [x] Step 3：实现领域规则，通过仓储调用；新增编辑、修改日期、取消事项操作。按阶段0交互/验收说明将手机首页待办提前、健康页显示完整待办与移动记录卡；补跳转内容不换路由、筛选/保存后焦点恢复、合理字号/触控区和图片失败占位。时间线和首页只从 snapshot 派生，不单独维护副本。
- [x] Step 4：运行该组测试、`npm test` 和浏览器记录编辑/取消/重复点击测试。预期记录、待办、趋势同步，重复完成不增加记录；360/390/768/1440px四页与键盘焦点、长文本/图片失败按阶段0 F01–F06验证。
- [x] Step 5：提交 `feat: edit health records and complete reminders once`，维护 PENDING 状态。

## Task 4 备份恢复 CSV 与日历导出

**Files:** 新增 `src/domain/calendar.js`、`tests/export.test.js`；完善 `backup.js`；修改 `app.js` 导出/导入和待办操作；扩展 `test_app.py`。

**Interfaces:** `previewImport(current,backup): {newPets,newRecords,newReminders,conflicts}`；`mergeBackup(current,backup,{acceptedConflictIds}): AppStateV2`，默认同 id 不覆盖；跨 owner 的备份到真实账户前须显式确认并重建归属，CloudRepository 不直接导入原 ownerId。`exportRecordsCsv(records): string`；`exportRemindersIcs(reminders,pets): string`，只导出 pending，用 `DTSTART;VALUE=DATE`，UID=`reminder.id@paw-diary`，不写未确认的闹钟策略。

- [x] Step 1：写 `export.test.js`：重复导入不增加记录；v1备份先迁移；错误版本和孤儿记录拒绝；CSV 中文、引号、换行可恢复；ICS 包含 `DTSTART;VALUE=DATE:20261008`、稳定UID和转义后的说明。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.match(exportRemindersIcs(reminders, pets), /DTSTART;VALUE=DATE:20261008/);
assert.match(exportRemindersIcs(reminders, pets), /UID:.*@paw-diary/);
assert.equal(mergeBackup(state, backup, {acceptedConflictIds:[]}).records.length, state.records.length);
```

- [x] Step 2：运行 `node --test tests/export.test.js`，确认缺失接口失败。
- [x] Step 3：实现导入预览/确认、CSV、ICS；仅点击确认后持久化，不从文件直接替换全部 state。
- [x] Step 4：运行 `npm test`、浏览器下载/导入；把测试 ICS 导入本机可用日历应用核对日期。记录实际应用和结果；不能导入时这项保持未完成。
- [x] Step 5：提交 `feat: restore backups and export care events to calendar`，更新版本说明。实际提交cf6b681；CHANGELOG为未发布，VERSION/tag维持公开0.1.0。

## 阶段退出标准

旧数据未丢失；编辑、提醒完成、备份和ICS可用；全部现有测试与新增测试通过。先本地验收，再在原 URL 发布候选 `v0.2.0`；版本号是计划，未创建 release 前不标完成。后端开通受阻不影响本阶段交付。

## 实际交付状态

最新用户已确认双卡稳定高度、多宠物卡内管理/排序、“管理宠物”与“管理与导出”，回收站先覆盖宠物/健康记录，右卡也需可删除事项。高度缺陷单独修复；新增管理/生命周期已依用户明确指令实现，见[补充设计](../specs/2026-10-07-health-management-design.md)和[3任务补充计划](2026-10-07-01-health-management.md)；新增技术验收通过，按发布授权进行公开验收。用户后续体验不虚标完成。

- [x] 本地完整实现、71项单测、8套浏览器/边界/管理/缓存回归通过，实际静态白名单子路径验证通过；Calendar导入已由用户和指定窗口截图确认。
- [ ] 用户完成阶段1体验验收。
- [x] 新版在原评审地址部署、8套匿名浏览器复验、创建v0.2.0 annotated tag及非draft/非prerelease Release；用户亲自体验框不虚勾。

数据裁决：legacyCreatedAtUnknown标注旧缺创建时间，稳定回退不盖过真实同日测量，CSV不把占位当真实日期；legacyCompletionUnknown和completionRecordDeleted区别未知旧完成与已删关联记录。备份恢复包含本地posts，冲突键kind:id；savePet(makeActive)原子选择。旧缓存发现另一窗口变化则拒绝覆盖，未保存输入可复制后刷新。这些是本地可靠性约定，不代表跨设备同步。完整结果及限制见 `docs/verification/stage1-report.md` 和SESSION_LOG。
