爪爪日记 v__PRODUCT_VERSION__ Windows验收包

1. 解压整个ZIP，双击 START-HERE.html。
2. 点击“打开爪爪日记原网址”。使用清单操作，逐项选择通过/失败/未能核验。
3. 先核对网址和实际版本。候选0.8.0尚未部署时，公开可能仍为0.7.1；新版项目记未能核验，发布后再测试。
4. 填操作系统、浏览器、版本与启动方式。失败必须填写原因。关页前导出JSON，再次打开后导入恢复；也能导出可读HTML。

10分钟快速路径：版本→首次新内容/六步/跳过→本地测试宠物与一条记录保存刷新→护理计划完成→Edge真实安装与独立启动。完整三端建议30–45分钟，具体见device-checklist.md。

所有人工结果初始未开始。HTTP 200、图标存在或版本JSON成功，不代表Windows实际安装、定位、键盘、读屏、日历或账号隔离通过。没有设备或账号请选未能核验。

可选自动检查：双击 RUN-CHECK.cmd。只读取固定公开网站的页面、manifest、release与公共图标/构件，不读账号、浏览器资料、Cookie或环境凭证；输出 public-report.json。可在HTML导入，自动结果不会改变人工结果。
脚本不请求管理员，不修改全局执行策略；系统阻止PowerShell脚本时继续HTML人工清单。也可在已经允许脚本的PowerShell5.1中运行：
  .\check-public.ps1 -ExpectedVersion 0.7.1 -OutFile .\public-report.json
此参数只改变期待的公开版本，不代表候选0.8.0已验收；0.7.1尚无新版manifest/release时相应项目会未能核验。发布0.8.0后使用默认期待版本重测。

报告只填场景和结果，不填邮箱、token、精确坐标或真实宠物健康内容。是否发送报告/截图由你自己决定，本包不会上传报告。
本地档案属于当前浏览器或网页App存储容器，安装不保证迁移或同步。Mac Safari网页App与Safari网站数据独立。需要同份资料时登录同一云端账号，或先原浏览器导出备份、目标窗口预览确认恢复。
清理前先备份，仅删除本次明确测试宠物/记录/日历和新建测试App，不清全部浏览器资料、不处理旧空Calendar。

文件：START-HERE.html、README.txt、check-public.ps1、RUN-CHECK.cmd、report-schema.json、device-checklist.md。
