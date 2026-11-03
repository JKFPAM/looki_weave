import test from 'node:test';
import assert from 'node:assert/strict';
import { FacePresence, coverUV, cloudField, luminance, liveColour } from './live-dynamics.js';

test('cloud, camera and every transition use only exact chosen colours', () => {
  const palette = [[19, 33, 107], [42, 86, 193], [173, 208, 251]];
  const tones = palette.slice().sort((a, b) => luminance(a) - luminance(b));
  for (const camera of [null, [255, 0, 0], [0, 255, 0], [255, 255, 255], [0, 0, 0]]) {
    for (let blend = 0; blend <= 1.01; blend += .1) for (let field = 0; field <= 1.01; field += .1) {
      for (let y = -1; y < 4; y++) for (let x = -1; x < 4; x++) {
        assert.ok(palette.includes(liveColour(palette, tones, field, camera, blend, x, y)));
      }
    }
  }
  assert.deepEqual(liveColour(palette, tones, .5, [0, 0, 0], 1, 0, 0), palette[0]);
  assert.deepEqual(liveColour(palette, tones, .5, [255, 255, 255], 1, 0, 0), palette[2]);
});

test('palette changes and equal brightness colours do not introduce RGB interpolation', () => {
  const palette = [[20, 20, 20], [20, 20, 20]];
  assert.deepEqual(liveColour(palette, palette, 1, [200, 5, 5], 1, 1, 1), palette[0]);
  const replacement = [[201, 62, 133]];
  assert.deepEqual(liveColour(replacement, replacement, .5, [0, 255, 0], .5, 2, 2), replacement[0]);
});

test('detected face reveals camera; brief missed frames do not flicker; disappearance restores cloud', () => {
  const d = new FacePresence(); let result;
  for (let t = 0; t < 2500; t += 200) result = d.update(false, t);
  assert.equal(result.amount, 0);
  for (let t = 2500; t < 5500; t += 200) result = d.update(true, t);
  assert.ok(result.amount > .95);
  result = d.update(false, 5600);
  assert.ok(result.amount > .95, 'a single missed detection must keep the face visible');
  for (let t = 5800; t < 10500; t += 200) result = d.update(false, t);
  assert.ok(result.amount < .2);
});

test('portrait and landscape camera mappings preserve proportions', () => {
  assert.deepEqual(coverUV(.5, .5, 4 / 3, 9 / 16), [.5, .5]);
  assert.ok(coverUV(0, 0, 4 / 3, 9 / 16)[0] > 0);
  assert.ok(coverUV(0, 0, 4 / 3, 16 / 9)[1] > 0);
});

test('cloud changes smoothly over time and stays bounded', () => {
  for (let t = 0; t < 60; t += .25) {
    const a = cloudField(.3, .7, t), b = cloudField(.3, .7, t + .05);
    assert.ok(a >= 0 && a <= 1);
    assert.ok(Math.abs(a - b) < .02);
  }
  assert.notEqual(cloudField(.3, .7, 0), cloudField(.3, .7, 10));
});
