# 阶段2：本地个人档案与邮箱私有云同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans（主agent协调执行）；独立模块按需要使用superpowers:subagent-driven-development/dispatching-parallel-agents。每任务依次RED、实现、GREEN、归档。原规划已获用户后续“开始吧”授权；实施状态和证据见SESSION_LOG与阶段2报告。

**Goal:** 八小时实施目标内交付免登录本地个人健康/照片、真实邮箱私有云同步、V3生命周期与自定义类型、中英文及确认迁移/完整备份；原网址可用。

**Architecture:** DemoRepository保留；新增IndexedDB LocalRepository与服务端CloudRepository，共用领域规则。CloudBase上海云数据库：每用户一个健康快照文档+revision、独立媒体/回执/导入映射，paw-api逐action验证可信身份。私有图片由鉴权API读取后生成浏览器blob URL，文件不直接公开。前端仍GitHub Pages原生界面，esbuild打包。

**Tech Stack:** 原生ESM、IndexedDB/Blob、esbuild、CloudBase Web/Node SDK、node:test、fake-indexeddb（仅测试）、Python Playwright。真实SDK/运行时在Task1核对源码并锁入package-lock，不猜旧OPENID行为。

**Spec:** [阶段2设计](../specs/2026-10-07-stage2-local-cloud-design.md)；[用户答案/研究](2026-10-06-followup-discussion.md)；[阶段1V3生命周期](../specs/2026-10-07-health-management-design.md)。本计划替代旧邮箱密码/六action/仅云相册草案。

**规划期已核对的前置（非实施完成）：** 用户已自行创建专用环境，2026-10-07 01:27:19以指定FUJI环境变量只读DescribeEnvs/DescribeBillingInfo成功：`paw-diary-d8g3p4tlsb305221d`，ap-shanghai，NORMAL，baas_trial，云数据库资源1、PostgreSQL资源0，到期2027-04-07 23:59:59，自动续费/超额按量false。后续管理调用只从TENCENTCLOUD_FUJI_SECRET_ID/KEY读取，不默认改用此前查cloud1的凭证。邮箱/Principal/事务/私有访问与部署权限仍未实测。

## Global Constraints

- 用户后续已正式授权完整实施，起点2026-10-07 01:38:46，八小时目标09:38:46 Asia/Shanghai。邮箱人工验证在验收环节；不把等待时间当资金就位。具体费用限上海个人版一个月≤20元，六个月119.39元不在本次范围。
- 原仓库/网址、#home/#health/#nearby/#community不变，已发布v0.1.0/v0.2.0不移动。
- `paw-diary:v3:demo`及旧v1/v2原文/备份保留；完整snapshot保留deletedAt，visibleHealth不作为持久化输入。demo/local/account分开，不自动迁移、种示例、公开健康/图片。
- 本次真实认证仅邮箱；微信/手机号经用户本轮同意不纳入本次验收，无不可用按钮。未来多身份主动验证绑定同UID。
- 免费先验，个人账号基础云约20元/月在用户可接受范围内；不自动续费/超额按量。额外邮件费用、超预算资源或集团账单未获本次选择，不静默启用。
- 云保存后刷新/返回前台拉取；revision冲突保留输入/重新决定；云断网不离线写入/自动合并。本地保存独立正常工作。
- 未登录个人头像/照片墙/幻灯片也实现。单照片确认永久删除；父宠回收保留媒体且恢复重现。
- other/typeLabel1–20字、非other清标签；中英文覆盖现有四页/新表单/状态/错误/ARIA，不翻译用户原文。
- 前端仅公开环境/地域/平台允许公开配置；管理和AI密钥只经环境变量读取，不能回显/提交。可信Principal拒绝未登录/匿名平台用户，owner不来自payload。
- 本阶段不实施AI/真实社区/定位/指南/PWA；正常local/account社区只读示例，demo演示互动独立保留。

## Review Focus

1. 前台刷新或切语言改变打开表单的宠物/输入：固定petId/baseRevision/generation；Task4/6测试。
2. 有uid的匿名用户或A退出迟到响应仍获得私有内容：Principal查真实身份、generation覆盖健康/图片；Task1/3/4测试。
3. IDB quota/abort与对象存储上传的半保存：本地三store事务，云暂存/确认/清理，完整备份下载失败不报完成；Task2/5测试。
4. 幂等先后顺序、同key不同输入及复活/越权批次：回执先于CAS，完整关联/批次验证，旧备份不复活；Task3/4/5测试。
5. 新发布哈希模块和旧缓存HTML：完整静态产物、v0.2兼容白名单、旧数据原文保护；Task1/7测试。

## 八小时预算与责任

预算是计划分配，不是完成承诺；从后续正式开始指令的工具时间起连续计时，包含外部等待。平台/邮箱前置若失败，及时报告，保留可独立推进的本地工作，不能把阶段2勾完成。

| 任务 | 预算 | 门槛/产物 |
| --- | --- | --- |
| 1 平台/邮箱/可信身份与公开构建 | 45分钟 | 实际专用环境、邮箱能力/Principal探针、bundle/配置边界 |
| 2 local仓储与统一V3扩展 | 75分钟 | 空个人档案、事务/冲突、other/头像引用 |
| 3 私有云健康API | 105分钟 | 生命周期/排序/profile/幂等/CAS、两个真实账号隔离 |
| 4 会话UI与确认迁移 | 75分钟 | 邮箱登录/退出、三空间、编辑保护/导入闭包 |
| 5 媒体UI与完整备份 | 75分钟 | 本地/云私有图、删除、幻灯片、备份往返 |
| 6 双语覆盖 | 45分钟 | 四页/新增/错误切换不丢输入 |
| 7 复验、修复与交付 | 60分钟 | 一轮审查/回归、真实报告、候选版本 |
| 合计 | 480分钟 | 不省略真实权限和旧数据保护 |

按用户既有执行偏好由主agent协调；并发上限含主agent4。接口冻结后可并行：local worker仅IDB/local仓储/媒体处理/单测；cloud worker仅backend/functions/cloud auth/repository/真实集成；UI worker仅词典/error-localization/photo-wall独立模块/浏览器脚本。主agent独占schema/领域共享文件、app.js/app-session.js、index/style、构建/工作流、接口整合、日志和验收。工人不独占代码库，不回退别人、不再派工、不自行云部署/Git发布。计时预算按关键路径调整，不把各worker工时简单相加；验收60分钟必须预留。

检查点：45分钟认证前置是否真实可用；第3小时健康/本地事务；第5小时云权限/会话；第7小时停止加非必要装饰、进入集中验证；第8小时报告真实结果。原10月8日20:00截止不变，不擅自将未完项延期。

## 固定接口与文件责任

`AppSnapshotV3`增加mode=local、other/typeLabel和Pet.avatarAssetId；`WorkspaceEnvelope={snapshot,revision,workspaceId}`；媒体不塞未经schema支持的顶层字段。仓储既有领域操作返回值按设计第4节保留；任意mutate仅demo，本地replaceSnapshot仅本地恢复，云端恢复换显式archive预览/导入。

`AuthAdapter.getSession/getRequestSession/requestEmailCode/verifyEmailCode/signOut/subscribe`；`createAppSession`增加switchWorkspace/refresh/generation，兼容旧demo调用；用户语言与当前宠物选择是空间隔离的设备偏好。

`ApiRequest={version:1,action,payload,authToken?,expectedWorkspaceId?,expectedRevision?,idempotencyKey?}`；`Envelope={ok:true,data,revision}|{ok:false,error:{code,messageKey,params?}}`；code固定`UNAUTHENTICATED|FORBIDDEN|INVALID_INPUT|CONFLICT|UNAVAILABLE`。authToken仅当前SDK会话的瞬时Bearer二级验证，不进payload/回执/hash/cache/log；owner仍取可信平台UID。所有写操作同时带已初始化的expectedWorkspaceId防错断言，仅与server当前owner+env派生值比较，不能选owner；在任何Store/回执之前拒错空间。读操作无expectedRevision，所有业务写操作必带revision/key；媒体读取仅用assetId，绝不使用客户端fileId/ownerId授权。

健康actions：`health.snapshot`、`pets.save`、`pets.reorder`、`records.save`、`records.delete`、`reminders.save`、`reminders.complete`、`trash.move`、`trash.restore`、`profile.save`。当前宠物设备偏好不发跨设备写操作；不提供任意mutate/replace远端快照接口。

媒体actions：`media.list|media.prepare|media.confirm|media.read|media.remove|media.cleanup`；导入actions：`imports.preview|imports.prepare|imports.commit`。MediaRepository.list/save/remove/resolveUrl参数与设计第6节一致；save可接完整preparedImage避免重复编码，必须验证签名/字节/实际decode尺寸后使用；cleanupExpired仅处理已过期staging，释放量须对象删除/确认不存在及事务持久化完成，有错明确pending；resolveUrl返回浏览器临时URL及释放函数。

`WorkspaceStore.readOwned(principal)`、`transactionOwned(principal,callback)`，事务对象支持读取/保存该owner健康文档、媒体元数据、回执和来源映射；`resolvePrincipal(platformContext)`校验真实已验证邮箱身份，`handleRequest(request,{principal,store,clock})`执行显式action。`imports.prepare/commit`使用当前revision和key，media.prepare只创建owner内上传暂存票据、不改共享快照；confirm/remove必须CAS，其他事务性共享变更递增revision。完整archive包含sourceWorkspaceId/资产字节，导出snapshot.mode=local，legacy无来源ID走明确命名空间及实体ID冲突预览。存储SDK语法在Task1冻结，管理员权限不能绕过业务归属校验。

## Task 1 平台、邮箱/Principal与静态构建（45分钟）

**Files:** 新增`docs/operations/cloud-setup.md`、`.env.example`、`src/config/public-config.js`、`src/auth/cloudbase-auth.js`、`scripts/build.mjs`、`scripts/build-functions.mjs`、`tests/build.test.js`、`tests/integration/cloud-auth.test.js`；修改package/lock、gitignore、Pages工作流/index入口；构建期间不改版本tag。

**Consumes:** 用户后续正式开始指令、个人账号、用户自行开通的专用环境结果、两套受控收信邮箱。**Produces:** 实测上海云数据库环境、真实邮箱adapter与可信Principal接入依据、锁定SDK/运行时、可在/paw-diary/打开的dist。

- [x] Step1：读取当前Git领先交接、建立隔离worktree，不reset；记录实施起点和+8h目标。复用上方已经只读核对的用户专用环境，再复核可用状态，不重建同名环境或复用cloud1。管理调用按FUJI变量读取，不把EnvCharged字段当已支付金额或订单授权。建立任务ledger，邮箱/SDK/业务能力仍按本任务真实验证。
- [x] Step2：写`tests/build.test.js`，用假secret sentinel断言dist没有backend/cloudfunctions/env/docs/tests/日志/secret值、新JS/CSS为哈希入口、四hash子路径可加载；旧缓存app/style/src来自固定v0.2.0白名单且hash相同。运行`node --test tests/build.test.js`，无build时RED，不用真实密钥作为断言输出。
- [ ] Step3：实际核对并锁定SDK/esbuild/测试IDB依赖；build输出dist，函数另打包到Git忽略产物。前端只发布公开配置。执行时才创建项目所需集合/函数及默认拒绝直接读写规则；如果邮箱配置需额外费用先落实，不能用假邮件。
- [ ] Step4：用两套可收验证码的真实邮箱走请求/验证/会话；以实测SDK uid对比服务端Principal，并测试无会话、伪造emailVerified、真实匿名uid拒绝。验证数据库事务、1MiB文档/响应、≤1MiB图片鉴权读取、免费3秒运行限制；只读测试配置，实际探针只在专用环境/测试实体上做，不读其他项目用户。必要资源变更限已批准账号/预算和执行范围。
- [ ] Step5：运行`node --test tests/build.test.js`、`node --test tests/integration/cloud-auth.test.js`（真实适配、未配置应明确失败/退出非0而非skip PASS）、`npm run build`。记录API/版本/邮件到达和失败，日志无邮箱地址/验证码/token。Gate1：按用户后续要求将人工邮箱验证延至最终验收，独立工作持续推进；资源限制及时报告，真实前置未过阶段2仍不能通过。提交`build: verify email cloud setup and isolate static artifacts`。

## Task 2 local事务仓储、V3扩展与自定义类型（75分钟）

**Files:** 新增`src/data/indexeddb-store.js`、`src/data/local-repository.js`、`src/data/media-repository.js`、`src/media/process-image.js`、`tests/local-personal.test.js`、`tests/custom-types.test.js`；修改schema/records/reminders/backup、demo默认图；新UI接口由主agent整合。

**Consumes:** 设计中的快照/媒体边界、旧领域变换。**Produces:** 空local个人仓储、统一other校验、IDB atomic/CAS、稳定媒体ID。

- [x] Step1：写失败测试：首次local无pet-mochi；保存/重开同一DB不丢；完全不改旧demo/v1/v2/backup原文；两实例同revision写入只成功一个；一次IDB abort后snapshot/media/Blob全不变；存储不可用明确失败不偷偷回到demo。
- [x] Step2：补other/typeLabel空白/20字/超长/非other清标签、猫狗旧数据不变、自定义记录不进体重趋势、来源other护理完成保留typeLabel、CSV/旧备份往返、avatarAssetId缺省兼容。运行`node --test tests/local-personal.test.js tests/custom-types.test.js`确认真实RED。
- [x] Step3：实现三个IDB store原子事务，压缩/网络均在事务外；compare revision后写，complete事件才更新内存。snapshot.mode=local，新workspaceId只初始化一次。保留既有纯领域函数返回形状，城市用saveProfile，device选择隔离存储；Blob URL仅在UI派生。
- [x] Step4：为新备份/媒体接口提供读写契约；原demo仍localStorage/raw CAS，不能套用IDB适配绕过原文保护。运行该组测试、`npm test`，真实浏览器IDB quota/abort由Task5补，不拿fake-indexeddb模拟代表浏览器全部通过。
- [x] Step5：提交`feat: add isolated local profiles and custom pet record types`，报告返回形状/测试/旧键保持证据。

## Task 3 私有健康API与revision/幂等（105分钟）

**Files:** 新增`backend/{api,identity,workspace,cloudbase-store}.cjs`、`cloudfunctions/paw-api/{index.js,package.json}`、`src/data/cloud-repository.js`、`tests/cloud-private.test.js`、`tests/integration/cloud-private.test.js`。

**Consumes:** Task1身份/事务，Task2统一领域规则；明确action协议。**Produces:** 全部十个健康action、CloudRepository兼容方法、云端CAS/所有权/完整V3。

- [ ] Step1：写测试A创建宠物/记录/事项，B直调其id读改/完成/移入恢复/排序均拒绝；无会话/匿名uid UNAUTHENTICATED；ownerId伪造不改变身份；空账号空数组；soft delete/完成历史/排序槽位同本地。
- [ ] Step2：测试revision过期CONFLICT、批量混入 他人/不存在实体整批不写、重复完成一条记录、保存成功但丢响应同key重试返回原结果、同key不同payload INVALID_INPUT、幂等返回旧revision不得覆盖更晚的客户端视图。运行`node --test tests/cloud-private.test.js`RED。
- [ ] Step3：服务端逐action规范输入，以Principal定位owner健康文档；事务先识别回执，再CAS及关联闭包；全量健康文档/回执同次保存。1MiB健康上限/64KiB常规输入超限拒绝，不截断。Client repository将envelope转错误及revision，选择只影响本设备；禁任意远端mutate。
- [ ] Step4：运行单测；部署到已验证专用环境，用真实A/B及匿名用户运行`node --test tests/integration/cloud-private.test.js`。含两设备先后编辑、排序/恢复越权、直接数据库请求拒绝与完整回收站快照。mock PASS不算Gate3。
- [ ] Step5：提交`feat: persist private V3 workspaces with revision checks`；记录实际权限/事务/失败修复及第3/5小时状态。

## Task 4 三空间会话、邮箱UI与确认迁移（75分钟）

**Files:** 新增`src/ui/account.js`、`src/features/local-import.js`、`backend/imports.cjs`、`tests/cloud-session.test.js`、`tests/cloud-import.test.js`、`tests/e2e/account-workspaces.py`；修改app-session/app/index、接媒体暂存接口。

**Consumes:** AuthAdapter、三Repository、revision与MediaRepository；导入映射按owner+来源workspaceId+kind/id。**Produces:** switchWorkspace/refresh/generation、邮箱验证码流程、imports三action、明确迁移预览与重试。

- [ ] Step1：写会话测试：demo/local/account完全分开；登录不自动上传；退出回local且本地内容不变；A迟到读/图片结果在退出/切B后不更新任何缓存；登录过期不退回显示A；云断网保留输入/当前成功快照；未保存表单空间切换必须明确处理。
- [ ] Step2：写表单测试：为宠物A打开记录，拉取后选择B，保存仍归A或因版本冲突拒绝，绝不写B；切语言不丢表单；再登录新generation旧草稿拒绝保存。导入测试覆盖预置不勾、依赖闭包、回收站/排序、owner剥离与重映射、同次重试不重复、较旧预览不能覆盖新云编辑。运行`node --test tests/cloud-session.test.js tests/cloud-import.test.js`RED。
- [ ] Step3：实现显式空间入口/个人空态/邮箱验证码/退出/过期重登；请求与媒体绑定generation。刷新/visibilitychange只拉取；打开表单捕获petId/baseRevision，保留输入及提示。local正常保存，不提示云同步成功；云读失败不种seed。
- [ ] Step4：实现完整来源预览/选择/依赖确认，source旧原文永不清除；imports.prepare建立可重试批次，commit以预览revision事务保存健康/元数据/映射/回执。city需单独明确选择，新宠顺序追加，旧备份恢复deletedAt变化逐项确认。文件传输在Task5完整接入，不宣称对象字节和DB同事务。
- [ ] Step5：单测与`PAW_DIARY_TEST_URL=http://127.0.0.1:4178/paw-diary/ /Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/account-workspaces.py`，其中账号流程真实邮箱。提交`feat: switch local and account workspaces with confirmed imports`。

## Task 5 私有/本地媒体、幻灯片与完整备份（75分钟）

**Files:** 新增`backend/{storage,photos}.cjs`、`src/features/photo-wall.js`、`src/domain/archive.js`、`tests/{photos,archive}.test.js`、`tests/integration/photos-private.test.js`、`tests/e2e/photo-wall.py`；扩展media-repository、account/local-import与app/style。

**Consumes:** Task2媒体事务、Task3身份/版本、Task4导入批次。**Produces:** 五个媒体action、头像/私有图墙/播放控件、带资产完整JSON导出/预览恢复。

- [ ] Step1：写图片测试：JPEG/PNG/WebP输入10MiB上限、解码失败/假MIME拒绝；展示最长边1920/≤1MiB（头像512），透明度保留；10张批次/50MiB空间限额失败保留输入；本地IDB abort无孤立可见照片；父宠回收隐藏但保留Blob，恢复重现。
- [ ] Step2：云测试A/B不能读对方asset、伪造fileId/错宠物确认拒绝，匿名/直接对象读取拒绝；media.read不返回外部签名URL；永久删除后读取拒绝/幂等、对象清理失败明确待重试且不报释放；替换头像失败旧头像仍在。备份tests验证含展示图片hash/关联、去owner/fileId/临时URL，漏文件/100MiB超限不生成假完整备份，V1/2/3兼容/旧导入不复活。运行`node --test tests/photos.test.js tests/archive.test.js`RED。
- [ ] Step3：实现本地事务/云上传暂存确认/鉴权读字节、浏览器blob URL释放；avatar独立资产不做相册复用。图墙只当前宠物，批次进度与逐项失败可重试；幻灯片主动进入默认暂停，播放/暂停/上下张/Esc/焦点回退，最后照片删除退出；减少动画静态切换。
- [ ] Step4：实现archive formatVersion=1完整JSON，资产base64+SHA256，云端逐文件读取成功才导出；另标明仅健康JSON。恢复先全部校验/预览，本地同一IDB事务，云走imports批次。运行`node --test tests/integration/photos-private.test.js`与`tests/e2e/photo-wall.py`，真实两个账号及本地refresh/浏览器存储失败/图片失败/切空间用例。
- [ ] Step5：提交`feat: add private photo walls and complete media backups`，记录实际文件权限、删除清理边界与限制。

## Task 6 现有全站中英文（45分钟，可提前并行）

**Files:** 新增`src/ui/i18n.js`、`src/ui/error-localization.js`、`src/ui/locales/{zh-CN,en}.js`、`tests/i18n.test.js`、`tests/e2e/language.py`；主agent修改app/index/style及领域错误映射接入。

**Consumes:** 三空间/媒体稳定词条、用户原文。**Produces:** t/setLocale、统一键/插值/错误转换、刷新保留偏好。

- [x] Step1：词典键相同、所有占位参数一致、插值转义、偏好刷新保存、名字/备注/typeLabel/帖子不翻译测试；语言切换保持当前宠物、照片、未保存表单。运行`node --test tests/i18n.test.js`RED。
- [x] Step2：实现独立locale偏好、导航/footer/四页/状态/ARIA、账号/照片/导入管理及已有领域错误映射；日期/数字只格式展示，不改存储。未知后端消息用通用提示，不泄露原异常或日志内容。
- [x] Step3：为新界面接词条，保留减少动画和既有样式；不用为了换语言重建dialog丢输入。
- [x] Step4：`node --test tests/i18n.test.js`、`tests/e2e/language.py`，360/390/768/1440四宽度、英文长文本/校验/空态实际DOM检查。
- [x] Step5：提交`feat: localize current workflows without changing user records`。后续AI/指南词条按阶段3/5补，不把尚未存在功能当已覆盖。

## Task 7 真实复验、单轮审查与阶段交付（60分钟）

**Files:** 新增`docs/verification/stage2-report.md`；更新测试runner/README/PENDING/SESSION_LOG/AGENTS/总计划/阶段计划，按实际发布再更新VERSION/CHANGELOG。

**Consumes:** 前六任务及真实前置全部通过；**Produces:** 真实验收报告、可回退候选、明确完成/未完成项。

- [ ] Step1：执行`npm test`、`node --check app.js`、`git diff --check`、`npm run build`、`npm run build:functions`；检查白名单/虚假secret扫描。所有新增集成测试分别运行，没真实环境必须非0或报告未执行，不用skip总结为全过。
- [ ] Step2：服务dist父目录，使URL确为/paw-diary/，按README/skill-runtime启动验证服务（旧4178已未连通，先检查再启动，测试产物在test-results/stage2不提交）。现有八套脚本test_app.py、local-foundation/local-boundaries/local-regressions/health-layout/health-management/management-quality/cached-upgrade全部跑，保留demo路径断言；新account-workspaces/photo-wall/language以同静态产物运行。
- [ ] Step3：独立只读审查最多一轮，聚焦身份/匿名/迟到、表单宠物归属、revision幂等、原文迁移、媒体权限/备份；Critical/Important真实复现后修复并重跑覆盖及完整相关套件。root负责整合复验，不把worker说完成当证据。
- [ ] Step4：技术阶段验收：真实邮箱A/B与另一浏览器、直接数据库/对象拒绝、照片备份往返、语言、四宽度/键盘/焦点、失败重试/断网/缓存。真实手机键盘/原生200%/读屏未做则仍列阶段5，不把桌面模拟冒充；不重复日历导入。给用户3分钟个人流程验收路线，用户体验与技术状态分开。
- [ ] Step5：按实际结果更新状态并本地Git归档，未过项列明。未来正式开始且按本计划交付时，前置/技术全通过后沿已有项目Git/部署授权发布候选v0.3.0到原地址、匿名复验、新tag/Release，用户亲自体验仍待确认的范围分开记录，不重复问工具权限。如用户未来明确只做本地/暂缓发布则尊重限制。正式实施已授权发布，但只在全部真实门槛通过后执行；未通过不称完成，不自动推进阶段3。

## 计划自检与执行交接

- [x] 执行前：用户阅读本设计/计划并明确开始；保留主agent协调＋按需worker方式，不重复问模型/工具权限。
- [ ] 实施前置：用户专用环境创建和管理只读访问已核对，邮箱代发/两套受控邮箱/可信身份/事务/图片私有读取/部署权限仍须实测，不用旧cloud1或截图代替业务测试。
- [ ] 所有写action有revision+幂等，原六action遗漏已补；城市和当前宠物设备偏好不通过任意mutate跨云保存。
- [ ] local/account备份含媒体，旧健康JSON仍兼容；photos在envelope，avatar引用已入schema，不被验证剥离。
- [ ] spec每项映射Task1–7，五条Review Focus各有明确行为测试；退出门槛包括真实匿名平台用户，不只无token。

当前已开始执行；checkbox只在对应完整步骤实际通过时更新。候选本地实现与合成验证不等于真实邮箱/私有云门槛通过；阶段2报告保留尚未完成和部署状态。


### 认证恢复专项入口（2026-10-07，只规划）

现有真实登录/刷新门槛仍未通过，后续先执行[认证恢复专项计划](2026-10-07-stage2-auth-recovery.md)。本轮仅建立来源/协议/UI状态诊断与条件修复分支，未运行探针或维修；原真实技术退出checkbox不因新增计划而勾选。服务器OTP证明和SDK会话责任的当前差异见[诊断设计](../specs/2026-10-07-stage2-auth-recovery-design.md)，先凭基线证据选路线，不猜协议或删除安全门槛。
