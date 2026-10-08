# 固定地址发布与回退

固定[仓库](https://github.com/wenkaiqu014-hue/paw-diary)和[网页](https://wenkaiqu014-hue.github.io/paw-diary/)不变。v1.0.0已正式公开/source1f44973/Release18:04:50；具体结果与未验证限制以[1.0验收报告](../verification/v100-report.md)和SESSION_LOG最新记录为准，既有所有tag不移动。

## 构建、公开产物与源码

GitHub Actions .github/workflows/pages.yml运行npm ci/npm run build，只上传dist。前端包含哈希JS/CSS、index、release.json、asset-manifest、manifest与白名单静态资源；manifest身份固定/paw-diary/。backend/cloudfunctions/tests/docs/SESSION_LOG/test-results/.env不进入Pages。云函数单独构建部署，前端buildId并不自动证明函数源码已一致部署。

```sh
npm ci
npm test
node --check app.js
git diff --check
npm run build
```

固定待验提交与stable配置后构建，检查公开release version/channel/buildId，原URL的index、release、asset manifest、webmanifest与哈希app/style六项均HTTP200且byte SHA对应。检查五hash路由、匿名实际界面及受控真实账号权限；HTTP200、管理员Ready、mock通过不能替代真实业务。并行检查不要重装依赖或覆盖dist。文档与测试单独提交不会因路径过滤自动触发Pages；页面代码变更须等待对应headSha的工作流成功。

公开配置仅含必要公开配置与boolean betaRequired，不能带内测码、FUJI管理凭证、模型/LBS私钥、OTP/session或私有资料。只比较秘密是否出现，禁止打印值。保存忽略目录私密600凭证/receipt，正式发布资产仅用自己生成的六白名单Windows ZIP，用户原含profile的21MB报告ZIP不得上传。

## 内测服务端部署

管理固定从FUJI变量读取。先读五函数原env/timeouts并私存，合并受管键且保留未知AI/LBS配置。新逻辑兼容显式gate-off后，冻结旧合法proof收据，dry-run计数、幂等apply、verify及重复apply确认；迁移不动健康/邮箱证明。再统一开启五入口并读回，复验旧会话/new signup/无资格真实签名拒绝、匿名原范围。失败不继续发版或把有凭证者降匿名。换码须考虑challenge指纹和真实进行中登录，服务端策略与前端betaRequired保持一致。

当前确切实施与门槛结果已记1.0报告；不要再次迁移、发验证码或开启临时匿名provider。共享会话refresh串行及时checkpoint原600文件，资料清理只按验收owned receipt精确执行，禁止清库或替换用户snapshot。

## 正式发行与回退

最终真实门槛通过后，冻结实际部署source，确认VERSION/package/lock、metadata与公开六SHA一致；复核原tag snapshot26 refs。创建新的annotated v1.0.0 tag指向实际发行源码，推送并用verify-tag创建Release，上传安全包并核digest。不要以docs-only HEAD漂移重建或移动已发布tag；日志与状态可以后置文档提交。正式创建前由主agent明确确认当前用户验收结果。

需要回退时先暂停失败候选，保资料与私有权限，核真正成功运行的headSha与构件后再重跑对应Pages或新修复提交；不把历史运行号写成当前可直接执行目标。前端回退不回退函数/资格/数据库/对象权限，也不迁移或删除个人档案。旧0.8前端重新登录缺内测字段与已开启服务端存在契约差异，不能只回退页面并宣称恢复完整登录；须先明确一致的前后端策略，保现有旧合法账号资格。

业务不可用时优先提供本地记录/备份路径；需要关闭云入口或策略时以明确的新配置提交与五函数一致读回执行，保持deny权限。回退后在原URL实际匿名/旧账号/数据重新验证，记录新运行与结果，修复main避免后续自动部署恢复故障候选。
