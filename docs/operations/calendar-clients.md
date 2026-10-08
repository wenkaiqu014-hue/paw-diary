# 日历文件导出与客户端差异

当前网页在#health的健康待办管理中勾选待完成事项，再导出日历；没有待办时先添加护理计划。导出仅包含当前宠物已选择的pending事项，切宠物清空选择。

我们导出全天ICS文件，日期、标题和备注来自选中的护理事项；文件不添加VALARM。导出后由用户导入客户端并管理通知。站内改期/完成与已导入文件不是同一份实时数据，不能宣称两者自动同步。稳定UID只是格式标识，各客户端重复导入/更新的结果仍需实际验证。

| 客户端 | 当次官方帮助能确认的入口/语义 | 本项目实际状态 |
| --- | --- | --- |
| Apple Calendar for Mac | 拖入文件，或文件→导入，再选择目的日历 | Calendar16.0本轮首次与重复均2条全天事件，无alarm；同日历改期保原日期，新空日历正确11/12日 |
| Google Calendar | 官方电脑端步骤为设置→导入和导出→选择ICS文件→目的日历→导入；帮助说明导入不会形成账号间同步 | 阶段5用户实际导入及按给定步骤复验已明确全部通过；未提供具体数量 |
| Outlook.com/网页版 | 添加日历→从文件上传→选择目的日历；文件导入是当时快照，订阅网上日历才有后续刷新语义 | 阶段5用户实际验收已明确全部通过；本项目未提供订阅URL |

上述是三份导入帮助页的定向核对，不是所有客户端/版本全目录审查，也不代表iOS/Android、Outlook各版本都已实测。三家本轮/阶段5实际结果详[1.0报告](../verification/v100-report.md)；不外推其他版本客户端表现，不额外开账户或改旧日历。

官方来源完整URL：

- [Apple Mac导入/导出](https://support.apple.com/zh-cn/guide/calendar/icl1023/mac)
- [Google Calendar导入](https://support.google.com/calendar/answer/37118?hl=zh-Hans)
- [Outlook导入与订阅](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web)

1.0内测：邮箱登录与首次注册需填写邀请者私下提供的六位内测码；示例、本地记录和公开浏览不需要。已有合法账号的内测资格保留，退出后重新登录仍需填码。

Apple Calendar16实测：重复文件导入保持两条；向原测试日历再次导入改期文件时保留旧日期。向新空日历导入改期文件则正确显示新日期。文件导入不是订阅，客户端后续日期可手动编辑，或在独立新日历重新导入；不承诺覆盖旧项或自动同步。Google/Outlook已由用户实际验收通过。
