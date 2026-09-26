// Small math helpers. Pure, no state.
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const len = (x, y) => Math.hypot(x, y);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

export function norm(x, y) {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

// Move v toward target by at most step.
export const approach = (v, t, step) => (v < t ? Math.min(v + step, t) : Math.max(v - step, t));

// Cosmetic (non-deterministic) jitter — fine for visual fx, never for gameplay logic.
export const jitter = (a) => (Math.random() * 2 - 1) * a;
export const randf = (a, b) => a + Math.random() * (b - a);
