// Loot on the ground: medkits (instant heal).
// Magnetised toward the player; after a wave clears everything left is vacuumed in.
import { LOOT } from './data.js';
import { addFloater } from './fx.js';

export function dropLoot(state, e) {
  if (state.rng.chance(LOOT.medkitChance)) spawnPickup(state, 'medkit', e.x, e.y, LOOT.medkitHeal);
}

function spawnPickup(state, kind, x, y, value) {
  const a = state.rng.angle(), sp = state.rng.range(60, 140);
  state.pickups.push({
    kind, value, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
    life: LOOT.life, ph: state.rng.angle(), pulled: false,
  });
}

export function vacuumPickups(state) {
  for (const k of state.pickups) k.pulled = true;
}

function collect(state, k) {
  const p = state.player;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + k.value);
  state.A.perk();
  const fr = state.atlas.phraseFrame.hp;
  if (fr) addFloater(state, p.x, p.y - 30, fr, { color: [140, 255, 140] });
  console.log('LOOT medkit +' + Math.round(p.hp - before) + ' HP');
}

export function updatePickups(state, dt) {
  const ks = state.pickups, p = state.player;
  if (!p || !p.alive) return;
  const magR = p.magnetR, pickR = LOOT.pickupR;
  for (let i = ks.length - 1; i >= 0; i--) {
    const k = ks[i];
    k.ph += dt;
    const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1;
    if (d < pickR) { collect(state, k); ks[i] = ks[ks.length - 1]; ks.pop(); continue; }
    if (!k.pulled && d < magR) k.pulled = true;
    if (k.pulled) {
      k.vx = (dx / d) * LOOT.pullSpeed; k.vy = (dy / d) * LOOT.pullSpeed;
    } else {
      k.life -= dt;
      if (k.life <= 0) { ks[i] = ks[ks.length - 1]; ks.pop(); continue; }
      const drag = 1 / (1 + 5 * dt);
      k.vx *= drag; k.vy *= drag;
    }
    k.x += k.vx * dt; k.y += k.vy * dt;
  }
}

export function drawPickups(R, state) {
  const ks = state.pickups;
  for (let i = 0; i < ks.length; i++) {
    const k = ks[i];
    const bob = Math.sin(k.ph * 5) * 2.5;
    // Blink during the last 3 seconds before vanishing.
    const a = !k.pulled && k.life < 3 && Math.floor(k.life * 8) % 2 === 0 ? 0.35 : 1;
    R.draw('shadow', k.x, k.y + 9, { w: 18, h: 8, a: 0.35 * a });
    R.draw('medkit', k.x, k.y - 4 + bob, { a });
  }
}
