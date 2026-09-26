// Маркет tech in the field: FPV drones that orbit the hero and dive into enemies,
// and the wounded comrade the hero can evacuate for єБали.
import { DRONE, EBALY, PALETTE as P } from './data.js';
import { burst, shake, addDamage, addEbaly } from './fx.js';
import { findNearest } from './bullets.js';

export function resetDrones(state) {
  const p = state.player, n = p.fpv >= 3 ? 2 : p.fpv > 0 ? 1 : 0;
  state.drones.length = 0;
  for (let i = 0; i < n; i++) {
    state.drones.push({ x: p.x, y: p.y, ang: i * Math.PI, mode: 'orbit', cd: DRONE.cd * (0.5 + i * 0.5), target: null });
  }
}

function strike(state, d) {
  const r2 = DRONE.blastR * DRONE.blastR, dmg = DRONE.dmg + DRONE.dmgPerWave * state.wave.index;
  let hits = 0;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const dx = e.x - d.x, dy = e.y - d.y;
    if (dx * dx + dy * dy > r2) continue;
    e.hp -= dmg; e.hurtT = 0.15; e.squash = 1; hits++;
    addDamage(state, e.x, e.y - e.radius, dmg);
    if (e.hp <= 0) e.alive = false;
  }
  burst(state, d.x, d.y, { n: 14, color: P.muzzle, speed: 220, size: 14, life: 0.45 });
  burst(state, d.x, d.y, { n: 8, color: P.dust, speed: 120, size: 16, life: 0.6 });
  shake(state, 6);
  state.A.enemyDie();
  console.log('FPV strike hits=' + hits + ' dmg=' + dmg);
}

export function updateDrones(state, dt) {
  const p = state.player;
  if (!p || !p.alive || !state.drones.length) return;
  const cd = Math.max(1.2, DRONE.cd - DRONE.cdPerLvl * (p.fpv - 1));
  for (const d of state.drones) {
    if (d.mode === 'orbit') {
      d.ang += dt * 2.4;
      const tx = p.x + Math.cos(d.ang) * DRONE.orbitR, ty = p.y + Math.sin(d.ang) * DRONE.orbitR - 18;
      const k = Math.min(1, 8 * dt);
      d.x += (tx - d.x) * k; d.y += (ty - d.y) * k;
      d.cd -= dt;
      if (d.cd <= 0 && state.status === 'playing') {
        const t = findNearest(state, p.x, p.y, 520, true);
        if (t) { d.mode = 'dive'; d.target = t; } else d.cd = 0.4;
      }
    } else {
      const t = d.target;
      if (!t || !t.alive) { d.mode = 'orbit'; d.cd = 0.5; continue; }
      const dx = t.x - d.x, dy = t.y - d.y, dist = Math.hypot(dx, dy) || 1;
      const step = DRONE.speed * dt;
      if (dist <= step + t.radius * 0.5) {
        d.x = t.x; d.y = t.y;
        strike(state, d);
        d.mode = 'orbit'; d.cd = cd; d.target = null;
        d.x = p.x; d.y = p.y; // a fresh drone launches from the hero
      } else { d.x += (dx / dist) * step; d.y += (dy / dist) * step; }
    }
  }
}

export function drawDrones(R, state) {
  for (const d of state.drones) {
    const rot = d.mode === 'dive' && d.target ? Math.atan2(d.target.y - d.y, d.target.x - d.x) : state.time * 3;
    R.draw('shadow', d.x, d.y + 22, { w: 18, h: 8, a: 0.3 });
    R.draw('drone', d.x, d.y, { rot });
  }
}

// ---- wounded comrade (evacuation = єБали, like НРК evac missions) ----
export function placeWounded(state) {
  const w = state.world, rng = state.rng;
  w.wounded = null;
  if (!rng.chance(EBALY.woundedChance)) return;
  for (let tries = 0; tries < 30; tries++) {
    const x = rng.range(w.wt + 80, w.w - w.wt - 80), y = rng.range(w.wt + 80, w.h * 0.6);
    let bad = false;
    for (const o of w.obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + 50) { bad = true; break; }
    if (!bad) { w.wounded = { x, y, ph: 0 }; return; }
  }
}

export function updateWounded(state, dt) {
  const w = state.world, p = state.player, u = w && w.wounded;
  if (!u || !p || !p.alive) return;
  u.ph += dt;
  if (Math.hypot(p.x - u.x, p.y - u.y) > EBALY.evacR + p.radius) return;
  state.stats.pending += EBALY.evac;
  addEbaly(state, u.x, u.y - 30, EBALY.evac);
  state.onBanner('Евакуйовано пораненого! +' + EBALY.evac);
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
  const pulse = 0.6 + 0.4 * Math.sin(u.ph * 6);
  R.draw('medcross', u.x, u.y - 34 - Math.sin(u.ph * 3) * 3, { a: pulse });
}
