# 阶段2认证链诊断与恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 后续正式执行使用superpowers:executing-plans；独立UI调查可用dispatching-parallel-agents。修复使用systematic-debugging/TDD，交付使用verification-before-completion。本轮只规划，以下执行项均未开始。

**Goal:** 取得可复现的认证根因，修复登录/刷新/恢复闭环，并完成阶段2真实退出门槛。

**Architecture:** 先区分原生SDK和服务端OTP桥接，以同环境、锁定版本、受控身份建立基线。按证据决定最小修复或SDK/服务器责任调整；始终保留可信平台UID与真实邮箱验证证明。

**Tech Stack:** 原生ESM、@cloudbase/js-sdk 3.10.1、@cloudbase/node-sdk 3.18.3、Node测试、Python Playwright、现有CloudBase函数与私有存储。

**Spec:** [本轮诊断设计](../specs/2026-10-07-stage2-auth-recovery-design.md)、[阶段2产品设计](../specs/2026-10-07-stage2-local-cloud-design.md)、[原阶段计划](2026-10-06-02-cloud-identity.md)。

## Global Constraints

- 本轮只读分析及计划/日志归档，不发码、不运行认证探针、不修代码、不改云配置、不部署、不安装依赖。
- 后续仍使用paw-diary-d8g3p4tlsb305221d/ap-shanghai及个人FUJI管理凭证；凭证只由环境变量读取。管理调用不能代替真实用户验收。
- 只开放邮箱；不通过启用用户名、手机号、匿名，或放宽私有规则来试过门槛。既有管理读取成功不能证明应用客户端授权正确。
- 公开地址/四个hash路由及旧tags不变；canonical V3、deletedAt、回收站和原备份保留，不自动上传或复活数据。
- owner仅来自可信平台上下文；有email、日期、非空UID、解析JWT或客户端verified声明均不能证明已验证邮箱。
- SDK版本先保持3.10.1；需要换版本必须先给出对应官方修复证据及独立对照结果，不同时改版本与接口参数。
- 官方技能中的queryAppAuth/manageAppAuth当前不在可用工具列表；后续使用现有官方API对应能力，必要时另配置MCP。不能假称已调用这些工具，也不为套用示例自动安装MCP。
- 真实refresh按同账号串行执行，成功后立即保存最新credentials；不让多个Worker/浏览器同时消费同一refresh token。
- 秘密不进HAR、console、Git和报告。只留请求阶段、host/path、字段名/类别、比较布尔、机器错误码、HTTP状态及耗时；私密会话文件0600且Git忽略。
- 修改和通过项必须对应新证据；候选默认enabled=false，全门槛通过前不发布0.3、不进入阶段3。

## Review Focus

1. 新用户没有auth_verified旧记录：真实验证成功才形成自己的proof，不能仅验证已有A/B。
2. 刷新轮换/撤销/设备会话上限：保存当前token、明确来源，不用access仍有效推断refresh有效。
3. 邮件已发送但响应丢失/迟到/代际变化：保输入，旧响应不得启用新账号的表单。
4. UID/邮箱绑定变化或A迟到验证：旧proof/receipt不授权B，不把旧草稿迁入新空间。
5. 错误包装吞掉平台原因：缺字段记unknown，网络/未知错误失败，不当权限拒绝或误报验证码错误。

## Task 1：冻结样本来源与创建诊断基线

**Files:** 新建`scripts/diagnostics/auth-contract-probe.mjs`、`tests/auth-probe.test.js`、`docs/verification/stage2-auth-contract.md`；只读SDK sourcemap及既有flags；按需扩展`scripts/lib/capture-session.mjs`。

**Interfaces:** 探针输入`{source:'native-sdk'|'server-bridge', operation:'login'|'refresh'|'restore', actor, configPath, privateSessionPath}`；邮箱/代码只通过stdin。输出Evidence仅含source/stage/SDK版本/host/path/字段名和比较布尔/status/errorCode/errorNumber/elapsedMs；会话另存私密文件，不在Evidence中。

- [ ] 写`auth-probe.test.js`：脱敏结果不含邮箱/UID/任何token；未知错误仍失败；native/bridge分组不可合并；参数缺省不是已核值。运行`node --test tests/auth-probe.test.js`证明RED。
- [ ] 核历史实验与实际脚本版本，建立来源台账。缺出处标unknown；凭据过期则标expired，禁止将它当客户端配置失败证据。官方introspect若无已核入口/字段则跳过并记unknown，不猜URL或强断言client_id存在。
- [ ] 以同环境/版本/受控邮箱各做一次新鲜native与bridge签发闭环，立即读资料、同实例refresh、再restore。分别留完整metadata和SDKfresh用户读取；记录provider/client配置的明确一次读回及完整安全机器错误码。
- [ ] 每次只变一个有文档依据的因素。每条链首次最多一次发码；刷新成功串行保存当前会话，失败可能改变凭据时停下，不重复消费旧码或旧refresh。额外发码先报告必要性，等待用户提供新码后继续。
- [ ] 交付基线矩阵与根因/unknown清单；诊断首轮建议限45分钟，到点仍未知则形成可提工单的本地脱敏最小复现，不新增盲补丁、不自动对外发消息。归档独立诊断提交。

## Task 2：独立定位发码UI的pending状态（可与Task1只读采证并行）

**Files:** 新建`tests/e2e/auth-send-state.py`、`tests/account-send-state.test.js`；修改候选`src/ui/account.js`、`tests/helpers/ui-contract-server.mjs`；`app.js`由主agent协调。

**Interfaces:** UI诊断事件`{stage,elapsedMs,busy,challengePresent,sameEpoch,sameGeneration,formOpen,codeDisabled}`；服务器事件send/rate-write/challenge-write/return只报阶段与耗时。两端trace标识不能进入业务owner或回执。

- [ ] 先在模拟边界建立测试：正常返回、发信后落库失败、响应丢失、迟到返回、切账号/关闭重开表单；断言新表单不受旧请求影响、输入不丢、明确错误可恢复。
- [ ] 对一次真实发码记录浏览器请求开始/结束、服务器阶段和UI是否采纳响应。没有响应、响应拒绝、包装错误、代际失配分别报告；不能从“邮件到达”推断卡点。
- [ ] 找到具体阶段后补能复现该行为的RED，才对该阶段最小修复。运行相关单测、`tests/e2e/auth-send-state.py`及`tests/e2e/cloud-contract-ui.py`；未知时只交报告，不改防串账号guard。

## Task 3：按基线结果确定并实现最小认证修复

**Files:** 可能涉及`src/auth/cloudbase-auth.js`、`backend/email-auth.cjs`、`backend/identity.cjs`、`cloudfunctions/paw-auth/index.js`、`scripts/cloud-setup.py`；测试`tests/auth-client.test.js`、`tests/cloud-server-auth.test.js`及新的真实探针。

**Interfaces:** 应用AuthAdapter既有接口保持：getSession/getRequestSession/requestEmailCode/verifyEmailCode/signOut/subscribe。认证路线和服务器proof责任必须先记录在设计补充中。

- [ ] 根据Task1选设计分支：原生也失败→真实client/provider契约；原生成功桥接失败→SDK负责signin/session、服务器负责验证证明；仅旧会话失败→保存/轮换/撤销修复。原生成功不能自动授权删除serverProof。
- [ ] 如调整桥接责任，先实证公开SDK signIn/signUp消费服务端verification_token的兼容性，并补书面状态协议：验证回执、可信UID绑定、TTL、一次消费、幂等确认、失败重试。未经实证不写入正式接口、不使用未记录的内部credential setter绕过setSession。
- [ ] 为已证实根因写RED，实施单项修复，再验证真实fresh签发→至少连续两次refresh→当前Bearer GetMe/SDK用户/可信principal一致。旧回执、换邮箱、A迟到、未知网络失败和无旧proof的新用户均有行为测试。
- [ ] 若平台元数据透传不足，保留平台实际返回的token_type/version/scope/expiry，不造v2、不传userId/groups/verified作授权。它单独通过不代表刷新根因已解决。
- [ ] 相关单测与真实基线GREEN后归档。部署仅选定的函数；若改配置，逐项限定fixed env并读回。不盲目把client_secret填成腾讯云管理SecretKey。

## Task 4：让真实验收工具可恢复、可追溯

**Files:** `scripts/capture-cloud-sessions.mjs`、`scripts/lib/capture-session.mjs`、`tests/integration/cloud-client-worker.js`、`tests/integration/cloud-harness.js`；新增`tests/session-capture-persistence.test.js`。

**Interfaces:** `mergeSessionFile(path,label,credentials)`串行原子替换0600文件，保留其他actor及实际metadata；记录source与签发/刷新阶段，诊断checkpoint不得当产品验证通过标志。

- [ ] RED覆盖轮换后的新credentials未落盘、更新A误丢B/匿名、非私密权限、跨env文件以及错误中途失败。该函数不接受日志回显秘密。
- [ ] 正常SDK安装后强制getUser(true)再getSession，读取真实当前token；每次成功更新后保存。失效凭据明确停止；不再次用Inspector作为常规捕获工具，不自动重码。
- [ ] SDK真实actor继续隔离缓存和管理环境变量，匿名actor仅用于拒绝门槛；最终匿名provider保持关闭。验证工具不能伪ctx、改JWT、放宽权限码或用管理调用替代actor。
- [ ] 如果旧匿名会话已失效，仅为真实匿名拒绝验收复用此前受控45秒捕获窗口：fixed env、创建一个actor、finally恢复关闭并读回。它不用于修复邮箱登录；必须证明匿名session本身有效，不能把provider关闭或凭据失效产生的拒绝算业务权限通过。

## Task 5：真实技术门槛与新用户流程

**Files:** `tests/integration/{cloud-auth,cloud-private,photos-private,cloud-import}.test.js`、正式真实浏览器脚本`tests/e2e/cloud-auth-real.py`及`docs/verification/stage2-report.md`。

- [ ] 同一账号串行运行四文件共五case：环境变量由已核公开配置/私密文件加载，不在Shell参数贴token。命令为`node --test tests/integration/<name>.test.js`，每文件明确PASS/FAIL/未执行，未知/网络失败不作权限成功。
- [ ] 真浏览器完成邮箱输入与验证码提交、刷新、关闭重开、另浏览器重新登录、退出回本地；跨浏览器首次登录使用独立流程，不当复制token成功就代表新设备登录。刷新恢复及会话轮换另测。
- [ ] 覆盖真实新用户无旧proof、A/B读写及直接DB/对象拒绝、近1MiB照片、完整媒体备份/确认迁移和CAS。若两受控邮箱均已注册，新用户真实注册另需未注册受控邮箱；不能删除真实账号或只靠清空UI制造“新用户通过”。缺该输入时明确未验证。
- [ ] 认证修改单轮独立审查，聚焦生命周期/receipt/所有权/新用户与迟到回调，主agent复验。运行`npm test`、`npm run build`、`npm run build:functions`、`node --check app.js`、`git diff --check`；需同最终产物跑旧八套及新账号/媒体/双语检查。

## Task 6：发布或真实交接

**Files:** SESSION_LOG/PENDING/原总与阶段计划/README/VERSION/CHANGELOG/阶段报告；GitHub工作流仍用原仓库。

- [ ] 五真实case和真实网页登录门槛全过，报告列出已验证与真机/读屏等仍属阶段5的范围；未通过维持enabled=false与阶段2未完成。
- [ ] 达到门槛后才沿原URL更新、新建v0.3.0 tag/Release并匿名复验，旧tag不移动。发布源码/hash/工作流与Release一致。
- [ ] 未过时本地提交完整日志和具体最小复现，不空报“只差验证码”，不按截止压力假绿，不重复问已确认账号/预算/产品方向。

## 分工与计划自检

执行时主agent管理探针、协议决策、共享app/仓储接口和最终复验；协议agent拥有认证/后端，UI agent拥有account.js及其测试。最多两条独立调查并行，不让多个agent改同一会话/认证模块。全部worker须知道共享代码库，不回退他人修改。

- [x] 本轮只读事实核对与独立代码审查完成，根因仍unknown。
- [x] 计划覆盖SDK契约、桥接责任、新用户proof、轮换持久化、UIpending和真实五case。
- [x] 五项Review Focus分别映射到Task1/2/3/4/5；不存在默认API版本或重复发码循环。
- [x] 技能/接口版本适用范围已注明；所有修复与真实探针checkbox未勾。
- [ ] 正式执行：等待后续明确开始；本轮不推进。
