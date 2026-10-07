# v0.6.2 一句话记入与手动填写对齐

用户已批准五步实施；2026-10-07 20:37:33 Asia/Shanghai开始，整体截止21:57:33，每步最多20分钟。保留阶段4 agent的823a828及之前文档提交；本轮在fix/ai-entry-parity-v062隔离工作树实施，不启动阶段4。

1. 输入焦点与文案：不自动聚焦输入；指针输入用轻绿色，键盘焦点可见；配额说明间距16px，明确一句话记入/成长回顾/记录助手共用。
2. 共享字段：手动与每条AI草稿复用record-fields，用途逐项可选，已发生仅记录，计划仅待办，疫苗/驱虫默认健康其余不勾，用户显式选择保留。
3. 类型目录：AI复用现有图标/新增/管理/排序/删除，四内置不可删除、自定义最多3个；未知类型保持空选择；自身目录变更更新草稿CAS，其他变更不能绕过CAS。
4. 模型与保存：每条purpose，混合过去/未来，缺失/模糊日期留空，未确认不写；三个仓储和可信entries.saveBatch原子保存1–5条，无未来体重预测、无隐式关联。
5. 验证发行：行为测试、有头Chrome、独立审查、真实模型/私有云混合保存和收口，原URL部署v0.6.2，新tag不移动旧tag，更新交接记录。

接口：validateEntryDraft/toEntryInputs/applyEntryBatch；saveEntryBatch(entries,{baseRevision,operationId})返回records/reminders/entries。entries包含draftId/purpose/input，计划input.recordType，记录input.type；目录从实际profile.recordTypeCatalog取。现有records.saveBatch兼容不变。

文件：Root负责app.js、ai-entry.js、record-type-picker.js、CSS导入、日志与发行；ai062_shared_fields负责record-fields/record-dialog及测试；ai062_backend负责parser/gateway/domain/repos/api和测试；ai062_focus_layout负责quota文案、scopedCSS、有头测试。并行工作不回退他人修改，最终Root实际整合验证。

验收：同一草稿可以修改用途；日常计划默认不进入健康；类型新建不丢草稿且不绕过并发；缺失字段不写、混合保存全成或全失败；切宠/账号旧草稿拒绝；双语与390/1440样式可用。真实账号只单actor A并每次刷新checkpoint，B过期不复用；私有附件不进入AI。收费预算/供应商不变。
