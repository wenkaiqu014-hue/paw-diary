# 阶段4实施恢复入口

本轮用户已批准实施并要求并行、每步≤40分钟、总≤5小时。开始2026-10-07 21:10:13 Asia/Shanghai；本轮最晚结束2026-10-08 02:10:13。最终产品修改截止仍2026-10-08 20:00。

工作树：`.worktrees/stage4`；分支`feature/stage4-community-profiles-nearby`；基线main04ed5c2/source bf7274c/v0.6.2，365项为上轮证据，本轮基线检查另记。不得恢复整批AI用途、隐式健康待办、复制另一套record-fields或放宽私有认证。

设计：`docs/superpowers/specs/2026-10-07-stage4-community-profiles-nearby-design.md`；计划：`docs/superpowers/plans/2026-10-07-stage4-community-profiles-nearby.md`。

详细临时ledger/brief/report仅本plan的`.superpowers/sdd/2026-10-07-stage4-community-profiles-nearby/`。长期日志统一SESSION_LOG；compact后先读本页、ledger最新记录、git status、各worker报告，不重新派已完成任务。

| 步骤 | 状态 | 开始/结束 | 责任 |
| --- | --- | --- | --- |
| 1 独立公开服务/资料后端 | 基础验收通过 | 21:10:13 / 21:49:15 | core＋Root，后续双账号整体验收在9 |
| 2 头像菜单/个人资料 | 集成中 | 21:14:18 / —，截止21:54:18 | Root，6model和三宽fixture通过，真实账号待接 |
| 3 公开媒体 | 本地/独立复审通过，真实云待验 | 21:12:48 / —，截止21:52:48 | media＋core复审，31专项GREEN |
| 4 互动后端 | 本地/入口通过，真共享待验 | 21:26:06 / —，截止22:06:06 | core，19专项/41交叉通过 |
| 5 社区UI | 并行实施中 | 21:39:46 / —，截止22:19:46 | media worker，Root接线 |
| 6 全国地域/定位 | 模块/真实供应商通过，云前端待验 | 21:13:41 / —，截止21:53:41 | region＋Root，官方3573节点/393city级 |
| 7 宠友发现 | 并行实施中 | 21:39:55 / —，截止22:19:55 | region worker，Root接线 |
| 8 举报/回顾分享 | 后端/独立复审通过，分享UI待接 | 21:30:18 / —，截止22:10:18 | region＋core复审，12专项GREEN |
| 9 真实验收/独立审查 | 未开始 | — | Root＋fresh reviewer |
| 10 原URL/v0.7.0 | 未开始 | — | Root |

接口责任：Root独占app.js/index.html/style.css、全局locale、构建/云权限/部署/Git；workers只写指派模块及测试，禁止Git提交/额外子agent，报告包含RED/GREEN命令与时间。共享store与绑定签名先按plan，任何调整先发Root确认并同步ledger。

位置Key/SK已按用户授权存本机私密env600，zshrc已source；工具shell调用前显式source，值不在Git/日志。用户自行建立签名Key/分配已有免费额度，Root仅读浏览器（用户禁止代点击）。四接口各6000/day5QPS已从账户表读回且分配，应用100/day1000/month上限；monthly env1000是应用上限，不称供应商月权益。真实directory+translate+reverse共4上游（最初directory1＋后3验证），未输出坐标或Key。FUJI管理凭证配置可用。A最近20:48:29checkpoint仍需恢复，B邮箱候选用户已提供，待一次OTP，不记录实际地址。

Cloud实际：21:37:20十个新集合deny/publicinvoke并读回，原private/objects/auth不动；paw-community30s首次21:42:31 Active。首次真实SDK返回INVALID_INPUT，安全字段名诊断确认平台附加tcbContext；entry仅移除它，不信任其身份，不放宽payload。临时诊断删除、9entry RED→GREEN；21:48:37最终Active，Root21:49:15匿名profiles/posts空列表成功、匿名save UNAUTHENTICATED、无诊断。所有step1结果见ignored anonymous-real.json及云安全日志；真实A/B资料/发帖与媒体仍待9实际验证。

当前源码尚未发布，package version仍0.6.2。Rootapp已接#profile/menu/独立community identity generation/主题离页/native beforeunload、真实媒体pipeline接口；communityEnabled尚未打开前端构建，等真实匿名SDK门槛后改。媒体worker/regions worker分别写Task5/7，Root共享app/CSS/Git不要回退。Task2四review复现已修，保存中locale最新补为延迟render，scoped DOM需再核。

本轮GitHub只读查证技能仓库star：obra/superpowers296215、anthropics/skills180002、vercel-labs/agent-skills32029（21:10检查点gh API）。每步启动前定位本地对应技能并记录用途，不为凑数安装重复技能。来源：https://github.com/obra/superpowers ；https://github.com/anthropics/skills ；https://github.com/vercel-labs/agent-skills 。

当前尚未完成步骤，不把本地mock或旧验收代勾公开云/实际定位/真实双账号。
