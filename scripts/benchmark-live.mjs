// JS draw-loop comparison with a no-op canvas. Not a display/GPU FPS test.
// node scripts/benchmark-live.mjs --baseline /tmp/live-camera-before.js
import { readFile } from 'node:fs/promises';
import { liveHarness } from '../test-support/live-harness.js';

const baselineArg = process.argv.indexOf('--baseline');
const baseline = baselineArg < 0 ? null : await readFile(process.argv[baselineArg + 1], 'utf8');
const results=[];
for(const camera of [false,true]) for(const [label,source] of [...(baseline?[['before',baseline]]:[]),['after',undefined]]) {
  const h=await liveHarness({source});
  const startupLoops=h.frames.size;
  if(camera){h.elements.get('liveCameraResponse').value='always';await h.elements.get('enableLiveCamera').onclick();}
  const durations=[];
  for(let i=1;i<=700;i++) {
    if(camera)h.cameraFrame(i*34);
    const start=performance.now();h.tick(i*34);
    if(i>100)durations.push(performance.now()-start);
  }
  durations.sort((a,b)=>a-b);
  results.push({version:label,mode:camera?'camera (synthetic samples)':'cloud',viewport:'3840x2160',
    medianMs:+durations[Math.floor(durations.length*.5)].toFixed(3),p95Ms:+durations[Math.floor(durations.length*.95)].toFixed(3),startupLoops});
  h.cleanup();
}
console.table(results);
console.log('JavaScript CPU cost only: canvas calls are no-ops, camera pixels and face detection are simulated.');
