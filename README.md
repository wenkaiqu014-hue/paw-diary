# 爪爪日记 · 养宠成长记录与社区

为初次养猫狗的年轻人设计的成长手账。第一版采用原生 HTML / CSS / JavaScript，不依赖构建工具。

## 体验流程

1. 首页点击「记一笔」，记录体重、疫苗、驱虫或生活瞬间。
2. 健康档案查看体重趋势、成长时间线和下次护理待办。
3. 附近宠友按城市与宠物类型探索示例用户。
4. 社区发布文字和照片，体验点赞、评论和搜索。

本地开发版已完成阶段1技术验证：多宠物独立档案、记录编辑、完整护理待办、JSON备份恢复、CSV和ICS导出。公开评审网页仍是v0.1.0，尚未部署这些新增能力；阶段1等待用户本地体验确认。见[交付与验收报告](docs/verification/stage1-report.md)。

## 当前能力与边界

首屏数据、宠友和预置帖子均为示例。新增记录、发布、点赞与评论仅保存在当前浏览器，不向其他访客共享。当前未接入登录、云端存储、AI 或真实私信。健康事项下一次日期由用户设置，不构成诊疗建议。

## 本地运行

```sh
python3 -m http.server 4178 --bind 127.0.0.1
```

访问 `http://127.0.0.1:4178/`，无需安装前端依赖。当前采用ESM，请通过HTTP服务打开，不用双击index.html代替本地服务器。

## 文件与迭代

`index.html`是应用外壳，`style.css`定义响应式界面，`app.js`调用`src/data/demo-repository.js`和`src/app-session.js`。纯规则、迁移、导入和导出在`src/domain/`。成功持久化后才更新页面；渲染沿四个hash入口。数据存于`paw-diary:v2:demo`，旧v1原文和备份保留。

后续需求与验收见 ROADMAP.md。用户已授权发布第一版，公开仓库为 https://github.com/wenkaiqu014-hue/paw-diary 。固定网页地址为 https://wenkaiqu014-hue.github.io/paw-diary/ ，部署结果见 SESSION_LOG.md。

用户已提交 v0.1.0 作品。后续执行待办见 PENDING.md，按优先级记录任务、依赖和验收标准；开发过程持续维护在 SESSION_LOG.md。

详细实施计划见 `docs/superpowers/plans/2026-10-06-paw-diary-master.md`；阶段0已确认，阶段1本地技术交付待用户验收，线上仍为已发布雏形。HTML技能调研保留在`docs/research/2026-10-06-frontend-skills.md`。

## GitHub Pages 部署准备

代码可以部署到固定公开仓库的 GitHub Pages。仓库名确认后保留，后续只更新文件，不更改仓库名或网页域名。使用 `.github/workflows/pages.yml` 工作流，GitHub 仓库 Settings → Pages → Source 设为 GitHub Actions。

发布内容采用显式白名单：index.html、style.css、app.js、assets、.nojekyll和存在时的src。测试、日志、文档、后端及环境文件不上传。纯文档/测试修改不触发自动部署，人工workflow_dispatch保留。回退操作见`docs/operations/deploy-and-rollback.md`。

## 验证

Node 22下运行`npm test`。本机浏览器测试使用`/Users/wenkaiqu/.codex/skill-runtime/run python -u test_app.py`，扩展脚本在`tests/e2e/`；先启动HTTP服务，也可使用webapp-testing的with_server辅助。当前结果和未验证范围以stage1-report及SESSION_LOG为准，不把本地通过当作新版线上验收。

`test_app.py` 用 Playwright 在真实 Chromium 上验证新增健康记录、刷新保存、待办完成、多宠物隔离、城市筛选、图片发帖、评论、点赞、搜索、导出以及手机布局。测试截图与备份写入被 Git 忽略的 test-results/。

测试默认检查本地服务。设置 `PAW_DIARY_TEST_URL=https://wenkaiqu014-hue.github.io/paw-diary/` 可检查线上版本；该变量不是凭证。首版的本地和线上验证均已通过，详情及工作流记录见 SESSION_LOG.md。

## 素材来源

本地摄影素材下载自 Unsplash，页面加载不依赖第三方图床。图片仅作为雏形演示，不代表真实用户或动物档案。

- dog.jpg: https://images.unsplash.com/photo-1552053831-71594a27632d
- cat.jpg: https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba
- walk.jpg: https://images.unsplash.com/photo-1548199973-03cce0bbc87b
