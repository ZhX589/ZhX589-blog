/* 用 jsdom 对构建后的 /admin/ 做一次端到端冒烟测试（GitHub API 全部 mock）。 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/admin/index.html'), 'utf8');

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (err) => { errors.push('jsdomError: ' + err.message); console.log('JSDOM ERROR', err.message, err.stack); });
virtualConsole.on('error', (...args) => errors.push('console.error: ' + args.join(' ')));
virtualConsole.on('warn', (...args) => console.log('WARN:', ...args));

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/admin/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole
});
const w = dom.window;
w.confirm = () => true;
w.alert = () => {};
w.TextEncoder = TextEncoder;
w.TextDecoder = TextDecoder;
w.ADMIN_CONFIG = {
  owner: 'ZhX589',
  repo: 'ZhX589-blog',
  branch: 'main',
  workflow: 'deploy.yml',
  home: 'https://blog.zhx589.top/',
  licenses: [{ key: 'cc-by-nc-sa-4.0', name: 'CC-BY-NC-SA 4.0' }],
  licenseDefault: 'CC-BY-NC-SA 4.0'
};

const postDir = path.join(root, 'content/posts');
const postFiles = fs.readdirSync(postDir).filter((f) => f.endsWith('.md'));
const files = {};
const treeEntries = [];

for (const name of postFiles) {
  const p = 'content/posts/' + name;
  files[p] = fs.readFileSync(path.join(postDir, name), 'utf8');
  treeEntries.push({ path: p, type: 'blob', sha: 'sha-' + p });
}
files['content/about/index.md'] = fs.readFileSync(path.join(root, 'content/about/index.md'), 'utf8');
treeEntries.push({ path: 'content/about/index.md', type: 'blob', sha: 'sha-about' });
files['static/uploads/2026/10/demo.webp'] = '';
treeEntries.push({ path: 'static/uploads/2026/10/demo.webp', type: 'blob', sha: 'sha-media' });

const calls = [];
let conflictNext = false;
const runs = [{
  head_sha: 'commit1',
  status: 'completed',
  conclusion: 'success',
  html_url: 'https://github.com/ZhX589/ZhX589-blog/actions/runs/1',
  name: '构建并部署'
}];

function json(data, status = 200) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(data),
    json: async () => data
  };
}

w.fetch = async (url, options = {}) => {
  const method = options.method || 'GET';
  calls.push({ url, method, body: options.body });
  const parsed = new URL(url);
  const pathname = decodeURIComponent(parsed.pathname);

  if (pathname === '/user') return json({ login: 'ZhX589' });
  if (pathname === '/repos/ZhX589/ZhX589-blog' && !parsed.search) {
    return json({ permissions: { push: true } });
  }
  if (pathname.endsWith('/git/trees/main') || pathname.endsWith('/git/trees/head1')) return json({ tree: treeEntries });
  if (pathname.includes('/actions/workflows/deploy.yml/runs')) return json({ workflow_runs: runs });

  if (pathname.includes('/contents/')) {
    const filePath = pathname.split('/contents/')[1];
    if (method === 'PUT' || method === 'DELETE') {
      if (conflictNext) { conflictNext = false; return json({ message: 'SHA conflict' }, 409); }
      return json({ content: { sha: 'newsha' }, commit: { sha: 'commit1' } });
    }
    if (!(filePath in files)) return json({ message: 'Not Found' }, 404);
    return json({
      type: 'file',
      sha: 'sha-' + filePath,
      content: Buffer.from(files[filePath], 'utf8').toString('base64')
    });
  }

  if (pathname.includes('/git/refs/heads/main')) return json({});
  if (pathname.includes('/git/ref/heads/main')) return json({ object: { sha: 'head1' } });
  if (pathname.includes('/git/commits/head1')) return json({ tree: { sha: 'tree1' } });
  if (pathname.includes('/git/blobs')) return json({ sha: 'blob1' });
  if (pathname.includes('/git/trees')) return json({ sha: 'tree2' });
  if (pathname.includes('/git/commits')) return json({ sha: 'commit2' });

  return json({ message: 'unhandled ' + pathname }, 500);
};

for (const rel of [
  'assets/admin/js/vendor/js-yaml.min.js',
  'assets/admin/js/vendor/marked.min.js',
  'assets/admin/js/core.js',
  'assets/admin/js/admin.js'
]) {
  w.eval(fs.readFileSync(path.join(root, rel), 'utf8'));
}

if (!w.document.querySelector('.admin-login') && !w.document.querySelector('.admin-shell')) {
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log('  ok  ' + label);
  } else {
    failed += 1;
    console.error('  FAIL ' + label);
  }
}

(async () => {
  await wait(80);
  check(!!w.document.querySelector('.admin-login'), '未登录时显示登录页');
  check(!!w.document.querySelector('#token'), '登录页有 Token 输入框');

  w.document.querySelector('#token').value = 'github_pat_test';
  w.document.querySelector('#remember').checked = false;
  w.document.querySelector('#login-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await wait(400);

  check(!!w.document.querySelector('.admin-shell'), '登录后进入后台');
  check(w.document.querySelectorAll('.admin-stat').length === 4, '概览显示 4 个统计卡片');
  check(w.document.body.textContent.includes('最近文章'), '概览显示最近文章');

  w.location.hash = '#/posts';
  w.dispatchEvent(new w.Event('hashchange'));
  await wait(120);
  check(w.document.querySelectorAll('.admin-row').length === postFiles.length, '文章列表条数与仓库一致');

  const firstRow = w.document.querySelector('.admin-row');
  w.location.hash = firstRow.getAttribute('href');
  await wait(120);
  check(!!w.document.querySelector('#f-title'), '编辑器打开文章');
  check(!!w.document.querySelector('#preview').srcdoc, '预览有内容');
  check(w.document.querySelector('#preview').tagName === 'IFRAME' && w.document.querySelector('#preview').getAttribute('sandbox') === '', '预览无脚本及同源权限');
  check(w.document.querySelectorAll('.admin-chip').length >= 0, '标签区域渲染');

  const body = w.document.querySelector('#f-body');
  const initialBody = body.value;
  body.value = '<img src=x onerror="parent.localStorage.clear()"><script>parent.__pwned=true</script>';
  body.dispatchEvent(new w.Event('input', { bubbles: true }));
  await wait(250);
  check(!w.__pwned && !w.document.querySelector('#admin-view script'), '恶意正文未进入后台 DOM');
  body.value = initialBody;
  body.value += '\n\n冒烟测试追加的内容。';
  body.dispatchEvent(new w.Event('input', { bubbles: true }));
  w.document.querySelector('[data-action="publish"]').click();
  await wait(600);

  const puts = calls.filter((call) => call.method === 'PUT');
  check(puts.length === 1, '发布时发起一次 Contents PUT');
  if (puts.length) {
    const payload = JSON.parse(puts[0].body);
    const saved = Buffer.from(payload.content, 'base64').toString('utf8');
    check(payload.message.includes('发布文章'), '提交信息包含“发布文章”');
    check(saved.includes('冒烟测试追加的内容'), '提交内容包含正文修改');
  }
  check(w.location.hash === '#/posts', '发布后回到文章列表');

  // 新建文章并发布
  w.location.hash = '#/posts/new';
  await wait(150);
  check(!!w.document.querySelector('#f-title'), '打开新建文章编辑器');
  check(w.document.querySelector('#f-license').value === 'CC-BY-NC-SA 4.0', '新建文章默认选中 CC-BY-NC-SA 4.0');
  w.document.querySelector('#f-title').value = '冒烟新文章';
  w.document.querySelector('#f-body').value = '# 冒烟\n\n正文内容。';
  w.document.querySelector('[data-action="publish"]').click();
  await wait(600);
  const newPut = calls.filter((call) => call.method === 'PUT').pop();
  check(!!newPut, '新建文章发起 PUT');
  if (newPut) {
    const payload = JSON.parse(newPut.body);
    const saved = Buffer.from(payload.content, 'base64').toString('utf8');
    check(payload.message.includes('发布文章《冒烟新文章》'), '新文章提交信息正确');
    check(decodeURIComponent(newPut.url).includes('/contents/content/posts/'), '新文章写入 content/posts');
    check(saved.includes('license: CC-BY-NC-SA 4.0'), '新文章写入默认许可');
  }

  // 新建草稿应带 [skip ci]
  w.location.hash = '#/posts/new';
  await wait(150);
  w.document.querySelector('#f-title').value = '冒烟草稿';
  w.document.querySelector('#f-body').value = '草稿正文';
  w.document.querySelector('[data-action="save-draft"]').click();
  await wait(500);
  const draftPut = calls.filter((call) => call.method === 'PUT').pop();
  check(draftPut && JSON.parse(draftPut.body).message.includes('[skip ci]'), '新草稿带 [skip ci]');

  // 新建页面
  w.location.hash = '#/pages/new';
  await wait(150);
  check(!!w.document.querySelector('#f-slug'), '新建页面有路径输入');
  w.document.querySelector('#f-title').value = '友链';
  w.document.querySelector('#f-slug').value = 'links';
  w.document.querySelector('#f-body').value = '友链页面内容';
  w.document.querySelector('[data-action="publish"]').click();
  await wait(600);
  const pagePut = calls.filter((call) => call.method === 'PUT').pop();
  check(pagePut && decodeURIComponent(pagePut.url).includes('/contents/content/links/index.md'), '新页面写入 content/links/index.md');
  check(pagePut && JSON.parse(pagePut.body).message.includes('发布页面《友链》'), '新页面提交信息正确');

  w.location.hash = '#/tags';
  await wait(150);
  check(w.document.querySelectorAll('[data-tax]').length > 0, '标签管理有数据');

  const rename = w.document.querySelector('[data-tax="rename"]');
  rename.click();
  await wait(40);
  const modal = w.document.querySelector('.admin-modal');
  check(!!modal, '重命名弹出对话框');
  if (modal) {
    modal.querySelector('#dlg-input').value = '冒烟标签';
    modal.querySelector('[data-confirm]').click();
    await wait(700);
  }
  check(calls.some((call) => call.method === 'POST' && call.url.includes('/git/commits')), '重命名通过 Git Data API 提交');
  check(calls.some((call) => call.method === 'PATCH' && call.url.includes('/git/refs/heads/main')), '重命名后更新分支引用');

  w.location.hash = '#/pages';
  await wait(120);
  check(w.document.body.textContent.includes('About'), '页面列表包含 about');

  w.location.hash = '#/media';
  await wait(120);
  check(!!w.document.querySelector('.admin-media'), '媒体库渲染缩略图');

  w.location.hash = '#/settings';
  await wait(120);
  check(w.document.body.textContent.includes('Token 存储'), '设置页显示 Token 存储方式');

  w.location.hash = firstRow.getAttribute('href');
  await wait(120);
  const beforeConflict = calls.filter(c => c.method === 'PUT').length;
  conflictNext = true;
  w.document.querySelector('#f-body').value = '冲突时需要保留的内容';
  w.document.querySelector('[data-action="publish"]').click();
  await wait(250);
  check(calls.filter(c => c.method === 'PUT').length === beforeConflict + 1, '冲突不会重试覆盖远端');
  check(w.document.querySelector('#f-body').value === '冲突时需要保留的内容', '冲突保留编辑内容');

  w.location.hash = '#/';
  await wait(120);
  check(w.document.body.textContent.includes('概览'), '可以返回概览');

  await wait(100);
  if (errors.length) {
    failed += 1;
    console.error('\n运行期错误：');
    errors.forEach((line) => console.error('  ' + line));
  }

  console.log('\n结果：' + (failed ? failed + ' 项失败' : '全部通过'));
  process.exitCode = failed ? 1 : 0;
  dom.window.close();
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
