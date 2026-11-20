# Animation and camera performance

The live stage targets an evenly paced 30 FPS. It reduces its internal pixel and
stitch budgets when measured drawing cost or missed deadlines increase, and only
restores detail after several healthy measurement windows. The canvas continues
to fill the display at 1080p, 4K, 5K, portrait and ultrawide sizes. A large screen
does not require rendering every physical Retina pixel.

The live loop now starts once. Stitch geometry, camera crop coordinates, dither
thresholds, yarn sprites and palette luminance are cached. Camera frames are
sampled once per new decoded frame, independently of animation. A `currentTime`
check and cancellable timer support browsers without `requestVideoFrameCallback`.

Automatic face detection runs in a worker with one frame in flight, a 320-pixel
input and bounded initialization/inference timeouts. Its ES module WASM loader
and binary are included in `public/wasm`. Older browsers fall back to less frequent
main-thread inference, whose cadence responds to detection cost. “Toujours montrer
la caméra” avoids face detection entirely. Detection failures leave that mode
available. Camera stop closes the worker/detector, cancels sampling, releases the
stream and discards results from earlier sessions.

These choices follow the [MediaPipe implementation's synchronous detection
API](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/face_detector/face_detector.ts)
and [video frame callback semantics](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).

Studio settings update labels, live sprites and autosave while the hidden still
renderer is deferred. Returning to the studio renders the latest composition.
Explicit snapshots, saved study thumbnails and vector export still request a
complete render. Motion growth uses a queue of active stitches, preserves their
original paint order, avoids canvas readback at completion and pauses while the
tab is hidden. Reduced-motion settings retain a 12 FPS live preview.

## Repeatable checks

```sh
npm test
npm run build
npm run benchmark
```

For a comparison with an earlier source file:

```sh
node scripts/benchmark-live.mjs --baseline /tmp/live-camera-before.js
```

The benchmark runs the actual live module in a deterministic DOM/canvas double.
It uses a 3840 × 2160 viewport, 100 warm-up frames and 600 measured frames.
Canvas calls do no painting; camera pixels and detection are simulated. These
measurements isolate JavaScript CPU work, not browser FPS, GPU work, physical
camera latency or face-detection performance.

| Draw loop | Previous median | Updated median |
| --- | ---: | ---: |
| Cloud | 3.194 ms | 0.898 ms |
| Synthetic camera | 5.248 ms | 0.266 ms |
| Animation callbacks pending after startup | 2 | 1 |

Tests cover exact palette/dither equivalence, face transition timing, 60/120/144 Hz
deadline pacing, adaptive quality, large-display pixel budgets, hidden-tab and
BFCache lifecycle, video-frame and timer sampling, camera cleanup, worker
backpressure, stale results, older-browser fallback, deferred studio rendering,
snapshots, motion seeking and looping.

## Verification still needed on hardware

Browser access was unavailable in this session. Visual fidelity, worker inference
with real frames, webcam permission flow, sustained browser FPS and heat/battery
behavior have **not** been verified on an older Mac or an external display.

Run `npm run dev`, use the printed local URL, enable the camera, and exercise both
automatic and always-camera modes on the target Mac and display. Check the
transition, mirror, density, Hide UI, studio return, motion playback, export and
tab switching. Read `window.loomLive.stats` in DevTools to see measured drawing
cost, quality level and detector mode; its `fps` is rendered live cadence over the
last measurement window, not the monitor refresh rate.
