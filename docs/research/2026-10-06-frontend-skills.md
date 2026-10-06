# HTML 与前端设计技能调研

2026-10-06按用户要求在GitHub搜索，并打开维护者原仓库/技能文件核对。目的为爪爪日记后续HTML产品界面设计选择辅助技能。调研时未安装；用户随后授权按需要安装，当前已补装web-design-guidelines，未更新或启动新的界面设计流程。

## 核对的三个候选

| 技能 | 原始来源与能力 | 对本项目的用途 | 当前决定 |
| --- | --- | --- | --- |
| Anthropic frontend-design | 指导视觉方向、排版、布局和非模板化界面；原文要求基于产品内容作选择，再实施与自检 | 新增AI确认/回顾页面时参考结构与视觉表达 | 候选参考；本轮不安装，不用它推翻现有主题 |
| Impeccable | 提供界面规划、体验评价、响应式/可用性检查和打磨等命令 | 继承已有视觉，整理主次、表单、空/错误状态和首次使用 | 推荐主技能，本机已具备；不重复安装或更新 |
| Vercel web-design-guidelines | 对UI代码按Web Interface Guidelines做检查；规则覆盖交互、表单、语义、键盘、布局、动画与性能 | 作为实现后的验收补充，特别是手机表单、焦点与长内容 | 已按用户授权安装，版本1.0.0，实际用于后续UI审查 |

以上能力来自[Anthropic技能原文](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)、[Impeccable仓库说明](https://github.com/pbakaus/impeccable)、[Vercel技能原文](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md)和[Vercel界面规则](https://github.com/vercel-labs/web-interface-guidelines)。本机已安装Impeccable的事实来自本地技能目录及本会话技能目录清单，不由GitHub页面推断。

## 项目采用方式

后续执行阶段0时，Impeccable负责已有产品界面的结构和状态设计，frontend-design作为补充参考，Vercel规则用于实施后的检查。它们不限定必须使用React，当前计划继续原生HTML/CSS/JS。

先完善“记录、提醒、回顾”的核心体验，再处理装饰与动画。沿用DESIGN.md的现有依据，完整列明桌面/手机、空数据、加载、失败、长文本和键盘行为。不照搬来源项目的品牌偏好，也不因为搜索到新技能就叠加多个完整流程。

具体设计任务及验收见 `../superpowers/plans/2026-10-06-00-interface-design.md`。web-design-guidelines安装单独来自用户随后“如果有就安装”的授权，不是由调研推断。固定来源提交063bee94c3f4df8453406c830b0a7df0f2860278，安装位置 `/Users/wenkaiqu/.codex/skills/web-design-guidelines/`；可在下一轮加载。frontend-design不重复安装，Impeccable不更新，线上网页没有因此改变。

## 完整来源 URL

- https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- https://github.com/pbakaus/impeccable
- https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md
- https://github.com/vercel-labs/web-interface-guidelines
