# 爪爪日记 · 养宠成长记录与社区

为初次养猫狗的年轻人设计的成长手账。采用原生 HTML / CSS / JavaScript；阶段2候选用 esbuild 打包 SDK 与静态文件。

## 体验流程

1. 首页点击「记一笔」，记录体重、疫苗、驱虫或生活瞬间。
2. 健康档案查看体重趋势、成长时间线和下次护理待办。
3. 附近宠友按城市与宠物类型探索示例用户。
4. 社区发布文字和照片，体验点赞、评论和搜索。

v0.2.0已在原评审地址公开部署并通过匿名验收：多宠物卡内切换/添加/排序、管理选择、记录与护理事项编辑、回收站恢复、JSON备份冲突确认、CSV和ICS导出。71项单测、8套静态子路径浏览器检查及同样8套公开站检查通过。见[交付与验收报告](docs/verification/stage1-report.md)和[v0.2.0 Release](https://github.com/wenkaiqu014-hue/paw-diary/releases/tag/v0.2.0)。

## 当前能力与边界

公开v0.2.0的首屏数据、宠友和预置帖子均为示例。新增记录、发布、点赞与评论仅保存在当前浏览器，不向其他访客共享。阶段2候选正在实现免登录个人档案、自定义类型、照片和双语；真实邮箱/私有云验收尚未通过，未公开发布。见[阶段2验收状态](docs/verification/stage2-report.md)。AI、真实社区与私信尚未接通。健康事项下一次日期由用户设置，不构成诊疗建议。

## 本地运行

```sh
npm ci
npm run serve
```

使用Node 22和Python 3，访问 `http://127.0.0.1:4178/`。serve先构建再只提供dist文件；修改代码后重新构建/启动。请通过HTTP打开，不直接服务含SDK裸导入的源文件或双击index.html。CloudBase配置和真实验收前置见[云操作说明](docs/operations/cloud-setup.md)；默认构建关闭云端入口，不用管理密钥作为前端配置。

## 文件与迭代

`index.html`是应用外壳，`style.css`定义响应式界面，`app.js`调用仓储和`src/app-session.js`。纯规则、迁移、导入和导出在`src/domain/`。成功持久化后才更新页面；渲染沿四个hash入口。示例仍存于`paw-diary:v3:demo`，个人空间使用独立IndexedDB，v1/v2原文和旧备份保留。回收站以deletedAt标记保存，界面/CSV/ICS只用可见资料，JSON保留完整内容；完整个人归档还带媒体字节。

后续需求与验收见 ROADMAP.md。用户已授权发布第一版，公开仓库为 https://github.com/wenkaiqu014-hue/paw-diary 。固定网页地址为 https://wenkaiqu014-hue.github.io/paw-diary/ ，部署结果见 SESSION_LOG.md。

用户已提交 v0.1.0 作品。后续执行待办见 PENDING.md，按优先级记录任务、依赖和验收标准；开发过程持续维护在 SESSION_LOG.md。

详细实施计划见 `docs/superpowers/plans/2026-10-06-paw-diary-master.md`；阶段0已确认，阶段1公开部署验收已通过；阶段2已获用户明确开始授权，正在实施和真实验收，不自动进入阶段3。HTML技能调研保留在`docs/research/2026-10-06-frontend-skills.md`。

## GitHub Pages 部署准备

代码可以部署到固定公开仓库的 GitHub Pages。仓库名确认后保留，后续只更新文件，不更改仓库名或网页域名。使用 `.github/workflows/pages.yml` 工作流，GitHub 仓库 Settings → Pages → Source 设为 GitHub Actions。

工作流执行锁定依赖安装和构建，仅上传dist：新版哈希JS/CSS与素材、公开配置，以及固定v0.2.0的旧app/style/src兼容图。测试、日志、文档、后端及管理环境文件不上传。纯文档/测试修改不触发自动部署，人工workflow_dispatch保留。回退操作见`docs/operations/deploy-and-rollback.md`。

## 验证

Node 22下运行`npm test`。本机浏览器测试使用`/Users/wenkaiqu/.codex/skill-runtime/run python -u test_app.py`，扩展脚本在`tests/e2e/`；先启动HTTP服务，也可使用webapp-testing的with_server辅助。当前结果和未验证范围以stage1-report及SESSION_LOG为准，不把本地通过当作新版线上验收。

`test_app.py` 用 Playwright 在真实 Chromium 上验证新增健康记录、刷新保存、待办完成、多宠物隔离、城市筛选、图片发帖、评论、点赞、搜索、导出以及手机布局。测试截图与备份写入被 Git 忽略的 test-results/。

测试默认检查本地服务。设置 `PAW_DIARY_TEST_URL=https://wenkaiqu014-hue.github.io/paw-diary/` 可检查线上版本；该变量不是凭证。首版的本地和线上验证均已通过，详情及工作流记录见 SESSION_LOG.md。

## 素材来源

本地摄影素材下载自 Unsplash，页面加载不依赖第三方图床。图片仅作为雏形演示，不代表真实用户或动物档案。

- dog.jpg: https://images.unsplash.com/photo-1552053831-71594a27632d
- cat.jpg: https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba
- walk.jpg: https://images.unsplash.com/photo-1548199973-03cce0bbc87b
