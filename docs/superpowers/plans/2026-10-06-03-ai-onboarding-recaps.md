# AI 记录引导与成长回顾 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户完成建档、自然语言记第一笔和设提醒，并生成可核对事实的每周成长回顾。

**Architecture:** 模型只解析草稿与组织文案，确认保存和数字统计由业务代码控制。前端复用前两阶段的健康 Repository；云函数通过服务端供应商无关的文本适配器调用模型。记录和回顾分享不自动发布，手动录入一直保留。

**Tech Stack:** 已有 ESM/CloudBase 业务函数、Node 内置 fetch/AbortController、待确认的文本模型接口、node:test、Playwright。模型与API地址通过环境变量选择，以实际账号支持为准。

**Spec:** `ROADMAP.md` §2、§4、§7；`PENDING.md` P1-05–08；前序第一、第二阶段。

## 阶段3续作基线（2026-10-07交接）

用户已回复“ok”，准备在新session进入阶段3，本轮只交接。阶段2技术验收与v0.3.0发布已完成，发行源码/tag为4d7f2e9、Pages37583390404；后续README产品介绍整理已推main。下一轮从主目录main核对Git状态，先读AGENTS、SESSION_LOG最新段和PENDING，不从旧stage2工作树重复登录/云档案实施，也不把用户“ok”记为亲自跑完所有脚本。

下列五任务均尚未实施，供应商/模型/文本协议、免费额度与必要收费预算未定。成长首页已具基础界面与档案展示，Task3/4接入真实个人引导与成长回顾；Task5为只读帮助/记录助手。真实社区和正式公开分享属阶段4，遮罩说明/版本新内容/可安装网页属阶段5。

实施Task1前补齐两项实际接口取舍：当前paw-api超时3秒而本计划模型适配器默认30秒，须核对AI独立函数或运行时配置、部署与费用；免登录本地能力已上线，但免登录AI的限额及请求/私有资料边界仍须明确，不直接启用匿名云身份或绕过可信所有权。保持服务端密钥、确认写入、私有依据和手动回退，不改已验收认证主线。详细旧证据见[阶段2报告](../../verification/stage2-report.md)，实际原始工件留旧工作树Git忽略目录。

## Global Constraints

- AI 只在用户已明确供应商、账号与预算后真实调用，密钥只在服务端。
- 草稿经用户确认才保存，日期/单位/宠物不明确时补充；不生成剂量、医院、诊断。
- 回顾必须引用所选宠物与范围内的记录，数学由代码计算。
- 个人记录和回顾默认私有，分享预览不等于授权公开。
- AI 失败仍能手动录入；模型输出不被当作HTML执行。

## Review Focus

1. 用户文字含“忽略规则”等指令：只作待解析数据，无法改变归属或写库。Task 1、2 验证。
2. 昨天/月末/同名宠物/斤与公斤：绝对日期和单位可见，模糊归属不自动选择。Task 2 验证。
3. 回顾生成期间记录改变：保留依据快照，标记过时，不误导成最新统计。Task 4 验证。
4. AI超时与用户双击确认：没有重复写入，输入和可编辑草稿保留。Task 2、3 验证。
5. 模型返虚构引用/非法JSON/空正文：校验失败，不展示虚构成就或保存错误记录。Task 1、4 验证。

## 文件与接口

新增 `backend/ai/{provider,record-parser,recap,gateway}.cjs`、`src/features/{ai-entry,onboarding,weekly-recap}.js`、`src/domain/recap-facts.js`、`tests/{ai-provider,ai-drafts,onboarding,recap}.test.js`、`tests/integration/text-model-smoke.test.js`；扩展 `backend/api.cjs`、`app.js`、`test_app.py`。

`RecordDraft={draftId,petId:null|string,type,occurredDate:null|date,value:null|number,unit:null|'kg',title,note,nextDate:null|date,missingFields:string[],sourceText}`。`parseRecords({text,petIds,timeZone:'Asia/Shanghai'},principal): Promise<{draftBatchId,drafts}>` 的 today 由服务端时钟提供，不能信任客户端日期影响提醒。`confirmDrafts({draftBatchId,selectedDrafts,idempotencyKey},principal): Promise<{records,reminders}>` 校验归属、必填字段和范围，再事务保存。用户可以修改原文解析出的字段，修改后再次校验。

`computeRecapFacts({records,reminders,petId,from,to}): {recordIds,recordCount,weightChangeKg:null|number,completedCareCount,upcomingReminders,sourceHash}`；范围含首尾日期，体重差值按0.01kg精度取值，避免浮点0.20000000000000018出现在回顾。`generateRecap({petId,from,to},principal): Promise<Recap>`；`Recap={id,petId,from,to,generatedAt,sourceHash,recordIds,facts,story,stale}`。记录更新后比较hash标记stale。`prepareRecapShare(recap,{includeWeights:false}): {title,text,topic:'养宠心得'}` 默认不包含健康数值，第三阶段只生成预览，第四阶段才支持真实发布。

## 本session确认的接入原则

用户确认免费优先、必要收费先给估算再决定；默认提供有限额的真实AI体验，无需用户自带Key。免费模型实际可用性、限流和任务效果仍须真实smoke验证，不能用模型开放权重代替公开服务可用性。自带Key仅为可选后续能力，不占本阶段必做范围，不存前端长期密钥，不接受未评估的任意端点。供应商与模型待选，当前不开通服务、不收费调用；额度用完保留手动分支。

## Task 1 真实模型适配与结构校验

**Files:** `provider.cjs`、`gateway.cjs`、`tests/ai-provider.test.js`、`tests/integration/text-model-smoke.test.js`；更新 `.env.example` 与云端运维说明。

**Interfaces:** `createTextModel({fetch,baseUrl,apiKey,model,timeoutMs}): {complete({system,user,maxTokens}): Promise<string>}`。密钥读 `process.env.TEXT_AI_API_KEY`，地址读 `TEXT_AI_BASE_URL`，模型读 `TEXT_AI_MODEL`。供应商、具体协议和参数在真实接入前按用户选择及官方资料锁定；DeepSeek是候选，不复用现有MiniMax密钥。默认30秒超时；内部ModelError.code固定TIMEOUT/RATE_LIMITED/INVALID_MODEL_OUTPUT/UPSTREAM_UNAVAILABLE，API层转为UNAVAILABLE且不返回原始密钥/响应。业务层校验JSON不依赖SDK一定支持强制结构化输出。

- [ ] Step 1：写协议fixture测试：HTTP成功但正文空、超时、429、非法JSON都返回可恢复错误；reasoning字段不显示给用户；服务日志不包含 Authorization、密钥或完整健康记录。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
await assert.rejects(model.complete(request), error => error.code === 'TIMEOUT');
assert.equal(logsContainSecret, false);
assert.equal(emptyModelResponse.error.code, 'INVALID_MODEL_OUTPUT');
```

- [ ] Step 2：运行 `node --test tests/ai-provider.test.js`，确认未实现适配器失败。
- [ ] Step 3：先确认文本供应商、端点、模型和预算，再核对官方文档/SDK并写入运维说明；实现fetch、超时、模型配置及错误映射；按用户与action限制短时频率，预算/余额读取不到时不能宣称有精确费用硬上限，依靠已确认的调用限额与云端费用告警收口。
- [ ] Step 4：运行该组测试及 `npm test`。预算明确后用实际账号做少量固定输入smoke，检查真实正文可解析；记录模型、端点与 usage，不记录密钥。fixture通过不等于实际模型已通。
- [ ] Step 5：提交 `feat: add server-only text model adapter and recoverable errors`。

## Task 2 自然语言草稿与确认保存

**Files:** `record-parser.cjs`、`ai-entry.js`、`api.cjs`、`tests/ai-drafts.test.js`、`test_app.py`。

**Consumes:** TextModel、Principal、HealthRecord/Reminder 与云端事务。**Produces:** `ai.records.parse`、`ai.records.confirm`；新增私有集合ai_drafts/recaps，ownerId由服务端设置；draftBatchId归属当前用户，确认request使用唯一幂等键。

- [ ] Step 1：写验证函数测试：today=`2026-10-06`、“昨天称重4.6公斤”得到`2026-10-05`/4.6/kg；“下个月再做”须missingFields含nextDate；同名宠物须petId=null；“5斤”转换2.5kg并在草稿显示原单位；禁止不存在的petId和未给出的剂量。重复confirm返回相同recordIds。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(yesterdayDraft.occurredDate, '2026-10-05');
assert.equal(yesterdayDraft.value, 4.6);
assert.equal(ambiguousNextDateDraft.missingFields.includes('nextDate'), true);
assert.equal(sameNameDraft.petId, null);
```

- [ ] Step 2：运行 `node --test tests/ai-drafts.test.js`，确认缺失实现失败。
- [ ] Step 3：实现结构校验、草稿暂存、编辑/选中/取消及确认保存；原句作为数据传给模型，不允许模型调用写库工具。草稿缺失字段未补齐不能保存。
- [ ] Step 4：运行测试、实际模型案例和浏览器“解析→编辑→确认/取消”。故意超时后手动录入仍可用，取消/解析都不改变健康记录数量。
- [ ] Step 5：提交 `feat: confirm editable AI health drafts before saving`。

## Task 3 可恢复的新手三步引导

**Files:** `onboarding.js`、`account.js`、`app.js`、`tests/onboarding.test.js`、`test_app.py`。

**Interfaces:** `advanceOnboarding(state,event): {step:'pet'|'record'|'reminder'|'done',petId,recordIds,reminderId}`；草稿由当前用户隔离保存，恢复时检查关联实体仍存在。事件 `PET_SAVED|RECORDS_SAVED|REMINDER_SAVED|REMINDER_SKIPPED`。

- [ ] Step 1：写状态测试：无宠物不进入record；生日未知可用估计年龄；用户重载恢复record步骤；同一事件重试不重复创建实体；跳过提醒仍能完成；demo引导不写真实账户。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(advanceOnboarding(state, {type:'REMINDER_SKIPPED'}).step, 'done');
assert.equal(recordsAfterRepeatedEvent.length, recordsAfterFirstEvent.length);
```

- [ ] Step 2：运行 `node --test tests/onboarding.test.js`，确认缺少状态规则失败。
- [ ] Step 3：实现三步界面，最少填写名字、类型、生日或估计年龄；支持AI或手动首次记录；提醒可跳过。个人首页随后显示用户自己的档案，不展示糯米作为个人宠物。
- [ ] Step 4：运行状态测试与完整浏览器首次流程，检查退出/重载/重新登录后恢复，以及手动分支。
- [ ] Step 5：提交 `feat: guide new pet owners through their first care record`。

## Task 4 有依据的成长回顾与分享预览

**Files:** `recap-facts.js`、`recap.cjs`、`weekly-recap.js`、`api.cjs`、`tests/recap.test.js`、`test_app.py`。

**Consumes:** 云端授权查询、TextModel与records/reminders。**Produces:** `ai.recaps.generate|ai.recaps.list` 与prepareRecapShare，不包含自动公开action。

- [ ] Step 1：写事实测试：范围外/其他宠物记录排除；4.6→4.8差值0.2由代码返回；空记录事实为0/null且不调用模型；虚构recordId使模型文案校验失败；修改引用记录后stale=true；默认分享不带4.6/4.8等健康数值。
核心断言示例（变量由该步骤的真实输入/结果fixture定义，不是生产代码）：

```js
assert.equal(facts.weightChangeKg, 0.2);
assert.equal(facts.recordIds.includes(otherPetRecord.id), false);
assert.equal(recapAfterSourceChange.stale, true);
```

- [ ] Step 2：运行 `node --test tests/recap.test.js`，确认缺失统计/引用验证失败。
- [ ] Step 3：实现统计、JSON文案与引用校验、私有存储、范围选择、依据查看和重新生成。只允许数字取自facts，过时状态可见；正文不称体重变化证明健康改善。
- [ ] Step 4：运行全套单元测试、真实模型回顾案例、浏览器查看依据/过时提示/预览分享；确认取消预览没有公开帖子。
- [ ] Step 5：提交 `feat: generate weekly pet stories grounded in saved records`。

## 阶段退出标准

新增N-04已确认：浮动入口、侧栏/对话框、欢迎语与快捷问题，首版回答网站使用帮助与当前宠物真实记录，只读并可追溯；不加入一般健康咨询，写入沿已有草稿确认。由新增Task5实施，不把原4任务当作已覆盖。自定义类型`typeLabel`与`uiLocale`沿阶段2传入草稿/回顾，隐藏实体排除于AI查询。

## Task 5 使用帮助与当前宠物记录助手

**Files:** 新增`backend/ai/assistant.cjs`、`src/features/assistant-panel.js`、`src/data/help-topics.js`、`tests/assistant.test.js`、`tests/e2e/assistant.py`；扩展`api.cjs`、TextModel、语言词典与`app.js`。

**Interfaces:** `ai.assistant.ask({petId,question,from?,to?,uiLocale},principal)`返回`{answer,sources:[{kind:'help'|'record'|'reminder',id,label}]}`，question1–1000字；默认记录范围最近30天，用户给范围时仅查所选范围；`retrieveAssistantContext(...)`先授权当前宠物再查询，排除回收站内容。帮助索引只列实际已发布能力，答案中的引用须属于检索集合；首次采用结构化资料/关键词检索，是否需要向量库在资料规模与效果核对后再定。

- [ ] Step1：写跨账号/宠物越权拒绝、隐藏记录排除、无记录不虚构、虚假引用拒绝、问法不触发写库/发布、英文回复请求、超时回退测试；浏览器快捷问题/来源跳转/切宠物清上下文/焦点关闭与手机遮挡检查。
- [ ] Step2：运行`node --test tests/assistant.test.js`与助手e2e，确认未实现能力真实失败。
- [ ] Step3：实现浮动入口、侧栏/手机对话框、“你好，昵称，试着问我”与快捷问题，显示当前宠物/范围；会话首版只保存在当前页面内存，切宠物/账号清空，不持久化私有聊天。模型适配/超时/调用限额复用Task1，没有写库工具。
- [ ] Step4：运行单测/e2e及已确认预算内真实模型案例，核对回答来源、无记录/服务失败行为，不能把mock问答算实际AI已通。
- [ ] Step5：提交`feat: answer usage and pet record questions with verifiable context`。

“新手建档→第一笔记录→提醒→回顾”实际可走通，AI失败不阻断，数字与引用正确。日历由第一阶段交付，在本阶段个人空间验证。建议候选 `v0.4.0`，未验收前不创建。

## 供应商决策边界

用户本轮明确：现有MiniMax API主要用于语音，具体文本AI API之后商量，可能选择DeepSeek。当前只确定业务接口与验收，不选择默认供应商、模型、密钥或收费账号；执行Task1前核对所选供应商官方资料，再锁定实际请求/响应适配。供应商未定不影响草稿校验、统计与界面设计，但不能标为真实AI验收通过。
