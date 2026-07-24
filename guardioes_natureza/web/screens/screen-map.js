import { html, escapeHtml } from '../ui/dom.js';
import { safeUUID } from '../state/uuid.js';

const ICONS = {
  desmatamento: '🌳',
  lixo: '🗑️',
  incendio: '🔥',
};

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString('pt-BR');
  } catch {
    return '';
  }
}

export function renderMap({ root, store, router }) {
  const state = store.getState();

  const seededHotspots = [
    { id: 'h1', type: 'lixo', label: 'Resíduos na margem', x: 18, y: 32, lat: 37.7412, lng: -25.6756 },
    { id: 'h2', type: 'desmatamento', label: 'Área desmatada', x: 62, y: 45, lat: 37.7891, lng: -25.5011 },
    { id: 'h3', type: 'incendio', label: 'Foco de incêndio', x: 45, y: 70, lat: 37.7633, lng: -25.4021 },
  ];
  const persistedHotspots = (state.reports || [])
    .filter((report) => Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude)))
    .map((report, index) => ({
      id: `report-${report.id}`,
      type: report.type,
      label: report.location || 'Ocorrência reportada',
      lat: Number(report.latitude),
      lng: Number(report.longitude),
      x: 20 + ((index * 23) % 60),
      y: 25 + ((index * 17) % 55),
      createdAt: report.createdAt,
    }));
  const hotspots = persistedHotspots.length ? persistedHotspots : seededHotspots;

  const { types, onlyNearby } = state.mapFilters;
  const enabledTypes = Object.entries(types).filter(([, v]) => !!v).map(([k]) => k);

  const filtered = hotspots.filter((h) => enabledTypes.includes(h.type));
  // onlyNearby: simulate with deterministic filter (keep those on left side)
  const filtered2 = onlyNearby ? filtered.filter((h) => h.x < 55) : filtered;

  root.innerHTML = '';

  const list = filtered2
    .map(
      (h) => `
        <div class="item">
          <div class="dot" style="background: rgba(53,208,127,.85)"></div>
          <div style="width:100%">
            <div class="hdr">
              <div style="font-weight:900">${ICONS[h.type] ?? '📍'} ${escapeHtml(h.label)}</div>
              <div class="badge">${h.type}</div>
            </div>
            <div class="sub">Popups clicáveis · ${formatTime(h.createdAt)}</div>
            <div style="height:10px"></div>
            <button class="primary" data-hotspot-id="${h.id}">Reportar aqui</button>
          </div>
        </div>
      `
    )
    .join('');

  const el = html(`
    <section class="grid">
      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="title">Mapa</div>
          <div class="muted">Ocorrências guardadas na base de dados. Clique no mapa para reportar uma nova localização.</div>
          <div style="height:12px"></div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <div style="flex:1 1 220px">
              <label style="display:block; font-size:12px; color:var(--muted); margin-bottom:6px">Tipos</label>
              <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px">
                ${['desmatamento','lixo','incendio']
                  .map(
                    (t) => `
                  <label style="display:flex; gap:10px; align-items:center; padding:10px; border-radius:14px; border:1px solid rgba(167,215,191,.18); background: rgba(2,10,6,.12)">
                    <input type="checkbox" data-type="${t}" ${types[t] ? 'checked' : ''} style="accent-color: #35d07f" />
                    <span>${ICONS[t] ?? '📍'} ${t}</span>
                  </label>
                `
                  )
                  .join('')}
              </div>
            </div>
            <div style="flex:1 1 180px">
              <label style="display:block; font-size:12px; color:var(--muted); margin-bottom:6px">Apenas próximos</label>
              <label style="display:flex; gap:10px; align-items:center; padding:10px; border-radius:14px; border:1px solid rgba(167,215,191,.18); background: rgba(2,10,6,.12)">
                <input type="checkbox" id="onlyNearby" ${onlyNearby ? 'checked' : ''} style="accent-color: #35d07f" />
                <span>Ativar</span>
              </label>
            </div>
          </div>
          <div style="height:12px"></div>
          <div class="row" style="justify-content:flex-start">
            <button id="applyFilters" class="primary">Aplicar filtros</button>
            <button id="resetFilters">Reset</button>
          </div>
        </div>

        <div class="card" style="overflow:hidden">
          <div class="title">Popups</div>
          <div class="muted">Clique em um hotspot no mapa.</div>
          <div style="height:12px"></div>
          <div id="mapCanvas" style="position:relative; height:360px; border-radius:18px; border:1px solid rgba(53,208,127,.18); background:
            radial-gradient(600px 300px at 20% 10%, rgba(53,208,127,.14), transparent),
            linear-gradient(180deg, rgba(14,47,33,.35), rgba(2,10,6,.12))">
            ${filtered2
              .map(
                (h) => `
                <button class="pin" data-hotspot-id="${h.id}" 
                  style="position:absolute; left:${h.x}%; top:${h.y}%; transform: translate(-50%,-100%); 
                    width:44px; height:44px; border-radius:16px; 
                    background: rgba(53,208,127,.18); border:1px solid rgba(53,208,127,.55);
                    color:var(--text); font-size:20px; font-weight:900; line-height:44px; 
                    display:flex; align-items:center; justify-content:center">
                  <span>${ICONS[h.type] ?? '📍'}</span>
                </button>
              `
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="right">
        <div class="card">
          <div class="title">Hotspots (filtrados)</div>
          <div class="muted">Lista para reportar com 1 clique.</div>
          <div style="height:12px"></div>
          <div class="list">${list || `<div class="muted">Sem resultados para os filtros atuais.</div>`}</div>
        </div>
        <div class="card footer-note">
          <div style="font-weight:900; margin-bottom:6px">Dica</div>
          <div>Os filtros atualizam o estado global e afetam a lista + popups.</div>
        </div>
      </div>
    </section>
  `);

  root.appendChild(el);

  const rerender = () => router.navigate('/map');

  // apply filters
  root.querySelector('#applyFilters').onclick = () => {
    const boxes = [...root.querySelectorAll('input[type="checkbox"][data-type]')];
    const typesNext = { ...store.getState().mapFilters.types };
    for (const b of boxes) typesNext[b.getAttribute('data-type')] = !!b.checked;

    const onlyNearby = !!root.querySelector('#onlyNearby')?.checked;

    store.setMapFilters({ types: typesNext, onlyNearby });
    rerender();
  };

  root.querySelector('#resetFilters').onclick = () => {
    store.setMapFilters({
      types: { desmatamento: true, lixo: true, incendio: true },
      onlyNearby: false,
    });
    rerender();
  };

  // pin click -> report flow with selected hotspot
  function startReportFromHotspot(hid) {
    const h = hotspots.find((x) => x.id === hid);
    if (!h) return;
    store.addNotification({
      id: safeUUID(),
      title: 'A preparar reporte…',
      body: `Selecionou: ${h.label}. Finalize o processo em “Reportar”.`,
      createdAt: Date.now(),
      read: false,
      route: '/report',
    });
    store.toast?.('Hotspot selecionado!', 'ok');
    store.setMapFilters({
      lastHotspot: { id: h.id, type: h.type, label: h.label, lat: h.lat, lng: h.lng },
    });
    router.navigate('/report');
  }

  const mapCanvas = root.querySelector('#mapCanvas');
  if (window.L) {
    mapCanvas.innerHTML = '';
    const initial = filtered2[0] || { lat: 37.75, lng: -25.55 };
    const liveMap = window.L.map(mapCanvas).setView([initial.lat, initial.lng], 10);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(liveMap);
    for (const hotspot of filtered2) {
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = hotspot.label;
      popup.append(title, document.createElement('br'), document.createTextNode(hotspot.type));
      window.L.marker([hotspot.lat, hotspot.lng]).addTo(liveMap)
        .bindPopup(popup)
        .on('click', () => startReportFromHotspot(hotspot.id));
    }
    liveMap.on('click', (event) => {
      const manual = { id: 'map-click', type: 'lixo', label: 'Ponto selecionado no mapa', lat: event.latlng.lat, lng: event.latlng.lng };
      store.setMapFilters({ lastHotspot: manual });
      router.navigate('/report');
    });
  }

  // dataset wiring
  for (const btn of root.querySelectorAll('[data-hotspot-id]')) {
    btn.onclick = () => startReportFromHotspot(btn.getAttribute('data-hotspot-id'));
  }
}

