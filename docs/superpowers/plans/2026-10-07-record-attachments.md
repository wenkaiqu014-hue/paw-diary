# 记录与计划原文件附件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在私有记录和计划中保存、读取、删除并完整备份图片/PDF原文件。

**Architecture:** 复用现有media存储与父项可信身份检查，增加kind=attachment及parent引用。本地使用既有IndexedDB事务；云端新增有界paw-files函数，字节经签名PUT到对象存储。附件不混进图库，不发送AI。

**Tech Stack:** 原生ESM、node:test/fake-indexeddb、既有CloudBase/对象存储/Python Playwright，不引入OCR或文件转换服务。

**Spec:** [同轮设计的附件部分](../specs/2026-10-07-record-workflow-refinement-design.md)，由[主计划Task5](2026-10-07-record-workflow-refinement.md)调度。

## Global Constraints

- 附件JPEG/PNG/WebP/PDF，每项最多3个、单文件≤5MiB，头像/照片/附件共享50MiB空间限额。
- 附件kind:'attachment'，parentKind:'record'|'reminder'，parentId和petId由真实可访问父项核验；完成计划不复制文件。
- paw-api保持3秒；附件paw-files30秒，读取20秒，客户端35秒；头像/照片仍≤1MiB展示文件及原读取2500ms默认。
- 原文件bytes/hash必须一致；取消不上传，媒体失败不重复父项；回收站保留附件，单文件删除明确确认。
- 每任务先查本机/GitHub高星相关技能、记实际时间和失败/复验；每任务目标≤45分钟、不超过1小时。
- 仅既有个人环境和FUJI管理凭证，不新采购、不用集团账单、不回显凭证；估计不重置19:27:31窗口，最终截止2026-10-08 20:00不变。

## Review Focus

1. PDF MIME/扩展名伪装或体积变化：以实际字节文件头、大小及hash拒绝（Task1/2）。
2. 另一账号/宠物/已回收父项的ID：普通读取拒绝，恢复备份只准本人显式archive用途（Task2）。
3. 父项已保存但第二文件失败：重试只补失败文件且不重复记录（Task3）。
4. 跨空间恢复后父项ID改变：文件跟新record/reminder，旧关联不能读错（Task3）。
5. 删除/恢复宠物或记录：附件随父可见性保留，独立照片墙仍只列photo（Task1/3）。

## Task 1：文件契约与本地仓储（预计40分钟）

**Files:** Create `src/media/attachments.js`、`tests/attachments.test.js`；Modify `src/data/media-repository.js`、`src/data/demo-repository.js`、`src/data/indexeddb-store.js`（仅必要元数据兼容）；Extend `tests/photos-local.test.js`。

**Interfaces:** `inspectAttachment(blob,{name,maxBytes=5*1024*1024}) -> Promise<{name,mime,bytes,sha256}>`；统一 `repository.attachments.{list({parentKind,parentId}),save({parentKind,parentId,blob,name,baseRevision,operationId}),read(assetId,{includeDeleted=false}),remove({assetId,baseRevision,operationId}),resolveUrl(assetId)}`。save返回metadata，read返回{metadata,blob}；复用media底层但公开photo列表不含attachment。File名去路径字符、最长120字；支持类型不靠扩展名决定。

- [ ] 核本机TDD及GitHub高星testing/error-handling相关技能，记录起点。
- [ ] 写RED JPEG/PNG/WebP/PDF原bytes/hash相等，伪MIME/5MiB以上拒绝，第四文件拒绝，共享总容量拒绝；parentId属于另宠拒绝；同operationId不重复，取消暂存不写；父回收后普通read拒绝但archive可读，照片墙无PDF。
- [ ] `node --test tests/attachments.test.js tests/photos-local.test.js` 确认行为RED。
- [ ] 最小实现文件头/hash/大小验证与父项存在/归属/可见性，媒体事务原blob保存，不处理压缩；沿50MiB共享容量和既有receipt幂等规则。示例空间用内存文件适配器，不写私有云。
- [ ] 同命令GREEN，提交 `feat: add private local record attachments`。

## Task 2：可信云附件接口（预计45分钟，依赖Task1契约）

**Files:** Create `backend/attachments.cjs`、`cloudfunctions/paw-files/index.js`、`cloudfunctions/paw-files/package.json`、`src/data/cloud-attachment-repository.js`、`tests/cloud-attachments.test.js`；Modify `backend/storage.cjs`、`src/data/cloud-repository.js`、`scripts/build-functions.mjs`、`scripts/cloud-setup.py`、`docs/operations/cloud-setup.md`。

**Interfaces:** `handleAttachments(request,deps) -> response`，action `files.prepare|confirm|list|read|remove`；request复用既有token/baseRevision/operationId契约，deps复用identity/store/storage。`createCloudAttachmentRepository({repository,invokeFiles,upload}) -> repository.attachments`；`createCloudbaseStorage({app,fetch,readTimeoutMs=2500})` 保留原默认，paw-files显式20000。签名票据含可信owner、parent及hash，confirm核实际文件。函数读回30秒、客户端35秒，字节不塞函数JSON。

- [ ] 核本机TDD/systematic-debugging及GitHub对应技能；部署前定向读现有环境/函数而不重查采购。
- [ ] 写RED有效token本人parent可prepare/confirm/read；无token/假token/另一owner拒绝；同宠另一父项不能借票据串联；实际超量/错误hash/伪文件头拒绝；幂等同ticket不重复计费容量，旧照片规则保持≤1MiB。
- [ ] `node --test tests/cloud-attachments.test.js tests/cloud-private.test.js` 确认RED。
- [ ] 实现独立函数，所有权仍由可信identity校验；配额预留、确认、失败cleanup沿原媒体模式，不公开数据库/对象。更新管理脚本仅增加paw-files部署/规则，不重配认证或扩展paw-api超时。
- [ ] 同命令GREEN及 `npm run build:functions`；在既有环境部署并读回Active/30秒和权限，一次合成PDF/图片真实上传下载hash、无身份拒绝。日志仅布尔/size/hash摘要，不含token/下载URL/用户原文件内容。提交 `feat: add bounded private file function`。

## Task 3：完整备份和统一弹窗附件接入（预计45分钟，依赖Task1/2及主计划Task3）

**Files:** Create `src/ui/attachment-picker.js`、`tests/e2e/record-attachments.py`；Modify `src/domain/archive.js`、`src/domain/backup.js`、`backend/imports.cjs`、`src/data/cloud-media-repository.js`、`src/ui/record-dialog.js`、`app.js`、语言模块；Extend `tests/archive.test.js`、`tests/cloud-import.test.js`。

**Interfaces:** `mountAttachmentPicker({root,parent=null,repository}) -> {getPending(),flush(parent,{operationId}),destroy()}`；flush仅在用户已确认父项保存后上传，回传 `{saved,failed}`，失败保留重试状态及原parent。media.listAll/read/archive导入包含attachment，formatVersion2 export、v1仍validate/import；映射pet/record/reminder IDs及目录ID时一起映射attachment parent。父项详情同时可读当前record附件及关联reminder附件，不复制。

- [ ] 核本机webapp-testing/验证与GitHub对应高星技能，记录起点。
- [ ] 写RED取消0上传；保存父项/一个文件成功、第二失败，retry父记录数仍1、文件数正确；record/reminder各可添文件；图片/PDF打开下载可用；删除先确认；完整备份恢复后hash及新parent映射相同，回收/恢复可见性正确；旧v1图片备份仍可恢复、照片墙无附件。
- [ ] `node --test tests/archive.test.js tests/cloud-import.test.js` 与 `/Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/record-attachments.py` 确认RED。
- [ ] 实现picker文件名/预览/下载/删除、原父receipt重试；archive v2和云分批import目录/文件白名单及关系检查。保留原archive100MiB上限，不静默丢媒体；不能把附件fileRef签名URL写到可移植备份。
- [ ] 同命令GREEN、可信云完整恢复实际文件核验与旧个人媒体脚本回归；Root整合共享文件、同步报告和PENDING。提交 `feat: preserve record attachments in forms and backups`，返回主计划Task7统一发版。

## 自检

全部附件需求分别落本地契约、可信云和完整恢复三项；父项重试、跨宠权限和原文件hash有明确测试。worker只拥有新attachments模块/函数及测试，Root整合共享media/archive/schema/app/scripts，互不回退。每项仅做已确认图片/PDF基本用途，不扩展识别/文件搜索/通用盘。

## 最终执行状态

- [x] Task1：本地附件契约/事务/回收保留/原字节；RED→GREEN。
- [x] Task2：可信paw-files30秒、owner/父项/hash/容量/幂等，真实云验证。
- [x] Task3：统一表单/失败不重复父项/完整备份映射/旧v1读取，实际浏览器验证。

实际接口namespace为attachments.*、metadata文件名为filename（保留name兼容），公开repository.attachments；源码按责任集成不另加框架。大于1MiB附件因SCF response6MB改60秒签名下载、client bounded fetch校bytes/hash，不把URL存backup；真实5MiB生产client和原URLChrome2MiB CORS分别通过。Task5核心交付18:10:41处15分钟内，后续边界修复/补验归Task7，Task7窗口超限如实记录。已随v0.5.1发布，详情修订报告；最终A checkpoint18:32:26.044。
