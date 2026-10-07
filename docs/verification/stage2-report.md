# 阶段2验收报告与发布状态

阶段2技术交付与v0.3.0正式发布已完成，固定[公开站](https://wenkaiqu014-hue.github.io/paw-diary/)已启用邮箱登录及私有云档案。main合并并推送的发行源码为`4d7f2e956e8c95250549e3e07ba84bd1742368e6`，原[Pages工作流37583390404](https://github.com/wenkaiqu014-hue/paw-diary/actions/runs/37583390404)成功，部署步骤完成于2026-10-07 14:46:53 Asia/Shanghai。v0.3.0 tag指向该源码，[Release](https://github.com/wenkaiqu014-hue/paw-diary/releases/tag/v0.3.0)于14:48:48公开，非draft、非prerelease；旧v0.2.0/ceed8d3与v0.1.0/17cba15保持不动。

实施起点2026-10-07 01:38:46，原八小时目标09:38:46已超出，不把目标写成按时完成。全项目修改截止仍为2026-10-08 20:00。正式产物为`app-QWW76HLZ.js` / `style-E5NM6WZE.css`，公开配置enabled=true。业务已经合并至主目录main；旧`.worktrees/stage2`保留实施与Git忽略证据，下一轮从主目录main读取[阶段3计划](../superpowers/plans/2026-10-06-03-ai-onboarding-recaps.md)。用户亲自体验确认尚未完成，不以助手技术验收代替。后续纯文档提交不改变tag的发行源码，也不触发Pages重新部署。

## 已发布能力

不登录可创建自己的本地宠物档案，示例、个人与云端资料分开。支持多宠切换与排序、自定义宠物/记录类型、护理事项、编辑及回收站、头像、当前宠物照片墙、主动播放的幻灯片和中英文切换。示例仍使用规范键`paw-diary:v3:demo`，个人资料使用独立IndexedDB；旧v1/v2原文与备份保留。

邮箱验证码登录后使用自己的私有云档案。登录不自动上传本地资料，迁移先选择来源、查看预览、再明确确认。完整JSON备份包含照片与头像，恢复不默认复活已删除内容；损坏档案全量恢复另行确认，保留原坏资料与媒体。健康CSV与ICS维持可见数据语义。AI、真实社区、微信及手机号登录未接入。

## 真实邮箱与私有云门槛

本轮真实网页登录完成受控账号A的已有用户登录，以及受控账号B的真正新用户注册；两者均完成刷新、关闭重开和会话恢复，B另完成退出返回本地个人空间；SDK身份不同，页面未捕获错误为0。来源为发布负责人本轮受控浏览器执行记录，脱敏摘要保存在旧实施工作树的`test-results/stage2/auth-real-ui-report.json`（Git忽略）；本报告表中同目录证据均位于`.worktrees/stage2/`下，详情追加至[SESSION_LOG](../../SESSION_LOG.md)。报告不记录邮箱地址、验证码、UID或token。旧`final-real-browser.log`保留的是先前会话安装失败，不能拿该历史失败日志当本轮通过证据。

五个真实集成用例全部通过，无跳过。测试由独立真实SDK用户调用，管理凭证仅核对环境及测试夹具，不代替访问者。可信平台UID与服务端实际OTP验证证明共同约束所有权，未登录、有UID的匿名用户、伪造验证声明及其他账号均不能获取私有资料；不依靠客户端flag、邮箱存在或转换日期作验证证明。

| 真实测试 | 实际结果 | 本地证据（Git忽略） |
| --- | --- | --- |
| 邮箱身份、未登录/匿名隔离 | 1 PASS / 0 FAIL / 0 SKIP | `test-results/stage2/final-real-cloud-auth.log` |
| A/B健康所有权、CAS、回执重试、直接数据库拒绝 | 1 PASS / 0 FAIL / 0 SKIP | `test-results/stage2/final-real-cloud-private.log` |
| 私有照片读删、直接对象拒绝、近1MiB图片与运行限制 | 2 PASS / 0 FAIL / 0 SKIP | `test-results/stage2/final-real-photos-private.log` |
| 确认迁移、deletedAt、图片批次与幂等提交 | 1 PASS / 0 FAIL / 0 SKIP | `test-results/stage2/final-real-cloud-import.log` |

原环境`paw-diary-d8g3p4tlsb305221d`已由用户开通上海个人付费版，文档数据库1、PostgreSQL 0，自动续费与超额按量均关闭；合法来源、集合与对象直接访问拒绝规则已读回。匿名provider仅在14:24:55–14:25:20受控窗口采集拒绝用actor，随后恢复false并读回；邮箱only设置保留。费用和配置的操作证据见[云操作说明](../operations/cloud-setup.md)及SESSION_LOG，历史余额不足订单已关闭，不再等待资金或重复采购。

## 本地回归与本轮修复

发布负责人最新单测246/246通过、0跳过。15项账号契约和6项媒体意图模拟边界整套通过，证据为`test-results/stage2/auth-final-contract-ui.log`、`auth-final-media-intent.log`。这些模拟检查补充真实用例中的迟到响应、旧草稿、失败重试和身份切换边界，不替代真实云端结果。

最终固定产物QWW76HLZ/E5通过12套本地浏览器检查：旧八套、account-workspaces、personal-media、review-local-fixes与language，全部exit0。前11套汇总在`test-results/stage2/release-final-static/summary.json`，language由Root另行运行通过。相同产物在原公开URL以全新匿名浏览器上下文重复12套，全部exit0、前后manifest一致，证据`test-results/stage2/release-public/summary.json`及逐套日志。

Root另在原公开URL使用受控A完成真实私有档案恢复与刷新：一只合成宠物、一张合成私有照片正常读取，图库图像实际加载、幻灯片关闭、390宽度无横溢、pageErrors=0，没有发送新邮件。证据`test-results/stage2/release-public-real-summary.json`及对应日志。此前真实图库上传、刷新/重开、幻灯片播放/暂停与1440/390英文有头检查已通过；旧hash HUKK2URO与最终公开产物证据分开。只保留A自己的单份合成夹具，重复夹具移入A自己的回收站，不触及其他内容。原文隔离、IDB事务abort、透明头像压缩、完整媒体归档与缓存兼容已有证据，不当作真机或实际磁盘额度耗尽。

认证恢复的单轮独立审查窗口为13:16:19–14:01:19。本轮修复了同用户异步认证事件误判，以及刷新token轮换后工具未及时写回的问题；真正新用户返回省略`is_user`时按已核契约注册，`paw-auth`于14:21:26部署Active。相关修复有单测与真实登录/刷新证据，绝不通过写入假verified标志放宽权限。原技术探针曾仅A完成、资料缺验证字段、旧refresh返回`unauthorized_client`及浏览器安装失败，均属于此前失败，完整历史保留在SESSION_LOG。

## 发布交付核对

- [x] 固定产物、公开云入口、白名单/语法、246单测及12套本地浏览器检查通过。
- [x] main合并/推送，Pages37583390404成功，源码4d7f2e9与QWW76HLZ/E5匹配。
- [x] 原URL全新匿名浏览器12套通过，四个hash入口保留；Root真实私有恢复/刷新与图库实测通过。
- [x] v0.3.0 tag与公开Release完成，14:48:48发布，旧tag不移动。
- [x] 临时paw-stage2-readiness于14:41:55删除，读回函数缺失且公共调用规则已移除。
- [ ] 用户亲自体验确认；与助手技术验收单独记录。

下一轮入口为主目录main的[阶段3计划](../superpowers/plans/2026-10-06-03-ai-onboarding-recaps.md)，先落实文本AI供应商、额度与服务端方案。AI和真实社区尚未完成；本轮没有以发版扩展这些能力。回退方式见[部署与回滚](../operations/deploy-and-rollback.md)。

## 尚未验证的最终阶段范围

真实手机软键盘与触控、原生200%缩放、读屏、Google/Outlook日历实导仍属阶段5。浏览器IDB事务中止不代表真实磁盘配额已耗尽。有头截图、四宽度桌面模拟和Impeccable降级regex检查均不作为真机或完整WCAG验收。
