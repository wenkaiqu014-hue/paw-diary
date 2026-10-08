# 地域目录与主动定位

**v0.7.1实际更新：** 默认visitorId和事务并行读取已修复，真实桌面原生定位/平台SDK/地区目录通路已过；城市菜单内自动搜索与独立滚动已上线，真手机GPS仍阶段5。下面“待真实验收”为模块初交付历史，不按它重选平台/Key。最新源见region-picker-v071-report和stage5-handoff。

本页记录阶段4地域模块的运行边界。代码单元验收通过不代表全国目录、真实Key或实际定位已经接通。当前尚未读取腾讯位置服务账号许可、免费配额/QPS及签名配置，没有调用真实位置服务；未验证全国实际覆盖及台湾坐标路径。

服务端 `createTencentLocationClient({key,secretKey,fetch})` 对腾讯行政区目录、WGS84转换(type=1)、逆地理(get_poi=0)发起带签名请求，坐标参数均纬度在前。Key/SK只能由Root从环境变量PAW_LBS_KEY/PAW_LBS_SECRET_KEY注入，模块不读取其他管理凭证，不记录URL、供应商异常原文、坐标或Key。单请求5秒包含响应正文读取，正文最大4MiB；无真实配置、HTTP错误、非零status、非法响应、超时均返回REGION_UNAVAILABLE。

`createRegionStore({db})` 用community_regions存裁剪后的目录，community_rate_limits存预算及刷新租约，二者须禁止客户端直接读写。只保存id/name/level/parentId/pinyin。目录分块每份连同文档包装≤64KiB，内容寻址避免相同目录反复生成新块，最后更新manifest使未成功更新不会覆盖last-good。旧版本内容块不立即删除，以保在途读取；需要长期维护时由运维核manifest引用后清理确切旧块，不扫描私有资料。

目录更新时间目标24小时；过期时有20秒刷新租约和单实例去重，刷新失败继续last-good并返回stale与updatedAt。没有缓存且许可未核时，search/children/非空normalize返回REGION_UNAVAILABLE，meta返回available=false。不以旧六城、合成fixture或手工编造目录替代真实全国目录。直辖市用省级编码作城市，港澳可直接挂区，省/自治区直辖县级分组下的县市提升为可选城市，无区县城市不把街道充当区县。实际编码和港澳台覆盖须以后续真实响应核验。

`createRegionsService({store,client,providerReady,freeDaily,freeMonthly,clock})`默认providerReady=false、已核免费额度0，阻止新增上游调用。Root确认个人用途、缓存许可、Key类型/签名条件及免费配额后，才设置providerReady=true及freeDaily/freeMonthly。应用预算取已核配额与100次/日、1000次/月的较小者；每次directory/translate/reverse调用前单独原子预留，失败也保留尝试计数。visitor每天5次定位、可信IP每天10次；IP散列由gateway从平台上下文传入，不读取payload.ipHash。没有可信IP时拒绝匿名定位并继续手选。站点业务计数不能证明实际账单0元；账号其他用途及剩余额度仍要由维护者核对下调。

actions为regions.meta/search/children/suggest，dispatch返回业务data，gateway统一包装。normalize异步返回cityId/districtId/cityName/districtName，切城市时无效district清空。search默认20最多50，游标绑定查询及目录版本；未知地区不按名称猜编码。suggest只返回匹配目录的建议，没有纬度经度；供应商返回台湾71开头行政码时暂返回LOCATION_MANUAL_REQUIRED，保留手选。台湾正确坐标路径未核，不宣称实际台湾定位支持。

前端mountRegionPicker提供城市搜索、分页、行政区联动、目录更新时间/失败重试与定位建议确认。只在显式点击调用getCurrentPosition，maximumAge=0、timeout=10000、enableHighAccuracy=false；整个流程最多25秒。获取建议不自动改变资料，用户确认后才改变选择，资料仍需另按保存。拒绝、超时、不支持、预算拒绝都可继续手选；迟到结果不修改其他账号/已销毁页面，浏览器定位超时后不能再发起迟到上游调用。

待真实验收：个人主体及免费许可、WebService Key/SK签名验证、官方directory/translate/reverse真实调用、六城以外及特殊层级实际覆盖、匿名SDK/gateway通路与可信IP、用户有头浏览器真实授权/拒绝及区域建议。真机GPS仍留阶段5。Root负责账号、环境与部署，worker没有调用真实接口或修改云配置。

沿用本轮设计中的官方目录盘点（56个index节点/48页面节点，定向阅读行政区/逆地理/转换/Key/许可；未重读其他路线/SDK，动态账号配额及完整许可仍待账号核验）：

- https://lbs.qq.com/service/webService/webServiceGuide/search/webServiceDistrict
- https://lbs.qq.com/service/webService/webServiceGuide/webServiceTranslate
- https://lbs.qq.com/service/webService/webServiceGuide/address/Gcoder
- https://lbs.qq.com/faq/serverFaq/webServiceKey
- https://lbs.qq.com/faq/accountQuota/faqQuota
- https://lbs.qq.com/faq/authorizationFaq

流程技能使用本机superpowers:test-driven-development、verification-before-completion以及catalog-official-product-docs；高star技能来源沿本轮执行入口已记录的https://github.com/obra/superpowers，无重复安装。
