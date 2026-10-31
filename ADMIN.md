# 站内后台（/admin/）

> 入口：<https://blog.zhx589.top/admin/> · 代码在 `layouts/admin/`、`content/admin/`、`assets/admin/`。

这是一个长在站点里的轻量后台：登录后直接读写 GitHub 仓库里的 Markdown，提交后由 GitHub Actions 构建并发布。没有独立服务器，也没有第三方 CMS。

## 能做什么

- **文章**：列表、搜索、按标签/状态筛选；新建、编辑、删除；草稿与发布；Markdown 实时预览；标签、分类、摘要、日期。
- **页面**：管理 `content/about/` 等独立页面，新建页面时可选择加入顶部导航菜单。
- **标签 / 分类**：查看每个标签的文章数；重命名、合并、删除会批量改写所有相关文章的 front matter，并作为一个 commit 提交。
- **媒体**：上传图片（浏览器内压缩到最长边 1600px 的 WebP）、复制链接、删除；文件落在 `static/uploads/年/月/`。
- **发布状态**：提交后轮询 GitHub Actions，右上角显示“构建中 / 已上线 / 构建失败”，可点开看日志。

## 登录：Fine-grained PAT

后台只支持 GitHub Fine-grained Personal Access Token。GitHub 的 OAuth 端点不支持浏览器跨域，所以没有做“设备码登录”，也不需要额外部署 OAuth 代理。

1. 打开 <https://github.com/settings/personal-access-tokens/new>。
2. **Repository access** 选 `Only select repositories`，只勾 `ZhX589-blog`。
3. **Permissions → Contents** 设为 `Read and write`（Metadata 会自动只读）。
4. 建议 **Expiration** 设 90 天，生成后复制 `github_pat_...`。
5. 打开 `/admin/` 粘贴登录。勾选“记住这台设备”会存到 `localStorage`，否则只存 `sessionStorage`（关标签页即失效）。

Token 只保存在本机浏览器，只会发送给 `api.github.com`。退出登录只清除本地 Token，不会撤销 GitHub 上的授权；要彻底失效请到 GitHub 设置里删除 Token。

后台页面本身是公开的，公开仓库内容也可被任何人读取；没有具备仓库写权限的 Token 无法通过后台修改内容。公开仓库中的草稿同样不是保密内容。

## 草稿与发布

- **存为草稿**：写入 `draft: true`，如果原来是草稿，commit 信息会带 `[skip ci]`，不触发构建。
- **发布**：去掉 `draft: true`，正常提交，触发 `.github/workflows/deploy.yml`，大约 1 分钟后上线。
- 所有修改都是直接 commit 到 `main`，可以在 GitHub 的提交历史里回滚。
- 草稿不会出现在站点上；已发布文章点“存为草稿”会触发一次构建，把它从线上移除。

## 部署：需要手动切一次 Pages

后台只改 `content/`，不会重新生成 `docs/`。因此必须让 Pages 改用 Actions 产物：

1. 仓库 **Settings → Pages → Build and deployment → Source** 改为 **GitHub Actions**。
2. push 任意内容，或手动运行 **Actions → 构建并部署 → Run workflow**。
3. 首次部署成功后，可以删除仓库里的 `docs/`（旧方案的构建产物）；`CNAME` 已经放在 `static/`，会随产物一起发布。

> 在切换之前，后台的发布只会产生 commit，线上不会更新。`docs/` 保留着旧版站点，作为回滚用。

## B 站卡片

`{{< bilibili bvid="BV..." >}}` 默认优先读取 `data/bilibili/<小写 BV 号>.json` 的快照（当前已收录 `bv1cvpoeneq4.json`），这样 CI 构建不依赖 B 站接口。没有快照的视频会在构建时请求接口，而接口对无 Cookie 请求可能返回 `-412`，卡片会退化成纯链接。

新增视频时，按下面结构放一个 JSON 即可（文件名必须是 BV 号的小写）：

```json
{
  "title": "视频标题",
  "pic": "https://i1.hdslb.com/bfs/archive/xxx.jpg",
  "owner": { "name": "UP 主" },
  "stat": { "view": 12345, "like": 678 },
  "duration": 153
}
```

## 安全建议

- Token 只给 `Contents: Read and write`，不要给 Actions、Workflows、Administration 权限。
- 不要在公共电脑勾选“记住这台设备”；用完点“退出登录”。
- 站点开启了 goldmark `unsafe = true`（about 页用到 `<figcaption>`）。如果某篇文章里粘贴了来源不明的 `<script>`，它可能读到同域的 `localStorage`。只粘贴可信 HTML；介意的话可以把后台放到独立子域，或改成 `sessionStorage` 登录。
- Markdown 预览使用无脚本、无同源权限的 sandbox iframe，不能访问后台凭据；这不代表发布到主站的任意 HTML 是安全的，仍应仅发布可信 HTML。
- 单文件保存遇到版本冲突会停止，不会自动覆盖；批量标签修改也会核对文件版本。先复制当前编辑内容，再刷新核对远端。
- Token 建议 90 天过期，定期轮换。

## 已知限制

- 单人使用，没有多用户、角色或审核流。
- 不支持 page bundle 内的图片上传（例如 `content/about/cover.png` 仍要去 GitHub 改）。
- 标签/分类的描述页（`content/tags/<tag>/_index.md`）暂未纳入管理。
- 删除文章、重命名标签、上传图片都会触发一次构建；已有草稿再次保存会跳过构建，已发布内容转草稿会重新构建。
- 标签/分类由文章内容派生：在编辑器中给文章添加新名称即可创建，不支持没有任何文章的空标签。
- Actions 自动部署仅针对 `main` 分支；修改后台配置的分支时也要同步修改部署工作流。
- 预览是浏览器端 Markdown 渲染，短代码用近似卡片展示，最终样式以构建结果为准。

## 文件索引

| 路径 | 作用 |
| --- | --- |
| `content/admin/index.md` | `/admin/` 页面入口 |
| `layouts/admin/admin.html` | 后台页面模板（复用主题 head） |
| `assets/admin/admin.css` | 后台样式 |
| `assets/admin/js/core.js` | front matter 解析/序列化、GitHub API |
| `assets/admin/js/admin.js` | 路由、视图、编辑器、标签/页面/媒体 |
| `assets/admin/js/vendor/` | js-yaml、marked（构建时打包，不依赖 CDN） |
| `.github/workflows/deploy.yml` | push 后构建并部署到 Pages |
| `data/bilibili/*.json` | B 站卡片快照 |

## 本地回归测试

模拟测试不调用真实 GitHub 写接口；覆盖登录、列表、文章/页面创建与发布、草稿、标签批量提交、预览隔离和保存冲突保护。需要 Node.js 18+：

```bash
npm install --prefix .test-deps jsdom@24.1.3 --no-audit --no-fund
hugo --destination public --minify
NODE_PATH="$PWD/.test-deps/node_modules" node tests/admin-smoke.cjs
```

这不是实际浏览器或线上认证联调，首次部署后仍应人工验证登录、图片上传、发布和撤回。

## 本地调试

```bash
hugo server -D      # 打开 http://localhost:1313/admin/
hugo --gc --minify  # 本地构建
```

本地后台同样需要 PAT；`api.github.com` 允许 localhost 跨域。改完 `assets/admin/` 后刷新页面即可，Hugo 会重新打包。
