# 爪爪日记项目协作规则

本文件位于项目根目录 `/Users/wenkaiqu/ClaudeInternal/Daily/paw-diary/`，仅约束本项目，不是 Daily 根目录的通用规则。默认中文协作。

## 项目目标与固定地址

面向养猫狗新手，以「记录 → 提醒 → 成长回顾」为主线，支持同城宠友和社区交流。用户已提交v0.1.0作品；新增能力必须保持提交地址可用。

- 公开仓库：https://github.com/wenkaiqu014-hue/paw-diary
- 评审网页：https://wenkaiqu014-hue.github.io/paw-diary/

保留仓库名、网页域名和路径，不通过另建项目或更换域名替代更新。保留 `#home`、`#health`、`#nearby`、`#community`。不移动已发布tag，后续版本创建新tag。

README面向首次访问仓库的用户，作为产品介绍与体验入口：标题下直接放公开体验网址，先介绍产品用途和体验步骤，只保留最新版能力。版本、技术、验收与补充说明放在后半部分；阶段历史和内部交接留专门文档，不重新占据README开头。来源：用户2026-10-07对README的明确要求。

## 时间限制与阶段安排

用户明确提供的修改截止时间为 **北京时间2026年10月8日20:00（Asia/Shanghai）**。不要重复询问已确认时间，也不要按提交时间重新推算48小时。

建议10月8日14:00冻结新功能，18:00前完成最终部署和匿名验收，18:00–20:00保留修复缓冲。这是项目工作安排，实际完成与剩余工作需如实记录。用户预计投入至少30小时，计划工时不是完成保证。

按六阶段执行：界面设计 → 本地健康闭环 → 登录/云端档案 → AI引导/成长回顾 → 真实社区/同城匹配 → 完整验收/稳定发版。每个阶段独立验收，未通过的能力不对外宣称已完成。时间不足时减少装饰和附加功能，保留数据可靠性、私有权限、健康主线与原链接。

## 当前状态与续作入口

用户指定v0.6.1最新补丁：source/tag52e88ee8f71c6e138ba1795fd0a7319fa60d8a68，Pages37617971446成功20:01:34收口，公开app-JEW3W5XH.js/style-7TVISRAM.css与本地SHA一致。343单测/原URL1440/390真实操作通过：无体重预填、用户名称跨type保留、主题站内discard确认/继续/Esc/确认关闭/无native confirm。浏览器刷新/关页仍保beforeunload安全保护，不能自绘。旧记录已有标题照常显示，weight空名可保存默认名；其它继承v0.6.0，旧tags不动，不再按旧自动预填规则续作。

当前最终v0.6.0：source/tag e917ae68736fb530a3e5cf16d2952570a9b9d9ce，Pages37615281921于19:37:21完成，Release19:39:41公开；app-CM3CZ744.js/style-UOJBG5XR.css原URL SHA与全新npm ci本地构件一致。343单测/原URL三宽0错误、真实云分类和photo name/archive通过。reminder.includeInHealth optionalbool，plan新vax/deworm默认true其余false；普通计划以未完成标记在成长足迹/完整列表，不能生成未来record。旧关联/未知类型保health、不根据名字猜；photo displayName独立caption，只改metadata。所有date输入用native加等宽空mask，保原生值/选择/键盘。API/files/AI已同步新schema/facts，A最后19:31:43.057已600 checkpoint归还，无验证码/model新请求；下一步main与阶段4，亲验/真机仍独立待项。下方v0.5.*为历史，最新执行见final-growth报告及SESSION_LOG。

最终最新v0.5.2，source/tag f93784da10a95b09e8d5472bbb1eb4e309790688，Pages37610740744于18:57:15完成，Release18:59:00公开；app-27BPJ62W.js/style-XRVVHCCW.css原URL实际hash匹配，329单测/原URL三宽真实UI验收。用户18:43轮最新确认**record仅成长记录、plan仅待办**，移除同时加入/下次日期；旧关联仍保留，AI不隐式建待办。新增类型五行与三圆icon-only、原地管理/plus、文件选择按钮和三卡字体统一已交付，不能按旧spec恢复checkbox。当前轮20分钟从18:43:25计，到Release15分35秒，文档随后收口；下方v0.5.1/v0.5.0是历史，详SESSION_LOG。没有新模型调用、后台部署或收费采购，旧tags不动；继续阶段4/5与用户亲验。

当前最终公开版本v0.5.1，修复v0.5.0自定义select的程序赋值显示同步：source/tag b25dae8552535da6a96e86a8bf2fa657c40b3e2b，Pages37608531673于18:36:58完成，Release18:38:17公开；app-WMRLVTH5.js/style-WACPJKHL.css真实hash与本地一致。325单测、原URL两处语言显示/模式保留/标题focus复验通过。完整修订能力和v0.5.0历史见下段，旧tag不动，docs-only收口不重发应用。A最后18:32:26.044已checkpoint原600会话并关闭操作；公开Chrome匿名跨域实际读2MiB签名文件hash通过，先前真实5MiB Node生产client边界也通过。下一步仍阶段4及用户亲验，不重做已交付功能。

最新修订v0.5.0已在原URL发布：325单测与实际本地/可信云验证，统一record/plan、3个自定义目录/可重复图标、三圆头像、原附件及整行排序/多宠当前默认。Pages37607465744源码17f7861、公开app-N5WIUUE5.js/style-WACPJKHL.css与本地一致；v0.5.0 tag017d813为相同业务源码加一份测试修订，Release18:29:34公开。old tags均保留。详情docs/verification/record-workflow-report.md和SESSION_LOG最新段，下面v0.4.0段是阶段3基础交付历史。附件paw-files30秒/读取20秒，>1MiB用60秒签名下载避免6MB响应限制；每项3个/单个5MiB/shared50MiB，URL不进入backup/AI。目录跨空间合并超3个明确拒绝先调整，未做专用活跃选择面板。真实模型日期缺失时需手动补填草稿，不能当自动提取成功。下一轮从main与阶段4入口续作，用户亲验/真机待项继续单列。

阶段3本地、真实云端及原URL技术验收已完成，**v0.4.0已正式发布**。真实硅基模型为非Pro `Qwen/Qwen2.5-7B-Instruct`，三类生成已真实调用；独立paw-ai 40秒、模型25秒，密钥仅服务端。292/292单测最终复验通过、无跳过，主目录main与实施工作树均已验证，实际命令与结果由主agent记录；本地完整AI流程及真实A私有批次/引导/回顾保存刷新、助手来源与切本地清上下文已有证据，详见`docs/verification/stage3-report.md`。用户亲自体验仍待单独确认。

阶段3源码/tag为d6c300538fbacb481e30e4e401e022591855cdf6；Pages37597581632成功，17:00:46部署；17:03:26 Release公开且非draft/非prerelease，公开app-2DXPBSHL.js/style-4KEKH45N.css与本地SHA一致、enabled/aiEnabled=true。旧v0.3.0源码/tag为4d7f2e956e8c95250549e3e07ba84bd1742368e6，旧v0.2.0为ceed8d3、v0.1.0为17cba15，禁止移动。发布后下一轮从主目录main的SESSION_LOG最新段、PENDING与`docs/superpowers/plans/2026-10-06-04-community-nearby.md`开始，不回旧stage2工作树重做业务。用户亲自体验、阶段5真机/读屏/日历实导仍未勾。

本轮15:27:31开始、总四小时目标19:27:31，用户要求每步≤1小时、只做基本用途；阶段7独立审查/集中修复15:49–16:51已超过单步一小时，必须如实报告，最终截止仍2026-10-08 20:00。

### 阶段3新session交付范围与注意事项

2026-10-07阶段3新session已完成首轮grill和定向调查。用户六项按建议：免登录少量真实AI/登录更多，AI开发验收≤20元/上线≤20元月预算，非强制可恢复三步，最近7/30天及自选温暖回顾，页面内短对话助手，保留视觉调整首页；追加同行卡片尽量等宽。随后选择硅基免费优先并准备实名账号/Key，DeepSeek本轮不调用。最新入口为`docs/superpowers/specs/2026-10-07-stage3-ai-growth-design.md`和`docs/superpowers/plans/2026-10-07-stage3-ai-growth.md`；旧03计划仅历史初稿。新方案独立paw-ai、访客显式本地输入/登录授权来源、现有仓储确认写入、不新增ai_drafts/向量库；本轮已锁定非Pro Qwen/Qwen2.5-7B-Instruct并完成真实smoke、模型功能和云权限验收；未读回精确RPM/TPM与账单，不称账单0元。主agent统一app.js/布局/接口/部署，按独立模块委派，不重做阶段2认证。下方原交接保留历史背景，冲突以本段和新版设计/计划为准。

用户在v0.3.0交付后回复“ok”，明确准备新开session进入阶段3。当时只整理交接、不开始AI实施；此为历史背景，现阶段3已实施发布。该回复不等于用户亲自完成所有验收。阶段3沿既有计划交付五项：服务端真实文本模型与限额/失败回退；自然语言录入的可编辑草稿及确认保存；可恢复的建档→首笔记录→提醒三步引导；依据当前宠物真实记录的成长回顾与分享预览；网站使用帮助/当前宠物记录的只读浮动助手。成长首页基础页面已存在，阶段3接入个人引导、实际记录与成长回顾，复用现有视觉，不重新设计整站。真实社区与同城匹配在阶段4，遮罩使用指南/每版新内容/可安装网页及最终真机验收在阶段5。

先核供应商、文本模型/API、实际免费额度与限流，再给必要收费估算让用户决定；不默认复用MiniMax语音Key、不用集团账单、不未经确认开收费服务。默认有限额体验不要求自带Key；免登录AI额度与请求/资料边界已由阶段3实际验收落实，不因已有免登录本地记录就自动开放匿名云业务。密钥只在服务端。原paw-api运行时超时3秒，不能直接照搬计划的模型30秒等待；新session实施前核对独立AI函数或运行时配置及费用取舍，不为此重写已验收认证。

AI解析、助手提问、取消和分享预览均不直接写库或公开；用户确认后才保存，数字由代码计算，引用来自授权的实际记录，排除回收站；无记录、超时或额度耗尽时有明确说明与手动路径。切宠物/账号清理旧上下文，保留V3生命周期、排序、自定义类型、媒体与双语。真实模型smoke已通过，原URL验收通过后再发布v0.4.0，不把mock当AI接通，不提前创建tag。

完整开发/审查/子agent/失败与重新验证/提交部署记录统一在SESSION_LOG；专题验收见docs/verification/stage1-report.md、stage2-report.md，登录专项审查及修复见docs/superpowers/plans/2026-10-07-stage2-auth-recovery.md。原始截图/日志与私密会话在旧.worktrees/stage2/test-results/stage2（Git忽略），仅必要时定向查，不全量复制到新上下文。B验收后已经退出、失效token移除，不把旧会话文件当双账号均可恢复；需要真实认证时遵守最新会话轮换写回，禁止日志输出会话或反复消费旧验证码。A里留有明确标注的纯合成验收宠物/记录/PNG，仅本轮重复夹具移回收站，不把它当用户实际养宠事实。

数据续作：规范键 `paw-diary:v3:demo`，完整snapshot保留deletedAt与回收站，visibleHealth只是派生视图；旧v1/v2原文/备份不可清除，导入不默认复活已删除内容。云端必须保留这些语义并实测可信身份所有权，不能退回V2接口。新版入口/ESM依赖有缓存版本参数，后续发布需保持模块图一致；别因旧缓存界面误判功能缺失。

最近界面反馈：用户要求移除宠物表单“不知道生日时填写估计月龄，不需要虚构实际生日。”，已随v0.2.0上线，不恢复该提示；年龄字段和校验仍保留。

本地main按README构建/启动预览；新session先检查现有服务，不假定历史4178服务仍运行。阶段1临时工作树/分支与4191/4192服务已清理，证据在Git忽略的 `test-results/stage1-v0.2.0/`。真实手机软键盘、原生200%缩放、读屏及Google/Outlook实导未验收，留最终阶段；不要把桌面模拟当真机。历史空验收Calendar清理仍未确认，不重复导入或删除其他日程，勿让这一非产品遗留阻断阶段2。

续作先读 `SESSION_LOG.md` 最新阶段与 `PENDING.md` 当前状态，再读总计划 `docs/superpowers/plans/2026-10-06-paw-diary-master.md`。按当次任务进入00–05对应子计划，必要时查 `ROADMAP.md`、`PRODUCT.md`、`DESIGN.md`，不自动通读Daily其他项目、无关旧会话或全部项目历史。

用户专用CloudBase环境固定为`paw-diary-d8g3p4tlsb305221d` / ap-shanghai，已由用户开通个人付费版，文档数据库1、PostgreSQL 0，自动续费与超额按量false；原余额不足订单已关闭，不重复采购、不再等待资金。**后续管理调用固定从`TENCENTCLOUD_FUJI_SECRET_ID` / `TENCENTCLOUD_FUJI_SECRET_KEY`读取**，不用其他个人/集团凭证代替，不回显/提交实际值。合法来源、集合/对象deny与邮箱only已读回；14:24:55–14:25:20曾为匿名拒绝验收临时捕获actor，最终匿名provider已恢复false；临时readiness于14:41:55删除并读回公共规则移除。身份验证采用可信平台UID与服务端真实OTP证明，不依赖缺省profile布尔、日期或客户端verified声明。新用户省略is_user契约、同用户迟到事件和refresh轮换写回已修复，旧错误仅作历史。操作依据见docs/operations/cloud-setup.md及SESSION_LOG；管理成功仍不能替代新业务的实际用户验收。AI采用硅基非Pro Qwen/Qwen2.5-7B-Instruct；访客3次/日、登录20次/日及站点/IP限额由服务端执行，密钥仅paw-ai。

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

当前原生HTML/CSS/JS经esbuild构建；示例保存在localStorage，免登录个人使用IndexedDB，登录后私有档案经可信身份API访问CloudBase。公开v0.4.0的邮箱私有云及AI已上线并验收，用户亲自体验仍待确认。示例标签保留，真实AI已接通，真实社区待阶段4。

基础检查 `node --check app.js`、`git diff --check`。当前本机浏览器验证入口：`/Users/wenkaiqu/.codex/skill-runtime/run python -u test_app.py`；线上检查可设置 `PAW_DIARY_TEST_URL`。后续构建/单元测试和真实环境验证按阶段计划更新，本地mock通过不等于实际云端/模型可用。

收费接入前确认供应商、账号和预算。凭证通过 `process.env` / `os.environ` 读取，禁止硬编码、回显或提交。AI密钥仅在服务端。私有数据按可信身份验证所有权，公开资料明确选择后才展示，AI草稿确认后才写库，回顾只能依据真实记录。
