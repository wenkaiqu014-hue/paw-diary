# v1.0.0 内测准入与专项验收报告

更新：2026-10-08 17:41:36 Asia/Shanghai。状态：**v1.0.0正式发行；Windows具体未验证组合独立保留**。以下数字及真实操作来自主agent本轮记录与指定原始证据；文档收口agent没有操作真实账号、云端或用户资料。

## 发行与范围

固定体验地址：https://wenkaiqu014-hue.github.io/paw-diary/ 。固定仓库：https://github.com/wenkaiqu014-hue/paw-diary 。保留原四个hash入口及新增个人资料入口，保留全部已发布tag。

用户Q1–Q10已确认：发布v1.0.0、首批最多5–6名受邀者；登录/首次注册填写邀请者私下提供的六位共用内测码，码只存服务端环境。保留示例、免登录本地记录、公开浏览和原匿名AI额度；合法旧账号保留资格，重新登录仍填码。手动关闭内测准入由维护者管理，不新增硬人数上限、反馈后台、单人邀请码或平台底层全阻断。

实现以可信UID的独立betaAdmission控制五个账号业务入口。邮箱证明与内测资格分别验证；错误码不发邮件，有凭证但无资格拒绝，不能降为访客。邮件邮箱60秒间隔/3次10分钟、IP10次10分钟；错误内测码IP20次10分钟独立限流。资格、challenge指纹和错误提示在服务端与UI一致。

源码沿c53e21a→943cd53→e464ab1→b19fbf4→f559363→1f44973演进。943cd53为原五函数部署逻辑；e464ab1加入迁移收据严格校验与仓储安全错误保留；b19fbf4为第一次帮助阅读修复；前候选f559363b5b98f2cad964a4179e7d7ba1167e96ca加入第二次逐条正文听读入口与backend/imports自定义记录明确恢复缺陷修复。paw-files修复包于17:09:42 Active，bundle SHA256为6bb77b753aa8771affa4699c572862186956e790448a96077328411c737f3b0d，其余四函数不因前端修订重部署。最终source1f44973a357cfdfb9e51a0d27327f1ec6d5e4611仅在f559之上追加Windows原生200%发现的说明区窄排修复；最终Pages37758087467 success/updated17:39:10，online-release-final.json六项sameAsFrozenBuild均true/source1f449；app SHA5fac9f006c7f5b85e68640b41213ed48bcc614e15a806b16b64fae6cab22e8f0、style-NO3IGQB7.css SHA8a063c470e52b5d68b27eed6990e7d9689bdd9f997eba85b12e85c91dd48e6fc。

首候选e464ab1fbf4a3995c82b672649c4b33686d6f53e的Pages37753064061 success，工作流updated16:55:50；原URL六项HTTP200且SHA与stable main构建一致，证据main/test-results/v100/online-e464.json。b19fbf4已推送main；gh run list实际核对Pages37753851432 success，updated2026-10-08T09:02:54Z（17:02:54 Asia/Shanghai）。前候选f559 source已公开：main/test-results/v100/online-final.json记录version1.0.0/channelstable/buildIdf559363及六项SHA全部匹配；app-JA4DSHDV.js SHA5fac9f006c7f5b85e68640b41213ed48bcc614e15a806b16b64fae6cab22e8f0、style-EZ3WEPPN.css SHA34d840ad0fc6f25ca811722cb6a36c19eb697fc5e4cf2c857e61b329ff8d51e5。文档agent实际gh readbackf559 Pages37754954109 completed/success/headSha f559，publish job completed17:12:21（原UTC09:12:21Z），workflow updated17:12:22。最终1f449 Pages/六SHA已过；annotated tag本地及远端解引用均1f44973a357cfdfb9e51a0d27327f1ec6d5e4611，原26refs保持，Release18:04:50公开、非draft/非prerelease、安全资产20228B/digest4ae8…c55。公开候选release.json的stable为网页更新渠道，不替代GitHub正式Release完成。

## 实际部署、身份与权限

主agent从FUJI管理环境读取原配置并私存600快照，显式gate-off兼容代码于16:02:26–16:02:50依次部署五函数；原环境、AI/LBS变量及20/3/30/40/30秒timeout保留，无新采购或管理密钥注入。旧proof冻结cutoff2026-10-08T07:58:59.078Z，dry-run3 valid/0 invalid，apply3→verify3→再次apply0/already3；只追加legacy资格，不改健康/邮箱proof。五gate于16:05:23–16:05:42开启并逐项读回。精确时间来自SESSION_LOG本轮及主agent部署记录。

真实新C的challenge.isUser=false，首次实际发码与OTP消费各一次后注册成功；首轮验收写回器缺C白名单造成refresh checkpoint失败。补验收label并通过用户提供第二次真实OTP重新登录后，17:00恢复与refresh成功，原600会话串行写回停止。A/B原会话恢复、刷新、重开通过；不重复消费旧码或伪造UID。

五函数paw-auth/paw-api/paw-files/paw-ai/paw-community以真实签名C暂移本次资格进行门槛验收，均返回BETA_ACCESS_REQUIRED，即使客户端伪造资格也拒绝。资格已恢复、健康未改，凭证隔离；证据.worktrees/v100/test-results/v100/real-gates.json。此结果不宣称阻止腾讯平台底层所有注册。

## 测试、审查与失败修复

主agent/实现与复审日志记录658→680→694→695项全量单测；主agent17:18最终main全新npm ci、695/695 pass/0 fail/0 skip，Python环境合并4/4、语法/diff通过。tracked+dist实际用户码absence扫描通过，只输出布尔，不输出秘密。Task1/2 fresh review 56+4定向通过。终审发现两项Important：迁移收据apply/verify没有严格冻结边界校验、CloudRepository吞前置准入错误。前者RED18 fail/3 pass→21 pass，独立25项复验；后者RED12 fail/2 pass→14项独立复验。最终开放Critical0/Important0，证据.worktrees/v100/.superpowers/sdd/2026-10-08-v100-beta-access/final-review.md。

真实发码首失败是public-config白名单漏betaRequired，模块丢掉构建boolean，收到BETA_CODE_REQUIRED且mail-rate文档未建立；修strict boolean转发后成功。另有测试缓存key未含typeof、release文案字典绑定不存在、Node SDKWorker继承--input-type以及验收session label不含C等中间失败，均在SESSION_LOG记实际纠正，不作为最终通过记录。

用户Mac VoiceOver首轮发现目录可读但帮助正文不可进入；第一次修article tabindex/具名region/目录Enter后，用户第二次仍反馈只能文本选中阅读，未通过。第二次移除外层region，标题与每个li提供tabindex及完整可访问名称，目录激活聚焦主题标题；9个主题的实际Chromium AX、全文逐条Tab、trap/Escape、语言/草稿与滚动检查通过（actualVoiceOver=false，pageErrors=[]）。第三次用户实体听读明确回复“没问题了，牛逼”，据此**Mac实际VoiceOver帮助正文通过**。最终f559原URL专项9topic AX/键盘/语言/草稿/滚动0error另由Root实际运行；该技术结果与用户实际听读分别记录。证据test-results/v100/help-reading/report.json及帮助worker补充记录。

真实C验收发现产品缺陷：自定义imported record明确接受恢复冲突时imports.commit返回UNAVAILABLE。backend/imports.cjs commit闭包错引用source.sourceWorkspaceId，应使用current；主agentRED7/8→GREEN8/8并部署paw-files后，真实v100-backup-real.mjs退出0、24,265ms、12项全部true，原基线精确保留。附件清理初次FORBIDDEN是parent仍在回收站的正常权限规则，恢复自己parent后删除成功，不作为第二个产品缺陷。初始helper名称超20字/漏路由paw-files已纠正，区分脚本失败与产品缺陷。最终fresh scoped review开放Critical/Important0，独立20项imports restore/help role检查通过，未替代设备听读。

## 设备与资料专项矩阵

| 项目 | 本轮实际结果 | 证据与限制 |
| --- | --- | --- |
| iPhone主屏幕、软键盘、保存/关开回读 | 用户明确全部通过 | 主agent转述用户本轮原文“都通过” |
| iPhone GPS允许/拒绝与手选 | 用户明确通过 | 不用模拟权限替代 |
| iPhone VoiceOver帮助/记录与退出 | 用户明确通过 | 用户实体听读结果 |
| Mac Safari26.6.2双独立Dock容器 | 通过 | 空容器预览取消无写入、确认恢复、关开、头像SHA一致；mac/safari/results.json |
| Mac Chrome原0.8安装App→1.0重开资料 | 通过 | 同原profile/OS安装，真实standalone再开与合成宠物回读；mac/recovery-results.json |
| Mac原0.8热窗口dirty/更新提示 | 未验证 | 原PTY进程丢失，原因未确认；不以新1.0页代勾 |
| Mac VoiceOver帮助正文第二次修后听读 | 用户第三次明确通过 | 用户原文“没问题了，牛逼”；第一修仍不通过的历史保留 |
| Windows原0.8隔离网页→1.0 clean update | 通过 | 17:18用户回报真实旧网页清洁更新，#home及local pet/records/descriptions回读 |
| Windows原安装图标重开及dirty/busy保护 | 未验证 | DailyApp原图标待重开；模态inert是正常安全阻断，未直接完成dirty/busy组合测试，不用forced action代勾 |
| Windows Narrator | 部分用户通过 | 标题/字段/错误/关闭实际听读通过，保存状态听读待回报 |
| Windows native200%布局 | 原始失败；已技术修复，用户复验待 | 29px说明逐字竖排/助手遮挡；CSS修后390/637/768/1440实际盒宽≥44无重叠，695全过 |
| Windows已测键盘路径与隔离App卸载 | 通过 | 200% Tab/ShiftTab与错误回焦、菜单方向键/Esc、宠物/记录保存取消Enter；仅卸载本轮新App，删除数据开关Off、重开资料保留 |
| Windows照片名称/说明跨真实升级 | 未验证 | 当前照片改名/帮助/双语/保存刷新通过，跨真实旧版升级组合未执行 |
| Windows本轮精确资源清理 | 未验证 | 为继续补测保留隔离合成档案/云合成宠物；不以Root C清理代勾Windows |
| Windows云断网与备份 | 用户报告通过 | 真云offline guard/retry/images；备份取消/import mapping/字节/类型/soft-delete |
| iPhone原安装图标1.0升级与重开 | 用户明确全部通过 | 针对原图标1.0/旧记录/重开问题，用户原文“是的，iphone这边都正常” |
| 新C资格下备份/附件/回收站完整收尾 | 全部通过 | real-backup.json最终12项全true；显式恢复/自定义类型/删除不复活/附件SHA；exact cleanup原基线deepEqual |
| 原URL新C实际界面 | 通过 | real-backup-ui.json实际保存刷新、下载、预览取消无写入、own record清理、基线保留，pageErrors0 |
| 200条长中文历史合成压力 | 阶段5已有通过 | 不重复标作未实现，不当私有真实内容 |
| Google/Outlook首导/重复/改期 | 已有用户全部通过 | 阶段5用户回报；无具体数量不编造 |
| Apple Calendar16文件导入 | 通过且有快照限制 | 首次/重复各2条、无alarm；同日历改期保原10/12，新空日历正确11/12；非订阅同步 |

Mac本轮具名两个测试Calendar及两独立Safari App已精确清理；两额外空Calendar经用户明确确认后删除并读回0。原Chrome自建App/profile通过实际升级重开后精确卸载/移除。其他Calendar/App/profile不动。C本轮临时资源已按owned receipt正常恢复parent→删除own PDF→两只own QA宠物及own类型移回收站；基线pets/records/reminders及自定义类型逐项deepEqual，标准回收站痕迹保留。C浏览器/SDK全部已关闭且原600串行checkpoint，证据task-5-real-closure.md。

Windows原始报告checkedAt2026-10-08T17:32:03+08:00，Windows11/Edge149.0.4022.52/PowerShell5.1.26100.8457；auto10 pass，manual6 pass/1 fail/6 unverified。通过为public-version/beta-login/keyboard/offline-input/backup-readback/windows-uninstall；原始fail为zoom；六unverified为dirty-update/saving-update/windows-update/photo-draft/windows-narrator/cleanup。实际内容优先于口头泛称“全部过”。报告原文不改写，后续复验单列。

原生200%失败已用637应用宽实测复现pbox29/container411；修复只改CSS，说明段落flex:1 1 240px与min-width:min(180px,100%)，四宽390/637/768/1440说明盒≥44/无重叠，695全量通过。用户原生复验仍待，技术四宽不替代native200结果。

Windows最终回传ZIP已归档main/test-results/v100/windows-user/paw-v100-windows-results.zip，2137285字节/23项/no profiles，SHA256 b4a3de03837f006f59789f5bc064502b7355a60e1efc9e3976d6b897755bb346。此为用户验收证据，Release仍只上传自己生成的六白名单安全包；不上传任何用户profile/私密报告。Root额外纯合成C基线宠物按exact receipt移回收站，visible count-1、其他数据/媒体不变，SDK closed/原600 checkpoint，root-baseline-retirement.json可证。

## Windows资产与保密

本轮生成安全Windows ZIP包含六白名单文件，SHA256：4ae8eedd97ae992b8373dc9b4e3abb94b19dd4311e21f0de36642085df9fdc55；main/test-results/v100/windows/paw-diary-v1.0.0-windows-acceptance.zip。该包及集中prompt可以作为发行材料。用户原Windows21MB ZIP含private profile，仅Git忽略归档，**不得上传Release**。

服务端内测码、FUJI密钥、AI/LBS密钥、OTP、token、真实邮箱和私有健康均不进入公开代码、报告、ZIP或dist。文档仅描述变量名及脱敏结果；本轮文档agent未读私密运行时配置或健康备份原文。反馈使用[现有渠道模板](../operations/beta-feedback.md)。

## 时间、执行规则与剩余门槛

用户明确开始覆盖额外plan确认等待，起点2026-10-08 15:40:50，实际全程2h目标17:40:50，每步骤≤30分钟；最终20:00不变。独立所有权server/UI/package/平台/审查并行，app.js及部署由主agent协调，模型继承AGENTS配置，没有新控制台平台/收费采购。

Root两段真正idle等待合计27分05秒，18:03:22结束等待时active1小时55分27秒，预算截止18:07:55，最终20:00不变。Release实际18:04:50（原publishedAt2026-10-08T10:04:50Z），扣idle的active为1小时56分55秒。文档检查点2026-10-08 18:07:30 Asia/Shanghai；最终文档提交/推送时间以工具日志为准。没有把并行用户等待全扣掉，缺完整步骤起止证据时不称每步30分钟全部达标。

Root明确指令“RELEASE NOW”，核心真实门槛及原URL已过且用户已有发布授权，未额外索取许可。用户最后三项Windows快验未返回：200%修后native retest、原日常App图标重开、Narrator保存状态仍未验证；原报告六unverified组合与清理保留，modal inert不代替dirty/busy保护实测。Mac原热窗口丢失仍未验证；iPhone全部列项/Mac实际VoiceOver/Calendar/Safari/原Mac安装App重开/C12项与五门禁/exact清理已过。不宣称全平台全部通过。

正式Release：https://github.com/wenkaiqu014-hue/paw-diary/releases/tag/v1.0.0 。仅上传自己生成六白名单安全ZIP，GitHub资产size20228/digest sha256:4ae8eedd97ae992b8373dc9b4e3abb94b19dd4311e21f0de36642085df9fdc55，原26远端tag refs逐字保持。用户RAW2137285B报告仅本地归档，桌面原件据Root已移除，未上传Release。

## 可恢复入口

主目录main读PENDING、SESSION_LOG最新段与本报告，定向读v100 spec/plan及[发布与回退](../operations/deploy-and-rollback.md)。不要按旧“未实施”段重做认证/阶段1–5，不复用旧OTP，不移动旧tags，不清个人健康数据。当前raw证据保留ignored工作树目录，公开文档只写脱敏汇总。
