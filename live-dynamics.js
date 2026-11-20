export const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));

export const luminance = rgb => rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const thresholdAt = (x, y) => (bayer[((y % 4 + 4) % 4) * 4 + ((x % 4 + 4) % 4)] + .5) / 16;

// Every stitch keeps an exact chosen yarn colour. Transitions exchange stitches,
// instead of mixing RGB values that would introduce colours outside the palette.
export function liveColour(palette, tonalPalette, field, cameraRGB, blend, x, y) {
  if (cameraRGB && clamp(blend) > thresholdAt(x + 1, y + 2)) {
    const light = luminance(cameraRGB);
    let high = tonalPalette.findIndex(colour => luminance(colour) >= light);
    if (high < 0) return tonalPalette[tonalPalette.length - 1];
    if (high === 0) return tonalPalette[0];
    const low = tonalPalette[high - 1];
    const upper = tonalPalette[high];
    const fraction = (light - luminance(low)) / Math.max(.001, luminance(upper) - luminance(low));
    return fraction > thresholdAt(x, y) ? upper : low;
  }
  const position = clamp(field) * (palette.length - 1);
  const low = Math.floor(position);
  return palette[Math.min(palette.length - 1, low + (position - low > thresholdAt(x, y) ? 1 : 0))];
}

// Resolve palette luminance once per settings edit. The live loop passes scalar
// samples and precomputed dither thresholds, avoiding per-stitch RGB arrays.
export function createColourSelector(palette) {
  const tones = palette.map((colour, index) => ({ index, light: luminance(colour) })).sort((a, b) => a.light - b.light);
  return (field, light, blend, threshold, transition) => {
    if (light >= 0 && blend > transition) {
      let high = 0;
      while (high < tones.length && tones[high].light < light) high++;
      if (high === 0) return tones[0].index;
      if (high === tones.length) return tones[high - 1].index;
      const low = tones[high - 1], upper = tones[high];
      return (light - low.light) / Math.max(.001, upper.light - low.light) > threshold ? upper.index : low.index;
    }
    const position = clamp(field) * (palette.length - 1), low = Math.floor(position);
    return Math.min(palette.length - 1, low + (position - low > threshold ? 1 : 0));
  };
}

export const ditherThreshold = thresholdAt;

// Slowly evolving, continuous fields: no random seed jumps between frames.
export function cloudField(x, y, time) {
  const u = x * 3.1 + Math.sin(y * 3.8 + time * .13) * .8;
  const v = y * 3.3 + Math.cos(x * 3.2 - time * .11) * .7;
  return clamp(.5 + .23 * Math.sin(u + time * .15)
    + .17 * Math.cos(v - time * .12) + .1 * Math.sin(u + v + time * .09));
}

// Crop camera coordinates to cover the stage, without stretching the person.
export function coverUV(x, y, sourceAspect, targetAspect) {
  return sourceAspect > targetAspect
    ? [.5 + (x - .5) * targetAspect / sourceAspect, y]
    : [x, .5 + (y - .5) * sourceAspect / targetAspect];
}

// A short hold prevents flicker when the detector briefly loses a moving face.
export class FacePresence {
  constructor() { this.reset(); }
  reset() { this.seenUntil = 0; this.amount = 0; this.visible = false; this.lastUpdate = null; }
  update(found, now) {
    if (found) this.seenUntil = now + 1100;
    this.visible = found || now < this.seenUntil;
    const target = this.visible ? 1 : 0;
    const dt = this.lastUpdate === null ? 200 : Math.max(0, Math.min(250, now - this.lastUpdate));
    this.lastUpdate = now;
    this.amount += (target - this.amount) * (1 - Math.exp(-dt / (target ? 800 : 2600)));
    return { amount: this.amount, visible: this.visible };
  }
}

