import { escapeHtml, html } from '../ui/dom.js';

function formatMaybeDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('pt-BR');
  } catch {
    return '';
  }
}

export function renderProfile({ root, store, router }) {
  const state = store.getState();

  root.innerHTML = '';

  const profile = state.profile;

  const reportHistory = (state.myReports || []).slice(0, 30);
  const notes = (state.notifications || []).slice(0, 20);

  const el = html(`
    <section class="grid">
      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="row" style="justify-content:flex-start">
            <button id="backHome">← Voltar</button>
            <div style="flex:1"></div>
            <div class="badge">Perfil local</div>
          </div>
          <div style="height:10px"></div>
          <div class="title">Perfil</div>
          <div class="muted">Edição de nome, histórico completo e settings.</div>
        </div>

        <div class="card">
          <div class="title">Editar nome</div>
          <div class="muted">Atualiza o estado global (persistido).</div>
          <div style="height:12px"></div>
          <input id="nameInput" value="${escapeHtml(profile?.name)}" />
          <div style="height:12px"></div>
          <div class="row" style="justify-content:flex-start">
            <button id="saveName" class="primary">Salvar</button>
            <button id="resetState">Resetar tudo</button>
          </div>
          <div style="height:10px"></div>
          <div class="footer-note">Reset apaga o localStorage do app (simulado).</div>
        </div>

        <div style="height:14px"></div>

        <div class="card">
          <div class="title">Settings</div>
          <div class="muted">Preferências locais.</div>
          <div style="height:12px"></div>

          <label style="display:flex; gap:10px; align-items:center; padding:10px; border-radius:14px; border:1px solid rgba(167,215,191,.18); background: rgba(2,10,6,.12)">
            <input type="checkbox" id="notifEnabled" ${profile?.settings?.notificationsEnabled ? 'checked' : ''} style="accent-color:#35d07f" />
            <span style="font-weight:750">Notificações</span>
          </label>

          <div style="height:10px"></div>

          <label style="display:flex; gap:10px; align-items:center; padding:10px; border-radius:14px; border:1px solid rgba(167,215,191,.18); background: rgba(2,10,6,.12)">
            <input type="checkbox" id="reduceMotion" ${profile?.settings?.reduceMotion ? 'checked' : ''} style="accent-color:#35d07f" />
            <span style="font-weight:750">Reduzir animações</span>
          </label>

          <div style="height:12px"></div>
          <div class="row" style="justify-content:flex-start">
            <button id="saveSettings" class="primary">Aplicar</button>
          </div>
        </div>
      </div>

      <div class="right">
        <div class="card">
          <div class="title">Histórico</div>
          <div class="muted">Relatórios e notificações.</div>
          <div style="height:12px"></div>

          <div style="font-weight:900; margin-bottom:8px">Relatórios (${reportHistory.length})</div>
          <div class="list">
            ${(reportHistory.length
              ? reportHistory
                  .map(
                    (r) => `
                  <div class="item" style="padding:10px; background: rgba(2,10,6,.10)">
                    <div style="width:100%">
                      <div class="hdr">
                        <div style="font-weight:900">${escapeHtml(r.type).toUpperCase()}</div>
                        <div class="badge">${escapeHtml(r.status)}</div>
                      </div>
                      <div class="sub">${r.location || '-'} · ${formatMaybeDate(r.createdAt)}</div>
                      <div style="height:6px"></div>
                      <div class="sub" style="line-height:1.35">${escapeHtml((r.desc || '').slice(0, 120))}${(r.desc || '').length > 120 ? '…' : ''}</div>
                    </div>
                  </div>
                `
                  )
                  .join('')
              : `<div class="muted">Sem histórico ainda.</div>`)
              }
          </div>

          <div style="height:14px"></div>

          <div style="font-weight:900; margin-bottom:8px">Notificações (${notes.length})</div>
          <div class="list">
            ${notes
              .map(
                (n) => `
              <div class="item" style="padding:10px; background: rgba(2,10,6,.10)">
                <div style="width:100%">
                  <div class="hdr">
                    <div style="font-weight:900">${escapeHtml(n.title)}</div>
                    <div class="badge">${n.read ? 'lida' : 'nova'}</div>
                  </div>
                  <div class="sub">${formatMaybeDate(n.createdAt)}</div>
                  <div class="sub" style="margin-top:6px; line-height:1.35">${escapeHtml(n.body)}</div>
                  <div style="height:8px"></div>
                  <button data-notif-route="${n.route}" style="width:100%" ${n.read ? '' : ''}>Abrir</button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="card footer-note">
          <div style="font-weight:900; margin-bottom:6px">Settings effect</div>
          <div>Este protótipo respeita <code>reduceMotion</code> apenas em animações futuras (UI).</div>
        </div>
      </div>
    </section>
  `);

  root.appendChild(el);

  const backHomeBtn = root.querySelector('#backHome');
  if (backHomeBtn) backHomeBtn.onclick = () => router.navigate('/');

  // name
  const nameInput = root.querySelector('#nameInput');
  const saveNameBtn = root.querySelector('#saveName');
  if (nameInput && saveNameBtn) saveNameBtn.onclick = async () => {
    saveNameBtn.disabled = true;
    const result = await store.updateProfile({ name: nameInput.value });
    store.toast?.(result.ok ? 'Nome atualizado!' : result.error, result.ok ? 'ok' : 'danger');
    router.navigate('/profile');
  };

  // settings (persistidos via store)

  root.querySelector('#saveSettings').onclick = () => {
    const notifEnabled = !!root.querySelector('#notifEnabled').checked;
    const reduceMotion = !!root.querySelector('#reduceMotion').checked;
    store.updateSettings({ notificationsEnabled: notifEnabled, reduceMotion });
    store.toast?.('Settings atualizados!', 'ok');
    router.navigate('/profile');
  };

  root.querySelector('#resetState').onclick = () => {
    try {
      localStorage.removeItem('guardioes_natureza_state_v1');
    } catch {}
    router.navigate('/');
    location.reload();
  };

  // notifications open + mark read
  for (const btn of root.querySelectorAll('[data-notif-route]')) {
    btn.onclick = () => {
      const route = btn.getAttribute('data-notif-route');
      // find corresponding notification by route+first unread
      const n = store.getState().notifications.find((x) => x.route === route && !x.read) ?? store.getState().notifications.find((x) => x.route === route);
      if (n) store.markNotificationRead(n.id);
      router.navigate(route || '/');
    };
  }
}

