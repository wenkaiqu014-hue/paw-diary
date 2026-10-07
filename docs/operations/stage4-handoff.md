# 阶段4新session交接

更新时间2026-10-07。仅整理交接，阶段4尚未实施；不把用户准备开新session当功能已验收。

## 从哪里开始

从项目主目录main开始，先`git status --short --branch`核main/origin差异，保留未提交内容。读本页、SESSION_LOG最新两段、PENDING当前摘要和[阶段4计划](../superpowers/plans/2026-10-06-04-community-nearby.md)，必要时读[总计划](../superpowers/plans/2026-10-06-paw-diary-master.md)。不回旧工作树重做阶段2/3；不全量读旧会话或整个项目日志。

固定仓库与网页保持，保留#home/#health/#nearby/#community；旧tag全部不移动。当前版本v0.6.1 source/tag `52e88ee8f71c6e138ba1795fd0a7319fa60d8a68`，main之后是docs-only交接提交。Pages37617971446成功，2026-10-07 20:01:34收口；Release20:02:15公开、非draft/非prerelease。公开app-JEW3W5XH.js/style-7TVISRAM.css与候选SHA一致。

## 已完成，不能重做或退回

343单测无skip；AI真实模型/确认草稿/三步引导/回顾/只读助手与本地/可信云技术验收，v0.6.*健康修订及原URL真实浏览器通过。用户亲验仍单列，截图模拟不是实际手机。

当前意图规则：record只已发生记录；plan是独立reminder，includeInHealth决定健康待办位置，疫苗/驱虫新计划默认true，其余默认false。普通计划在成长足迹与完整列表标未完成，完成才record；旧关联/未知legacy保留，不猜医疗类别。CSV区分plannedDate与occurredDate，体重统计只实际记录。

四内置weight/vaccine/deworm/daily不可删，新增选择无other，但历史other保留；空间内共用最多3个自定义、book/paw/drop允许重复。超额跨目录合并明确拒绝先调整，不静默删历史。头像三圆/原附件/多宠筛选（默认当前）/整行指针及键盘排序/图库名字与说明分离/完整备份/回收站/双语保留。

日期是native date+等宽空mask，值/原生picker/键盘/限制不改变。取消weight预填，用户名称随type保留；weight名称空值可存默认名。未保存站内关闭确认使用主题dialog；刷新/关页保浏览器安全提示。注意closeModal同步false表示用户确认中，路由/空间/点击续动作有延续逻辑，账号force退出会dismiss旧确认，不能改成无保护直接关闭。

## 服务、凭证和真实会话

沿用CloudBase `paw-diary-d8g3p4tlsb305221d`、ap-shanghai、用户个人付费环境；管理仅TENCENTCLOUD_FUJI_SECRET_ID/KEY。不新采购、不改集团账单。paw-api3秒、paw-auth认证不重写、paw-ai40秒/模型25秒/客户端35秒、paw-files30秒/读取20秒。公开社区业务需新增独立公开投影及服务端权限，不放开私有健康/对象规则。

文本模型固定硅基非Pro Qwen/Qwen2.5-7B-Instruct，供应商Key只本机私密SILICONFLOW_API_KEY及服务端TEXT_AI_API_KEY，不回显/提交。私密env存本机~/.config/paw-diary/secrets.zsh（600）且zshrc只source；新shell未加载时先检测配置是否存在，不打印值。额度：guest3/auth20/IP30/site100每日、site1000每月、CST，失败消耗尝试、无自动收费回退。已实际调用，不等于用户账单/RPM已读回；定位第三方接口与费用另核。

头像/展示图≤1MiB，原图选择≤10MiB；原附件每项3个/单个5MiB、共享50MiB。大附件>1MiB经owner/parent/hash检查后60秒签名URL，客户端bounded fetch核字节，URL不进backup/AI。真实5MiB与原URLChrome2MiB CORS已验。photo displayName纯metadata，不改caption/Blob/SHA/createdAt/fileRef，完整私有备份保留。

私有A会话最近19:31:43.057已refresh checkpoint到Git忽略的 `.worktrees/stage2/test-results/stage2/real-sessions.json`，600；操作已关闭并归还Root，未signOut，下一session先验证能否恢复，不把已过时间当token有效。B旧会话已失效/移除，阶段4必须重新取得第二个真实账户会话，需和用户对齐账号/验证码；不能反复消费旧OTP或用管理身份模拟真实A/B。同一会话同一actor串行、每refresh写回；只清本轮确切receipt合成资源，不按名字/时间窗清用户资料。A剩少量明确合成夹具/回收资源作证据，不代表真实养宠事实。

预览4194/4195/4197/4198/4199均已停止；不能假定旧服务存在。新树用真实npm ci，不用node_modules symlink打公开构件（路径会改变esbuild JS hash）；先查现有端口，按README构建预览。旧工作树只是ignored证据，不清或复制私密会话进Git。

## 阶段4基础工作

1. 真实共享社区：图文发帖/查看/编辑删除、评论/点赞，跨账户读写；作者权限、幂等和纯文本安全。公开昵称由用户选择，不输出邮箱或私有健康数据；公开照片必须主动发布并核公开资源通路，不能复用临时私有URL冒充永久公开图片。
2. 社区闭环：真实/示例区分、空状态、举报入队/个人隐藏及可信处置说明；成长回顾从预览到发布表单，明确确认才公开，默认无健康数值。
3. 同城发现：主动加入/退出公开资料，城市/行政区/猫狗/交流目的组合筛选；国内地域可搜索，用户主动定位只辅助地区填写。目录来源、坐标转地区服务/账号/额度/费用需当次核对，不公开坐标或编造距离、在线状态。
4. 技术退出：两个真实账户发帖/评论/点赞/作者权限/发现退出与匿名公开读实测，旧健康/AI/媒体/双语回归，最后原URL复验。新发行版本号先与用户对齐，旧v0.5.0候选已过期，不提前创建tag。

阶段5仍是指南/每版新内容/PWA、实际手机软键盘/读屏/原生200%/日历实导等，不挪到本轮假完成。全项目固定截止北京时间2026-10-08 20:00，旧各轮10/20/30分钟仅当轮约束，阶段4工时新session另定，不重新推48小时。优先基础用途，不新增私信、语音、商城、精确距离地图或一般诊疗咨询。

用户已授权本项目工具/子agent/浏览器/必要Git与部署，沿已确认方向进展；费用/定位服务、新版本号和新阶段关键产品取舍仍需对齐。不要重复访谈已确认邮箱、本地免登录、三空间、私有资料和AI确认方向。

发行事实：[原网址](https://wenkaiqu014-hue.github.io/paw-diary/)、[v0.6.1 Release](https://github.com/wenkaiqu014-hue/paw-diary/releases/tag/v0.6.1)、[Pages](https://github.com/wenkaiqu014-hue/paw-diary/actions/runs/37617971446)。原始验收与失败过程在SESSION_LOG/各报告及ignored证据。
