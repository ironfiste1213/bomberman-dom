/**
 * ROUTER.JS
 * 
 * Purpose: Synchronize URL (hash or history pathname) with application state
 */

let mode = 'hash'; // 'hash' or 'history'
let onRouteChanged = () => { };

const getBasePath = () => {
    let path = window.location.pathname;
    if (path.endsWith('.html')) {
        path = path.substring(0, path.lastIndexOf('/'));
    }
    if (!path.endsWith('/')) {
        path += '/';
    }
    return path.replace(/\/$/, '');
};

const getCurrentPathFromUrl = () => {
    if (mode === 'hash') {
        const hash = window.location.hash;
        if (!hash || hash === '#') return '/';
        let cleanHash = hash;
        if (cleanHash.startsWith('#')) cleanHash = cleanHash.substring(1);
        if (!cleanHash.startsWith('/')) cleanHash = '/' + cleanHash;
        return cleanHash;
    } else {
        const base = getBasePath();
        const pathname = window.location.pathname;
        if (pathname.startsWith(base)) {
            let path = pathname.substring(base.length);
            if (!path.startsWith('/')) {
                path = '/' + path;
            }
            return path;
        }
        return pathname || '/';
    }
};

export const getMode = () => mode;

export const initRouter = (callback, options = {}) => {
    onRouteChanged = callback;
    if (options.mode === 'history' || options.mode === 'hash') {
        mode = options.mode;
    }

    const handleNavigation = () => {
        onRouteChanged(getCurrentPathFromUrl());
    };

    window.addEventListener('hashchange', () => {
        if (mode === 'hash') {
            handleNavigation();
        }
    });

    window.addEventListener('popstate', () => {
        if (mode === 'history') {
            handleNavigation();
        }
    });

    window.addEventListener('click', (e) => {
        if (mode !== 'history') return;

        let target = e.target;
        while (target && target.tagName !== 'A') {
            target = target.parentNode;
        }

        if (target && target.tagName === 'A') {
            const href = target.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('//')) {
                let path = href;
                if (path.startsWith('#')) {
                    path = path.substring(1) || '/';
                }
                
                const base = getBasePath();
                if (path.startsWith(base)) {
                    path = path.substring(base.length);
                }
                
                if (!path.startsWith('/')) {
                    path = '/' + path;
                }

                e.preventDefault();
                navigate(path);
            }
        }
    });

    // Handle initial route transition if URLs don't match the active mode
    const currentPath = getCurrentPathFromUrl();
    const base = getBasePath();
    if (mode === 'hash' && window.location.hash === '' && window.location.pathname !== base) {
        const pathFromHistory = window.location.pathname.substring(base.length) || '/';
        window.history.replaceState(null, '', base || '/');
        window.location.hash = '#' + pathFromHistory;
    } else if (mode === 'history' && window.location.hash.startsWith('#')) {
        const pathFromHash = window.location.hash.substring(1) || '/';
        window.history.replaceState(null, '', base + pathFromHash);
    }

    handleNavigation();
};

export const navigate = (path) => {
    if (!path.startsWith('/')) {
        path = '/' + path;
    }

    if (mode === 'hash') {
        window.location.hash = '#' + path;
    } else {
        const fullPath = getBasePath() + path;
        window.history.pushState(null, '', fullPath);
        onRouteChanged(path);
    }
};

export const getCurrentRoute = () => {
    return getCurrentPathFromUrl();
};

export const getLinkHref = (path) => {
    if (!path.startsWith('/')) {
        path = '/' + path;
    }
    if (mode === 'history') {
        return getBasePath() + path;
    } else {
        return '#' + path;
    }
};