// Hero's contextual actions: finish off / take prisoner a downed enemy, evacuate a wounded comrade.
import { DOWN, EBALY, PALETTE as P } from './data.js';
import { burst } from './fx.js';
import { resolveDowned } from './enemies.js';

function nearestDowned(state) {
  const p = state.player, r2 = (DOWN.actR + p.radius) ** 2;
  let best = null, bestD = r2;
  for (const e of state.enemies) {
    if (!e.alive || !e.downed) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

// Called from the HUD buttons.
export function finishDowned(state) {
  const e = nearestDowned(state);
  if (!e) return;
  state.A.shoot();
  burst(state, e.x, e.y, { n: 6, color: P.muzzle, speed: 90, size: 8, life: 0.3 });
  resolveDowned(state, e, 'finish');
  console.log('ACT finish ' + e.def.sprite);
}

export function startCapture(state) {
  const e = nearestDowned(state);
  if (!e) return;
  state.capturing = e;
  console.log('ACT capture start ' + e.def.sprite);
}

// Per frame: capture progress, evacuation, and which buttons to show.
export function updateActions(state, dt) {
  const p = state.player;
  if (!p || !p.alive) { state.hud.showActions(false); return; }

  const c = state.capturing;
  if (c) {
    const near = c.alive && c.downed && Math.hypot(c.x - p.x, c.y - p.y) < DOWN.actR + p.radius;
    if (!near) { if (c.alive) c.captureP = 0; state.capturing = null; }
    else {
      c.captureP += dt;
      c.downT = Math.max(c.downT, 1); // he won't get up while being tied
      if (c.captureP >= DOWN.captureT) { resolveDowned(state, c, 'capture'); state.capturing = null; }
    }
  }
  const target = nearestDowned(state);
  state.hud.showActions(!!target, !!state.capturing);

  updateWounded(state, dt);
}

// ---- wounded comrade: stand by him to load him out; he bleeds out if you take too long ----

export function placeWounded(state) {
  const w = state.world, rng = state.rng;
  w.wounded = null;
  if (!rng.chance(EBALY.woundedChance)) return;
  for (let tries = 0; tries < 30; tries++) {
    const x = rng.range(w.wt + 80, w.w - w.wt - 80), y = rng.range(w.wt + 80, w.h * 0.6);
    let bad = false;
    for (const o of w.obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + 50) { bad = true; break; }
    if (!bad) { w.wounded = { x, y, ph: 0, bleed: EBALY.bleed, hold: 0 }; return; }
  }
}

function floatPhrase(state, x, y, text, col) {
  const fr = state.atlas.phraseFrame[text];
  if (fr) state.fx.floaters.push({ x, y, vy: -40, life: 1.4, maxLife: 1.4, spr: fr, scale: 0.85, r: col[0], g: col[1], b: col[2] });
}

function updateWounded(state, dt) {
  const w = state.world, p = state.player, u = w && w.wounded;
  if (!u) return;
  u.ph += dt;
  u.bleed -= dt;
  if (u.bleed <= 0) {
    floatPhrase(state, u.x, u.y - 30, 'Не встигли...', [1, 0.6, 0.6]);
    console.log('EVAC failed: bled out');
    w.wounded = null;
    return;
  }
  const near = Math.hypot(p.x - u.x, p.y - u.y) < EBALY.evacR + p.radius;
  u.hold = near ? u.hold + dt : Math.max(0, u.hold - dt * 2);
  if (u.hold < EBALY.evacHold) return;
  state.stats.pending += EBALY.evac;
  state.stats.evacuated++;
  floatPhrase(state, u.x, u.y - 30, 'Евакуйовано!', [0.7, 1, 0.7]);
  state.A.perk();
  burst(state, u.x, u.y, { n: 10, color: P.white, speed: 120, size: 10, life: 0.5 });
  console.log('EVAC +' + EBALY.evac + ' pending');
  w.wounded = null;
}

export function drawWounded(R, state) {
  const u = state.world && state.world.wounded;
  if (!u) return;
  R.draw('shadow', u.x, u.y + 10, { w: 44, h: 16, a: 0.4 });
  R.draw('wounded', u.x, u.y, { rot: -0.3 });
  const urgent = u.bleed < 12;
  const pulse = 0.6 + 0.4 * Math.sin(u.ph * (urgent ? 14 : 6));
  R.draw('medcross', u.x, u.y - 34 - Math.sin(u.ph * 3) * 3, { a: pulse });
  // Bleed-out timer (red) and loading progress (green).
  const bw = 40, y = u.y + 22;
  R.draw('white', u.x, y, { w: bw + 2, h: 6, r: 0, g: 0, b: 0, a: 0.5 });
  const t = Math.max(0, u.bleed / EBALY.bleed);
  R.draw('white', u.x - bw / 2 + (bw * t) / 2, y, { w: bw * t, h: 4, r: 0.9, g: 0.25, b: 0.2 });
  if (u.hold > 0) {
    const c = Math.min(1, u.hold / EBALY.evacHold);
    R.draw('white', u.x - bw / 2 + (bw * c) / 2, y - 7, { w: bw * c, h: 4, r: 0.5, g: 1, b: 0.5 });
  }
}
