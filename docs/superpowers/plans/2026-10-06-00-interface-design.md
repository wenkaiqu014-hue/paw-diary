# HTML 界面与完整体验设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为新手健康主线及真实社区形成统一、能直接实施的HTML界面与交互说明。

**Architecture:** 保留DESIGN.md的奶油色、绿色、宠物摄影和桌面侧栏/手机底栏，在已有页面上规划新增流程和状态。优先清晰与可操作性，不用大幅品牌重做或复杂动效抢占开发时间。

**Tech Stack:** 原生HTML/CSS/JS、现有Impeccable技能、浏览器截图；Anthropic frontend-design作为参考，Vercel web-design-guidelines已按后续用户授权安装，用于实施后的检查。

**Spec:** `PRODUCT.md`、`DESIGN.md`、`ROADMAP.md` §2–3；用户已明确启动阶段0，复用已确认方向并纳入本session费用/AI原则；本阶段仅设计交付。

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

- [x] Step1：用已安装Impeccable的Operate原则检查现有四页和真实用户场景，继承现有视觉依据。
- [x] Step2：写成长首页、健康档案、附近宠友、社区日常的层级：主动作分别是记一笔、管理护理记录、寻找伙伴、发布日常；体重趋势提供可核对记录，回顾提供查看依据。
- [x] Step3：画三步引导、登录、AI多条草稿确认、回顾预览/分享、提醒完成/下一次设置的简要流程，所有中断点有恢复/退出路线。
- [x] Step4：逐项对照ROADMAP，检查用户不完整资料、AI失败和无社区内容仍能行动，不添加新功能以填版面。
- [x] Step5：提交 `docs: define pet care page hierarchy and interaction flows`，记录设计决策。实际提交cd26996，决策与验证补记SESSION_LOG。

## Task 2 组件 状态与响应式验收表

**Files:** 创建 `docs/design/ui-acceptance.md`；更新DESIGN.md的组件与布局约定。

**Interfaces:** 表单/列表/草稿/回顾/空状态统一使用 `idle|loading|success|error`；提醒状态复用`pending|completed|cancelled`，不新增同义状态。

- [x] Step1：记录字体层级、间距、颜色、图标和常用按钮/输入/对话框约定；继承现有token，仅对有证据的问题提出调整。
- [x] Step2：列明360、390、768、1440px布局，200%文字、手机键盘、长名称、长评论及图片缺失的行为。
- [x] Step3：按Vercel界面规则检查语义元素、键盘焦点、表单标签、loading/错误/空状态和reduced-motion；与本项目风格冲突的品牌特定偏好不照搬。
- [x] Step4：准备各阶段实施后的截图/交互验收表，截图一次集中检查，修复后一轮确认；自动扫描不替代用户路径测试。
- [ ] Step5：提交 `docs: specify responsive UI states and acceptance checklist`，后续实现按此验收。

## 阶段退出标准

四页、登录、引导、草稿、提醒、回顾与社区的行为和状态均能实施；保持原主题，不能只有抽象“精致”“美观”的要求。技能调研见 `docs/research/2026-10-06-frontend-skills.md`。当前已启动本阶段。设计交付检查与用户阶段验收分开，产品功能未因文档完成而实现。

## 当前交付与阶段门槛

- [ ] 设计任务本地交付和技术检查完成（两份说明、代码/浏览器证据、独立审查与Git记录）。
- [ ] 用户已确认页面层级、新增流程及验收表，可以进入阶段1。

本阶段不实施产品UI；现状问题和未来要求见 `docs/design/experience-brief.md`、`docs/design/ui-acceptance.md`。用户要求的新手使用指南已排在阶段5 Task2，区别于阶段3首次三步引导。
