// Visual juice: particles, floating comic text, damage numbers, screen shake.
// Operates on state.fx = { particles:[], floaters:[] }. Cosmetic only.
import { PALETTE as P } from './data.js';

const n255 = (c) => [c[0] / 255, c[1] / 255, c[2] / 255];

export function burst(state, x, y, opts = {}) {
  const rng = state.rng;
  const num = opts.n == null ? 8 : opts.n;
  const col = opts.color ? n255(opts.color) : [1, 1, 1];
  const ps = state.fx.particles;
  for (let i = 0; i < num; i++) {
    const a = rng.angle();
    const sp = (opts.speed == null ? 130 : opts.speed) * (0.4 + rng.next() * 0.9);
    ps.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0),
      life: opts.life == null ? 0.5 : opts.life,
      maxLife: opts.life == null ? 0.5 : opts.life,
      size: (opts.size == null ? 10 : opts.size) * (0.6 + rng.next() * 0.8),
      spr: opts.spr || 'soft',
      r: col[0], g: col[1], b: col[2], a: opts.a == null ? 1 : opts.a,
      grav: opts.grav || 0, drag: opts.drag == null ? 3.2 : opts.drag,
      rot: rng.angle(), vr: (rng.next() * 2 - 1) * (opts.spin || 5),
      shrink: opts.shrink !== false,
    });
  }
}

// Single thrown object (e.g. flying pants gag).
export function throwSprite(state, x, y, spr, opts = {}) {
  const rng = state.rng;
  const a = -Math.PI / 2 + rng.range(-0.9, 0.9);
  const sp = opts.speed == null ? 180 : opts.speed;
  state.fx.particles.push({
    x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
    life: 1.0, maxLife: 1.0, size: opts.size || 22, spr,
    r: 1, g: 1, b: 1, a: 1, grav: 420, drag: 0.4,
    rot: rng.angle(), vr: (rng.next() * 2 - 1) * 10, shrink: false,
  });
}

export function addFloater(state, x, y, spr, opts = {}) {
  const col = opts.color ? n255(opts.color) : [1, 0.95, 0.78];
  state.fx.floaters.push({
    x: x + (opts.jx || 0), y, vy: opts.vy == null ? -52 : opts.vy,
    life: opts.life || 1.05, maxLife: opts.life || 1.05,
    spr, scale: opts.scale || 0.85, r: col[0], g: col[1], b: col[2],
  });
}

// Comic shout above an entity: a random baked line of the category in the current language.
export function shout(state, x, y, list) {
  const n = state.atlas.shoutCount[list];
  if (!n) return;
  const frame = state.atlas.phraseFrame['sh.' + list + '.' + state.rng.int(0, n - 1)];
  if (frame) addFloater(state, x, y - 22, frame, { scale: 0.8, jx: state.rng.range(-6, 6) });
}

function digitGlyphs(n) {
  const out = [];
  for (const ch of String(Math.max(1, Math.round(n)))) out.push('d' + ch);
  return out;
}

// Damage number assembled from baked digit glyphs.
export function addDamage(state, x, y, amount) {
  state.fx.floaters.push({
    x, y, vy: -70, life: 0.7, maxLife: 0.7, digits: digitGlyphs(amount), scale: 0.7,
    r: 1, g: 0.9, b: 0.5,
  });
}

// "+3 єБ" reward popup on a kill.
export function addEbaly(state, x, y, amount) {
  state.fx.floaters.push({
    x, y, vy: -60, life: 1.0, maxLife: 1.0, digits: ['dplus', ...digitGlyphs(amount), 'deb'], scale: 0.8,
    r: 1, g: 0.84, b: 0.3,
  });
}

// Big explosion (FPV drone): flash, fireball, shockwave ring, sparks, lingering smoke, scorch mark on the ground.
export function addExplosion(state, x, y, r) {
  state.fx.explosions.push({ x, y, r, t: 0, dur: 0.75, rot: state.rng.angle() });
  burst(state, x, y, { n: 18, color: [255, 200, 90], speed: r * 5, size: 7, life: 0.45, drag: 2.2 });           // sparks
  burst(state, x, y, { n: 10, color: [255, 120, 40], speed: r * 2.5, size: 20, life: 0.5, drag: 3 });          // flames
  burst(state, x, y, { n: 14, color: [70, 64, 58], speed: r * 1.3, size: 34, life: 1.6, a: 0.55, drag: 1.6, up: 40 }); // smoke
  burst(state, x, y, { n: 8, color: P.dirtDk, speed: r * 3, size: 8, life: 0.9, grav: 420, drag: 0.8, up: 160 }); // clods
  const w = state.world;
  if (w) w.decals.push({ x, y, s: r / 40, rot: state.rng.angle() });
}

export function drawExplosions(R, state) {
  const ex = state.fx.explosions;
  for (let i = 0; i < ex.length; i++) {
    const e = ex[i], k = e.t / e.dur;
    if (k < 0.18) R.draw('soft', e.x, e.y, { w: e.r * 3.2, h: e.r * 3.2, a: 1 - k / 0.18 });                  // flash
    const fb = k < 0.3 ? 0.35 + (k / 0.3) * 0.85 : 1.2 - (k - 0.3) * 0.5;
    R.draw('fireball', e.x, e.y, { w: e.r * 2 * fb, h: e.r * 2 * fb, rot: e.rot + k, a: Math.max(0, 1 - k * 1.25) });
    const rr = e.r * (0.3 + k * 1.1);
    R.draw('ring', e.x, e.y, { w: rr * 2, h: rr * 2, a: Math.max(0, 0.85 - k) });                          // shockwave
  }
}

export function shake(state, amt) {
  state.cam.shake = Math.min((state.cam.shake || 0) + amt, 28);
}

export function updateFx(state, dt) {
  const ex = state.fx.explosions;
  for (let i = ex.length - 1; i >= 0; i--) { ex[i].t += dt; if (ex[i].t >= ex[i].dur) { ex[i] = ex[ex.length - 1]; ex.pop(); } }
  const ps = state.fx.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
    const k = 1 / (1 + p.drag * dt);
    p.vx *= k; p.vy = p.vy * k + p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  const fs = state.fx.floaters;
  for (let i = fs.length - 1; i >= 0; i--) {
    const f = fs[i];
    f.life -= dt;
    if (f.life <= 0) { fs[i] = fs[fs.length - 1]; fs.pop(); continue; }
    f.y += f.vy * dt; f.vy *= 0.9;
  }
}

export function drawParticles(R, state) {
  const ps = state.fx.particles;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const t = p.life / p.maxLife;
    const sz = p.shrink ? p.size * (0.35 + 0.65 * t) : p.size;
    R.draw(p.spr, p.x, p.y, { w: sz, h: sz, rot: p.rot, r: p.r, g: p.g, b: p.b, a: p.a * Math.min(1, t * 1.6) });
  }
}

export function drawFloaters(R, state) {
  const fs = state.fx.floaters;
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i];
    const a = Math.min(1, f.life * 4);
    if (f.digits) {
      let tw = 0;
      for (const nm of f.digits) tw += R.frame(nm).w * f.scale;
      let x = f.x - tw / 2;
      for (const nm of f.digits) {
        const fr = R.frame(nm);
        const fw = fr.w * f.scale, fh = fr.h * f.scale;
        R.draw(nm, x + fw / 2, f.y, { w: fw, h: fh, r: f.r, g: f.g, b: f.b, a });
        x += fw;
      }
    } else {
      const fr = R.frame(f.spr);
      if (fr) R.draw(f.spr, f.x, f.y, { w: fr.w * f.scale, h: fr.h * f.scale, r: f.r, g: f.g, b: f.b, a });
    }
  }
}

export const FX_COLORS = { ouch: P.blood, dust: P.dust, muzzle: P.muzzle, pink: P.pink };
