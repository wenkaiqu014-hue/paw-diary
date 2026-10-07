# 阶段2：免登录本地档案与邮箱云同步设计

状态：2026-10-07规划稿；用户要求本轮只分析/plan，未开始实施。本稿与对应实施计划一起供下一轮审阅，产品能力均未验收。用户原话及前置研究见[讨论记录](../plans/2026-10-06-followup-discussion.md)；实现任务见[阶段2计划](../plans/2026-10-06-02-cloud-identity.md)。

## 1. 已确认目标与阶段边界

不登录也能建立自己的多宠物档案、手动记录、管理护理、回收站、排序、导入导出、自定义头像、当前宠物照片墙与幻灯片。示例体验保留，自己的档案从空数据开始。用户主动选择云同步或真实社区交互时登录；本阶段只实现邮箱身份和私有云同步，真实社区仍为阶段4，不能把登录后的本地发帖称为共享。

用户接受免费先验证，必要基础云服务约20元/月；本次微信/手机号不做真实接入、不展示不可用按钮，作为后续目标保留。未来多种方式经平台验证和主动绑定共用一个UID，不能按昵称/头像自动合并。当前不创建微信/短信身份源、不购买短信。

本阶段同时完成other/typeLabel自定义宠物和记录类型、中英文覆盖现有四页及新账号/照片界面、V3完整生命周期云端镜像、确认迁移与照片完整备份。AI、三步AI引导、成长回顾、助手、真实社区、定位、指南/新内容、PWA仍按原阶段推进。匿名AI的身份/额度在阶段3定，不借本地照片需求提前承诺纯本地AI。

实施以八小时为目标，含真实验证与修复；从用户后续明确要求正式开始时记录工具时间计时。本轮规划不启动计时。八小时不是完成保证，外部认证/资源失败不能靠mock或虚勾消除，最终截止仍2026-10-08 20:00。

## 2. 方案比较与推荐

| 方案 | 收益 | 代价/判断 |
| --- | --- | --- |
| 独立本地IDB仓储＋服务端每用户健康文档/版本事务 | 保留领域函数，图片与本地快照原子保存；减少云端多集合联动；适合本次小规模作品 | 推荐；健康文档有显式大小上限，图片另存，未来大规模分页另设计 |
| 沿旧计划拆pets/records/reminders多集合 | 扩容和单实体查询更自然 | 全量快照仍需组装，回收站/排序/迁移跨集合事务增加本轮整合面 |
| 前端直接写库/本地通用mutate直接上传 | 接口表面最少 | 不采用：任意快照及客户端ownerId不能成为权限依据，也不等于可信冲突保护 |

前端保留原生HTML/CSS/ESM、现有视觉和四个hash，不重写框架。后端沿个人账号CloudBase候选先验证，所有私有业务走paw-api。数据库、文件对象拒绝前端直接读写；图片读取也走验证身份/归属的`media.read`，返回受大小限制的图片字节并在浏览器生成blob URL，不向客户端发可转用的对象下载签名链接。暂存上传可用限时上传凭据，不能用长期公共URL顶替私有读取。

健康文档与媒体、幂等回执分开：`health_workspaces`每用户一个完整V3快照与revision，`media_assets`存媒体元数据，`mutation_receipts`存幂等结果，`import_maps`保存来源到云端ID的映射。云事务修改健康/媒体元数据/回执；对象存储的上传与删除用分阶段确认/清理，不能声称跨数据库和对象存储原子事务。

## 3. 三种空间与现有数据保护

`WorkspaceMode = demo | local | account`。

- demo：继续使用`paw-diary:v3:demo`及既有DemoRepository，示例操作/帖子明确本地演示。保留v1/v2原文、备份与损坏数据恢复路径，不自动挪动旧数据。
- local：独立IndexedDB `paw-diary-personal`，首次为空；不把IDB伪装成DemoRepository的getItem/setItem。三个store为`workspace`、`media`、`blobs`，同一readwrite事务比较revision并提交快照/元数据/Blob，transaction complete后才显示成功。
- account：只有真实SDK验证的邮箱会话能访问；未迁移时空档案。退出回到自己的local空间，不能把账号健康数据复制到local或demo；退出清该账号内存、媒体临时URL和正在执行的旧视图请求。登录过期展示可重新登录的状态，不把上个账号资料作为匿名页面。

首次访客可看示例，明显的“开始记录我的宠物”直接进入local建档，不弹登录。用户主动点击“登录与云同步”后才进行邮箱流程。空间切换遇未保存表单先让用户继续编辑或明确放弃，不自动上传/清空输入。

城市与宠物排序属于档案数据，在云端共享。当前宠物选择为本设备/空间偏好：以`paw-diary:selection:<workspaceKey>`隔离保存，拉取时先保留有效选择，所选已被回收则回到第一只可见宠物。云健康快照的activePetId仍是领域校验所需的有效默认值；不因另一设备选择而改变当前编辑对象。语言偏好独立于业务快照。

账号/local空间的社区页展示独立只读示例与“真实社区尚未开放”的说明，不将示例帖子写入个人健康快照。demo保留旧演示互动；阶段2没有真实共享发帖/点赞/评论。

## 4. 领域数据与仓储契约

继续`AppSnapshotV3.version=3`、完整pets/records/reminders/posts/profile及deletedAt语义；增加可接受的mode=local，新增字段均兼容缺省的旧V3。媒体与revision在仓储envelope中，不作为任意顶层字段塞进validateSnapshot后被剥离。

`Pet`及`HealthRecord`允许`type:'other'`，其`typeLabel`去首尾空白后1–20字；非other不保存typeLabel。Pet增加可空`avatarAssetId`，旧image保持兼容；other默认使用中性图标，不显示成猫/狗。自定义记录不参与体重趋势，CSV增加typeLabel列；完成由自定义记录派生的护理必须保留来源typeLabel。旧日期/估计月龄、unknown历史完成、同日排序规则不变。

`WorkspaceEnvelope={snapshot:AppSnapshotV3,revision:number,workspaceId:string}`，本地workspaceId为初始化一次的UUID；云端空间标识由服务端生成，不能由客户端选择owner。revision从0开始，只有成功的共享业务变更递增。

三种仓储保持既有方法与返回形状：snapshot返回完整健康快照；savePet/saveRecord/saveReminder返回实体；completeReminder返回`{reminder,record}`；moveToTrash/restoreFromTrash/reorderPets返回完整快照；deleteRecord/selectPet返回undefined。增加`getRevision()`、`saveProfile({city})`、`exportArchive()`、`previewArchiveImport(archive,selection)`和`commitArchiveImport(preview,{acceptedConflictIds})`。旧任意mutate仅留demo；local/account的城市改成saveProfile，帖子动作不通过健康仓储伪装成真实社区。

LocalRepository保留getRawBackup/replaceSnapshot作为本地恢复入口；CloudRepository的getRawBackup导出已取得的完整健康数据（不称含照片），账号恢复界面改用previewArchiveImport/commitArchiveImport走服务端导入，不开放任意远端replaceSnapshot/mutate。读取故障先提供原文/可用备份，不能初始化seed覆盖。

## 5. 邮箱、会话和并发

工程建议采用邮箱验证码的无密码注册/登录统一流程，避免新增密码找回系统。`AuthAdapter`固定应用接口：`getSession()`→`{userId}|null`，`requestEmailCode({email})`→不含身份的`challenge`，`verifyEmailCode({challenge,code})`→真实会话，`signOut()`，`subscribe(listener)`。challenge只映射SDK验证信息，不自行签发用户身份。具体V3 SDK方法/验证码及反滥用流程在Task1以安装源码/真实邮件锁定；如代发/发送额度不可用，报告前置失败，不降级成预设账号。

`createAppSession(repository)`兼容旧调用，增加`switchWorkspace({mode,repository,principal})`、`refresh()`、`generation`。每次切空间/退出增加generation，请求、刷新、媒体URL解析都捕获generation，迟到结果不得改缓存或页面。失败保留最后成功状态和错误，不能提示已保存。

刷新/回到前台拉取云端数据，不开启实时watch。有打开表单时保留输入与其`{petId,entityId,baseRevision,generation}`；不重新渲染表单使其换宠物、丢失输入。保存捕获的petId，后续切宠物不改变它；空间已改变拒绝保存旧表单。语言切换只更新界面文字，不变用户输入。

写请求为`{version:1,action,payload,authToken,expectedWorkspaceId,expectedRevision,idempotencyKey}`。审查修复中加expectedWorkspaceId作为本次意图防错断言，必须等于server由可信owner+env派生的空间值，在任何Store/回执前校验，不作为授权/owner选择。authToken仅当前官方SDK会话的瞬时Bearer，用固定env官方原始资料查询校验email_verified严格true且UID与平台上下文相同，移除后才进业务hash/回执，不cache/log。身份所有权仍只取已验证的平台调用上下文。Principal同时要求真实已验证邮箱账号，不能把匿名平台用户的非空uid当邮箱登录；必要时通过平台可信用户查询确认身份类型。服务端先校验请求/身份及幂等payload hash，同一合法请求已有回执直接返回原结果；否则在事务内比较expectedRevision、验证全部关联归属、执行领域变换并保存revision+1及回执。重复key配不同请求拒绝，不覆盖回执。CONFLICT保留输入，拉取最新数据后由用户重新决定；不自动最后写入覆盖。

云健康文档建议设1MiB序列化上限（不含照片文件），单次普通action输入64KiB；这是工程保护阈值，不是已核实的平台硬上限，Task1验证响应/文档/事务能承载它。超过限制明确拒绝并保留本地/备份，不截断。迁移用批次暂存和最终事务，不能把大备份一口塞进callFunction请求。

## 6. 媒体、删除与备份

`MediaAsset={id,petId,kind:'avatar'|'photo',caption,createdAt,mime,bytes,sha256,fileRef}`。ownerId仅存在服务端文档；临时下载URL和blob URL只存在视图，不写Pet.image/备份。只有该空间且当前pet有效时列照片；父宠回收保留对象，派生隐藏，恢复父宠后照片重现。

工程建议：原始JPEG/PNG/WebP≤10MiB，浏览器处理成最长边1920px、≤1MiB的展示图片；保留透明度，处理失败不上传，不承诺保留原图/EXIF。界面说明保存展示版；avatar缩至512px。一次最多10张，默认空间媒体总量上限50MiB（包括回收站宠物的文件），上限为可配置保护，不按虚假固定浏览器配额判断。Quota/事务失败保留待上传输入，不回退到localStorage大base64。

`MediaRepository.list({petId,cursor,limit:20})`、`save({petId,kind,blob,caption,baseRevision,operationId})`、`remove({assetId,baseRevision,operationId})`、`resolveUrl(assetId)`。list排序createdAt降序/id稳定；URL返回释放函数，切宠物/空间、删照片或关闭幻灯片释放。Avatar单独上传独立资产，不实现“相册图设头像”的共享引用；替换头像先保存新资产+健康引用，再清旧独立资产，失败保留旧头像。

单张照片删除必须明确永久确认。先事务删除可见元数据/标记文件待清理，立即拒绝后续media.read，再清对象；重复删除同一幂等请求返回原成功。对象删除失败保留待清理记录重试，不能说已释放空间；新上传未确认的临时对象同样有清理状态。已下载副本不作秒级撤销承诺。父宠回收不走照片永久删除。

上传云文件分`media.prepare`→上传暂存对象→`media.confirm`；后台核实际类型/大小/hash/身份/宠物归属，伪造fileId拒绝。不采用可公开遍历的对象权限。幻灯片只由用户主动打开，默认暂停，可播放/暂停/上下一张/Esc退出，减少动画静态切换，最后照片删除时退出并恢复焦点。

完整备份格式为`{format:'paw-diary-archive',formatVersion:1,archiveId,sourceWorkspaceId,exportedAt,snapshot,assets}`的JSON，sourceWorkspaceId为初始化一次的空间标识（不是UID/授权依据），archiveId标记本次导出；assets含经过校验的元数据与展示图片base64，不含fileRef；本地Blob和云文件都完整读取后才提示完成。导出snapshot.mode统一为local并移除云ownerId/平台fileId/临时URL/登录信息，稳定资产ID关联保留，导入时在当前空间重建身份。旧健康JSON无sourceWorkspaceId时使用明确的legacy来源命名空间并按原实体ID预览冲突，不悄悄生成一套重复实体。新档案完整备份≤100MiB，超过明确失败不产生截断文件。另保留“仅健康数据JSON”，清楚标注不含照片，旧V1/V2/V3 JSON照常可导入。

备份先验证全部实体、关联、资产hash/MIME/总量，再预览，不写库。local确认后在同一个IDB事务提交；云端在当前UID下重分配ID、校验引用与版本，不能复制owner。回收站/排序完整保留，旧备份不能默认复活。照片文件缺失或云下载失败不能冒充完整备份成功。

## 7. 迁移与云事务边界

显式选择demo或local来源，demo预置内容默认不勾选；local也要看预览再确认。按宠物、记录、事项、照片选择，建立关联闭包：选择事项必须带其来源/完成记录及父宠，选择avatar必须带引用资产；预览显示额外依赖并由用户确认。选中的回收站内容保留deletedAt，不自动复活；示例帖子永不进入云端健康/真实社区。

云导入流程`imports.preview`→`imports.prepare`→上传/确认所选媒体→`imports.commit`，服务端以来源workspaceId+实体kind/id的owner内映射去重。已存在的映射变化显示冲突，未确认不覆盖；重复请求/重试不增一份。commit比较预览revision，全部健康/关联/正式媒体元数据+回执事务提交；失败前的暂存文件不出现在照片墙，保留可重试/待清理状态。不声称对象字节上传与数据库同事务。

原local/demo数据及旧备份从不删除；登录不自动迁移，云数据变化不回写local，退出也不自动“下载覆盖”。云端已有宠物的次序保持，新选中宠物按来源相对顺序追加，活动宠物保留有效的本设备选择；空账号可选导入来源当前宠物。城市只有明确选择迁移资料设置时才改，不因旧备份默认深圳覆盖云端。

## 8. 双语与公开构建

`zh-CN/en`词典键一致，`t(key,params)`仅返回文本，用户内容按原文转义；日期/数值统一保存，只按locale显示。覆盖index导航/footer、四页、账号/照片/管理/备份、错误、加载/空态、ARIA与确认。领域错误通过稳定messageKey或明确的已有错误映射翻译，未知服务错误显示安全通用提示。切语言不变当前宠物/表单值/空间。

新增esbuild输出dist，客户端公开配置与服务端密钥分开。当前无构建，执行时才安装锁定SDK/esbuild及IDB测试工具。发布只含静态白名单，禁止backend、云函数、env、日志、测试、私有图片。新入口和CSS为哈希资产；为旧缓存HTML保留v0.2.0固定app/style/src兼容文件（只从不移动的v0.2.0 tag提取公开白名单），新客户端完全打包，不复用旧query模块图。Actions检出完整tag并构建；匿名子路径及缓存升级必须实测。

## 9. 阶段退出验收

两个真实邮箱注册/收信/登录，uid与服务端Principal一致；A/B互不能读、改、回收/恢复、排序、迁移或读取对方健康/图片，未登录和真实匿名平台账号亦拒绝；直接对象请求拒绝。同账号不同浏览器看到保存内容，前台刷新/并发/丢响应重试不会丢记录或重复完成。

未登录自己的local建档/照片刷新仍在；demo/v1/v2原文不变，空间无种子串入；本地IDB abort后快照/资产/Blob无半保存；空档案不种糯米。所有V3 lifecycle、other类型和完整图片备份往返通过，语言切换不丢输入，360/390/768/1440px与键盘/减少动画检查通过。

实际云端门槛不满足时阶段2保持未完成，不上线半通入口；八小时内如实交付进度/证据和剩余项。不用本地mock代替真实认证/权限，也不重复导入日历。版本候选v0.3.0；技术验收、用户阶段体验与公开部署分别记录。未来正式开始并按本计划交付时，技术门槛通过后沿已有项目Git/部署授权更新原URL及新tag/Release，不重复问工具权限，不移动旧tag；如用户未来明确只做本地/暂缓发布则尊重限制。本轮不发布、不进入阶段3。

## 10. 当前尚未实测的前置

此前默认凭证查到旧cloud1，不能挪用未知项目。用户自行开通后提供环境卡片，并明确改用FUJI变量只读确认；2026-10-07 01:27:19 DescribeEnvs/DescribeBillingInfo成功读到paw-diary-d8g3p4tlsb305221d、上海/NORMAL/baas_trial、云数据库资源1/PG资源0、到期2027-04-07 23:59:59、自动续费与超额按量false，凭证可读取该资源，无需另找密钥。管理调用固定用TENCENTCLOUD_FUJI_SECRET_ID/KEY，不能凭其他变量的AppID混用账号。邮箱代发/两套受控邮箱、SDK真实Principal、事务/大小、对象私有访问与部署权限尚未实测，在Task1及相应测试落实。不能将EnvCharged=yes解读为此次订单付费，截图购买配置为0元；未读账单。EnvActivated=no亦不单独代替真实业务可用检查。

用户可接受基础云约20元/月，免费先验；本轮没有订单/开通动作。实施时仅在已确认账号/预算/正式执行范围内选择资源，额外邮件费用或超出预算需报实际金额，不能把接受基础云价格当作允许任意收费。未来API/SDK版本与运行时需实际锁定，引用研究不是已接通证据。
