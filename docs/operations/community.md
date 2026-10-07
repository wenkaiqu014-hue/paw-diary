# 社区举报与人工处置

真实社区服务由独立paw-community处理。公开读只走允许的帖子/评论/资料/资源投影，写入及本人隐藏列表需要可信邮箱Principal；普通用户不能提交或调用管理员处置action。数据库集合和对象规则继续deny直接客户端访问。本文记录代码路径，不把本地合成测试当真实A/B或线上验收。

登录用户可调用community.report({postId,reason,note?})。reason取广告骚扰、不当内容、隐私问题、其他，说明最多200字。成功返回reportId与status，首次为queued；举报不自动删除或下架帖子。相同账号、相同帖子只保留一个队列项，即使弱网用新操作ID重试也不无限入队；相同操作ID内容改变会拒绝。第一份reason/note保留，返回中不包含举报正文、报告者UID或其他私有字段。客户端展示“已提交，等待处理”，不承诺即时审核。幂等重放的旧提交回执表示当时结果，不是实时处置状态。

个人隐藏community.hide({postId,hidden:true})只创建当前账号的隐藏关系，其他人仍可读原公开帖子，不改变全站可见性或点赞/评论计数。hidden:false删除本人隐藏关系；帖子已删除或全站下架时也允许清理本人关系，但不会恢复全站帖子。community.hidden.list({cursor?,limit?})只返回本人隐藏项，默认20最多50，游标绑定owner，支持超过100条。返回postId、可见时的标题、available和hiddenAt，不输出owner；已删除/下架标题为null，仍可取消个人隐藏。

维护者在现有CloudBase控制台查看community_reports中的queued项，核对确切reportId及postId。记录原举报内容仅留在私有集合，不复制到SESSION_LOG、终端调试日志或聊天；执行证据只保必要ID、状态、时间与结果。维护者本机已有FUJI管理变量，不能使用个人/集团变量替代，不需在命令中粘贴实际值。

先查看帮助（不读取凭证、不创建SDK或发起管理请求）：

```sh
node scripts/community-moderate.mjs --help
```

确认指定举报需要全站下架：

```sh
node scripts/community-moderate.mjs --report-id REPORT_ID --action hide
```

确认指定举报不应下架：

```sh
node scripts/community-moderate.mjs --report-id REPORT_ID --action dismiss
```

CLI仅从TENCENTCLOUD_FUJI_SECRET_ID/TENCENTCLOUD_FUJI_SECRET_KEY读取管理身份，固定paw-diary-d8g3p4tlsb305221d/ap-shanghai；可用的PAW_CLOUD_ENV_ID若不一致即拒绝。缺失FUJI配置不回退其他凭证。Web客户端没有管理员按钮，也没有部署公开admin action；不能在payload添加角色或managementAuthorized来处置报告。管理Node SDK的secretId/secretKey初始化契约核对自当前安装的@cloudbase/node-sdk/types/index.d.ts。

hide在一个数据库事务中把确切帖子moderationStatus设hidden、增加revision、更新时间，并把该报告设resolved、记录resolution=hide、handledAt与handledBy=FUJI management。dismiss只将该报告设dismissed/记录处置，不改变帖子。重复相同已完成处置返回原结果；对已完成报告改变action拒绝CONFLICT，不偷偷改写既有审计。其他报告不被批量关闭，其他帖子不被扫描修改。帖子或报告不存在返回NOT_FOUND；事务失败必须同时保留原帖子和报告状态。

全站下架后新的公开列表/详情/评论/点赞/引用该帖的图片读取都被父状态校验拒绝；不依赖前端按钮，也不通过举报接口自动执行。已经下载到用户设备的内容无法撤回。下架保留内部原文及资源用于可信处置，不立即删除用户原对象；个人取消隐藏不能绕过全站状态。

测试资源清理仅按本轮明确的合成post/report/asset/receipt ID，不能按用户昵称、日期窗口或关键词批量扫库。真实B举报A、本人隐藏/取消、FUJI实际处理合成报告及匿名读取拒绝，需要Root在真实环境独立验收；worker只跑本地memory store/SDK query fixture和CLI帮助，没有实际云操作。回顾确认发布由Root前端完成，本后端不自动公开私有记录/完整AI故事。

本轮工作使用本地superpowers:test-driven-development与verification-before-completion，高star来源沿执行入口已记录的https://github.com/obra/superpowers，不重复安装技能。
