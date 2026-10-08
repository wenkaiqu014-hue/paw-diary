# 阶段5全分支独立代码终审

审查起点：2026-10-08 13:20:03 Asia/Shanghai（clock UTC05:20:03）。范围：工作树stage5，从base `364076603c13f47df9e91de065862fa5cb164eeb`到当前未提交实现，包含新增src/tools。仅写本报告；未修改代码、Git、部署、真实API或会话，未派子agent。

最终开放结论：Critical 0；Important 0；Minor 0。共发现Important 1、Minor 1；均经对应实施者修复及本审查独立针对复验关闭。未用此前611单元通过替代本次未覆盖行为；公开发布与用户三端亲验仍按下方边界继续。

## 已关闭Important：照片改名在语言刷新后消失，新dirty检查仍永久阻挡指引和更新

位置：`src/features/photo-wall.js:161`、`:173`、`:181`；实际Root触发路径为`app.js:756`的语言订阅`photoWall.render()`。照片改名表单由`:103–114`保存到`renameEditor`引用。

同一宠物/身份下，render用`grid.replaceChildren()`移除正在改名的表单，没有保留其输入或重新挂到新照片tile，也没有调整旧`renameEditor`引用。新`hasUnsavedChanges()`检查该引用，因此页面上已没有可保存/取消的输入，interactionState仍持续photoDirty=true。除改名输入丢失外，帮助重看、安全更新和beforeunload都继续视为存在编辑。原grid重建行为已在baseline中存在；阶段5新增dirty接线令不可见编辑持续阻挡成为本轮集成问题，并违反Task5/7照片改名输入保护。

独立实际复现：用skill-runtime Python Playwright启动隔离headless Chrome，在about:blank加载现有photo-wall组件原文（仅移除ESM import/export语法，processImage/localizeError依赖为测试替身），media.list返回一张合成照片，未请求任何云API。点击photo.rename、输入`synthetic unsaved rename`，随后调用实际`wall.render()`：

```text
before {"editorCount":1,"dirty":true,"value":"synthetic unsaved rename"}
after  {"editorCount":0,"dirty":true,"value":null}
```

该探针实际退出0，观察到了错误状态；没有修改生产组件。Root界面复现步骤：在照片墙给现有照片改名、未保存时切换中英文，再打开帮助重看。改名框消失，而重看仍提示先保存/关闭编辑。

最小修法：同scope重渲染保留并重新挂接原renameEditor和原输入，不把“清引用解除阻挡”当作输入保护；重命名保存中/失败后也保持编辑器可达。补实际DOM回归：改名→同scope render/切语言→值与编辑器保留→取消→dirty=false；正常保存后dirty=false。若照片已真正从当前列表移除，另明确处理该确切编辑对象，避免留下不可见引用。

13:26:50独立复验：stage5_photo_fix worker新增renameDraft对象与clearRename，在同scope列表刷新后将原editor/input重挂回同asset，并翻译name span、aria-label、save/cancel文案；scope/确切asset消失才清引用，正常保存完成清引用。审查者阅读修复diff及worker新增`tests/e2e/stage5-photo-rename-locale.py`，另用自己的原Chrome探针扩展4个独立场景，实际退出0：

```text
PASS original node/value/locale and cancel clears dirty
PASS save pending render keeps disabled draft; success clears dirty, one write
PASS failed pending save retains editable draft; cancel clears dirty
PASS list failure followed by retry keeps original rename value
```

实际断言同一editor/input节点、用户原文、英文aria-label、保存pending disabled/isSaving=true、成功后1次写入且dirty=false、失败后原值可编辑且取消清dirty，以及list失败后retry恢复同一原输入节点。探针所有HTTP均被本地fixture拦截，依赖和media为合成替身，不访问云端；这是实际Chrome DOM行为，不是实际云重命名。修后`node --check app.js`、`node --check src/features/photo-wall.js`、`git diff --check`均退出0，缺陷关闭。worker另报有头8/8及单测GREEN，这些不替代上述独立复验，也未作为本审查自行重跑全套的证据。

## 已关闭Minor：同身份刷新改变当前宠物时未终止正在运行的指引

位置：`app.js:311`；账号刷新入口`app.js:757`；`render`只调用`guidedTour.refresh()`（`:356`）。spec §4及Task3/5明确宠物变化应abort；controller的`stop({reason:'pet'})`已实现，但Root未接入宠物变化。

独立Node vm探针直接提取现有`syncState`函数原文，提供同account、合成pet-a→pet-b snapshot以及guidedTour.stop spy。实际退出0：

```text
{"activePet":"pet-b","calls":["PET_CHANGED","ENTITIES_CHANGED"],"tourStopCalled":false}
```

这直接证明当前宠物变化时Root没有发stop；没有模拟真实账号请求。真实路径是同账号另一窗口变更当前宠物，当前窗口恢复可见后`session.refresh→syncState→render`。尚未运行真实双窗口云端该场景，因此不把该路径写成已经亲验；从当前代码链可以确认render不会补stop。影响是指引沿新宠物继续并可能在退出时恢复旧view/management；未见数据写入或跨身份暴露证据。

最小修法：在syncState的previousPetId比较分支调用`guidedTour?.stop({reason:'pet'})`，只在实际变化时终止，普通render/locale refresh继续保步骤。补一个Root接线回归，保留controller已有reason=pet不恢复旧视图的语义。

13:25:40独立复验：Root已按此最小范围加入pet stop；实际`node --test tests/help-wiring.test.js`退出0，5/5 pass、0fail/skip。新增用acorn提取当前app.js真实syncState函数，配真实createSeedState/visibleHealth/transitionManagement的VM行为测试，changed调用['pet']、same不调用；测试不提供偏好完成写入能力。审查者自己的原始vm探针分别得到`changed calls=["pet","PET_CHANGED","ENTITIES_CHANGED"]`和`same calls=["ENTITIES_CHANGED"]`，缺陷关闭。未冒称真实双窗口云端亲验。

## 已核范围及证据

完整阅读本阶段spec、八任务plan；结合ignored `.superpowers/sdd/2026-10-08-stage5-guides-install-quality/module-review.md`和`docs/verification/task5-review.md`，未机械重跑已覆盖38项模块测试或整套611单元。重点核app.js boot、可信UID身份变化、route/render、保存/照片/只读dialog，及coordinator/tour迟到回调边界。

独立执行`node --test tests/build.test.js tests/acceptance-report.test.js`退出0，14/14 pass、0fail/skip。构建测试在隔离/tmp输出，不覆盖Root dist；验证preview/stable注入、release.json与HTML public config及asset-manifest同一release对象、当前JS/CSS SHA256、旧v0.2.0 app/schema原文、公开白名单和秘密哨兵不泄露。报告测试验证人工默认not-run、auto/manual隔离、失败原因、未知/重复字段拒绝、中文往返、内联IIFE和ZIP六文件白名单、固定manifest身份及声明hash/buildId不一致必须fail。

`node --check app.js`与`git diff --check`单独复验均退出0。一次组合搜索命令rg未匹配worker/cache符号而返回1，属“无匹配”，不是语法或diff失败；一次探索搜索包含不存在的猜测路径返回2，随后通过rg --files定位实际`src/app-session.js`。初次vm探针缺测试stub avatarUrls而ReferenceError，补齐真实函数需要的测试依赖后得到上方有效结果；这些探索失败没有伪记GREEN。

coordinator.ready在boot finally之后，账号恢复已await；身份键只用authPrincipal.userId；确认锁定shownIdentity，epoch阻止旧tour结果改新身份。只读帮助不替换主业务dialog。onUpdate(null)接线隐藏banner，合法stable回退撤销之前候选；网络/非法metadata不强制reload。同源5秒timeout/no-store/omit/focus节流实现，无常驻轮询。安装只消费真实beforeinstallprompt，一次事件只prompt一次，accept不充当installed；真实appinstalled/standalone提供安装状态。

manifest当前id为`/paw-diary/`，start_url为`./#home`、scope为`./`。采用更新后的spec及Root既有原生Chrome身份纠正证据，不提出恢复旧`./`身份。新模块无service worker注册、CacheStorage或请求拦截。workflow显式stable、包含VERSION/manifest/src/assets/scripts触发；dist保留旧v0.2模块图、不含验收包/日志/后端。最终提交后的buildId和公开SHA仍由Task8验证，dirty候选的HEAD标识不是已发布证明。

Windows脚本只准许固定公开HTTPS地址及子路径，不取Cookie、profile、环境凭证或私有接口，不改执行策略。RawContentStream字节hash与release声明比对，auto报告manualChecks为空；UTF-8写报告，Python原始字节检查check-public.ps1及RUN-CHECK.cmd均nonAsciiBytes=0、hasUtf8BOM=false，不存在中文无BOM被PS5.1误解码的现有证据。HTML有charset、内联IIFE和文本节点显示/导出，无报告上传。Windows PowerShell5.1实际执行仍未在本Mac审查环境代验。

读取既有`test-results/stage5/failures/report.json`（10技术pass、3unverified、pageErrors空）及`update-ui/report.json`（8pass、未来0.9.0 metadata仅mock），明确其network/mock范围；没有将未来版本mock记为实际已发布更新。既有模块review和Root peerreview的有头组件/主草稿/照片说明/无worker证据按各自快照采用，本次两项未覆盖缺口独立列出。

补按web-design-guidelines检查本轮原生按钮/标签/ARIA、modal焦点、44px动作、reduced-motion和滚动可达性。指南来源为本轮打开的[Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)，未把一般建议转成新增功能或后端重构要求。

## 验收边界

本报告不是v0.8.0公开验收，也不代替用户三端亲验。真实B空档案fixture、线上stable部署/原URL哈希、实际Windows PowerShell/安装/卸载、iPhone键盘/GPS/VoiceOver、Mac用户读屏/日历以及Google/Outlook登录条件，继续由Root及用户按事实记录；尚未完成的测试不作为实现bug。Root已报告的真实A/本地Mac生命周期证据未由本审查重新执行。

网络来源完整URL：https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md 。其余依据均为本地代码、报告及本次工具输出。

结束时间：2026-10-08 13:26:50 Asia/Shanghai（clock UTC05:26:50），总6分47秒；所有已执行步骤均低于30分钟，低于Root指定15分钟反馈目标。
