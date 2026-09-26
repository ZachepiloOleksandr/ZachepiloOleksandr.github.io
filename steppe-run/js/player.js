// Hero: joystick-driven movement, obstacle resolution, auto-aim at the nearest enemy.
import { clamp, lerp, angleTo } from './math.js';
import { findNearest } from './bullets.js';
import { resolveCircle } from './world.js';
import { LOOT, CHAR_SCALE } from './data.js';

export function createPlayer(state) {
  const w = state.world;
  state.player = {
    x: w.w / 2, y: w.h / 2, vx: 0, vy: 0,
    radius: 17,
    hp: 100, maxHp: 100,
    speed: 200,
    fireRate: 3.2,   // shots per second
    fireCd: 0,
    damage: 9,
    bulletSpeed: 640,
    range: 430,
    multishot: 0,    // extra pellets beyond the first
    pierce: 0,
    magnetR: LOOT.magnetR,
    aim: 0,
    walk: 0,
    hurtT: 0,
    alive: true,
  };
}

export function updatePlayer(state, dt) {
  const p = state.player;
  const inp = state.input;
  if (!p.alive) return;

  // Joystick components already carry magnitude (each in -1..1).
  const tvx = inp.x * p.speed;
  const tvy = inp.y * p.speed;
  const accel = Math.min(1, 16 * dt);
  p.vx = lerp(p.vx, tvx, accel);
  p.vy = lerp(p.vy, tvy, accel);
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // Resolve against room walls and solid cover.
  const res = resolveCircle(state.world, p.x, p.y, p.radius);
  p.x = res[0]; p.y = res[1];
  const w = state.world, m = w.wt + p.radius;
  p.x = clamp(p.x, m, w.w - m);
  p.y = clamp(p.y, m, w.h - m);

  // Auto-aim: face the nearest enemy (track even slightly beyond fire range).
  const target = findNearest(state, p.x, p.y, p.range * 1.6, true);
  if (target) p.aim = angleTo(p.x, p.y, target.x, target.y);

  // Walk cycle for a subtle bob.
  const sp = Math.hypot(p.vx, p.vy);
  p.walk += sp * dt * 0.05;
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.fireCd -= dt;
}

export function drawPlayer(R, state) {
  const p = state.player;
  const bob = Math.sin(p.walk * 1.2) * 1.6;
  const flashing = p.hurtT > 0 && (Math.floor(p.hurtT * 30) % 2 === 0);
  const tint = flashing ? { r: 1, g: 0.5, b: 0.5 } : {};
  R.draw('soldier', p.x, p.y - 2 + bob, { rot: p.aim, sx: CHAR_SCALE, sy: CHAR_SCALE, r: tint.r, g: tint.g, b: tint.b });
}
