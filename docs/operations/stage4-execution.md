# 阶段4实施恢复入口

本轮用户已批准实施并要求并行、每步≤40分钟、总≤5小时。开始2026-10-07 21:10:13 Asia/Shanghai；本轮最晚结束2026-10-08 02:10:13。最终产品修改截止仍2026-10-08 20:00。

工作树：`.worktrees/stage4`；分支`feature/stage4-community-profiles-nearby`；基线main04ed5c2/source bf7274c/v0.6.2，365项为上轮证据，本轮基线检查另记。不得恢复整批AI用途、隐式健康待办、复制另一套record-fields或放宽私有认证。

设计：`docs/superpowers/specs/2026-10-07-stage4-community-profiles-nearby-design.md`；计划：`docs/superpowers/plans/2026-10-07-stage4-community-profiles-nearby.md`。

详细临时ledger/brief/report仅本plan的`.superpowers/sdd/2026-10-07-stage4-community-profiles-nearby/`。长期日志统一SESSION_LOG；compact后先读本页、ledger最新记录、git status、各worker报告，不重新派已完成任务。

| 步骤 | 当前真实状态 | 责任 |
| --- | --- | --- |
| 1 独立公开服务/资料后端 | 基础及真实双账号通过；技术39m02s，Git收口42m28s超时 | core＋Root |
| 2 头像菜单/个人资料 | 本地与A/B真实页面、头像刷新通过；账号续接审查补丁复验中，完整窗口超40m | Root |
| 3 公开媒体 | 独立复审、真实JPEG字节SHA/删后撤销通过；完整窗口超40m | media＋core |
| 4 互动后端 | 实际A/B帖/评/赞/个人隐藏通过，同城hydrate竞态修复已同步云 | core |
| 5 社区UI | 实际A页面图片发帖刷新/评论通过；独立复审关闭，完整70m超时 | media＋Root |
| 6 全国地域/定位 | 真实目录3573节点/393city级、SDK建议与shared5QPS门槛通过；真实设备GPS未验 | region＋Root |
| 7 宠友发现 | 单元/三宽及外部浏览城市刷新通过；真实SDK opt-in/opt-out通过 | region |
| 8 举报/回顾分享 | 举报队列/个人隐藏真实SDK通过；管理处置、回顾整App及隐藏恢复UI待收口 | region＋Root |
| 9 真实验收/独立审查 | 23:12开始集中收口，目标23:52；formal integration及整App审查进行中 | Root＋reviewers |
| 10 原URL/v0.7.0 | 尚未发布 | Root |

用户40分钟要求部分步骤已超时，如SESSION_LOG记录，不能声称十步都满足；总结束仍02:10:13，不延期。

接口责任：Root独占app.js/index.html/style.css、全局locale、构建/云权限/部署/Git；workers只写指派模块及测试，禁止Git提交/额外子agent，报告包含RED/GREEN命令与时间。共享store与绑定签名先按plan，任何调整先发Root确认并同步ledger。

位置Key/SK已按用户授权存本机私密env600，zshrc已source；工具shell调用前显式source，值不在Git/日志。用户自行建立签名Key/分配已有免费额度，Root仅读浏览器（用户禁止代点击）。四接口各6000/day5QPS已从账户表读回且分配，应用100/day1000/month上限；monthly env1000是应用上限，不称供应商月权益。真实directory+translate+reverse共4上游（最初directory1＋后3验证），未输出坐标或Key。FUJI管理凭证配置可用。A最近20:48:29checkpoint仍需恢复，B邮箱候选用户已提供，待一次OTP，不记录实际地址。

Cloud实际：21:37:20十个新集合deny/publicinvoke并读回，原private/objects/auth不动；paw-community30s首次21:42:31 Active。首次真实SDK返回INVALID_INPUT，安全字段名诊断确认平台附加tcbContext；entry仅移除它，不信任其身份，不放宽payload。临时诊断删除、9entry RED→GREEN；21:48:37最终Active，Root21:49:15匿名profiles/posts空列表成功、匿名save UNAUTHENTICATED、无诊断。所有step1结果见ignored anonymous-real.json及云安全日志；真实A/B资料/发帖与媒体仍待9实际验证。

当前源码尚未发布，package version仍0.6.2。Rootapp已接#profile/menu/独立community identity generation/主题离页/native beforeunload、真实媒体pipeline接口；communityEnabled尚未打开前端构建，等真实匿名SDK门槛后改。媒体worker/regions worker分别写Task5/7，Root共享app/CSS/Git不要回退。Task2四review复现已修，保存中locale最新补为延迟render，scoped DOM需再核。

本轮GitHub只读查证技能仓库star：obra/superpowers296215、anthropics/skills180002、vercel-labs/agent-skills32029（21:10检查点gh API）。每步启动前定位本地对应技能并记录用途，不为凑数安装重复技能。来源：https://github.com/obra/superpowers ；https://github.com/anthropics/skills ；https://github.com/vercel-labs/agent-skills 。

当前尚未完成步骤，不把本地mock或旧验收代勾公开云/实际定位/真实双账号。

23:12续作更新：前述21:49历史段保留证据，当前communityEnabled已打开；最新云paw-community Active22:49:06，zipSHA9e6be688e53a3ec946eb9b0939c6f66cab7a8faa7813463adfe67581f51dc953。完整单元533（下一检查点可能新增）；A/B真实SDK12flag成功；真实profile A/B页面成功、Aavatar owner-read成功；真实UI A post/photo/refresh/comment成功且0pageErrors。完整原健康test_app通过。Root actualauth helper48108已stop，A最近checkpoint原stage2路径600；B新会话已merge同文件，两actor均从这个文件串行恢复，绝不复用旧B/旧验证码。当前私密receipt仅test-results/stage4，后续exactcleanup已知合成profile/post/image/report，不碰健康。

Root最近审查修复：公开草稿queue绑定owner/generation单次消费；A重新登录用户主动取消清handoff；已有有效B授权时await身份协调私有workspace，samehashprofile明确重绘，3 actualsource tests通过。上一次ledger“未恢复A”等是历史，勿照它重新请求OTP。
