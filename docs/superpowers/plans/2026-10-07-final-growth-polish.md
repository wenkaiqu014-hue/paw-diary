# 普通计划、日期与照片收尾执行记录

用户批准四步简计划并追加全站日期、照片框等高与重命名。开始2026-10-07 19:12:31 Asia/Shanghai，硬截止19:42:31，不重开社区/定位/真机或新服务采购。

- [x] 可选reminder.includeInHealth严格boolean，new vaccine/deworm默认true，其余false，显式勾选决定；旧关联/未知类型保持既有健康视图、旧typed daily/other归普通计划。计划仍reminder，完成才actualrecord；V3回收/备份/可信权限保留。
- [x] 普通计划标注未完成进入成长足迹、完整记录与计划；表格/手机/CSV区分kind和plannedDate，不把未来日期当occurredDate。多宠筛选与实际重量统计保留，健康care回顾排普通计划但真实来源/hash保留。
- [x] 全document input[type=date]自动适配空值等宽mask，原value/keyboard/min/max/disabled/picker不改变，locale差异同步无observer自激。日期包含建档、录入、筛选、草稿、回顾。
- [x] 照片上传两框86px同高，名称独立于说明；media.rename({assetId,displayName,baseRevision,operationId})仅metadata、photo-only/可信父项/幂等，私有文件hash不变、备份保名。
- [x] v0.6.0原URL三宽/发行信息通过，main文档归档；实际时间见日志，真机/亲验不代勾。

所有权：Root app/record-dialog/record-intent/ai-entry/ai-drafts/全局安装/CSS/列表导出；refinement_types health-plans/schema/reminders/records/recap与测试；refinement_attachments photo/media/photos/archive/import/局部locale；stage3_final_review date-input模块/CSS/测试。明确共享文件不回退，agent不Git，Root集成。一次独立final_growth_review只读未发现Critical/Important。凭证保持私密环境；A仅单actor操作并每refresh600 checkpoint。

本机技能按已批准流程执行Superpowers/TDD/Impeccable/浏览器/验收，GitHub obra/superpowers、Vercel agent-skills、anthropics webapp-testing核对，复用不扩库。具体RED→GREEN、命令、失败及云更新延迟见SESSION_LOG，未把mock当真实云。
