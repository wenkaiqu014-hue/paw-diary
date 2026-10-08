爪爪日记 v__PRODUCT_VERSION__ Windows验收包

解压后双击START-HERE.html即可填写，不需Node/服务器/管理员。固定原网址：https://wenkaiqu014-hue.github.io/paw-diary/ 。先读device-checklist.md，本包不上传报告。

v1.0.0集中补测：保留真实0.8标签页/日常App→等主agent上线通知→dirty/busy/照片草稿保护及真实升级重开→原生200%/键盘→真实断网恢复→隔离新App备份恢复/卸载回读→用户协助Narrator实际听读→PS5.1公开校验→一次脱敏回传。没有旧版现场/设备/听读证据保持not-run或unverified。Windows基础安装/独立启动和Google/Outlook实导已有用户通过，不重复整套。

正确内测码只由邀请者私下给用户，界面直接输入。不可放prompt、脚本、截图或报告；不得读出邮件/邮箱验证码/token。合成错误码测试与真实用户输入分开。

可选双击RUN-CHECK.cmd，或在允许脚本的Windows PowerShell5.1进入本目录执行：
  powershell.exe -NoProfile -File .\check-public.ps1 -ExpectedVersion __PRODUCT_VERSION__ -OutFile .\public-report.json
仅读取固定公开页面、manifest、release和图标/构件，无账户、Cookie或凭证读取；UTF8 byte[]/string解码已兼容，SHA保原字节。实际PS结果仍需本机运行。策略阻止不修改全局执行策略，继续人工并标原因。上线前版本不同记未能核验，发布后再测。已有最新仓库者可额外运行tests/check-public.test.ps1，不在此六文件包内、无需新依赖。

填真实系统/浏览器版本，人工全部初始not-run；失败必须原因。公共JSON导入不改人工状态，关页前导出人工JSON和可读HTML。旧v0.8报告保原样单列，不覆盖。回传同一结果目录ZIP仅含本轮报告/公开检测/脱敏截图；禁止浏览器profile、备份、node_modules、邮件、账号/码/token、坐标或真实健康资料。

网页/App资料容器可能独立，迁移用同账号云端或备份预览确认；不要假定自动共享。日常App保留，只卸载本轮隔离profile的新测试App；先备份、不清全部浏览器资料，仅清合成测试数据。

本包只包含六文件：START-HERE.html、README.txt、check-public.ps1、RUN-CHECK.cmd、report-schema.json、device-checklist.md。旧版本显式构建仍沿用其device-checklist，不代表旧用户结果被更改。
