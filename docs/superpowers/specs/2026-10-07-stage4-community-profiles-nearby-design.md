# 阶段4：个人资料、真实社区与宠友发现设计

状态：Grilling Q1–Q12已回答；本文件与实施计划一起提交用户审阅，尚未开始产品实施。2026-10-07。

## 目标、起点和成功标准

让登录用户拥有明确的公开身份，能发布真实图文、查看他人的公开帖子并评论交流，主动加入按地域与养宠目的筛选的宠友发现。访客可以浏览真实公开内容。保留「记录→提醒→成长回顾」主线、现有视觉、私有健康数据和原发布链接。

实施起点为main04ed5c2，应用v0.6.2/source bf7274c，365单测及原URL技术验收；v0.6.1是设计初稿时的历史基线。现有社区和8条宠友为示例，个人/登录空间禁止真实社区写入；分享回顾仅预览复制。新增能力不能依据旧示例测试宣称完成。

成功标准：真实A/B账号及干净匿名浏览器走通公开资料、加入/退出、发帖、读取、评论、点赞、作者编辑删除、举报和个人隐藏；公开图片真的跨账号可读；全国地域搜索和实际坐标转地域可用；错误身份不能读私有数据或写他人内容；原URL通过后发布新v0.7.0。

## 已确认决定

| 决策 | 用户确认 |
| --- | --- |
| Q1 | 一个账号一张公开资料卡；新增头像菜单“个人资料”，进入独立个人资料页面 |
| Q2 | 公开资料→作者公开帖子→评论交流；不做私信 |
| Q3/Q5 | 延续视觉，宠友和社区两页都提供“全部／同城”；浏览城市与个人所在地分开 |
| Q4 | 先看完整plan再定实施；此前4–5小时为初估，没有新硬工时 |
| Q6 | 昵称头像为发帖身份；地域、猫狗、目的、短简介在主动加入发现后公开；邮箱只本人可见；退出发现保留已发帖作者身份 |
| Q7 | 匿名可浏览真实公开宠友；登录才加入发现或发帖、评论、点赞；加入前公开预览 |
| Q8 | 回顾默认简短真实摘要，不自动带完整AI故事；编辑并确认才发帖 |
| Q9 | 举报真实入队＋个人隐藏，用户在现云控制台手动处置；不承诺即时审核，不新增管理后台 |
| Q10 | 腾讯位置服务，新增费用先按0元核实；Key/SK仅服务端；不满足费用/许可条件时列待解决、不采购 |
| Q11 | 用户在实施时配合位置服务登录/必要实名/Key配置和真实两邮箱验证码 |
| Q12 | 验收通过发布v0.7.0，旧tag不移动 |

## 使用路径与界面

保留#home/#health/#nearby/#community，新增#profile。四个主导航不增加第五项；左下角和右上角头像打开同一个菜单，提供“个人资料”“登录与云同步／账号操作”。手机保留可见的头像按钮。原产品说明保持可达，菜单可保留“关于爪爪日记”调用原说明入口。按钮具备可访问名称、键盘操作、Esc关闭和焦点归还。

个人资料页未登录时提供登录入口，登录成功返回该页，无须先建宠物。页内编辑昵称、公开头像、所在地、猫狗多选、交流目的多选、短简介和“加入宠友发现”开关，显示本人邮箱和公开预览。发帖昵称必填；头像可用姓名首字占位。加入发现另需城市、至少一种宠物类别和一种交流目的。行政区与简介可空。资料读取失败不显示虚构默认账号；保存失败保输入；成功后刷新/重开可恢复。

公开说明区明确：发帖/评论会公开昵称头像；加入发现后公开预览中的附加资料；退出发现撤下宠友卡，不删除帖子或评论。用户改昵称头像后，帖子与评论显示当前公开身份；已发帖的地域按发布时选择保存，不因用户改变所在地而迁移。

宠友页：全部／同城切换→可搜索的城市/行政区→猫狗/交流目的组合筛选→真实卡片或空状态。全部模式允许跨城市发现；城市、区县筛选只在同城模式参与查询，保留选中值供下次切回。显示所在地，不显示距离、在线状态或住址。自己以“这是你”区分。卡片详情展示已公开字段和作者帖子；无帖子时给查看社区/发布找搭子帖入口，不能伪造交流已建立。

社区页：全部／同城、话题与关键词筛选，真实帖子单独加载与分页；示例在明确标注的独立区域，不混算人数/赞数。帖子详情有评论、点赞、作者编辑删除、举报和个人隐藏。发帖城市默认建议本人所在地，可手选；城市可空，空城市帖子只进入全部。正文与评论均纯文本。发布失败保留编辑输入及已准备图片；重试复用同一操作ID，不重复发布。

新增页面和编辑器沿现有森林绿/奶油白/白卡，使用Impeccable及DESIGN.md。中英文均支持；用户原文不自动翻译。手机、长昵称、空内容、加载/失败/重试、键盘和焦点均纳入验收。

## 公开数据、存储与权限

新增独立paw-community服务、community repository与store，不写入health.snapshot、不使用健康workspace revision。复用SDK callFunction通路：显式配置paw-community invoke:true，handler只对白名单读取允许无Principal；写入继续复用可信邮箱Principal。带无效token须拒绝，不降级访客。匿名provider=false、现私有函数权限、集合/对象deny保持原规则。

所有owner来自可信Principal。公开作者ID为独立随机authorId，公开响应不带平台UID、邮箱、文件内部路径、验证码或健康snapshot。查询使用允许字段投影，不序列化内部document后直接返回。客户端按账号generation、页面generation和筛选序号丢弃迟到响应；账号切换清理旧编辑器和公开身份缓存。社区身份generation独立于健康空间，auth identity变更时在现handler提前return之前同步失效；登录用户即使当前看本地/示例健康空间，社区仍使用可信账号身份。client每次调用前通过auth.getRequestSession取得当前已验证principal/authToken，检查预期owner和generation，token附加到请求顶层；匿名不附token，返回后再次核scope。

以下是实施约定，均为本轮新增字段，不迁移私有健康snapshot：

- AuthorProfile：内部ownerId；公开authorId；nickname 1–30字、avatarAssetId可空；bio 0–120字；cityId/districtId可空；petTypes取cat/dog，purposes取新手互助/遛宠搭子/养猫交流/多宠家庭；discoverable默认false；revision、createdAt、updatedAt。
- PublicIdentity：authorId、nickname、avatarAssetId；允许作为真实公开帖子/评论的作者显示，不包含所在地、简介和发现偏好。
- DiscoverableProfile：PublicIdentity加所在地名称/编码、bio、petTypes、purposes；仅discoverable=true可被发现/详情公开读取。
- Post：id、内部ownerId、authorId、title 1–60字、text 1–1500字、topic取今日萌宠/遛宠搭子/养宠心得、cityId/districtId可空、imageAssetId可空、likeCount/commentCount、revision、createdAt/updatedAt/deletedAt、moderationStatus取visible/hidden。帖子修改/删除须expectedRevision。
- Comment：id、postId、内部ownerId、authorId、text 1–400字、createdAt/deletedAt；本轮可删除自己的评论，不新增评论编辑/楼中楼。
- Like：内部ownerId＋postId唯一文档，liked布尔；事务按期望状态修改，重复true不加次数；不采用toggle。
- Report：内部reporterId、postId、reason取广告骚扰/不当内容/隐私问题/其他、note 0–200字、status取queued/resolved/dismissed、createdAt；普通用户只能提交和读取自己回执，不能修改处置状态。
- HiddenPost：内部ownerId＋postId唯一；个人隐藏仅影响本人列表。个人资料页提供“已隐藏内容”轻量列表和取消隐藏入口，防止误操作无法恢复。

集合限定为community_profiles/posts/comments/likes/reports/hidden/receipts/media/rate_limits和region目录缓存。索引随所属任务建立：公开列表status＋createdAt/id，作者帖子authorId＋status＋createdAt，评论postId＋createdAt/id，发现discoverable＋cityId等筛选字段。列表默认20、最大50，采用服务端校验的稳定游标；健康仓储不全量加载社区。

写操作要求idempotencyKey（≤128字符），服务端receipt同时记录请求摘要，重复相同内容返回已提交结果，复用key但内容不同拒绝；事务保障作者校验、revision、计数和receipt一致。无法确认结果时提示重试同一操作，不自动用新key重复创建。提交后删帖的并发评论/点赞不得使帖子重新可见。删除和管理员隐藏立即排除新的列表/详情/媒体读取，已加载到用户设备的内容无法通过服务端撤回。

## 图片与头像

本轮沿单图帖子，头像/展示图压缩后≤1MiB；用户选原图≤10MiB。只接受现图像处理实际支持的JPEG/PNG/WebP，并检查真实MIME、字节、hash、尺寸及上传者。公开资源另存，不绑定他人资源，不直接公开私有宠物头像/照片墙fileRef，也不使用私有临时下载URL冒充公开图片。

community.media.prepare/confirm提供上传票据和资源，发布/头像保存事务绑定到允许的post/profile。draft图片只能本人读；匿名读取同时提供reference:{kind:'post'|'profile'|'comment',id}，服务端确认该公开父项有效且实际引用该图片或该作者当前头像，评论还需有效公开帖子。单个资源一次用途绑定，移除绑定后不能继续用旧资源ID公开读取；头像与profile绑定，可通过有效公开帖子/评论或discoverable资料读取，不需要公开枚举作者的全部私有资料。读取每张≤1MiB图片经函数返回校验后的dataUrl，客户端惰性加载、去重并限制并发；不把长效对象URL放公开文档。数据库/对象仍deny直接访问。

上传中、上传成功但发帖失败、换图、取消、删帖、替换头像都要处理确切资源；为未绑定资源增加24小时过期标记及运维清理命令。本轮公开资源按owner单独50MiB限额及最多20个未绑定票据，服务端核限额，不改变现私有50MiB语义。媒体/个人资料不进入现私有backup与AI上下文。

## 全国地域与可选定位

主地域目录来自腾讯官方行政区服务，服务端通过签名请求获取和规范化，只缓存应用所需名称、编码、拼音和父子关系；不把原始全量表复制进公开Git。更新目标24小时，更新失败保留last-good版本并显示更新时间。精确许可/缓存条件、账号免费额度/QPS需在Task6实际核实，未满足时不得称全国地域或真实定位已接通。

regions.search({query,parentId?,level:'city'|'district',cursor?,limit:20})、regions.children({parentId})与regions.meta返回裁剪字段及目录版本。城市/区县匹配使用稳定编码；直辖市、港澳直接下挂区、直辖县、东莞等无区县城市单独规范化，不能把街道强行当区县。范围和缺漏写地域来源文档，港澳台细粒度覆盖以实际返回为准。不能宣称所有地区都全量覆盖。目录按小文档分块，单块≤64KiB，读取失败保已有选项/手动选择与清晰重试。

可选getCurrentPosition只在点击后申请权限，maximumAge=0、timeout=10000、enableHighAccuracy=false。确认浏览器实际坐标系和地区后，WGS84经腾讯translate(type=1)转换，再geocoder get_poi=0；纬度在前、经度在后。台湾等接口坐标差异按当次腾讯文档处理和测试，不能统一错误转换。对无法识别/不在目录的返回不猜地区，要求用户手选确认。

新增regions.suggest({latitude,longitude,visitorId})：坐标仅本次函数内与供应商请求使用，不写数据库、日志、备份、资料或AI；响应只返回地区建议和编码。供应商单请求超时5秒，建议流程客户端总等待≤25秒；失败/拒绝/不支持/超额均继续手选。拿到建议后用户确认才改所选地域或保存资料。

腾讯Key/SK读取PAW_LBS_KEY/PAW_LBS_SECRET_KEY，仅本机私密env和服务端配置，不复用TENCENTCLOUD/FUJI管理凭证。先登录个人位置服务账号读回主体、免费配额、QPS、启用的WebService与许可/签名要求；用户配合必要账号步骤。新增付费预算0元，不自动升级、购买或切其他供应商。每次上游请求前做服务端原子限额，应用请求上限先设100次/日、1000次/月，并按实际免费剩余额度下调；定位visitor≤5次/日、IP≤10次/日，目录刷新也计入上游预算。IP取可信平台请求上下文并散列，不接受payload伪造IP；无法获取可信来源时暂停匿名定位并保留手选。免费余额不足立即停止新请求，不能以本地次数推断账单一定0元。

## 举报、隐藏与回顾分享

举报需登录，提交后显示“已提交，等待处理”；重复举报不无限增加同一队列项。个人隐藏只影响当前账号的阅读，可恢复。用户担任维护者，在现云控制台通过私密运维命令处理指定reportId/postId；管理权限来自FUJI服务端凭证，普通用户不能把自己升为管理员。处置记录action、时间和报告状态；不在SESSION_LOG写举报原文或用户私密数据。管理员下架要同时阻止公开详情/评论写入/图片读；不靠前端隐藏按钮。

回顾分享复用已有日期范围和真实记录数摘要，排除回收站与未来计划，不自动带入完整AI故事、体重或护理明细。预览后打开社区草稿，可编辑标题、正文、单图、话题与地域，说明将公开；最终按发布按钮才写帖子，取消两层预览均无帖子/评论/资料更新。未登录登录成功后回到草稿；登录不隐式迁移本地健康数据。

草稿跨登录/补昵称仅允许单次显式handoff：用户点击“登录后继续”或“完善资料并返回”时，将准备公开的标题/正文/话题/地域及主动选图保留在该浏览器tab内存，最多30分钟，不含健康snapshot、凭证或私有fileRef。guest handoff在用户发起的这次登录完成后绑定实际可信owner；已绑定owner的重认证只能恢复给同一owner。补资料后同owner可恢复，恢复后消费nonce并销毁交接对象；取消登录、换账号、退出、放弃或过期均清除。新账号不能收到A的草稿；普通身份变化仍执行旧稿清理，不能借handoff普遍关闭generation保护。确认发帖前尚未上传的本地选图只在成功绑定owner后走公开媒体上传。

## 错误处理、验收和发布

未保存个人资料页离开/切路由使用现主题discard确认；浏览器刷新保beforeunload。保存中防重复；CONFLICT保输入并提供重新读取/再提交；UNAUTHENTICATED引导重新登录，保原账号草稿但不带入另一账号。读失败与真实空状态、示例区域分开。切筛选和账号时清理旧图片任务、焦点与迟到结果。

新增单测验证权限/白名单投影/计数/幂等/并发/图片绑定/地域/配额；SDK真实A/B＋anonymous验证共享及隔离；原URL浏览器验证真实读取和双语1440/768/390。先核test_app.py中的历史标题自动生成断言，按v0.6.1修正测试而不回退产品。

A尝试恢复并每次refresh写回原600 checkpoint；B旧会话失效，需新真实邮箱验证码。测试仅用明确合成receipt与资源，清理只按确切ID，不按名字/时间窗扫用户资料。不会用管理账号或mock替代真实账号验收。桌面模拟不代称真机。

通过后发布v0.7.0：新增tag，不移动旧tag；新鲜npm ci/build，公开JS/CSS SHA与本地相同，Pages success及Release公开，原网址和四hash可用。README仍产品用途和体验入口优先。任一核心门槛未过只记录待项，不提前宣称阶段4完成。

## 时间、依赖与范围

固定最终截止2026-10-08 20:00 Asia/Shanghai。主agent统一app.js、路由、全局样式、构建/权限规则、云部署与发布；边界模块可并行。详细拆分后建议4–6小时执行窗口（账号及时配合且并行），串行工作估算约5.5–8.5小时；此前4–5小时是调查前估算。每项任务目标≤1小时，超过即记录实际、缩减装饰，不把目标写成保证。用户先审阅plan再启动。

依赖：腾讯账号及0元适用条件、全国目录真实读取、A/B实际会话、新函数权限及数据库索引。条件未满足要明确受影响任务，继续独立工作；真实定位/全国地域/跨账号失败都不能用mock代验。阶段5指南/新内容/PWA、真机/读屏/日历实导及用户亲验仍独立待项。

## 事实来源与阅读范围

本地依据：stage4-handoff.md；app.js:233/344/461/560/595；index.html:23/26；backend/api.cjs:39、cloudbase-store.cjs:23、photos.cjs:332/378；weekly-recap.js:25；scripts/cloud-setup.py:484–489。两explorer只读核代码与官方资料；未读私密会话，未调用业务API。

腾讯WebService目录盘点56个index节点/48页面节点，定向阅读逆地理/转换/行政区/Key/许可，未通读其他路线/SDK；精确额度动态页和完整服务协议未读全，账号实施前检查明确保留。高德仅为比较候选，用户已选腾讯。开源候选modood为2023停更、uiwjs为2021/2022资料，不作为2026最新目录；未验证其完整地域覆盖。研究于2026-10-07，原页错误后同页只读HTML补读，不把摘要当字段结论。

- https://lbs.qq.com/service/webService/webServiceGuide/address/Gcoder
- https://lbs.qq.com/service/webService/webServiceGuide/webServiceTranslate
- https://lbs.qq.com/service/webService/webServiceGuide/search/webServiceDistrict
- https://lbs.qq.com/service/webService/webServiceGuide/overview
- https://lbs.qq.com/faq/serverFaq/webServiceKey
- https://lbs.qq.com/faq/accountQuota/faqKey
- https://lbs.qq.com/faq/accountQuota/faqQuota
- https://lbs.qq.com/faq/authorizationFaq
- https://lbs.amap.com/upgrade
- https://lbs.amap.com/pages/terms/
- https://lbs.amap.com/news/service_amap
- https://lbs.amap.com/api/webservice/guide/api/georegeo
- https://lbs.amap.com/api/webservice/guide/api/convert
- https://lbs.amap.com/api/webservice/guide/api/district
- https://lbs.amap.com/api/webservice/create-project-and-key
- https://lbs.amap.com/faq/quota-key/key/41181/
- https://www.w3.org/TR/geolocation/
- https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition
- https://github.com/modood/Administrative-divisions-of-China
- https://github.com/modood/Administrative-divisions-of-China/blob/master/LICENSE
- https://github.com/modood/Administrative-divisions-of-China/blob/master/dist/pca-code.json
- https://github.com/uiwjs/province-city-china
- https://github.com/uiwjs/province-city-china/blob/master/LICENSE

实施补充：回顾分享预览独立绑定公开owner/generation，健康本地模式下换A/B同样关闭旧预览并禁止旧文本进入新账号draft；长首行不截断，发布表单按60字校验并保输入。公开社区弹窗内提供语言选择，保文本和图片意图。未绑定公开图片24h为标记＋人工清理命令，本轮无自动TTL job；PUT结果不确定保charged tombstone，不能承诺供应商迟到上传时限。使用jpeg-js有界真实JPEG解码，WebP在前端规范化PNG，私有媒体机制保持。
