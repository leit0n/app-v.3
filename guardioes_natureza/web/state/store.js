import { persist, load } from './storage.js';
import { createInitialState } from './state.js';
import { safeUUID } from './uuid.js';

// Same-origin backend by default; override with window.GUARDIOES_API_BASE if the
// backend is served from a different host/port during development.
const API_BASE = globalThis.GUARDIOES_API_BASE ?? '';

export function createStore({ onToast } = {}) {
  const listeners = new Set();

  let state = load() ?? createInitialState();


  function getState() {
    return state;
  }

  function setState(partial) {
    state = { ...state, ...partial };
    persist(state);
    for (const l of listeners) l(state);
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function bootstrap() {
    const defaults = createInitialState();
    state.profile = { ...defaults.profile, ...(state.profile || {}), settings: { ...defaults.profile.settings, ...(state.profile?.settings || {}) } };
    state.notifications = Array.isArray(state.notifications) ? state.notifications : defaults.notifications;
    state.reports = Array.isArray(state.reports) ? state.reports : defaults.reports;
    state.myReports = Array.isArray(state.myReports) ? state.myReports : defaults.myReports;
    state.challenges = Array.isArray(state.challenges) ? state.challenges : defaults.challenges;
    state.mapFilters = { ...defaults.mapFilters, ...(state.mapFilters || {}), types: { ...defaults.mapFilters.types, ...(state.mapFilters?.types || {}) } };
    persist(state);
    for (const l of listeners) l(state);
    return Promise.all([
      fetch(`${API_BASE}/api/reports`).then((res) => (res.ok ? res.json() : null)),
      fetch(`${API_BASE}/api/reports?userId=${state.profile.userId}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`${API_BASE}/api/profile/${state.profile.userId}`).then((res) => (res.ok ? res.json() : null)),
    ]).then(([reportsPayload, myReportsPayload, profilePayload]) => {
      const next = {};
      if (Array.isArray(reportsPayload?.reports)) next.reports = reportsPayload.reports;
      if (Array.isArray(myReportsPayload?.reports)) next.myReports = myReportsPayload.reports;
      if (profilePayload?.nickname) next.profile = { ...state.profile, name: profilePayload.nickname };
      if (Object.keys(next).length) setState(next);
      return getState();
    }).catch(() => getState());
  }

  // Actions
  function markNotificationRead(id) {
    const n = state.notifications.map((x) => (x.id === id ? { ...x, read: true, readAt: Date.now() } : x));
    setState({ notifications: n });
  }

  function addNotification(note) {
    setState({ notifications: [note, ...state.notifications].slice(0, 20) });
  }

  async function updateProfile({ name }) {
    const clean = (name ?? '').toString().trim();
    if (!clean) return { ok: false, error: 'Indique um nome.' };
    try {
      const res = await fetch(`${API_BASE}/api/profile/${state.profile.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'Não foi possível atualizar o perfil.' };
      setState({ profile: { ...state.profile, name: data.nickname } });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Sem ligação ao servidor.' };
    }
  }

  function updateSettings({ notificationsEnabled, reduceMotion } = {}) {
    setState({
      profile: {
        ...state.profile,
        settings: {
          ...(state.profile?.settings || {}),
          notificationsEnabled: !!(notificationsEnabled ?? state.profile?.settings?.notificationsEnabled),
          reduceMotion: !!(reduceMotion ?? state.profile?.settings?.reduceMotion),
        },
      },
    });
  }


  function bumpChallengesForReport(report) {
    const challenges = state.challenges.map((c) => {
      if (c.id === 'report_eco') {
        const newValue = Math.min(c.target, c.value + 1);
        return { ...c, value: newValue, completed: newValue >= c.target };
      }
      if (c.id === 'first_report') {
        if (c.completed) return c;
        return { ...c, value: 1, completed: true };
      }
      if (c.id === 'photo_report') {
        const inc = report.hasPhoto ? 1 : 0;
        const newValue = Math.min(c.target, c.value + inc);
        return { ...c, value: newValue, completed: newValue >= c.target };
      }
      return c;
    });
    setState({ challenges });
  }

  // Submits a report to the real backend (POST /api/reports) and reflects
  // the actual server response in local state. Returns a promise that
  // resolves to { ok: true, report, authority } or { ok: false, error }.
  async function addReport({ type, location, desc, photoDataUrl, latitude, longitude, accuracy, userId }) {
    const localId = safeUUID();
    const report = {
      id: localId,
      type,
      location,
      desc,
      hasPhoto: !!photoDataUrl,
      createdAt: Date.now(),
      status: 'a_enviar',
    };

    const reports = [report, ...state.reports];
    setState({ reports });

    try {
      const res = await fetch(`${API_BASE}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId ?? state.profile?.userId ?? null,
          latitude,
          longitude,
          accuracy,
          category: type,
          location,
          description: desc,
          photoDataUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const error = data?.error || `Erro ao enviar reporte (HTTP ${res.status}).`;
        const failed = state.reports.map((r) => (r.id === localId ? { ...r, status: 'falhou', error } : r));
        setState({ reports: failed });
        onToast?.(error, 'danger');
        return { ok: false, error };
      }

      const confirmed = state.reports.map((r) =>
        r.id === localId
          ? {
              ...r,
              status: 'encaminhado',
              serverReportId: data.reportId,
              authorityName: data.encaminhadoPara,
              authorityContact: data.contactoAlvo,
              createdAt: data.createdAt || r.createdAt,
            }
          : r
      );
      const confirmedReport = confirmed.find((r) => r.id === localId);
      setState({ reports: confirmed, myReports: [confirmedReport, ...(state.myReports || [])] });

      bumpChallengesForReport(report);

      addNotification({
        id: safeUUID(),
        title: 'Relatório encaminhado!',
        body: `O seu reporte de ${type} foi enviado a ${data.encaminhadoPara}. Vão entrar em contacto via ${data.contactoAlvo}.`,
        createdAt: Date.now(),
        read: false,
        route: '/challenges',
      });

      onToast?.('Reporte enviado com sucesso!', 'ok');
      return { ok: true, report: confirmed.find((r) => r.id === localId), authority: { name: data.encaminhadoPara, contact: data.contactoAlvo } };
    } catch (err) {
      const error = 'Sem ligação ao servidor. Verifique a sua rede e tente novamente.';
      const failed = state.reports.map((r) => (r.id === localId ? { ...r, status: 'falhou', error } : r));
      setState({ reports: failed });
      onToast?.(error, 'danger');
      return { ok: false, error };
    }
  }

  function setMapFilters(filters) {
    setState({ mapFilters: { ...state.mapFilters, ...filters } });
  }

  return {
    getState,
    subscribe,
    markNotificationRead,
    addNotification,
    updateProfile,
    updateSettings,
    addReport,
    setMapFilters,
    toast: onToast,
  };
}

