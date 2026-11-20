// At most one inference is in flight. Old camera sessions cannot publish results.
export class CameraTracking {
  constructor({ onResult, onError, workerFactory, bitmapFactory, loadDetector } = {}) {
    this.onResult = onResult;
    this.onError = onError;
    this.workerFactory = workerFactory || (() => new Worker(new URL('./face-detector-worker.js', import.meta.url), { type: 'module' }));
    this.bitmapFactory = bitmapFactory || (source => createImageBitmap(source));
    this.loadDetector = loadDetector || (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks('/wasm');
      return FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate: 'CPU' },
        runningMode: 'VIDEO', minDetectionConfidence: .5
      });
    });
    this.generation = 0;
    this.interval = 180;
    this.lastFrame = -Infinity;
  }
  async prepare() {
    if (this.ready) return;
    if (this.preparing) return this.preparing;
    const generation = this.generation;
    const task = (async () => {
      try {
        if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') throw Error('Worker inference unavailable');
        await this.prepareWorker();
      } catch {
        if (generation !== this.generation) return;
        this.worker?.terminate(); this.worker = null;
        const detector = await this.loadDetector();
        if (generation !== this.generation) { detector.close(); return; }
        this.detector = detector;
        this.interval = 350;
      }
      if (generation === this.generation) this.ready = true;
    })();
    this.preparing = task;
    try { await task; }
    finally { if (this.preparing === task) this.preparing = null; }
  }
  prepareWorker() {
    return new Promise((resolve, reject) => {
      const worker = this.worker = this.workerFactory();
      const finish = error => {
        clearTimeout(timeout); this.rejectInit = null;
        if (error) reject(error); else resolve();
      };
      const timeout = setTimeout(() => finish(Error('Detector initialization timed out')), 12000);
      this.rejectInit = () => finish(Error('Camera stopped'));
      worker.onmessage = ({ data }) => {
        if (worker !== this.worker) return;
        if (data.type === 'ready') finish();
        else if (data.type === 'result') {
          clearTimeout(this.resultTimeout); this.pending = false;
          this.onResult?.(data.confidence, data.now);
        } else if (data.type === 'error') {
          if (this.rejectInit) finish(Error(data.message));
          else this.fail(Error(data.message));
        }
      };
      worker.onerror = event => {
        event.preventDefault?.();
        if (worker !== this.worker) return;
        if (this.rejectInit) finish(Error(event.message));
        else this.fail(Error(event.message));
      };
      try {
        worker.postMessage({ type: 'init', wasm: new URL('/wasm', location.href).href,
          model: new URL('/models/blaze_face_short_range.tflite', location.href).href });
      } catch (error) { finish(error); }
    });
  }
  detect(source, now) {
    if (!this.ready || this.pending || now - this.lastFrame < this.interval) return;
    this.lastFrame = now; this.pending = true;
    const generation = this.generation;
    if (this.worker) {
      const worker = this.worker;
      this.resultTimeout = setTimeout(() => {
        if (generation === this.generation) this.fail(Error('Detector response timed out'));
      }, 4000);
      this.bitmapFactory(source).then(bitmap => {
        if (generation !== this.generation || worker !== this.worker) { bitmap.close(); return; }
        try { worker.postMessage({ type: 'frame', bitmap, now }, [bitmap]); }
        catch (error) { bitmap.close(); this.fail(error); }
      }).catch(error => { if (generation === this.generation) this.fail(error); });
    } else {
      // Older Safari: small input, low cadence, outside the canvas draw callback.
      this.timer = setTimeout(() => {
        if (generation !== this.generation) return;
        try {
          const start = performance.now();
          const result = this.detector.detectForVideo(source, now);
          this.interval = Math.max(350, Math.min(1000, (performance.now() - start) * 8));
          let confidence = 0;
          for (const detection of result.detections || []) confidence = Math.max(confidence, Number(detection.categories?.[0]?.score) || 0);
          this.pending = false; this.onResult?.(confidence, now);
        } catch (error) { this.fail(error); }
      }, 0);
    }
  }
  fail(error) { this.close(); this.onError?.(error); }
  close() {
    this.generation++; this.ready = false; this.pending = false;
    this.rejectInit?.(); this.rejectInit = null;
    clearTimeout(this.timer); clearTimeout(this.resultTimeout);
    this.worker?.terminate(); this.worker = null;
    this.detector?.close(); this.detector = null;
    this.preparing = null; this.lastFrame = -Infinity;
  }
}
