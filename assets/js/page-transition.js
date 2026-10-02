/**
 * Swup-style leave transition for a static (multi-page) Hugo site.
 *
 * Fuwari fades the outgoing view out through Swup. Without a SPA router we do
 * the equivalent: intercept eligible same-origin link clicks, play a short
 * fade-out, then hand off to the browser. Everything degrades safely — if this
 * script never runs, links simply navigate normally.
 */
(() => {
    const root = document.documentElement;
    const LEAVE_CLASS = 'is-leaving';
    const LEAVE_MS = 170;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let leaving = false;
    let navigationTimer;
    let recoveryTimer;

    // Restore visibility on history navigation, or if a navigation is cancelled.
    function restore() {
        window.clearTimeout(navigationTimer);
        window.clearTimeout(recoveryTimer);
        leaving = false;
        root.classList.remove(LEAVE_CLASS);
    }
    window.addEventListener('pageshow', restore);

    function isEligible(event, link) {
        if (event.defaultPrevented || event.button !== 0) return false;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
        if (link.hasAttribute('download') || link.hasAttribute('data-no-transition')) return false;

        const target = link.getAttribute('target');
        if (target && target !== '_self') return false;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return false;

        let url;
        try {
            url = new URL(link.href, window.location.href);
        } catch (_) {
            return false;
        }

        if (!['http:', 'https:'].includes(url.protocol)) return false;
        if (url.origin !== window.location.origin) return false;
        // Leave feeds and files to the browser (some open without unloading).
        if (/\.[^/]+$/.test(url.pathname) && !/\.html?$/i.test(url.pathname)) return false;

        // Same document: let the browser handle in-page anchors natively.
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
            return false;
        }

        return true;
    }

    document.addEventListener('click', (event) => {
        const target = event.target;
        const link = target instanceof Element ? target.closest('a[href]') : null;
        if (!link || !isEligible(event, link)) return;

        const destination = link.href;
        event.preventDefault();

        if (leaving) return;

        if (reducedMotion.matches) {
            window.location.href = destination;
            return;
        }

        leaving = true;
        root.classList.add(LEAVE_CLASS);
        navigationTimer = window.setTimeout(() => {
            // If the browser stays here (e.g. a cancelled request), never leave
            // the document permanently invisible.
            recoveryTimer = window.setTimeout(restore, 1500);
            window.location.href = destination;
        }, LEAVE_MS);
    });
})();
