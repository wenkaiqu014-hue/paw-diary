# 固定地址发布准备与回滚

v0.3.0当前为候选准备，尚未发布。本文是操作步骤，不是部署成功记录；真实云门槛、最终提交、Pages工作流和匿名网页结果由发布负责人补证据。固定[仓库](https://github.com/wenkaiqu014-hue/paw-diary)和[网页](https://wenkaiqu014-hue.github.io/paw-diary/)保持不变，保留#home、#health、#nearby、#community；v0.1.0/v0.2.0 tag不移动。

## 构建与发布产物

前端使用Node 22、锁定依赖与esbuild。GitHub Actions实际工作流为`.github/workflows/pages.yml`，依次执行`npm ci`和`npm run build`，只上传`dist`。构建包含哈希JS/CSS、index.html、assets、.nojekyll、公开配置及asset-manifest.json；同时保留固定v0.2.0旧app/style/src兼容图，避免已缓存入口混用模块。

```sh
node --version
npm ci
npm test
node --check app.js
git diff --check
npm run build
python3 -m http.server 4193 --bind 127.0.0.1 --directory dist
```

本地预览使用HTTP，不直接服务含SDK裸导入的源目录。上面的简单服务根入口是`http://127.0.0.1:4193/`；正式发布前另按当前子路径预览配置验收`/paw-diary/`，不能用根路径通过替代子路径通过。并行验收时不要重新安装依赖或覆盖正在检查的dist；先固定候选，再跑浏览器。

公开配置只包含环境ID、地域、publishableKey及enabled；管理凭证、AI密钥、邮箱验证码和会话token不进入前端。默认读取`src/config/cloud-environment.json`，也支持`PAW_CLOUD_CONFIG_PATH`及公开配置环境变量。构建启用键为`enabled`，不能把运维记录的`cloudEnabled`当成它已生效。正式环境与真实权限未确认前保持`enabled=false`。管理凭证仍只由运维进程从FUJI环境变量读取。

backend、cloudfunctions、tests、docs、SESSION_LOG、test-results及.env不进入dist。云函数是独立产物，`npm run build:functions`生成Git忽略目录`test-results/stage2/functions/paw-api`，不上传Pages；云函数运行时与资源读回详见[云操作说明](cloud-setup.md)。

## 发布前与公开复验

先完成[候选发布说明](../releases/v0.3.0.md)中真实邮箱、跨浏览器、跨账号、直接集合/对象访问拒绝、云媒体及迁移门槛。管理员读回、模拟SDK或HTTP200不能代替这些结果。本轮采购范围是同一笔个人版1个月订单、1990分（19.90元）；体验版先前的正式来源/严格存储限制不能靠邮箱开关绕过，不重复下单，付款与发货状态以运维证据为准。

全部门槛通过后，发布负责人冻结生产配置和提交SHA，确认VERSION、package及锁文件均为0.3.0，记录最终asset manifest。将已验收代码整合至main并按用户明确发布授权推送；等待Pages工作流成功，在原网页用匿名新浏览器检查免登录健康、照片、备份、四个hash入口。真实登录流程另用受控账号检查，不将邮箱或验证码写入文档。

工作流只在main的网页、样式、app、src、assets、package/lock、scripts和pages工作流变更时自动运行，纯文档/测试不会自动部署；保留workflow_dispatch。公开复验通过后再创建新的annotated v0.3.0 tag与Release，使它们指向实际发布源码。当前准备任务没有执行合并、推送、部署、tag或Release。

## 出现故障时

优先保留数据和已验收的免登录健康主线。若仅云端失败，可在新的修复提交中将正式公开配置设为`enabled=false`，重新构建并发布同一前端，显示继续本地记录；不清空用户IndexedDB、localStorage、云库或媒体。此修改必须同步正式构建配置，单次本地Shell变量不会自动改变后续GitHub Actions构建。

需要整体回退前端时，先暂停待发布的新候选，检查没有更新版本的部署仍排队。项目现有已验收v0.2.0 Pages运行记录为`37497726088`，源码为`ceed8d3`（历史发布记录）；执行前重新核对完整headSha和工作流。按原成功运行重跑可恢复其原始源码与工作流，不移动tag、不换URL：

```sh
gh run view 37497726088 --json headSha,status,conclusion,workflowName
gh run rerun 37497726088
gh run watch 37497726088 --exit-status
```

只有原运行源码确认为已验收v0.2.0且可以重新部署时才执行重跑；失败则停止并查看失败步骤，不将命令已发出视为已回退。成功后记录新attempt与部署结果，再在原网址匿名复验。之后通过新的修复或revert提交让main与保留的发布方案一致，避免下次源码推送再次发布故障版本；如需撤销合并提交，先核对父线再使用`git revert -m 1`，不reset或丢弃未推送交接。

v0.2.0不会显示阶段2个人IndexedDB和云端的新记录，回退前说明这一显示差异，并保留完整健康/照片备份及原存储；不能把前端回退当作数据向旧格式迁移。前端回退不回滚云函数、集合、存储权限或计费，也不把私有规则改成公开；云端如需修复按已核环境和独立回滚范围处理。
