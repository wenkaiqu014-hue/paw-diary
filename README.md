# 爪爪日记 · 养宠成长记录与社区

为初次养猫狗的年轻人设计的成长手账。采用原生 HTML / CSS / JavaScript；阶段2候选用 esbuild 打包 SDK 与静态文件。

## 当前发布状态

[v0.3.0](https://wenkaiqu014-hue.github.io/paw-diary/)已在原地址公开发布，邮箱验证码登录、私有云健康档案和照片已启用。246项单测、五个真实云端用例、12套本地与12套公开匿名浏览器检查通过；公开站的私有恢复/刷新和图库另经真实账号验证。用户亲自体验仍待确认。详细范围见[阶段2验收报告](docs/verification/stage2-report.md)和[发布说明](docs/releases/v0.3.0.md)。

## 三分钟体验

免登录：打开首页，点击「开始记录我的宠物」，添加宠物后记一笔成长记录；在健康档案查看记录、设置护理待办。更换头像、给当前宠物上传一张照片，再导出完整备份。个人资料保存在当前浏览器，示例资料单独保留。

登录路线：点击「登录与云同步」，用自己的邮箱接收并输入验证码；进入自己的云端档案，主动选择本地来源、预览内容后确认迁移。另一个浏览器登录同一账号，检查资料与照片是否一致。本地资料不会自动上传；迁移前会由你确认。

附近宠友与社区目前为示例体验，发布、点赞和评论不向其他访客共享。AI、真实社区、微信及手机号登录尚未接入。健康事项日期由用户设置；ICS是日历文件导入，不自动配置系统通知。

## 当前能力

v0.3.0支持免登录个人档案、多宠切换与排序、自定义宠物和记录类型、记录与护理生命周期、回收站、头像、照片墙、主动幻灯片、中英文切换，以及包含照片的完整JSON备份、CSV和ICS导出。正常恢复先预览并逐项确认冲突；损坏资料全量恢复明确提示回退编辑/删除的影响，确认成功后保留原坏资料与媒体。

公开v0.2.0已完成阶段1本地健康闭环，原有71项单测与8套匿名公开浏览器检查通过，见[交付报告](docs/verification/stage1-report.md)和[v0.2.0 Release](https://github.com/wenkaiqu014-hue/paw-diary/releases/tag/v0.2.0)。真实手机软键盘、原生200%缩放和读屏仍待最终阶段验收。

## 本地运行

```sh
npm ci
npm run serve
```

使用Node 22和Python 3，访问 `http://127.0.0.1:4178/`。serve先构建再只提供dist文件；修改代码后重新构建/启动。请通过HTTP打开，不直接服务含SDK裸导入的源文件或双击index.html。CloudBase配置和真实验收前置见[云操作说明](docs/operations/cloud-setup.md)；构建读取已验收的公开配置；本地云验证须使用已配置的合法来源，不用管理密钥作为前端配置。

## 文件与迭代

`index.html`是应用外壳，`style.css`定义响应式界面，`app.js`调用仓储和`src/app-session.js`。纯规则、迁移、导入和导出在`src/domain/`。成功持久化后才更新页面；渲染沿四个hash入口。示例仍存于`paw-diary:v3:demo`，个人空间使用独立IndexedDB，v1/v2原文和旧备份保留。回收站以deletedAt标记保存，界面/CSV/ICS只用可见资料，JSON保留完整内容；完整个人归档还带媒体字节。

后续需求与验收见 ROADMAP.md。用户已授权发布第一版，公开仓库为 https://github.com/wenkaiqu014-hue/paw-diary 。固定网页地址为 https://wenkaiqu014-hue.github.io/paw-diary/ ，部署结果见 SESSION_LOG.md。

用户已提交 v0.1.0 作品。后续执行待办见 PENDING.md，按优先级记录任务、依赖和验收标准；开发过程持续维护在 SESSION_LOG.md。

详细实施计划见 `docs/superpowers/plans/2026-10-06-paw-diary-master.md`；阶段0已确认，阶段1公开部署验收已通过；阶段2技术交付及v0.3.0公开发布已完成，用户亲自体验待确认；下一轮从主目录main的[阶段3计划](docs/superpowers/plans/2026-10-06-03-ai-onboarding-recaps.md)继续。HTML技能调研保留在`docs/research/2026-10-06-frontend-skills.md`。

## GitHub Pages 部署准备

代码可以部署到固定公开仓库的 GitHub Pages。仓库名确认后保留，后续只更新文件，不更改仓库名或网页域名。使用 `.github/workflows/pages.yml` 工作流，GitHub 仓库 Settings → Pages → Source 设为 GitHub Actions。

工作流执行锁定依赖安装和构建，仅上传dist：新版哈希JS/CSS与素材、公开配置，以及固定v0.2.0的旧app/style/src兼容图。测试、日志、文档、后端及管理环境文件不上传。纯文档/测试修改不触发自动部署，人工workflow_dispatch保留。发布与回退步骤见[部署与回滚](docs/operations/deploy-and-rollback.md)。

## 验证

Node 22下运行`npm test`。本机浏览器测试使用`/Users/wenkaiqu/.codex/skill-runtime/run python -u test_app.py`，扩展脚本在`tests/e2e/`；先启动HTTP服务，也可使用webapp-testing的with_server辅助。当前结果和未验证范围以[阶段2验收报告](docs/verification/stage2-report.md)及SESSION_LOG为准，不把本地通过当作新版线上验收。

`test_app.py` 用 Playwright 在真实 Chromium 上验证新增健康记录、刷新保存、待办完成、多宠物隔离、城市筛选、图片发帖、评论、点赞、搜索、导出以及手机布局。测试截图与备份写入被 Git 忽略的 test-results/。

测试默认检查本地服务。设置 `PAW_DIARY_TEST_URL=https://wenkaiqu014-hue.github.io/paw-diary/` 可检查线上版本；该变量不是凭证。首版的本地和线上验证均已通过，详情及工作流记录见 SESSION_LOG.md。

## 素材来源

本地摄影素材下载自 Unsplash，页面加载不依赖第三方图床。图片仅作为雏形演示，不代表真实用户或动物档案。

- dog.jpg: https://images.unsplash.com/photo-1552053831-71594a27632d
- cat.jpg: https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba
- walk.jpg: https://images.unsplash.com/photo-1548199973-03cce0bbc87b
