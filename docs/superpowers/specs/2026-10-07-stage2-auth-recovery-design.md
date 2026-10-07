# 阶段2认证恢复：诊断设计与决策边界

状态：本轮仅规划。尚未开始探针、收码、维修、云配置变更或部署；后续路线依赖真实诊断结果。本文件补充阶段2已有设计，不能解释为已解决故障。

## 用户意图与成功条件

用户要求先用Superpowers分析下一步，必要时寻找GitHub认证技能，本轮不维修。产品方向沿已确认决定：免登录本地记录；邮箱注册/登录后私有跨设备使用；保持原地址、V3生命周期及媒体可靠性。

成功条件是同一真实邮箱账号完成签发、SDK登录态、连续刷新、关闭重开及另一浏览器登录，可信平台UID不变；新用户没有旧验证记录也能安全首登。A/B/真实匿名权限、云媒体和迁移门槛全部通过后才允许0.3发布。

## 已知事实与未知项

- `test-results/stage2/inspector-same-device-flags.log`证明旧A/B真实SDK私有snapshot成功；同原设备refresh仍unauthorized_client。元数据v1/Bearer补齐、公开key认证头补齐均没有刷新正向。
- `app.js:161`注入invokeAuth，因此当前UI使用服务端OTP桥接。原生SDK OTP备用分支是另一入口。只读现代码不足以确定每份历史RAM凭据的最初来源，必须补样本来源台账。
- `src/ui/account.js:36`仅在request返回且epoch/generation仍有效后保存challenge；收到邮件不等于函数返回被界面采纳。UI禁用问题与refresh暂按两个故障处理。
- `backend/email-auth.cjs:29`仍只返回两token；前端和验收文件保留元数据不能代替此边界检查。但已有A/B实际是v1，所以这一缺陷尚不是已证明的刷新根因。
- 原设计由SDK管理OTP会话、原始email_verified严格校验；当前实现加入server-mediated OTP和私有验证证明。须对齐责任边界，不能仅在旧规格上继续补丁。
- 平台实际客户端身份、完整机器错误码、旧refresh是否已撤销/过期，以及新鲜原生SDK会话能否立即刷新，均未知。access可读不证明refresh有效。

## 推荐决策顺序

先以锁定SDK3.10.1创建官方原生OTP最小基线，并与现有桥接分组比较；在得到证据前不更换供应商、不升级SDK、不扩大登录方式。

1. **原生与桥接新鲜会话都失败：**定位客户端/provider/授权策略或版本契约，保留最小复现及脱敏证据。修改只能针对有证据的不一致项。
2. **原生闭环成功，桥接失败：**优先让SDK统一负责平台signin及会话生命周期，服务端保留独立OTP证明与可信所有权检查。不得因为A/B已有proof就让所有用户绕过验证。
3. **新鲜会话成功，仅旧文件失败：**定位会话撤销、实验并发、刷新轮换及保存方式；修改验收工具和必要的会话管理，不重写登录系统。
4. **刷新成功但UI仍卡住：**独立处理发码结果、busy和代际状态，不拿协议修改代替UI故障证据。

第二分支的可行接口线索：3.10.1本地声明公开signIn支持username/verification_token，signUp支持email/verification_token；这只能证明接口存在，跨服务端验证回执是否能由SDK消费尚未实测。若选该分支，应另行明确“服务器核验验证码→SDK平台登录→可信UID确认并提交proof”的短时回执协议、消费/重试和错误状态，再实施。不得先删除auth_verified或直接信前端验证标志。

## 技能研究

本轮应用using-superpowers、systematic-debugging与writing-plans；用brainstorming审视边界，用独立explorer只读核对代码。

公开GitHub页面在2026-10-07本轮读取时显示：TencentCloudBase/cloudbase-skills 35 stars；wshobson/agents约40.3k；better-auth/skills 222。这是仓库热度，不是单个技能评分。

- 官方CloudBase auth-tool/auth-web最贴合当前栈，强调应用认证配置和内置SDK登录。作为对照清单；其latest示例仍需逐条映射到本项目3.10.1，不能直接复制调用形态。
- wshobson的auth-implementation-patterns适合补充认证/授权、会话及资源所有权审查，不能代替CloudBase专属协议。
- Better Auth技能面向另一认证框架，本轮不选用来改造项目。

本轮只研究参考，未安装技能/MCP/产品依赖。后续如正式采用官方技能，读取完整本地包及相关引用，保持产品依赖版本锁定。

来源：[CloudBase仓库](https://github.com/TencentCloudBase/cloudbase-skills)、[auth-web](https://github.com/TencentCloudBase/cloudbase-skills/blob/main/skills/cloudbase/references/auth-web-cloudbase/SKILL.md)、[auth-tool](https://github.com/TencentCloudBase/cloudbase-skills/blob/main/skills/cloudbase/references/auth-tool-cloudbase/SKILL.md)、[wshobson仓库](https://github.com/wshobson/agents)、[通用认证技能](https://github.com/wshobson/agents/blob/main/plugins/developer-essentials/skills/auth-implementation-patterns/SKILL.md)、[Better Auth仓库](https://github.com/better-auth/skills)、[create-auth](https://github.com/better-auth/skills/blob/main/better-auth/create-auth/SKILL.md)。
