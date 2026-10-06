# HTML 界面与完整体验设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为新手健康主线及真实社区形成统一、能直接实施的HTML界面与交互说明。

**Architecture:** 保留DESIGN.md的奶油色、绿色、宠物摄影和桌面侧栏/手机底栏，在已有页面上规划新增流程和状态。优先清晰与可操作性，不用大幅品牌重做或复杂动效抢占开发时间。

**Tech Stack:** 原生HTML/CSS/JS、现有Impeccable技能、浏览器截图；Anthropic frontend-design与Vercel web-design-guidelines作为GitHub调研参考，是否安装后续再决定。

**Spec:** `PRODUCT.md`、`DESIGN.md`、`ROADMAP.md` §2–3；本轮用户要求查询HTML设计技能，整体仍仅规划。

## Global Constraints

- 产品主线为记录、提醒、成长回顾，服务养猫狗新手。
- 复用四页结构和已建立视觉，不因更换技能自动重做主题。
- 页面文案反映实际能力，示例、真实账户与未接通状态清楚。
- 所有新增表单有标签、校验、失败恢复和保存反馈。
- 动效只表达状态，尊重prefers-reduced-motion；不增加本轮未确认的功能。

## Review Focus

1. 首页多个按钮争夺注意力：记一笔是主动作，护理待办易找到。Task1。
2. 新手没有历史资料：建档不强制填全疫苗史，无生日可用估计年龄。Task1。
3. 多条AI草稿：每条能编辑/取消，缺失字段及保存状态明确。Task1。
4. 手机键盘与长文本：表单滚动和保存按钮可达，底栏不遮内容。Task2。
5. 示范和个人数据混淆：用户能分辨当前模式，失败状态不混入示例。Task2。

## Task 1 页面层级与新增流程说明

**Files:** 创建 `docs/design/experience-brief.md`；更新 `DESIGN.md`。此步骤只形成说明与必要的低保真布局，不改线上页面。

**Interfaces:** 说明按页面给出主动作、次动作、显示数据、业务事件与恢复路径；事件对应后续Repository/API，不另造并行的状态名称。

- [ ] Step1：用已安装Impeccable的Operate原则检查现有四页和真实用户场景，继承现有视觉依据。
- [ ] Step2：写成长首页、健康档案、附近宠友、社区日常的层级：主动作分别是记一笔、管理护理记录、寻找伙伴、发布日常；体重趋势提供可核对记录，回顾提供查看依据。
- [ ] Step3：画三步引导、登录、AI多条草稿确认、回顾预览/分享、提醒完成/下一次设置的简要流程，所有中断点有恢复/退出路线。
- [ ] Step4：逐项对照ROADMAP，检查用户不完整资料、AI失败和无社区内容仍能行动，不添加新功能以填版面。
- [ ] Step5：提交 `docs: define pet care page hierarchy and interaction flows`，记录设计决策。

## Task 2 组件 状态与响应式验收表

**Files:** 创建 `docs/design/ui-acceptance.md`；更新DESIGN.md的组件与布局约定。

**Interfaces:** 表单/列表/草稿/回顾/空状态统一使用 `idle|loading|success|error`；提醒状态复用`pending|completed|cancelled`，不新增同义状态。

- [ ] Step1：记录字体层级、间距、颜色、图标和常用按钮/输入/对话框约定；继承现有token，仅对有证据的问题提出调整。
- [ ] Step2：列明360、390、768、1440px布局，200%文字、手机键盘、长名称、长评论及图片缺失的行为。
- [ ] Step3：按Vercel界面规则检查语义元素、键盘焦点、表单标签、loading/错误/空状态和reduced-motion；与本项目风格冲突的品牌特定偏好不照搬。
- [ ] Step4：准备各阶段实施后的截图/交互验收表，截图一次集中检查，修复后一轮确认；自动扫描不替代用户路径测试。
- [ ] Step5：提交 `docs: specify responsive UI states and acceptance checklist`，后续实现按此验收。

## 阶段退出标准

四页、登录、引导、草稿、提醒、回顾与社区的行为和状态均能实施；保持原主题，不能只有抽象“精致”“美观”的要求。技能调研见 `docs/research/2026-10-06-frontend-skills.md`。这一设计阶段的实际执行安排在用户之后启动实施时，本轮只写该计划。
