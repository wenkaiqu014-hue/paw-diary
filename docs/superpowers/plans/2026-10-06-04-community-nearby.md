# 真实社区与同城匹配 Implementation Plan

> **历史初稿：** 2026-10-07本session已完成Q1–Q12 Grilling，新入口为[个人资料/社区/宠友详细计划](2026-10-07-stage4-community-profiles-nearby.md)与[设计说明](../specs/2026-10-07-stage4-community-profiles-nearby-design.md)。用户已选腾讯位置服务先按新增费用0元核实、账号级个人资料页、两页全部／同城，发行v0.7.0。以下旧三任务/接口只保留历史，不直接执行；新计划已由用户授权并实施，实际状态见新版计划及阶段4报告。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登录用户可以跨账户分享图文、评论点赞，并主动加入按城市/行政区/宠物/目的筛选的宠友发现。

**Architecture:** 社区与公开宠友资料有独立的公开投影，私有健康集合不用于公开查询。写操作走已认证的业务函数；图片复用第二阶段存储服务。示例保持单独来源，真实帖子不冒用示例作者。

**Tech Stack:** 前序 CloudBase 业务函数/数据库/存储、原生 ESM、node:test、两账号集成测试、Playwright。

**Spec:** `ROADMAP.md` §3、§5、§7；`PENDING.md` P2、P3；前序第二/第三阶段。

**当前起点（2026-10-07交接）:** 主目录main/v0.6.1，343单测，阶段3及健康/日期/媒体修订已公开；本计划尚未实施。先读[新session交接](../../operations/stage4-handoff.md)，旧示例并不是真实共享。原文件中的接口设计是初稿，正式实施前核私有媒体→主动公开资源、新第二账号/定位服务与费用，不重写已验认证。新阶段发行版本号由用户对齐，不复用已存在tag。

## Global Constraints

- 个人健康记录始终私有，不因公开宠友资料而开放。
- 真实图文与示例明显区分，点赞/活跃度不把示例当真实数据。
- 国内城市/行政区可搜索，用户主动触发定位仅辅助填地域，失败保留手动；不公开坐标或虚构距离/在线状态，具体API与费用执行时再核对。
- 不做私信；作者权限在服务端检查。
- 回顾分享只有用户确认后发布，默认不含健康数值。

## Review Focus

1. 多次点赞、弱网重试：点赞唯一，不重复计数。Task 1 验证。
2. 删帖/编辑与其他用户评论并发：删除后不可读，未授权编辑拒绝。Task 1、2 验证。
3. 伪造图片fileId/HTML文本：不能绑定其他作者图片，正文不能执行脚本。Task 1 验证。
4. 切换城市后遗留行政区：清空无效筛选，不能展示不属于城市的假匹配。Task 3 验证。
5. 退出宠友发现或隐藏资料：公开查询即刻排除，不曝光精确地址/健康史。Task 3 验证。

## 文件与接口

新增 `backend/{community,profiles,reports}.cjs`、`src/features/{community,nearby}.js`、`src/domain/region-filter.js`、`src/data/regions.json`、`tests/{community,profiles,region-filter}.test.js`、`tests/integration/community.test.js`；修改 `app.js`、API路由、仓储、浏览器测试。

`Post={id,authorId,title,text,topic,city,district:null|string,imageIds,createdAt,updatedAt,deletedAt:null|string}`；话题沿用`今日萌宠|遛宠搭子|养宠心得`，标题1–60字、正文1–1500字，单图先保留当前范围。`Comment={id,postId,authorId,text,createdAt,deletedAt}`，正文1–400字。`Like`唯一键`{userId,postId}`，点赞采用set desired state，不采用“翻转”避免重复网络请求反复切换。

action `community.list|get|save|delete|comments.list|comments.save|comments.delete|likes.set`。`list({city?,district?,topic?,query?,cursor?,limit=20}) → {items,nextCursor}`；`likes.set({postId,liked:boolean,idempotencyKey}) → {liked,likeCount}`。未登录可读取真实公开帖子，但写操作要求Principal。后台返回作者公开昵称/头像，不返回登录邮箱或私有pet档案。

`PublicProfile={userId,nickname,avatar,city,district,petTypes:('cat'|'dog')[],purposes:string[],discoverable:boolean}`；目的固定为`新手互助|遛宠搭子|养猫交流|多宠家庭`。action `profiles.getOwn|saveOwn|discover`，discover只返回discoverable=true的公开字段。

## Task 1 真实共享图文与互动

**Files:** `community.cjs`、`community.js`、`api.cjs`、仓储、`tests/community.test.js`、`tests/integration/community.test.js`。

**Consumes:** Principal、CloudStore、prepareImageUpload/confirmImage与统一API协议。**Produces:** 上述社区action，示例不入真实集合；云端snapshot无需加载整个社区。

- [ ] Step 1：写测试：A发帖B读取成功，B编辑A帖子FORBIDDEN；未登录写UNAUTHENTICATED；相同liked=true重试两次仍count=1；不存在/已删帖子不能评论；不能引用其他用户fileId；正文`<script>`作为纯文本返回。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(editByOtherAuthor.error.code, 'FORBIDDEN');
assert.equal(secondLike.data.likeCount, firstLike.data.likeCount);
assert.equal(retrievedPost.text, '<script>alert(1)</script>');
```

- [ ] Step 2：运行 `node --test tests/community.test.js`，确认跨账号共享与权限未实现时失败。
- [ ] Step 3：实现分页读写、作者校验、点赞唯一约束与删除状态；复用存储后再发布正文，失败保留编辑器。前端用文本转义/安全DOM，不插入未转义HTML。
- [ ] Step 4：运行单元测试、`npm test`和两个真实账号集成测试，检查重新登录/另一设备可见，弱网重试不重复发布；测试账号内容带标记并在结束后清理自己的测试内容。
- [ ] Step 5：提交 `feat: share pet posts comments and likes across accounts`。

## Task 2 冷启动 举报与成长故事分享

**Files:** `reports.cjs`、`community.js`、`weekly-recap.js`、`tests/community-flows.test.js`、浏览器测试。

**Interfaces:** `community.report({postId,reason},principal) → {reportId,status:'queued'}`；`community.hide({postId},principal)` 只影响本人阅读，不能伪装成删除全站帖子。管理员处置由可信服务端角色/控制台完成，普通用户不能自行成为管理员。

- [ ] Step 1：写测试：真实帖子为空时示例区域标明示例；report不自动全局删除；B无法修改A举报状态；隐藏只影响B；回顾预览取消无帖子，确认仅发布选定公开内容。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(reportResult.data.status, 'queued');
assert.equal(listReadByA.items.some(p => p.id === hiddenByB), true);
assert.equal(postsAfterCancelledPreview.length, postsBeforePreview.length);
```

- [ ] Step 2：运行 `node --test tests/community-flows.test.js`，确认缺失行为失败。
- [ ] Step 3：实现示例/真实标签、空状态话题引导、举报入队和个人隐藏；回顾分享到已确认的发布表单。写运维说明列出如何查看并处理queued举报，不宣称即时审核。
- [ ] Step 4：运行全套测试，浏览器验证冷启动、举报回执、个人隐藏和回顾确认分享；检查帖子中没有默认带出疫苗历史/私人日期。
- [ ] Step 5：提交 `feat: add honest community onboarding and explicit story sharing`。

## Task 3 主动公开的同城资料与组合筛选

新增N-07已确认：扩大国内可搜索地域目录，主动点击可选浏览器定位，只辅助填城市/行政区；拒绝/失败继续手动。不加入精确距离或地图，具体目录/API/费用正式执行时核对，本session不调用。详见[决策记录](2026-10-06-followup-discussion.md)。

**Files:** `profiles.cjs`、`nearby.js`、`region-filter.js`、`regions.json`、`tests/profiles.test.js`、`tests/region-filter.test.js`、集成测试。

**Interfaces:** `normalizeRegion({city,district},regionDirectory) → {city,district:null|string}`；`matchesProfile(profile,{city,district?,petType?,purpose?}) → boolean`；`profiles.saveOwn(input,principal)` 不接受他人userId。区域目录扩充国内城市/行政区，来源/版本/缺漏写文档；`suggestRegionFromLocation(): Promise<{city,district}|null>`仅在用户点击后请求权限，坐标转换API待正式实施核对，不持续追踪/保存精确坐标。

- [ ] Step 1：写测试：深圳/南山切到上海时district清空；同城+猫+养猫交流组合正确；discoverable=false与隐藏资料立即排除；公开响应无邮箱、private record和地址；与当前用户自身区分。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(normalizeRegion({city:'上海',district:'南山区'}, regions).district, null);
assert.equal(discovery.items.some(p => p.discoverable === false), false);
assert.equal(publicProfile.email, undefined);
```

- [ ] Step 2：运行 `node --test tests/profiles.test.js tests/region-filter.test.js`，确认缺失过滤/公开字段规则失败。
- [ ] Step 3：核对更广国内地域目录来源，实现可搜索城市/行政区、主动加入/退出、目的与宠物筛选、无结果放宽条件；正式核对定位与坐标转地域API/费用后实现可选辅助填写，不在打开页面时自动申请权限。真实匹配资料自己公开，示例独立标识。
- [ ] Step 4：运行测试和两个真实账号地域/退出发现集成验证，检查六城之外搜索/行政区联动、定位授权/拒绝/超时/不支持及手动回退、无坐标泄露；核对实际转换结果，不用mock算真实定位通过。
- [ ] Step 5：提交 `feat: discover opted-in pet friends by district and purpose`。

## 阶段退出标准

两账号图文/评论/点赞共享可用，作者权限有效；主动加入与退出发现生效，组合筛选可解释。示例与真实内容区分，成长回顾分享须确认。原候选v0.5.0已由健康修订使用；新版本号先与用户对齐，仅在真实后端及原URL验证通过后发布，不移动旧tag。
