export class Router {
  constructor({ mode = 'history', onRoute } = {}) {
    this.mode = mode;
    this.onRoute = onRoute;
    this._boundPop = this._onPopState.bind(this);
  }

  start() {
    window.addEventListener('popstate', this._boundPop);
    this._emit();
  }

  navigate(path) {
    const normalized = this._normalize(path);
    if (this.mode === 'history') {
      if (window.location.pathname !== normalized) {
        window.history.pushState({}, '', normalized);
      }
      this._emit(normalized);
    } else {
      // hash mode not used currently
      window.location.hash = normalized;
      this._emit();
    }
  }

  _onPopState() {
    this._emit();
  }

  _emit(pathOverride) {
    const path = pathOverride ?? this._normalize(window.location.pathname);
    this.onRoute?.({ path });
  }

  _normalize(path) {
    if (!path) return '/';
    let p = path;
    if (!p.startsWith('/')) p = '/' + p;
    // strip trailing slash except root
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
  }
}

