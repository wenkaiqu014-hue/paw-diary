# 记录与档案修订验收

最终最新v0.5.2：329/329、原URLrecord-ui-polish实际三宽/fiveRows/iconOnly/circle46px/inPlaceManage/plusFallback/fileButton/record0todo+plan0record/0pageErrors全通过。source/tag f93784d，Pages37610740744于18:57:15完成，app-27BPJ62W.js/style-XRVVHCCW.css与本地SHA一致，Release18:59:00公开。新用户20分钟窗口18:43:25起，发布用时15分35秒。用户确认两用途互斥，旧关联单测保留；AIrecord不接受隐式nextDate，用途变化后不按旧解析用途写入。下方v0.5.1/v0.5.0是历史验收。

最终版本v0.5.1：补程序赋值的可见选项显示同步，真实两处语言RED→GREEN；325单测无skip，原URL新鲜浏览器再次检查通过。新Pages37608531673于18:36:58完成，source/tag b25dae8，app-WMRLVTH5.js/style-WACPJKHL.css与本地SHA一致，Release18:38:17公开。全任务交付38分13秒（18:00:04开始），整体≤1小时；最后一步从提前审查起计超过15分钟，不能称全单步达标。下文v0.5.0是此前发布历史。

2026-10-07，v0.5.0已公开发布；Pages37607465744于18:27:23完成，Release18:29:34公开。公开app-N5WIUUE5.js/style-WACPJKHL.css与本地hash一致，实际匿名原URLrecord-dialog及record-workflow-public均通过。发行tag017d813与部署源码17f7861仅测试修订之差，业务构件完全相同。实现设计和主/附件计划见PENDING。

四内置保留、不可删除、排序；3个活跃自定义及book/paw/drop重复；历史other/已删目录快照；三空间目录和可信服务端约束已测试。统一四入口记录/计划及日期、待办开关、两模式输入保留；标题初始focus、三圆头像及部分失败仅重试头像；整行指针/键盘排序、多宠checkbox默认当前、CSV宠物列和按行编辑已实际验证。

325/325单测、0skip；node语法、正常构建/函数构建、diff检查通过。真实Chrome本地录入完整主线：新类型立即选用保存、原PDF保存下载hash、附件删除后再保存、计划不增加record、完成保留类型/备注及原计划附件、双语原文/三宽无横溢。模式DOM、头像真实partial-retry、select/catalog keyboard、鼠标/键盘/Escape/模拟touch、多宠/CSV、首页原几何和既有四页回归有脚本证据；桌面模拟不是实际手机。

可信A文件真实PUT、confirm、read hash、wrong-parent/no-identity拒绝、完整恢复父ID映射、删除及回收检查通过；本轮合成类型新增/真实snapshot、custom record、typed plan note/complete、删除目录历史快照保留通过。只回收本轮exactreceipt，A每刷新checkpoint原600会话，最后18:21:31.760已归还独占权；不把夹具视为用户实际养宠。

接近上限**exact5MiB**原PDF实际SDK验证通过。腾讯SCF同步response6MB，base64大文件会超限；>1MiB附件经可信父项/owner/字节hash校验后返回60秒签名下载，客户端bounded fetch核bytes/hash，URL不进backup/metadata。照片原base64和≤1MiB限制未扩大。paw-api18:16:46 Active3s；paw-ai18:17:17 Active40s/模型25s；paw-files18:21:00 Active30s/读取20s，认证函数未修改，无采购/集团调用。

一次独立审查及必要修复：目录写后刷新session+表单revision、计划全量先校验+本地/demo幂等、附件删除更新表单revision；补旧other精确历史选项、计划note和完成继承、删当前类型触发字段更新、隐藏父项和customID筛选、JSON目录恢复、Tab进入管理footer。原型录入weight切换空title未默认导致HTML校验阻挡，实际RED后补默认title并回归；双模式同存语言切换曾跳过手动页，实际RED后逐表单刷新且不覆盖原文。旧脚本native select/旧按钮失效改可见新控件重验，不伪称产品故障。

取舍：超过3个/重名的跨空间目录合并明确拒绝、原数据不变，用户先调整目录再试；本轮不实现专门的“选哪些继续活跃”预览面板，原设计工程细节据用户基本用途/短时限缩减。完整文件/记录仍不能静默截断。实际用户亲验、真机软键盘/读屏/原生200%/日历实导保留后续阶段；阶段4社区/地域未在本修订实施。

原始证据在Git忽略test-results/record-refinement与test-results/refinement，安全日志/tmp/paw-refinement-*.log；用户私密数据/token/Key不纳Git。

真实AI计划最终验收：模型输出草稿，但未自动填计划日期；用户模拟补填2026-10-20并编辑标题后确认，实际reminder保存、0新record、pageErrors0。此前自动日期与合成指定标题两次过强断言失败保留；这不是自动日期提取全成功的证据。开始18:00:04，Release18:29:34用时29分30秒；整体≤1小时。第7步若从约18:11提前审查开始计，至发布已超过15分钟，不能声明全部单步时限达标；已向用户如实说明。

浏览器私有大文件来源补验：新Chrome context访问原URL，在页面fetch2MiB短时签名PDF，bytes/SHA一致、CORS通过；未登录页面或注入token。只删除/回收本轮exactreceipt，A最后18:32:26.044 checkpoint并归还，未变更规则。与真实5MiB生产client下载一起界定文件链路验收范围，不当真机证明。

官方边界来源：[腾讯SCF限制](https://cloud.tencent.com/document/product/583/56125)，读取该原页同步响应限制，不冒称通读腾讯全部文档。
