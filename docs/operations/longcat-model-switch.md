# LongCat模型切换与快速回滚

2026-10-10，用户明确授权沿用原硅基流动API，将paw-ai切换为`meituan-longcat/LongCat-2.0`并push。此次为后端模型补丁，前端仍v1.0.5，原仓库、网页与数据保持。

## 快速回滚

在项目根目录执行：

```sh
python3 scripts/switch-ai-model.py --model Qwen/Qwen2.5-7B-Instruct
```

只更改paw-ai的TEXT_AI_MODEL，保留原API Key、其他环境变量和超时，等待Active并读回核对。管理凭证从已有TENCENTCLOUD_FUJI_SECRET_ID / TENCENTCLOUD_FUJI_SECRET_KEY读取，不输出或保存。

切回LongCat：

```sh
python3 scripts/switch-ai-model.py --model meituan-longcat/LongCat-2.0
```

只读检查：

```sh
python3 scripts/switch-ai-model.py
```

本次接口改动只为LongCat发送enable_thinking=false，Qwen请求保持旧行为，因此快速回滚只需恢复模型。Git revert或push不能恢复云端配置。部署脚本优先显式TEXT_AI_MODEL，再保留云端现有模型，避免重新覆盖回旧模型。

## 实际验证与边界

旧配置13:01:47 Asia/Shanghai读回Qwen、Active、40秒。首轮真实合成样例2过/1录入INVALID_MODEL_OUTPUT；定向诊断确认默认请求包含思考输出，但首个失败未保存finish_reason，不能断言具体耗尽原因。关闭思考的简单JSON请求约2.6秒成功；参数适配后录入、回顾、助手3/3通过，耗时约4.1/16.4/2.0秒，经过现有日期/类型/引用验证器。没有写入真实宠物数据。

参数回归测试先失败（undefined != false），修复后provider4/4、环境合并4/4通过；函数构建、Python编译、JS语法与diff检查通过。13:04:06云端部署读回LongCat、Active、40秒；除模型名外所有环境变量（包括原API Key）内存比对相同。13:04:52只读模型检查再通过。模型25秒/前端35秒/云函数40秒与1200 tokens保持。

按用户十分钟最小范围，没有重跑全量测试、浏览器完整业务流程或真机验收。三项是真实模型加本地业务验证器的冒烟，云端验证为部署及配置读回，不冒充网页端到端验收。原始脱敏回执在ignored test-results/longcat-switch。

本次按原600回执临时恢复origin，并从原远端main建立发布工作树，保留两笔仅本地收尾/面试资料历史。发布核验完成后恢复本项目主动隔离，旧tag不动，不额外创建Release。
