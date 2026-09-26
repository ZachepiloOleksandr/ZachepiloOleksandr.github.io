// Маркет tech in the field: FPV drones hover by the hero and strike only when the 🚁 button is pressed.
// Target priority: a vehicle on screen (a drone kills a Niva together with its crew), else the nearest foe.
import { DRONE, PALETTE as P } from './data.js';
import { burst, shake } from './fx.js';
import { onScreen } from './world.js';
import { damageEnemy, resolveDowned } from './enemies.js';

export function resetDrones(state) {
  const p = state.player, n = p.fpv >= 3 ? 2 : p.fpv > 0 ? 1 : 0;
  state.drones.length = 0;
  for (let i = 0; i < n; i++) state.drones.push({ x: p.x, y: p.y, ang: i * Math.PI, mode: 'orbit', cd: 0, target: null });
}

function recharge(p) { return Math.max(4, DRONE.cd - DRONE.cdPerLvl * (p.fpv - 1)); }

function pickTarget(state) {
  const p = state.player, r2 = DRONE.range * DRONE.range;
  let car = null, carD = Infinity, near = null, nearD = Infinity;
  for (const e of state.enemies) {
    if (!e.alive || e.downed || !onScreen(state, e.x, e.y)) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d > r2) continue;
    if (e.def.vehicle && d < carD) { car = e; carD = d; }
    if (d < nearD) { near = e; nearD = d; }
  }
  return car || near;
}

// HUD info for the button: how many drones are ready and the soonest recharge.
export function droneStatus(state) {
  let ready = 0, next = Infinity;
  for (const d of state.drones) {
    if (d.mode === 'orbit' && d.cd <= 0) ready++;
    else if (d.mode === 'orbit') next = Math.min(next, d.cd);
  }
  return { owned: state.drones.length, ready, next: next === Infinity ? 0 : next };
}

// Button press. Returns true if a drone was launched.
export function launchDrone(state) {
  if (state.status !== 'playing') return false;
  const d = state.drones.find((x) => x.mode === 'orbit' && x.cd <= 0);
  if (!d) return false;
  const t = pickTarget(state);
  if (!t) { console.log('FPV: no target on screen'); return false; }
  d.mode = 'dive'; d.target = t;
  state.A.start();
  console.log('FPV launch → ' + t.def.sprite);
  return true;
}

function strike(state, d, target) {
  const r2 = DRONE.blastR * DRONE.blastR, dmg = DRONE.dmg + DRONE.dmgPerWave * state.wave.index;
  let hits = 0;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const dx = e.x - d.x, dy = e.y - d.y;
    if (dx * dx + dy * dy > r2 && e !== target) continue;
    hits++;
    if (e.downed) resolveDowned(state, e, 'finish');
    else damageEnemy(state, e, e === target && e.def.vehicle ? e.hp + 1 : dmg, 'drone');
  }
  burst(state, d.x, d.y, { n: 14, color: P.muzzle, speed: 220, size: 14, life: 0.45 });
  burst(state, d.x, d.y, { n: 8, color: P.dust, speed: 120, size: 16, life: 0.6 });
  shake(state, 7);
  state.A.enemyDie();
  console.log('FPV strike hits=' + hits + ' dmg=' + dmg);
}

export function updateDrones(state, dt) {
  const p = state.player;
  if (!p || !p.alive || !state.drones.length) return;
  for (const d of state.drones) {
    if (d.mode === 'orbit') {
      d.ang += dt * 2.4;
      const tx = p.x + Math.cos(d.ang) * DRONE.orbitR, ty = p.y + Math.sin(d.ang) * DRONE.orbitR - 18;
      const k = Math.min(1, 8 * dt);
      d.x += (tx - d.x) * k; d.y += (ty - d.y) * k;
      d.cd = Math.max(0, d.cd - dt);
      continue;
    }
    const t = d.target;
    if (!t || !t.alive || t.downed) { d.mode = 'orbit'; d.target = null; continue; } // target gone: drone returns, stays ready
    const dx = t.x - d.x, dy = t.y - d.y, dist = Math.hypot(dx, dy) || 1;
    const step = DRONE.speed * dt;
    if (dist <= step + t.radius * 0.5) {
      d.x = t.x; d.y = t.y;
      strike(state, d, t);
      d.mode = 'orbit'; d.cd = recharge(p); d.target = null;
      d.x = p.x; d.y = p.y; // a fresh drone launches from the hero
    } else { d.x += (dx / dist) * step; d.y += (dy / dist) * step; }
  }
}

export function drawDrones(R, state) {
  for (const d of state.drones) {
    const diving = d.mode === 'dive' && d.target;
    const rot = diving ? Math.atan2(d.target.y - d.y, d.target.x - d.x) : state.time * 3;
    const a = !diving && d.cd > 0 ? 0.45 : 1; // recharging drones look dim
    R.draw('shadow', d.x, d.y + 22, { w: 18, h: 8, a: 0.3 * a });
    R.draw('drone', d.x, d.y, { rot, a });
  }
}
