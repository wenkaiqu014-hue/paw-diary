# 阶段4个人资料、真实社区与宠友发现 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在原网址交付账号级个人资料、匿名可读的真实图文与宠友发现，以及登录后的发布/互动/加入退出，验收后发布v0.7.0。

**Architecture:** 新增独立paw-community函数、公开业务store/client和主动公开媒体，复用可信邮箱认证与SDK通路，保留私有健康仓储和权限。地域目录与可选坐标转地域由腾讯位置服务服务端代理，先核个人适用条件和0元额度，坐标不持久保存。

**Tech Stack:** 原生ESM、现HTML/CSS、esbuild、CloudBase JS SDK 3.10.1/Node SDK 3.18.3、node:test、Playwright、腾讯WebService；不默认新增框架或依赖。

**Spec:** [已确认设计](../specs/2026-10-07-stage4-community-profiles-nearby-design.md)。用户已授权实施；2026-10-08 10:57:49十步骤技术/发行验收已完成，详stage4-report；时间限制未全部满足。

## Global Constraints

- 固定仓库/原GitHub Pages URL，保留#home/#health/#nearby/#community，新增#profile；新v0.7.0，旧tag不移动。
- 最终截止2026-10-08 20:00 Asia/Shanghai；用户实施要求十步各≤40分钟、总≤5小时；21:10:13启动，跨本次恢复已超总时限，实际超时详SESSION_LOG，不虚称达标。
- 一个账号一张公开卡；昵称头像作为发帖身份，附加资料仅加入发现后公开；邮箱只本人可见。
- 宠友/社区两页都有全部／同城；浏览城市不修改个人所在地；无私信、地图、精确距离和在线状态。
- 匿名只读白名单；任何带无效token请求不得降级访客；所有写入核可信owner和操作ID。
- 现邮箱/私有函数、匿名provider=false、集合/对象deny及v0.6.2记录/计划/媒体/AI语义保留。
- 回顾默认真实简短摘要，最终确认才公开；不自动复制完整AI故事或私有附件。
- 头像/帖子单图压缩后≤1MiB，原图选择≤10MiB；公开媒体另存、纯文本安全、示例不入真实集合。
- 腾讯位置服务新增费用预算0元；Key/SK仅环境变量；管理仅FUJI凭证；不自动购买或换供应商。
- 举报由用户手动维护，真实入队＋个人隐藏，页面仅说明等待处理，不承诺即时审核。
- 云验收必须真实A/B及匿名；A刷新串行并checkpoint，B需新真实登录；只清确切合成receipt资源。
- 每个任务完成记录SESSION_LOG、实际检查/失败/修复/子agent；mock、旧365证据或截图宽度不能代替真实云/真机验收。

## Review Focus

1. 退出发现仍有帖子：卡片/附加资料撤下，帖子保公开昵称头像；Task1/3/7测试。
2. 上传成功但发布超时、重试/改内容：同key不重复写，不同摘要拒绝，draft媒体不匿名可读；Task3/4/5测试。
3. 删帖/下架与评论、点赞、图片读取并发：父状态校验，计数事务，不能复活；Task3/4/8测试。
4. 切账号/城市与迟到请求、未保存页面：不带旧资料/草稿到新账号，区联动有效，主题确认可继续或放弃；Task2/5/6/7测试。
5. 当前行政码、直辖市、无区县城市与定位限流：规范化真实层级，未命中不猜，拒绝/超额保手选，坐标不落库；Task6及真实Task9测试。

## 文件责任与公共接口

主agent独占整合app.js/index.html/style.css、全局locale合并、构建与云权限脚本、账号适配、部署和Git/tag。独立worker不修改这些共享文件，不回退他人修改；所有worker默认继承session模型，不扩大费用。

| 边界 | 新增文件与责任 |
| --- | --- |
| 公开契约/服务 | src/domain/public-profile.js、community.js；backend/community/{gateway,store,profiles,posts,interactions,reports,media,limits,regions}.cjs；cloudfunctions/paw-community/index.js |
| 独立客户端 | src/data/community-repository.js；不复用健康workspace revision，不拉全社区snapshot |
| 界面 | src/ui/profile-menu.js、region-picker.js；src/features/profile.js、community.js、nearby.js；只向app暴露挂载/销毁与回调 |
| 位置供应商 | backend/community/tencent-location.cjs、region-store.cjs；src/domain/region-filter.js，src/features/location-suggest.js |
| 运维/证据 | scripts/community-moderate.mjs、community-media-cleanup.mjs；docs/operations/community.md、regions.md；docs/verification/stage4-report.md；tests/integration/community.test.js、tests/e2e/stage4.py |

共享协议：`{version:1,action,payload,idempotencyKey?,expectedRevision?,authToken?}`→`{ok:true,data}`或`{ok:false,error:{code,messageKey,params?}}`。authToken仅可信client顶层传入，禁止payload内伪造身份。文本请求≤64KiB；仅media.confirm允许≤2MiB的base64传输，服务端仍校验实际图≤1MiB。client文本15秒、上传35秒；函数30秒。含身份的请求在调用前后校验独立community identity generation，不绑定健康workspaceMode。

Store接口固定：`createCommunityStore({db}) → {get(kind,id),listPosts(filters),listComments(filters),discover(filters),listOwnHidden(ownerId),transaction(callback)}`；事务tx提供`get(kind,id)`、`put(kind,id,value)`、`remove(kind,id)`。kind只允许spec中的集合映射，handler验证归属和投影，外部payload不能选择集合/owner。owner键用服务端hash，authorId/post/comment为随机ID。列表游标绑定查询条件、createdAt/id（发现用updatedAt/authorId），默认20最大50。

Client：`createCommunityRepository({invoke,getPrincipal,getGeneration,getAuthorization}) → {request(action,payload,options),dispose()}`，getAuthorization调用现auth.getRequestSession返回`{principal,authToken}|null`。有账号时每次取得当前已验证token并核owner/generation，匿名读不附token；含凭证但失效不改成匿名重发，调用返回后再核scope。options可含operationId/baseRevision；不自动重复有副作用的请求，只允许重试同operationId。UI模块采用`mountX({container,repository,getSession,onLogin,onNavigate,locale,...}) → {destroy(),hasUnsavedChanges()}`；getSession为当前社区身份/独立generation，无健康snapshot依赖。

新增`src/features/community-draft-handoff.js`：`createDraftHandoff({clock,ttlMs:1800000}) → {stage({draft,ownerId?,intent:'login'|'profile'}),bindLoginOwner(ownerId),consume(ownerId),clear()}`。draft只含主动准备公开的title/text/topic/cityId/districtId和本地选图Blob，tab内存保存；guest只有用户发起的该次登录可绑定owner，已绑定A不接受B，consume一次且销毁nonce，取消登录/退出/放弃/过期清除。不持久化私有snapshot/token/私有asset引用；上传在绑定owner后进行。

## 执行前检查（随Task1/6进行，不单独冒充功能交付）

- [ ] 在主目录核git状态、入口交接/版本；读取原URL配置，检查现有预览端口，不假定旧419x服务运行。
- [ ] 按using-git-worktrees建立隔离feature/stage4-community-profiles-nearby工作树；真实npm ci，不使用node_modules symlink。运行npm test、npm run build、node --check app.js、git diff --check，记录本轮基线。
- [ ] 用户只授权工具/当前规划；审阅本plan并选择执行方式后再启动实施。建议主agent整合＋独立模块worker＋独立reviewer，不因先前授权跳过本轮plan审阅。
- [ ] 位置服务账号步骤与A/B邮箱协助在实施需要时集中进行，不现在收集Key/验证码；不在日志输出凭证或完整会话。

### Task 1: 独立公开服务与账号资料后端（目标≤40分钟）

**Files:** 新增gateway.cjs/store.cjs/profiles.cjs、cloudfunctions/paw-community/index.js、public-profile.js、community-repository.js；修改scripts/build-functions.mjs、scripts/build.mjs、src/config/public-config.js、scripts/cloud-setup.py。测试tests/public-profile.test.js、community-gateway.test.js、community-client.test.js。

**Interfaces:** `handleCommunity(request,{principal,hasCredential,store,storage,regions,getOwnAccountInfo,clock,idFactory})`；`profiles.getOwn/saveOwn/discover/getPublic/identity`。saveOwn payload只允许nickname/avatarAssetId/bio/cityId/districtId/petTypes/purposes/discoverable；getOwn不含token，公开投影不含owner/email。identity输入authorId及reference:{kind:'post'|'comment'|'profile',id}，只为实际关联且有效的公开帖子/评论或discoverable资料返回；getPublic对退出发现返回NOT_FOUND。`auth.getOwn`仅可信本人返回email，函数入口提供`getOwnAccountInfo(principal) → Promise<{email:string}>`从当前已验证服务端账号读取，不接受payload email，不将email加入Principal公开返回。

- [x] Step1：写失败测试，profile默认discoverable=false；匿名save拒绝；伪造owner拒绝；A保存B读取公开投影无私有字段；退出只撤下发现字段。client另验匿名无token、登录附当前可信token、无效token不降匿名、A切B迟到拒绝；健康local/demo与account切换不伪造/清空已登录社区身份。

```js
assert.equal(anonymousWrite.error.code, 'UNAUTHENTICATED');
assert.equal(bPublic.ownerId, undefined);
assert.equal(bPublic.email, undefined);
assert.equal(afterOptOut.items.some(p => p.authorId === a.authorId), false);
assert.equal(authorIdentity.nickname, '合成昵称');
```

- [x] Step2：运行`node --test tests/public-profile.test.js tests/community-gateway.test.js tests/community-client.test.js`，确认新行为RED，错误来自缺实现而非错误fixture。
- [x] Step3：实现契约/store/receipt/profile CAS/客户端generation；主agent在handleAuthIdentityChange的提前return之前更新独立community identity generation并清scope。profile nickname1–30、bio≤120，加入需城市/猫狗/目的；严格公开白名单和无效token拒绝。函数配置30秒，显式invoke:true；配置及cleanup规则均保留新函数，私有规则不放宽。
- [x] Step4：同组GREEN、`npm run build:functions`与`npm test`；实际读回新增函数/集合deny和原私有规则，干净匿名调用公开列表可达、写被拒绝。函数权限成功不等于完整社区已验收。
- [x] Step5：提交`feat: add isolated public profiles and community gateway`，日志记录配置读回与真实检查。

### Task 2: 头像菜单与个人资料页（目标≤40分钟）

**Files:** 新增profile-menu.js、features/profile.js；主agent改index.html/app.js/style.css及locale。测试tests/profile-ui.test.js和tests/e2e/profile.py。

**Consumes:** Task1 client、profiles.getOwn/saveOwn/auth.getOwn；现openAccount与主题discard。**Produces:** `mountProfile(...)`、`createProfileMenu({triggers,onProfile,onAccount,onAbout}) → {destroy()}`，个人资料成功保存刷新公开身份。

- [x] Step1：写行为测试/浏览器断言：1440/390均有入口，菜单→#profile、未登录→登录→返回，不需宠物；昵称/头像/城市/目的保存重开；邮箱不进入公开预览。
- [x] Step2：运行`node --test tests/profile-ui.test.js`和`/Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/profile.py`，记录RED。
- [x] Step3：实现资料页/预览/保存/错误/本人邮箱/头像占位；新增route生命周期。未保存离页走主题确认、Esc继续、放弃才导航；刷新保beforeunload。切账号清旧编辑器，保存中防重复；先以Task3媒体接口接头像选择，Task3完成前不可把占位当真实头像上传已交付。
- [x] Step4：同组GREEN；真实浏览器验证390/768/1440和两语言，键盘菜单/Esc/焦点归还、CONFLICT保输入、A到B迟到结果不显示。
- [x] Step5：提交`feat: add account avatar menu and profile page`。

### Task 3: 主动公开的头像与单图资源（目标≤40分钟）

**Files:** 新增backend/community/media.cjs、src/media/community-images.js、tests/community-media.test.js；复用process-image/storage接口，不修改私有photos归属逻辑。新增community-media-cleanup.mjs并接profile/community图片选择器。

**Interfaces:** actions `community.media.prepare({kind:'avatar'|'post',mime,bytes,sha256,width,height}) → {ticketId}`、`confirm({ticketId,bytesBase64}) → {assetId}`、`read({assetId,reference:{kind:'post'|'profile'|'comment',id}}) → {dataUrl,sha256}`、`remove({assetId})`；prepare/confirm/remove要求Principal。本人读draft可省略reference，匿名不可省略；服务端核父项有效、实际图片/作者当前头像关系，评论还需parent post有效。导出`bindCommunityAsset(tx,{assetId,ownerId,targetKind,targetId})`、`unbindCommunityAsset(tx,{assetId,targetKind,targetId})`，供profiles/posts同事务调用。storage key为community命名空间，direct规则仍deny。

- [x] Step1：写失败测试：B不能绑定A图，private fileId不能当assetId；draft匿名读拒绝；发布图匿名读hash一致；退发现仍有公开帖子身份的头像可读；删最后公开引用后不可新读；1MiB/20票据/50MiB边界、伪MIME/hash/尺寸拒绝。
- [x] Step2：`node --test tests/community-media.test.js`确认RED。
- [x] Step3：实现票据/真实字节核验/上传/绑定和按有效父项公开读取；读响应≤1MiB原字节的dataUrl，UI惰性加载最多3个并发与去重，base64不写receipt。票据24小时到期，运维仅删确切无引用过期资源；不把账号公开头像与私有pet头像绑定。
- [x] Step4：单测GREEN；真实A上传合成图片（本轮JPEG字节/hash）、B/匿名读字节hash、B偷绑定拒绝、撤回后读拒绝、取消未绑定清理；核跨账号读取不依赖A token或私有临时URL。保存A checkpoint。
- [x] Step5：提交`feat: add explicitly published community media`。

### Task 4: 真实帖子、评论与幂等点赞后端（目标≤40分钟）

**Files:** 新增backend/community/posts.cjs/interactions.cjs、src/domain/community.js、tests/community-posts.test.js、community-interactions.test.js，扩gateway路由及索引。

**Consumes:** Task1 store/identity/receipt、Task3图片绑定、Task6地域规范化接口（本任务单测注入确定目录fixture）。**Produces:** `community.list/get/save/delete`、`comments.list/save/delete`、`likes.set`。list payload为scope:'all'|'city'、cityId?/districtId?/topic?/query?/authorId?/cursor?/limit?；同城需cityId。save字段采用spec且禁止owner/authorId注入；likes.set输入postId、liked:boolean；get返回post、PublicIdentity、liked状态，不泄露点赞人UID。

- [x] Step1：写失败测试，A写B读，B编辑删除A拒绝；标题/正文/评论上限；同key重试只一个post，同key不同摘要拒绝；相同liked=true两次只+1；B/C并发赞准确；已删/下架不能评论赞；编辑CAS冲突保原数据。

```js
assert.equal(editByB.error.code, 'FORBIDDEN');
assert.equal(secondPost.id, firstPost.id);
assert.equal(reusedKeyWithDifferentText.error.code, 'INVALID_INPUT');
assert.equal(afterTwoTrue.likeCount, 1);
assert.equal(commentAfterDelete.error.code, 'NOT_FOUND');
```

- [x] Step2：`node --test tests/community-posts.test.js tests/community-interactions.test.js`确认RED。
- [x] Step3：实现有界分页、作者帖子、评论分页、desired-state点赞与事务计数；保存帖子地域快照；删除撤下公开父项和媒体引用，不能复活；公开投影用当前PublicIdentity，读时排除moderation hidden。需要真实查询的索引随函数部署建立并读回。
- [x] Step4：同组GREEN、全套npm test；真实A/B新post/读/赞/评论/编辑删除、重复操作、作者权限与匿名读，检查不进入health.snapshot。
- [x] Step5：提交`feat: share posts comments and desired-state likes`。

### Task 5: 社区列表、编辑器与交流闭环（目标≤40分钟）

**Files:** 新增features/community.js、community-draft-handoff.js及tests/community-ui.test.js、community-draft-handoff.test.js；主agent改app.js社区挂载/示例隔离、CSS/locale。浏览器tests/e2e/community.py。

**Consumes:** Task1 client、Task3 images、Task4 actions。**Produces:** `mountCommunity({...initialAuthorId?,onProfile,onLogin})`；帖子详情和作者帖子过滤；找搭子入口打开topic=遛宠搭子草稿。示例继续demo仓储，真实社区client独立于当前健康空间；个人/示例使用者也可匿名读真实社区。

- [x] Step1：写浏览器失败断言：全部/同城+话题/关键词组合、分页不重复、真实/示例分区；纯文本<script>不执行；自己有编辑删除，别人没有且伪请求仍拒绝；失败输入不丢、同操作重试无双帖。handoff单测验guest登录绑定、A不能恢复给B、30分钟到期/取消/退出清理、单次consume；浏览器验访客草稿→登录→补昵称→返回同稿，取消0帖子、提交1帖子。
- [x] Step2：`node --test tests/community-ui.test.js tests/community-draft-handoff.test.js`与`/Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/community.py`确认RED。
- [x] Step3：实现列表/详情/发帖/编辑/删除确认/评论/点赞/加载/错误/空态及上述单次handoff；无昵称先引导资料页，完成后同owner回草稿；点击评论先登录，登录不迁移本地健康。请求序号隔离筛选，community generation隔离普通旧稿，图片加载迟到不回写旧卡片。
- [x] Step4：GREEN并截图查看390/768/1440两语言、长正文/昵称、键盘；从同城宠友详情进入其帖子评论真实可用（与Task7联验）。
- [x] Step5：提交`feat: add real community browsing and posting flows`。

### Task 6: 腾讯地域目录与主动定位（目标≤40分钟，不含等待用户账号时间）

**Files:** 新增tencent-location.cjs/regions.cjs/region-store.cjs/limits.cjs、region-filter.js、region-picker.js、location-suggest.js、tests/regions.test.js、location-budget.test.js、docs/operations/regions.md。

**Interfaces:** `createTencentLocationClient({key,secretKey,fetch,timeoutMs:5000}) → {getDistrictDirectory(),translateGps({latitude,longitude}),reverse({latitude,longitude})}`；`normalizeRegion(input,directory) → {cityId,districtId}`、`matchesProfile(profile,filters)`。actions regions.meta/search/children/suggest按spec；上游数据只由允许字段组成的目录缓存进入应用。

- [x] Step1：用户配合登录个人位置服务账号，核WebService Key类型、主体、用途/缓存许可、免费配额/QPS及签名条件；读回而不输出Key/SK。写regions.md记录事实和未核项。配置PAW_LBS_KEY/PAW_LBS_SECRET_KEY于私密env/服务端；无资质/免费条件不满足则此任务标待解决，不采购，不称定位已接通。
- [x] Step2：写失败测试：深圳区→上海清无效district；直辖市、无区县/直辖县/港澳结构；WGS84转换后以lat,lng逆地理；台湾路径使用文档相应坐标规则；官方adcode不在目录则手选，不猜；坐标/Key不进日志与存储。签名测试使用纯合成key/SK。
- [x] Step3：`node --test tests/regions.test.js tests/location-budget.test.js`确认RED。
- [x] Step4：实现官方目录加载、≤64KiB分块、24小时更新目标/last-good缓存、版本时间说明；可搜索城市区县/联动；按spec一次getCurrentPosition及地区建议确认。调用前原子预算：上游100次/日、1000次/月并按实际免费额度下调，visitor5定位/日、IP10/日；转换/逆地理/目录每次均计预算；错误返回稳定码且不含URL/Key/坐标。
- [x] Step5：单测GREEN；真实Key调用directory/translate/reverse，保存仅脱敏地域结果；确认六城以外城市与特殊城市实际可选。Playwright注入已知坐标只是“模拟浏览器坐标＋真实供应商”验收；用户有头浏览器真实授权定位另验，拒绝/超时/不支持/额度尽路径仍手选。真机GPS留阶段5，不能由模拟位置代勾。
- [x] Step6：提交`feat: add Tencent-backed region search and opt-in location`，日志记请求次数、账号免费读回证据和失败，无密钥或精确坐标。

### Task 7: 全部／同城宠友发现与加入退出（目标≤40分钟）

**Files:** 新增features/nearby.js、tests/nearby.test.js；主agent接app/CSS/locale；tests/e2e/nearby.py。backend profiles.discover索引和查询随此任务完成。

**Consumes:** profiles.discover/getPublic、Task6 regions/picker、Task5作者帖子入口。**Produces:** `mountNearby({container,repository,onViewAuthorPosts,onEditProfile,...})`，同城筛选仅影响浏览偏好，全部模式只用猫狗/目的条件。

- [x] Step1：写失败测试：全部含不同城市、同城限定城市且多条件AND；不discoverable排除；可匿名读；自身明确标记；退出后详情/列表无附加资料，已有post identity还在；修改所在地不移动历史帖地域。
- [x] Step2：`node --test tests/nearby.test.js tests/public-profile.test.js`和`/Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/nearby.py`确认RED。
- [x] Step3：实现真实卡片、组合筛选、计数/空态、资料详情→作者帖子→评论；切城市清无效区，切模式保浏览城市但不写个人profile；加入退出从个人资料页明确保存/预览，退出后invalidate列表与详情缓存。
- [x] Step4：GREEN及真实A/B同城+异城+猫狗+目的、匿名读、退出即时新查询排除；两语言三宽、无距离/在线状态伪数据。无帖子空态有可达下一步。
- [x] Step5：提交`feat: discover opted-in friends across all cities or nearby`。

### Task 8: 举报、个人隐藏与回顾确认发布（目标≤40分钟）

**Files:** 新增reports.cjs、community-moderate.mjs、tests/community-report.test.js、recap-share.test.js；修改weekly-recap.js/community.js/profile.js；docs/operations/community.md。

**Interfaces:** `community.report({postId,reason,note?}) → {reportId,status:'queued'}`、`community.hide({postId,hidden:boolean})`、`community.hidden.list`（本人）；运维`node scripts/community-moderate.mjs --report-id ID --action hide|dismiss`仅本机FUJI管理身份，不部署可公开调用的admin action。回顾`onCommunityShare({title,text})`只创建编辑草稿。

- [x] Step1：写失败测试：举报不自动全站删除；B隐藏不影响A、B取消隐藏恢复；普通用户不能处理报告；管理员按确切ID下架后公开详情/媒体/写入不可用；回顾预览/草稿取消无写，确认仅选定文本，無完整AI故事/health默认字段。
- [x] Step2：`node --test tests/community-report.test.js tests/recap-share.test.js`确认RED。
- [x] Step3：实现举报回执/队列幂等、个人隐藏及profile已隐藏列表；可信CLI事务处置与说明，限明确postId/reportId；回顾简短日期范围/真实记录数→发布表单→确认提交，不传私有附件。运维清理仅测试自己的确切receipt。
- [x] Step4：GREEN，真实B举报A合成帖子/隐藏/恢复，维护者处置该测试post后匿名读拒绝；回顾取消0帖子、最终发布1帖子且重试不双写。页面说明符合真实人工处理能力。
- [x] Step5：提交`feat: add report handling personal hides and confirmed recap posts`。

### Task 9: 真实双账号验收、独立审查与回归（目标≤40分钟）

**Files:** 新增tests/integration/community.test.js、tests/e2e/stage4.py、docs/verification/stage4-report.md；必要时修tests/e2e/profile/community/nearby及test_app.py历史断言。实施源文件修复按发现归属处理。

- [x] Step1：新建真实B邮箱会话，A先检查可恢复；复用cloud-harness，私密文件600并每refresh写回。禁止复用失效B token/OTP、管理身份或合成Principal代替真实A/B。
- [x] Step2：运行`node --test tests/integration/community.test.js`；脚本未配置真实会话应失败并明确缺依赖，不能skip后绿色。覆盖新资料及邮箱私有、全部/同城、全国目录/真实位置服务、图文互动/作者权限/幂等、图片hash、退出发现/身份保留、举报/隐藏/运维、匿名读/匿名写拒绝、A/B健康隔离。
- [x] Step3：运行`npm test`、`npm run build`、`npm run build:functions`、`node --check app.js`、`git diff --check`，要求0失败0skip；新增权限/媒体单测不能只复述实现。按v0.6.2修旧自动体重标题断言，不能修改产品恢复预填。
- [x] Step4：运行`/Users/wenkaiqu/.codex/skill-runtime/run python -u test_app.py`、`/Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/language.py`与stage4.py；1440/768/390截图亲看，键盘/路由/profile离页/弱网失败/账号切换/长文，console与pageerror为0。保record-only、plan分类、私有媒体rename/备份、AI/回顾/助手（按需真实调用，不为回归无目的重复收费请求）。
- [x] Step5：派未实施对应代码的独立reviewer，检查新权限、公开投影、匿名实际通路、目录坐标/限额、并发/媒体引用、路由和旧语义；所有Critical/Important修复后重跑相关测试。主agent核真实输出，agent说完成不替代验证。
- [x] Step6：写报告和SESSION_LOG：实际命令/结果、失败修复、账号/请求脱敏证据；亲验/真机/未满足条件分别列出，不提前标阶段完成。提交`test: verify stage4 sharing discovery and privacy boundaries`。

### Task 10: 原URL候选验证、v0.7.0与交接（目标≤40分钟）

**Files:** VERSION、package.json/package-lock.json、CHANGELOG.md、README.md、PENDING.md、ROADMAP.md/PRODUCT.md、总计划/04旧计划、SESSION_LOG.md、docs/releases/v0.7.0.md、stage4-report.md及必要AGENTS续作摘要。

- [x] Step1：全部核心验收已过后更新候选0.7.0与产品说明，README标题下原网址、先用途/体验步骤、只最新版能力；不把研究未核许可/真机写已完成。按finishing-a-development-branch集成验证分支，不清旧私密证据。
- [x] Step2：全新npm ci/build和必要最终回归后提交/推送main触发原Pages；核工作流head SHA、success及原URL新构件SHA。无node_modules symlink/旧缓存/本地mock冒充线上。
- [x] Step3：以`PAW_DIARY_TEST_URL=https://wenkaiqu014-hue.github.io/paw-diary/ /Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/stage4.py`复验匿名公开read/三宽双语/四hash和#profile；真实A/B生产SDK复验该部署新功能，读取已准备合成帖子，必要写只确切测试资源。不得把线上匿名写拒绝当真实分享通过。
- [x] Step4：确认原URL和核心功能通过后创建新annotated v0.7.0 tag与公开Release（非draft/非prerelease），记录source/tag SHA、Pages run、Release时间/URL，工具核旧tag未移动；清理本轮确切测试资源/只停止本轮服务，保存会话checkpoint。
- [x] Step5：同步日志/状态/报告和阶段5入口并本地Git可恢复，必要docs-only推送不重发业务。阶段5指南/PWA/真机/读屏/日历实导与用户亲验继续单列。

## 并行顺序、时间与启动门槛

推荐主agent＋独立模块worker：公共后端worker负责Task1/4/8后端及其测试；媒体worker负责Task3；地域worker负责Task6。主agent负责Task2/5/7 UI和共享文件；UI需要独立worker时复用空闲槽位且明确文件所有权。Task1先锁接口，Task3/6可并行；Task4等待媒体绑定接口，Task5/7联验依赖其后端真实数据；Task8后完成Task9，再Task10。reviewer不审自己实施的模块。遵守4并发上限，不为形式派工。

串行目标工时合计约5.5–8.5小时；有账号及时配合和上述并行时建议执行窗口4–6小时。调查前4–5小时初估已经细化，不保证总时长或每项一定≤1小时。等待实名/OTP/供应商核验另记，不能挪掉真实验收缓冲。执行前用户可据plan调整范围/工时；固定10月8日20:00不变。

**允许继续独立工作的依赖：** B暂不可登录时可做本地与单账号模块；位置账号暂不可用时可做UI/契约/fixture测试。**不得代勾的门槛：** 真实双账号分享/权限、公开媒体跨账号、实际全国目录/定位服务、原URL验证。费用/许可条件不满足时记录确切待项；不采购企业许可、不静默用旧六城或mock代替目标能力。

plan self-review要求：spec每条映射到任务，接口名/字段/错误码一致；Review Focus五项都具有测试；命令指向真实或该任务新增文件；无占位项或空泛完成项。步骤1–9已按当前实际证据勾选；步骤10原URL与新Release已实际核验后勾选。具体执行差异见阶段4报告，真机检查仍未代勾。
