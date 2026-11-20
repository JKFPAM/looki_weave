import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

let detector;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      // Module workers cannot execute the classic UMD loader with importScripts.
      // MediaPipe supplies a distinct ES module loader and matching WASM binary.
      const files = await FilesetResolver.forVisionTasks(data.wasm, true);
      detector = await FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: data.model, delegate: 'CPU' },
        runningMode: 'VIDEO', minDetectionConfidence: .5
      });
      self.postMessage({ type: 'ready' });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
  } else if (data.type === 'frame') {
    try {
      const result = detector.detectForVideo(data.bitmap, data.now);
      let confidence = 0;
      for (const detection of result.detections || []) {
        confidence = Math.max(confidence, Number(detection.categories?.[0]?.score) || 0);
      }
      self.postMessage({ type: 'result', confidence, now: data.now });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
    finally { data.bitmap.close(); }
  }
};
