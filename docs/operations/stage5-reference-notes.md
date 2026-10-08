# 阶段5官方参考核对（规划依据）

2026-10-08本session只读搜索与原页核对。用于指南设计与安装计划，不代表本项目已安装或已验收。

## 目录覆盖

按catalog-official-product-docs先盘点可见导航、再读相关页面。Driver文档可见22页（Introduction6、Examples16），无可见嵌套；子agent读Configuration/API/Theming/Buttons，其余未读，未找到独立accessibility页。Driver `/docs`根入口工具报Internal Error，官网首页/Configuration侧栏恢复目录；Root另打开Configuration/Theming复核。

Edge PWA根目录可见24页，读入门与UX；更深嵌套未全部展开，目录不完整。web.dev PWA集合可见49个内容链接，精读安装条件，课程子树未展开，目录不完整。Apple iPhone Safari可见33页子树，仅读Web App页；Mac文章5个页内章节已读，未盘点Apple/WebKit整站。没有声称查全巨大全库。

## 已打开原页与支持范围

- [Driver Configuration](https://driverjs.com/docs/configuration)：overlay/目标间距/圆角、进度、popover定位、按钮与键盘控制（原页61–139、235–280行）；借鉴spotlight与近目标卡片。“跳过指引”状态、焦点恢复和草稿保护是本项目设计。
- [Driver API](https://driverjs.com/docs/api)：refresh、导航与destroy；Root依子agent原页核对报告引用，不当成本项目已实现。
- [Driver Theming](https://driverjs.com/docs/theming)：分层样式可调整。本项目继承绿/奶油色，不照搬第三方主题。
- [web.dev安装条件](https://web.dev/articles/install-criteria)：原页67–78行列Chrome推广事件的manifest/HTTPS/用户参与要求；菜单安装与事件触发需区分，事件不保证立即出现。
- [Chrome历史条件调整](https://developer.chrome.com/blog/update-install-criteria)：2023文章菜单安装取消fetch-handler要求，但其中当时推广提示要求是历史口径；以较新安装条件页核当次要求，不引用旧段当当前硬要求。
- [Edge PWA入门](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/)：原页212–214行明确service worker可选，54–71行说明部署；支持本轮不加缓存worker的取舍，不等于已安装。
- [Apple iPhone网页App](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)：分享/添加主屏幕/作为网页App打开；操作随用户实际系统核验。子agent所读版本固定页为 https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27 ，Root另读非版本固定入口，不推断用户iOS版本。
- [Apple Mac网页App](https://support.apple.com/en-us/104996)：原页30、45、54–59、84–86行支持macOS14起Add to Dock、独立网站数据与删除步骤；日期2026-05-27。不可承诺本地资料或登录从Safari无缝继承。
- [WebKit网页App机制](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)：2023机制说明manifest standalone/fullscreen和apple-touch-icon；结合较新Apple操作页使用。本文提及Push不构成本项目通知能力。

## 核对结论与待实际验证

推荐manifest与事件检测安装，无worker缓存；spotlight可参照Driver常见结构用原生实现。没有公开依据证明本项目无网写入、三端安装成功或更新无需重开；这些均列下一轮实际验证。Windows/用户系统策略、浏览器版本、独立容器的数据与公告记忆都要留实际证据。日历操作以前述calendar-clients为输入，正式验收再核当次客户端入口。

完整URL均保存在以上链接及iPhone版本固定页，失败入口为 https://driverjs.com/docs 。搜索摘要仅发现候选，未用摘要支撑精确条件。
