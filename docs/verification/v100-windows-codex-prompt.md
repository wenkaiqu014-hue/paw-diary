# 给Windows Codex的一次集中验收任务

将下方任务一次交给Windows Codex。本文件不包含内测码；邀请者私下提供，用户在界面直接输入。ZIP只是工具准备完成，不证明1.0已上线。主agent告知发布后才核真实新版本。

---

请在当前Windows上集中验收爪爪日记v1.0.0，并只回传一个脱敏结果文件夹ZIP。固定网址：https://wenkaiqu014-hue.github.io/paw-diary/ 。请先读解压包的device-checklist.md，按它的8步执行；无需Node或新增依赖。每小步目标15分钟、不超过30分钟；设备/部署/听读等待单列，不能把等待当通过。

重要现场：我的Windows日常App和原网页现在保留v0.8，请不要先刷新、重装、删除或清浏览器资料。先保留真实旧版本、当前hash及合成名称/日期/说明/选图草稿。等待我转达主agent“1.0已上线”后，真实离开/聚焦检查升级；尊重5分钟focus检测节流，不注入版本metadata、appinstalled或busy。集中验证dirty挡刷新、真实保存busy挡刷新、草稿图片保留，然后安全更新、原hash/资料回读及原图标关闭重开。若旧版现场已经丢失，只记录缺证据，不假造。忙碌太短可对真实请求施加网络限速并在结果写明；仍观察不到就未能核验。

继续完成Edge原生200%菜单/帮助/六步/登录/宠物/记录表单，关键保存取消可滚动到；Tab/Shift+Tab/Enter/Esc、菜单方向键、弹层回焦、内测码错误回焦。无码或合成错误码检查就近提示与无邮件；正确码和真实邮箱验证码由我直接输入，不让工具读出、不进报告、截图遮盖；语言切换保输入、成功/关闭清输入。不要反复发送邮件；遇等待按提示处理。

用合成图片验证选图说明、名称在切语言/帮助后保稿、保存刷新；在授权合成云端表单真实断网保存失败，确认输入/图片保留，恢复网络重试回读。设备网络或DevTools Offline均须记录具体方法；不可伪造失败状态，本地断网成功不代替云失败。断系统网络前请让我确认不会中断其他工作。

另外创建隔离Edge profile，仅在这里新建测试App。合成档案包含图片、自定义类型、软删除；备份预览取消无写入、确认恢复后核ID映射/附件原字节/类型及删除不复活。仅卸载本轮隔离新App、保网站数据再原网页回读，记录数据清理选项选择。我的日常App必须保留，禁止清全部浏览器资料；私密profile和备份只留本机，不回传。之前Windows安装/独立启动、Google/Outlook日历已经通过，不重复完整基础测试和日历导入。

系统Narrator请用Win+Ctrl+Enter开启，我协助听读页面标题、内测码/邮箱字段、错误与保存状态，并实际操作关闭/退出。请问具体听读结果再写证据；DOM、截图或脚本模拟不算真实读屏。原生窗口操作不了时具体告诉我要点哪一步，未完成记not-run/unverified并写原因。

在Windows PowerShell5.1实际运行 `powershell.exe -NoProfile -File .\check-public.ps1 -ExpectedVersion 1.0.0 -OutFile .\public-report.json`（先cd到解压包），或双击RUN-CHECK.cmd。核UTF8中文、byte[] manifest解码、固定manifest身份、release/asset元数据、真实构件SHA。脚本受策略阻止时不修改全局执行策略，记录阻碍；浏览器校验另记，不能代PS通过。本机已有最新仓库时可额外运行 `powershell.exe -NoProfile -File .\tests\check-public.test.ps1`，真实函数AST离线测试，不调用业务或读凭证；六文件包不附该仓库测试，不用为了它下载依赖。

双击START-HERE.html填写真实OS/Edge/PS版本与启动方式，逐项结果初始not-run；自动HTTP成功不能代人工通过。将public-report.json导入，再导出人工JSON与可读HTML到同一 `paw-v100-windows-results` 目录，必要截图先脱敏。失败写原因/实际步骤/预期/实得，未跑与无法验证区分。不要覆盖原始v0.8报告或把旧报告导入伪装本轮；补充结果独立保留。

最后ZIP仅纳入本轮JSON/HTML、公开检测stdout/JSON与必要脱敏截图，不含profile、备份、node_modules、邮件、邮箱、内测码、token、Cookie、坐标或真实宠物健康资料。仅清本轮合成数据/新测试App，保留我的日常App和原始证据。回复一个ZIP路径及通过/失败/未跑/无法验证计数，并列剩余具体步骤。
