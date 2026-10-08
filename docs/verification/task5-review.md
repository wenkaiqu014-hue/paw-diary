# 阶段5 Root集成独立审查

审查者：stage5_install worker；范围为Root app.js集成、help-coordinator身份/公告关闭/boot阻挡、安装说明、manifest/build/workflow与共享入口，只读检查，不修改共享业务代码。开始2026-10-08 12:57:03 Asia/Shanghai（clock UTC04:57:03），结束12:59:17（UTC04:59:17），2分14秒，低于Root指定15分钟。

结论：当前审查快照未发现阻断集成的问题。已确认Root适配onUpdate(null)隐藏新版按钮，合法stable回退撤销此前提示由Task4修复21项针对测试及全608项测试支持；本轮浏览器入口仍是preview+helpPreview=true，不能冒称线上stable发版、真实安装或实际账号A/B已亲验。

## 协调、身份与关闭

- app.js:103只有principal userId变更才stop(identity)、关闭只读帮助并identityChanged；帮助identity经uiIdentityKey从authPrincipal构造，不从资料声明读取身份。
- app.js:753 boot finally先helpBootReady=true，再coordinator.ready()和显式update.check()；coordinator.evaluate在ready前返回none。实际auth.getSession与switchWorkspace await位于ready之前。interactionState（app.js:271）含全部9种阻挡，business dialog含主/照片/指引，readonly帮助单独排除；图册dirty/saving有公开接口。
- coordinator（src/features/help-coordinator.js:28、36、37）ack先锁定shownIdentity并close，重新检查身份后才记录该identity版本；identityChanged增加epoch并清pending，迟到的tour结果不会绑定新身份。A/B隔离/迟到确认/忙时defer由针对单测验证，未实际请求OTP/登录。
- 关闭链是coordinator.closeWhatsNew→whatsNew.shell.dismiss→onDismiss→coordinator.dismiss，存在一次回调嵌套，但createReadonlyDialog先opened=false再回调，嵌套close立即返回；expectedCloseEvents抑制后续native close重复dismiss。确认按钮shell.close不调用dismiss，然后onAcknowledge；因此确认不被错误当关闭。

## 实际有头浏览器证据

已有127.0.0.1:4240服务，未覆盖Root dist；读取实际构件release为0.8.0/preview、helpPreview=true。以全新匿名Chrome/channel chrome、390×900访问原子路径/paw-diary/#health，未登录、未提交业务表单。临时审查脚本`/tmp/paw-stage5-root-review.py`实际退出0：

1. 首次公告关闭不写acknowledgedVersions；头像帮助→版本新内容反复打开/关闭4轮，没有pageerror或关闭递归。
2. 重开公告点击确定立即启动指引；实际guided-tour backdropFilter为none；点击跳过后回到#health，guest偏好仅一条0.8.0且tourStatus=skipped。
3. 主记录表单填明确合成未保存标题，通过[data-dialog-help]打开只读帮助；点击重看显示阻挡说明，没有启动遮罩，标题保留。
4. 从帮助打开安装说明，实际缺安装event时安装按钮隐藏；文案明确Safari独立档案/先备份、云/AI需网络。关闭安装说明后主草稿未变、焦点返回dialog-help-button、hash仍#health。
5. 当前新浏览器上下文serviceWorker.getRegistrations()为0、caches.keys()为0，符合无worker/CacheStorage写入方案。

截图：test-results/stage5/root-integration-review/dirty-install-help.png（纯合成标题）。临时脚本不进入发布白名单。

## 安装、构建与入口

manifest逐项符合spec固定id/start_url/scope/display/name/lang/colors/false；icon与尺寸由现有manifest.test.js验证。index相对manifest/apple-touch-icon保/paw-diary/；workflow显式PAW_RELEASE_CHANNEL=stable，VERSION/manifest已入触发路径；build分别写release.json与__PAW_PUBLIC_CONFIG__.release，旧v0.2模块保留、现有dist白名单未引入日志/后端。Root主dialog提供帮助按钮；主页与头像可达，双语刷新入口已覆盖。

Root安装说明在无event时给菜单路径、iPhone分享→主屏幕及可选作为网页App、Mac支持系统添加Dock；独立数据/云账号或备份恢复/卸载前备份明确，未承诺安装等于离线或系统通知。Windows默认列Edge/Chrome、文档优先Edge；未保证提示首次必出现。安装取消等事件逻辑是unit证据，不是OS安装证明。

## 检查与边界

实际`node --test tests/help-wiring.test.js tests/help-lifecycle.test.js tests/ui-preferences.test.js tests/manifest.test.js tests/install.test.js tests/update.test.js`退出0：35/35、无fail/skip。node --check app.js与git diff --check退出0。此前修复全npm test608/608退出0，日志/tmp/paw-stage5-update-rollback-suite.log，本审查未重复无必要全套。

没有实际恢复账号A/B/系统安装/卸载/手机GPS/软键盘/读屏/三客户端日历；这些按用户三端清单继续保留not-run/unverified，不能用本次Chrome桌面390模拟替代真机。Root仍需stable新构件、原URL匿名验收和发版收口。本review没有联网或读取凭证，引用均为上述本地文件与实际工具输出。

## 后续原生manifest身份纠正

2026-10-08 13:11–13:13小补中，Root报告原生Chrome Page.getAppManifest实测manifest.id './'解析到origin根，并以W3C原页纠正本项目id为'/paw-diary/'；start_url './#home'、scope './'不变。先前本review快照“manifest符合当时spec”只是当时静态核对，不能当作原生安装identity正确的最终证据。Root已更新manifest与spec，worker同步Windows PS固定项目identity校验；最终manifest针对测试1/1、全611/611通过。原生证据/官网来源由Root记录，本worker没有重新打开官方原页或执行系统安装。
