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
3. 静态站子路径/缓存：旧浏览器不加载不兼容模块或错误schema。Task 3、4 验证。
4. 宣传文案/指南与实际能力：未接通功能不能说已完成。Task 2、4 验证。
5. 操作失败后回退：恢复已验证版本并维持原URL，不删除健康云端数据。Task 4 验证。

## Task 1 完整浏览器和跨用户验收

**Files:** 修改 `test_app.py`；新增 `tests/e2e/account-flow.py`、`tests/e2e/failure-flow.py`、`docs/verification/final-report.md`；修复被验证发现的具体产品文件，不进行无依据重写。

**Interfaces:** 测试默认访客demo，真实测试需显式传环境和两账号凭证的环境变量。只输出场景/结果与脱敏错误；测试不得向生产写示例群体或删除他人数据。

- [ ] Step 1：写尚缺的浏览器用例，分别确认360/390/768/1440px布局、200%文字、keyboard和reduced-motion；加入登录过期、弱网、AI超时、上传失败、草稿取消、重复完成、记录编辑和两用户共享流程。

新增P3-04的日历兼容验证也归本任务：Apple Calendar、Google Calendar电脑网页、Outlook网页版的导入入口、全天日期、通知及重复/改期行为逐一留证；当前仅Apple实测，不把官方格式支持当作本项目客户端集成已通过。
- [ ] Step 2：运行新用例，确认当前缺失体验出现真实失败；将失败归到具体代码/接口。已可用用例不为制造失败修改正确行为。
- [ ] Step 3：按观察结果修复并保留回归测试；截图一轮集中查看，修复后确认，避免无限视觉调整。
- [ ] Step 4：运行 `npm test`、`npm run build`、demo浏览器测试和云端集成测试；记录真实模型案例、账号隔离、日历导入的实际结果，任何未验证项标明未验证。
- [ ] Step 5：提交 `test: verify complete pet care and community journeys`，记录具体测试证据。

## Task 2 版本新内容、遮罩高亮指南与双语收口

用户已确认每个已发布版本首次访问显示“新内容”，确定后不再自动弹出，帮助可重看；随后首次访客可进入遮罩高亮指引，逐条“下一步/跳过指引”，老用户回原任务。界面/指南双语，用户原文保持。用户明确本session只记录，留本阶段正式实施，技术方案执行前审阅；详见[决策记录](2026-10-06-followup-discussion.md)。

**Files:** 新增`docs/user-guide.md`、`src/features/{help,guided-tour,whats-new}.js`、`src/data/release-notes.js`、`tests/tour.test.js`、`tests/e2e/help-tour.py`；修改`app.js`、`style.css`、中英文词典、`test_app.py`。docs不进Pages白名单。

**Interfaces:** `TourStep={id,targetSelector,route,titleKey,bodyKey}`，步骤只指向实际可用入口；`advanceTour(state,'NEXT'|'SKIP'|'CLOSE')`，跳过/关闭恢复触发焦点，页面变化目标缺失时返回可读帮助，不能挂着遮罩。`shouldShowWhatsNew({releasedVersion,acknowledgedVersion})`，确认记忆按已发布版本及本地用户区分；非已发布开发版本不强制公告。帮助不写库/不切宠物；未保存表单不被覆盖；所有界面和说明两语言词典齐全。

- [ ] Step 1：核心功能范围验收后编写简短指南：示例与个人档案、第一次记录、护理提醒与日历、回顾及确认分享、AI不可用时的手动分支；删去未接通能力的操作承诺。

日历指南纳入P3-04：说明下载ICS后各客户端如何导入、文件导入与同步的区别，默认提醒由客户端配置；未验证客户端明确标注，现阶段不提供订阅URL。
- [ ] Step 2：写版本只弹一次/更新再弹/帮助重看、新内容先于首次指南、遮罩高亮随滚动与resize、下一步/跳过/目标缺失、手机/键盘/焦点恢复和未保存输入保护用例；中英文说明/界面键集合与真实页面覆盖检查；运行`node --test tests/tour.test.js`及help-tour e2e确认缺失真实失败。
- [ ] Step 3：实现常驻帮助、新内容确认、遮罩高亮指引和说明；首次三步建档独立，指引可跳过，不把强制建档作为“下一步”。复用阶段2语言能力，完善后来增加的助手/照片/定位/桌面说明，不翻译用户原文。
- [ ] Step 4：运行新增用例、`npm test`、双语/四宽度浏览器检查；首次体验者按指南完成真实操作，确认公告/指南与实际版本一致。
- [ ] Step 5：提交 `feat: add a reusable beginner guide`，勾选P3-03实际验收项，记录未执行检查。

用户原文：“补一个pending吧，就是加一个新手指引；放在plan后面的某个地方就行，不用着急，可以按照你的想法进行排序”。安排本阶段核心验证后、发版前，不占阶段0实施范围。时间不足时压缩为短步骤说明，不为指南增加新功能。

## Task 3 可安装网页与桌面启动

**Files:** 新增`manifest.webmanifest`、`src/features/install.js`、`tests/install.test.js`、`tests/e2e/install.py`、`docs/operations/desktop-install.md`；按实际平台要求提供图标，必要时增加`service-worker.js`；修改`index.html`、构建白名单与`app.js`。

**Interfaces:** manifest的start_url为`./#home`、scope为`./`，不改变固定/paw-diary/路径；安装入口以实际浏览器能力显示，并提供不支持时的客户端说明。若引入worker，仅缓存公开静态壳，禁止缓存认证/API/AI/健康响应；静态更新需与数据协议兼容，失败保留可回退版本。

- [ ] Step1：正式核对当前浏览器官方安装要求后写manifest子路径/白名单/私有响应不缓存/安装可用与不支持分支/更新兼容测试。
- [ ] Step2：运行`node --test tests/install.test.js`及install e2e，确认能力缺失真实失败。
- [ ] Step3：实现安装入口与实际可安装网页、独立窗口便捷启动，说明其非原生pkg/exe/dmg；未验证离线写入、系统通知不宣称支持。
- [ ] Step4：运行测试与/paw-diary/静态产物检查，在实际桌面浏览器验证安装/启动/更新/卸载；Mac/Windows客户端分别留证，无法实测的环境明确未验证，截图不代替实际安装。
- [ ] Step5：提交`feat: install paw diary for convenient desktop access`。

## Task 4 文档与稳定版本交付

**Files:** `README.md`、`VERSION`、`CHANGELOG.md`、`ROADMAP.md`、`PENDING.md`、`SESSION_LOG.md`、部署运维文档；新增 `docs/demo-guide.md`。

**Consumes:** 已通过的交付范围与final-report。**Produces:** 原URL上的稳定部署、新tag/Release、2–3分钟可执行体验说明。历史候选v0.6.0已发布占用，阶段4已选v0.7.0；阶段5发行号执行前另定，不复用旧tag，不把版本号当完成承诺。

- [ ] Step 1：对照PENDING与验收报告逐项标状态；编写匿名示例→个人建档→AI确认→提醒/日历→回顾→同城分享体验路线，未完成分支从对外路线移除。
- [ ] Step 2：运行 `git diff --check` 与发布产物检查，确认没有密钥或未实现能力声明；检查所需云端配置和实际服务状态。
- [ ] Step 3：在main部署验收过的候选产物；等待工作流成功，使用匿名浏览器验证原URL、静态资源、demo及真实账户流程。若核心失败，先回退稳定前端，再修复，不删除真实云端记录。
- [ ] Step 4：验证通过后更新VERSION/CHANGELOG，创建新annotated tag与GitHub Release，核对远端tag目标、非draft状态与公开链接。文档变更不重复部署应已由第一阶段实现。
- [ ] Step 5：日志记录版本、提交、工作流、验证和限制，本地Git提交干净。检查截止时间有余量，避免以最后一刻部署代替验收。

## 阶段退出标准

固定网页公开可访问，主要流程通过真实验证，说明准确，日志和待办反映实际结果。完整版本可以继续迭代；未完成但已记录的任务不虚标通过。
