// Projectiles & combat resolution. Player auto-fires at the nearest in-range enemy.
// Enemy bullets hurt the player AND other enemies (friendly fire — they shoot their own).
import { angleTo } from './math.js';
import { burst, addDamage, shake, FX_COLORS } from './fx.js';
import { PALETTE as P } from './data.js';
import { pointSolidHit, onScreen } from './world.js';

export function findNearest(state, x, y, maxR, visibleOnly) {
  const en = state.enemies;
  let best = null, bestD = maxR * maxR;
  for (let i = 0; i < en.length; i++) {
    const e = en[i];
    if (!e.alive) continue;
    if (visibleOnly && !onScreen(state, e.x, e.y)) continue;
    const dx = e.x - x, dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = e; }
  }
  return best;
}

export function updatePlayerFire(state, dt) {
  const p = state.player;
  if (!p.alive || state.status !== 'playing') return;
  if (p.fireCd > 0) return;
  const target = findNearest(state, p.x, p.y, p.range, true);
  if (!target) return;

  p.fireCd = 1 / p.fireRate;
  const base = angleTo(p.x, p.y, target.x, target.y);
  p.aim = base;
  const pellets = 1 + p.multishot;
  const step = 0.13;

  for (let i = 0; i < pellets; i++) {
    const a = base + (i - (pellets - 1) / 2) * step;
    const cos = Math.cos(a), sin = Math.sin(a);
    state.bullets.push({
      x: p.x + cos * 18, y: p.y + sin * 18,
      vx: cos * p.bulletSpeed, vy: sin * p.bulletSpeed,
      dmg: p.damage, team: 'p',
      life: p.range / p.bulletSpeed + 0.15,
      r: 6, pierce: p.pierce, hit: null,
    });
  }

  // Muzzle flash + a little kick.
  burst(state, p.x + Math.cos(base) * 20, p.y + Math.sin(base) * 20,
    { n: 1, spr: 'muzzle', size: 22, life: 0.07, speed: 0, color: P.muzzle, drag: 1 });
  state.A.shoot();
}

export function spawnEnemyBullet(state, x, y, angle, dmg, speed, opts = {}) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  state.bullets.push({
    x, y, vx: cos * speed, vy: sin * speed,
    dmg, team: 'e', life: opts.life || 2.6, r: opts.r || 6, pierce: 0, hit: null,
    spr: opts.spr || null, spin: !!opts.spin, owner: opts.owner || null,
  });
}

function hitEnemy(state, e, b) {
  e.hp -= b.dmg;
  e.hurtT = 0.12;
  e.squash = 1;
  const d = Math.hypot(b.vx, b.vy) || 1;
  e.x += (b.vx / d) * 6; e.y += (b.vy / d) * 6;
  burst(state, b.x, b.y, { n: 5, color: FX_COLORS.ouch, speed: 120, size: 8, life: 0.32 });
  addDamage(state, e.x, e.y - e.radius, b.dmg);
  state.A.enemyHurt();
  if (e.hp <= 0 && e.alive) e.alive = false;
}

export function hurtPlayer(state, amt) {
  const p = state.player;
  if (!p.alive || p.hurtT > 0) return;
  p.hp -= amt;
  p.hurtT = 0.5;
  state.A.playerHurt();
  shake(state, 12);
  burst(state, p.x, p.y, { n: 8, color: FX_COLORS.ouch, speed: 130, size: 9, life: 0.4 });
  if (p.hp <= 0) { p.hp = 0; p.alive = false; }
}

export function updateBullets(state, dt) {
  const bs = state.bullets;
  const en = state.enemies;
  const p = state.player;
  const w = state.world;

  for (let i = bs.length - 1; i >= 0; i--) {
    const b = bs[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0 || b.x < -40 || b.y < -40 || b.x > w.w + 40 || b.y > w.h + 40;

    // Walls, the closed door and cover stop bullets (no shooting through them).
    if (!dead && pointSolidHit(w, b.x, b.y)) dead = true;

    if (!dead) {
      if (b.team === 'p') {
        for (let j = 0; j < en.length; j++) {
          const e = en[j];
          if (!e.alive) continue;
          if (b.hit && b.hit.indexOf(e) !== -1) continue;
          const dx = b.x - e.x, dy = b.y - e.y, rr = e.radius + b.r;
          if (dx * dx + dy * dy < rr * rr) {
            hitEnemy(state, e, b);
            if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = [])).push(e); }
            else { dead = true; }
            break;
          }
        }
      } else {
        // Enemy bullet: friendly fire on other enemies first.
        for (let j = 0; j < en.length; j++) {
          const e = en[j];
          if (!e.alive || e === b.owner) continue;
          const dx = b.x - e.x, dy = b.y - e.y, rr = e.radius + b.r;
          if (dx * dx + dy * dy < rr * rr) {
            hitEnemy(state, e, b);
            if (state.rng.chance(0.5)) {
              const fr = state.atlas.phraseFrame[state.rng.pick(['Ой, свої!', 'Це ж я!', 'Не в той бік!'])];
              if (fr) state.fx.floaters.push({ x: e.x, y: e.y - e.radius - 8, vy: -52, life: 1.0, maxLife: 1.0, spr: fr, scale: 0.78, r: 1, g: 0.9, b: 0.8 });
            }
            dead = true;
            break;
          }
        }
        if (!dead && p.alive) {
          const dx = b.x - p.x, dy = b.y - p.y, rr = p.radius + b.r;
          if (dx * dx + dy * dy < rr * rr) { hurtPlayer(state, b.dmg); dead = true; }
        }
      }
    }

    if (dead) {
      burst(state, b.x, b.y, { n: 3, color: b.team === 'p' ? P.muzzle : P.slipper, speed: 70, size: 5, life: 0.2 });
      bs[i] = bs[bs.length - 1]; bs.pop();
    }
  }
}

export function drawBullets(R, state) {
  const bs = state.bullets;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (b.spr) {
      const ang = b.spin ? state.time * 12 : Math.atan2(b.vy, b.vx);
      R.draw(b.spr, b.x, b.y, { rot: ang });
    } else {
      R.draw(b.team === 'p' ? 'bulletP' : 'bulletE', b.x, b.y, { w: 18, h: 11, rot: Math.atan2(b.vy, b.vx) });
    }
  }
}
