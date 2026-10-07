# 阶段3 AI与成长首页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans；独立模块委派worker时按superpowers:subagent-driven-development约定明确所有权。Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本session交付真实AI记录、可恢复引导、成长回顾、只读助手及等宽对齐首页，在原URL完成阶段3验收。

**Architecture:** 独立paw-ai只生成，不写业务；确认保存复用V3本地/私有云仓储。领域规则抽成小ESM模块，app.js整合由主agent统一负责；首页改两等列，限额由CloudBase事务统一预占。

**Tech Stack:** 现有HTML/CSS/ESM、esbuild、CloudBase SDK3.10.1/3.18.3、Node内置fetch/AbortController、node:test、fake-indexeddb、Playwright/本机Chrome。不加React、向量库、Agent框架或重动效。

**Spec:** [阶段3设计](../specs/2026-10-07-stage3-ai-growth-design.md)。供应商公开事实与来源见[接入研究](../../research/2026-10-07-stage3-text-ai.md)。本计划替代2026-10-06阶段3初稿的实施细节，不改历史交付记录。

## Global Constraints

- 原仓库/Pages地址和#home/#health/#nearby/#community保持；旧tag不移动。
- V3生命周期、自定义类型、媒体、双语、完整备份和旧原文保留继续有效。
- 免费优先；开发AI验收≤20元、上线AI≤20元/月；不使用集团账单，不自动切收费模型。
- 用户已明确选择硅基免费优先并准备实名账号/Key；型号必须控制台确认当前个人Key0价后锁定。免费账号实际可用不以公开文档代替，DeepSeek本轮不调用。
- 密钥仅服务端process.env；云管理仅TENCENTCLOUD_FUJI_*；日志不含密钥、token、完整私有内容。
- 独立paw-ai部署40秒/模型25秒/前端35秒；配置须实际读回，不修改已验收paw-api3秒或认证语义。
- 免费初始限额：访客3次/日、登录20次/日、IP30次/日、全站100次/日和1000次/月；Asia/Shanghai；三种生成共用。
- 输入1–1000字、草稿≤5条、助手≤4轮、模型输出≤1200token、messages≤24KiB；记录片段≤20条/备注≤200字、提醒≤10条。
- 解析/提问/生成/取消/分享预览不写业务；确认记录和保存回顾才写；回顾数字由代码计算，回收站排除。
- 手机顺序宠物→护理→统计→趋势→回顾→时间线→照片→社区；1100px及以上两等列，低于1100px单列；600px以上gap24px、600px及以下gap16px；保留奶油色/森林绿视觉。
- 收费方案即使每次成本很低，也先按最大输入/输出/月额度重算后再启用；公开估算不当精确账单硬上限。
- 阶段4社区/同城及阶段5指南/PWA/最终真机检查不在本计划实施，原10月8日20:00截止不变。

## Review Focus

1. AI等待时切宠物/账号：旧内容和迟到响应不能出现在新上下文；Task2、3、6验证。
2. 确认多条时双击/失败重试：不能重复或只写半批；Task3验证。
3. 云调用无token或错误token：访客只能处理显式本地输入，有错误token不得降级读云；Task2验证。
4. 引用记录修改/回收及旧V3无新增字段：回顾过时可见，原数据/媒体仍可备份恢复；Task4、5验证。
5. 手机/英文/空护理：卡片同宽齐边，AI对话框和底栏不遮确认操作；Task1、7验证。

## 文件与所有权

主agent负责`app.js`、`style.css`、`index.html`、`src/config/*`、仓储/backend/workspace接口整合、构建/运维/发布和文档。独立worker可负责`backend/ai/*`与其测试，另一个可负责`src/domain/{ai-drafts,onboarding,recap-facts,stage3-state}.js`与其测试；不得并行改app.js或互相回退。每次委派给出本文接口及实际依赖版本。

新增前端：`src/features/{ai-entry,onboarding,weekly-recap,assistant-panel}.js`、`src/ai/{client,context}.js`、`src/data/help-topics.js`。新增云：`cloudfunctions/paw-ai/{index.js,package.json}`、`backend/ai/{provider,gateway,quota,record-parser,recap,assistant}.cjs`。不新增ai_drafts/向量集合；新增直接读写deny集合`ai_usage`，回顾/引导放可选profile.stage3。

新增单测：`tests/{ai-provider,ai-gateway,ai-drafts,onboarding,recap,assistant}.test.js`；真实调用：`tests/integration/text-model-smoke.test.js`；浏览器：`tests/e2e/{stage3-home,stage3-flow,stage3-assistant}.py`。所有新文件按任务确实需要才创建。

## 执行方法与检查点

采用主agent实施整合、按模块委派worker和一次独立整体验收审查；用户已授权本session自主派工，无需重新选择模型或协作方式。实施时先用using-git-worktrees建立`.worktrees/stage3` / `feature/stage3-ai-growth`，从包含本计划的最新main起步；文档规划仍在main。不得回到stage2重做业务。

建议投入：Task1约45–60分钟；Task2约60–90分钟；Task3/4约90–120分钟；Task5/6约90–120分钟；Task7约60–90分钟。可以并行独立模块，总量约6–8小时，实际供应商接入与云smoke可能改变耗时，不能当完成保证。模型Key准备与Task1/领域测试并行；Task2若45分钟仍未得到可用服务，记录原因并继续本地任务，不反复盲试。

每任务记录RED→GREEN和必要提交到SESSION_LOG，PENDING只按实际验收勾选。视觉一批检查→集中修复→必要一批复验；不因mock绿就发版，不增加泛化框架或漫长稀有场景测试。

## Task 1：首页布局与真实卡片骨架

**Files:** Modify `app.js:home/maintainPhotoWall/render`、`style.css:.care-home/workspace-controls`、`DESIGN.md`；Create `tests/e2e/stage3-home.py`。

**Interfaces:** 产出`.home-recap`宿主与`[data-home-onboarding]`宿主，Task4/5挂载；`.photo-wall-panel`现有生命周期不改。AI未启用时不展示可误导的正式生成按钮。

- [ ] **Step1 RED：**浏览器断言1440宠物/护理宽差≤1px、趋势/回顾宽差≤1px、说明栏与grid左右差≤1px；768/390单列无横溢。新增回顾宿主未实现、原列宽不等时应失败；不能用截图差异代替几何断言。
- [ ] **Step2 运行：**`/Users/wenkaiqu/.codex/skill-runtime/run python -u tests/e2e/stage3-home.py`，PAW_DIARY_TEST_URL指定当前独立dist服务；确认实际RED。
- [ ] **Step3 实现：**两等列第一排宠物/护理；统计、时间线、个人照片墙全宽；第二排趋势/回顾；轻量社区入口末尾；共用左右padding，gap桌面24/手机16。宠物卡图文可重排，提醒不跨多行，内容不能裁掉；DOM保持手机任务顺序。
- [ ] **Step4 GREEN：**同命令检查示例和本地个人、空护理/有护理、中英文；1440/768/390截图实际查看，个人照片墙用受控合成图片。复跑`tests/e2e/health-layout.py`保证未改健康页既有排列与高度行为。
- [ ] **Step5 提交：**`fix: align growth home cards and content boundaries`，附实际几何与截图证据到SESSION_LOG。

## Task 2：真实模型、公开网关与额度

**Files:** Create `backend/ai/{provider,gateway,quota}.cjs`、`cloudfunctions/paw-ai/*`、`src/ai/{client,context}.js`、`tests/{ai-provider,ai-gateway}.test.js`、`tests/integration/text-model-smoke.test.js`；Modify `scripts/{build-functions.mjs,cloud-setup.py,build.mjs}`、`src/config/public-config.js`、`.env.example`、`docs/operations/cloud-setup.md`、`tests/build.test.js`。

**Interfaces:**

- `createTextModel({fetchImpl,baseUrl,apiKey,model,timeoutMs=25000}).complete({messages,maxTokens=1200,responseFormat}):Promise<{content,usage}>`。
- `createQuotaStore({db}).reserve({actorKey,ipKey,requestId,day,month,limits}):Promise<{accepted,remaining}>`，事务内预占，重复requestId拒绝再调用；`read(...)`不消耗额度。
- `handleAiRequest(request,{principal,sourceIp,readSnapshot,quotaStore,model,clock}):Promise<{ok,data?,error?}>`；`request={version:1,action,payload,requestId,visitorId?,authToken?}`。`authToken`只在函数入口验证后移除。
- `createAiClient({invoke,getAuthorization,getScope}).request(action,payload):Promise<data>`；`getScope()`含当前repo引用、generation、mode、workspaceId、petId；不自动网络重发。公共配置增加`aiFunctionName:'paw-ai'`、`aiEnabled:false`，真实验收完成才开。

- [ ] **Step1 RED：**测试成功正文/usage、超时/429/空JSON错误；`assert.equal(modelCallsAfterDuplicate,1)`；并发仅剩1额度时只1请求获预占；带失效token不回退guest；guest不能传ownerId读取云；缺可信IP拒绝guest；日志/静态包无哨兵Key；scope改变后响应不展示。
- [ ] **Step2 运行：**`node --test tests/ai-provider.test.js tests/ai-gateway.test.js`，确认缺实现失败。
- [ ] **Step3 实现：**固定供应商/模型、短fetch超时、结构化正文/已知错误、不返回推理字段；函数复用resolvePrincipal和可信TCB_SOURCE_IP。匿名请求仅显式context；登录查询由owner确定。限额用ai_usage事务；调用前检查字符/bytes/token/上下文上限。模型失败不自动换供应商或重试。
- [ ] **Step4 接入：**使用用户选择的硅基：先控制台确认实名、个人Key0价准确ID/限速/余额0规则→`https://api.siliconflow.cn/v1/chat/completions`。用户已授权保存本机SILICONFLOW_API_KEY；部署脚本从os.environ读取，只配置服务端TEXT_AI_API_KEY，禁止读入scripts/build.mjs的公开config。记录实际型号、JSON/思考参数支持和限额，不记录秘密。若免费接入失败，返回手动路径并说明原因，不自动试本机DeepSeek Key。
- [ ] **Step5 部署/读回：**固定FUJI环境新增paw-ai allowlist/bundle/40秒、Key仅该函数；统一configure与cleanup-readiness的规则保留paw-ai公开invoke，paw-api仍认证、数据集合deny、匿名provider false。bundle路径改`test-results/stage3/functions/`并保留运维调用一致；不采购新套餐/服务。
- [ ] **Step6 GREEN：**上述单测、`npm run build:functions`、`node --test tests/build.test.js`；配置后明确设置`PAW_REAL_TEXT_AI=1`运行`node --test tests/integration/text-model-smoke.test.js`，该标志下缺配置必须失败而非skip。先1条固定短输入，再解析/回顾/助手各1案例；只记录模型、时延、usage和通过标志。真实新无会话浏览器和登录用户各调用一次；未登录paw-api依旧拒绝。
- [ ] **Step7 提交：**`feat: add bounded server-only text AI gateway`；未真实接通只允许提交实现，不勾AI验收或开启线上按钮。

## Task 3：可编辑多条草稿与确认事务

**Files:** Create `src/domain/ai-drafts.js`、`backend/ai/record-parser.cjs`、`src/features/ai-entry.js`、`tests/ai-drafts.test.js`、`tests/e2e/stage3-flow.py`（后续Task4/5扩展）；Modify `src/data/{local-repository,cloud-repository,demo-repository}.js`、`backend/{api,workspace}.cjs`、`app.js`、`src/ui/i18n.js`、`src/ui/locales/{zh-CN,en}.js`。

**Interfaces:**

- `validateRecordDraft(draft,{pets,today}):RecordDraft`校验候选归属/字段，待补字段可null；`toRecordInputs(drafts,selectedIds,{pets,today}):SaveRecordInput[]`必须完整。
- `applyRecordBatch(snapshot,inputs,{now,idFactory}):{snapshot,records,reminders}`，1–5条，复用applyRecord，一次全量校验成功才持久化。
- 仓储`saveRecordBatch(inputs,{baseRevision,operationId}):Promise<{records,reminders}>`，云`records.saveBatch`沿现有writeTransaction回执，本地envelope新增批次回执。相同operationId且相同输入返回原结果；不同输入拒绝。demo使用同样规则但不写个人。
- `parseRecords({text,pets,today,uiLocale},model):Promise<{drafts}>`；前端`createAiEntry({aiClient,repository,getScope,t,onSaved}).open()`。

- [ ] **Step1 RED：**today=2026-10-07，“昨天4.6公斤”草稿日期2026-10-06；5斤→2.5kg并保留原单位；“下个月再做”需补日期；同名宠物不擅选；不编剂量。解析/取消前后snapshot相同；双击相同operationId记录不增加；第2条无效时第1条也不写。
- [ ] **Step2 运行：**`node --test tests/ai-drafts.test.js`并确认RED。
- [ ] **Step3 实现：**“记一笔”双方式、原句/缺项/归属可见、逐条编辑/勾选/取消；确认前使用规范化字段，不信任模型；仅点击确认触发saveRecordBatch。迟到结果绑定宠物/空间，错误保留原句；未知日期填空补充，不偷偷造日期。
- [ ] **Step4 GREEN：**单测+fake-indexeddb事务失败/云memoryStore；浏览器解析两条→编辑→只确认一条→刷新核实际记录，另一条取消不写；超时后手动成功。真实模型至少验证“昨天称重4.6公斤”“今天驱虫了”“下个月再做”。
- [ ] **Step5 提交：**`feat: confirm editable AI drafts through existing repositories`。

## Task 4：可恢复三步引导及V3扩展

**Files:** Create `src/domain/{onboarding,stage3-state}.js`、`src/features/onboarding.js`、`tests/onboarding.test.js`；Modify `src/domain/schema.js`、三个Repository、`backend/{api,workspace}.cjs`、`app.js`。

**Interfaces:**

- `normalizeStage3State(raw):{onboardingByPet,recaps}`，缺字段空值，拒非法结构；schema在现有profile上只规范化可选stage3。
- `advanceOnboarding(progress,event,snapshot):OnboardingProgress`；event=`PET_SAVED|RECORDS_SAVED|REMINDER_SAVED|REMINDER_SKIPPED|DEFERRED`，step=`pet|record|reminder|done`。
- `saveOnboarding({petId,step,recordIds,reminderId,updatedAt},options):Promise<OnboardingProgress>`，云`stage3.onboarding.save`；服务器校验拥有且可见的关联实体并用服务端updatedAt。进度持久化profile.stage3，不增加认证接口。
- `createOnboarding({repository,aiEntry,getScope,t,onChanged}).mount(host)`。

- [ ] **Step1 RED：**旧V3无stage3仍可读且媒体/deletedAt不变；无宠物不进入记录；保存第一笔后刷新恢复提醒步；跳过提醒→done；重复事件不创建实体；换空间不显示旧进度；回收关联记录后提示补步骤。
- [ ] **Step2 运行：**`node --test tests/onboarding.test.js tests/archive.test.js tests/local-personal.test.js`，确认新行为RED、旧数据测试仍有效。
- [ ] **Step3 实现：**空首页“开始记录”；已有宠物非强制提示；建档复用现表单，记录AI/手动都能推进，提醒可跳过/以后再说。先保存业务实体再保存进度；中间刷新从实体恢复，不重复建宠物。宠物删除保留其进度但不显示，恢复后校验。
- [ ] **Step4 GREEN：**上组单测；`stage3-flow.py`真实本地手动/AI流程、中断刷新、再继续、云登录重开恢复；导出恢复stage3字段，旧V3/原回收站/媒体完整仍成立。
- [ ] **Step5 提交：**`feat: resume pet onboarding without repeated records`。

## Task 5：成长回顾、私有保存和分享预览

**Files:** Create `src/domain/recap-facts.js`、`backend/ai/recap.cjs`、`src/features/weekly-recap.js`、`tests/recap.test.js`；Modify stage3状态校验、三个Repository、`backend/{api,workspace}.cjs`、`app.js`。

**Interfaces:**

- `computeRecapFacts({snapshot,petId,from,to}):{recordCount,weightChangeKg,completedCareCount,upcomingReminders,recordIds,reminderIds}`；日期首尾包含，待办范围to+1至to+7，体重差round到0.01kg。
- `recapSourceHash({snapshot,petId,from,to},{cryptoImpl=globalThis.crypto}={}):Promise<string>`，覆盖范围内所有可见记录及相关提醒；Node函数注入node:crypto.webcrypto。
- `generateRecap({snapshot,petId,from,to,uiLocale},model):Promise<Recap>`；`storySources`仅允许本次提供ID。零记录返回空状态不调用model。
- `saveRecap(recap,options):Promise<Recap>`，云`stage3.recap.save`；服务端重算facts/hash、核归属，前后依据变化拒绝或标过时，不信客户端数字。
- `prepareRecapShare(recap,{includeWeights:false}):{title,text}`；`createWeeklyRecap({repository,aiClient,getScope,t}).mount(host)`。

- [ ] **Step1 RED：**4.6→4.8差值严格0.2；其他宠物/范围外/回收站记录排除；0条不请求模型；虚构引用拒绝；新增/修改/删除范围记录后hash变；默认分享文本没有体重及护理细节；点击生成不保存，点击保存才写。
- [ ] **Step2 运行：**`node --test tests/recap.test.js`确认RED。
- [ ] **Step3 实现：**最近7/30/自选，完整代码事实+有限来源片段+短日记；范围/时间/依据可见，保存/重新生成/过时提示。分享预览独立安全模板，可编辑复制，不创建社区帖子。英文新文案跟随语言，用户原文不翻译。
- [ ] **Step4 GREEN：**单测、真实模型少量记录及零记录、浏览器生成→保存→刷新→编辑原记录→过时→重新生成→分享取消；本地/云各验证保存与自己的来源可读，切宠物不串旧结果。
- [ ] **Step5 提交：**`feat: save grounded growth recaps with private share previews`。

## Task 6：页面内只读助手

**Files:** Create `backend/ai/assistant.cjs`、`src/data/help-topics.js`、`src/features/assistant-panel.js`、`tests/assistant.test.js`、`tests/e2e/stage3-assistant.py`；Modify `app.js`、`style.css`、`src/ui/i18n.js`、`src/ui/locales/{zh-CN,en}.js`。

**Interfaces:** `retrieveAssistantContext({snapshot,petId,question,from,to,uiLocale,history,helpTopics}):{sources,messages}`；`askAssistant(context,model):Promise<{answer,sources}>`；`createAssistantPanel({aiClient,repository,getScope,t,onSource}).mount(container)` / `.reset()` / `.destroy()`。来源kind只有help/record/reminder，引用ID必须属于检索集合，不能返回任意URL。

- [ ] **Step1 RED：**已发布帮助答案、当前宠物记录、连续“那驱虫呢”可用；另一宠物/回收站排除；假引用拒绝；无记录不编；snapshot在提问前后完全相同；切宠物/账号清history且不展示旧响应；超时保问题并可手动返回。
- [ ] **Step2 运行：**`node --test tests/assistant.test.js`确认RED。
- [ ] **Step3 实现：**实际功能帮助词条/关键词检索、默认30天、最近4轮内存对话；来源可点击既有记录/帮助。手机dialog/桌面侧面板，3个快捷问题；仅查询，不提供写库tools，医疗提问明确说明范围。关闭恢复触发按钮焦点。
- [ ] **Step4 GREEN：**单测、真实帮助/记录/连续追问案例、`stage3-assistant.py`中英文/1440/390、Tab/Esc/来源打开/底栏不遮挡；记录前后数量和内容不变。
- [ ] **Step5 提交：**`feat: add a read-only pet record and usage assistant`。

## Task 7：集中验收、原URL发布与交接

**Files:** Modify `PENDING.md`、`SESSION_LOG.md`、`PRODUCT.md`、`ROADMAP.md`、`VERSION`、`package.json`、`package-lock.json`、`CHANGELOG.md`、`README.md`、阶段3计划；Create `docs/verification/stage3-report.md`。现有工作流`.github/workflows/pages.yml`沿用，必要发布配置随前述任务调整。

**Interfaces:** 产出固定源码commit、build manifest、真实模型/云配置证据、公开原URL验收和候选v0.4.0。发布前将aiEnabled与真实配置一致，不能用mock打开产品声明。

- [ ] **Step1 检查：**`node --check app.js`、`git diff --check`、`npm test`、`npm run build`、`npm run build:functions`退出0；246基线与新增行为无skip/fail。已有integration不被npm test自动跑，单独运行真实text-model-smoke；缺Key或云实际失败明确未过。
- [ ] **Step2 主线E2E：**固定构建的`test_app.py`、`stage3-home.py`、`stage3-flow.py`、`stage3-assistant.py`、原`account-workspaces.py`和`personal-media.py`；1440/768/390双语、无/少记录、取消/确认/失败手动、布局/焦点与旧媒体刷新。重复测试仅因新改动或失败而做。
- [ ] **Step3 独立审查：**一名fresh reviewer检查spec/代码/真实证据，集中修所有阻断主线/隐私/费用的问题；只复跑受影响检查及最终必要整套。不另加无关功能或通用安全框架。
- [ ] **Step4 真云门槛：**全新匿名context真实AI成功；匿名provider仍false；错误token不能降级；私有API匿名拒绝；可信登录当前宠物来源成功；ai_usage规则deny且限額读回。不读取他人健康，不用管理员身份代替用户，不反复消费旧验证码，refresh轮换按既有流程保存。
- [ ] **Step5 归档/部署：**测试通过后合并最新main、解决文档日志冲突不reset、重新必要构建与单测；更新版本/变更说明但README仍产品介绍优先。推原main，检查原Pages工作流成功及manifest一致；匿名原URL跑主线/布局/助手，登录当前宠物恢复再查一次，不以本地代线上。
- [ ] **Step6 发版：**通过原URL真实门槛后创建新v0.4.0 tag和非draft/non-prerelease Release并核目标；旧v0.1/0.2/0.3目标不变。若真实接入失败不创建AI已完成版本。
- [ ] **Step7 收口：**SESSION_LOG记录实际失败/修复/检查/worker/commit/push/部署/Release与剩余项，PENDING按实勾选；用户亲自体验仍须其单独确认。保留阶段4/5入口和截止，结束服务/测试context但保留Git忽略证据，最终核Git状态可恢复。

## 当前状态

- [x] 用户第一轮grill六项确认及同行等宽要求。
- [x] 定向代码调查、原URL示例有头截图/几何、免费候选和高star技能研究。
- [x] 设计与详细计划写入；自检与用户审阅在本轮收口记录。
- [x] 供应商选择硅基免费优先，用户准备实名账号/Key；本机DeepSeek Key未调用。
- [x] 用户提供硅基Key并授权本机环境配置，SILICONFLOW_API_KEY新shell可读；未发模型请求。
- [ ] 免费账号、当前0价型号/限速与真实smoke通过。
- [ ] Task1–7实施与验收。当前没有阶段3产品代码或云部署，不将研究/规划当功能完成。
