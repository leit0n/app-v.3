// Shell + Router + Estado global (SPA)
import { createStore } from './state/store.js';
import { Router } from './router/router.js';

import { renderHome } from './screens/screen-home.js';
import { renderMap } from './screens/screen-map.js';
import { renderReport } from './screens/screen-report.js';
import { renderChallenges } from './screens/screen-challenges.js';
import { renderProfile } from './screens/screen-profile.js';

const root = document.getElementById('app');
const toastEl = document.getElementById('toast');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: app still works without offline support.
    });
  });
}

function toast(msg, tone = 'ok') {
  toastEl.textContent = msg;
  toastEl.style.borderColor = tone === 'danger' ? 'rgba(255,77,77,.45)' : 'rgba(53,208,127,.25)';
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

const store = createStore({
  onToast: toast,
});

const router = new Router({
  mode: 'history',
  onRoute: ({ path }) => {
    switch (path) {
      case '/':
        renderHome({ root, store, router });
        break;
      case '/map':
        renderMap({ root, store, router });
        break;
      case '/report':
        renderReport({ root, store, router });
        break;
      case '/challenges':
        renderChallenges({ root, store, router });
        break;
      case '/profile':
        renderProfile({ root, store, router });
        break;
      default:
        renderHome({ root, store, router });
    }
  },
});

// Nav wiring
function wireNav() {
  const nav = document.getElementById('nav');
  nav.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-route]');
    if (!tab) return;
    const route = tab.getAttribute('data-route');
    router.navigate(route);
  });
}
wireNav();

// Initial auth-free state + mount
router.start();
store.bootstrap().finally(() => router.navigate(window.location.pathname));

