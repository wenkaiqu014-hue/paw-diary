# 阶段5技术发行与用户验收报告

当前：v0.8.0已正式发布，source/tag解引用8d97886a963395f9e17eea3397ea09d8372624cc，Pages37741014326 success/Deploy15:03:03，Release15:06:20 Asia/Shanghai。616单测、原URL/真实A/B与Mac实际安装技术检查通过；用户iPhone三处修复已明确“通过”，主屏幕此前明确成功。Windows结果已归档，安装与独立启动、Google/Outlook日历用户已通过；读屏等剩余专项继续单列；不重做已完成阶段、不把版本号当全平台全部通过。 最新用户回报：Windows安装/独立启动和Google/Outlook日历实导用户已明确通过；桌面安装截图已归档并移走原件。剩余读屏、真机GPS逐项结果、Windows卸载/跨后续版本更新等专项仍未验证。

## 本地实现与技术验证

新增浏览器+身份UI偏好、独立双语帮助/新内容、六步下一步/跳过遮罩、manifest与图标、平台安装说明、安全版本检测和Windows验收ZIP；无service worker/CacheStorage。原记录/计划/V3/CAS/身份/私有与公开边界保持。manifest.id已根据真实Chrome与W3C原页从误写的./纠正为/paw-diary/，start_url/scope仍相对原子路径。

初始候选Root实际`npm test`614/614、0fail/skip；node --check app.js、构建与git diff --check通过。原健康`test_app.py`八组有头回归通过；整站guides在360/390/768/1440首次确认立即六步、跳过/重看/刷新偏好通过，另已有en偏好复原的界面和主表单帮助通过。原stage4公共App三宽双语、手选、模拟定位拒绝、键盘与保稿通过。

失败场景10项真实本地UI通过：手动/AI模式、只读帮助、长中文/文件/照片说明、模拟AI网络拒绝、坏PNG保重试、empty/loadError的六步回退、弱网与metadata失败。稳定通道更新8项真实DOM通过，未来版本数据和时间/聚焦明确为模拟，未宣称真实未来发行已更新。

独立模块及全分支审查开放Critical/Important/Minor=0；两项发现已RED→GREEN并独立复验：照片改名重渲染/locale丢稿与stale dirty、宠物变化未终止指引。照片pending失败后file/caption启用已补充修复。审查报告为stage5-final-code-review.md、task5-review.md；独立审查不替真机和公开URL复验。

## 真实主体与实际安装

A/B真实SDK会话从原600文件恢复、逐次刷新写回；可信不同身份、云端护理档案读取、私有record保存/刷新、主/个人资料草稿下帮助与导览阻挡通过，pageErrors0。B原本无宠物，先创建明确“纯合成”的私有验收宠物；无公开发帖或资料保存。新合成记录按唯一receipt移回收站，原资料未清理；B合成宠物暂留用于原URL重复验收，不当成真实养宠事实。

B新建时父档案已保存，头像上传失败且界面保留独立重试。实际受限诊断确认localhost对象PUT预检403、浏览器PreflightMissingAllowOriginHeader；原URL同一真实B主体prepare2097ms、PUT200/424ms、confirm1789ms全部成功。未扩大CORS或改变后端；FUJI GetFunction只读确认paw-api Active/Timeout3，不把猜测归为运行时故障。之后独立上传改变revision，旧UI提交明确CAS拒绝且原输入保留；重新恢复页面后私有保存/刷新通过。

Mac Chrome本地与原URL分别10pass/1unverified：真实PWA.install、OS入口、正确项目id、实际独立窗口、系统launcher、资料与偏好共享、重开当前0.8、卸载及OS入口消失；临时profile与app清理。原URL块14:16:11–14:17:12=1分1秒，真实0.8.0 stable/build11bc9f2。CDP路径额外设置实际standalone偏好，不代用户正常prompt默认行为。跨后续版本实际安装更新仍未验证；不虚发0.8.1或移动tag。

## 用户三端、Windows包与日历

Windows ZIP源与自包含file://页面验证、11项报告/元数据/SHA契约检查通过，56manual项初始not-run；自动HTTP成功不等于OS/真机/读屏通过。新版兼容修复包SHA256 `7469379ea8761bb44760204e487cf1646b6c438714af3ccb5eee0a2c6051f9a2`；已收到旧包在Windows运行结果，byte[]解析兼容修复仍需Windows复跑，不把Mac源契约检查当PS实际通过。

用户明确iPhone/Windows/Mac都有，Google与Outlook两个网页版可登录，不需要桌面下载。两份ICS由产品exporter实际生成，每份2个全天事件、相同UID、首次10月10/12日、改期11/12日、无VALARM；网页导入/重复/改期/通知待用户实际结果，Apple旧导入证据不扩充为全部三端通过。

用户真机反馈已收到：iPhone Safari 首页/弹窗/城市截图、添加到主屏幕成功，其余常用流程用户报告无问题；不是逐项GPS/VoiceOver结果。截图确认移动头像缺flex居中、主标题程序focus套全局outline、顶部仍旧示例城市选择器，正在按实际反馈修复。

Windows 11 26200 / Edge149.0.4022.52验收ZIP已按用户要求从桌面归档至Git忽略test-results/stage5/windows-user；ZIP完整性与复制SHA通过，桌面原件已移除。报告auto10pass；manual16pass/24not-run/19unverified。本地保存刷新重开、护理plan/record、六步、第三步skip/replay、locale用户原文保留、help保稿通过。原PS脚本Content byte[]误报manifest，独立浏览器JSON纠正；保留原始report，修脚本兼容不以Mac测试代PS实机。真实Windows安装确认尚未完成、200%/键盘部分可用但未全面通过，读屏/日历仍未测。

用户亲验剩余：iPhone真实键盘/GPS/主屏幕/VoiceOver、Windows安装/窗口/卸载/Narrator/PS、Mac用户正常安装/Safari独立容器/VoiceOver、原生200%缩放、Google/Outlook日历。缺环境或未执行按unverified，不因v0.8目标而勾通过。

## 公开发布与时间

原网址候选已发布：11bc9f2d84a8fc6ebc8c7513fdc8181579b5480a，Pages37735756082/37735759602同source两条push均success（更新完成工具字段分别06:06:13Z/06:06:33Z），原因未核不推因果。index/release/asset-manifest/manifest/JS/CSS六项SHA与main全新ci+stable构建一致；公开app-KZH22FTC.js/style-45OUM73Z.css，字节证明test-results/stage5/online-build.json。原URL四宽指南/恢复en偏好、原健康八组、公共App三宽复验通过。旧0.7容器写入的合成记录在同名DevBrowser重开0.8后仍1条；idle后旧tab丢失，不称热标签页升级已过。正式tag/Release及用户反馈另补，旧tag不动、健康云数据不删。

工具起点12:44:26 Asia/Shanghai，4h实际工作目标初始16:44:26；等待用户实际测试/反馈区间另计，截至目前仍进行独立工作，无等待扣除。各worker块最长10分17秒，Root独立检查/真实主体/头像诊断分块记录；最终20:00保持，实际超时若发生如实记录，不以估计保证完成。

原始证据在Git忽略test-results/stage5、原600会话文件与plan专属SDD reports；源码报告不写token、邮箱、坐标或真实健康内容。正式发行时补精确source/Pages/Release工具时间。

Safari/安装入口修订技术复验：最终616/616（无fail/skip）、语法/diff/stable build通过。实际Chrome390头像文字中心0px、主标题仍聚焦且无outline、下一Tab控件solid3px。全国地区topbar/inline双向、home/health/nearby/reload一致，demo健康snapshot字节不变。社区加载拒绝三分支捕获保选并抑制旧身份/旧surface提示。个人菜单安装入口中英/桌面+iPhone UA4场景、手工说明/Esc回原trigger/表单保稿通过；UA不替实机安装。当前提交8d97886已推送，Pages37741014326 success，Deploy15:03:03/工作流updated15:03:06；index/release/asset-manifest/manifest/JS/CSS六项线上SHA与stable构建完全一致。app-BJOWAUQS.js SHA45eccc041681b7b348a7c5d313ea161f10b9289eff7f3b75672f5c13bf103ae3，style-QOCO2BV4.css SHAb94fe65e2c96f4b97dfacc0aae1aeedb54942a56e58a893eb5bbddf226f59efb；证据online-build-final.json。原URL地区同步、390focus/avatar、4组中英/平台安装菜单均实际GREEN，Safari修后真机用户确认仍待。

正式发行：Release北京时间2026-10-08 15:06:20，公开、非draft/non-prerelease；tag v0.8.0解引用8d97886a963395f9e17eea3397ea09d8372624cc。附件19994字节，GitHub uploaded/digest sha256:7469379ea8761bb44760204e487cf1646b6c438714af3ccb5eee0a2c6051f9a2与本地一致，未上传用户原报告/profile。24个旧远端tag refs逐项保持原SHA。用户修后Safari三项回复“通过”，仅相应三项及原主屏幕成功记用户真机通过，不扩充GPS/读屏/跨版本更新。

本轮服务/恢复状态：仅停止自己创建的4240/4241服务，旧证据树与原600会话文件保留；仅对paw-stage5-upgrade独立命名浏览器查询/关闭命名页（原idle已关闭，0页），未停共享daemon或用户LBS浏览器。main文档提交恢复，业务发行tag保持8d97886；原始用户Windows ZIP忽略Git并600保存。

最新用户验收补充：Windows新菜单安装、开始菜单/独立窗口问题收到“没问题了”，截图实际显示Windows应用titlebar无地址栏、安装说明已添加disabled，故安装/独立打开记用户通过；重复安装按钮disabled合理，只关闭说明返回即可，不是业务按钮失败。用户两家日历按已给首导/重复/改期/通知步骤明确回报都通过、无问题。没有提供客户端具体计数或通知设置，报告不编造细节。截图归档SHA27e8b7b6011750adbc80ae29bfb24c9ff1fd8423c8cb7024b361069dadf8c1e1，与桌面副本一致，已删除桌面原件；其他桌面照片未动。原WindowsJSON保留原始未验证状态，新用户结果另存user-followup.json，不伪造原报告。
