# 爪爪日记：安装与安全更新

体验地址：<https://wenkaiqu014-hue.github.io/paw-diary/>。从浏览器打开原网址，也可以按系统支持情况添加图标、在独立窗口启动。网站“帮助 → 安装说明”始终可阅读；只有浏览器真实提供安装事件，才显示可执行的一键安装。Chrome的安装提示受浏览器条件与用户参与影响，首次打开可能没有提示。[Chrome安装条件](https://web.dev/articles/install-criteria)

**先确认资料所在位置。** 本地档案保存在当前浏览器或网页App的存储容器，安装不会保证迁移或同步本地资料。Mac Safari网页App独立于Safari，网站数据不共享；独立窗口里看见空档案，不表示原浏览器资料丢失。要使用同一份资料，请在各窗口登录同一云端账号，或先从原浏览器导出备份，再到目标窗口预览、确认恢复。卸载和清除网站数据前先备份。[Apple说明“网页App与Safari的区别”](https://support.apple.com/en-us/104996)

## Windows Edge

1. 在Edge打开原网址；地址栏出现应用可安装图标时，点击图标，再在系统对话框点击安装。网站提供“一键安装”时也可从该入口打开系统对话框；取消后仍可继续在浏览器使用。[Edge安装操作](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux#installing-a-pwa)
2. 关闭测试网页App窗口，从系统应用入口或`edge://apps`重新启动“爪爪日记”。核对地址仍属于原网站、当前版本正确，保存一条明确标注为测试的数据后再关闭和重开。系统窗口、图标、启动与数据回读需要真实Windows验收；资源返回200不能替代这些证据。
3. 清理测试时，只在`edge://apps`中找到本次新建的测试应用并卸载。卸载对话框如提供清除资料选项，先确认备份和数据范围；不清除全部浏览器资料。[Edge应用管理与卸载](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux#managing-pwas)

如地址栏没有安装图标，查看Edge菜单中应用相关入口（名称随版本变化）。仍无入口时继续通过原网址使用，记录Edge版本和系统策略，再排查；不要把没有安装提示解释成已经安装。Edge安装PWA不强制要求service worker。[Edge开发说明](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/#a-service-worker-is-optional)

## Mac Safari与Chrome

Safari提供“文件 → 添加到程序坞”或分享菜单中“添加到程序坞”时，可输入名称并添加。Apple说明此能力从macOS Sonoma 14起提供；用户当前系统版本尚待实际核对。添加后从程序坞或应用文件夹独立打开，并重新核对账号与资料位置。测试完成只移除本次新建的测试App，删除位置为用户主文件夹内的Applications文件夹。[Apple安装与删除步骤](https://support.apple.com/en-us/104996)

Chrome可用网站真实的一键安装事件或浏览器地址栏、菜单提供的安装入口。没有事件时网站只展示手动说明，不自动弹安装窗口。Chrome与Safari分别验收独立启动、版本和资料；不推断不同浏览器共享本地档案。[Chrome安装条件](https://web.dev/articles/install-criteria)

## iPhone Safari

在Safari打开原网址，进入分享菜单，选择“添加到主屏幕”；当前系统若提供“作为网页App打开”，开启后添加。分享入口布局随系统和Safari设置变化，以设备实际显示为准。添加后从主屏幕图标启动，真实核对软键盘、保存按钮、定位允许和拒绝、VoiceOver与资料回读。[Apple iPhone操作说明](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)

## 更新与网络

启动完成后检查一次同源`release.json`；重新聚焦最多每5分钟检查一次，没有固定轮询。只有合法且较新的稳定版本才提示“新版可用”；预览版、相同版本、版本回退、网络失败或5秒超时保持当前版本。检查不带登录凭证，不改变健康档案。

先保存或关闭正在编辑的内容，再点击更新。保存中与未保存输入都会阻挡刷新，不自动弃稿；允许更新时刷新原页面并保留`#home`、`#health`等当前位置。普通网页与安装窗口需各自核对更新后的版本，不能保证首次请求完全绕过浏览器缓存。

本轮安装方案没有注册service worker、没有CacheStorage写入或请求拦截。安装图标不等于离线同步；断网时云端、AI和安装操作可能失败。已载入页面的本地操作按现有能力验证，失败时保留输入。Windows、Mac和iPhone真实安装、卸载、独立启动、更新及读屏仍需分别留证；单元测试中的事件替身只证明控制器逻辑。

## 本次核对来源

2026-10-08定向打开相关官方页面的安装、数据边界与卸载章节，未枚举官方站点完整目录。以下页面不代表本项目已完成真实系统验收。

- https://web.dev/articles/install-criteria
- https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/
- https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux
- https://support.apple.com/en-us/104996
- https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios

右上角个人菜单可直接选择“安装桌面版”（手机为“添加到主屏幕”）：浏览器提供安装事件时直接请求原生安装确认，否则显示平台操作说明。

1.0内测：邮箱登录与首次注册需填写邀请者私下提供的六位内测码；示例、本地记录和公开浏览不需要。已有合法账号的内测资格保留，退出后重新登录仍需填码。
