// Quality follows measured cost rather than screen size or a Mac model name.
export class LivePerformance {
  constructor({ compact = false, reducedMotion = false } = {}) {
    this.compact = compact;
    this.reducedMotion = reducedMotion;
    this.level = compact ? 1 : 0;
    this.averageMs = 0;
    this.fps = 0;
    this.resetWindow();
  }
  resetWindow() { this.frames = 0; this.totalMs = 0; this.late = 0; this.windowStart = 0; }
  get frameInterval() { return 1000 / (this.reducedMotion ? 12 : 30); }
  get maxCells() { return this.reducedMotion ? 2600 : [7200, 5400, 3800, 2600][this.level]; }
  get pixelBudget() { return [1200000, 850000, 600000, 420000][this.level]; }
  observe(cost, elapsed, now) {
    if (!this.windowStart) this.windowStart = now;
    this.totalMs += cost;
    this.frames++;
    if (elapsed > this.frameInterval * 1.65) this.late++;
    const span = now - this.windowStart;
    if (span < 1800 || this.frames < 12) return false;
    this.averageMs = this.totalMs / this.frames;
    this.fps = (this.frames - 1) * 1000 / span;
    const previous = this.level;
    if (this.averageMs > 18 || this.late / this.frames > .18) {
      this.level = Math.min(3, this.level + 1);
      this.healthyWindows = 0;
    } else if (this.averageMs < 9 && this.late / this.frames < .04) {
      this.healthyWindows = (this.healthyWindows || 0) + 1;
      if (this.healthyWindows >= 4) {
        this.level = Math.max(this.compact ? 1 : 0, this.level - 1);
        this.healthyWindows = 0;
      }
    } else this.healthyWindows = 0;
    this.resetWindow();
    return previous !== this.level;
  }
}

export function canvasSize(width, height, dpr, budget) {
  const scale = Math.min(1.25, dpr || 1, 1920 / width, 1920 / height,
    Math.sqrt(budget / Math.max(1, width * height)));
  return [Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale))];
}

// Keep the deadline anchored to the refresh clock (30 FPS on 60/120 Hz screens).
// Reset after a long interruption instead of replaying missed frames.
export function nextFrameDeadline(deadline, now, interval) {
  if (!deadline || now - deadline > interval * 3) return now + interval;
  return deadline + (Math.floor(Math.max(0, now - deadline) / interval) + 1) * interval;
}
