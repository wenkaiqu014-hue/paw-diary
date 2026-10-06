# 完整体验验证与评审发版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在原评审地址交付说明真实、流程完整、可以回退的稳定版本。

**Architecture:** 功能阶段各自验证，最终对已选交付范围做完整集成检查。测试浏览器、真实测试账号和公共访客分开，测试产物不发布。候选版本先验收再创建新tag，不以提交代码成功代替用户体验完成。

**Tech Stack:** node:test、Python Playwright、已部署云端集成测试、GitHub Pages/Actions、Git tags/releases。

**Spec:** `ROADMAP.md` §6–7；`PENDING.md` P3；本系列阶段0–4；用户追加的可再次打开的新手使用指南。

## Global Constraints

- 保持固定URL，不移动`v0.1.0`及之后已发布tag。
- 只发布已验收能力；未完成项继续保持unchecked并在说明中明确。
- 功能范围先冻结，再部署验证；截止为北京时间2026年10月8日20:00；不能仅凭计划写“截止前已完成”。
- 文档、测试、后端或密钥不进入前端dist；日志持续记录。
- 不以预置账号数据或本地mock测试冒充真实云端/模型验证。

## Review Focus

1. AI/云端不可用时：演示和手动录入仍可体验，输入不丢失。Task 1 验证。
2. 手机键盘与长中文：对话框保存按钮可达，导航不遮住末尾操作。Task 1 验证。
3. 静态站子路径/缓存：旧浏览器不加载不兼容模块或错误schema。Task 3 验证。
4. 宣传文案/指南与实际能力：未接通功能不能说已完成。Task 2、3 验证。
5. 操作失败后回退：恢复已验证版本并维持原URL，不删除健康云端数据。Task 3 验证。

## Task 1 完整浏览器和跨用户验收

**Files:** 修改 `test_app.py`；新增 `tests/e2e/account-flow.py`、`tests/e2e/failure-flow.py`、`docs/verification/final-report.md`；修复被验证发现的具体产品文件，不进行无依据重写。

**Interfaces:** 测试默认访客demo，真实测试需显式传环境和两账号凭证的环境变量。只输出场景/结果与脱敏错误；测试不得向生产写示例群体或删除他人数据。

- [ ] Step 1：写尚缺的浏览器用例，分别确认360/390/768/1440px布局、200%文字、keyboard和reduced-motion；加入登录过期、弱网、AI超时、上传失败、草稿取消、重复完成、记录编辑和两用户共享流程。

新增P3-04的日历兼容验证也归本任务：Apple Calendar、Google Calendar电脑网页、Outlook网页版的导入入口、全天日期、通知及重复/改期行为逐一留证；当前仅Apple实测，不把官方格式支持当作本项目客户端集成已通过。
- [ ] Step 2：运行新用例，确认当前缺失体验出现真实失败；将失败归到具体代码/接口。已可用用例不为制造失败修改正确行为。
- [ ] Step 3：按观察结果修复并保留回归测试；截图一轮集中查看，修复后确认，避免无限视觉调整。
- [ ] Step 4：运行 `npm test`、`npm run build`、demo浏览器测试和云端集成测试；记录真实模型案例、账号隔离、日历导入的实际结果，任何未验证项标明未验证。
- [ ] Step 5：提交 `test: verify complete pet care and community journeys`，记录具体测试证据。

## Task 2 可再次打开的新手使用指南

新增候选N-03：用户提出指南前显示全站遮罩及版本“新内容”弹窗，点击确定；展示频率/再次查看待讨论。本任务原“指南不强制弹出”不等于否定独立版本说明，两者分别处理，未确认前不实现。N-06双语同样尚未纳入本任务；详见[讨论登记](2026-10-06-followup-discussion.md)。

**Files:** 新增 `docs/user-guide.md`（编写依据，不进入Pages白名单）；修改 `app.js` 的帮助入口与既有dialog；必要时将内容组件放入 `src/features/help.js`；扩展 `test_app.py`。

**Interfaces:** 复用当前四个hash和原生dialog，帮助打开不切换宠物/账户、不触发保存；关闭恢复原页/触发控件。存在未保存表单时先明确继续编辑或放弃，不用另一个dialog静默覆盖原输入。文本按实际可用能力生成，不要求先配API Key。

- [ ] Step 1：核心功能范围验收后编写简短指南：示例与个人档案、第一次记录、护理提醒与日历、回顾及确认分享、AI不可用时的手动分支；删去未接通能力的操作承诺。

日历指南纳入P3-04：说明下载ICS后各客户端如何导入、文件导入与同步的区别，默认提醒由客户端配置；未验证客户端明确标注，现阶段不提供订阅URL。
- [ ] Step 2：先写浏览器用例并确认缺失入口失败：匿名首次访客打开/关闭、老用户重新打开、手机与键盘阅读、健康页帮助返回原路由、已有未保存输入不被丢弃。
- [ ] Step 3：实现常驻“使用指南”入口与轻量内容，首次三步建档引导保持独立；指南不阻断主线、不强制弹出、不重做页面视觉。
- [ ] Step 4：运行新增用例、`npm test`及demo浏览器测试；由用户或首次体验者按指南完成一条真实操作，并检查说明与最终交付范围一致。
- [ ] Step 5：提交 `feat: add a reusable beginner guide`，勾选P3-03实际验收项，记录未执行检查。

用户原文：“补一个pending吧，就是加一个新手指引；放在plan后面的某个地方就行，不用着急，可以按照你的想法进行排序”。安排本阶段核心验证后、发版前，不占阶段0实施范围。时间不足时压缩为短步骤说明，不为指南增加新功能。

## Task 3 文档与稳定版本交付

**Files:** `README.md`、`VERSION`、`CHANGELOG.md`、`ROADMAP.md`、`PENDING.md`、`SESSION_LOG.md`、部署运维文档；新增 `docs/demo-guide.md`。

**Consumes:** 已通过的交付范围与final-report。**Produces:** 原URL上的稳定部署、新tag/Release、2–3分钟可执行体验说明。最终候选版本建议`v0.6.0`，阶段有删减时按实际功能命名，不把版本号当完成承诺。

- [ ] Step 1：对照PENDING与验收报告逐项标状态；编写匿名示例→个人建档→AI确认→提醒/日历→回顾→同城分享体验路线，未完成分支从对外路线移除。
- [ ] Step 2：运行 `git diff --check` 与发布产物检查，确认没有密钥或未实现能力声明；检查所需云端配置和实际服务状态。
- [ ] Step 3：在main部署验收过的候选产物；等待工作流成功，使用匿名浏览器验证原URL、静态资源、demo及真实账户流程。若核心失败，先回退稳定前端，再修复，不删除真实云端记录。
- [ ] Step 4：验证通过后更新VERSION/CHANGELOG，创建新annotated tag与GitHub Release，核对远端tag目标、非draft状态与公开链接。文档变更不重复部署应已由第一阶段实现。
- [ ] Step 5：日志记录版本、提交、工作流、验证和限制，本地Git提交干净。检查截止时间有余量，避免以最后一刻部署代替验收。

## 阶段退出标准

固定网页公开可访问，主要流程通过真实验证，说明准确，日志和待办反映实际结果。完整版本可以继续迭代；未完成但已记录的任务不虚标通过。
