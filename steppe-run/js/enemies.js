// Three enemy archetypes, escalating "competence", escalating farce:
//   SHOVEL — голі та босі: rush for melee, occasionally fling a shovel, trip, panic.
//   PISTOL — озброєні-але-безпорадні: a pistol, wild single shots, friendly fire.
//   RIFLE  — "автоматники" (wave 5+): automatic bursts, sprays wildly, jams.
import { angleTo, dist, clamp, approach } from './math.js';
import { ENEMY, ENEMY_DEFS, waveScale, PALETTE as P } from './data.js';
import { burst, shout, throwSprite, shake } from './fx.js';
import { spawnEnemyBullet, hurtPlayer } from './bullets.js';
import { resolveCircle, onScreen } from './world.js';

export function spawnEnemy(state, type, x, y) {
  const def = ENEMY_DEFS[type];
  const sc = waveScale(state.wave.index);
  state.enemies.push({
    type, def, x, y, vx: 0, vy: 0,
    radius: def.radius,
    hp: def.hp * sc.hp, maxHp: def.hp * sc.hp,
    speed: def.speed * sc.speed,
    touch: def.touch,
    state: 'run',
    stateT: state.rng.range(0.6, 2.0),
    face: angleTo(x, y, state.player.x, state.player.y),
    ph: 0, seedw: state.rng.range(0, 6),
    shootCd: def.shootInterval ? state.rng.range(0.5, def.shootInterval) : 0,
    throwCd: def.throwInterval ? state.rng.range(1.0, def.throwInterval) : 0,
    burst: 0, burstCd: 0,
    hurtT: 0, squash: 0, contactCd: 0,
    alive: true, spawnT: 0.3,
  });
  burst(state, x, y, { n: 6, color: P.dust, speed: 75, size: 7, life: 0.4 });
}

function shoot(state, e, dt, toP, dP) {
  const rng = state.rng, d = e.def;
  if (d.weapon === 'melee') {
    e.throwCd -= dt;
    if (e.throwCd <= 0 && dP > 90 && dP < 460) {
      e.throwCd = d.throwInterval * rng.range(0.8, 1.4);
      const aim = toP + rng.range(-0.25, 0.25);
      shout(state, e.x, e.y, 'shovel');
      spawnEnemyBullet(state, e.x + Math.cos(aim) * (e.radius + 18), e.y + Math.sin(aim) * (e.radius + 18), aim, 10, 150, { spr: 'shovel', r: 13, spin: true, life: 2.6, owner: e });
      state.A.enemyShoot();
    }
  } else if (d.weapon === 'pistol') {
    e.shootCd -= dt;
    if (e.shootCd <= 0 && dP < 540) {
      e.shootCd = d.shootInterval * rng.range(0.8, 1.5);
      let aim;
      if (rng.chance(0.25)) { aim = rng.angle(); shout(state, e.x, e.y, 'armed'); }
      else aim = toP + (1 - d.accuracy) * rng.range(-0.7, 0.7);
      spawnEnemyBullet(state, e.x + Math.cos(aim) * (e.radius + 8), e.y + Math.sin(aim) * (e.radius + 8), aim, d.bulletDmg, d.bulletSpeed, { owner: e });
      state.A.enemyShoot();
    }
  } else if (d.weapon === 'auto') {
    if (e.burst > 0) {
      e.burstCd -= dt;
      if (e.burstCd <= 0) {
        e.burst--; e.burstCd = d.burstGap;
        let aim = toP + (1 - d.accuracy) * rng.range(-0.8, 0.8);
        if (rng.chance(0.2)) aim = rng.angle();
        spawnEnemyBullet(state, e.x + Math.cos(aim) * (e.radius + 8), e.y + Math.sin(aim) * (e.radius + 8), aim, d.bulletDmg, d.bulletSpeed, { owner: e });
        state.A.enemyShoot();
      }
    } else {
      e.shootCd -= dt;
      if (e.shootCd <= 0 && dP < 620) {
        e.shootCd = d.shootInterval * rng.range(0.9, 1.5);
        e.burst = d.burst; e.burstCd = 0;
        if (rng.chance(0.5)) shout(state, e.x, e.y, 'rifle');
      }
    }
  }
}

function updateOne(state, e, dt) {
  const p = state.player, rng = state.rng;
  e.hurtT = Math.max(0, e.hurtT - dt);
  e.squash = approach(e.squash, 0, dt * 4);
  e.contactCd = Math.max(0, e.contactCd - dt);
  e.ph += dt;
  e.spawnT = Math.max(0, (e.spawnT || 0) - dt);
  e.stateT -= dt;

  const toP = angleTo(e.x, e.y, p.x, p.y);
  const dP = dist(e.x, e.y, p.x, p.y);
  let mx = 0, my = 0, spd = 0;

  if (e.state === 'run') {
    const wob = Math.sin(e.ph * 7 + e.seedw) * 0.35;
    const a = toP + wob;
    mx = Math.cos(a); my = Math.sin(a); spd = e.speed; e.face = a;
    // Gun-toters hold ground at range to actually aim.
    if (e.def.weapon !== 'melee' && dP < 340) spd *= 0.3;

    // Attack only while on the player's screen (off-screen foes just close in).
    if (onScreen(state, e.x, e.y)) shoot(state, e, dt, toP, dP);

    if (e.stateT <= 0) {
      if (rng.chance(e.def.stumbleChance)) {
        e.state = 'stumble'; e.stateT = rng.range(0.5, 0.95);
        state.A.trip(); shout(state, e.x, e.y, 'trip');
        burst(state, e.x, e.y + e.radius * 0.4, { n: 6, color: P.dust, speed: 90, size: 8, life: 0.45 });
        if (e.type === ENEMY.SHOVEL && rng.chance(0.5)) throwSprite(state, e.x, e.y, 'pants', {});
      } else if (e.type === ENEMY.SHOVEL && rng.chance(e.def.panicChance)) {
        e.state = 'panic'; e.stateT = rng.range(0.7, 1.3); shout(state, e.x, e.y, 'naked');
      } else {
        e.stateT = rng.range(0.7, 2.0);
      }
    }
  } else if (e.state === 'stumble') {
    spd = 0; e.face += dt * 10;
    if (e.stateT <= 0) { e.state = 'run'; e.stateT = rng.range(0.8, 1.8); }
  } else if (e.state === 'panic') {
    const a = toP + Math.PI + Math.sin(e.ph * 6) * 0.4;
    mx = Math.cos(a); my = Math.sin(a); spd = e.speed * 1.05; e.face = a;
    if (e.stateT <= 0) { e.state = 'run'; e.stateT = rng.range(0.8, 1.6); }
  }

  const k = Math.min(1, 8 * dt);
  e.vx += (mx * spd - e.vx) * k;
  e.vy += (my * spd - e.vy) * k;
  e.x += e.vx * dt; e.y += e.vy * dt;

  // Collide with room walls / closed door / cover.
  const res = resolveCircle(state.world, e.x, e.y, e.radius);
  e.x = res[0]; e.y = res[1];
  e.x = clamp(e.x, e.radius, state.world.w - e.radius);
  e.y = clamp(e.y, e.radius, state.world.h - e.radius);

  if (p.alive && e.contactCd <= 0 && dP < e.radius + p.radius && onScreen(state, e.x, e.y)) {
    hurtPlayer(state, e.touch);
    e.contactCd = 0.85; e.squash = 1;
    const a = angleTo(p.x, p.y, e.x, e.y);
    e.vx += Math.cos(a) * 180; e.vy += Math.sin(a) * 180;
  }
}

function onDeath(state, e) {
  state.stats.kills++;
  state.A.enemyDie();
  burst(state, e.x, e.y, { n: 12, color: e.type === ENEMY.SHOVEL ? P.pink : P.rags, speed: 170, size: 11, life: 0.5, up: 30 });
  shout(state, e.x, e.y, 'hurt');
  if (e.type === ENEMY.SHOVEL && state.rng.chance(0.6)) throwSprite(state, e.x, e.y, 'pants', {});
  shake(state, 4);
}

export function updateEnemies(state, dt) {
  const en = state.enemies;
  for (let i = 0; i < en.length; i++) if (en[i].alive) updateOne(state, en[i], dt);

  // Light separation so they don't stack into one blob.
  for (let i = 0; i < en.length; i++) {
    const a = en[i]; if (!a.alive) continue;
    for (let j = i + 1; j < en.length; j++) {
      const b = en[j]; if (!b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2), ov = (min - d) * 0.5, nx = dx / d, ny = dy / d;
        a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      }
    }
  }

  for (let i = en.length - 1; i >= 0; i--) {
    if (!en[i].alive) { onDeath(state, en[i]); en[i] = en[en.length - 1]; en.pop(); }
  }
}

export function drawEnemy(R, state, e) {
  const sq = e.squash;
  const grow = e.spawnT > 0 ? 0.4 + (1 - e.spawnT / 0.3) * 0.6 : 1;
  const sx = (1 + sq * 0.25) * grow, sy = (1 - sq * 0.2) * grow;
  const flashing = e.hurtT > 0;
  const tint = flashing ? { r: 1, g: 0.6, b: 0.6 } : {};
  R.draw(e.def.sprite, e.x, e.y, { rot: e.face, sx, sy, r: tint.r, g: tint.g, b: tint.b });
  if (e.state === 'stumble') {
    const a = state.time * 7;
    R.draw('star', e.x + Math.cos(a) * 12, e.y - e.radius - 4, { w: 12, h: 12 });
    R.draw('star', e.x + Math.cos(a + 2.1) * 12, e.y - e.radius - 2, { w: 10, h: 10 });
  }
}
