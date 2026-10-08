# v0.7.1：定位与地区菜单修复

用户反馈：浏览器“用当前位置建议地区”一直无建议；区多时必须同时滚小列表和大弹窗；希望删顶部搜索，改城市菜单内首行自动搜索。追加要求删除社区／宠友“看看内容示例”。本补丁由fix/region-picker-v071从66f8690实施，原网址与旧tags保留，v0.7.1已于2026-10-08 11:48:44 Asia/Shanghai正式发布。

## 已修复

默认浏览器路径没有给regions.suggest传必填visitorId，服务端拒绝。现在使用独立随机浏览器标识，localStorage／内存保留，同一浏览器重开菜单或存储后来拒绝不会换ID；不依赖登录UID、不打印坐标、标识或密钥。新默认路径与预存ID→存储拒绝的行为测试均确实RED后GREEN。

实际原生Chrome得到位置、但服务间歇失败的另一原因是数据库限流事务忙：安全诊断捕获`DATABASE_TRANSACTION_FAIL`，内部`ResourceUnavailable.TransactionBusy`。同一事务内两个计数读取原用Promise.all，SDK没有串行队列。改成顺序读取全部计数、统一校验、顺序写入，保持原子额度与共享QPS，未重试整请求或扩大额度。针对事务禁止并行读取的复现RED→GREEN；随后真实SDK公共点和原生Chrome实际坐标链路均返回建议。原管理身份成功不能代替平台SDK，修复后另实际验证。

权限拒绝、浏览器未取得位置、浏览器无定位API、超时、地区服务失败、目录未覆盖和额度耗尽分别给可操作消息。真实桌面定位未模拟坐标；真实手机GPS仍未验收。

顶部独立搜索移除；城市下拉首行搜索输入200ms自动查询，支持输入法、键盘与迟到结果丢弃，选中城市和搜索结果分开，保分页。地区选项浮层采用viewport fixed定位和列表内滚动；原scrollIntoView改为直接滚动列表，避免滚祖先。全局记录类型等其它下拉仍保原功能。社区／宠友例子区、相关locale刷新和CSS已删；首页引导文案同步为真实宠友，不删旧备份内本地数据。

## 验证

- `npm test`552/552、0fail/skip；构建、node --check、diff检查通过。
- 有头真实DOM旧版复现：1440父height416.98不变，但scrollHeight417→624、scrollTop0→206；新版1440/768父height326.23、scrollHeight326、top0，390父height410.62、scrollHeight411、top0，打开与滚到底完全不变，末区可直接选。
- 城市菜单内搜索、200ms自动查询、IME、End/Enter/Escape、迟到搜索、destroy和原共享下拉DOM验收通过。
- Root真实App三宽双语／键盘／保稿／手选E2E通过；原健康主线回归另在最终日志记录。
- 实际SDK与原生Chrome（明确grant网站定位权限、无坐标mock）修复后显示建议确认；最初获坐标但旧接口无建议亦有safe flags留证，未把模拟当真机。
- Root独立审查workerUI并亲看截图；worker独审Root helper／例子移除，找到低影响存储fallback边界并由Root RED→GREEN修复；独立explorer审事务根因与SDK，没有把MongoDB约束冒充CloudBase书面规则。

诊断中CloudBase日志接口无记录，不以它编造原因。临时HTTP/provider数字状态与数据库错误分类均无输入；所有临时响应字段和console诊断已删除，当时函数paw-community于11:35:41 Active，最终发行前清理后11:47:23 Active（见下文）。未部署私有API／模型／认证，不改变provider或购买费用。原始flags／截图／失败日志在Git忽略的test-results/region-v071及region-picker-v071。

## 发行核验

main/source/tag解引用0a1b2eabefb5d8af60c9aa19c1b603c8a16ce004，552单元及全新npm ci/build通过。Pages37723735372 success，Deploy11:40:05、workflow11:40:06。原URL实际公开三宽双语／键盘／保稿／手选检查通过；例子区不存在，顶部独立搜索不存在。最后原URL原生Chrome定位（无坐标mock）实际得到地区确认按钮。新annotated v0.7.1／Release11:48:44公开，非draft/非prerelease，旧tags不动。

原URL模块图及字节SHA匹配main构建：app-CO2I3K3F.js=07e52a0604fbb48759b330ddbbcd1bfed7219baeb0f3aba7ad212b328816f326，style-P6JZ3ZBI.css=eefad42303266ed5a66fc3bf1a8a42a55d93320510f77899f9dfbe58081446c1。证据test-results/region-v071/online-build-verification.json、online-public-e2e.log、online-final-native.log。

连续调试触发本机当天IP定位10次上限，线上末次第一次验收得到准确“额度已用完”。Root按该次已知合成nonce与可信平台IP，只在私密deny集合临时保存本机counter精确引用，管理事务核当前日期／nonce／count=10后回退两次本轮已确认调试占用（10→8），不清全部计数、不改perIP上限10或全站day/month及上游实耗。临时引用文档删除、临时函数代码恢复；最终paw-community11:47:23 Active。随后默认ID正常原URL原生定位成功。此清理仅用于本轮自身调试，不提供对外配额绕过功能。

用户最后明确本轮只发0.7.1，未创建0.8；阶段5待项和最终20:00仍保持。
