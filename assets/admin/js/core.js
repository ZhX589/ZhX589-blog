/*!
 * 后台核心：front matter 读写 + GitHub Contents / Git Data API。
 * 浏览器里挂到 window.Core，Node 里可以 require（便于本地测试）。
 */
(function (root, factory) {
  var mod = factory(root.jsyaml);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Core = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (yaml) {
  'use strict';

  if (!yaml) throw new Error('缺少 js-yaml，后台脚本加载顺序有误');

  var FM_ORDER = ['title', 'date', 'description', 'categories', 'tags', 'draft', 'lastmod', 'slug', 'menu', 'weight', 'params'];

  function pad(n) {
    n = String(n == null ? 0 : n);
    return n.length < 2 ? '0' + n : n;
  }

  /* ------------------------------------------------------------------------
     Front matter
     ------------------------------------------------------------------------ */

  function split(text) {
    text = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    var m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
    if (!m) return { hasFM: false, data: {}, raw: '', body: text };

    var data;
    try {
      data = yaml.load(m[1], { schema: yaml.CORE_SCHEMA });
    } catch (err) {
      throw new Error('front matter 解析失败：' + err.message);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    return { hasFM: true, data: data, raw: m[1], body: text.slice(m[0].length) };
  }

  function join(data, body) {
    var ordered = {};
    FM_ORDER.forEach(function (key) {
      if (data[key] !== undefined && data[key] !== null) ordered[key] = data[key];
    });
    Object.keys(data || {}).forEach(function (key) {
      if (ordered[key] === undefined && data[key] !== undefined && data[key] !== null) {
        ordered[key] = data[key];
      }
    });

    var head = yaml.dump(ordered, {
      schema: yaml.CORE_SCHEMA,
      lineWidth: -1,
      noRefs: true,
      skipInvalid: true,
      quotingType: '"',
      forceQuotes: false,
      sortKeys: false
    }).replace(/\n+$/, '');

    var text = String(body == null ? '' : body).replace(/^\n+/, '');
    return '---\n' + head + '\n---\n\n' + text;
  }

  function toList(value) {
    if (Array.isArray(value)) {
      return value.map(function (item) { return String(item).trim(); }).filter(Boolean);
    }
    if (value == null || value === '') return [];
    return [String(value).trim()];
  }

  function normalize(data) {
    var out = Object.assign({}, data || {});
    out.tags = toList(out.tags);
    out.categories = toList(out.categories);
    out.draft = out.draft === true || out.draft === 'true';
    if (out.date == null) out.date = '';
    return out;
  }

  function counts(items, key) {
    var map = Object.create(null);
    (items || []).forEach(function (item) {
      toList(item && item.data ? item.data[key] : []).forEach(function (name) {
        map[name] = (map[name] || 0) + 1;
      });
    });
    return Object.keys(map)
      .map(function (name) { return { name: name, count: map[name] }; })
      .sort(function (a, b) {
        return b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN');
      });
  }

  /* 只替换 tags/categories 这一段，保留其它字段的原始排版。 */
  function replaceTaxonomy(text, key, values) {
    var source = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    var m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
    if (!m) return text;

    var fm = m[1];
    var rest = source.slice(m[0].length);
    var block = yaml.dump({ [key]: values }, {
      schema: yaml.CORE_SCHEMA,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
      sortKeys: false
    }).replace(/\n+$/, '');

    var lines = fm.split(/\r?\n/);
    var start = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(key + ':') === 0) { start = i; break; }
    }

    if (start < 0) {
      fm = fm.replace(/\s+$/, '') + '\n' + block;
    } else {
      var end = start + 1;
      while (end < lines.length && /^[ \t]+\S/.test(lines[end])) end++;
      fm = lines.slice(0, start).concat(block.split('\n'), lines.slice(end)).join('\n');
    }

    return '---\n' + fm + '\n---\n' + rest;
  }

  /* ------------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------------ */

  function slugify(value) {
    return String(value == null ? '' : value)
      .normalize('NFKC')
      .replace(/^#+\s*/, '')
      .replace(/&amp;/g, ' ')
      .replace(/[\\/:*?"<>|#%{}^~\[\]`;&',.!?，。！？、；：“”‘’（）【】《》]/g, ' ')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
      .replace(/-+$/g, '');
  }

  function parseDate(value) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(
      String(value == null ? '' : value).trim()
    );
    if (!m) return null;
    return {
      y: m[1], mo: pad(m[2]), d: pad(m[3]),
      h: pad(m[4] || 0), mi: pad(m[5] || 0), s: pad(m[6] || 0)
    };
  }

  function toInputDate(value) {
    var p = parseDate(value);
    return p ? p.y + '-' + p.mo + '-' + p.d + 'T' + p.h + ':' + p.mi : '';
  }

  function fromInputDate(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value || ''));
    return m ? m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + ':00' : '';
  }

  function nowDate() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function b64encodeBytes(bytes) {
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function b64encode(text) {
    return b64encodeBytes(new TextEncoder().encode(String(text == null ? '' : text)));
  }

  function b64decode(value) {
    var binary = atob(String(value == null ? '' : value).replace(/\s/g, ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encodePath(path) {
    return String(path)
      .split('/')
      .map(function (part) { return encodeURIComponent(part); })
      .join('/');
  }

  async function mapLimit(items, limit, fn) {
    var out = new Array(items.length);
    var index = 0;
    var size = Math.max(1, Math.min(limit || 1, items.length));
    var workers = new Array(size).fill(null).map(async function () {
      while (index < items.length) {
        var current = index++;
        out[current] = await fn(items[current], current);
      }
    });
    await Promise.all(workers);
    return out;
  }

  /* ------------------------------------------------------------------------
     GitHub API
     ------------------------------------------------------------------------ */

  function GitHub(opts) {
    opts = opts || {};
    this.owner = opts.owner;
    this.repo = opts.repo;
    this.branch = opts.branch || 'main';
    this.token = opts.token || '';
  }

  GitHub.prototype.base = function () {
    return '/repos/' + this.owner + '/' + this.repo;
  };

  GitHub.prototype.request = async function (path, options) {
    options = options || {};
    var headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (this.token && options.auth !== false) headers.Authorization = 'Bearer ' + this.token;
    if (options.body) headers['Content-Type'] = 'application/json';

    var response = await fetch('https://api.github.com' + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (response.status === 204) return null;

    var text = await response.text();
    var data = null;
    try { data = text ? JSON.parse(text) : null; } catch (err) { data = null; }

    if (!response.ok) {
      var message = (data && data.message) || ('GitHub 返回 ' + response.status);
      if (response.status === 401) message = 'GitHub Token 无效或已过期';
      if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
        message = 'GitHub API 请求次数已用尽，请稍后再试';
      }
      var error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  };

  GitHub.prototype.getUser = function () {
    return this.request('/user');
  };

  GitHub.prototype.getRepo = function () {
    return this.request(this.base());
  };

  GitHub.prototype.getTree = function () {
    return this.request(this.base() + '/git/trees/' + encodeURIComponent(this.branch) + '?recursive=1');
  };

  GitHub.prototype.getFile = async function (path) {
    var data = await this.request(
      this.base() + '/contents/' + encodePath(path) + '?ref=' + encodeURIComponent(this.branch)
    );
    if (!data || data.type !== 'file') throw new Error('文件不存在：' + path);
    return { path: path, sha: data.sha, text: b64decode(data.content) };
  };

  GitHub.prototype.putFile = function (opts) {
    var body = {
      message: opts.message,
      content: b64encode(opts.text),
      branch: this.branch
    };
    if (opts.sha) body.sha = opts.sha;
    return this.request(this.base() + '/contents/' + encodePath(opts.path), {
      method: 'PUT',
      body: body
    });
  };

  GitHub.prototype.putBinary = function (opts) {
    return this.request(this.base() + '/contents/' + encodePath(opts.path), {
      method: 'PUT',
      body: {
        message: opts.message,
        content: opts.base64,
        branch: this.branch
      }
    });
  };

  GitHub.prototype.deleteFile = function (opts) {
    return this.request(this.base() + '/contents/' + encodePath(opts.path), {
      method: 'DELETE',
      body: { message: opts.message, sha: opts.sha, branch: this.branch }
    });
  };

  GitHub.prototype.getRuns = function (workflow, sha) {
    if (!workflow) throw new Error('未配置部署工作流');
    return this.request(
      this.base() + '/actions/workflows/' + encodeURIComponent(workflow) + '/runs?branch=' +
        encodeURIComponent(this.branch) + '&per_page=10' +
        (sha ? '&head_sha=' + encodeURIComponent(sha) : ''),
      { auth: false }
    );
  };

  /* 一次提交里改/删多个文件，用于重命名、合并标签。 */
  GitHub.prototype.commitFiles = async function (message, changes) {
    if (!changes || !changes.length) return null;

    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var ref = await this.request(this.base() + '/git/ref/heads/' + encodeURIComponent(this.branch));
        var head = ref.object.sha;
        var commit = await this.request(this.base() + '/git/commits/' + head);
        var current = await this.request(this.base() + '/git/trees/' + head + '?recursive=1');
        if (current.truncated) throw new Error('仓库目录不完整，已停止批量修改');
        var versions = {};
        (current.tree || []).forEach(function (item) { versions[item.path] = item.sha; });
        changes.forEach(function (change) {
          if (!change.sha || versions[change.path] !== change.sha) {
            throw new Error('批量修改冲突：' + change.path + ' 已变化，请刷新后重试');
          }
        });

        var tree = [];
        for (var i = 0; i < changes.length; i++) {
          var change = changes[i];
          if (change.content == null) {
            tree.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
          } else {
            var blob = await this.request(this.base() + '/git/blobs', {
              method: 'POST',
              body: { content: b64encode(change.content), encoding: 'base64' }
            });
            tree.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
          }
        }

        var newTree = await this.request(this.base() + '/git/trees', {
          method: 'POST',
          body: { base_tree: commit.tree.sha, tree: tree }
        });
        var newCommit = await this.request(this.base() + '/git/commits', {
          method: 'POST',
          body: { message: message, tree: newTree.sha, parents: [head] }
        });
        await this.request(this.base() + '/git/refs/heads/' + encodeURIComponent(this.branch), {
          method: 'PATCH',
          body: { sha: newCommit.sha, force: false }
        });
        return newCommit;
      } catch (err) {
        if (attempt === 0 && (err.status === 409 || err.status === 422)) continue;
        throw err;
      }
    }
    return null;
  };

  return {
    split: split,
    join: join,
    toList: toList,
    normalize: normalize,
    counts: counts,
    replaceTaxonomy: replaceTaxonomy,
    slugify: slugify,
    parseDate: parseDate,
    toInputDate: toInputDate,
    fromInputDate: fromInputDate,
    nowDate: nowDate,
    b64encode: b64encode,
    b64encodeBytes: b64encodeBytes,
    b64decode: b64decode,
    encodePath: encodePath,
    mapLimit: mapLimit,
    GitHub: GitHub
  };
});
