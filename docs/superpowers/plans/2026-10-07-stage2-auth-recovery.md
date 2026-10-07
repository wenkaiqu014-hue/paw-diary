# 阶段2认证链诊断与恢复 Implementation Plan

> 本计划已获后续执行及最终修复/发布授权。执行使用systematic-debugging/TDD，独立审查与最终验证分开记录。下列勾选仅指实际步骤；未创建的原拟定诊断文件不算已实现，已采用的等价证据明确列出。

**Goal:** 取得可复现的认证根因，修复登录/刷新/恢复闭环，完成阶段2真实技术退出门槛并沿原地址发布。

**Architecture:** 服务端paw-auth调用平台标准邮箱signIn/signUp签发，会话由锁定CloudBase SDK安装与刷新；服务端保留真实OTP验证、短期回执及可信UID绑定证明。paw-api继续要求平台可信UID与实际验证证明，不信客户端verified声明。

**Tech Stack:** 原生ESM、@cloudbase/js-sdk 3.10.1、@cloudbase/node-sdk 3.18.3、Node测试、Python Playwright、现有CloudBase函数与私有存储。

**Spec:** [诊断设计](../specs/2026-10-07-stage2-auth-recovery-design.md)、[阶段2产品设计](../specs/2026-10-07-stage2-local-cloud-design.md)、[原阶段计划](2026-10-06-02-cloud-identity.md)。历史仅规划状态保留在SESSION_LOG；最新结果见[阶段2报告](../../verification/stage2-report.md)。

## Global Constraints

- 固定原环境paw-diary-d8g3p4tlsb305221d/ap-shanghai与FUJI管理环境变量；管理成功不代替真实用户验收，凭证不回显/提交。
- 只开放邮箱。匿名仅用于实际拒绝验收的受控采集窗口，最终provider关闭；手机号和用户名关闭，不放宽私有规则。
- 原网址、四个hash路由、旧tag、canonical V3及旧原文/备份保留，登录不自动上传或复活数据。
- owner仅来自可信平台上下文；邮箱、转换日期、非空UID、解析JWT或客户端flag均不作为验证证明。
- SDK版本保持锁定版本；不造v2、不盲填client_secret，不用管理SecretKey作客户端凭证。
- refresh串行执行，成功立即原子保存轮换后的凭据；actor缓存隔离，不让多个Worker消费同一refresh token。
- 私密会话文件0600且Git忽略；报告仅记机器状态、布尔比较和耗时，不记录邮箱/码/UID/token。
- 技术门槛、固定产物复验、公开发布和用户体验分别记录。全项目截止2026-10-08 20:00不变。

## Task 1：来源核对与诊断基线

**实际文件/证据:** `scripts/capture-cloud-sessions.mjs`、`scripts/lib/capture-session.mjs`、`tests/capture-session.test.js`、`test-results/stage2/`受控诊断与SESSION_LOG。原拟定`auth-contract-probe.mjs`、`auth-probe.test.js`、`stage2-auth-contract.md`未单独创建，使用既有入口采证与单测，不虚勾原文件交付。

- [x] 区分历史原生SDK与服务端桥接实验，旧缓存/旧凭据失败保留为历史，不当成最新客户端结果。
- [x] 核对锁定SDK及真实平台契约，按单项证据修复，未通过时保留unknown与failclosed。
- [x] 新鲜受控网页登录分别完成已有用户登录、真正新用户注册、当前SDK身份读取、刷新与重开；不通过复制token伪装新设备首次登录。
- [x] 新用户返回省略is_user时采用已核注册契约；真实结果不依赖旧proof，paw-auth于14:21:26部署Active。

## Task 2：登录UI pending与迟到事件

**实际文件/证据:** `src/ui/account.js`、`src/auth/cloudbase-auth.js`、`tests/auth-client.test.js`、`tests/helpers/ui-contract-server.mjs`、`tests/e2e/cloud-contract-ui.py`。原拟定独立auth-send-state测试未创建，采用现有账号契约及真实UI执行等价验证。

- [x] 保留旧请求代际guard、输入与重试；账号切换或迟到响应不更新新账号表单。
- [x] 修复同用户异步认证事件误判，已有用户与新用户网页登录均完成验证码提交、刷新与关闭重开。
- [x] 15项账号契约整套通过；真实UI脱敏证据为`test-results/stage2/auth-real-ui-report.json`，不同SDK身份且pageerrors=0。

## Task 3：最小认证修复与验证证明

**Files:** `src/auth/cloudbase-auth.js`、`backend/email-auth.cjs`、`backend/identity.cjs`、`cloudfunctions/paw-auth/index.js`、`tests/auth-client.test.js`、`tests/cloud-server-auth.test.js`。

- [x] SDK处理signin/signup/session，服务器实际OTP形成验证回执并绑定可信平台UID；不删除serverProof，不设置假verified字段。
- [x] 新用户契约、旧回执/换邮箱/迟到响应、未知错误与会话轮换有单测；真正无旧proof的新用户注册与后续私有访问有实测。
- [x] 选定paw-auth部署并读回Active，保持原环境与邮箱only；平台元数据按实际值保留，不造授权字段。

## Task 4：真实验收工具持久化

**Files:** `scripts/lib/capture-session.mjs`、`scripts/capture-cloud-sessions.mjs`、`tests/integration/cloud-client-worker.js`、`tests/integration/cloud-harness.js`、`tests/session-capture-persistence.test.js`。

- [x] 修复refresh轮换后最新credentials未及时写回，串行原子保存0600私密文件，保留其他actor及实际metadata；相关回归通过。
- [x] 强制fresh资料读取，SDK actor隔离缓存与管理变量；拒绝未知/网络失败，不将其当权限通过。
- [x] 匿名actor只用于拒绝用例；14:24:55临时捕获，14:25:20恢复匿名provider=false并读回，不用于修复邮箱登录。

## Task 5：真实技术门槛与独立审查

**Files:** `tests/integration/{cloud-auth,cloud-private,photos-private,cloud-import}.test.js`、本轮受控浏览器记录、阶段2验收报告。

- [x] 四个集成文件共五case全部PASS、0FAIL、0SKIP，原始日志为`test-results/stage2/final-real-{cloud-auth,cloud-private,photos-private,cloud-import}.log`。
- [x] A已有用户登录、B真正新用户注册、各自刷新与重开；身份不同，pageerrors=0；旧final-real-browser.log仍是此前失败，不当当前证据。
- [x] A/B健康与媒体隔离、未登录/真实匿名拒绝、直接数据库/对象拒绝、CAS/回执、近1MiB私有图与deletedAt/图片批次幂等迁移均实测通过。
- [x] 13:16:19–14:01:19完成单轮独立审查及修复，本轮最新246单测无跳过、15账号契约/6媒体模拟边界通过。
- [x] 发布负责人以最终固定hash重新完成全部构建/白名单/语法与八套旧浏览器及新增界面复验，填写证据；早期hash结果不冒充最终产物。

## Task 6：原URL发布与用户交接

- [x] 报告列清真实技术门槛已通过与真机/触控/读屏/200%缩放/Google及Outlook实导等阶段5未验范围。
- [x] 合并/推送原main，完成原URL的Pages部署、匿名新浏览器验收，核对最终源码/hash/工作流。
- [x] 新建v0.3.0 tag与公开Release，旧tag不移动；填写真实发行时间与目标提交。
- [ ] 用户亲自体验确认，之后按既定顺序衔接阶段3；本轮不扩展AI、真实社区或复杂认证。

主agent管理共享业务、云配置、最终复验、Git/部署和SESSION_LOG；文档worker仅更新状态。最终QWW76HLZ/E5、enabled=true已在原URL发布，12本地与12公开匿名浏览器全过，Root真实私有恢复/刷新及图库读图也通过。源码/tag4d7f2e9与Pages37583390404一致，14:46:53部署、14:48:48 Release公开且非draft/非prerelease，旧tag不变；readiness14:41:55已删除且公共规则读回移除。用户亲自体验仍未勾。下一轮从主目录main的[阶段3计划](2026-10-06-03-ai-onboarding-recaps.md)续作，不再从旧工作树重复实施；早期资金/邮箱/profile布尔/refresh阻塞仅作历史，AI与真实社区未完成。
