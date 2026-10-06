# 固定地址发布与前端回退

原评审地址为 https://wenkaiqu014-hue.github.io/paw-diary/ ，仓库仍为paw-diary，四个hash入口保留。已发布tag不能移动。当前阶段1先本地用户验收，再决定发布；本文准备操作，不表示新版已部署。

## 发布范围

GitHub Actions仅在main的网页、样式、app.js、src、assets、.nojekyll、package/lock、scripts或pages工作流变化时自动部署；纯日志、规划、tests和test_app.py不会触发。保留workflow_dispatch人工触发。根HTML和素材使用相对路径，ESM从app.js加载src；不要把模块路径写成站点根的`/src/`。

公开产物显式复制index.html、style.css、app.js、.nojekyll、assets及存在时的src。backend、tests、docs、SESSION_LOG、凭证、.env和test-results均不进入public-site。第二阶段若引入打包，须单独核对打包产物白名单。

## 验收后发布

先运行`npm test`、`node --check app.js`、`git diff --check`，再以`PAW_DIARY_TEST_URL`运行浏览器测试，并验证`/paw-diary/`子路径；确认用户阶段验收后将已验证代码更新main并推送。等待Pages工作流成功，再用匿名新浏览器在原URL复验。配置成功或HTTP200不替代流程成功。发布新tag/Release时使用新版本号，不能重标v0.1.0。

## 回退到v0.1.0的静态文件

在干净的工作分支上执行以下明确目标操作；它恢复前端文件，不清除浏览器v1/v2备份或云端数据库。移除src是因为该版本没有模块目录，避免旧模块混在产物中。先确认当前分支没有未提交工作。

```sh
git restore --source=v0.1.0 -- index.html style.css app.js assets .nojekyll .github/workflows/pages.yml
git rm -r --ignore-unmatch src
node --check app.js
git diff --check
git add index.html style.css app.js assets .nojekyll .github/workflows/pages.yml
git commit -m "fix: restore verified v0.1.0 frontend"
```

复验回退版本，再通过新提交合入main并推送，等待部署完成后匿名复验原网址。若恢复的工作流没有路径过滤，文档提交也可能触发部署；这是该历史版本的行为，不移动tag去修它。恢复其他稳定版本时，把source换为已验收tag，同时逐项核对该版本存在的src/构建目录和工作流。

v0.1.0只读取`paw-diary:v1`；阶段1保留该键和`paw-diary:v1:backup`。回退后不会显示v2新记录，应明确告诉用户并保留v2备份，不能把回退当作数据迁移回v1。
