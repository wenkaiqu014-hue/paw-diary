# 阶段4：个人资料、真实社区与宠友发现验收

阶段4技术验收和原网址发行核验已完成，v0.7.0于2026-10-08 10:57:49 Asia/Shanghai正式发布。起点main04ed5c2、应用v0.6.2/bf7274c、365单测。实施工作树`.worktrees/stage4`；源码检查点761c3ae、2ff77d1。原仓库与网址保留，旧tag不移动。

## 本轮交付与公开边界

保留四主导航，新增#profile与左下／右上头像菜单。昵称、公开头像作为帖子身份；地域、猫狗、目的、简介只在主动加入发现后公开，邮箱仅本人资料页可见。退出发现撤卡而保留已发表内容的身份。访客真实公开读，可信邮箱主体才可写入；无效凭证不降级匿名。

社区支持图文、详情、作者编辑删除、评论与期望状态点赞；两页均有全部／同城，浏览地域与个人所在地分开。全国目录来自真实位置服务，规范化3573节点、393 city级节点，后者并非393个行政市。定位Key／SK仅服务端、坐标不存储，用户点击并确认后更新建议；手选始终可用。当前账户已有相关接口6000次／日、Key5QPS，应用100次／日、1000次／月与共享保守4次／秒。没有新增采购，未据免费额度承诺整站账单0元。

独立公开媒体按真实图片字节解码、大小与用途校验；有效公开父项引用才能匿名读。举报真实入队、由维护者手动下架；个人隐藏在资料页可恢复标记，不能复活已删除／下架内容。回顾默认简短事实摘要、可编辑、进入发布表单后最终确认；不自动公开完整故事或私有附件。

## 实际验证

| 检查 | 结果与证据 |
| --- | --- |
| 新基线与最终单元 | 起点365；恢复后`npm test`543/543、0fail/skip，`test-results/stage4/resumed-final-suite.log` |
| 构建/语法 | `npm run build`、`npm run build:functions`、`node --check app.js`、`git diff --check`通过，函数与静态网页分开发行 |
| 正式真实集成 | `node --test tests/integration/community.test.js` 1/1、29.06秒；真实A/B不同邮箱＋无token客户端，14flag全通过，缺会话另实跑明确FAIL、不skip |
| 真实私有隔离 | A/B实际health.snapshot所属空间不同、宠物ID不重合，B伪造A expectedWorkspaceId与无token私有读均拒；仅read，无私有业务写入 |
| 资料真实页面 | A/B保存刷新、本人邮箱不在公开预览、主题继续编辑／放弃、三宽五路由；A实际JPEG公开头像本人读及刷新成功 |
| 真实发布互动 | A图片发帖、刷新、评论与纯文本script标签显示；B读A、作者权限拒绝、点赞重复不加两次、帖子CAS与幂等；公开JPEG字节SHA匹配 |
| 真实发现/隐藏 | B实际页面隐藏→个人资料恢复→帖子重现，主动加入本人卡、退出恢复；清理前另SDK/管理读回B discoverable=false |
| 回顾真实页面 | 简短摘要、取消0帖、最终确认1帖、0pageErrors；只修改公共内容，不保存完整AI故事 |
| 真实管理处置 | B举报合成UI帖；FUJI CLI于10月7日23:21:35.245执行hide/resolved，匿名帖/图拒，可信B评论/赞拒 |
| 原健康回归 | 有头test_app8组PASS：记录/计划、完成待办、备份/取消删除、多宠与四路由、同日多笔体重，无JS错误 |
| 语言回归 | 有头language.py通过用户原文、自定义类型、私有照片未保存文件与说明保留，以及四路由/刷新双语 |
| 公开整App | stage4.py真实公开读取，3页面×2语言×1440/768/390；菜单/Tab键盘、Esc焦点返回、手选真实北京、草稿语言/放弃保护、0pageErrors |
| 定位边界 | 真实SDK服务端地区建议已成功；浏览器权限拒绝是明确模拟，只验证点击前0次定位与拒绝后手选，未冒充真实手机GPS |
| 独立审查 | 模块交叉审查及最终84项、分享/隐藏24项；最新0未解决Critical/Important。真实源码独立Chrome与函数探针，未用fixture冒云验证 |

真实会话均保存在Git忽略的600文件；同actor SDK与GUI串行，refresh后立即写回。B本轮一次新OTP建立，不消费过期旧B或旧验证码。原始截图／safe flags／exact receipts位于工作树`test-results/stage4`，不公开真实邮箱、token或护理原文。

## 发现、修复和复验

实际SDK由平台注入tcbContext导致首版严格包校验失败；仅在入口移除该元数据，不信任其身份，临时诊断全部删除。云最终paw-community 30秒运行，10月7日22:49:06 Active；原私有函数未重部署，集合／对象deny、匿名provider=false保留。

同城帖子初筛后并发编辑产生不符筛选的hydration结果，已事务内二次核统一过滤；实际共享位置限流由8并发揭示日/月计数不能替代QPS，新增跨实例租约＋250ms间隙和有界等待。发帖失败换图丢清理引用、评论pending可重入造成UI重复计数已按owner队列与busy guard修复。队列仅内存，24h是标记＋手工清理，当前无自动TTL任务。

Root账号协调与same-hash profile重绘、草稿owner/generation单次消费、用户取消重新登录、公开页外部chrome双语均有回归与独审。80字回顾首行原会截断，已保全到发布表单验证。最后分享审查实际复现本地健康模式A→B会沿用旧预览；现在独立公开scope校验，换身份关闭并清预览，Root回调再次核owner/generation，旧A与旧代际0稿、当前同owner1稿，独立有头复验通过。

原language旧native-visible/select_option与record.other不适用v0.6.2共享下拉／类型目录，测试改为实际点击当前控件与异步目录创建，不回退产品规则。helper语言变量遮蔽actor造成临时English会话键，已修并仅删除本轮新增键，A/B fresh checkpoint保留。追加私有只读脚本最初误取snapshot而实际数据在data，纠正后真实隔离四项全过；未将测试脚本失败隐去或误称生产缺陷。

## 资源清理、时间与未验事项

确切receipt校验原先A/B未建公开profile，清理仅本轮合成profiles／posts／comments／relations／community图片；保留原私有健康、照片和会话。已知未处理合成report按确切IDdismiss，已resolved记录保留审计。管理清理flags确认B先退出、公共图片2项删除、恢复无公开profile；随后真实匿名列表核0帖子、0卡片，示例仍独立。没有全站清空或删除用户业务。

用户要求十步每步≤40分钟、总≤5小时；10月7日21:10:13启动，总目标10月8日02:10:13。部分步骤完整收口超40已记录（Task1 Git收口42m28、Task5约70分钟等），上一个检查点后至10月8日10:50:43恢复使总时限也已超过，不声明工时达标。最终项目20:00截止保持。恢复后集中发版，实际时间以发行核验更新。

用户亲自体验、真实手机软键盘/GPS、200%原生缩放、读屏、Google/Outlook实际日历导入以及阶段5指南/PWA仍未代勾。技术验收不替代这些事项。位置商业FAQ读取失败，个人配额FAQ已核；不宣称商业许可全查清。现无私信、精确距离或地图。

## 发行核验

main从原04ed5c2快进到d21a8cb5cd2261ae2c6bb3caf9a01fc061eec982，全新`npm ci`、543/543单元、构建/语法/diff检查成功。Pages [37720181113](https://github.com/wenkaiqu014-hue/paw-diary/actions/runs/37720181113)源码为该SHA，Deploy10:55:14完成、工作流10:55:18 success。原网址10:56:01.045核对模块图及两构件SHA均匹配：

- assets/app-VP3GVTVF.js：4801a9f9b8e853617d0abe1792506610a195fd18bdb190582eda0ce0b7aac675
- assets/style-3BJOHPAC.css：709644c87d71fc4d8faa383d0bfe2ec0aa611d110931eeb98fdbd72f0264f368

原URL真实有头stage4公开三页面／双语／三宽／键盘／手选／模拟拒绝／保稿与原test_app健康8组均PASS。A/B实际会话恢复、私有云刷新、各自资料页读取、本人邮箱不在公开预览、A390英文公共页面0overflow/0pageErrors，B确认与A主体不同；最后两actor都stop且最新会话写回原600文件。没有为验收再次发送邮件或修改空公开资料。

v0.7.0为新annotated tag，解引用源码d21a8cb5cd2261ae2c6bb3caf9a01fc061eec982；[Release](https://github.com/wenkaiqu014-hue/paw-diary/releases/tag/v0.7.0)于10:57:49公开，非draft／非prerelease。发行前旧tag快照逐项比对远程引用未变化。证据为main/test-results/stage4/online-build-verification.json、tag-verification.json、public-app/report.json及/tmp/paw-stage4-online-health.log。完整旧阶段证据保留在stage4工作树，不force移除唯一私密会话／截图。原4220/4221/4196端口已无本轮监听，用户位置服务浏览器未代操作或关闭。

恢复到公开Release用时7分06秒（10:50:43→10:57:49），总任务窗口仍已违约；不以恢复后快速完成替代原工时要求。阶段5待项继续独立。
