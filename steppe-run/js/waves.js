// Wave director: announces each room's wave, trickles enemies in, detects clear.
import { clamp } from './math.js';
import { waveComposition } from './data.js';
import { spawnEnemy } from './enemies.js';

export function startRun(state) {
  state.stats.kills = 0;
  startWave(state, 1);
}

export function startWave(state, n) {
  const w = state.wave;
  w.index = n;
  const q = waveComposition(n);
  for (let i = q.length - 1; i > 0; i--) {
    const j = state.rng.int(0, i);
    const t = q[i]; q[i] = q[j]; q[j] = t;
  }
  w.queue = q;
  w.phase = 'intro';
  w.introT = 1.6;
  w.spawnCd = 0.4;
  state.hud.setWave(n);
  state.onBanner('Хвиля ' + n);
}

function spawnInRoom(state, type) {
  const p = state.player, w = state.world, rng = state.rng;
  const mx = w.wt + 30, Mx = w.w - w.wt - 30, my = w.wt + 30, My = w.h - w.wt - 30;
  for (let tries = 0; tries < 30; tries++) {
    // Spawn anywhere on the (large) map, just not right on top of the player.
    const x = rng.range(mx, Mx), y = rng.range(my, My);
    if (Math.hypot(x - p.x, y - p.y) < 220) continue;
    let bad = false;
    for (const o of w.obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + 30) { bad = true; break; }
    if (bad) continue;
    spawnEnemy(state, type, x, y);
    return;
  }
  spawnEnemy(state, type, clamp(p.x + 240, mx, Mx), clamp(p.y - 240, my, My));
}

export function updateWaves(state, dt) {
  const w = state.wave;
  if (w.phase === 'intro') {
    w.introT -= dt;
    if (w.introT <= 0) w.phase = 'fighting';
    return;
  }
  if (w.phase === 'fighting') {
    w.spawnCd -= dt;
    if (w.queue.length > 0 && w.spawnCd <= 0) {
      spawnInRoom(state, w.queue.pop());
      w.spawnCd = Math.max(0.18, 0.65 - w.index * 0.025);
    }
    if (w.queue.length === 0 && state.enemies.length === 0) {
      w.phase = 'cleared';
      state.onWaveCleared();
    }
  }
}
