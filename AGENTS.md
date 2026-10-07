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

阶段0与阶段1已交付，当前公开版本 **v0.2.0**：V3非破坏迁移、稳定双卡、多宠物卡内切换/添加/拖动及键盘排序、“管理宠物”“管理与导出”、宠物/记录/事项回收站、编辑/护理/完整JSON/CSV/ICS。71项单测、8套静态子路径及8套匿名公开浏览器检查通过，有头桌面/手机截图已检查；详见 `docs/verification/stage1-report.md`。仍仅当前浏览器本地保存与示例社区，登录、云端和AI未接入。

发布事实：v0.2.0 annotated tag指向 `ceed8d3`，与最终Pages部署 `37497726088` 的源码一致；Release已公开、非draft/非prerelease。v0.1.0仍指向 `17cba15`，禁止移动。Release： https://github.com/wenkaiqu014-hue/paw-diary/releases/tag/v0.2.0 。后续文档提交不改变发布源码；本轮结束交接只做本地Git提交，续作先查本地main与origin/main差异，不以reset丢弃尚未推送的交接。

阶段2已由用户授权完整实施和最终修复/发布。实施起点2026-10-07 01:38:46 Asia/Shanghai，八小时目标09:38:46已超出，全项目截止不变。续作继续进入`.worktrees/stage2` / `feat/stage2-local-cloud`，先查当前HEAD和main/origin差异，勿从main旧源码重做或reset。当前发布前技术门槛已通过：246单测无跳过、真实邮箱旧用户登录与真正新用户注册/刷新/重开、A/B健康与媒体隔离、直接DB/对象拒绝、近1MiB私有图、CAS/回执/确认迁移五个真实case全过；15账号契约/6媒体模拟边界通过。当前技术产物app-HUKK2URO/style-E5NM6WZE，本地cloudEnabled=true仅验收，最终hash与公开配置由发布负责人固定复验。v0.3.0尚未合并/推送/tag/Release或公开验收，公开仍v0.2.0。具体证据见docs/verification/stage2-report.md与SESSION_LOG最新段；发布与用户体验确认后按顺序衔接阶段3，本轮不新增AI/真实社区。免登录个人、照片/头像、三空间、确认迁移、仅邮箱方向不重复访谈。

阶段2除原登录/权限/跨设备/头像/确认迁移外，需镜像当前V3生命周期/排序，包含P1-09/P1-10自定义记录/宠物类型、N-06语言基础和N-08当前宠物私有照片墙/可控幻灯片。N-04只读使用帮助/宠物记录助手在阶段3；N-07国内地域搜索/主动辅助定位在阶段4；N-03每版一次新内容、遮罩高亮“下一步/跳过指引”及可安装网页在阶段5。用户要求全部现有想法在最终截止前实现，不能默认移到截止后；原约30小时估计不含新增，不是工期保证。

数据续作：规范键 `paw-diary:v3:demo`，完整snapshot保留deletedAt与回收站，visibleHealth只是派生视图；旧v1/v2原文/备份不可清除，导入不默认复活已删除内容。云端必须保留这些语义并实测可信身份所有权，不能退回V2接口。新版入口/ESM依赖有缓存版本参数，后续发布需保持模块图一致；别因旧缓存界面误判功能缺失。

最近界面反馈：用户要求移除宠物表单“不知道生日时填写估计月龄，不需要虚构实际生日。”，已随v0.2.0上线，不恢复该提示；年龄字段和校验仍保留。

本地main可从 `http://127.0.0.1:4178/` 预览；交接时服务器仍在运行，新session先检查，失效则按README启动。阶段1临时工作树/分支与4191/4192服务已清理，证据在Git忽略的 `test-results/stage1-v0.2.0/`。真实手机软键盘、原生200%缩放、读屏及Google/Outlook实导未验收，留最终阶段；不要把桌面模拟当真机。历史空验收Calendar清理仍未确认，不重复导入或删除其他日程，勿让这一非产品遗留阻断阶段2。

续作先读 `SESSION_LOG.md` 最新阶段与 `PENDING.md` 当前状态，再读总计划 `docs/superpowers/plans/2026-10-06-paw-diary-master.md`。按当次任务进入00–05对应子计划，必要时查 `ROADMAP.md`、`PRODUCT.md`、`DESIGN.md`，不自动通读Daily其他项目、无关旧会话或全部项目历史。

用户专用CloudBase环境固定为`paw-diary-d8g3p4tlsb305221d` / ap-shanghai，已由用户开通个人付费版，文档数据库1、PostgreSQL 0，自动续费与超额按量false；原余额不足订单已关闭，不重复采购、不再等待资金。**后续管理调用固定从`TENCENTCLOUD_FUJI_SECRET_ID` / `TENCENTCLOUD_FUJI_SECRET_KEY`读取**，不用其他个人/集团凭证代替，不回显/提交实际值。合法来源、集合/对象deny与邮箱only已读回；14:24:55–14:25:20曾为匿名拒绝验收临时捕获actor，最终匿名provider已恢复false。身份验证采用可信平台UID与服务端真实OTP证明，不依赖缺省profile布尔、日期或客户端verified声明。新用户省略is_user契约、同用户迟到事件和refresh轮换写回已修复，旧错误仅作历史。操作依据见docs/operations/cloud-setup.md及SESSION_LOG；管理成功仍不能替代新业务的实际用户验收。AI供应商/额度与匿名体验阶段3另定，密钥仅服务端。

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

遵守当前session并发上限。主agent负责整合与实际复验，子agent说“完成”不能替代代码/测试证据。用户没有要求模型覆盖时默认继承当前配置，不自行扩大模型/费用范围。

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

当前原生HTML/CSS/JS经esbuild构建；示例保存在localStorage，免登录个人使用IndexedDB，登录后私有档案经可信身份API访问CloudBase。公开v0.2.0仍是本地版本，候选真实云技术验收通过不等于正式发布。示例标签保留，AI/真实社区未接入。

基础检查 `node --check app.js`、`git diff --check`。当前本机浏览器验证入口：`/Users/wenkaiqu/.codex/skill-runtime/run python -u test_app.py`；线上检查可设置 `PAW_DIARY_TEST_URL`。后续构建/单元测试和真实环境验证按阶段计划更新，本地mock通过不等于实际云端/模型可用。

收费接入前确认供应商、账号和预算。凭证通过 `process.env` / `os.environ` 读取，禁止硬编码、回显或提交。AI密钥仅在服务端。私有数据按可信身份验证所有权，公开资料明确选择后才展示，AI草稿确认后才写库，回顾只能依据真实记录。
