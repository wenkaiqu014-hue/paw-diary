# 阶段1健康管理补充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 健康页稳定双卡、多宠物直接管理/排序、护理事项管理导出与可恢复删除。

**Architecture:** 保留原生界面，以独立领域模块处理生命周期与排序，规范快照包含软删除资料，界面使用可见选择器。AppStateV3迁移不覆盖旧v1/v2；批量操作先验证再持久化，云端后续镜像。

**Tech Stack:** 原生ESM、node:test、Python Playwright、既有仓储/dialog/SVG；不增加UI库或付费接口。

**Spec:** [阶段1健康管理设计](../specs/2026-10-07-health-management-design.md)。状态：用户明确授权按方案完整实施，本地3任务已完成并验证，公开发布待完成。已有高度缺陷独立修复，不等待新数据协议。

## Global Constraints

- 固定URL、四hash、v0.1.0 tag不变；不发布未验收能力。
- 左侧“管理宠物”、右侧“管理与导出”；桌面稳定同排，手机与大字号操作可达。
- 规范V3存全部实体，deletedAt=null表示可见；只导出当前宠物所选可见pending到ICS。
- 数据保存成功才更新界面，旧v1/v2原文保留，移入/恢复幂等；不自动永久清空。
- 本session不实现遮罩指南、AI/定位/桌面包，不自动开始阶段2。

## Review Focus

1. 最后一只宠物/隐藏父宠物：activePetId=null合法，不复活独立删除子记录。Task1、2。
2. 旧备份恢复隐藏内容：冲突预览须显式确认，不静默恢复。Task1、3。
3. 多选后换宠物/状态：清空选择，禁止跨宠物批量操作。Task2。
4. 保存失败/重复操作：整个批次原子拒绝，保留选择，不重复实体。Task1、2。
5. 大字号/长列表/键盘排序：外部操作不裁剪，视图不跳动。Task2、3。

## Task 1 软删除、排序与安全V3迁移

**Files:** 新增`src/domain/lifecycle.js`、`tests/lifecycle.test.js`；修改`src/domain/{schema,records,reminders,backup}.js`、`src/data/{demo-repository,seed}.js`；扩展`tests/{demo-repository,export,migration,health}.test.js`。

**Interfaces:** `migrateV2(raw): AppStateV3`；`visibleHealth(snapshot): {pets,records,reminders,activePetId}`为只读派生；`moveToTrash(state,{kind:'pet'|'record'|'reminder',ids:string[]},{now}): AppStateV3`；`restoreFromTrash(state,{kind,ids}): AppStateV3`；`reorderPets(state,orderedVisiblePetIds): AppStateV3`。Repository新增`moveToTrash(input)`、`restoreFromTrash(input)`、`reorderPets(ids)`，保留`deleteRecord(id)`但转为软删除；`snapshot()`始终返回完整V3。

- [x] Step1：写生命周期/迁移测试：移入当前/最后一只后选首个可见/null，恢复首只后选首个可见，有当前宠物则恢复保持原选择；重复移入/恢复不新增；恢复父宠物不恢复此前独立删除子记录；记录恢复不重启取消事项；事项删除不丢完成记录；无效批次与非排列排序拒绝且原snapshot不变；v1/v2原文保留、V3写失败不改可见state；旧备份与deletedAt冲突需明确确认。
- [x] Step2：运行`node --test tests/lifecycle.test.js`，确认缺失V3/lifecycle真实失败，保存RED输出。
- [x] Step3：实现上述接口、V3规范化与双旧源安全迁移，保存前原文变化检查沿现有并发保护；增加备份预览隐藏变化与完整导出。所有领域函数验证原始V3，不将visibleHealth作为完整快照。旧版本拒绝未知版本的行为保留，新版本显式迁移。
- [x] Step4：运行`npm test`，43项既有行为须保持正确或因明确V3契约更新断言；新增生命周期用例全绿。检查坏源不种示例、备份/关联无损、失败批次不部分提交。
- [x] Step5：提交`feat: preserve pet care data with recoverable lifecycle operations`，日志列RED/GREEN和实际测试数。

## Task 2 健康双卡管理、选择与排序

**Files:** 新增`src/features/health-management.js`、`tests/health-management.test.js`；修改`app.js`、`style.css`、`test_app.py`；新增`tests/e2e/health-management.py`，扩展`health-layout.py`。

**Interfaces:** 消费Task1完整snapshot/visibleHealth与Repository；UI状态`{petManage:boolean,reminderManage:boolean,selectedPetIds:string[],selectedReminderIds:string[]}`仅界面保存；`transitionManagement(state,event): UIState`，事件`ENTER_PETS|ENTER_REMINDERS|TOGGLE_PET|TOGGLE_REMINDER|PET_CHANGED|FILTER_CHANGED|EXIT|ENTITIES_CHANGED`。`selectedCalendarReminders(snapshot,petId,ids)`只返回当前宠物可见pending；包含非pending拒绝并提供可理解提示。

- [x] Step1：写状态与浏览器用例：默认行切换、管理行选择不切换、箭头编辑正确宠物/事项、底部新增；标签文字准确；管理可同时删除/导出，切宠物/状态清空；拖动与上移/下移刷新保序；空/20行/四态/200%文字按钮可达。
- [x] Step2：运行`node --test tests/health-management.test.js`及新e2e，确认缺少界面/状态真实失败。
- [x] Step3：实现列表与管理工具栏、排序保存、回收站移入确认、导出校验及焦点；存储失败保留选择与原列表。不把复选框/箭头嵌入另一个button。
- [x] Step4：运行`npm test`、新e2e与`tests/e2e/health-layout.py`、`test_app.py`；实际下载ICS核对所选ID/日期，不重复向用户Calendar导入。集中桌面/手机截图一轮，必要修正后确认一轮。
- [x] Step5：提交`feat: manage pet lists and care selections from health cards`。

## Task 3 回收站恢复、备份与阶段收口

**Files:** 修改`health-management.js`、`app.js`；扩展`tests/e2e/health-management.py`、`local-foundation.py`、`local-regressions.py`；更新阶段1验收报告、PENDING/DESIGN/SESSION_LOG。

**Interfaces:** 回收站从完整snapshot筛deletedAt，恢复走Task1接口；父宠物隐藏时子实体提示先恢复宠物。完整JSON导出V3，CSV与ICS仅可见筛选结果。

- [x] Step1：写e2e：移入宠物后趋势/首页消失，恢复后记录/待办重现；移入最后一只为空；已单删记录不随父宠物复活；事项移入/恢复保持完成历史；回收站JSON往返/旧备份确认不复活；写失败保留选择。
- [x] Step2：运行e2e，确认恢复入口/软删除流程未实现导致真实失败。
- [x] Step3：实现常驻回收站入口、列表/关联数量/恢复、明确父级提示，修正备份下载/筛选入口和错误反馈；不增加自动到期清除。
- [x] Step4：运行`npm test`、`node --check app.js`、`git diff --check`、原及新增浏览器流程和白名单`/paw-diary/`产物验证；真实手机/原生缩放未做则保留未验证状态。
- [x] Step5：提交`feat: restore deleted pet care data and verify stage one management`，本地整合后由用户阶段验收；未验收不标阶段1退出或创建新tag/Release。

## 自检与交接

N-01由Task2/3覆盖，N-02由Task1/3覆盖；接口统一V3，当前规范/归属和可见派生区分，五类Review Focus均对应测试。用户已明确要求完整做完阶段1并授权v0.2.0发布，本轮依据该方案实施并验证；主agent协调实现与最终复验，按现有授权使用边界清楚的worker。
