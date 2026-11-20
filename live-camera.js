import { clamp, cloudField, FacePresence, luminance, createColourSelector, ditherThreshold } from './live-dynamics.js';
import { LivePerformance, canvasSize, nextFrameDeadline } from './live-performance.js';
import { CameraTracking } from './camera-tracking.js';

// Visible independently of the legacy sidebar and its client permissions.
const panel = document.createElement('section');
panel.id = 'liveCameraControls';
panel.setAttribute('aria-label', 'Nuage et caméra');
panel.innerHTML = `
  <div class="live-heading"><span class="live-dot"></span><strong>Nuage vivant</strong></div>
  <p id="liveCameraStatus" role="status">Le motif ondule seul. Active la caméra : un visage fera apparaître l’image dans les mailles.</p>
  <div class="controls">
    <button id="enableLiveCamera" class="primary">Activer la caméra</button>
    <button id="hideLiveUI">Hide UI</button>
    <button id="toggleCloud" aria-pressed="true">Retour au studio</button>
    <button id="stopLiveCamera" hidden>Couper la caméra</button>
  </div>
  <details><summary>Réglages caméra</summary>
    <video id="liveCameraVideo" autoplay muted playsinline hidden></video>
    <label for="liveCameraResponse">Réaction du motif</label>
    <select id="liveCameraResponse"><option value="auto" selected>Automatique : nuage ↔ visage détecté</option><option value="always">Toujours montrer la caméra</option></select>
    <p class="hints">Palette conservée : la caméra apporte les formes et les contrastes, les mailles gardent tes couleurs.</p>
    <label class="check"><input id="liveCameraMirror" type="checkbox" checked> Effet miroir</label>
    <label for="liveStitchDensity">Densité des mailles <output id="liveStitchDensityValue">96</output></label>
    <input id="liveStitchDensity" type="range" min="16" max="110" value="96">
    <div class="range-ends"><span>Grosses mailles</span><span>Petites mailles</span></div>
    <p class="hints">Aucune calibration nécessaire : un visage visible déclenche le passage automatique du nuage à la caméra. La vidéo reste sur cet appareil et n’est ni envoyée ni enregistrée automatiquement.</p>
  </details>`;
document.body.append(panel);
const $ = id => document.getElementById(id);
const video = $('liveCameraVideo');
const status = $('liveCameraStatus');
const canvas = document.createElement('canvas');
canvas.id = 'liveWeaveCanvas';
canvas.setAttribute('aria-label', 'Mailles animées en nuage, réactives à la caméra');
document.body.prepend(canvas);
const context = canvas.getContext('2d', { alpha: false });
const sample = document.createElement('canvas');
sample.width = 80; sample.height = 60;
const sampleContext = sample.getContext('2d', { willReadFrequently: true });
const presence = new FacePresence();
const detectionCanvas = document.createElement('canvas');
detectionCanvas.width = 320; detectionCanvas.height = 240;
const detectionContext = detectionCanvas.getContext('2d', { alpha: false });
let active = true, stream = null, requestId = 0, pixels = null, switchingView = false;
let lastTick = 0, deadline = 0, phase = 0, blend = 0, raf = 0, ready = false;
let videoCallback = 0, fallbackTimer = 0, lastVideoTime = -1, lastSample = 0, lastDetection = -Infinity;
let faceConfidence = 0, geometry = null, resized = false;
let palette = [[250, 250, 246], [254, 110, 0], [200, 197, 255], [22, 19, 19]];
let tonalPalette = palette.slice().sort((a, b) => luminance(a) - luminance(b));
let selectColour = createColourSelector(palette), tiles = [], background = '';
let density = 96, pattern = 'knit', spriteSettings = '', sprites = new Map();
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const performanceProfile = new LivePerformance({
  compact: matchMedia('(max-width: 700px)').matches
    || navigator.deviceMemory <= 4 || navigator.hardwareConcurrency <= 4
    || navigator.connection?.saveData,
  reducedMotion: motionPreference.matches
});
const tracking = new CameraTracking({
  onResult(confidence, now) { if (!stream || document.hidden) return; faceConfidence = confidence; lastDetection = now; },
  onError(error) {
    console.warn('Face detection unavailable:', error);
    message('Détection indisponible. Choisis « Toujours montrer la caméra » ou réactive la caméra.');
  }
});

function message(text) { if (status.textContent !== text) status.textContent = text; }
function syncSettings() {
  if (!window.loom) return;
  const state = window.loom.getState();
  const nextPalette = state.palette.slice(0, +$('count').value).map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  const nextDensity = +$('liveStitchDensity').value;
  if (nextDensity !== density) geometry = null;
  density = nextDensity;
  const nextPattern = $('pattern').value;
  if (nextPattern !== pattern) geometry = null;
  pattern = nextPattern;
  const key = nextPalette.map(rgb => rgb.join(',')).join(';') + '|' + ['relief', 'threadShadow', 'yarnWidth', 'material', 'fibre', 'density', 'pattern'].map(id => $(id).value).join('|');
  if (key !== spriteSettings) {
    palette = nextPalette;
    tonalPalette = palette.slice().sort((a, b) => luminance(a) - luminance(b));
    selectColour = createColourSelector(palette);
    background = `rgb(${tonalPalette[0].join(',')})`;
    sprites.clear(); spriteSettings = key;
    tiles = [palette.map(rgb => stitch(rgb, 0)), pattern === 'twill' ? palette.map(rgb => stitch(rgb, 1)) : []];
  }
}

function resize() {
  const [width, height] = canvasSize(innerWidth, innerHeight, devicePixelRatio, performanceProfile.pixelBudget);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width; canvas.height = height;
    context.imageSmoothingEnabled = false;
    geometry = null;
  }
  resized = false;
}

function buildGeometry() {
  const W = canvas.width, H = canvas.height, aspect = W / H;
  const cols = Math.min(density, Math.sqrt(performanceProfile.maxCells * aspect)), step = W / cols;
  const nx = Math.floor(cols + 1) + 2, ny = Math.ceil(H / step) + 3, length = nx * ny;
  const x = new Float64Array(nx), y = new Float64Array(ny);
  const sampleIndex = new Uint16Array(length), threshold = new Float32Array(length), transition = new Float32Array(length), parity = new Uint8Array(length);
  const sourceAspect = video.videoWidth / video.videoHeight || 4 / 3;
  const cropX = Math.min(1, aspect / sourceAspect), cropY = Math.min(1, sourceAspect / aspect);
  const mirror = $('liveCameraMirror').checked;
  for (let i = 0; i < nx; i++) x[i] = (i - .5) * step;
  for (let j = 0; j < ny; j++) y[j] = (j - .5) * step;
  for (let j = 0, k = 0; j < ny; j++) for (let i = 0; i < nx; i++, k++) {
    let u = .5 + (x[i] / W - .5) * cropX;
    const v = .5 + (y[j] / H - .5) * cropY;
    if (mirror) u = 1 - u;
    sampleIndex[k] = (Math.floor(clamp(v, 0, .9999) * sample.height) * sample.width + Math.floor(clamp(u, 0, .9999) * sample.width)) * 4;
    threshold[k] = ditherThreshold(i - 1, j - 1);
    transition[k] = ditherThreshold(i, j + 1);
    parity[k] = pattern === 'twill' && (i - j + 10000) % 6 >= 3 ? 1 : 0;
  }
  geometry = { W, H, aspect, step, x, y, nx, ny, sampleIndex, threshold, transition, parity,
    driftX: new Float64Array(ny), driftY: new Float64Array(nx) };
}

// Reuse the studio's own yarn drawing for a bounded palette of live sprites.
function stitch(rgb, parity) {
  const key = rgb.join(',') + ':' + parity;
  if (sprites.has(key)) return sprites.get(key);
  const tile = document.createElement('canvas'); tile.width = tile.height = 80;
  const g = tile.getContext('2d');
  const previousPhoto = window.loomPhoto;
  window.loomPhoto = null;
  try {
    const colour = `rgb(${rgb.join(',')})`;
    if (pattern === 'twill') {
      window.drawCrossing(g, colour, 16, 16, 48, parity === 0, 10, 10, 214);
    } else {
      g.translate(40, 40);
      window.paintKnitStitch(g, colour, 40, pattern === 'panelrib', 10, 10, 214, true);
    }
  } finally { window.loomPhoto = previousPhoto; }
  // Only the selected palette x two crossing directions; cleared on palette edits.
  sprites.set(key, tile);
  return tile;
}

function stopSampling() {
  if (videoCallback) video.cancelVideoFrameCallback?.(videoCallback);
  videoCallback = 0; clearTimeout(fallbackTimer); fallbackTimer = 0;
}

function sampleCamera(now) {
  if (!stream || !active || document.hidden || video.readyState < 2 || !video.videoWidth) return;
  if (now - lastSample < 1000 / 30 - 1 || video.currentTime === lastVideoTime) return;
  lastSample = now; lastVideoTime = video.currentTime;
  sampleContext.drawImage(video, 0, 0, sample.width, sample.height);
  // One small readback per new camera frame. Smooth at display cadence below.
  pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
  if ($('liveCameraResponse').value !== 'always' && tracking.ready && !tracking.pending && now - tracking.lastFrame >= tracking.interval) {
    const ratio = video.videoWidth / video.videoHeight;
    const height = Math.max(1, Math.round(320 / ratio));
    if (detectionCanvas.height !== height) { detectionCanvas.height = height; geometry = null; }
    detectionContext.drawImage(video, 0, 0, detectionCanvas.width, detectionCanvas.height);
    tracking.detect(detectionCanvas, now);
  }
}

function startSampling() {
  stopSampling();
  if (!stream || !active || document.hidden) return;
  if (video.requestVideoFrameCallback) {
    const frame = now => {
      videoCallback = 0;
      if (!stream || !active || document.hidden) return;
      sampleCamera(now); videoCallback = video.requestVideoFrameCallback(frame);
    };
    videoCallback = video.requestVideoFrameCallback(frame);
  } else {
    const frame = () => {
      if (!stream || !active || document.hidden) return;
      sampleCamera(performance.now()); fallbackTimer = setTimeout(frame, 1000 / 30);
    };
    fallbackTimer = setTimeout(frame, 0);
  }
}

async function prepareTracking(id = requestId) {
  if ($('liveCameraResponse').value === 'always') return;
  const generation = tracking.generation;
  try {
    await tracking.prepare();
    if (id !== requestId || generation !== tracking.generation || !stream || !tracking.ready) return;
    message('Détection prête. Montre ton visage : le nuage passera automatiquement à la caméra.');
  } catch (error) {
    if (id !== requestId || generation !== tracking.generation) return;
    tracking.fail(error);
  }
}

function draw(now) {
  raf = 0;
  if (!active || document.hidden) return;
  scheduleDraw();
  if (!ready || now + .75 < deadline) return;
  const interval = performanceProfile.frameInterval;
  deadline = nextFrameDeadline(deadline, now, interval);
  const elapsed = lastTick ? now - lastTick : interval;
  const dt = Math.min(.1, elapsed / 1000); lastTick = now; phase += dt;
  const start = performance.now();
  if (resized) resize();
  if (!geometry) buildGeometry();
  const always = $('liveCameraResponse').value === 'always';
  const state = presence.update(stream && faceConfidence >= .6 && now - lastDetection < 700, now);
  const target = stream ? (always ? 1 : state.amount) : 0;
  blend += (target - blend) * (1 - Math.exp(-dt / (target > blend ? .12 : .2)));
  if (blend < .005 && target === 0) blend = 0;
  if (stream && (always || tracking.ready)) message(always
    ? 'Caméra en direct — ton image est tissée avec la palette choisie.'
    : blend > .15 ? 'Visage détecté — ton image apparaît dans la palette choisie.'
    : 'Nuage vivant — un visage déclenchera automatiquement la caméra.');
  const { W, H, aspect, step, x, y, nx, ny, sampleIndex, threshold, transition, parity, driftX, driftY } = geometry;
  context.fillStyle = background; context.fillRect(0, 0, W, H);
  const cameraPixels = pixels && blend > .005;
  const tileScale = pattern === 'twill' ? step / 48 : step / 40;
  const tileSize = 80 * tileScale, half = tileSize / 2;
  for (let j = 0; j < ny; j++) driftX[j] = Math.sin(y[j] / H * 6 + phase * .25) * step * .14 * (1 - blend);
  for (let i = 0; i < nx; i++) driftY[i] = Math.sin(x[i] / W * 5 + phase * .19) * step * .16 * (1 - blend);
  for (let j = 0, k = 0; j < ny; j++) for (let i = 0; i < nx; i++, k++) {
    const index = sampleIndex[k];
    const light = cameraPixels ? pixels[index] * .2126 + pixels[index + 1] * .7152 + pixels[index + 2] * .0722 : -1;
    // Fully revealed camera frames need no cloud field calculation.
    const field = cameraPixels && blend > transition[k] ? 0 : cloudField(x[i] / W * aspect, y[j] / H, phase);
    const colour = selectColour(field, light, blend, threshold[k], transition[k]);
    context.drawImage(tiles[parity[k]][colour], x[i] + driftX[j] - half, y[j] + driftY[i] - half, tileSize, tileSize);
  }
  if (performanceProfile.observe(performance.now() - start, elapsed, now)) {
    resize(); geometry = null;
  }
}

function scheduleDraw() {
  if (!raf && active && ready && !document.hidden) raf = requestAnimationFrame(draw);
}

function suspend() {
  cancelAnimationFrame(raf); raf = 0; stopSampling();
  // Keep the session but stop camera decoding and ignore in-flight inference.
  video.pause(); faceConfidence = 0; lastDetection = -Infinity;
}
function resume() {
  lastTick = 0; deadline = 0; performanceProfile.resetWindow();
  if (stream) video.play().then(startSampling).catch(() => message('Clique sur Activer la caméra pour reprendre la vidéo.'));
  scheduleDraw();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else if (active) resume(); });

function setActive(on) {
  active = on;
  document.body.classList.toggle('live-cloud', on);
  $('toggleCloud').textContent = on ? 'Retour au studio' : 'Lancer le nuage';
  $('toggleCloud').setAttribute('aria-pressed', String(on));
  if (on) {
    switchingView = true;
    try { window.loomMotion?.showStill(); } finally { switchingView = false; }
    resume();
  } else {
    cancelAnimationFrame(raf); raf = 0;
    stopCamera();
    window.loom?.render();
  }
}

function stopCamera() {
  requestId++;
  const old = stream; stream = null;
  old?.getTracks().forEach(track => track.stop());
  stopSampling(); tracking.close(); video.pause();
  video.srcObject = null; video.hidden = true;
  pixels = null; faceConfidence = 0; presence.reset(); lastDetection = -Infinity; blend = 0;
  lastVideoTime = -1; lastSample = 0;
  $('enableLiveCamera').disabled = false;
  $('enableLiveCamera').hidden = false;
  $('enableLiveCamera').textContent = 'Activer la caméra';
  $('stopLiveCamera').hidden = true;
  message('Caméra coupée. Le nuage continue sans caméra.');
}

function cameraError(error) {
  const messages = {
    NotAllowedError: 'Accès refusé. Dans les réglages du site près de l’adresse, autorise la caméra, puis réessaie. Sur Mac, vérifie aussi Réglages Système → Confidentialité et sécurité → Caméra pour ce navigateur.',
    NotFoundError: 'Aucune caméra détectée. Branche ou active la webcam, puis réessaie.',
    NotReadableError: 'La caméra est indisponible. Ferme les autres applications qui l’utilisent, puis réessaie.',
    SecurityError: 'Le navigateur bloque la caméra pour cette page. Ouvre le site sur localhost ou en HTTPS.',
    AbortError: 'Le démarrage a été interrompu. Réessaie.'
  };
  return messages[error.name] || `Impossible de démarrer la caméra : ${error.message || error.name}.`;
}

async function enableCamera() {
  if (stream || $('enableLiveCamera').disabled) return;
  setActive(true);
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    message('La caméra nécessite localhost ou HTTPS. Ouvre http://127.0.0.1:5173/ dans ton navigateur.'); return;
  }
  const id = ++requestId;
  $('enableLiveCamera').disabled = true;
  $('enableLiveCamera').textContent = 'Autorisation en attente…';
  $('stopLiveCamera').hidden = false;
  message('Accepte « Autoriser » dans la demande caméra de ton navigateur.');
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: false });
    if (id !== requestId) { acquired.getTracks().forEach(track => track.stop()); return; }
    stream = acquired; video.srcObject = acquired;
    await video.play();
    if (id !== requestId) return;
    faceConfidence = 0; presence.reset(); pixels = null; geometry = null; lastVideoTime = -1;
    video.hidden = false;
    $('enableLiveCamera').hidden = true;
    message($('liveCameraResponse').value === 'always'
      ? 'Caméra en direct — ton image est tissée avec la palette choisie.'
      : 'Caméra autorisée. Préparation de la détection du visage…');
    acquired.getVideoTracks()[0].addEventListener('ended', () => {
      if (stream !== acquired) return;
      stopCamera(); message('La caméra a été déconnectée ou son autorisation retirée.');
    });
    if (!document.hidden) startSampling(); else video.pause();
    await prepareTracking(id);
    if (id !== requestId) return;
  } catch (error) {
    if (id !== requestId) return;
    stopCamera(); message(cameraError(error));
  }
}

$('enableLiveCamera').onclick = enableCamera;
$('stopLiveCamera').onclick = stopCamera;
$('toggleCloud').onclick = () => setActive(!active);
$('hideLiveUI').onclick = () => {
  const hideButton = document.getElementById('hideUI');
  if (hideButton) hideButton.click();
  else document.body.classList.add('presentation');
};
addEventListener('resize', () => { resized = true; }, { passive: true });
motionPreference.addEventListener?.('change', event => {
  performanceProfile.reducedMotion = event.matches; geometry = null; deadline = 0;
});
$('liveCameraMirror').addEventListener('change', () => { geometry = null; });
$('liveCameraResponse').addEventListener('change', () => {
  tracking.close(); faceConfidence = 0; presence.reset(); lastDetection = -Infinity;
  if (stream) prepareTracking();
});
addEventListener('pagehide', () => { stopCamera(); cancelAnimationFrame(raf); raf = 0; });
addEventListener('pageshow', event => { if (event.persisted && active) resume(); });
document.addEventListener('loomrender', syncSettings);
document.addEventListener('loomsettings', syncSettings);
document.addEventListener('loommotion', () => { if (active) setActive(false); });
document.addEventListener('loomshowstudio', () => { if (active && !switchingView) setActive(false); });
$('liveStitchDensity').addEventListener('input', () => {
  $('liveStitchDensityValue').value = $('liveStitchDensity').value;
  syncSettings();
});
$('density').addEventListener('input', () => {
  $('liveStitchDensity').value = $('density').value;
  $('liveStitchDensityValue').value = $('density').value;
  syncSettings();
});
window.loomLive = { canvas, get active() { return active; }, get density() { return density; },
  get stats() { return { fps: performanceProfile.fps, drawMs: performanceProfile.averageMs, quality: performanceProfile.level,
    maxCells: performanceProfile.maxCells, pixelBudget: performanceProfile.pixelBudget, detector: tracking.worker ? 'worker' : tracking.detector ? 'fallback' : 'off' }; }
};
resize(); setActive(true);
await window.loomReady;
syncSettings(); ready = true; scheduleDraw();
// A previously granted camera starts with the default automatic face mode.
// First-time permission still requires the visible button and browser consent.
try {
  const permission = await navigator.permissions?.query({ name: 'camera' });
  if (permission?.state === 'granted' && active && !stream) enableCamera();
} catch { /* Permission queries are optional in some browsers. */ }
