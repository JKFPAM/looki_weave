// A deterministic DOM/canvas double for lifecycle tests and JS-only benchmarks.
// It deliberately does not emulate GPU rasterization, browser FPS or a webcam.
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as dynamics from '../live-dynamics.js';
import * as performanceTools from '../live-performance.js';

export async function liveHarness({ source, width = 3840, height = 2160, videoFrames = true, deferredReady = false } = {}) {
  const elements = new Map(), frames = new Map(), videoQueue = new Map(), listeners = new EventTarget();
  let nextId = 0, now = 0, calls = 0, readbacks = 0, resolveReady;
  const trace = [];
  class Element extends EventTarget {
    constructor(tag, id) {
      super(); this.tagName = tag.toUpperCase(); this.id = id; this.style = {}; this.value = '';
      this.dataset = {}; this.children = []; this.type = tag === 'input' ? 'range' : '';
      this.options = []; this.drawCalls = 0;
      this.width = 300; this.height = 150; this.readyState = 3; this.videoWidth = 640; this.videoHeight = 480;
      this.currentTime = 0; this.textContent = ''; this.checked = false; this.disabled = false;
      this.classList = { toggle() {}, add() {}, remove() {} };
      this.context = new Proxy({
        drawImage: (...args) => { this.drawCalls++; if (this.id === 'liveWeaveCanvas') { calls++; if (trace.length < 10000) trace.push(args.slice(1)); } },
        createLinearGradient: () => ({ addColorStop() {} }),
        getImageData: () => { readbacks++; return { data: new Uint8ClampedArray(80 * 60 * 4).fill(128) }; }
      }, { get: (target, name) => target[name] ?? (() => {}) });
      if (tag === 'video' && videoFrames) {
        this.requestVideoFrameCallback = callback => { const id = ++nextId; videoQueue.set(id, callback); return id; };
        this.cancelVideoFrameCallback = id => videoQueue.delete(id);
      }
    }
    set innerHTML(html) {
      for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
        const element = new Element(match[1], match[2]);
        element.value = match[0].match(/\bvalue="([^"]*)"/)?.[1] || '';
        element.checked = /\bchecked\b/.test(match[0]); elements.set(element.id, element);
      }
      if (elements.has('liveCameraResponse')) elements.get('liveCameraResponse').value = 'auto';
    }
    setAttribute() {}
    get selectedOptions() { return [{ text: this.value }]; }
    closest() { return this; }
    getContext() { return this.context; }
    append(...children) { for (const child of children) { this.children.push(child); if (child.id) elements.set(child.id, child); } }
    prepend(child) { this.append(child); }
    pause() { this.paused = true; }
    async play() { this.paused = false; }
    click() { return this.onclick?.(); }
  }
  const body = new Element('body');
  const document = Object.assign(listeners, { body, hidden: false,
    createElement: tag => new Element(tag), getElementById: id => elements.get(id) });
  const controls = { count: '4', pattern: 'knit', relief: '55', threadShadow: '40', yarnWidth: '92', material: 'cotton', fibre: '0', density: '96' };
  for (const [id, value] of Object.entries(controls)) { const el = new Element('input', id); el.value = value; elements.set(id, el); }
  const tracks = [{ stop() { this.stopped = true; }, addEventListener() {} }];
  const stream = { getTracks: () => tracks, getVideoTracks: () => tracks };
  let tracker;
  class Tracking {
    constructor(callbacks) { Object.assign(this, callbacks); this.interval = 180; this.lastFrame = -Infinity; tracker = this; }
    async prepare() { this.ready = true; }
    detect(source, time) { this.lastFrame = time; this.onResult(.9, time); }
    close() { this.ready = false; this.closed = (this.closed || 0) + 1; }
  }
  const windowEvents = new EventTarget();
  const ready = deferredReady ? new Promise(resolve => { resolveReady = resolve; }) : Promise.resolve();
  const sandbox = {
    ...dynamics, ...performanceTools, CameraTracking: Tracking,
    FaceDetector: { createFromOptions: async () => ({ detectForVideo: () => ({ detections: [] }), close() {} }) },
    FilesetResolver: { forVisionTasks: async () => ({}) },
    document, console, Event, Float32Array, Float64Array, Uint8Array, Uint16Array, Uint8ClampedArray,
    innerWidth: width, innerHeight: height, devicePixelRatio: 2, isSecureContext: true,
    navigator: { hardwareConcurrency: 8, deviceMemory: 8, permissions: { query: async () => ({ state: 'prompt' }) },
      mediaDevices: { getUserMedia: async () => stream } },
    performance: { now: () => performance.now() },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: callback => { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout, clearTimeout,
    addEventListener: (...args) => windowEvents.addEventListener(...args),
    loom: { getState: () => ({ palette: ['#FAFAF6', '#FE6E00', '#C8C5FF', '#161313'] }), render() {} },
    loomMotion: { showStill() { document.dispatchEvent(new Event('loomshowstudio')); } },
    paintKnitStitch() {}, drawCrossing() {}, loomReady: ready
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  const code = (source ?? await readFile(new URL('../live-camera.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
  const initialized = vm.runInContext(`(async () => {${code}\n})()`, context);
  if (!deferredReady) await initialized;
  return { sandbox, context, Element, elements, frames, videoQueue, document, windowEvents, initialized,
    resolveReady, stream, tracks, get tracker() { return tracker; },
    get calls() { return calls; }, get readbacks() { return readbacks; }, trace,
    tick(time = now + 1000 / 60) { now = time; const batch = [...frames.values()]; frames.clear(); for (const callback of batch) callback(time); },
    cameraFrame(time) { elements.get('liveCameraVideo').currentTime = time / 1000; const batch = [...videoQueue.values()]; videoQueue.clear(); for (const callback of batch) callback(time); },
    cleanup() { elements.get('stopLiveCamera').onclick(); frames.clear(); }
  };
}
