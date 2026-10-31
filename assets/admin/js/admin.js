/*!
 * /admin/ 后台界面：文章、页面、标签/分类、媒体库。
 * 纯原生 JS，无框架；数据直接写到 GitHub 仓库，push 后由 Actions 构建部署。
 */
(function () {
  'use strict';

  var Core = window.Core;
  var cfg = window.ADMIN_CONFIG || {};
  var app = null;
  var TOKEN_KEY = 'zhx-blog-admin-token';
  var runTimer = null;
  var runGeneration = 0;
  var publicationStatus = null;

  var state = {
    gh: null,
    user: null,
    posts: [],
    pages: [],
    media: [],
    run: null,
    loaded: false,
    editing: null,
    saving: false,
    dirty: false
  };

  var listState = { q: '', status: 'all', tag: '' };

  /* ========================================================================
     工具
     ======================================================================== */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    posts: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    pages: '<path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 3v6h6"/>',
    tags: '<path d="M20 13 11 22 2 13V2h11Z"/><circle cx="7" cy="7" r="1.5"/>',
    categories: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    media: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
  };

  function icon(name) {
    return '<svg class="admin-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function fmtDate(value) {
    var p = Core.parseDate(value);
    return p ? p.y + '-' + p.mo + '-' + p.d : (value || '—');
  }

  function homeAsset(path) {
    return (cfg.home || '/') + String(path).replace(/^\//, '');
  }

  function siteUrl(path) {
    var base = cfg.home || '/';
    var match = /^https?:\/\/[^/]+(\/.*)?$/.exec(base);
    var prefix = match ? (match[1] || '/') : base;
    return prefix.replace(/\/?$/, '/') + String(path).replace(/^static\//, '');
  }

  function rawUrl(path, sha) {
    return 'https://raw.githubusercontent.com/' + cfg.owner + '/' + cfg.repo + '/' + cfg.branch +
      '/' + Core.encodePath(path) + (sha ? '?v=' + String(sha).slice(0, 8) : '');
  }

  function toast(message, type) {
    var box = document.getElementById('admin-toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'admin-toasts';
      box.className = 'admin-toasts';
      document.body.appendChild(box);
    }
    var el = document.createElement('div');
    el.className = 'admin-toast' + (type ? ' is-' + type : '');
    el.textContent = message;
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-out');
      setTimeout(function () { el.remove(); }, 320);
    }, 2800);
  }

  /* ========================================================================
     登录态
     ======================================================================== */

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(token, remember) {
    clearToken();
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  /* ========================================================================
     路由
     ======================================================================== */

  function parseRoute() {
    var raw = location.hash.replace(/^#/, '') || '/';
    var qi = raw.indexOf('?');
    var path = qi >= 0 ? raw.slice(0, qi) : raw;
    var query = qi >= 0 ? raw.slice(qi + 1) : '';
    var parts = path.split('/').filter(Boolean);
    var params = {};

    query.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var key = i < 0 ? pair : pair.slice(0, i);
      var value = i < 0 ? '' : pair.slice(i + 1);
      try {
        params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
      } catch (err) {
        params[key] = value;
      }
    });

    return { parts: parts, params: params };
  }

  function go(hash) {
    if (state.dirty && !window.confirm('有未保存的修改，确定离开？')) return;
    state.dirty = false;
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  /* ========================================================================
     启动 / 登录
     ======================================================================== */

  function init() {
    app = document.getElementById('admin-app');
    if (!app) return;

    window.addEventListener('hashchange', render);
    document.addEventListener('click', linkGuard);
    document.addEventListener('keydown', globalKey);
    window.addEventListener('beforeunload', function (event) {
      if (state.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    });

    var token = getToken();
    if (!token) return renderLogin();
    connect(token);
  }

  function renderBoot(message) {
    app.innerHTML = '<div class="admin-boot"><span class="admin-spinner" aria-hidden="true"></span><span>' +
      esc(message || '正在读取仓库…') + '</span></div>';
  }

  function renderLogin(error) {
    var logo = homeAsset('/ZhX589_256x256.ico');
    var owner = esc(cfg.owner || '');
    var repo = esc(cfg.repo || '');

    app.innerHTML =
      '<div class="admin-login">' +
        '<div class="admin-login-card">' +
          '<img class="admin-login-logo" src="' + logo + '" alt="">' +
          '<h1>ZhX589 后台</h1>' +
          '<p class="admin-muted">在浏览器里写文章、改页面、管标签，提交后自动构建上线。</p>' +
          (error ? '<div class="admin-error">' + esc(error) + '</div>' : '') +
          '<form id="login-form">' +
            '<label class="admin-field" for="token">GitHub Fine-grained Token' +
              '<input id="token" class="admin-input" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_..." required>' +
            '</label>' +
            '<div class="admin-login-row">' +
              '<label class="admin-switch"><input id="remember" type="checkbox"> 记住这台设备</label>' +
              '<a class="admin-hint" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">创建 Token ↗</a>' +
            '</div>' +
            '<button class="admin-btn primary" type="submit">登录</button>' +
          '</form>' +
          '<div class="admin-steps">' +
            '<strong>Token 的最小权限</strong>' +
            '<ol>' +
              '<li>Repository access：Only select repositories → <code>' + repo + '</code></li>' +
              '<li>Permissions → Contents：<b>Read and write</b></li>' +
              '<li>Expiration 建议 90 天</li>' +
            '</ol>' +
          '</div>' +
          '<p class="admin-hint">Token 只保存在本机浏览器，只会发送给 api.github.com。公共电脑上请不要勾选“记住”。后台页面本身是公开的，没有 Token 无法读写任何内容。</p>' +
        '</div>' +
      '</div>';

    $('#login-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var token = $('#token').value.trim();
      if (!token) return;
      connect(token, $('#remember').checked);
    });
  }

  async function connect(token, remember) {
    renderBoot('正在验证 Token…');
    try {
      var gh = new Core.GitHub({
        owner: cfg.owner,
        repo: cfg.repo,
        branch: cfg.branch,
        token: token
      });
      var user = await gh.getUser();
      var repo = await gh.getRepo();
      if (!repo.permissions || !repo.permissions.push) {
        throw new Error('这个 Token 没有 ' + cfg.owner + '/' + cfg.repo + ' 的写权限');
      }
      state.gh = gh;
      state.user = user;
      if (remember !== undefined) setToken(token, remember);
      renderBoot('正在读取内容…');
      await loadAll();
      render();
    } catch (err) {
      if (err.status === 401) clearToken();
      state.gh = null;
      renderLogin(err.status === 401 ? 'Token 无效或已过期。' : (err.message || '连接 GitHub 失败'));
    }
  }

  /* ========================================================================
     数据
     ======================================================================== */

  function sortByDate(a, b) {
    return String((b.data && b.data.date) || '').localeCompare(String((a.data && a.data.date) || ''));
  }

  function parseFile(file) {
    try {
      var parsed = Core.split(file.text);
      return {
        path: file.path,
        sha: file.sha,
        text: file.text,
        data: Core.normalize(parsed.data),
        body: parsed.body
      };
    } catch (err) {
      throw new Error('front matter 解析失败：' + file.path + '：' + err.message);
    }
  }

  async function readFileSafe(path) {
    try {
      return await state.gh.getFile(path);
    } catch (err) {
      throw new Error('读取失败：' + path + '：' + err.message);
    }
  }

  async function loadAll() {
    var tree = await state.gh.getTree();
    if (tree.truncated) throw new Error('仓库文件列表不完整，已停止加载以避免遗漏修改');
    var blobs = (tree.tree || []).filter(function (item) { return item.type === 'blob'; });
    var paths = blobs.map(function (item) { return item.path; });
    var shaMap = {};
    blobs.forEach(function (item) { shaMap[item.path] = item.sha; });

    var postPaths = paths.filter(function (path) { return /^content\/posts\/[^/]+\.md$/.test(path); });
    var pagePaths = paths.filter(function (path) {
      return /^content\/[^/]+\/index\.md$/.test(path) &&
        !/^content\/(posts|tags|categories|admin)\//.test(path);
    });
    var mediaPaths = paths.filter(function (path) {
      return /^static\/uploads\/.+\.(png|jpe?g|gif|webp|svg|avif)$/i.test(path);
    });

    var postFiles = await Core.mapLimit(postPaths, 4, readFileSafe);
    var pageFiles = await Core.mapLimit(pagePaths, 3, readFileSafe);

    state.posts = postFiles.filter(Boolean).map(parseFile).filter(Boolean).sort(sortByDate);
    state.pages = pageFiles.filter(Boolean).map(parseFile).filter(Boolean).sort(function (a, b) {
      return a.path.localeCompare(b.path);
    });
    state.media = mediaPaths.map(function (path) {
      return { path: path, sha: shaMap[path], url: siteUrl(path) };
    }).sort(function (a, b) { return a.path < b.path ? 1 : -1; });

    var runClient = state.gh;
    var generation = runGeneration;
    try {
      var runs = await runClient.getRuns(cfg.workflow);
      if (state.gh === runClient && generation === runGeneration && !publicationStatus) {
        state.run = pickRun(runs && runs.workflow_runs, null);
      }
    } catch (err) {
      if (state.gh === runClient && generation === runGeneration && !publicationStatus) {
        state.run = null;
        setStatus('idle', '状态未知');
      }
    }

    state.loaded = true;
  }

  async function reloadData() {
    state.loaded = false;
    renderBoot();
    try {
      await loadAll();
    } catch (err) {
      state.loaded = true;
      toast(err.message || '刷新失败', 'error');
    }
    render();
  }

  /* ========================================================================
     外壳
     ======================================================================== */

  function navItem(key, route, label, active) {
    return '<a class="admin-nav-item' + (active === key ? ' is-active' : '') + '" href="#/' + route + '">' +
      icon(key) + '<span>' + esc(label) + '</span></a>';
  }

  function statusPill() {
    if (publicationStatus) {
      return '<a id="admin-status" class="admin-status is-' + esc(publicationStatus.kind) + '"' +
        (publicationStatus.url ? ' href="' + esc(publicationStatus.url) + '" target="_blank" rel="noopener"' : '') +
        '>' + esc(publicationStatus.text) + '</a>';
    }
    var run = state.run;
    if (!run) return '<a id="admin-status" class="admin-status">尚未构建</a>';
    var kind;
    var text;
    if (run.status === 'completed') {
      kind = run.conclusion === 'success' ? 'success' : 'failed';
      text = run.conclusion === 'success' ? '已上线' : '构建失败';
    } else if (run.status === 'queued') {
      kind = 'idle';
      text = '排队中';
    } else {
      kind = 'building';
      text = '构建中…';
    }
    return '<a id="admin-status" class="admin-status is-' + kind + '" href="' + esc(run.html_url || '#') +
      '" target="_blank" rel="noopener">' + text + '</a>';
  }

  function setStatus(kind, text, url) {
    publicationStatus = { kind: kind, text: text, url: url || '' };
    var el = document.getElementById('admin-status');
    if (!el) return;
    el.className = 'admin-status is-' + kind;
    el.textContent = text;
    if (url) {
      el.setAttribute('href', url);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
    } else {
      el.removeAttribute('href');
    }
  }

  function shell(active, title, content, actions) {
    var user = state.user || {};
    app.innerHTML =
      '<div class="admin-shell">' +
        '<aside class="admin-side" id="admin-side">' +
          '<a class="admin-brand" href="#/">' +
            '<img src="' + homeAsset('/ZhX589_256x256.ico') + '" alt="">' +
            '<span>ZhX589 后台</span>' +
          '</a>' +
          '<nav class="admin-nav">' +
            navItem('dashboard', '', '概览', active) +
            navItem('posts', 'posts', '文章', active) +
            navItem('pages', 'pages', '页面', active) +
            navItem('tags', 'tags', '标签', active) +
            navItem('categories', 'categories', '分类', active) +
            navItem('media', 'media', '媒体', active) +
            navItem('settings', 'settings', '设置', active) +
          '</nav>' +
          '<div class="admin-side-foot">' +
            '<a class="admin-user" href="#/settings">' +
              '<span class="admin-avatar">' + esc(String(user.login || '?').slice(0, 1).toUpperCase()) + '</span>' +
              '<span>' + esc(user.login || '') + '</span>' +
            '</a>' +
            '<button class="admin-link" data-action="logout">退出登录</button>' +
          '</div>' +
        '</aside>' +
        '<div class="admin-main">' +
          '<header class="admin-top">' +
            '<div class="admin-top-left">' +
              '<button class="admin-icon-btn admin-menu" data-action="menu" aria-label="菜单">' + icon('menu') + '</button>' +
              '<h1>' + esc(title) + '</h1>' +
            '</div>' +
            '<div class="admin-top-right">' + statusPill() + (actions || '') + '</div>' +
          '</header>' +
          '<main class="admin-view" id="admin-view">' + content + '</main>' +
        '</div>' +
      '</div>';

    bindShell();
  }

  function bindShell() {
    var logout = $('[data-action="logout"]');
    if (logout) logout.addEventListener('click', logoutNow);
    var menu = $('[data-action="menu"]');
    if (menu) menu.addEventListener('click', function () {
      var side = $('#admin-side');
      if (side) side.classList.toggle('is-open');
    });
    var refresh = $('[data-action="refresh"]');
    if (refresh) refresh.addEventListener('click', reloadData);
  }

  function logoutNow() {
    cancelRunPolling();
    publicationStatus = null;
    clearToken();
    state.gh = null;
    state.user = null;
    state.loaded = false;
    state.posts = [];
    state.pages = [];
    state.media = [];
    state.editing = null;
    state.dirty = false;
    state.run = null;
    location.hash = '';
    renderLogin();
  }

  function linkGuard(event) {
    var link = event.target && event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!link) return;
    if (state.dirty && !window.confirm('有未保存的修改，确定离开？')) {
      event.preventDefault();
      return;
    }
    state.dirty = false;
    var side = $('#admin-side');
    if (side) side.classList.remove('is-open');
  }

  function globalKey(event) {
    if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 's') {
      if ($('#editor')) {
        event.preventDefault();
        saveEditor(state.editing && state.editing.data.draft !== true);
      }
    }
  }

  /* ========================================================================
     路由渲染
     ======================================================================== */

  function render() {
    if (!state.gh) return renderLogin();
    if (!state.loaded) return renderBoot();

    var route = parseRoute();
    var name = route.parts[0] || 'dashboard';

    if (name === 'posts') {
      if (route.parts[1] === 'new') return renderEditor({ kind: 'post', isNew: true });
      if (route.parts[1] === 'edit') return renderEditor({ kind: /^content\/posts\//.test(route.params.file || '') ? 'post' : 'page', file: route.params.file });
    }
    if (name === 'pages') {
      if (route.parts[1] === 'new') return renderEditor({ kind: 'page', isNew: true });
      if (route.parts[1] === 'edit') return renderEditor({ kind: 'page', file: route.params.file });
    }

    switch (name) {
      case 'dashboard': return renderDashboard();
      case 'posts': return renderPosts();
      case 'pages': return renderPages();
      case 'tags': return renderTaxonomy('tags');
      case 'categories': return renderTaxonomy('categories');
      case 'media': return renderMedia();
      case 'settings': return renderSettings();
      default:
        location.hash = '#/';
    }
  }

  /* ========================================================================
     概览
     ======================================================================== */

  function renderDashboard() {
    var drafts = state.posts.filter(function (post) { return post.data.draft; }).length;
    var tagCount = Core.counts(state.posts, 'tags').length;
    var catCount = Core.counts(state.posts, 'categories').length;

    var recent = state.posts.slice(0, 5).map(postRowHtml).join('') ||
      '<div class="admin-empty">还没有文章，点右上角开始写第一篇。</div>';

    var run = state.run;
    var runBlock = run
      ? '<div class="admin-actions">' +
          '<a class="admin-btn" href="' + esc(run.html_url) + '" target="_blank" rel="noopener">查看构建日志</a>' +
          '<span class="admin-muted">' + esc(run.name || 'deploy') + ' · ' + esc(run.status || '') +
          (run.conclusion ? ' / ' + esc(run.conclusion) : '') + '</span>' +
        '</div>'
      : '<p class="admin-muted">还没有构建记录。首次 push 后就会看到。</p>';

    shell('dashboard', '概览',
      '<div class="admin-grid stats">' +
        statCard(state.posts.length, '文章', drafts ? drafts + ' 篇草稿' : '全部已发布') +
        statCard(state.pages.length, '独立页面', '关于、友链等') +
        statCard(tagCount, '标签', '可在标签页重命名/合并') +
        statCard(catCount, '分类', '') +
      '</div>' +
      '<div class="admin-card">' +
        '<h2>最近文章</h2>' +
        '<div class="admin-list">' + recent + '</div>' +
      '</div>' +
      '<div class="admin-card">' +
        '<h2>发布状态</h2>' + runBlock +
        '<p class="admin-muted" style="margin-top:10px">发布文章会提交到 <code>' + esc(cfg.owner + '/' + cfg.repo) +
        '</code> 的 <code>' + esc(cfg.branch) + '</code> 分支，由 GitHub Actions 构建后上线。</p>' +
      '</div>',
      '<a class="admin-btn primary" href="#/posts/new">写文章</a>'
    );
  }

  function statCard(value, label, note) {
    return '<div class="admin-stat">' +
      '<div class="admin-stat-value">' + esc(value) + '</div>' +
      '<div class="admin-stat-label">' + esc(label) + '</div>' +
      (note ? '<div class="admin-stat-note">' + esc(note) + '</div>' : '') +
      '</div>';
  }

  /* ========================================================================
     文章列表
     ======================================================================== */

  function renderPosts() {
    var route = parseRoute();
    listState.tag = route.params.tag || route.params.category || '';
    listState.taxonomy = route.params.category ? 'categories' : 'tags';

    var tagHint = listState.tag
      ? '<span class="admin-badge">#' + esc(listState.tag) + ' <a href="#/posts">×</a></span>'
      : '';

    shell('posts', '文章',
      '<div class="admin-toolbar">' +
        '<div class="admin-toolbar-left">' +
          '<input id="post-search" class="admin-input admin-search" placeholder="搜索标题、标签、分类…" value="' + esc(listState.q) + '">' +
          '<div class="admin-tabs">' +
            '<button class="admin-tab' + (listState.status === 'all' ? ' is-active' : '') + '" data-status="all">全部</button>' +
            '<button class="admin-tab' + (listState.status === 'published' ? ' is-active' : '') + '" data-status="published">已发布</button>' +
            '<button class="admin-tab' + (listState.status === 'draft' ? ' is-active' : '') + '" data-status="draft">草稿</button>' +
          '</div>' +
          tagHint +
        '</div>' +
        '<a class="admin-btn primary" href="#/posts/new">新建文章</a>' +
      '</div>' +
      '<div id="post-list" class="admin-list"></div>',
      '<button class="admin-btn" data-action="refresh">刷新</button>'
    );

    var search = $('#post-search');
    search.addEventListener('input', function () {
      listState.q = search.value;
      renderPostRows();
    });

    $all('[data-status]').forEach(function (button) {
      button.addEventListener('click', function () {
        listState.status = button.getAttribute('data-status');
        $all('[data-status]').forEach(function (item) {
          item.classList.toggle('is-active', item === button);
        });
        renderPostRows();
      });
    });

    renderPostRows();
  }

  function renderPostRows() {
    var box = $('#post-list');
    if (!box) return;

    var query = listState.q.trim().toLowerCase();
    var items = state.posts.filter(function (post) {
      if (listState.status === 'draft' && !post.data.draft) return false;
      if (listState.status === 'published' && post.data.draft) return false;
      if (listState.tag && Core.toList(post.data[listState.taxonomy]).indexOf(listState.tag) < 0) return false;
      if (!query) return true;
      var haystack = [
        post.data.title,
        post.path,
        Core.toList(post.data.categories).join(' '),
        Core.toList(post.data.tags).join(' ')
      ].join(' ').toLowerCase();
      return haystack.indexOf(query) >= 0;
    });

    if (!items.length) {
      box.innerHTML = '<div class="admin-empty">没有匹配的文章。</div>';
      return;
    }
    box.innerHTML = items.map(postRowHtml).join('');
  }

  function postRowHtml(post) {
    var meta = [fmtDate(post.data.date)]
      .concat(Core.toList(post.data.categories))
      .concat(Core.toList(post.data.tags).slice(0, 3).map(function (tag) { return '#' + tag; }))
      .filter(Boolean)
      .join(' · ');

    return '<a class="admin-row" href="#/posts/edit?file=' + encodeURIComponent(post.path) + '">' +
      '<div class="admin-row-main">' +
        '<span class="admin-row-title">' + esc(post.data.title || '(无标题)') + '</span>' +
        '<span class="admin-row-sub">' + esc(meta) + '</span>' +
      '</div>' +
      '<div class="admin-row-side">' +
        (post.data.draft ? '<span class="admin-badge draft">草稿</span>' : '') +
      '</div>' +
      '</a>';
  }

  /* ========================================================================
     页面列表
     ======================================================================== */

  function renderPages() {
    var rows = state.pages.map(function (page) {
      return '<a class="admin-row" href="#/pages/edit?file=' + encodeURIComponent(page.path) + '">' +
        '<div class="admin-row-main">' +
          '<span class="admin-row-title">' + esc(page.data.title || '(无标题)') + '</span>' +
          '<span class="admin-row-sub">' + esc(page.path) + (page.data.menu ? ' · 导航菜单' : '') + '</span>' +
        '</div>' +
        '<div class="admin-row-side">' +
          (page.data.draft ? '<span class="admin-badge draft">草稿</span>' : '') +
        '</div>' +
        '</a>';
    }).join('');

    shell('pages', '页面',
      '<div class="admin-toolbar">' +
        '<span class="admin-muted">独立页面，例如关于、友链。新建页面默认路径为 <code>/&lt;slug&gt;/</code>。</span>' +
        '<a class="admin-btn primary" href="#/pages/new">新建页面</a>' +
      '</div>' +
      '<div class="admin-list">' + (rows || '<div class="admin-empty">还没有独立页面。</div>') + '</div>',
      '<button class="admin-btn" data-action="refresh">刷新</button>'
    );
  }

  /* ========================================================================
     编辑器
     ======================================================================== */

  function renderEditor(options) {
    var kind = options.kind;
    var isPost = kind === 'post';
    var list = isPost ? state.posts : state.pages;
    var ed;

    if (options.isNew) {
      ed = {
        kind: kind,
        isNew: true,
        path: null,
        sha: null,
        data: {
          title: '',
          date: Core.nowDate(),
          description: '',
          categories: [],
          tags: [],
          license: (window.ADMIN_CONFIG && window.ADMIN_CONFIG.licenseDefault) || '',
          draft: true
        },
        body: '',
        original: '',
        tags: []
      };
    } else {
      if (!options.file) {
        shell(isPost ? 'posts' : 'pages', '打不开', '<div class="admin-empty">缺少文件参数。<a href="#/' + (isPost ? 'posts' : 'pages') + '">返回列表</a></div>');
        return;
      }
      var found = list.filter(function (item) { return item.path === options.file; })[0];
      if (!found) {
        shell(isPost ? 'posts' : 'pages', '打不开',
          '<div class="admin-empty">找不到这个文件，可能已被删除或重命名。<a href="#/' + (isPost ? 'posts' : 'pages') + '">返回列表</a></div>');
        return;
      }
      ed = {
        kind: kind,
        isNew: false,
        path: found.path,
        sha: found.sha,
        data: found.data,
        body: found.body,
        original: found.text,
        tags: Core.toList(found.data.tags)
      };
    }

    state.editing = ed;
    state.dirty = false;

    var title = (options.isNew ? (isPost ? '新建文章' : '新建页面') : (isPost ? '编辑文章' : '编辑页面'));
    shell(isPost ? 'posts' : 'pages', title, editorHtml(ed), 
      '<button class="admin-btn" data-action="back">返回</button>' +
      '<button class="admin-btn" data-action="save-draft">存为草稿</button>' +
      '<button class="admin-btn primary" data-action="publish">发布</button>'
    );

    bindEditor(ed);
    updatePreview();
  }

  function licenseOptions(current) {
    var cfg = window.ADMIN_CONFIG || {};
    var items = cfg.licenses || [];
    var names = items.map(function (item) { return item.name; });
    var options = [{ value: '', label: '不声明（不展示卡片）' }];

    items.forEach(function (item) {
      options.push({ value: item.name, label: item.name });
    });

    if (current && names.indexOf(current) < 0) {
      options.push({ value: current, label: current + '（自定义）' });
    }

    return options.map(function (item) {
      return '<option value="' + esc(item.value) + '"' +
        (item.value === current ? ' selected' : '') + '>' + esc(item.label) + '</option>';
    }).join('');
  }

  function editorHtml(ed) {
    var isPost = ed.kind === 'post';
    var data = ed.data;
    var categories = Core.counts(state.posts, 'categories').map(function (item) { return item.name; });
    var dateValue = Core.toInputDate(data.date) || Core.toInputDate(Core.nowDate());
    var draftBadge = data.draft
      ? '<span class="admin-badge draft" id="status-badge">草稿</span>'
      : '<span class="admin-badge" id="status-badge">已发布</span>';

    var meta = '<label class="admin-field">日期' +
        '<input id="f-date" type="datetime-local" class="admin-input" value="' + esc(dateValue) + '"></label>';

    if (isPost) {
      meta += '<label class="admin-field">分类' +
        '<input id="f-cat" class="admin-input" list="cat-list" value="' + esc(Core.toList(data.categories)[0] || '') + '">' +
        '<datalist id="cat-list">' + categories.map(function (name) {
          return '<option value="' + esc(name) + '"></option>';
        }).join('') + '</datalist></label>';
      meta += '<label class="admin-field">许可协议' +
        '<select id="f-license" class="admin-select">' + licenseOptions(data.license) + '</select>' +
        '<span class="admin-hint">留空则文章页不显示许可卡片</span>' +
        '</label>';
    }

    if (!isPost && ed.isNew) {
      meta += '<label class="admin-field">路径' +
        '<input id="f-slug" class="admin-input" placeholder="links" value="' + esc(Core.slugify(data.title || '').toLowerCase()) + '">' +
        '</label>';
    }

    meta += draftBadge;

    return '<form id="editor" class="admin-editor" autocomplete="off">' +
      '<div class="admin-editor-head">' +
        '<input id="f-title" class="admin-input admin-title-input" placeholder="标题" value="' + esc(data.title || '') + '">' +
        '<div class="admin-editor-meta">' + meta + '</div>' +
        '<textarea id="f-desc" class="admin-textarea" rows="2" placeholder="摘要 / description（可留空）">' + esc(data.description || '') + '</textarea>' +
        (isPost ? tagsHtml(ed) : '') +
        (!isPost ? menuHtml(ed) : '') +
      '</div>' +
      toolbarHtml() +
      '<div class="admin-editor-split">' +
        '<textarea id="f-body" class="admin-code" spellcheck="false" placeholder="正文 Markdown…">' + esc(ed.body) + '</textarea>' +
        '<iframe id="preview" class="admin-preview" title="Markdown 预览" sandbox="" referrerpolicy="no-referrer" style="width:100%;min-height:65vh;border:0"></iframe>' +
      '</div>' +
      '<div class="admin-editor-foot">' +
        '<div class="admin-editor-status" id="save-hint">' + (ed.isNew ? '新文件，尚未提交' : '已同步') + '</div>' +
        '<div class="admin-actions">' +
          (!ed.isNew ? '<button type="button" class="admin-btn danger" data-action="delete">删除</button>' : '') +
        '</div>' +
      '</div>' +
      '</form>';
  }

  function tagsHtml(ed) {
    return '<div class="admin-field"><span>标签</span>' +
      '<div class="admin-chips" id="tag-chips">' + tagChipsHtml(ed.tags) +
      '<input id="tag-input" placeholder="输入后回车添加" aria-label="添加标签"></div></div>';
  }

  function tagChipsHtml(tags) {
    return tags.map(function (tag, index) {
      return '<span class="admin-chip">' + esc(tag) +
        '<button type="button" data-tag="' + index + '" aria-label="移除 ' + esc(tag) + '">×</button></span>';
    }).join('');
  }

  function menuHtml(ed) {
    var enabled = !!ed.data.menu;
    var weight = ed.data.weight ||
      (ed.data.menu && ed.data.menu.main && ed.data.menu.main.weight) || 50;

    return '<div class="admin-editor-meta">' +
      '<label class="admin-switch"><input id="f-menu" type="checkbox"' + (enabled ? ' checked' : '') + '> 显示在导航菜单</label>' +
      '<label class="admin-field">排序权重' +
        '<input id="f-weight" type="number" class="admin-input" min="1" max="999" value="' + esc(weight) + '">' +
      '</label>' +
      '</div>';
  }

  function toolbarHtml() {
    var buttons = [
      ['bold', 'B', '加粗', '**加粗**'],
      ['italic', 'I', '斜体', '*斜体*'],
      ['strike', 'S', '删除线', '~~删除线~~'],
      ['code', '</>', '行内代码', '`代码`'],
      ['h2', 'H2', '二级标题', '\n## 标题\n'],
      ['quote', '❝', '引用', '\n> 引用\n'],
      ['list', '•', '列表', '\n- 列表项\n'],
      ['link', '🔗', '链接', '[链接文字](https://example.com)'],
      ['image', '🖼', '图片', ''],
      ['alert', '💡', '提示框', ''],
      ['bilibili', 'B', 'B 站卡片', ''],
      ['github', 'GH', 'GitHub 卡片', '']
    ];

    return '<div class="admin-editor-toolbar">' + buttons.map(function (item) {
      return '<button type="button" class="admin-tool" data-md="' + item[0] + '" title="' + item[2] + '">' + item[1] + '</button>';
    }).join('') + '</div>';
  }

  function bindEditor(ed) {
    var form = $('#editor');
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    form.addEventListener('input', markDirty);

    var titleInput = $('#f-title');
    if (titleInput) {
      titleInput.addEventListener('input', function () {
        if (ed.kind === 'page' && ed.isNew) {
          var slugInput = $('#f-slug');
          if (slugInput && !slugInput.dataset.touched) {
            slugInput.value = Core.slugify(titleInput.value).toLowerCase();
          }
        }
      });
    }

    var slugInput = $('#f-slug');
    if (slugInput) slugInput.addEventListener('input', function () { slugInput.dataset.touched = '1'; });

    var body = $('#f-body');
    if (body) {
      body.addEventListener('input', debounce(updatePreview, 220));
      body.addEventListener('keydown', function (event) {
        if (event.key === 'Tab') {
          event.preventDefault();
          insertText('    ');
        }
      });
    }

    if (ed.kind === 'post') bindTags(ed);

    var licenseSelect = $('#f-license');
    if (licenseSelect) licenseSelect.addEventListener('change', markDirty);

    $all('[data-md]').forEach(function (button) {
      button.addEventListener('click', function () { runTool(button.getAttribute('data-md')); });
    });

    $all('[data-action]').forEach(function (button) {
      var action = button.getAttribute('data-action');
      if (action === 'back') {
        button.addEventListener('click', function () { go(ed.kind === 'post' ? '#/posts' : '#/pages'); });
      } else if (action === 'save-draft') {
        button.addEventListener('click', function () { saveEditor(false); });
      } else if (action === 'publish') {
        button.addEventListener('click', function () { saveEditor(true); });
      } else if (action === 'delete') {
        button.addEventListener('click', deleteEditor);
      }
    });
  }

  function bindTags(ed) {
    var box = $('#tag-chips');
    var input = $('#tag-input');

    function refresh() {
      var chips = tagChipsHtml(ed.tags);
      box.innerHTML = chips + '<input id="tag-input" placeholder="输入后回车添加" aria-label="添加标签">';
      input = $('#tag-input');
      input.addEventListener('keydown', onKey);
      input.addEventListener('blur', function () {
        if (input.value.trim()) add(input.value);
      });
      input.focus();
    }

    function add(value) {
      var items = String(value).split(/[,，]/).map(function (item) { return item.trim(); }).filter(Boolean);
      items.forEach(function (item) {
        if (ed.tags.indexOf(item) < 0) ed.tags.push(item);
      });
      markDirty();
      refresh();
    }

    function onKey(event) {
      if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
        event.preventDefault();
        if (input.value.trim()) add(input.value);
      } else if (event.key === 'Backspace' && !input.value && ed.tags.length) {
        ed.tags.pop();
        markDirty();
        refresh();
      }
    }

    box.addEventListener('click', function (event) {
      var button = event.target.closest('[data-tag]');
      if (!button) return;
      ed.tags.splice(Number(button.getAttribute('data-tag')), 1);
      markDirty();
      refresh();
    });

    input.addEventListener('keydown', onKey);
    input.addEventListener('blur', function () {
      if (input.value.trim()) add(input.value);
    });
  }

  function markDirty() {
    if (!state.editing) return;
    state.dirty = true;
    var hint = $('#save-hint');
    if (hint) {
      hint.textContent = '有未保存的修改';
      hint.className = 'admin-editor-status is-dirty';
    }
  }

  function insertText(text) {
    var area = $('#f-body');
    if (!area) return;
    var start = area.selectionStart;
    var end = area.selectionEnd;
    area.setRangeText(text, start, end, 'end');
    area.focus();
    markDirty();
    updatePreview();
  }

  function surround(before, after, placeholder) {
    var area = $('#f-body');
    if (!area) return;
    var start = area.selectionStart;
    var end = area.selectionEnd;
    var selected = area.value.slice(start, end) || placeholder || '';
    area.setRangeText(before + selected + after, start, end, 'end');
    area.focus();
    markDirty();
    updatePreview();
  }

  async function runTool(name) {
    if (name === 'bold') return surround('**', '**', '加粗文字');
    if (name === 'italic') return surround('*', '*', '斜体文字');
    if (name === 'strike') return surround('~~', '~~', '删除线');
    if (name === 'code') return surround('`', '`', '代码');
    if (name === 'h2') return insertText('\n## 标题\n');
    if (name === 'quote') return insertText('\n> 引用内容\n');
    if (name === 'list') return insertText('\n- 列表项\n');
    if (name === 'link') return insertText('[链接文字](https://example.com)');

    if (name === 'image') {
      var url = await pickMedia();
      if (url) insertText('\n![](' + url + ')\n');
      return;
    }

    if (name === 'alert') {
      var type = await dialog({
        title: '插入提示框',
        body: '<label class="admin-field">类型' +
          '<select id="dlg-input" class="admin-input">' +
            '<option value="note">注释 note</option>' +
            '<option value="tip" selected>提示 tip</option>' +
            '<option value="important">重要 important</option>' +
            '<option value="warning">警告 warning</option>' +
            '<option value="caution">注意 caution</option>' +
          '</select></label>',
        confirm: '插入'
      });
      if (type) insertText('\n> [!' + String(type).toUpperCase() + ']\n> 提示内容\n');
      return;
    }

    if (name === 'bilibili') {
      var bvid = await dialog({
        title: '插入 B 站卡片',
        body: '<label class="admin-field">BV 号' +
          '<input id="dlg-input" class="admin-input" placeholder="BV1xx411c7mD"></label>' +
          '<p class="admin-hint" style="margin-top:8px">已经有 data/bilibili 快照的视频会显示封面和标题，否则构建时尝试请求接口。</p>',
        confirm: '插入'
      });
      if (bvid) insertText('\n{{< bilibili bvid="' + bvid.trim() + '" >}}\n');
      return;
    }

    if (name === 'github') {
      var repo = await dialog({
        title: '插入 GitHub 卡片',
        body: '<label class="admin-field">仓库' +
          '<input id="dlg-input" class="admin-input" placeholder="owner/repository"></label>',
        confirm: '插入'
      });
      if (repo) insertText('\n{{< github repo="' + repo.trim() + '" >}}\n');
    }
  }

  function collectEditor(publish) {
    var ed = state.editing;
    var title = ($('#f-title').value || '').trim();
    if (!title) {
      toast('标题不能为空', 'error');
      return null;
    }

    var data = Object.assign({}, ed.data);
    data.title = title;

    var dateInput = $('#f-date').value;
    var originalInput = Core.toInputDate(ed.data.date);
    data.date = (dateInput && dateInput === originalInput && ed.data.date)
      ? ed.data.date
      : (Core.fromInputDate(dateInput) || Core.nowDate());

    var description = ($('#f-desc').value || '').trim();
    if (description) data.description = description;
    else delete data.description;

    data.draft = !publish;

    if (ed.kind === 'post') {
      var category = ($('#f-cat').value || '').trim();
      var originalCategories = Core.toList(ed.data.categories);
      if (category !== (originalCategories[0] || '')) data.categories = category || [];
      data.tags = ed.tags.slice();

      var licenseSelect = $('#f-license');
      if (licenseSelect) {
        var license = licenseSelect.value.trim();
        if (license) data.license = license;
        else delete data.license;
      }
    } else {
      var menu = $('#f-menu');
      if (menu && menu.checked) {
        data.menu = ed.data.menu || 'main';
        data.weight = Number(($('#f-weight') || {}).value) || 50;
      } else {
        delete data.menu;
        delete data.weight;
      }
    }

    var body = $('#f-body').value;
    ed.body = body;

    return { data: data, text: Core.join(data, body), body: body };
  }

  function targetPath(ed, data) {
    if (ed.path) return ed.path;

    if (ed.kind === 'post') {
      var datePart = String(data.date || Core.nowDate()).slice(0, 10);
      var slug = Core.slugify(data.title) || 'post';
      var base = 'content/posts/' + datePart + '-' + slug;
      var path = base + '.md';
      var n = 2;
      while (state.posts.some(function (post) { return post.path === path; })) {
        path = base + '-' + n + '.md';
        n += 1;
      }
      return path;
    }

    var pageSlug = Core.slugify(($('#f-slug') && $('#f-slug').value) || data.title).toLowerCase() || 'page';
    if (/^(posts|tags|categories|admin)$/.test(pageSlug)) throw new Error('这个路径被系统占用了');
    return 'content/' + pageSlug + '/index.md';
  }

  function setSaving(saving) {
    if (saving) {
      cancelRunPolling();
      state.run = null;
      setStatus('idle', '发布状态待确认');
    }
    state.saving = saving;
    $all('[data-action="save-draft"],[data-action="publish"],[data-action="delete"]').forEach(function (button) {
      button.disabled = saving;
    });
    var hint = $('#save-hint');
    if (saving && hint) hint.textContent = '正在提交…';
  }

  async function putWithRetry(ed, path, text, message) {
    try {
      return await state.gh.putFile({
        path: path,
        text: text,
        message: message,
        sha: ed.sha || undefined
      });
    } catch (err) {
      if (err.status !== 409 && err.status !== 422) throw err;
      throw new Error('保存冲突：远端内容已变化或路径已存在。当前编辑内容仍保留，请先复制正文，再刷新核对；后台不会自动覆盖远端文件。');
    }
  }

  async function saveEditor(publish) {
    if (state.saving || !state.editing) return;
    var ed = state.editing;
    var gh = state.gh;
    var collected = collectEditor(publish);
    if (!collected) return;

    var path;
    try {
      path = targetPath(ed, collected.data);
    } catch (err) {
      toast(err.message, 'error');
      return;
    }

    if (ed.isNew && ed.kind === 'page' && state.pages.some(function (page) { return page.path === path; })) {
      toast('同名页面已存在', 'error');
      return;
    }

    var wasDraft = ed.data.draft === true;
    var label = ed.kind === 'post' ? '文章' : '页面';
    var message = (ed.isNew
      ? (publish ? '发布' : '新建草稿')
      : (publish ? '发布' : '更新')) + label + '《' + collected.data.title + '》';
    if (!publish && wasDraft) message += ' [skip ci]';

    setSaving(true);
    try {
      var result = await putWithRetry(ed, path, collected.text, message);
      if (state.gh !== gh) return;

      var item = {
        path: path,
        sha: result.content.sha,
        text: collected.text,
        data: Core.normalize(collected.data),
        body: collected.body
      };
      upsert(ed.kind, item);

      ed.path = path;
      ed.sha = result.content.sha;
      ed.isNew = false;
      ed.data = item.data;
      ed.body = item.body;
      ed.original = collected.text;
      state.dirty = false;

      toast(publish ? '已提交，正在构建…' : '草稿已保存', 'success');
      if (publish || !wasDraft) pollRun(result.commit && result.commit.sha);
      go(ed.kind === 'post' ? '#/posts' : '#/pages');
    } catch (err) {
      toast(err.message || '保存失败', 'error');
      var hint = $('#save-hint');
      if (hint) hint.textContent = '保存失败：' + (err.message || '');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEditor() {
    var ed = state.editing;
    var gh = state.gh;
    if (!ed || ed.isNew) return;
    var label = ed.kind === 'post' ? '文章' : '页面';
    var title = ($('#f-title') && $('#f-title').value) || ed.data.title || '';
    var ok = await confirmDialog('删除' + label, '确定删除《' + esc(title) + '》？删除会直接提交到 GitHub。');
    if (!ok) return;

    setSaving(true);
    try {
      var result = await state.gh.deleteFile({
        path: ed.path,
        sha: ed.sha,
        message: '删除' + label + '《' + title + '》'
      });
      if (state.gh !== gh) return;
      removeLocal(ed.kind, ed.path);
      state.dirty = false;
      toast('已删除', 'success');
      if (result && result.commit) pollRun(result.commit.sha);
      go(ed.kind === 'post' ? '#/posts' : '#/pages');
    } catch (err) {
      toast(err.message || '删除失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  function upsert(kind, item) {
    var list = kind === 'post' ? state.posts : state.pages;
    var index = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].path === item.path) { index = i; break; }
    }
    if (index >= 0) list[index] = item;
    else list.push(item);
    if (kind === 'post') list.sort(sortByDate);
  }

  function removeLocal(kind, path) {
    if (kind === 'post') {
      state.posts = state.posts.filter(function (item) { return item.path !== path; });
    } else {
      state.pages = state.pages.filter(function (item) { return item.path !== path; });
    }
  }

  /* ========================================================================
     预览
     ======================================================================== */

  function updatePreview() {
    var area = $('#f-body');
    var box = $('#preview');
    if (!area || !box) return;
    var html;
    try {
      html = renderPreview(area.value);
    } catch (err) {
      html = '<p>预览失败：' + esc(err.message) + '</p>';
    }
    // Opaque-origin sandbox: authored HTML cannot access the CMS or its credentials.
    var styles = $all('link[rel="stylesheet"]').map(function (link) {
      return '<link rel="stylesheet" href="' + esc(link.href) + '">';
    }).join('');
    box.srcdoc = '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;none&#39;; style-src https: http: &#39;unsafe-inline&#39;; img-src https: http: data:; font-src https: http: data:; form-action &#39;none&#39;; base-uri &#39;none&#39;">' +
      styles + '<style>body{padding:16px;margin:0;overflow-wrap:anywhere}img{max-width:100%}</style></head><body>' + html + '</body></html>';
  }

  function parseAttrs(text) {
    var out = {};
    String(text || '').replace(/([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"/g, function (_, key, value) {
      out[key] = value;
    });
    return out;
  }

  function calloutHtml(type, title, inner) {
    var labels = { note: '注释', tip: '提示', important: '重要', warning: '警告', caution: '注意' };
    return '<aside class="callout callout-' + type + '">' +
      '<div class="callout-title"><span>' + esc(title || labels[type] || type) + '</span></div>' +
      '<div class="callout-content">' + inner + '</div></aside>';
  }

  function renderPreview(markdown) {
    var blocks = [];
    var source = String(markdown || '');

    source = source.replace(/\{\{<\s*alert\s+([^>]*?)\s*>\s*\}\}([\s\S]*?)\{\{<\s*\/\s*alert\s*>\s*\}\}/g, function (_, attrs, inner) {
      blocks.push({ type: 'alert', attrs: parseAttrs(attrs), inner: inner });
      return '\n\n@@BLOCK' + (blocks.length - 1) + '@@\n\n';
    });

    source = source.replace(/\{\{<\s*(bilibili|github)\s+([^>]*?)\s*>\s*\}\}/g, function (_, name, attrs) {
      blocks.push({ type: name, attrs: parseAttrs(attrs) });
      return '\n\n@@BLOCK' + (blocks.length - 1) + '@@\n\n';
    });

    var html = marked.parse(source, { mangle: false, headerIds: false });

    html = html.replace(/<p>@@BLOCK(\d+)@@<\/p>/g, function (_, index) {
      return blockHtml(blocks[Number(index)]);
    });
    html = html.replace(/@@BLOCK(\d+)@@/g, function (_, index) {
      return blockHtml(blocks[Number(index)]);
    });

    html = html.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]([^<]*)<\/p>([\s\S]*?)<\/blockquote>/gi, function (_, type, title, rest) {
      return calloutHtml(String(type).toLowerCase(), String(title).trim(), '<p>' + rest.trim() + '</p>');
    });

    return '<div class="md-content">' + html + '</div>';
  }

  function blockHtml(block) {
    if (!block) return '';
    var attrs = block.attrs || {};

    if (block.type === 'alert') {
      return calloutHtml(String(attrs.type || 'note').toLowerCase(), attrs.title || '', marked.parse(block.inner || ''));
    }

    if (block.type === 'bilibili') {
      var video = attrs.bvid || attrs.aid || '';
      var title = attrs.title || ('Bilibili 视频 · ' + video);
      var cover = attrs.cover || '';
      return '<a class="bilibili-card" href="https://www.bilibili.com/video/' + esc(video) + '/" target="_blank" rel="noopener noreferrer">' +
        '<div class="bilibili-card-cover">' +
          (cover ? '<img src="' + esc(cover) + '" alt="">' : '') +
          '<span class="bilibili-card-play" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m9 5 11 7-11 7Z"/></svg></span>' +
        '</div>' +
        '<div class="bilibili-card-body">' +
          '<span class="bilibili-card-label">bilibili</span>' +
          '<strong class="bilibili-card-title">' + esc(title) + '</strong>' +
          '<div class="bilibili-card-stats"><span>预览卡片 · 发布后显示真实数据</span></div>' +
        '</div></a>';
    }

    if (block.type === 'github') {
      var repo = attrs.repo || 'owner/repository';
      var parts = repo.split('/');
      return '<a class="github-card" href="https://github.com/' + esc(repo) + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="github-card-heading">' +
          '<img class="github-card-avatar" src="https://github.com/' + esc(parts[0] || '') + '.png?size=80" alt="">' +
          '<span class="github-card-name"><span>' + esc(parts[0] || '') + '</span><span class="github-card-slash"> / </span><strong>' + esc(parts[1] || '') + '</strong></span>' +
        '</div>' +
        '<p class="github-card-description">预览卡片 · 发布后由浏览器补全 Star / Fork</p>' +
        '</a>';
    }

    return '';
  }

  /* ========================================================================
     标签 / 分类
     ======================================================================== */

  function renderTaxonomy(key) {
    var isTag = key === 'tags';
    var label = isTag ? '标签' : '分类';
    var items = Core.counts(state.posts, key);

    var rows = items.map(function (item) {
      return '<tr>' +
        '<td><strong>' + esc(item.name) + '</strong></td>' +
        '<td class="num">' + item.count + '</td>' +
        '<td><div class="ops">' +
          '<a class="admin-btn small" href="#/posts?' + (isTag ? 'tag' : 'category') + '=' + encodeURIComponent(item.name) + '">文章</a>' +
          '<button type="button" class="admin-btn small" data-tax="rename" data-name="' + esc(item.name) + '">重命名</button>' +
          '<button type="button" class="admin-btn small" data-tax="merge" data-name="' + esc(item.name) + '">合并</button>' +
          '<button type="button" class="admin-btn small danger" data-tax="delete" data-name="' + esc(item.name) + '">删除</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    shell(key, label + '管理',
      '<div class="admin-card">' +
        '<p class="admin-muted" style="margin-top:0">重命名、合并、删除会改写所有相关文章的 front matter，并作为一个 commit 提交后重建站点。</p>' +
        '<div class="admin-table-wrap"><table class="admin-table">' +
          '<thead><tr><th>' + label + '</th><th class="num">文章数</th><th style="text-align:right">操作</th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="3" class="admin-empty">还没有' + label + '。</td></tr>') + '</tbody>' +
        '</table></div>' +
      '</div>',
      '<button class="admin-btn" data-action="refresh">刷新</button>'
    );

    $all('[data-tax]').forEach(function (button) {
      button.addEventListener('click', function () {
        var action = button.getAttribute('data-tax');
        var name = button.getAttribute('data-name');
        if (action === 'rename') renameTaxonomy(key, name);
        else if (action === 'merge') mergeTaxonomy(key, name);
        else if (action === 'delete') deleteTaxonomy(key, name);
      });
    });
  }

  async function renameTaxonomy(key, oldName) {
    var label = key === 'tags' ? '标签' : '分类';
    var value = await promptDialog('重命名' + label, '把「' + oldName + '」改成：', oldName);
    if (value == null) return;
    value = String(value).trim();
    if (!value || value === oldName) return;

    var changes = [];
    state.posts.forEach(function (post) {
      var list = Core.toList(post.data[key]);
      if (list.indexOf(oldName) < 0) return;
      var next = list.map(function (item) { return item === oldName ? value : item; })
        .filter(function (item, index, array) { return array.indexOf(item) === index; });
      changes.push({ path: post.path, sha: post.sha, content: Core.replaceTaxonomy(post.text, key, next) });
    });

    if (!changes.length) return;
    cancelRunPolling();
    var gh = state.gh;
    renderBoot('正在重命名' + label + '…');
    try {
      var commit = await state.gh.commitFiles('重命名' + label + '「' + oldName + '」→「' + value + '」', changes);
      if (state.gh !== gh) return;
      await loadAll();
      if (state.gh !== gh) return;
      render();
      if (commit) pollRun(commit.sha);
      toast('已重命名为「' + value + '」', 'success');
    } catch (err) {
      state.loaded = true;
      render();
      toast(err.message || '重命名失败', 'error');
    }
  }

  async function mergeTaxonomy(key, oldName) {
    var label = key === 'tags' ? '标签' : '分类';
    var others = Core.counts(state.posts, key).map(function (item) { return item.name; }).filter(function (name) {
      return name !== oldName;
    });

    if (!others.length) {
      toast('没有可以合并的目标', 'error');
      return;
    }

    var value = await dialog({
      title: '合并' + label,
      body: '<p>把「' + esc(oldName) + '」合并到：</p>' +
        '<select id="dlg-input" class="admin-input">' + others.map(function (name) {
          return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
        }).join('') + '</select>',
      confirm: '合并'
    });
    if (!value) return;

    var changes = [];
    state.posts.forEach(function (post) {
      var list = Core.toList(post.data[key]);
      if (list.indexOf(oldName) < 0) return;
      var next = list.map(function (item) { return item === oldName ? value : item; })
        .filter(function (item, index, array) { return array.indexOf(item) === index; });
      changes.push({ path: post.path, sha: post.sha, content: Core.replaceTaxonomy(post.text, key, next) });
    });

    if (!changes.length) return;
    cancelRunPolling();
    var gh = state.gh;
    renderBoot('正在合并' + label + '…');
    try {
      var commit = await state.gh.commitFiles('合并' + label + '「' + oldName + '」→「' + value + '」', changes);
      if (state.gh !== gh) return;
      await loadAll();
      if (state.gh !== gh) return;
      render();
      if (commit) pollRun(commit.sha);
      toast('已合并到「' + value + '」', 'success');
    } catch (err) {
      state.loaded = true;
      render();
      toast(err.message || '合并失败', 'error');
    }
  }

  async function deleteTaxonomy(key, name) {
    var label = key === 'tags' ? '标签' : '分类';
    var ok = await confirmDialog('删除' + label, '从所有文章中移除「' + esc(name) + '」？这不会删除文章。');
    if (!ok) return;

    var changes = [];
    state.posts.forEach(function (post) {
      var list = Core.toList(post.data[key]);
      if (list.indexOf(name) < 0) return;
      var next = list.filter(function (item) { return item !== name; });
      changes.push({ path: post.path, sha: post.sha, content: Core.replaceTaxonomy(post.text, key, next) });
    });

    if (!changes.length) return;
    cancelRunPolling();
    var gh = state.gh;
    renderBoot('正在删除' + label + '…');
    try {
      var commit = await state.gh.commitFiles('删除' + label + '「' + name + '」', changes);
      if (state.gh !== gh) return;
      await loadAll();
      if (state.gh !== gh) return;
      render();
      if (commit) pollRun(commit.sha);
      toast('已删除「' + name + '」', 'success');
    } catch (err) {
      state.loaded = true;
      render();
      toast(err.message || '删除失败', 'error');
    }
  }

  /* ========================================================================
     媒体
     ======================================================================== */

  function renderMedia() {
    var cards = state.media.map(function (item) {
      return '<div class="admin-media">' +
        '<a href="' + esc(item.url) + '" target="_blank" rel="noopener"><img src="' + esc(rawUrl(item.path, item.sha)) + '" alt="" loading="lazy"></a>' +
        '<div class="admin-media-meta" title="' + esc(item.path) + '">' + esc(item.path.split('/').pop()) + '</div>' +
        '<div class="admin-media-actions">' +
          '<button type="button" class="admin-btn small" data-copy-media="' + esc(item.path) + '">复制链接</button>' +
          '<button type="button" class="admin-btn small danger" data-del-media="' + esc(item.path) + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join('');

    shell('media', '媒体库',
      '<div class="admin-toolbar">' +
        '<span class="admin-muted">图片会压缩到最长边 1600px，保存到 <code>static/uploads/</code>，发布页引用 <code>/uploads/…</code>。</span>' +
        '<label class="admin-btn primary">上传图片<input id="media-file" type="file" accept="image/*" multiple hidden></label>' +
      '</div>' +
      '<div class="admin-media-grid">' + (cards || '<div class="admin-empty">媒体库还是空的，先上传一张图片。</div>') + '</div>',
      '<button class="admin-btn" data-action="refresh">刷新</button>'
    );

    var input = $('#media-file');
    input.addEventListener('change', async function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) return;
      for (var i = 0; i < files.length; i++) {
        try {
          await uploadImage(files[i]);
        } catch (err) {
          toast(err.message || '上传失败', 'error');
        }
      }
      renderMedia();
    });

    $all('[data-copy-media]').forEach(function (button) {
      button.addEventListener('click', function () {
        copyText(siteUrl(button.getAttribute('data-copy-media')));
      });
    });

    $all('[data-del-media]').forEach(function (button) {
      button.addEventListener('click', async function () {
        var path = button.getAttribute('data-del-media');
        var item = state.media.filter(function (media) { return media.path === path; })[0];
        if (!item) return;
        var ok = await confirmDialog('删除图片', '确定删除 ' + esc(path.split('/').pop()) + '？');
        if (!ok) return;
        try {
          await state.gh.deleteFile({
            path: path,
            sha: item.sha,
            message: '删除图片 ' + path.split('/').pop()
          });
          state.media = state.media.filter(function (media) { return media.path !== path; });
          renderMedia();
          toast('已删除', 'success');
        } catch (err) {
          toast(err.message || '删除失败', 'error');
        }
      });
    });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('已复制：' + text, 'success');
    } catch (err) {
      window.prompt('复制链接', text);
    }
  }

  async function compressImage(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!/^(png|jpe?g|gif|webp|avif)$/i.test(ext) || !/^image\/(png|jpeg|gif|webp|avif)$/i.test(file.type)) {
      throw new Error('仅支持 PNG、JPEG、GIF、WebP、AVIF 图片，不允许 SVG 或其他可执行文件');
    }
    if (file.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB');
    if (ext === 'gif') return { blob: file, ext: ext };

    var bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (err) {
      return { blob: file, ext: ext };
    }

    var max = 1600;
    var width = bitmap.width;
    var height = bitmap.height;
    if (Math.max(width, height) > max) {
      var scale = max / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);

    var blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, 'image/webp', 0.86);
    });
    if (!blob) return { blob: file, ext: ext };
    return { blob: blob, ext: 'webp' };
  }

  async function uploadImage(file) {
    var compressed = await compressImage(file);
    var buffer = await compressed.blob.arrayBuffer();
    var base64 = Core.b64encodeBytes(new Uint8Array(buffer));
    var now = new Date();
    var name = (Core.slugify(file.name.replace(/\.[^.]+$/, '')) || 'image') + '-' +
      now.getTime().toString(36) + '.' + compressed.ext;
    var path = 'static/uploads/' + now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + name;

    var result = await state.gh.putBinary({
      path: path,
      base64: base64,
      message: '上传图片 ' + file.name
    });

    var item = { path: path, sha: result.content.sha, url: siteUrl(path) };
    state.media.unshift(item);
    toast('图片已上传', 'success');
    return item;
  }

  async function pickMedia() {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className = 'admin-modal';

      function close(value) {
        wrap.remove();
        document.removeEventListener('keydown', onKey);
        resolve(value);
      }

      function onKey(event) {
        if (event.key === 'Escape') close(null);
      }

      var grid = state.media.length
        ? state.media.map(function (item) {
            return '<button type="button" data-url="' + esc(siteUrl(item.path)) + '">' +
              '<img src="' + esc(rawUrl(item.path, item.sha)) + '" alt="" loading="lazy"></button>';
          }).join('')
        : '<div class="admin-empty">媒体库还是空的，先上传一张。</div>';

      wrap.innerHTML = '<div class="admin-modal-card wide">' +
        '<h3>插入图片</h3>' +
        '<div class="admin-media-picker">' + grid + '</div>' +
        '<div class="admin-modal-actions">' +
          '<button type="button" class="admin-btn" data-close>取消</button>' +
          '<label class="admin-btn primary">上传并插入<input id="picker-file" type="file" accept="image/*" hidden></label>' +
        '</div></div>';

      document.body.appendChild(wrap);
      document.addEventListener('keydown', onKey);

      wrap.addEventListener('click', function (event) {
        if (event.target === wrap) close(null);
        var button = event.target.closest('[data-url]');
        if (button) close(button.getAttribute('data-url'));
      });

      wrap.querySelector('[data-close]').addEventListener('click', function () { close(null); });

      var fileInput = wrap.querySelector('#picker-file');
      fileInput.addEventListener('change', async function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
          var item = await uploadImage(file);
          close(siteUrl(item.path));
        } catch (err) {
          toast(err.message || '上传失败', 'error');
        }
      });
    });
  }

  /* ========================================================================
     设置
     ======================================================================== */

  function renderSettings() {
    var repoUrl = 'https://github.com/' + cfg.owner + '/' + cfg.repo;
    var actionsUrl = repoUrl + '/actions/workflows/' + cfg.workflow;
    var storage = localStorage.getItem(TOKEN_KEY)
      ? 'localStorage（记住此设备）'
      : (sessionStorage.getItem(TOKEN_KEY) ? 'sessionStorage（仅本次会话）' : '未保存');

    shell('settings', '设置',
      '<div class="admin-card">' +
        '<h2>仓库</h2>' +
        '<table class="admin-table">' +
          '<tr><td>仓库</td><td><a href="' + esc(repoUrl) + '" target="_blank" rel="noopener">' + esc(cfg.owner + '/' + cfg.repo) + '</a></td></tr>' +
          '<tr><td>分支</td><td><code>' + esc(cfg.branch) + '</code></td></tr>' +
          '<tr><td>部署</td><td><a href="' + esc(actionsUrl) + '" target="_blank" rel="noopener">' + esc(cfg.workflow) + '</a> · GitHub Actions</td></tr>' +
          '<tr><td>登录账号</td><td>' + esc(state.user && state.user.login || '') + '</td></tr>' +
          '<tr><td>Token 存储</td><td>' + esc(storage) + '</td></tr>' +
        '</table>' +
      '</div>' +
      '<div class="admin-card">' +
        '<h2>操作</h2>' +
        '<div class="admin-actions">' +
          '<button type="button" class="admin-btn" data-action="reload">重新读取仓库</button>' +
          '<a class="admin-btn" href="' + esc(repoUrl) + '/settings/pages" target="_blank" rel="noopener">Pages 设置</a>' +
          '<button type="button" class="admin-btn danger" data-action="logout-settings">退出登录</button>' +
        '</div>' +
        '<p class="admin-hint" style="margin-top:14px">退出登录只会清除本机保存的 Token，不会影响 GitHub 上的授权；需要时可在 GitHub 设置里撤销 Token。</p>' +
      '</div>' +
      '<div class="admin-card">' +
        '<h2>说明</h2>' +
        '<p class="admin-muted">“存为草稿”会写入 <code>draft: true</code> 并在 commit 里带 <code>[skip ci]</code>，不会触发构建；“发布”会去掉草稿标记并触发 GitHub Actions。删除文章、重命名标签都会直接提交到仓库，可在 GitHub 的提交历史里回滚。</p>' +
      '</div>',
      '<button class="admin-btn" data-action="refresh">刷新</button>'
    );

    var reload = $('[data-action="reload"]');
    if (reload) reload.addEventListener('click', reloadData);
    var logout = $('[data-action="logout-settings"]');
    if (logout) logout.addEventListener('click', logoutNow);
  }

  /* ========================================================================
     构建状态
     ======================================================================== */

  function pickRun(runs, sha) {
    var workflow = String(cfg.workflow || '');
    var expectedPath = workflow.indexOf('/') < 0 ? '.github/workflows/' + workflow : workflow;
    var list = (Array.isArray(runs) ? runs : []).filter(function (run) {
      if (!run) return false;
      var file = String(run.path || '').split('@')[0];
      var ours = /^\d+$/.test(workflow)
        ? String(run.workflow_id) === workflow
        : !!workflow && file === expectedPath;
      if (!ours || (run.head_branch && run.head_branch !== (cfg.branch || 'main'))) return false;
      return !sha || run.head_sha === sha;
    });
    return list[0] || null;
  }

  function cancelRunPolling() {
    runGeneration++;
    if (runTimer) {
      clearTimeout(runTimer.id);
      runTimer.resolve();
      runTimer = null;
    }
  }

  async function pollRun(sha) {
    cancelRunPolling();
    var generation = runGeneration;
    var gh = state.gh;
    if (!gh) return;
    state.run = null;
    if (!sha) {
      setStatus('idle', '状态未知');
      return;
    }
    setStatus('building', '等待构建…');

    function current() { return generation === runGeneration && state.gh === gh; }
    for (var attempt = 0; attempt < 48; attempt++) {
      await new Promise(function (resolve) {
        var timer = { resolve: resolve, id: null };
        timer.id = setTimeout(function () {
          if (runTimer === timer) runTimer = null;
          resolve();
        }, attempt === 0 ? 1200 : 5000);
        runTimer = timer;
      });
      if (!current()) return;
      try {
        var data = await gh.getRuns(cfg.workflow, sha);
        if (!current()) return;
        var run = pickRun(data && data.workflow_runs, sha);
        if (!run) continue;

        state.run = run;
        if (run.status !== 'completed') {
          setStatus(run.status === 'queued' ? 'idle' : 'building',
            run.status === 'queued' ? '排队中' : '构建中…', run.html_url);
        } else if (run.conclusion === 'success') {
          setStatus('success', '已上线', run.html_url);
          toast('构建完成，站点已更新', 'success');
          return;
        } else {
          setStatus('failed', run.conclusion === 'cancelled' ? '构建已取消' : '构建未成功', run.html_url);
          toast('构建未成功，点顶部状态查看日志', 'error');
          return;
        }
      } catch (err) {
        if (!current()) return;
        setStatus('idle', '状态暂不可用');
        if (err && (err.status === 401 || err.status === 403 || err.status === 404)) return;
        /* 临时网络错误可重试，但绝不推断提交已上线。 */
      }
    }
    if (current()) setStatus('idle', '状态未知');
  }

  /* ========================================================================
     弹窗
     ======================================================================== */

  function dialog(options) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className = 'admin-modal';
      wrap.innerHTML = '<div class="admin-modal-card' + (options.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
        '<h3>' + esc(options.title || '') + '</h3>' +
        '<div class="admin-modal-body">' + (options.body || '') + '</div>' +
        '<div class="admin-modal-actions">' +
          '<button type="button" class="admin-btn" data-close>取消</button>' +
          (options.confirm ? '<button type="button" class="admin-btn primary" data-confirm>' + esc(options.confirm) + '</button>' : '') +
        '</div></div>';

      document.body.appendChild(wrap);
      var field = wrap.querySelector('input, select, textarea');

      function close(value) {
        wrap.remove();
        document.removeEventListener('keydown', onKey);
        resolve(value);
      }

      function submit() {
        if (!options.confirm) return close(true);
        close(field ? field.value : true);
      }

      function onKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          close(null);
        } else if (event.key === 'Enter' && event.target && event.target.tagName !== 'TEXTAREA') {
          event.preventDefault();
          submit();
        }
      }

      wrap.querySelector('[data-close]').addEventListener('click', function () { close(null); });
      var confirmButton = wrap.querySelector('[data-confirm]');
      if (confirmButton) confirmButton.addEventListener('click', submit);
      wrap.addEventListener('click', function (event) {
        if (event.target === wrap) close(null);
      });
      document.addEventListener('keydown', onKey);

      if (field) {
        setTimeout(function () {
          field.focus();
          if (field.select) field.select();
        }, 30);
      }
    });
  }

  function confirmDialog(title, message) {
    return dialog({
      title: title,
      body: '<p>' + message + '</p>',
      confirm: '确定'
    }).then(function (value) { return !!value; });
  }

  function promptDialog(title, label, value) {
    return dialog({
      title: title,
      body: '<label class="admin-field">' + esc(label) +
        '<input id="dlg-input" class="admin-input" value="' + esc(value || '') + '"></label>',
      confirm: '确定'
    });
  }

  /* ========================================================================
     启动
     ======================================================================== */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
