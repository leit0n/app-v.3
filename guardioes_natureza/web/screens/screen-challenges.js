import { html, escapeHtml } from '../ui/dom.js';

function pct(c) {
  if (!c.target) return 0;
  return Math.round((c.value / c.target) * 100);
}

function formatMaybeDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('pt-BR');
  } catch {
    return '';
  }
}

function trophyList(challenges) {
  const done = challenges.filter((c) => c.completed);
  if (!done.length) return 'Nenhum troféu ainda — continue!';
  return done.map((c) => c.trophy).join('  ');
}

export function renderChallenges({ root, store, router }) {
  const state = store.getState();
  root.innerHTML = '';

  const challenges = state.challenges;

  const completedCount = challenges.filter((c) => c.completed).length;
  const totalCount = challenges.length;

  const el = html(`
    <section class="grid">
      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="row" style="justify-content:flex-start">
            <button id="backHome">← Voltar</button>
            <div style="flex:1"></div>
            <div class="badge">Progresso: ${completedCount}/${totalCount}</div>
          </div>
          <div style="height:10px"></div>
          <div class="title">Desafios</div>
          <div class="muted">Progresso real + troféus desbloqueáveis.</div>
        </div>

        <div class="list">
          ${challenges
            .map(
              (c) => `
            <div class="item" style="align-items:stretch">
              <div class="dot" style="background: rgba(53,208,127,${c.completed ? '.95' : '.6'})"></div>
              <div style="width:100%">
                <div class="hdr">
                  <div style="font-weight:900">${c.title} <span style="margin-left:10px; opacity:${c.completed ? 1 : .35}">${c.trophy}</span></div>
                  <div class="badge">${pct(c)}%</div>
                </div>
                <div class="sub">${c.description}</div>
                <div style="height:12px"></div>
                <div style="height:12px; border-radius:999px; border:1px solid rgba(167,215,191,.18); background: rgba(2,10,6,.15); overflow:hidden">
                  <div style="height:100%; width:${pct(c)}%; background: rgba(53,208,127,.6); transition: width .35s ease"></div>
                </div>
                <div class="sub" style="margin-top:8px">${c.value}/${c.target} · ${c.completed ? 'Completado!' : 'Em progresso'}</div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="right">
        <div class="card">
          <div class="title">Troféus</div>
          <div class="muted">Desbloqueados conforme você envia reportes.</div>
          <div style="height:12px"></div>
          <div style="font-size:30px; font-weight:900; letter-spacing:.5px">${trophyList(challenges)}</div>
          <div style="height:12px"></div>
          <div class="footer-note" style="color:rgba(167,215,191,.95)">
            Cada reporte atualiza desafios automaticamente.
          </div>
        </div>

        <div class="card footer-note">
          <div style="font-weight:900; margin-bottom:6px">Atalhos</div>
          <div style="display:flex; flex-direction:column; gap:10px">
            <button id="goMap" class="primary">Abrir mapa</button>
            <button id="goReport">Fazer novo reporte</button>
          </div>
        </div>

        <div class="card footer-note">
          <div style="font-weight:900; margin-bottom:6px">Últimos reportes</div>
          <div class="muted">Baseado no estado global</div>
          <div style="height:10px"></div>
          <div class="list">
            ${(state.myReports.slice(0, 4) || [])
              .map(
                (r) => `
                  <div class="item" style="padding:10px; background: rgba(2,10,6,.10)">
                    <div style="width:100%">
                      <div class="hdr">
                        <div style="font-weight:900">${escapeHtml(r.type).toUpperCase()}</div>
                        <div class="badge">${escapeHtml(r.status)}</div>
                      </div>
                      <div class="sub">${escapeHtml(r.location || '-')} · ${formatMaybeDate(r.createdAt)}</div>
                    </div>
                  </div>
                `
              )
              .join('') || `<div class="muted">Sem reportes ainda.</div>`}
          </div>
        </div>
      </div>
    </section>
  `);

  root.appendChild(el);

  root.querySelector('#backHome').onclick = () => router.navigate('/');
  root.querySelector('#goMap').onclick = () => router.navigate('/map');
  root.querySelector('#goReport').onclick = () => router.navigate('/report');
}

