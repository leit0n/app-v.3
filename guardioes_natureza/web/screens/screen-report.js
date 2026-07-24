import { html } from '../ui/dom.js';

const REPORT_TYPES = [
  { id: 'lixo', label: 'Lixo' },
  { id: 'desmatamento', label: 'Desmatamento' },
  { id: 'incendio', label: 'Incêndio' },
];

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString('pt-BR');
  } catch {
    return '';
  }
}

function drawSimulatedCameraFrame(canvas, { seed = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // background
  ctx.fillStyle = '#04120c';
  ctx.fillRect(0, 0, w, h);

  // noise-ish gradient
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `rgba(53,208,127,${0.16 + (seed % 7) * 0.01})`);
  g.addColorStop(1, 'rgba(2,10,6,.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // scanlines
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  for (let y = 0; y < h; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y + (seed % 3));
    ctx.lineTo(w, y + (seed % 3));
    ctx.stroke();
  }

  // vignette
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.55, h * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();

  // overlay HUD
  ctx.fillStyle = 'rgba(53,208,127,.85)';
  ctx.font = '700 13px system-ui, Segoe UI';
  ctx.fillText('CÂMARA SIMULADA', 16, 28);
  ctx.fillStyle = 'rgba(167,215,191,.9)';
  ctx.font = '600 12px system-ui, Segoe UI';
  ctx.fillText(`Captura: #${seed}`, 16, 50);

  // fake focus rect
  ctx.strokeStyle = 'rgba(53,208,127,.6)';
  ctx.lineWidth = 2;
  const rw = Math.floor(w * 0.6);
  const rh = Math.floor(h * 0.45);
  const rx = Math.floor((w - rw) / 2);
  const ry = Math.floor((h - rh) / 2);
  ctx.strokeRect(rx, ry, rw, rh);

  // marker
  ctx.beginPath();
  ctx.arc(w * 0.68, h * 0.35, 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(53,208,127,.9)';
  ctx.fill();
}

export function renderReport({ root, store, router }) {
  const state = store.getState();
  root.innerHTML = '';

  const selected = state.mapFilters?.lastHotspot ?? null;
  const pickedType = selected?.type ?? REPORT_TYPES[0].id;

  let seed = Math.floor(Math.random() * 9000) + 1000;

  const el = html(`
    <section class="grid">
      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="title">Reportar</div>
          <div class="muted">Registe os detalhes, a localização e uma fotografia antes de enviar.</div>
          <div style="height:12px"></div>
          <div class="row" style="justify-content:flex-start">
            <button id="backHome">← Voltar</button>
            <div class="badge">Status: <span id="reportStatus">preparando</span></div>
          </div>
        </div>

        <div class="card">
          <div class="title">1) Detalhes</div>
          <div class="muted">Preencha e avance para a captura.</div>
          <div style="height:12px"></div>

          <label style="display:block; font-size:12px; color:var(--muted); margin-bottom:6px">Tipo</label>
          <select id="typeSelect">
            ${REPORT_TYPES.map((t) => `<option value="${t.id}" ${t.id === pickedType ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>

          <div style="height:12px"></div>

          <label style="display:block; font-size:12px; color:var(--muted); margin-bottom:6px">Local</label>
          <input id="locationInput" placeholder="Ex: Rua X / Ponto de referência" value="${selected ? 'Ponto selecionado no mapa' : 'Perto de um ecoponto'}" />

          <div style="height:12px"></div>

          <label style="display:block; font-size:12px; color:var(--muted); margin-bottom:6px">Descrição</label>
          <textarea id="descInput" rows="3" placeholder="Descreva o que viu" style="resize: vertical">${selected ? 'Há evidências visíveis no local.' : ''}</textarea>

          <div style="height:14px"></div>
          <div class="row" style="justify-content:flex-start">
            <button class="primary" id="goCamera">Avançar para captura</button>
          </div>
        </div>

        <div style="height:14px"></div>

        <div class="card">
          <div class="title">Localização (GPS)</div>
          <div class="muted">Necessária para encaminhar o reporte à autoridade certa.</div>
          <div style="height:12px"></div>
          <div class="row" style="justify-content:flex-start">
            <button id="getLocationBtn">📍 Obter localização atual</button>
          </div>
          <div style="height:10px"></div>
          <div class="muted" id="locationStatus">${selected ? `Hotspot selecionado no mapa: ${selected.label}.` : 'Ainda sem localização.'}</div>
          <div style="height:10px"></div>
          <details>
            <summary class="muted" style="cursor:pointer">Inserir coordenadas manualmente</summary>
            <div style="height:10px"></div>
            <div style="display:flex; gap:10px; flex-wrap:wrap">
              <input id="latInput" placeholder="Latitude" style="flex:1 1 140px" />
              <input id="lngInput" placeholder="Longitude" style="flex:1 1 140px" />
              <button id="useManualLoc" style="flex:0 0 auto">Usar</button>
            </div>
          </details>
        </div>
      </div>

      <div class="right">
        <div class="card">
          <div class="title">2) Fotografia</div>
          <div class="muted">Use a câmara do dispositivo ou a captura de demonstração.</div>
          <div style="height:12px"></div>

          <div style="border-radius:18px; overflow:hidden; border:1px solid rgba(53,208,127,.18); background: rgba(2,10,6,.12)">
            <video id="camVideo" autoplay playsinline style="width:100%; display:none"></video>
            <canvas id="cam" width="420" height="260" style="width:100%; display:block"></canvas>
          </div>
          <div style="height:12px"></div>

          <div class="row" style="justify-content:flex-start">
            <button id="startCameraBtn">Ativar câmara</button>
            <button id="captureBtn">Capturar</button>
            <button id="usePhotoBtn" disabled>Usar captura</button>
          </div>
          <div style="height:12px"></div>
          <div class="muted" id="photoHint">Sem captura ainda.</div>
          <div style="height:12px"></div>
          <div class="card" style="padding:12px; background: rgba(2,10,6,.12)">
            <div style="font-weight:900; margin-bottom:6px">Confirmação</div>
            <div class="muted" id="confirmSummary"></div>
            <div style="height:10px"></div>
            <button id="submitBtn" class="primary" disabled>Enviar reporte</button>
          </div>
        </div>

        <div class="card footer-note">
          <div style="font-weight:900; margin-bottom:6px">Animação</div>
          <div>Ao enviar: transição + estado do reporte.</div>
        </div>
      </div>
    </section>
  `);

  root.appendChild(el);

  const cam = root.querySelector('#cam');
  const ctx = cam.getContext('2d');
  const camVideo = root.querySelector('#camVideo');

  // initial frame
  const seedStart = seed;
  drawSimulatedCameraFrame(cam, { seed: seedStart });

  const typeSelect = root.querySelector('#typeSelect');
  const locationInput = root.querySelector('#locationInput');
  const descInput = root.querySelector('#descInput');

  const reportStatus = root.querySelector('#reportStatus');

  let photoDataUrl = null;
  let mediaStream = null;

  // Real coordinates the report will actually be sent with.
  let geo = selected ? { latitude: selected.lat, longitude: selected.lng, accuracy: 15, source: 'hotspot' } : null;

  const locationStatusEl = root.querySelector('#locationStatus');
  const getLocationBtn = root.querySelector('#getLocationBtn');
  const latInput = root.querySelector('#latInput');
  const lngInput = root.querySelector('#lngInput');

  function describeGeo() {
    if (!geo) return 'Ainda sem localização.';
    const src = geo.source === 'hotspot' ? 'hotspot selecionado' : geo.source === 'gps' ? 'GPS do dispositivo' : 'coordenadas manuais';
    const okAccuracy = geo.accuracy <= 50;
    return `${okAccuracy ? '✅' : '⚠️'} Localização via ${src}: ${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)} (precisão ~${Math.round(geo.accuracy)}m)${okAccuracy ? '' : ' — precisão fraca, tente novamente ou insira manualmente'}`;
  }

  function refreshLocationStatus() {
    locationStatusEl.textContent = describeGeo();
  }
  refreshLocationStatus();

  getLocationBtn.onclick = () => {
    if (!navigator.geolocation) {
      locationStatusEl.textContent = '❌ Este dispositivo/browser não suporta geolocalização. Use as coordenadas manuais abaixo.';
      return;
    }
    getLocationBtn.disabled = true;
    locationStatusEl.textContent = 'A obter localização…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geo = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'gps',
        };
        getLocationBtn.disabled = false;
        refreshLocationStatus();
        updateSummary();
      },
      (err) => {
        getLocationBtn.disabled = false;
        locationStatusEl.textContent = `❌ Não foi possível obter o GPS (${err.message}). Use as coordenadas manuais abaixo.`;
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
    );
  };

  root.querySelector('#useManualLoc').onclick = () => {
    const lat = Number(latInput.value);
    const lng = Number(lngInput.value);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      locationStatusEl.textContent = '❌ Coordenadas manuais inválidas.';
      return;
    }
    // Manual entry has no device-reported accuracy; assume a conservative estimate.
    geo = { latitude: lat, longitude: lng, accuracy: 30, source: 'manual' };
    refreshLocationStatus();
    updateSummary();
  };

  function updateSummary() {
    const type = typeSelect.value;
    const location = (locationInput.value || '').toString().trim();
    const desc = (descInput.value || '').toString().trim();
    const photo = photoDataUrl ? '✅ fotografia pronta' : '⏳ precisa de captura';
    const hasGeo = !!geo && geo.accuracy <= 50;
    root.querySelector('#confirmSummary').textContent = `Tipo: ${type} · Local: ${location || '-'} · ${photo} · ${hasGeo ? '✅ GPS pronto' : '⏳ falta GPS válido'}`;

    const canSubmit = type && location && desc && photoDataUrl && hasGeo;
    root.querySelector('#submitBtn').disabled = !canSubmit;
  }

  typeSelect.onchange = updateSummary;
  locationInput.oninput = updateSummary;
  descInput.oninput = updateSummary;

  root.querySelector('#goCamera').onclick = () => {
    reportStatus.textContent = 'captura';
    // animate scroll into camera card
    root.querySelector('.right')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function stopCamera() {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  root.querySelector('#backHome').onclick = () => {
    stopCamera();
    router.navigate('/');
  };

  root.querySelector('#startCameraBtn').onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      root.querySelector('#photoHint').textContent = 'A câmara não é suportada neste browser.';
      return;
    }
    try {
      stopCamera();
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      camVideo.srcObject = mediaStream;
      camVideo.style.display = 'block';
      cam.style.display = 'none';
      root.querySelector('#photoHint').textContent = 'Câmara ativa. Enquadre a ocorrência e clique em Capturar.';
    } catch {
      root.querySelector('#photoHint').textContent = 'Não foi possível aceder à câmara. Verifique a permissão do browser.';
    }
  };

  root.querySelector('#captureBtn').onclick = () => {
    if (mediaStream && camVideo.videoWidth) {
      cam.width = camVideo.videoWidth;
      cam.height = camVideo.videoHeight;
      ctx.drawImage(camVideo, 0, 0, cam.width, cam.height);
      stopCamera();
      camVideo.style.display = 'none';
      cam.style.display = 'block';
    } else {
      seed = seed + 1;
      drawSimulatedCameraFrame(cam, { seed });
    }
    photoDataUrl = cam.toDataURL('image/jpeg', 0.75);
    root.querySelector('#photoHint').textContent = 'Fotografia pronta! Clique em “Usar captura”.';
    root.querySelector('#usePhotoBtn').disabled = false;
    updateSummary();
  };

  root.querySelector('#usePhotoBtn').onclick = () => {
    root.querySelector('#photoHint').textContent = 'Fotografia ativa ✅';
    photoDataUrl = photoDataUrl || cam.toDataURL('image/jpeg', 0.75);
    root.querySelector('#usePhotoBtn').disabled = true;
    updateSummary();
  };

  updateSummary();

  root.querySelector('#submitBtn').onclick = async () => {
    const type = typeSelect.value;
    const location = (locationInput.value || '').toString().trim();
    const desc = (descInput.value || '').toString().trim();

    if (!geo || geo.accuracy > 50) {
      locationStatusEl.textContent = '❌ É preciso uma localização válida (precisão ≤ 50m) antes de enviar.';
      return;
    }

    // Confirmation
    const ok = window.confirm('Confirmar envio do reporte?');
    if (!ok) return;

    // disable UI while the request is in flight
    root.querySelector('#submitBtn').disabled = true;
    root.querySelector('#captureBtn').disabled = true;
    root.querySelector('#usePhotoBtn').disabled = true;
    getLocationBtn.disabled = true;
    reportStatus.textContent = 'enviando…';

    const spinner = html(`
      <div style="margin-top:10px; padding:10px; border-radius:14px; border:1px solid rgba(53,208,127,.22); background: rgba(53,208,127,.08)">
        Enviando reporte…
        <div style="height:6px"></div>
        <div style="width:100%; height:8px; border-radius:999px; background: rgba(167,215,191,.18); overflow:hidden">
          <div id="bar" style="height:100%; width:40%; background: rgba(53,208,127,.6); animation: fill 1.1s ease-in-out infinite alternate"></div>
        </div>
      </div>
      <style>
        @keyframes fill{ from{transform: translateX(-10%); width:25%} to{transform: translateX(30%); width:70%}}
      </style>
    `);
    root.querySelector('#confirmSummary').insertAdjacentElement('afterend', spinner);

    const result = await store.addReport({
      type,
      location,
      desc,
      photoDataUrl,
      latitude: geo.latitude,
      longitude: geo.longitude,
      accuracy: geo.accuracy,
    });

    spinner.remove();

    if (result.ok) {
      stopCamera();
      reportStatus.textContent = `encaminhado a ${result.authority.name}`;
      router.navigate('/challenges');
    } else {
      // Let the person fix the problem (e.g. adjust location) and try again.
      reportStatus.textContent = 'falhou';
      root.querySelector('#submitBtn').disabled = false;
      root.querySelector('#captureBtn').disabled = false;
      root.querySelector('#usePhotoBtn').disabled = !!photoDataUrl;
      getLocationBtn.disabled = false;
    }
  };
}

