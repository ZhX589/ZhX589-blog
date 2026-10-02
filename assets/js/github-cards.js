(() => {
    const cards = document.querySelectorAll('[data-github-repo]');
    const requests = new Map();
    const ttl = 60 * 60 * 1000;
    const formatter = new Intl.NumberFormat('zh-CN');

    function readCache(repo) {
        try {
            const value = JSON.parse(sessionStorage.getItem(`github-card:${repo}`));
            if (value && Date.now() - value.time < ttl && value.data) return value.data;
        } catch (_) { /* Storage may be unavailable. */ }
        return null;
    }

    async function loadRepo(repo) {
        const cached = readCache(repo);
        if (cached) return cached;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(`https://api.github.com/repos/${repo}`, {
                headers: { Accept: 'application/vnd.github+json' },
                signal: controller.signal,
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
            if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
            const data = await response.json();
            if (typeof data.stargazers_count !== 'number' || typeof data.forks_count !== 'number') {
                throw new Error('Invalid repository response');
            }
            const details = {
                description: typeof data.description === 'string' ? data.description : '',
                stars: data.stargazers_count,
                forks: data.forks_count,
                license: data.license?.spdx_id === 'NOASSERTION'
                    ? (data.license.name || '未指定')
                    : (data.license?.spdx_id || '未指定'),
            };
            try {
                sessionStorage.setItem(`github-card:${repo}`, JSON.stringify({ time: Date.now(), data: details }));
            } catch (_) { /* Quota or privacy settings must not break cards. */ }
            return details;
        } finally {
            clearTimeout(timeout);
        }
    }

    cards.forEach((card) => {
        const repo = card.dataset.githubRepo;
        if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(repo)) return;
        const status = card.querySelector('[data-repo-status]');
        status.textContent = '加载中…';
        if (!requests.has(repo)) requests.set(repo, loadRepo(repo));
        requests.get(repo).then((data) => {
            if (data.description) card.querySelector('[data-repo-description]').textContent = data.description;
            card.querySelector('[data-repo-stars]').textContent = formatter.format(data.stars);
            card.querySelector('[data-repo-forks]').textContent = formatter.format(data.forks);
            card.querySelector('[data-repo-license]').textContent = data.license;
            status.textContent = 'GitHub';
        }).catch(() => {
            status.textContent = '点击查看详情';
        });
    });
})();
