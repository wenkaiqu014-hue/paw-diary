# 登录与云端私有档案 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 访客仍能免登录体验，真实用户登录后保存私有多宠物档案并跨设备同步。

**Architecture:** 前端继续部署 GitHub Pages；建议后端使用腾讯云 CloudBase 的身份、文档数据库、存储和云函数，统一通过 `paw-api` 业务函数访问私有数据。客户端公开配置与服务端密钥分开；演示仓储和云端仓储采用第一阶段的相同接口。CloudBase 是本计划的建议选型，账号、预算和能力验证通过后才开通与实现，不假定已有环境。

**Tech Stack:** 原生 ESM、esbuild、CloudBase Web/Node SDK、node:test、Python Playwright。执行时核对 V3 与实际可用 SDK/运行时并锁定版本，不从旧版 `_openid` 示例推断 V3 登录身份。

**Spec:** `ROADMAP.md` §2、§5、§7；`PENDING.md` P1-01–03；前序 `2026-10-06-01-local-foundation.md`。

## Global Constraints

- 原 URL 和四个 hash 路由不变；云端异常时访客演示仍可用。
- 未明确计费边界，不开通收费资源、不调用付费模型；个人笔试资源不默认走集团账单。
- 不在浏览器接受 ownerId 作为授权依据；身份只从验证后的平台调用上下文获取。
- 前端只发布环境ID、地域和平台允许公开的 Publishable Key，不包含管理或 AI 密钥。
- 示例记录不自动成为真实账户的数据，私有健康资料不公开。

## Review Focus

1. 登录过期与迟到响应：用户退出后，旧请求不能把上个用户数据重新渲染。Task 2、3 验证。
2. 伪造 ownerId/petId：另一用户不能读、改或完成事项。Task 3 验证。
3. v1 演示和自建数据混合：迁移必须预览，只上传用户选中内容。Task 4 验证。
4. 云函数管理员身份：前端数据库规则不足以保护函数读写，业务函数再次检查归属。Task 3 验证。
5. SDK/邮件注册不可用：没有验证真实账号前不能替换线上主入口；预设资料不算登录成功。Task 1 验证。

## 文件与接口

新增 `src/auth/cloudbase-auth.js`、`src/data/cloud-repository.js`、`src/config/public-config.js`、`src/ui/account.js`、`backend/{api,identity,health,storage,cloudbase-store}.cjs`、`cloudfunctions/paw-api/{index.js,package.json}`、`scripts/{build,build-functions}.mjs`、`docs/operations/cloud-setup.md`、`.env.example`、`tests/cloud-*.test.js`、`tests/integration/cloud-private.test.js`；修改 `package.json`、`.gitignore`、发布工作流、`app.js`、`index.html`。

客户端 `AuthAdapter`：`getSession(): Promise<{userId:string}|null>`、`startRegistration({email,password}): Promise<{registrationId:string}>`、`verifyRegistration({registrationId,code}): Promise<{userId:string}>`、`signIn({email,password})`、`signOut()`、`subscribe(listener): unsubscribe`。registrationId 仅映射本次平台注册流程，不自己创造登录身份。

函数协议：`{version:1,action,payload,idempotencyKey?}` → `{ok:true,data}` 或 `{ok:false,error:{code,message}}`。错误码固定 `UNAUTHENTICATED|FORBIDDEN|INVALID_INPUT|CONFLICT|UNAVAILABLE`。客户端 `invoke(action,payload,options): Promise<data>` 将失败 envelope 转为明确错误。

`Principal={userId:string}`；`resolvePrincipal(platformContext): Promise<Principal>`。`handleRequest(request,{principal,store,clock}): Promise<Envelope>` 不把客户端 payload 的 ownerId 写入数据库。`CloudRepository` 实现前序 Repository，并由函数提供 `health.snapshot|pets.save|records.save|records.delete|reminders.save|reminders.complete`。

数据库集合 `pets`、`health_records`、`reminders`、`mutation_receipts` 均含 `ownerId`；幂等记录键 `{ownerId,idempotencyKey}`，重复请求返回原结果。私有集合禁止前端直接访问。`CloudStore` 提供 `findOwned(collection,id,ownerId)`、`listOwned(collection,ownerId)`、`saveOwned(collection,doc,ownerId)`、`transaction(callback)`；事务内完成提醒状态、关联记录和幂等回执。具体 SDK 语法在能力验证中锁定，并用真实环境集成测试验证。

## Task 1 验证平台 注册方式与构建产物

**Files:** `cloud-setup.md`、`.env.example`、`scripts/build.mjs`、`src/config/public-config.js`、`package.json`、发布工作流、`tests/build.test.js`、`tests/integration/cloud-auth.test.js`。

**Consumes:** 固定 URL、已确认账户/预算。**Produces:** 可实际注册的测试环境；`npm run build` 输出 `dist/`，仅静态网页和打包后的客户端；可确认邮件注册和OTP到达能力。

- [ ] Step 1：写构建测试，断言产物只含公开配置与客户端代码，没有 `backend/`、`.env`、`TEXT_AI_API_KEY`、`MINIMAX_API_KEY`、`TENCENTCLOUD_SECRET_KEY` 的值；在 `/paw-diary/` 路径能打开四页。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(publicFiles.some(path => path.startsWith('backend/')), false);
assert.equal(publicFiles.includes('.env'), false);
assert.equal(leakedSecretValues.length, 0);
```

- [ ] Step 2：运行 `node --test tests/build.test.js`，确认未实现构建时失败。
- [ ] Step 3：在预算内验证环境及邮件认证，记录具体 SDK 版本和运行时；邮件/认证方式不可用时暂停这一阶段，修改方案后再继续，不自行写密码系统。增加 esbuild bundle，Pages 改为上传 `dist/`，本地页面也以 dist 验证。
- [ ] Step 4：运行构建测试、`npm test`、现有浏览器测试；在已获授权的真实环境验证两个邮箱注册、验证码与登录成功。记录失败信息，不在日志写邮箱密码/token。
- [ ] Step 5：提交 `build: add cloud-ready static bundle and verified auth setup`。

## Task 2 登录状态与访客模式

**Files:** `cloudbase-auth.js`、`account.js`、`app-session.js`、`app.js`、`tests/cloud-session.test.js`；扩展 `test_app.py`。

**Consumes:** 前序 Repository 和本阶段 AuthAdapter。**Produces:** `switchSession({mode:'demo'|'account',auth,repository}): Promise<void>`；每次切换增加 generation，只有当前 generation 的响应可更新页面。

- [ ] Step 1：写测试：未登录能进入 demo；登录用户 snapshot 不包含示例宠物；开始旧请求后退出再返回，该响应不渲染；失败不丢演示数据；登录过期只清当前账号可见缓存，不清原备份。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(sessionAfterLogout.mode, 'demo');
assert.equal(snapshotAfterLateAccountResponse.mode, 'demo');
assert.equal(accountSnapshot.pets.some(p => p.id === 'pet-mochi'), false);
```

- [ ] Step 2：运行 `node --test tests/cloud-session.test.js`，确认缺失行为失败。
- [ ] Step 3：实现真实平台注册/验证/登录/退出界面及会话切换，密码输入不进入应用 state/日志；个人空间加载失败显示重试，不自动混入示例。
- [ ] Step 4：运行该组测试、`npm test`、浏览器匿名入口和登录退出流程；验证重新登录状态正确。
- [ ] Step 5：提交 `feat: add guest demo and authenticated personal workspace`。

## Task 3 私有健康 API 与跨账号隔离

**Files:** `identity.cjs`、`api.cjs`、`health.cjs`、`cloudbase-store.cjs`、`cloud-repository.js`、云函数入口及构建脚本；`tests/cloud-private.test.js`、`tests/integration/cloud-private.test.js`。

**Consumes:** HealthRecord/Reminder 模型；Principal、CloudStore 和函数协议。**Produces:** 六个健康 action；ownerId 不可变，所有关联 petId/recordId 均检查归属。

- [ ] Step 1：写服务测试：A创建的 pet，B读取/修改/完成均返回FORBIDDEN；未登录UNAUTHENTICATED；伪造payload.ownerId不改变实际归属；重复完成只增一条；空账户 snapshot 返回空数组。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(readByB.error.code, 'FORBIDDEN');
assert.equal(writeWithoutSession.error.code, 'UNAUTHENTICATED');
assert.equal(secondCompletion.data.record.id, firstCompletion.data.record.id);
```

- [ ] Step 2：运行 `node --test tests/cloud-private.test.js`，确认未实现函数授权时失败。
- [ ] Step 3：在云函数内从平台认证上下文解析 userId，执行私有查询、编辑、删除及幂等事务；接入 CloudRepository。绝不依赖客户端传入 userId；部署前核对选定 SDK 的可信身份接口。
- [ ] Step 4：运行单元测试、`npm test`，再用两个真实账户运行 `tests/integration/cloud-private.test.js`；换浏览器确认同步，直接请求另一用户ID确认拒绝。平台SDK被 mock 的通过不算云端验收。
- [ ] Step 5：提交 `feat: persist private pet health records with ownership checks`。

## Task 4 头像与本地记录迁移确认

**Files:** `storage.cjs`、`account.js`、`cloud-repository.js`、`tests/cloud-import.test.js`、`tests/integration/cloud-upload.test.js`。

**Interfaces:** `prepareImageUpload({kind:'pet-avatar'|'post',mime,size},principal): Promise<{uploadUrl,fileId}>`；`confirmImage({fileId},principal): Promise<{url}>`。后台验证对象归属、实际类型与大小；上限沿用10MB，JPEG/PNG/WebP。`importSelectedBackup({pets,records,reminders},principal): Promise<{idMap,counts}>` 重新分配 ownerId，事务幂等。

- [ ] Step 1：写测试：10MB以上和非图片拒绝；B不能确认A的对象；备份只迁移选中的宠物/记录，示例不会默认选中；同一次导入重试不重复创建。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(uploadByOtherOwner.error.code, 'FORBIDDEN');
assert.equal(importRetry.data.counts.records, importResult.data.counts.records);
```

- [ ] Step 2：运行 `node --test tests/cloud-import.test.js`，确认缺失行为失败。
- [ ] Step 3：实现头像上传、迁移预览与确认，原备份不删除；显示云端保存结果和失败重试。登录后已发生的编辑不能被较旧迁移覆盖。
- [ ] Step 4：运行 `npm test`、实际上传与跨账号确认验证，浏览器重载头像和数据；确认没有将预置日常上传公开社区。
- [ ] Step 5：提交 `feat: upload pet avatars and confirm selected local data import`。

## 阶段退出标准

两个真实账号隔离与跨设备同步、匿名演示、实际注册验证和上传全部通过。账号能力受阻时保留上一稳定版本，不发布半通的个人入口。建议候选版本 `v0.3.0`，验收后才创建。

## 已核对的官方来源

身份概述内置网页打开超时，随后 curl 取得完整官方 HTML，核对 `signUp`、`verifyOtp`、`signInWithPassword`、`getSession` 与 Node `getUserInfo().uid`：https://docs.cloudbase.net/api-reference/webv3/authentication 。V3 具体适配仍以实际安装版本的类型与源码为准。

云函数管理员读写绕过前端数据库安全规则，须再次校验身份和归属：[CloudBase 多租户隔离说明](https://docs.cloudbase.net/recipes/secure-database-multi-tenant-rules)。该页面使用的旧版 SDK/OPENID 示例不作为 V3 API 的直接依据。
