# 阶段3文本AI接入研究

查证时间：2026-10-07 15:09:54–15:12:40，Asia/Shanghai（研究agent工具时间）。只读研究，没有模型调用、账号开通、安装或收费。本文件提供接入候选证据，不表示用户账号已通过。

## 结论与用户选择

用户第一轮确认免费优先、开发AI验收预算≤20元、上线AI≤20元/月；随后明确选择“免费优先：我准备硅基实名账号和Key，再验证免费模型”。因此本阶段首选硅基，型号须在实名账号的模型广场确认0价后锁定，收费fallback关闭。研究开始时本机仅检查变量是否存在，硅基/通用文本Key未配置、DeepSeek Key存在；随后用户提供硅基Key并授权写本机环境，已保存SILICONFLOW_API_KEY且新shell有效。没有回显实际值或发模型请求，变量存在不表示API或免费型号已经验证。

项目当前SESSION_LOG/原阶段3计划仅记录DeepSeek候选，未找到已选免费供应商的原文，不能把硅基说成已经确认是用户此前记得的那一家。

## 候选比较

| 供应商 | 已核事实 | 接入前依赖 | 本轮取舍 |
| --- | --- | --- | --- |
| 硅基流动 | 官方存在账单费用0的免费模型；实名后可用；免费限速按账号与模型固定。POST `https://api.siliconflow.cn/v1/chat/completions`，Bearer Key，支持JSON正文及response_format，部分模型有enable_thinking。 | 登录控制台核当前个人Key免费准确ID/RPM/TPM/余额0规则，真实smoke核JSON与延迟。 | 用户选择免费首选；不先假定Qwen/Qwen3-8B当前个人Key免费。 |
| 魔搭 | 当前按魔粒计费：每日登录200魔粒，绑定实名阿里云额外50；按模型每次0.5/1/2；短期额度24小时。Access Token、实名阿里云、邮箱验证；动态限速面向单并发。OpenAI兼容`https://api-inference.modelscope.cn/v1/`。 | 当前可用模型、魔粒余额、档位与JSON实际支持。 | 运维需每日领取额度，保留备选不接入；旧“每日2000次”口径不能沿用。 |
| DeepSeek | 当次官方价格页型号deepseek-flash/DeepSeek-V4.1-Flash，支持JSON Output，默认思考需显式关闭。未命中输入/输出高峰每百万2/8元，空闲1/4元。 | 具体收费接入确认、账号余额、最大上下文对应限额；不要默认沿用旧deepseek-chat名。 | 用户未选择；本轮不调用、不自动fallback。 |

硅基免费/限速与实名口径来自[限速与升级](https://docs.siliconflow.cn/docs/userguide/faqs/rate-limit-and-upgradation)、[快速开始](https://docs.siliconflow.cn/docs/userguide/quickstart)、[Chat API](https://docs.siliconflow.cn/docs/api/chat-completions-post)和[更新公告](https://docs.siliconflow.cn/docs/release-notes/overview)。更新公告2026-05-07说明5月15日起未实名不可使用，采用较新公告而非旧FAQ的局部列举。

硅基[MindBricks案例](https://docs.siliconflow.cn/docs/usercases/use-siliconcloud-in-minbricks)与[Cube Agent案例](https://docs.siliconflow.cn/docs/usercases/use-siliconcloud-in-cube-agent)出现Qwen3-8B等免费模型，但合作权益/目录不等同个人Key价格。模型广场动态页跳登录，本次无法公开读取当前个人Key的0价ID、精确限速及零余额可用性，明确留给真实账号验证。

魔搭[使用限制](https://www.modelscope.cn/docs/model-service/API-Inference/limits)、[介绍](https://www.modelscope.cn/docs/model-service/API-Inference/intro)、[魔粒规则](https://www.modelscope.cn/docs/magicube/intro)动态网页直接读取0行；研究按官网JS找到官方文档元数据及版本20260928155008，读取下列官方Markdown核对规则，不将摘要当全文。文档示例型号Qwen/Qwen3.5-35B-A3B不是账号已可用证明。

DeepSeek[价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)按100次、每次2000输入/600输出、无缓存/重试且关闭思考估算：高峰`0.2×2+0.06×8=0.88元`，空闲`0.2×1+0.06×4=0.44元`。这是小上下文量级，不是本产品最大24KiB输入、1200输出的硬上限或账户账单。具体收费接入应按最大配置重算，当前不使用。[Chat API](https://api-docs.deepseek.com/zh-cn/api/create-chat-completion)Web读取多次超时，Shell获取官方HTML成功，确认关闭思考参数；[JSON Output](https://api-docs.deepseek.com/zh-cn/guides/json_mode)仍要求提示明确JSON及空/截断处理。

## 官方目录覆盖

硅基根/用户指南/案例/API/更新侧栏合并112个唯一docs路径；定向读取概览、快速开始、文本/JSON、实名、财务/模型FAQ、限速、Chat、更新及相关案例，未通读多模态、微调、Batch、嵌入与无关案例。模型广场登录内容未覆盖，不能声称型号目录查全。

魔搭官方index.json递归404节点/326页面/78目录，读取API-Inference三页与魔粒一页，另外322页未读。DeepSeek跨侧栏52个去锚点路径，只读取接入/JSON/价格/限速与目录入口，其余未通读。

## GitHub技能研究

2026-10-07约15:10，通过GitHub REST读`stargazers_count`：wshobson/agents为40,260，anthropics/skills为179,961。前者当时main SHA `46891e7e60da0e52baf1050b7b6391b64e84c6d9`，MIT。数字是当次读取，后续会变化。

已定向读wshobson的error-handling-patterns与nodejs-backend-patterns：环境变量、输入验证、统一可恢复错误可参考；后者的Express/Fastify/TypeScript及额外校验/日志体系不是本轮必需。anthropics的webapp-testing本机已有同类，claude-api供应商不匹配。结论：本轮先用已有Superpowers/Impeccable/浏览器测试和供应商原文，不新装技能或扩大框架。需要时仅定向参考错误处理技能。

## 完整来源URL

- https://docs.siliconflow.cn/docs/userguide/faqs/rate-limit-and-upgradation
- https://docs.siliconflow.cn/docs/userguide/quickstart
- https://docs.siliconflow.cn/docs/api/chat-completions-post
- https://docs.siliconflow.cn/docs/release-notes/overview
- https://docs.siliconflow.cn/docs/usercases/use-siliconcloud-in-minbricks
- https://docs.siliconflow.cn/docs/usercases/use-siliconcloud-in-cube-agent
- https://www.modelscope.cn/docs/model-service/API-Inference/limits
- https://www.modelscope.cn/docs/model-service/API-Inference/intro
- https://www.modelscope.cn/docs/magicube/intro
- https://modelscope.cn/api/v1/document/main_doc_CN_prod
- https://resouces.modelscope.cn/document/docdata/2026-9-28_15-49-CN/dist/index.json
- https://resouces.modelscope.cn/document/docdata/2026-9-28_15-49-CN/dist/model-service/API-Inference/intro/intro_CN.md
- https://resouces.modelscope.cn/document/docdata/2026-9-28_15-49-CN/dist/model-service/API-Inference/limits/limits_CN.md
- https://resouces.modelscope.cn/document/docdata/2026-9-28_15-49-CN/dist/model-service/API-Inference/api-provider/api-provider_CN.md
- https://resouces.modelscope.cn/document/docdata/2026-9-28_15-49-CN/dist/magicube/intro/intro_CN.md
- https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
- https://api-docs.deepseek.com/zh-cn/api/create-chat-completion
- https://api-docs.deepseek.com/zh-cn/guides/json_mode
- https://api-docs.deepseek.com/zh-cn/quick_start/rate_limit/
- https://github.com/wshobson/agents
- https://github.com/anthropics/skills
- https://api.github.com/repos/wshobson/agents
- https://api.github.com/repos/anthropics/skills
- https://raw.githubusercontent.com/wshobson/agents/main/plugins/developer-essentials/skills/error-handling-patterns/SKILL.md
- https://raw.githubusercontent.com/wshobson/agents/main/plugins/javascript-typescript/skills/nodejs-backend-patterns/SKILL.md
