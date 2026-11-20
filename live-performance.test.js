import test from 'node:test';
import assert from 'node:assert/strict';
import { LivePerformance, canvasSize, nextFrameDeadline } from './live-performance.js';
import { liveHarness } from './test-support/live-harness.js';
import { liveColour, createColourSelector, ditherThreshold, luminance, FacePresence } from './live-dynamics.js';

test('optimized palette lookup exactly matches the original dithered colours', () => {
  for (const palette of [[[19,33,107],[42,86,193],[173,208,251]], [[20,20,20],[20,20,20]], [[200,5,8]]]) {
    const select = createColourSelector(palette), tones = [...palette].sort((a,b)=>luminance(a)-luminance(b));
    for (const rgb of [null,[0,0,0],[0,255,0],[255,255,255]]) for (let blend=0;blend<=1;blend+=.1) {
      for (let field=0;field<=1;field+=.1) for(let y=-1;y<5;y++) for(let x=-1;x<5;x++) {
        assert.equal(palette[select(field,rgb ? luminance(rgb) : -1,blend,ditherThreshold(x,y),ditherThreshold(x+1,y+2))],liveColour(palette,tones,field,rgb,blend,x,y));
      }
    }
  }
});

test('30 FPS deadlines remain even on 60, 120 and 144 Hz displays', () => {
  for (const hz of [60,120,144]) {
    let deadline=0; const timestamps=[];
    for(let i=1;i<=hz*10;i++) {const now=i*1000/hz;if(now+.75<deadline)continue;timestamps.push(now);deadline=nextFrameDeadline(deadline,now,1000/30);}
    assert.ok(Math.abs(timestamps.length-300)<=1);
    for(let i=1;i<timestamps.length;i++) assert.ok(timestamps[i]-timestamps[i-1]<=1000/30+1000/hz+.01);
  }
  assert.equal(nextFrameDeadline(50,10000,1000/30),10000+1000/30);
});

test('slow frames lower cost quickly; quality recovers only after sustained headroom', () => {
  const profile = new LivePerformance();let now=1;
  const window = cost => { for(let i=0;i<60;i++) {now+=1000/30;profile.observe(cost,1000/30,now);} };
  window(24);assert.equal(profile.level,1);
  window(24);window(24);window(24);assert.equal(profile.level,3);
  const lower=profile.pixelBudget;window(3);assert.equal(profile.pixelBudget,lower);
  for(let i=0;i<16;i++)window(3);assert.equal(profile.level,0);
});

test('large, Retina, portrait and ultrawide canvases stay inside the pixel budget', () => {
  for(const [w,h] of [[1920,1080],[3840,2160],[5120,2880],[1080,1920],[7680,2160]]) {
    for(const budget of [1200000,850000,600000,420000]) {
      const [width,height]=canvasSize(w,h,2,budget);
      assert.ok(width*height<=budget);assert.ok(Math.abs(width/height-w/h)<.015);
    }
  }
});

test('face transition timing does not change with display frame rate', () => {
  const amounts=[];
  for(const fps of [12,30,60]) {const presence=new FacePresence();presence.update(false,0);for(let t=1000/fps;t<=2000.01;t+=1000/fps)presence.update(true,t);amounts.push(presence.amount);}
  assert.ok(Math.max(...amounts)-Math.min(...amounts)<.001);
});

test('startup, hide/show, and BFCache restoration maintain one animation loop', async () => {
  const h=await liveHarness({deferredReady:true});assert.equal(h.frames.size,0);
  h.resolveReady();await h.initialized;assert.equal(h.frames.size,1);
  for(let i=1;i<=120;i++) {h.tick(i*1000/60);assert.equal(h.frames.size,1);}
  h.document.hidden=true;h.document.dispatchEvent(new Event('visibilitychange'));assert.equal(h.frames.size,0);
  h.document.hidden=false;h.document.dispatchEvent(new Event('visibilitychange'));assert.equal(h.frames.size,1);
  h.windowEvents.dispatchEvent(new Event('pagehide'));assert.equal(h.frames.size,0);
  const event=new Event('pageshow');event.persisted=true;h.windowEvents.dispatchEvent(event);assert.equal(h.frames.size,1);
  h.elements.get('toggleCloud').onclick();assert.equal(h.frames.size,0);
  h.elements.get('toggleCloud').onclick();assert.equal(h.frames.size,1);h.cleanup();
});

test('camera samples new frames once, always mode skips detection, and stop releases resources', async () => {
  const h=await liveHarness();h.elements.get('liveCameraResponse').value='always';
  await h.elements.get('enableLiveCamera').onclick();assert.equal(h.videoQueue.size,1);assert.ok(!h.tracker.ready);
  h.cameraFrame(100);h.cameraFrame(100);assert.equal(h.readbacks,1);
  h.tick(100);h.tick(133);assert.equal(h.readbacks,1);
  h.document.hidden=true;h.document.dispatchEvent(new Event('visibilitychange'));assert.equal(h.videoQueue.size,0);assert.equal(h.frames.size,0);
  h.document.hidden=false;h.document.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();assert.equal(h.videoQueue.size,1);
  h.cleanup();assert.equal(h.videoQueue.size,0);assert.ok(h.tracks[0].stopped);assert.ok(h.tracker.closed);
});

test('older video APIs use the timer fallback and cancel it on camera stop', async () => {
  const h=await liveHarness({videoFrames:false});h.elements.get('liveCameraResponse').value='always';
  await h.elements.get('enableLiveCamera').onclick();await new Promise(r=>setTimeout(r,10));
  const before=h.readbacks;h.cleanup();await new Promise(r=>setTimeout(r,45));assert.equal(h.readbacks,before);
});
