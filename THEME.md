# ZhX-Blog 主题与自定义改动梳理

> **2026-10-23 更新**：已新增站内后台 `/admin/` 与 GitHub Actions 部署，`paginate`、`og:image`、`editPost`、占位验证码、B 站数据不可复现等问题已处理。下面 §1、§6 保留为改造前的审计记录；后台与部署说明见 [ADMIN.md](ADMIN.md)。

> 梳理时间：2026-10-23 · 基线：`main` @ `159a702`（工作区干净）· 线上：<https://blog.zhx589.top/>
>
> 结论先行：这是一个 **Hugo + PaperMod** 的博客，主题源码（git submodule）保持原样，所有外观/交互改动都放在站点根目录的 `layouts/`、`assets/`、`hugo.toml` 里，属于“主题外壳 + 自建组件层”的结构。整体风格是 **PaperMod 骨架 + Fuwari 风动效 + 霞鹜文楷 + 毛玻璃吸顶导航**。

---

## 1. 技术栈与部署链路

| 项目 | 值 |
| --- | --- |
| 生成器 | Hugo `v0.168.0+extended` |
| 主题 | PaperMod `v8.0-139-gd376885`（submodule，`git@github.com:adityatelange/hugo-PaperMod.git`，未改动） |
| 站点配置 | `hugo.toml`（TOML，单语言 `zh-cn`） |
| 输出目录 | `docs/`（`publishDir`，已入库，169 个生成文件） |
| 域名 | `blog.zhx589.top`（根目录 `CNAME` + `docs/CNAME` 各一份） |
| 仓库 / 分支 | `git@github.com:ZhX589/ZhX589-blog.git` / `main` |
| 线上托管 | Cloudflare → GitHub Pages；实测响应头带 `x-github-request-id`，`last-modified` 与最后一次提交一致 |

**当前构建方式（本地出站）**：

```
hugo  →  docs/  →  git commit  →  push  →  GitHub Pages（main 分支 /docs 目录）
```

**演进过程**：2026-08-31 曾使用 GitHub Actions 部署（commit `9081e66`、`3dc3d9b`），但该 workflow 上传的是 `./public`，而配置里 `publishDir = "docs"`，产物路径不匹配；2026-10-13 的 `56a5b2c`（把 `docs/` 提交进仓库）与 `0935bc1`（删除 `.github/workflows/hugo.yaml`）改为“本地构建 + 提交 docs”的方案。仓库里现在只剩一个空的 `.github/` 目录。

**本次验证**：用 `hugo` 重新构建到临时目录，构建通过（exit 0），产物与 `docs/` 逐文件一致，仅多出 3 个历史遗留 CSS 与 `docs/CNAME`——说明入库的构建结果是最新的。

---

## 2. 目录职责与覆盖机制

Hugo 的查找顺序是 **项目根 `layouts/` → 主题 `layouts/`**，因此根目录只放“要覆盖或新增”的模板；`assets/css/extended/*.css` 会被 PaperMod 的 `head.html` 按文件名字母序自动拼接进主样式表（`animations → bilibili → components → custom`，`custom.css` 最后，可覆盖前面）。

```
.
├── content/                 # 内容：posts（20 篇已发布 + 2 草稿）、about（leaf bundle）
├── layouts/                 # 覆盖/扩展 PaperMod 的模板（1135 行自定义代码的主体）
│   ├── _markup/render-blockquote.html      # > [!NOTE] 之类 → callout
│   ├── _partials/
│   │   ├── components/{alert,icon,bilibili-data}.html
│   │   ├── extend_head.html                # 官方钩子：字体 CSS
│   │   ├── extend_footer.html              # 官方钩子：两个自定义 JS
│   │   ├── footer.html                     # 整文件覆盖（仅改 2 处文案）
│   │   └── toc.html                        # 整文件覆盖（+5 行空 TOC 防护）
│   └── _shortcodes/{alert,bilibili,github}.html
├── assets/
│   ├── css/extended/{custom,animations,components,bilibili}.css
│   ├── js/{page-transition,github-cards}.js
│   └── icons/{example.zip,weibo.svg}       # 均未被引用（zip 实为 COS 访问日志，见 §6）
├── static/                  # favicon、BingSiteAuth.xml
├── themes/PaperMod/         # submodule，干净，未做任何本地修改
├── docs/                    # 构建产物（提交入库）
└── hugo.toml
```

---

## 3. 当前主题启用了什么（PaperMod 配置层）

- **首页 profileMode**：头像（QQ 头像外链）、副标题（意大利语）、三个按钮（文章 / 标签 / 关于）。
- **导航菜单**：关于、分类、标签、开往（travellings 外链）。
- **社交图标**：X、GitHub、Bilibili（主题自带 bilibili 图标）。
- **文章页**：TOC（`UseHugoToc`，默认折叠）、代码复制按钮、阅读时间、字数、分享按钮、面包屑、上一篇/下一篇、RSS。
- **外观**：`defaultTheme = "auto"` + 手动切换 + `localStorage` 记忆、回到顶部、日期格式 `2006年01月02日 15:04`。
- **渲染**：`hasCJKLanguage`、Chroma 类名高亮、goldmark `unsafe = true`（about 页的 `<figcaption>` 依赖它）、构建期 minify。

**配置了但实际不生效的项**（容易误解，建议清理）：

| 配置 | 实际情况 |
| --- | --- |
| `[params.homeInfoParams]`（Hi there 👋） | `profileMode.enabled = true` 时首页直接走 `index_profile.html`，该块永不渲染 |
| `[params.fuseOpts]` + 主题的 search 模板 | 没有 `content/search.md`、也没有 `outputs` 配置，站点没有 `/search/` 页面 |
| `[params.analytics.*]` | 三个 `XYZabc` 占位符会真的输出验证 meta（见 §6） |
| `[params.editPost]` | 占位 URL 会被拼进每一篇文章的 “Suggest Changes” 链接 |
| `[params.cover] hidden*` | 内容里没有用 cover 参数，属于无效配置 |
| `comments = false`、`params.env`、`[caches.images]` | 默认值/未使用 |

---

## 4. 自定义层清单

### 4.1 样式（`assets/css/extended/`，共 587 行）

| 文件 | 作用 | 关键实现 |
| --- | --- | --- |
| `custom.css`（61 行） | 字体 + 毛玻璃吸顶导航 | 正文用 `LXGW WenKai Screen`（霞鹜文楷屏幕版），代码用 `Maple Mono NF CN`；`.header` 改 `sticky` + `backdrop-filter: blur(16px) saturate(150%)`，用 `--header-glass-*` 变量区分明暗，`@supports` 提供不透明回退；`scroll-padding-top` 补偿锚点偏移 |
| `animations.css`（268 行） | Fuwari 风动效层 | 入场 `fade-in-up` 并按顺序错开 delay（列表卡片、文章头、正文逐块、页脚）；离场由 `html.is-leaving body { opacity: 0 }` 实现 170ms 淡出；微交互：导航下划线居中展开、主题按钮旋转/回弹、卡片悬浮投影、社交图标上浮、回到顶部滑入；`prefers-reduced-motion` 下全部关闭 |
| `components.css`（155 行） | callout + GitHub 卡片 | callout 左侧 4px 色条，5 种类型（note/tip/important/warning/caution）各有明暗两套色；`github-card` 圆角 16px、暗色 `#16171a`、星标/Fork/许可证行 |
| `bilibili.css`（103 行） | B 站视频卡片 | 封面占 42%、播放按钮、右下时长、UP 主与播放/点赞；≤520px 转竖排 16:9；悬浮边框变 `#fb7299` |

> 注意：`animations.css` 的入场动画刻意用 `translate` 而不是 `transform`，避免 `both` 填充的 `transform` 永久压过 PaperMod 卡片 hover 的 `translateY(-2px)`。

### 4.2 脚本（`assets/js/`，共 147 行，`minify + fingerprint + SRI`，`defer` 加载）

| 文件 | 作用 | 细节 |
| --- | --- | --- |
| `page-transition.js`（82 行） | 仿 Swup 的离场过渡 | 拦截同源内链，阻止默认后加 `.is-leaving`，170ms 后 `location.href`；跳过新标签页/修饰键/下载/纯锚点/静态文件；`pageshow` 恢复、1.5s 兜底恢复；`prefers-reduced-motion` 直接跳转。脚本不运行时退化为普通多页跳转 |
| `github-cards.js`（65 行） | GitHub 仓库卡片数据 | 请求 `api.github.com/repos/{owner}/{repo}`，`AbortController` 8s 超时，`sessionStorage` 缓存 1h，`Intl.NumberFormat('zh-CN')` 格式化，失败显示“点击查看详情”，仓库名先做正则校验 |

### 4.3 模板（`layouts/`）

| 文件 | 作用 |
| --- | --- |
| `_partials/extend_head.html` | `preconnect` 到 `cdn.jsdelivr.net`，加载 `lxgw-wenkai-screen-webfont@1.7.0` 的 CSS |
| `_partials/extend_footer.html` | 全局加载上面两个 JS（带 fingerprint + integrity） |
| `_partials/footer.html` | 整文件覆盖主题：版权改成 `2024 - {{ now.Year }}`、“Powered by” 改为“自豪地使用 Hugo & PaperMod”，其余逻辑与上游一致 |
| `_partials/toc.html` | 整文件覆盖主题，仅新增 5 行：`UseHugoToc` 时用 `<li` 判断 TOC 是否真有条目，避免只有空壳的目录 |
| `_markup/render-blockquote.html` | 识别 `> [!TYPE]` 语法，转给 `components/alert.html`；普通引用块原样输出 |
| `_partials/components/alert.html` | 中文标签映射（注释/提示/重要/警告/注意）、非法类型回退 note、`aria-label` |
| `_partials/components/icon.html` | 9 个内联 SVG：note/tip/important/warning/caution/github/star/fork/license |
| `_partials/components/bilibili-data.html` | **构建期**用 `resources.GetRemote` 调 B 站 API，8s 超时，`try` 包裹，失败 `warnf` 并回退为纯链接卡 |
| `_shortcodes/alert.html` | alert 短代码入口 |
| `_shortcodes/bilibili.html` | `bvid`/`aid` 二选一校验、可 `fetch="false"`、可用 `title/cover/author` 覆盖接口数据 |
| `_shortcodes/github.html` | `repo="owner/name"` 正则校验 + 服务端渲染骨架，数据由 JS 补齐 |

### 4.4 与上游 PaperMod 的差异

- 主题 submodule **零改动**（`git submodule status` 干净），升级主题不会冲突。
- 真正的“改主题”只有两个整文件覆盖：
  - `footer.html`：2 处文案；
  - `toc.html`：+5 行空目录判断。
- 其余全是钩子文件（`extend_*`）、新组件、新短代码、`assets/css/extended` 自动注入——属于 PaperMod 推荐的扩展方式。
- 代价：`footer.html` / `toc.html` 是“冻结”的上游副本，主题日后更新这两个文件时不会自动跟进，需要手动比对。

---

## 5. 内容现状

| 项目 | 数量 / 说明 |
| --- | --- |
| 文章 | 22 个 md，其中 2 篇 `draft: true`（`Test.md`、`网站又双叒叕更新了.md`），线上 20 篇 |
| 分类 | 笔记 9、编程社 4、题解 3、建站 1、散文 1、关于本站 1 |
| 标签 | 35 个；Top：C++ 7、教程 5、算法 4、Linux 4、Luogu 3 |
| 关于页 | leaf bundle：`content/about/index.md` + `cover.png`，含 `<figcaption>` |
| 命名约定 | `YYYY-MM-DD-标题.md`，YAML front matter：title / date / description / categories / tags |
| 图片 | 多为外链，且分散在旧 WordPress 主机（`www.zhx-blog.top`、`49.232.0.197`、`pan.lansod.cn` 等），存在失效风险 |

---

## 6. 现存问题（按优先级，均已在代码/产物中核实）

### P0 · 仓库卫生

1. **`assets/icons/example.zip` 实为腾讯云 COS 访问日志**（1.7 MB 压缩 / 6.6 MB / 196 个文件，路径 `cos-access-log/2026/08/30/*`），被 `af78c19 添加图标` 误提交，站点未引用。访问日志可能含请求路径、客户端 IP、签名参数，建议删除并确认是否泄露过密钥。

### P1 · 线上可见缺陷

2. **21 个页面的 “Suggest Changes” 是坏链**：`hugo.toml:114` 的 `[params.editPost]` 还是占位 URL，渲染结果是 `https://github.com/%3Cpath_to_repo%3E/content/...`。应改成真实仓库编辑地址，或直接删掉该配置块。
3. **全站 `og:image` 是占位符**：`hugo.toml:31` 的 `images` 值被当成路径，线上实际输出 `https://blog.zhx589.top/%3Clink%20or%20path%20of%20image...%3E`，社交分享无图。应换成真实的 1200×630 图片或删除该项。
4. **三个假的站点验证码**：`hugo.toml:103-107` 的 `SiteVerificationTag = "XYZabc"` 会真实输出 `google-site-verification` / `yandex-verification` / `msvalidate.01`。Bing 的真实验证其实靠 `static/BingSiteAuth.xml`。应删除这些占位配置。
5. **B 站卡片数据无法重建**：B 站接口现在对无 Cookie 请求返回 `{"code":-412,"message":"request was banned"}`；本次试构建已复现卡片退化为“BVxxx · 点击观看”，而入库的 `docs/` 里有完整的标题/封面/播放量（10-13 构建时抓到的）。也就是说重新构建会**丢掉**这些数据，且源码里没有备份。建议在短代码里显式写 `title`/`cover`/`author`，或加 `fetch="false"` 并把数据静态化。
6. **`paginate = 5` 已失效**：Hugo 早已弃用该键（`hugo.toml:4`），实测仍是默认 10 篇/页；改用 `[pagination] pagerSize = 5` 后重新构建得到 4 页（已验证）。

### P2 · 性能与可维护性

7. **字体兜底源实际未生效**：`assets/css/extended/custom.css:4` 的 `@import` 被拼接到主样式表**规则之后**（构建产物第 7 行），按 CSS 规范会被浏览器直接丢弃；真正生效的只有 `extend_head.html` 里 jsDelivr 的 `<link>`。结果是国内访问 jsDelivr 不稳定时没有任何兜底，zeoseven 那个源形同虚设。另外 `Maple Mono NF CN` 没有 `@font-face`，只是本地字体回退，代码块对多数访客仍是系统等宽字体。
8. **`docs/` 里堆积了 3 个旧版 `stylesheet.*.css`**（每个 28 KB）：Hugo 不会自动清理 `publishDir`，每次换哈希都会多留一份。可把 `CNAME` 放进 `static/` 后用 `hugo --cleanDestinationDir` 一起解决。
9. **主题模板有 2 条 Hugo 弃用警告**：`.Language.LanguageDirection`、`.Language.LanguageCode`（Hugo 0.158 起弃用），来自主题而非本站代码，升级 submodule 即可。
10. **submodule 用 SSH 地址**：换机器/CI 克隆需要配密钥，可改 HTTPS。
11. **构建产物入库**：`docs/` 169 个文件，每次构建 diff 很大；`.hugo_build.lock` 也被跟踪（应在 `.gitignore`）。
12. **整文件覆盖的模板会漂移**：`footer.html`、`toc.html` 升级主题时需手动同步（见 §4.4）。

### P3 · 内容数据

13. `2025-12-08-Linux_基础_&amp;_Python_控制流.md` 的 front matter 把 `description` 拼成了 **`descreptions`**。
14. 同篇文件名带 `&amp;`，生成的 URL 是 `/posts/linux_基础_amp_python_控制流/`，应改文件名或加 `slug`。
15. 链表一文的标签写成 `数据结构，链表`（全角逗号），被当成一个独立标签，生成了 `/tags/数据结构链表/`。
16. `2025-10-03-Luogu_P3218题解.md` 的 `date` 是 **2023-09-09**（与文件名不符），description 里写的还是 P3128。
17. `2025-10-23- P6824 🉑乐题解.md` 的标题自带 `# `，页面出现两个 H1；文件名开头多一个空格，URL 变成 `--p6824-乐题解`。
18. 6 篇已发布文章没有 `description`：计算机的基本构成、二叉树遍历、Linux 入门安装、Python 入门-2、Linux 基础 & Python 控制流、自由自己。
19. `自由自己` 没有分类和标签，列表/分类页里属于“无分类”内容。

---

## 7. 建议的修复顺序

1. 删除 `assets/icons/example.zip`（并检查日志是否含敏感信息）。
2. 修 `hugo.toml` 的三处占位符（`images`、`analytics`、`editPost`）和 `paginate`。
3. 处理 B 站卡片数据（显式参数或静态化），避免下次构建退化。
4. 调整字体加载（把 `@import` 换成 `<link>` 或删掉），并决定是否自托管字体。
5. 把 `CNAME` 移入 `static/`，构建时加 `--cleanDestinationDir`，清掉 `docs/` 旧 CSS。
6. 清理内容层的小问题（标签全角逗号、`&amp;` 文件名、P3218 日期、P6824 标题、缺失 description）。
7. 订一个主题升级流程：`git submodule update --remote themes/PaperMod` → 重新 diff `footer.html` / `toc.html`。

---

## 8. 常用命令

```bash
# 本地预览（含草稿）
hugo server -D

# 出站构建（建议先完成第 5 条，才敢用 --cleanDestinationDir）
hugo --gc --minify

# 升级主题并检查覆盖文件是否漂移
git submodule update --remote themes/PaperMod
diff -u themes/PaperMod/layouts/_partials/footer.html layouts/_partials/footer.html
diff -u themes/PaperMod/layouts/_partials/toc.html    layouts/_partials/toc.html

# 发布
git add -A && git commit -m "更新文章" && git push
```

---

## 9. 一句话总结

> 主题本体是“原封不动的 PaperMod”，个性全部长在站点根目录的一层自定义皮肤上：**霞鹜文楷 + 毛玻璃吸顶导航 + Fuwari 入场/离场动效 + callout / GitHub / B 站三类卡片 + 构建期抓数据的短代码**。结构是干净的、可升级的；当前主要欠账不是代码结构，而是**若干占位配置仍在上线、B 站数据不可重建、以及 `docs/` 构建产物的清理方式**。
