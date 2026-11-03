import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { clamp, cloudField, coverUV, FacePresence, luminance, liveColour } from './live-dynamics.js';

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
let faceDetector = null, detectorPromise = null, lastDetection = -Infinity;
let active = true, stream = null, requestId = 0, pixels = null;
let lastTick = 0, phase = 0, blend = 0, raf = 0, ready = false;
let lastFaceTimestamp = -Infinity;
let faceConfidence = 0;
let palette = [[250, 250, 246], [254, 110, 0], [200, 197, 255], [22, 19, 19]];
let tonalPalette = palette.slice().sort((a, b) => luminance(a) - luminance(b));
let density = 96, pattern = 'knit', spriteSettings = '', sprites = new Map();

function message(text) { if (status.textContent !== text) status.textContent = text; }
function syncSettings() {
  if (!window.loom) return;
  const state = window.loom.getState();
  palette = state.palette.slice(0, +$('count').value).map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  tonalPalette = palette.slice().sort((a, b) => luminance(a) - luminance(b));
  density = +$('liveStitchDensity').value;
  pattern = $('pattern').value;
  const key = palette.map(rgb => rgb.join(',')).join(';') + '|' + ['relief', 'threadShadow', 'yarnWidth', 'material', 'fibre', 'density', 'pattern'].map(id => $(id).value).join('|');
  if (key !== spriteSettings) { sprites.clear(); spriteSettings = key; }
}

function resize() {
  const scale = Math.min(1.5, devicePixelRatio || 1, 1500 / innerWidth, 1500 / innerHeight);
  canvas.width = Math.round(innerWidth * scale);
  canvas.height = Math.round(innerHeight * scale);
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

function cameraSample(now) {
  if (!stream || video.readyState < 2 || !video.videoWidth) return;
  sampleContext.drawImage(video, 0, 0, sample.width, sample.height);
  const next = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
  if (!pixels) pixels = Float32Array.from(next);
  else for (let i = 0; i < next.length; i++) pixels[i] += (next[i] - pixels[i]) * .45;
  if (faceDetector && now - lastDetection >= 180) {
    lastDetection = now;
    try {
      const result = faceDetector.detectForVideo(video, now);
      const scores = (result.detections || [])
        .map(detection => Number(detection?.categories?.[0]?.score ?? 0))
        .filter(score => Number.isFinite(score));
      const confidence = scores.length ? Math.max(...scores) : 0;
      faceConfidence = confidence;
      const foundFace = confidence >= .6;
      if (foundFace) lastFaceTimestamp = now;
      if (foundFace) {
        presence.update(true, now);
      } else if (now - lastFaceTimestamp <= 650) {
        presence.update(false, now);
      } else {
        presence.reset();
      }
    } catch (error) {
      console.error('Face detection stopped:', error);
      faceDetector.close(); faceDetector = null;
      message('Détection indisponible. Coupe puis réactive la caméra pour réessayer.');
      return;
    }
  }
  const always = $('liveCameraResponse').value === 'always';
  const target = always ? 1 : presence.amount;
  const ease = target > blend ? .24 : .32;
  blend += (target - blend) * ease;
  if (!always && !presence.visible && blend < .08) blend = 0;
  if (!faceDetector) return;
  message(always ? 'Caméra en direct — ton image est tissée avec la palette choisie.'
    : blend > .15 ? 'Visage détecté — ton image apparaît dans la palette choisie.'
    : 'Nuage vivant — un visage déclenchera automatiquement la caméra.');
}

async function prepareDetector() {
  if (faceDetector) return faceDetector;
  if (!detectorPromise) detectorPromise = (async () => {
    const fileset = await FilesetResolver.forVisionTasks('/wasm');
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate: 'CPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: .5
    });
  })().finally(() => { detectorPromise = null; });
  return detectorPromise;
}

function draw(now) {
  raf = requestAnimationFrame(draw);
  if (!active || !ready || document.hidden || now - lastTick < 50) return;
  const dt = Math.min(.1, (now - lastTick) / 1000); lastTick = now; phase += dt;
  cameraSample(now);
  if (!stream) blend *= .85;
  const W = canvas.width, H = canvas.height, aspect = W / H;
  const cols = Math.min(density, Math.sqrt(9500 * aspect));
  const step = W / cols;
  const rows = Math.ceil(H / step);
  context.fillStyle = `rgb(${tonalPalette[0].join(',')})`; context.fillRect(0, 0, W, H);
  const mirror = $('liveCameraMirror').checked;
  for (let j = -1; j <= rows + 1; j++) for (let i = -1; i <= cols + 1; i++) {
    const x = (i + .5) * step, y = (j + .5) * step;
    const field = cloudField(x / W * aspect, y / H, phase);
    let cameraRGB = null;
    if (pixels && blend > .005) {
      let [u, v] = coverUV(x / W, y / H, video.videoWidth / video.videoHeight, aspect);
      if (mirror) u = 1 - u;
      const index = (Math.floor(clamp(v, 0, .9999) * 60) * 80 + Math.floor(clamp(u, 0, .9999) * 80)) * 4;
      cameraRGB = [pixels[index], pixels[index + 1], pixels[index + 2]];
    }
    const rgb = liveColour(palette, tonalPalette, field, cameraRGB, blend, i, j);
    const driftX = Math.sin(y / H * 6 + phase * .25) * step * .14 * (1 - blend);
    const driftY = Math.sin(x / W * 5 + phase * .19) * step * .16 * (1 - blend);
    const parity = pattern === 'twill' ? ((i - j + 10000) % 6 < 3 ? 0 : 1) : 0;
    const tile = stitch(rgb, parity);
    const scale = pattern === 'twill' ? step / 48 : step / 40;
    context.drawImage(tile, x + driftX - 40 * scale, y + driftY - 40 * scale, 80 * scale, 80 * scale);
  }
}

function setActive(on) {
  active = on;
  document.body.classList.toggle('live-cloud', on);
  $('toggleCloud').textContent = on ? 'Retour au studio' : 'Lancer le nuage';
  $('toggleCloud').setAttribute('aria-pressed', String(on));
  if (on) window.loomMotion?.showStill();
  else stopCamera();
}

function stopCamera() {
  requestId++;
  const old = stream; stream = null;
  old?.getTracks().forEach(track => track.stop());
  video.srcObject = null; video.hidden = true;
  pixels = null; faceConfidence = 0; presence.reset(); lastDetection = -Infinity; lastFaceTimestamp = -Infinity; blend = 0;
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
    const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    if (id !== requestId) { acquired.getTracks().forEach(track => track.stop()); return; }
    stream = acquired; video.srcObject = acquired;
    await video.play();
    if (id !== requestId) return;
    faceConfidence = 0; presence.reset(); pixels = null; lastFaceTimestamp = -Infinity;
    video.hidden = false;
    $('enableLiveCamera').hidden = true;
    message('Caméra autorisée. Préparation de la détection du visage…');
    faceDetector = await prepareDetector();
    if (id !== requestId) return;
    message('Détection prête. Montre ton visage : le nuage passera automatiquement à la caméra.');
    acquired.getVideoTracks()[0].addEventListener('ended', () => {
      if (stream !== acquired) return;
      stopCamera(); message('La caméra a été déconnectée ou son autorisation retirée.');
    });
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
addEventListener('resize', resize);
addEventListener('pagehide', () => { stopCamera(); cancelAnimationFrame(raf); });
addEventListener('pageshow', event => { if (event.persisted) { lastTick = 0; raf = requestAnimationFrame(draw); } });
document.addEventListener('loomrender', syncSettings);
$('liveStitchDensity').addEventListener('input', () => {
  $('liveStitchDensityValue').value = $('liveStitchDensity').value;
  syncSettings();
});
$('density').addEventListener('input', () => {
  $('liveStitchDensity').value = $('density').value;
  $('liveStitchDensityValue').value = $('density').value;
  syncSettings();
});
window.loomLive = { canvas, get active() { return active; }, get density() { return density; } };
resize(); setActive(true);
await window.loomReady;
syncSettings(); ready = true; raf = requestAnimationFrame(draw);
// A previously granted camera starts with the default automatic face mode.
// First-time permission still requires the visible button and browser consent.
try {
  const permission = await navigator.permissions?.query({ name: 'camera' });
  if (permission?.state === 'granted' && active && !stream) enableCamera();
} catch { /* Permission queries are optional in some browsers. */ }
