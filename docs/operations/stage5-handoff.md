# 阶段5新 session 交接

最新2026-10-08：阶段5已完成两轮Grilling与详细规划；用户明确本轮只做plan、下一轮再实施。先读PENDING、SESSION_LOG最新段、[新版设计](../superpowers/specs/2026-10-08-stage5-guides-install-quality-design.md)及[八任务计划](../superpowers/plans/2026-10-08-stage5-guides-install-quality.md)。目标v0.8.0已确认，当前公开仍v0.7.1；指南/PWA/Windows验收包未生成，Google/Outlook登录和系统版本仍待核。

下文为v0.7.1补丁轮交接背景。原文要求下一session进入最后阶段已由最新规划推进，05四任务旧计划作为历史输入，不能按旧“版本待定”再问一遍。

## 从这里恢复

在项目主目录 `/Users/wenkaiqu/ClaudeInternal/Daily/paw-diary` 的 **main** 开始，先检查 `git status` 与最新 `git log`，再依次读本页、PENDING当前摘要、SESSION_LOG最新段、[v0.7.1补丁报告](../verification/region-picker-v071-report.md)、[阶段5计划](../superpowers/plans/2026-10-06-05-quality-release.md)。需要社区/身份背景时定向读[阶段4报告](../verification/stage4-report.md)和[社区运维](community.md)，不要把全部旧历史读入或回旧工作树实施。

公开唯一基线 **v0.7.1**，源码/tag解引用 `0a1b2eabefb5d8af60c9aa19c1b603c8a16ce004`；Release北京时间2026-10-08 11:48:44，Pages37723735372 success。公开app-CO2I3K3F.js、style-P6JZ3ZBI.css SHA与main全新npm ci构建一致。main之后已有文档提交，不能为对齐tag把main reset回源码。旧tags保留。

- 仓库：https://github.com/wenkaiqu014-hue/paw-diary
- 原体验地址：https://wenkaiqu014-hue.github.io/paw-diary/
- Release：https://github.com/wenkaiqu014-hue/paw-diary/releases/tag/v0.7.1

最终修改截止保持 **2026-10-08 20:00 Asia/Shanghai**。既有建议14:00冻结新功能、18:00完成部署、18:00–20:00修复缓冲不是完成保证；按新session实际工具时间安排。上一轮十步40分钟／五小时要求曾违约，日志已记录，不机械作为新阶段时限，也不能说它已满足。

## 已交付，不要回退或重做

阶段4已真实完成账号级公开资料、头像菜单/#profile、真实社区图文/评论/期望状态点赞、两页全部／同城/目的筛选、主动加入退出发现、真实全国地域与点击定位确认、举报入队/可信人工下架和本人隐藏恢复、简短回顾确认分享。邮箱只本人可见；公开头像与私有宠物头像分开；健康/附件/照片/完整AI故事不自动公开。匿名公共读不依赖启用匿名provider。私信、精确距离与地图不在确认范围。

v0.7.1是用户亲验修订：删除公共社区／宠友“看看内容示例”，首页/健康的示例档案仍保留；删除顶部独立城市搜索，搜索在城市菜单展开后首行，200ms自动查，IME/迟到结果/分页/选中城市保留；行政区选项仅内层滚，父dialog高度/scrollHeight/scrollTop不变。首页相关文案已同步，勿恢复旧独立搜索、示例区或scrollIntoView滚祖先。

定位修复包括默认必填visitorId、稳定localStorage/内存恢复，以及限流同事务并行tx.get引起的TransactionBusy，现顺序读取全部→统一校验→顺序写入。不要恢复Promise.all。Root真实桌面原生Chrome得到坐标且真实CloudBase→腾讯地区建议返回确认按钮；这不等于真实手机GPS已通过。权限/浏览器获取失败/服务/目录/额度错误已分清。所有临时诊断/测试配额引用和响应字段均删除，最终paw-community11:47:23 Active。

阶段3v0.6.2语义保留：AI和手动共用record-fields/record-type-picker，每条独立record或plan；已发生只成长记录，计划为reminder，includeInHealth只计划使用，新疫苗/驱虫默认true、其余false，用户显式选择保留。混合entries.saveBatch原子1–5项；未知类型/模糊日期等待核对。不要恢复整批用途、标题预填、隐式健康待办或未来记录。

## 已验证与仍待验证

最新552/552单元，0fail/skip；真实A/B/匿名共享14项、公开JPEG字节/引用撤销、作者权限/账号隔离、真实报告下架/个人隐藏恢复、回顾取消0帖/最终1帖有证据。原URL三宽双语/键盘/保稿/真实手选、原健康8组回归和桌面原生定位过；main与公开模块图/hash一致。

合成公开profile/帖子/图片已按确切receipt清理，验收时真实公开列表为空；后续用户内容不可当夹具删除。原私有健康/照片没清理。独立审查0剩余Critical/Important不替代亲验。

未完成：使用指南与版本新内容、遮罩指引、PWA；真实手机软键盘/GPS、200%原生缩放、读屏；Google/Outlook实际日历导入及重复/改期；用户完整亲自体验。旧Apple Calendar已有导入证据，但历史空测试Calendar的清理未确认，不擅删其他日程、不反复导入。详calendar-clients.md。

## 最后阶段四个任务

1. 完整体验与边界验收：360/390/768/1440、真实手机/缩放/读屏、长文本/大量记录、登录过期/弱网/上传和AI失败、账户切换/草稿保护；只修观察到的问题；日历各客户端实导留证。
2. 新手帮助、新内容和双语：已确认常驻帮助可重看；每已发布版本首次新内容确认后不再自动弹，更新再弹；新内容后可进入可跳过/重看的遮罩高亮指引。独立于现有三步建档，目标缺失有帮助回退，滚动/resize/焦点/未保存输入不受破坏。技术细节新session先对齐并审阅修订计划，勿重复问已确认方向。
3. PWA可安装网页：保原/paw-diary/子路径，桌面图标/独立窗口，实际安装/启动/更新/卸载；按平台验证。若引入worker，仅缓存公开静态壳，禁止缓存认证/API/AI/健康响应。原生安装包、离线写入、系统通知没有现成验收或自动承诺。
4. 稳定发版：冻结验收范围、准确指南/README/2–3分钟体验路线、完整final-report、回退说明；原URL真实验证后创建新tag/Release。用户“本轮只0.7.1不要0.8”针对本次补丁；最后阶段发行号须另外对齐，不能直接定0.8，也不能移动/覆盖0.7.1。

## 账号、成本与操作保护

CloudBase固定 `paw-diary-d8g3p4tlsb305221d`/ap-shanghai；管理只用TENCENTCLOUD_FUJI_SECRET_ID/KEY，不替换集团或其他个人身份。现个人付费环境已开，不重复采购。所有集合/对象deny、私有函数auth、匿名provider=false保留，公开入口仅已验证的paw-community/paw-auth/paw-ai边界。

A/B原600会话在 `.worktrees/stage2/test-results/stage2/real-sessions.json`，两键均已真实建立；最近原URL复验后均stop写回。新session先验证恢复，不能假定仍有效；同actor SDK/GUI刷新串行，每次及时写回。阶段4工作树旧B副本可能落后，不拿它覆盖原文件。禁止回显/提交token、邮箱、验证码；需要新OTP才按当次实际协作，不重复消费旧码。

腾讯位置Key/SK在本机600 `~/.config/paw-diary/secrets.zsh`，zshrc有source；工具shell必要时静默source后从env读取PAW_LBS_KEY/SECRET_KEY，服务端唯一使用，不放前端。供应商当次账户相关接口6000/day、Key5QPS，应用100/day1000/month共享保守4/s，visitor5/day、可信IP10/day。失败尝试也计数；本日连续调试已使本机IP接近上限，别无目的反复真定位，额度提示不等于Key没额度或应充值。自身两次调试占用的确切清理已完成，不能将它变成泛用重置/绕过接口。没有新增采购，不承诺整站账单0元；完整商业FAQ读取失败的边界保留。

AI沿硅基非Pro Qwen/Qwen2.5-7B-Instruct，访客3/day、登录20/day及站点/IP限制；新验证只按需要真实调用，不能重复消耗请求或默认改供应商/集团账单。

## 产物与开发方式

先检查服务，不假定旧端口还运行。本轮4231已停止、浏览器测试context均关闭；用户LBS窗口只读限制保留，勿代操作/关闭。stage4工作树保留唯一忽略证据，不force清理。新实施可创建新的隔离工作树，默认继承模型；按项目授权用子agent并明确共享文件所有权，Root协调app/style/仓储/发布。

本地npm ci/npm test/npm run build、node --check app.js/git diff --check；有头浏览器用skill-runtime/run python。地域专测tests/e2e/region-picker-dropdown.py，公共整App tests/e2e/stage4.py，真实账号helper tests/e2e/cloud-auth-real.py。正式community集成需真实600会话及预先设置测试公开昵称，缺会话FAIL不skip；匿名/fixture/管理身份均不代真实主体。日志继续追加SESSION_LOG，状态和计划按实际勾选，文档不进dist。docs-only收口推送不会触发Pages，已有路径过滤；业务变更必须重新核构件与原URL。
