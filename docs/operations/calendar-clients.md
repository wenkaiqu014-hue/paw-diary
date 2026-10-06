# 日历文件导出与客户端差异

当前本地阶段1入口：打开`http://127.0.0.1:4178/#health`，在健康待办的待完成列表勾选事项，点击卡片底部“导出日历”。当前实现只有存在pending事项时展示下载按钮；没有待办时先添加护理事项。顶栏应为“本地体验”，公开v0.1.0旧界面没有此入口。

我们导出全天ICS文件，日期、标题和备注来自选中的护理事项；文件不添加VALARM。导出后由用户导入客户端并管理通知。站内改期/完成与已导入文件不是同一份实时数据，不能宣称两者自动同步。稳定UID只是格式标识，各客户端重复导入/更新的结果仍需实际验证。

| 客户端 | 当次官方帮助能确认的入口/语义 | 本项目实际状态 |
| --- | --- | --- |
| Apple Calendar for Mac | 拖入文件，或文件→导入，再选择目的日历 | Calendar16.0已实际导入四项2026-10-12全天事件；默认通知以客户端设置为准 |
| Google Calendar | 官方电脑端步骤为设置→导入和导出→选择ICS文件→目的日历→导入；帮助说明导入不会形成账号间同步 | 只读官方帮助，尚未用实际账号导入本项目文件 |
| Outlook.com/网页版 | 添加日历→从文件上传→选择目的日历；文件导入是当时快照，订阅网上日历才有后续刷新语义 | 只读官方帮助，尚未实际导入；本项目未提供订阅URL |

上述是三份导入帮助页的定向核对，不是所有客户端/版本全目录审查，也不代表iOS/Android、Outlook各版本都已实测。新增PENDING P3-04在阶段5检验各客户端的日期、通知、重复导入和改期，并将正确步骤写入使用指南。当前不额外开通账户、申请权限或改已有日历。

官方来源完整URL：

- [Apple Mac导入/导出](https://support.apple.com/zh-cn/guide/calendar/icl1023/mac)
- [Google Calendar导入](https://support.google.com/calendar/answer/37118?hl=zh-Hans)
- [Outlook导入与订阅](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web)
