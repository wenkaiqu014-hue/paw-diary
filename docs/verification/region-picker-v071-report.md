# v0.7.1：定位与地区菜单修复

用户反馈：浏览器“用当前位置建议地区”一直无建议；区多时必须同时滚小列表和大弹窗；希望删顶部搜索，改城市菜单内首行自动搜索。追加要求删除社区／宠友“看看内容示例”。本补丁由fix/region-picker-v071从66f8690实施，原网址与旧tags保留，发行核验待追加。

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

诊断中CloudBase日志接口无记录，不以它编造原因。临时HTTP/provider数字状态与数据库错误分类均无输入；所有临时响应字段和console诊断已删除，最终函数paw-community于11:35:41 Active。未部署私有API／模型／认证，不改变provider或购买费用。原始flags／截图／失败日志在Git忽略的test-results/region-v071及region-picker-v071。

## 发行核验

待：新main构建/测试、原网址SHA及交互检查、v0.7.1新tag/Release和文档收口。以实际结果补充，不提前声明发布。
