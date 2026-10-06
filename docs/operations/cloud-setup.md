# 阶段2 CloudBase 管理与部署

本页记录实际环境配置，不能作为真实邮箱、跨账号隔离或照片权限验收通过的依据。更新依据为 `test-results/stage2/cloud-ops.log` 的北京时间工具记录；该目录被 Git 忽略。管理脚本为 `scripts/cloud-setup.py`，默认只读，写操作需指定子命令。

## 环境与凭证边界

只操作用户自行创建的 `paw-diary-d8g3p4tlsb305221d`，地域 `ap-shanghai`。2026-10-07 02:05 的 API 读回仍为 `NORMAL` / `baas_trial`，数据库实例 `tnt-bnf15cva0`、存储桶 `7061-paw-diary-d8g3p4tlsb305221d-1311902137`。脚本拒绝其他环境参数，并要求环境保持上海、NORMAL、体验版；付费环境或变配后须先按明确授权更新检查，不能自动套用。

管理凭证仅从 `TENCENTCLOUD_FUJI_SECRET_ID` / `TENCENTCLOUD_FUJI_SECRET_KEY` 读取，不使用个人默认或集团变量，不存 CLI 登录态，不把管理凭证发送到函数环境。Python 管理 SDK 为 `tencentcloud-sdk-python 3.1.177`；核接口/询价临时安装的 `@cloudbase/manager-node 5.9.0` 位于 `/tmp/paw-cloud-ops-tools`，没有修改项目包或 Shell 配置。

前端公开配置产物为 `test-results/stage2/public-config.json`。公开密钥来自 `DescribeApiKeyList(KeyType=publish_key)`，类型与名称均已核对；完整公开值只保存到产物，不在管理日志回显。`api_key` 是管理员访问凭证，不可替换成公开密钥。前端初始化时应按锁定 Web SDK 源码读取该公开配置；`env` 和 `region` 可公开。

## 实际配置及未完成项

2026-10-07 02:02–02:05：`EmailLogin=true`，`UserNameLogin=false`、`PhoneNumberLogin=false`、`AnonymousLogin=false`。`email` 身份源 `On=TRUE`，平台代发 `EmailConfig.On=TRUE`，邮箱与手机号自动关联均显式关闭。没有请求发送验证码，也未进行收信验收。默认客户端的正确 ID 等于环境 ID，不能传 `default`；`MaxDevice=5` 已读回，允许跨浏览器验证。

创建了五个集合：`health_workspaces`、`health_receipts`、`media_assets`、`import_batches`、`import_maps`。`DescribeResourcePermission` 实际读回五个集合均 `CUSTOM` / `{"read":false,"write":false}`。业务函数仍须通过可信 Principal、owner 与父实体校验；管理员 SDK 能访问不等于客户端或跨账号安全。

函数规则实际读回：默认 `*` 拒绝调用，`paw-api` 仅 `auth!=null`，临时 `paw-stage2-readiness` 允许调用。readiness 只返回身份字段存在性/布尔值与事务是否可读，不输出 UID、邮箱或 token。最终验收后需移除临时函数并删其规则。

安全域名 `CreateAuthDomain` 请求 `wenkaiqu014-hue.github.io`、`localhost`、`127.0.0.1` 返回 `OperationDenied.FreePackageDenied` /「当前套餐无法执行此操作」。因此正式 GitHub 网页来源尚未配置，不伪造 Origin 继续访问。原始唯一 USER 域 `paw-diary-d8g3p4tlsb305221d-1311902137.tcloudbaseapp.com` 在首次配置中已删除，未涉及业务数据；随后只读确认剩余均 SYSTEM 域。不会在重试中继续删除默认资源。普通域名无需协议或路径，端口支持范围见官方安全来源文档。

存储安全规则未生效。首次 `ModifyResourcePermission(ResourceType=storage,Permission=CUSTOM,SecurityRule=deny)` 返回 `Data.Success=true`，但读回仍 `PRIVATE`、空 rule。进一步按 Manager SDK 当前实现调用真实 `DescribeStorageSafeRule` 确認 `PRIVATE`；`ModifyStorageSafeRule(AclTag=CUSTOM,Rule=deny)` 返回 `OperationDenied.FreePackageDenied`。脚本改用后者设置并读回规则，失败会明确记录；不能把前者成功响应写成存储禁止直接读取已通过。PRIVATE 仅创建者与管理员可读写，不满足本项目全部媒体走业务接口的严格要求。

## 函数部署与管理探针

由 `npm run build:functions` 打包主函数，临时 readiness 使用 esbuild 单独打包。全部依赖在 bundle 中，不线上安装 node_modules。两函数部署通过 CloudBase `CreateFunction`，`Nodejs18.15`、256MB、3秒，`TZ=Asia/Shanghai`，没有创建自动 CLS 主题或升级套餐。

| 函数 | 云端ID | 读回版本/状态 | 创建时刻 |
| --- | --- | --- | --- |
| `paw-api` | `lam-b4mc5ufb` | `$LATEST` / `Active` | 2026-10-07 02:03:22 |
| `paw-stage2-readiness` | `lam-3kb2gssh` | `$LATEST` / `Active` | 2026-10-07 02:03:12 |

管理端 SCF Invoke 在 2026-10-07 02:03:36 返回 `InvokeResult=0`、Duration 1435ms；`databaseTransactionReadable=true`、`storageNamespacePresent=true`，context UID 与匿名标记均不存在。此调用确认函数可执行与数据库事务接口可读，不是邮箱 Principal、数据写入、3秒内图片闭环或匿名用户验收。邮箱人工验证在主agent最终验收阶段进行。

## 实际只读报价

截至2026-10-07 02:05，仅使用 Manager SDK `env.calculatePackageModifyPrice` / `env.calculatePackageCreatePrice`，底层是 `billing CalculatePrice`，未调用 GenerateDeals、CreateBillDeal、PayDeals 或 ModifyEnvPlan。

| 方案 | 只读实际金额 | 期限 | 当前决定 |
| --- | --- | --- | --- |
| 原体验环境升为 `baas_personal` | `RealTotalCost=11939` / `AmountUnit=pent`，即 **119.39元** | 剩余6个月，原到期2027-04-07 23:59:59不变 | 超过本次20元，未执行 |
| 新购上海 `baas_personal` 1个月 | `RealTotalCost=1990` / `AmountUnit=pent`，即 **19.90元** | TimeSpan=1、TimeUnit=m；尚未创建，实际到期未产生 | 报价已回报root，等待root确认具体执行范围 |

官方说明升配覆盖原套餐剩余时长，用户不能选择升配期限，所以不能把原免费六个月只转成个人版一个月。原到期不变。新购方案如获明确执行授权，必须再次核价格、仅一个月、不自动续费/不超额按量、实际到期读回；网页与GitHub仓库地址仍保持。不能将20元/月理解成119.39元本次总额授权，也不能将询价成功称为付费环境创建成功。

## 命令与验证

```sh
python3 scripts/cloud-setup.py guard-check
python3 scripts/cloud-setup.py inspect
python3 scripts/cloud-setup.py configure
npm run build:functions
python3 scripts/cloud-setup.py deploy --function paw-api --bundle test-results/stage2/functions/paw-api
python3 scripts/cloud-setup.py deploy --function paw-stage2-readiness --bundle test-results/stage2/functions/paw-stage2-readiness
python3 scripts/cloud-setup.py invoke-readiness
```

`guard-check` 正常退出0；`--env other guard-check` 返回2且在初始化 SDK 前拒绝。Python编译与 `git diff --check` 退出0。首次 configure 是初版脚本，API失败被摘要但总退出0；随后已修正为收集失败并非0退出，同时移除重试默认域删除、改用真实存储规则接口、创建公开密钥后重新按类型查询。以逐 API 日志与实际读回为准，不以首次总退出码表示全部完成。

## 官方来源与目录覆盖

复用 `/tmp/paw-cloudbase-876.md` / `.json` 的产品876完整目录（前轮盘点240节点、209页面），本轮按登录/客户端/密钥/规则/集合/云函数/计费定位相关页；没有通读全部209页。腾讯官网及 docs.cloudbase.net 若有超时，进行了同页重试；错误页 `876/34817` 是未命中目录的旧路径，已改用目录实际 `876/127968`。

- 目录根：https://cloud.tencent.com/document/product/876
- 登录策略：https://cloud.tencent.com/document/product/876/129351
- 邮箱身份源：https://cloud.tencent.com/document/product/876/129350
- 客户端：https://cloud.tencent.com/document/product/876/129355
- 公开密钥创建：https://cloud.tencent.com/document/product/876/129835
- 公开密钥列表：https://cloud.tencent.com/document/product/876/129833
- 创建集合：https://cloud.tencent.com/document/product/876/127968
- 配置资源权限：https://cloud.tencent.com/document/product/876/132255
- 读回资源权限：https://cloud.tencent.com/document/product/876/132256
- 规则语法：https://cloud.tencent.com/document/product/876/123478
- 数据库规则：https://docs.cloudbase.net/database/security-rules
- 创建云函数：https://cloud.tencent.com/document/product/876/137951
- 安全域名API：https://cloud.tencent.com/document/product/876/42764
- 安全来源及端口：https://docs.cloudbase.net/envconfig/security/intro
- 套餐期限/变配：https://cloud.tencent.com/document/product/876/136006
- 套餐查询：https://cloud.tencent.com/document/product/876/78167
- 变配会自动支付，未调用：https://cloud.tencent.com/document/product/876/128591
- 计费订单，未调用：https://cloud.tencent.com/document/product/876/128117

## 后续具体购买授权与失败

root 于本任务后续明确授权新购上海 `paw-diary-prod` / `baas_personal` 1个月，本次总额不超过20元，保留原体验环境、沿用原仓库与GitHub网页；不升原环境六个月、不自动续费、不超额按量、不充值。

在工具时间2026-10-07 02:07–02:08，重新询价19.90元后，以 `CreateBillDeal(CreateAndPay=false)` 创建一笔待支付订单，`TimeSpan=1`、`TimeUnit=m`、`EnableExcess=false`、`AutoVoucher=false`、`ResourceTypes=[flexdb,cos,scf]`。API返回的私密TranId只在隔离临时状态文件 `/tmp/paw-cloud-ops-tools/purchase-pending.json` 内保留（权限600），没有打印/提交；响应EnvId为空，未发货新环境。按该笔返回TranId作为 `DescribeDealsByCond(OrderId=...)` 精确核对1笔未支付订单：CNY、个人版purchase、1990分、1个月。

随后仅该笔 `PayDeals` 返回 **`FailedOperation.BalanceInsufficient`**，未支付也未充值。没有发货新环境，没有更新前端公开配置到未知环境。`public-config.json` 仍指向原trial。不能把19.90报价或待支付订单称为新环境已开通。尚需root裁决保留同笔待支付订单等待后续充值，或取消；绝不重复创建订单。

02:08最后只读检查生成 `cloud-readonly-final.log` 与 `cloud-readonly-metadata.json`（25条摘要，无失败查询）。`DescribeStorageSafeRule` 真实读回PRIVATE，五集合deny/函数规则/邮箱与MaxDevice5读回仍一致。脚本编译与 `git diff --check` 退出0。此前raw SDK结果类型误用产生一次 `TypeError`，已按SDK `call` 返回JSON字符串解析修正后复验成功。

费用API追加来源（均实际核对当前SDK与页面）：https://cloud.tencent.com/document/product/555/19178 ；精确订单查询SDK为 `billing.v20180709.DescribeDealsByCond`，未打印订单ID、付款方或创建人。

下一步：余额不足的外部条件解除后，先精确读取已有待支付订单状态与当前应付金额，确认仍为个人版1月且总额≤20元后再按root明确范围重试同笔付款；不创建第二笔或改用其他凭证。域名与存储规则限制解除后，需要真实A/B邮箱、跨浏览器、直接集合/对象拒绝、受控小PNG上传及代理读取、并发/回执/1MiB/3秒实测；这些尚未完成。

## 同笔订单保留与可恢复操作（2026-10-07 02:10–02:12）

root 最新决定：保留这一笔待支付订单，不取消、不重复创建；资金与邮箱协助集中到最终验收再找用户。目前不付款、不充值、不换账号。临时 readiness 保留到阶段7诊断清理。

私密恢复文件固定为 `/tmp/paw-cloud-ops-tools/purchase-pending.json`，权限600，包含本笔CreateBillDeal收据及精确订单复查结果；该文件不属于Git仓库、没有管理凭证、不在产品中分发。不要打印其内容、复制到SESSION_LOG或提交订单ID。该路径若被系统临时目录清理，不能通过创建第二单“恢复”；应从用户控制台确认原单后再按具体授权恢复。

只读复查命令：

```sh
python3 scripts/cloud-setup.py recheck-paid-pending
```

该命令只读取私密收据中那一笔 `OrderId`，不列举账号全量订单。02:10:46实际返回：未支付、1990分、1个月、CNY，仍在本次预算内。后续 `pay-known-pending` **仅在root明确确认钱已就位后**运行，不能因等待时间或用户随口“ok”运行：

```sh
python3 scripts/cloud-setup.py pay-known-pending --funds-confirmed-by-root
```

脚本再次精确核同一订单的状态、1990分/≤2000分、个人版产品、新购、1个月与CNY；不匹配或取消/过期均在付款前拒绝。只有未支付状态可调用该笔PayDeals；已经支付/发货状态不重复扣款。它没有创建订单、充值、升级或换凭证分支。失败仍记录安全错误；读取/日志不回显订单ID、付款人或创建人。代码内调用 `recheck_paid_pending(pay=True)` 同样需要显式资金确认参数，不只依赖CLI。

控测证明：合法夹具通过，1990以外金额（含2001、11939）、6个月、非个人版、不同订单、取消状态、USD共七种错配拒绝；未确认资金时付款helper与CLI均在SDK/网络前拒绝。CLI无资金确认返回2。真实只读复查退出0，没有再次付款。Python编译与 `git diff --check` 退出0。

付款成功后保存无秘密 `test-results/stage2/paid-environment.json`：环境ID、`paw-diary-prod`别名、金额/期限，不保存订单ID；脚本只允许该笔付款收据所对应的环境ID。Paid环境必须实际读回 `ap-shanghai`、`baas_personal`、NORMAL、别名一致，且 `IsAutoRenew=false` / `EnableOverrun=false` 才允许配置。原trial仍单独允许，其他环境拒绝。

新环境发货并读回NORMAL后的复用顺序如下；`NEW_ENV_ID`取已验证的paid-environment公开元信息，不手填其他环境ID：

```sh
python3 scripts/cloud-setup.py --env NEW_ENV_ID inspect
python3 scripts/cloud-setup.py --env NEW_ENV_ID configure
npm run build:functions
python3 scripts/cloud-setup.py --env NEW_ENV_ID deploy --function paw-api --bundle test-results/stage2/functions/paw-api
python3 scripts/cloud-setup.py --env NEW_ENV_ID deploy --function paw-stage2-readiness --bundle test-results/stage2/functions/paw-stage2-readiness
python3 scripts/cloud-setup.py --env NEW_ENV_ID invoke-readiness
python3 scripts/cloud-setup.py --env NEW_ENV_ID refresh-public-config
```

`configure`对paid环境只申请生产域 `wenkaiqu014-hue.github.io`，避免个人版域名额度不足；不删除其默认域。按真实API配置邮箱代发与关闭其他入口、MaxDevice5、五集合拒绝直读写、`ModifyStorageSafeRule`拒绝直读写、两函数规则、公开publish_key。函数创建/更新均设置公开的 `PAW_CLOUD_ENV_ID=<当前已核环境ID>` 和 `TZ=Asia/Shanghai`，确保SDK不会回退到旧trial；读取变量值确认后才返回部署成功。配置若有API失败非0退出。存储规则是否成功以真实读回为准，不用基础权限API的Success代替。

02:11–02:12原trial重新打包两个函数、更新代码与配置，最终均Active/$LATEST，公开变量读回匹配；readiness管理InvokeResult0、Duration574ms，transactionReadable与storageNamespacePresent仍true，context UID/匿名marker均不存在。没有发送邮件或签发用户会话。原环境读回依旧不自动续费、不超额按量，到期2027-04-07 23:59:59。

`refresh-public-config` 已实际核生产域、真实存储规则、邮箱代发/入口、MaxDevice、五集合与函数规则，并写 `cloudEnabled=false`、`platformSetupReady=false`、三个尚缺原因：生产域未配置、私有存储规则未配置、真实邮箱/私有访问未验证。键字段为WebSDK3.10.1的 `accessKey`（`types/index.d.ts:69`、`core.d.ts:163`），应传 `config.publishableKey`，不传管理秘密。即使后续平台设置全部通过，这个运维脚本仍保留cloudEnabled=false与真实验收待完成状态，由root依据真正验收证据决定产品启用。


## 最终受控会话捕获（尚未实测收信）

`node scripts/capture-cloud-sessions.mjs --help`说明命令；`--check`只校验已保存公开配置，无邮件/网络。正式命令要求public-config中的platformSetupReady=true，以stdin逐条输入request/verify，A/B各独立SDK Worker；不将邮箱/代码写代码或Shell历史。session写到Git忽略test-results/stage2/real-sessions.json，权限0600，仅envId及access/refresh，stdout不回显秘密。此工具按实际原始email_verified校验，不信SDK转换日期。

匿名捕获另需Root批准精确环境短时开启provider，创建真实SDK匿名会话后finally恢复关闭并读回；本次尚未执行。实际邮箱登录UI仍需独立浏览器验收，捕获工具仅为后续真实integration会话准备，不等同已接通。所有集成仍须使用同一已核环境和公开key，账号不同的SDK不得共享全局缓存，管理密钥不得进入Worker。


## 真实本地来源与临时探针清理准备

后续paid配置同时添加wenkaiqu014-hue.github.io、localhost:4193、127.0.0.1:4193并严格读回，供真实浏览器验收，保持原公开0.2直至所有门槛通过；这些只是已写入脚本，尚未在paid环境实际执行。[安全来源文档](https://docs.cloudbase.net/envconfig/security/intro)支持端口且描述默认localhost，但本trial03:32的实际10SYSTEM列表没有localhost，不假设环境已有。原“只配生产域避免个人额度”不是确认安全域仅1个，不与网站自定义域名配额混同。

函数deploy已改从同环境查询Name=publish_key再设置PAW_CLOUD_PUBLISHABLE_KEY，读回只输出是否匹配，不回显公开值或管理秘密。尚未部署此修复。验收完成可执行cleanup-readiness：只删除说明仍为Temporary stage2 identity flags only readiness probe的paw-stage2-readiness，先撤调用规则/读回，再删除/确认缺失；默认不可删除其他函数。依据[SCF当前API](https://cloud.tencent.com/document/product/583/18585)和当前SDK字段，离线guard通过；没有实际删除证明。
