# v1.0.0 内测准入与专项验收报告

更新：2026-10-08 17:07:51 Asia/Shanghai。状态：**已实施、原URL候选公开，正式发行待最终门槛**。以下数字及真实操作来自主agent本轮记录与指定原始证据；文档收口agent没有操作真实账号、云端或用户资料。

## 发行与范围

固定体验地址：https://wenkaiqu014-hue.github.io/paw-diary/ 。固定仓库：https://github.com/wenkaiqu014-hue/paw-diary 。保留原四个hash入口及新增个人资料入口，保留全部已发布tag。

用户Q1–Q10已确认：发布v1.0.0、首批最多5–6名受邀者；登录/首次注册填写邀请者私下提供的六位共用内测码，码只存服务端环境。保留示例、免登录本地记录、公开浏览和原匿名AI额度；合法旧账号保留资格，重新登录仍填码。手动关闭内测准入由维护者管理，不新增硬人数上限、反馈后台、单人邀请码或平台底层全阻断。

实现以可信UID的独立betaAdmission控制五个账号业务入口。邮箱证明与内测资格分别验证；错误码不发邮件，有凭证但无资格拒绝，不能降为访客。邮件邮箱60秒间隔/3次10分钟、IP10次10分钟；错误内测码IP20次10分钟独立限流。资格、challenge指纹和错误提示在服务端与UI一致。

源码沿c53e21a→943cd53→e464ab1→b19fbf4演进。943cd53为五函数部署逻辑；e464ab1加入迁移收据严格校验与仓储安全错误保留；b19fbf4加入帮助正文键盘/阅读入口。后两次前端/运维本地修订没有重新部署SCF，不将前端buildId等同五函数代码版本。

首候选e464ab1fbf4a3995c82b672649c4b33686d6f53e的Pages37753064061 success，工作流updated16:55:50；原URL六项HTTP200且SHA与stable main构建一致，证据main/test-results/v100/online-e464.json。b19fbf4已推送main；gh run list实际核对Pages37753851432 success，updated2026-10-08T09:02:54Z（17:02:54 Asia/Shanghai）。其六项SHA、正式tag/Release、资产digest及旧refs复核待主agent最终补录。公开候选release.json的stable为网页更新渠道，不替代GitHub正式Release完成。

## 实际部署、身份与权限

主agent从FUJI管理环境读取原配置并私存600快照，显式gate-off兼容代码于16:02:26–16:02:50依次部署五函数；原环境、AI/LBS变量及20/3/30/40/30秒timeout保留，无新采购或管理密钥注入。旧proof冻结cutoff2026-10-08T07:58:59.078Z，dry-run3 valid/0 invalid，apply3→verify3→再次apply0/already3；只追加legacy资格，不改健康/邮箱proof。五gate于16:05:23–16:05:42开启并逐项读回。精确时间来自SESSION_LOG本轮及主agent部署记录。

真实新C的challenge.isUser=false，首次实际发码与OTP消费各一次后注册成功；首轮验收写回器缺C白名单造成refresh checkpoint失败。补验收label并通过用户提供第二次真实OTP重新登录后，17:00恢复与refresh成功，原600会话串行写回停止。A/B原会话恢复、刷新、重开通过；不重复消费旧码或伪造UID。

五函数paw-auth/paw-api/paw-files/paw-ai/paw-community以真实签名C暂移本次资格进行门槛验收，均返回BETA_ACCESS_REQUIRED，即使客户端伪造资格也拒绝。资格已恢复、健康未改，凭证隔离；证据.worktrees/v100/test-results/v100/real-gates.json。此结果不宣称阻止腾讯平台底层所有注册。

## 测试、审查与失败修复

主agent/实现与复审日志记录658→680→694项全量单测，最终694 pass/0 fail/0 skip；Python环境合并4项通过。Task1/2 fresh review 56+4定向通过。终审发现两项Important：迁移收据apply/verify没有严格冻结边界校验、CloudRepository吞前置准入错误。前者RED18 fail/3 pass→21 pass，独立25项复验；后者RED12 fail/2 pass→14项独立复验。最终开放Critical0/Important0，证据.worktrees/v100/.superpowers/sdd/2026-10-08-v100-beta-access/final-review.md。

真实发码首失败是public-config白名单漏betaRequired，模块丢掉构建boolean，收到BETA_CODE_REQUIRED且mail-rate文档未建立；修strict boolean转发后成功。另有测试缓存key未含typeof、release文案字典绑定不存在、Node SDKWorker继承--input-type以及验收session label不含C等中间失败，均在SESSION_LOG记实际纠正，不作为最终通过记录。

用户Mac VoiceOver发现目录可读但帮助正文不可进入。实际RED确认正文没有Tab路径；修article tabindex=0、具名region、目录Enter聚焦正文与标题滚入可视区，保双语/焦点/只读草稿。Chromium DOM/AX/键盘/滚动和旧帮助回归通过，694全量通过；actualVoiceOver=false，**Mac真实听读复验待用户**。证据voiceover-help-fix.md与test-results/v100/help-reading/report.json。

## 设备与资料专项矩阵

| 项目 | 本轮实际结果 | 证据与限制 |
| --- | --- | --- |
| iPhone主屏幕、软键盘、保存/关开回读 | 用户明确全部通过 | 主agent转述用户本轮原文“都通过” |
| iPhone GPS允许/拒绝与手选 | 用户明确通过 | 不用模拟权限替代 |
| iPhone VoiceOver帮助/记录与退出 | 用户明确通过 | 用户实体听读结果 |
| Mac Safari26.6.2双独立Dock容器 | 通过 | 空容器预览取消无写入、确认恢复、关开、头像SHA一致；mac/safari/results.json |
| Mac Chrome原0.8安装App→1.0重开资料 | 通过 | 同原profile/OS安装，真实standalone再开与合成宠物回读；mac/recovery-results.json |
| Mac原0.8热窗口dirty/更新提示 | 未验证 | 原PTY进程丢失，原因未确认；不以新1.0页代勾 |
| Mac VoiceOver帮助正文修后听读 | 待用户复验 | 技术DOM/AX通过不替代实际speech |
| Windows0.8真实旧窗口→1.0集中专项 | 待最终报告 | 旧安装/独立启动已过；1.0公开前9 public pass/0 fail只证明旧时资源检查 |
| Windows读屏、照片断网/忙碌更新、卸载等 | 待最终报告 | 使用自有测试App/profile，保留日常App |
| 新C资格下备份/附件/回收站完整收尾 | 未闭环 | real-backup.json已见saveRefresh/取消/导入/attachment SHA/删除不复活通过，但explicitRestore/基线精确清理仍失败；UNAVAILABLE/FORBIDDEN正调查，待真实QA最终结果 |
| 200条长中文历史合成压力 | 阶段5已有通过 | 不重复标作未实现，不当私有真实内容 |
| Google/Outlook首导/重复/改期 | 已有用户全部通过 | 阶段5用户回报；无具体数量不编造 |
| Apple Calendar16文件导入 | 通过且有快照限制 | 首次/重复各2条、无alarm；同日历改期保原10/12，新空日历正确11/12；非订阅同步 |

Mac本轮具名两个测试Calendar及两独立Safari App已精确清理；两额外空Calendar经用户明确确认后删除并读回0。原Chrome自建App/profile通过实际升级重开后精确卸载/移除。其他Calendar/App/profile不动。C健康验收临时资源清理尚待最终报告，不据Mac清理推论云数据已净。

## Windows资产与保密

本轮生成安全Windows ZIP包含六白名单文件，SHA256：4ae8eedd97ae992b8373dc9b4e3abb94b19dd4311e21f0de36642085df9fdc55；main/test-results/v100/windows/paw-diary-v1.0.0-windows-acceptance.zip。该包及集中prompt可以作为发行材料。用户原Windows21MB ZIP含private profile，仅Git忽略归档，**不得上传Release**。

服务端内测码、FUJI密钥、AI/LBS密钥、OTP、token、真实邮箱和私有健康均不进入公开代码、报告、ZIP或dist。文档仅描述变量名及脱敏结果；本轮文档agent未读私密运行时配置或健康备份原文。反馈使用[现有渠道模板](../operations/beta-feedback.md)。

## 时间、执行规则与剩余门槛

用户明确开始覆盖额外plan确认等待，起点2026-10-08 15:40:50，实际全程2h目标17:40:50，每步骤≤30分钟；最终20:00不变。独立所有权server/UI/package/平台/审查并行，app.js及部署由主agent协调，模型继承AGENTS配置，没有新控制台平台/收费采购。

当前文档检查点2026-10-08 17:07:51 Asia/Shanghai；仍有独立工作正在进行，没有扣除并行等待用户的时段。实际最终完成时间、两小时达标及每步达标须由主agent工具与日志核算，不能提前承诺。剩余：新C恢复/精确清理、Mac VoiceOver用户复验、Windows最终真实报告、b19或后续修复source原URL六项SHA、正式tag/Release/资产digest及旧tag不变核验。

## 可恢复入口

主目录main读PENDING、SESSION_LOG最新段与本报告，定向读v100 spec/plan及[发布与回退](../operations/deploy-and-rollback.md)。不要按旧“未实施”段重做认证/阶段1–5，不复用旧OTP，不移动旧tags，不清个人健康数据。当前raw证据保留ignored工作树目录，公开文档只写脱敏汇总。
