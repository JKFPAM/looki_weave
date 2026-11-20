import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraTracking } from './camera-tracking.js';

function workerEnvironment(t) {
  const originals = Object.fromEntries(['Worker','OffscreenCanvas','createImageBitmap','location'].map(name=>[name,globalThis[name]]));
  Object.assign(globalThis,{Worker:class{},OffscreenCanvas:class{},createImageBitmap:()=>{},location:{href:'http://localhost/'}});
  t.after(()=>{for(const [name,value] of Object.entries(originals)){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}});
}
function fakeWorker() {
  return {frames:[],postMessage(data){if(data.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready'}}));else this.frames.push(data);},terminate(){this.terminated=true;}};
}

test('worker has one frame in flight and can consume a new frame after its result', async t=>{
  workerEnvironment(t);const worker=fakeWorker(),results=[];
  const tracking=new CameraTracking({workerFactory:()=>worker,bitmapFactory:async()=>({close(){}}),onResult:(...args)=>results.push(args)});
  t.after(()=>tracking.close());await tracking.prepare();
  tracking.detect({},100);tracking.detect({},400);await Promise.resolve();assert.equal(worker.frames.length,1);
  worker.onmessage({data:{type:'result',confidence:.9,now:100}});assert.deepEqual(results,[[.9,100]]);
  tracking.detect({},500);await Promise.resolve();assert.equal(worker.frames.length,2);
});

test('stopping during bitmap creation closes the stale image and discards its result', async t=>{
  workerEnvironment(t);const worker=fakeWorker();let resolveBitmap,closed=false,results=0;
  const tracking=new CameraTracking({workerFactory:()=>worker,bitmapFactory:()=>new Promise(r=>{resolveBitmap=r;}),onResult:()=>results++});
  await tracking.prepare();tracking.detect({},100);tracking.close();
  resolveBitmap({close(){closed=true;}});await Promise.resolve();
  worker.onmessage({data:{type:'result',confidence:1,now:100}});
  assert.ok(closed);assert.ok(worker.terminated);assert.equal(worker.frames.length,0);assert.equal(results,0);
});

test('worker initialization failure uses the older-browser detector and frees it on stop', async t=>{
  workerEnvironment(t);let closed=0,detected=0,result=0;
  const tracking=new CameraTracking({workerFactory:()=>{throw Error('module workers unsupported');},
    loadDetector:async()=>({detectForVideo(){detected++;return {detections:[{categories:[{score:.8}]}]};},close(){closed++;}}),
    onResult:confidence=>{result=confidence;}});
  await tracking.prepare();assert.ok(tracking.ready);assert.equal(tracking.interval,350);
  tracking.detect({},100);tracking.detect({},500);await new Promise(r=>setTimeout(r,10));assert.equal(detected,1);assert.equal(result,.8);
  tracking.close();assert.equal(closed,1);
});

test('a stopped fallback initialization cannot revive the previous camera session', async t=>{
  workerEnvironment(t);let resolveDetector,closed=0;
  const tracking=new CameraTracking({workerFactory:()=>{throw Error('no worker');},loadDetector:()=>new Promise(r=>{resolveDetector=r;})});
  const prepare=tracking.prepare();await Promise.resolve();await Promise.resolve();tracking.close();
  resolveDetector({close(){closed++;}});await prepare;
  assert.equal(closed,1);assert.ok(!tracking.ready);assert.ok(!tracking.detector);
});

test('worker inference failure releases the worker and reports a recoverable error', async t=>{
  workerEnvironment(t);const worker=fakeWorker();let reported;
  const tracking=new CameraTracking({workerFactory:()=>worker,onError:error=>{reported=error;}});
  await tracking.prepare();worker.onmessage({data:{type:'error',message:'lost context'}});
  assert.ok(worker.terminated);assert.ok(!tracking.ready);assert.match(reported.message,/lost context/);
});
