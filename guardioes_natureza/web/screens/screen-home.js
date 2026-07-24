import { html, escapeHtml } from '../ui/dom.js';

export function renderHome({ root, store, router }) {
  const state = store.getState();

  const unreadCount = state.notifications.filter((n) => !n.read).length;
  const nextN = state.notifications.find((n) => !n.read) ?? state.notifications[0];

  root.innerHTML = '';

  const el = html(`
    <section class="grid">
      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="title" style="font-size:22px; margin:0 0 6px">Dashboard</div>
          <div class="muted" style="margin-bottom:12px">Notificações reais + atalhos para sua jornada.</div>
          <div class="kpi">
            <div class="big">${unreadCount}</div>
            <div>
              <div style="font-weight:900">Notificações</div>
              <div class="small">Não lidas</div>
              <div class="small" style="margin-top:6px">Troféus e progresso em “Desafios”.</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="title">Próxima missão</div>
          <div class="muted" id="homeMissionDesc">${escapeHtml(nextN?.body ?? '')}</div>
          <div style="height:12px"></div>
          <div class="row" style="justify-content:flex-start">
            <button id="homeMissionBtn" class="primary">Abrir</button>
            <button id="markAllBtn">Marcar tudo como lido</button>
          </div>
        </div>
      </div>

      <div class="right">
        <div class="card">
          <div class="title">Atalhos</div>
          <div class="list">
            <div class="item">
              <div class="dot"></div>
              <div style="width:100%">
                <div class="hdr">
                  <div style="font-weight:900">Mapa</div>
                  <div class="badge">cliques</div>
                </div>
                <div class="sub">Clique em um popup para reportar.</div>
                <div style="height:10px"></div>
                <button id="goMap">Ir ao mapa</button>
              </div>
            </div>
            <div class="item">
              <div class="dot" style="background: rgba(167,215,191,.7)"></div>
              <div style="width:100%">
                <div class="hdr">
                  <div style="font-weight:900">Reportar</div>
                  <div class="badge">fluxo</div>
                </div>
                <div class="sub">Câmara simulada + confirmação.</div>
                <div style="height:10px"></div>
                <button id="goReport">Iniciar reporte</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card footer-note">
          <div style="font-weight:900; margin-bottom:6px">Estado global</div>
          <div>Persistência via <code>localStorage</code>. Atualiza as telas automaticamente.</div>
        </div>
      </div>
    </section>
  `);

  root.appendChild(el);

  const homeMissionBtn = root.querySelector('#homeMissionBtn');
  homeMissionBtn.onclick = () => {
    if (!nextN) return;
    store.markNotificationRead(nextN.id);
    router.navigate(nextN.route || '/challenges');
  };

  const markAllBtn = root.querySelector('#markAllBtn');
  markAllBtn.onclick = () => {
    const ids = store.getState().notifications.filter((n) => !n.read).map((n) => n.id);
    for (const id of ids) store.markNotificationRead(id);
  };

  root.querySelector('#goMap').onclick = () => router.navigate('/map');
  root.querySelector('#goReport').onclick = () => router.navigate('/report');
}

