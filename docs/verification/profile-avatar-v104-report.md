# 手机头像即时预览与弹窗标题焦点补丁

2026-10-08 v1.0.4已正式发布，Release20:22:28，距首诊断起点15分55秒。首诊断工具起点20:06:33 Asia/Shanghai，用户随后追加帖子标题黄色焦点框并要求两项20分钟完成；按更早起点采用20:26:33截止。用户是在旧20:00交付截止后明确提出新的诊断和修复，本次按新授权执行，不把旧截止当作拒绝续作理由。

用户确认两位使用手机、未保存、常见图片。原代码change已经createObjectURL立即本地预览，未在选图时上传；但只显示在公开预览区，手机该区位于整张长表单之后，因此选择按钮附近看不到。不是将已证实本地显示问题误归因云端速度。补按钮旁64px圆形预览，与原公开预览共用本地URL；选图未保存、保存中、移除待保存状态清楚，上传/发布仍由用户保存触发。保存失败保文件及本地预览，重试复用原上传结果；语言、换图、移除、迟到旧read不覆盖新选择。坏图具体提示并阻止保存，可换有效图片恢复。

真实有头Chrome桌面1440及手机布局390：有效随机1280×960 PNG3121850字节、JPEG1071323字节，原作者测试选择到可见decode178.2/157.2ms；独立审查175.9/158.2ms。测试含RPC送文件与本地解码，属于桌面浏览器两宽实测，不代称实体手机性能保证。选图upload/save0，旧read1既存且held不影响新图；保存慢boundaryheld预览不消失、失败/retry不重复上传。三blob换图/移除/destroy全revoked，destroy后late读不改DOM。新DOM RED无近picker预览→GREEN，0pageerror。旧custom-pet-types测试此前8字节假PNG改真PNG以实际decode，旧validation/自定义两宽回归及22scoped单测通过。

帖子详情标题是生成的社区标题id，原CSS只针对#dialog-title，键盘打开后泛型focus-visible绘制黄色框。仅将同族dialog-head h2[tabindex=-1]纳入outline:none，保持标题焦点/ARIA阅读顺序，按钮/输入继续焦点提示；详情与编辑两宽键盘真实打开验证。初RED原绘制outline3px；修后测试仍看到computedWidth3px，但独立CSSOM证明style:none不绘制，纠正测试按绘制语义判定而非误把宽度当绘制，之后GREEN。没有移除读屏焦点或全局禁止焦点环。

隔离.worktrees/avatar-v104、基线eeef9bc，全新npm ci/721基线通过；最终Root/独立review721/721无fail/skip，syntax/diff0、mechanical detector[]，开放Critical0/Important0。independent destroy探针一度假设destroy清DOM（既有路由负责清），修为late回复不改变DOM并过，未改生产行为满足假设。两worker复用前轮线程、Root负责focus/version/deploy；未调用后台写入或改已有头像/帖子。正式source/Pages/六SHA/tag/Release/任务结束随后据实际补记，旧Windows不重新要求测试。

正式source/tag117958e954bab1652c9462e0fafe0c8f512e8698；Pages37776122974 success/20:20:31，原URL六HTTP200且逐字SHA匹配固定source stable构建。JS app-VCGAUQ5F.js SHA57887497fca64fdc9473387bdfa0942185bde24e354d9cc2d893259f30f55ccc、CSS style-JLGG55TT.css SHAe6d467861abe334e0039388d7494e049ce8cd3fa1578a2bd1e097329edb8df3e。实际匿名列表8图/详情1图读取全过0错误，个人选图保存边界由合成仓储/真实浏览器验证，不代称本人实际云保存。新annotated v1.0.4固定业务source、Release20:22:28公开非draft/非prerelease，原34tagrefs逐字保持；https://github.com/wenkaiqu014-hue/paw-diary/releases/tag/v1.0.4 。WebKit executable未配置，已如实记未执行且不安装，不冒充Safari/iPhone亲验；用户手机实际反馈另据回复记录。main完整721再次通过，raw证据ignored主目录v104，后置仅docs不重建构件。

用户手机实际复核：对本轮头像近picker即时显示及帖子标题无黄色框两项，明确回复“OK了，没啥问题”，据此两项亲验通过；没有用户真机耗时数据，不把浏览器计时改为真机数值。
