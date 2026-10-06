# 爪爪日记项目协作规则

本文件位于项目根目录 `/Users/wenkaiqu/ClaudeInternal/Daily/paw-diary/`，仅约束本项目，不是 Daily 根目录的通用规则。默认中文协作。

## 项目目标与固定地址

面向养猫狗新手，以「记录 → 提醒 → 成长回顾」为主线，支持同城宠友和社区交流。用户已提交v0.1.0作品；新增能力必须保持提交地址可用。

- 公开仓库：https://github.com/wenkaiqu014-hue/paw-diary
- 评审网页：https://wenkaiqu014-hue.github.io/paw-diary/

保留仓库名、网页域名和路径，不通过另建项目或更换域名替代更新。保留 `#home`、`#health`、`#nearby`、`#community`。不移动已发布tag，后续版本创建新tag。

## 时间限制与阶段安排

用户明确提供的修改截止时间为 **北京时间2026年10月8日20:00（Asia/Shanghai）**。不要重复询问已确认时间，也不要按提交时间重新推算48小时。

建议10月8日14:00冻结新功能，18:00前完成最终部署和匿名验收，18:00–20:00保留修复缓冲。这是项目工作安排，实际完成与剩余工作需如实记录。用户预计投入至少30小时，计划工时不是完成保证。

按六阶段执行：界面设计 → 本地健康闭环 → 登录/云端档案 → AI引导/成长回顾 → 真实社区/同城匹配 → 完整验收/稳定发版。每个阶段独立验收，未通过的能力不对外宣称已完成。时间不足时减少装饰和附加功能，保留数据可靠性、私有权限、健康主线与原链接。

## 当前状态与续作入口

当前阶段1完整本地能力已实现：V3非破坏迁移、双卡管理/排序、回收站、编辑/护理/备份/CSV/ICS；71项单测及8套静态子路径浏览器检查通过。用户已明确授权完整阶段1技术验收后push、创建v0.2.0 tag/Release，已通过公开部署验收，v0.2.0 tag/Release已创建并核对；不重复请求同一发布权限。用户后续体验确认与阶段2启动分开，不能连续实施后阶段。指南/双语/AI/定位/照片墙/桌面安装均按后续计划，指南本session只记录。

续作先读 `SESSION_LOG.md` 最新阶段与 `PENDING.md` 当前状态，再读总计划 `docs/superpowers/plans/2026-10-06-paw-diary-master.md`。按当次任务进入00–05对应子计划，必要时查 `ROADMAP.md`、`PRODUCT.md`、`DESIGN.md`，不自动通读Daily其他项目、无关旧会话或全部项目历史。

云端沿CloudBase候选先验证，个人作品优先个人账号，环境尚未开通，实际平台能力、套餐/收费接入前确认。文本AI免费优先，必要收费先估算再由用户决定；默认有限额体验无需自带Key，自带Key仅为可选后续能力，当前不锁定供应商、模型、端点或收费额度。

## 使用哪些技能

按任务选择技能，不把所有技能一次性加载，不因为增加技能自动重做已有设计。

| 工作 | 技能与使用时机 |
| --- | --- |
| 开始会话与流程选择 | `superpowers:using-superpowers`，按其规则选择本次相关技能 |
| 新需求与设计取舍 | `superpowers:brainstorming`；已确认方向直接复用，不重复访谈。关键决策需压力测试时用 `grilling` |
| 新阶段计划或计划修订 | `superpowers:writing-plans`，写目标、接口、文件、测试、依赖与验收 |
| 主agent执行计划 | `superpowers:executing-plans`，逐任务实施与验证 |
| 子agent实施与独立审查 | `superpowers:subagent-driven-development`；独立任务并行时用 `superpowers:dispatching-parallel-agents` |
| 隔离开发与集成 | `superpowers:using-git-worktrees`；实施完成后按需要用 `superpowers:finishing-a-development-branch` |
| 功能与缺陷的验证 | `superpowers:test-driven-development`，先写能证明行为的失败测试；配置和文档等低影响改动使用适当检查，不制造镜像测试 |
| 调试与代码审查 | `superpowers:systematic-debugging`、`superpowers:requesting-code-review`、`superpowers:receiving-code-review`，按实际问题启用 |
| 完成、提交和发布前 | `superpowers:verification-before-completion`，只有实际验证支持时才声称完成 |
| HTML界面、表单、状态与响应式 | 已有 `impeccable` 为主，继承DESIGN.md；优先清晰、可用和新手体验 |
| UI实施后的审查 | `web-design-guidelines`，补查交互、表单、语义、键盘、响应式与性能；规则冲突时以用户要求和项目视觉为准 |
| 浏览器与产品流程检查 | `webapp-testing`；涉及网站导航/操作自动化时用 `dev-browser` |
| 后续补装技能 | `skill-installer`，只补实际需要的技能，不重复安装已有能力 |

`frontend-design`已在GitHub调研，与Impeccable部分重叠，目前作为参考，不列为必须安装。GSAP、Three.js或重动效技能不是本轮健康工具的前置依赖。

`web-design-guidelines`来源：https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines 。安装位置为 `/Users/wenkaiqu/.codex/skills/web-design-guidelines/`；实际版本和安装证据记录在SESSION_LOG。其他技能位置由当前session技能清单解析，不把另一台机器的绝对路径视为通用依赖。

## Session工具与子agent授权

用户明确授权：**本session在项目范围内可使用各种可用能力，包括派出子agent。** 在已授权任务范围内，可以自主读写文件、运行Shell/代码、联网查证、安装所需技能/依赖、浏览器操作与截图、测试、Git分支/提交/推送、部署验证和版本管理，不为常规可逆操作反复请求同一授权。

该授权涵盖工具与协作方式，不意味着本轮必须开始功能实施，也不替代尚待确认的平台、账号和费用决定。遵守系统/工具实际权限；已经确认的用户偏好跨轮保留。未经用户明确要求不发送邮件、聊天或其他对外消息。

子agent按需要使用，不为形式派工。优先委派边界清楚的代码调查、独立实现或审查；必须给出目标、文件/模块所有权、输入接口、验收和日志回报要求。明确告知worker并非独占代码库，不回退他人修改。共享 `app.js`、业务路由和仓储接口的改动由主agent协调，避免并行冲突。

遵守当前session并发上限。主agent负责整合与实际复验，子agent说“完成”不能替代代码/测试证据。批量spawn后按 `kill-race-dupes` 核对重复子agent，发现重复时清理并记录。用户没有要求模型覆盖时默认继承当前配置，不自行扩大模型/费用范围。

## 完整开发日志维护

用户要求维护完整本地日志，统一追加 `SESSION_LOG.md`。每次有意义的开发、研究、需求变化、子agent协作或部署，至少记录：

1. 用户新增要求、原文含义和已确认决定；区分原始事实与建议。
2. 本次阶段/任务、修改文件、接口/数据迁移和结果。
3. 实际执行的检查/测试命令、退出结果及关键证据；未执行检查写明原因。
4. 遇到的失败、调查到的原因、修复和重新验证结果。
5. 子agent分工、产物、整合与复验结果（如有）。
6. 本地提交、推送、tag/Release、部署工作流和公开访问结果（如有）。
7. 尚未完成、阻塞、风险和明确的下一步。

时间统一Asia/Shanghai，精确时间须来自工具或原始日志。历史记录保留，当时状态与最新状态分清。同步 `PENDING.md` 的实际勾选和总/阶段计划；产品取舍变化同步PRODUCT/ROADMAP，视觉依据变化同步DESIGN，发布同步VERSION/CHANGELOG。

每次结束将日志与必要文档纳入本地Git，保持状态可恢复；是否推送按当前任务范围执行。日志不进入网站发布白名单。禁止记录凭证、完整会话token或真实用户私密内容。

## 验证与数据规则

当前原生HTML/CSS/JS，业务数据保存在localStorage。示例标签保留，不能把本地交互写成云端同步、真实社区或实际AI已接通。

基础检查 `node --check app.js`、`git diff --check`。当前本机浏览器验证入口：`/Users/wenkaiqu/.codex/skill-runtime/run python -u test_app.py`；线上检查可设置 `PAW_DIARY_TEST_URL`。后续构建/单元测试和真实环境验证按阶段计划更新，本地mock通过不等于实际云端/模型可用。

收费接入前确认供应商、账号和预算。凭证通过 `process.env` / `os.environ` 读取，禁止硬编码、回显或提交。AI密钥仅在服务端。私有数据按可信身份验证所有权，公开资料明确选择后才展示，AI草稿确认后才写库，回顾只能依据真实记录。
