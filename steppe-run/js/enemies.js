// Enemy archetypes, escalating "competence", escalating farce:
//   SHOVEL — голі та босі: rush for melee, occasionally fling a shovel, trip, panic.
//   PISTOL — озброєні-але-безпорадні: a pistol, wild single shots, friendly fire.
//   RIFLE  — "автоматники" (wave 5+): automatic bursts, sprays wildly, jams.
//   COVER  — "окопник" (wave 3+): tough and accurate, hides behind cover and peeks out to shoot.
//   NIVA   — car (wave 4+): rams the hero; shot to pieces → 4 crew bail out; drone hit → crew dies inside.
// Lethal non-drone hits may leave an enemy DOWNED: the hero can finish him or take him prisoner.
import { angleTo, dist, approach } from './math.js';
import { ENEMY, ENEMY_DEFS, DOWN, waveScale, nivaCrew, PALETTE as P, CHAR_SCALE, VEHICLE_SCALE } from './data.js';
import { burst, shout, throwSprite, shake, addEbaly, addDamage } from './fx.js';
import { spawnEnemyBullet, hurtPlayer } from './bullets.js';
import { resolveCircle, onScreen, clampInside, losBlocked, addWreck } from './world.js';
import { dropLoot } from './pickups.js';
import { t } from './i18n.js';

export function spawnEnemy(state, type, x, y) {
  const def = ENEMY_DEFS[type];
  const sc = waveScale(state.wave.index);
  const e = {
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
    downed: false, downT: 0, captureP: 0,
    // cover AI
    spot: null, cover: null, aiT: 0, peekSide: 1,
    // car AI
    speedNow: 0, stuckT: 0, reverseT: 0,
  };
  state.enemies.push(e);
  burst(state, x, y, { n: 6, color: P.dust, speed: 75, size: 7, life: 0.4 });
  return e;
}

// ---- damage / downed / death ----

// Single entry point for hurting an enemy. src: 'bullet' | 'ff' (enemy friendly fire) | 'drone'.
export function damageEnemy(state, e, dmg, src) {
  if (!e.alive || e.downed) return;
  e.hp -= dmg;
  e.hurtT = 0.12;
  e.squash = 1;
  addDamage(state, e.x, e.y - e.radius, dmg);
  state.A.enemyHurt();
  if (e.hp > 0) return;
  if (e.def.vehicle) {
    e.crewOut = src !== 'drone';
    e.alive = false;
  } else if (src !== 'drone' && state.rng.chance(DOWN.chance)) {
    knockDown(state, e);
  } else {
    e.alive = false;
  }
}

function knockDown(state, e) {
  e.downed = true;
  e.hp = 0;
  e.downT = DOWN.time;
  e.captureP = 0;
  e.state = 'downed';
  e.burst = 0;
  e.vx *= 0.3; e.vy *= 0.3;
  shout(state, e.x, e.y, 'surrender');
  burst(state, e.x, e.y, { n: 6, color: P.dust, speed: 80, size: 8, life: 0.4 });
  console.log('DOWN ' + e.def.sprite + ' (добити або в полон)');
}

// Resolve a downed enemy by the hero's choice: 'finish' (kill value) or 'capture' (more єБали).
export function resolveDowned(state, e, how) {
  if (!e.downed || !e.alive) return;
  e.resolved = how;
  e.alive = false;
}

function creditEbaly(state, e, amount, label) {
  state.stats.pending += amount;
  addEbaly(state, e.x, e.y - e.radius - 18, amount);
  state.A.ebaly();
  if (label) {
    const fr = state.atlas.phraseFrame[label];
    if (fr) state.fx.floaters.push({ x: e.x, y: e.y - e.radius - 44, vy: -40, life: 1.2, maxLife: 1.2, spr: fr, scale: 0.8, r: 0.8, g: 1, b: 0.8 });
  }
}

function killValue(state, def) { return def.ebaly + state.player.ebalyBonus; }

function onDeath(state, e) {
  state.stats.kills++;
  if (e.resolved === 'capture') {
    state.stats.captured++;
    creditEbaly(state, e, killValue(state, e.def) * DOWN.captureMul + DOWN.captureBonus, 'act.captured');
    state.A.perk();
    console.log('CAPTURE ' + e.def.sprite);
    return;
  }
  if (e.def.vehicle) { carDestroyed(state, e); return; }
  state.A.enemyDie();
  burst(state, e.x, e.y, { n: 12, color: e.type === ENEMY.SHOVEL ? P.pink : P.rags, speed: 170, size: 11, life: 0.5, up: 30 });
  if (!e.resolved) shout(state, e.x, e.y, 'hurt');
  if (e.type === ENEMY.SHOVEL && state.rng.chance(0.6)) throwSprite(state, e.x, e.y, 'pants', {});
  shake(state, 4);
  dropLoot(state, e);
  creditEbaly(state, e, killValue(state, e.def), e.resolved === 'finish' ? 'act.finished' : null);
}

function carDestroyed(state, e) {
  state.A.death();
  shake(state, 14);
  burst(state, e.x, e.y, { n: 22, color: P.muzzle, speed: 260, size: 18, life: 0.6 });
  burst(state, e.x, e.y, { n: 14, color: P.ink, speed: 120, size: 22, life: 1.0, a: 0.6 });
  addWreck(state.world, e.x, e.y, e.face);
  const crew = nivaCrew(state.wave.index);
  if (e.crewOut) {
    // Shot to pieces: the crew bails out around the burning car.
    creditEbaly(state, e, killValue(state, e.def), null);
    crew.forEach((t, i) => {
      const a = e.face + Math.PI / 2 + (i - 1.5) * 0.9 + (i >= 2 ? Math.PI : 0);
      const c = spawnEnemy(state, t, e.x + Math.cos(a) * 56, e.y + Math.sin(a) * 56);
      c.vx = Math.cos(a) * 160; c.vy = Math.sin(a) * 160;
      c.state = 'panic'; c.stateT = state.rng.range(0.4, 0.9);
      if (i === 0) shout(state, c.x, c.y, 'crew');
    });
    console.log('NIVA destroyed → crew out: ' + crew.join(','));
  } else {
    // Drone hit: the whole crew goes with the car — credit them all.
    let total = killValue(state, e.def);
    for (const t of crew) total += killValue(state, ENEMY_DEFS[t]);
    state.stats.kills += crew.length;
    creditEbaly(state, e, total, null);
    state.onBanner(t('bDroneNiva'));
    console.log('NIVA droned with crew, +' + total);
  }
}

// ---- weapons ----

function fireAt(state, e, aim, d) {
  spawnEnemyBullet(state, e.x + Math.cos(aim) * (e.radius + 8), e.y + Math.sin(aim) * (e.radius + 8), aim, d.bulletDmg, d.bulletSpeed, { owner: e });
  state.A.enemyShoot();
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
      fireAt(state, e, aim, d);
    }
  } else if (d.weapon === 'auto') {
    if (e.burst > 0) {
      e.burstCd -= dt;
      if (e.burstCd <= 0) {
        e.burst--; e.burstCd = d.burstGap;
        let aim = toP + (1 - d.accuracy) * rng.range(-0.8, 0.8);
        if (rng.chance(0.2)) aim = rng.angle();
        fireAt(state, e, aim, d);
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

// ---- AI: basic rush / stumble / panic ----

function aiBasic(state, e, dt, toP, dP) {
  const rng = state.rng;
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
  return [mx, my, spd];
}

// ---- AI: окопник — pick cover on the far side of an obstacle, hide, peek out, fire aimed bursts ----

function pickCover(state, e) {
  const p = state.player, os = state.world.obstacles;
  let best = null, bestCost = Infinity;
  for (let i = 0; i < os.length; i++) {
    const o = os[i];
    if (!o.blockBullets) continue;
    const dE = dist(e.x, e.y, o.x, o.y);
    if (dE > 560) continue;
    const a = angleTo(p.x, p.y, o.x, o.y);
    const sx = o.x + Math.cos(a) * (o.r + e.radius + 4), sy = o.y + Math.sin(a) * (o.r + e.radius + 4);
    const dP = dist(sx, sy, p.x, p.y);
    if (dP < 170 || dP > 640) continue;
    const cost = dist(e.x, e.y, sx, sy) + Math.abs(dP - 330) * 0.5;
    if (cost < bestCost) { bestCost = cost; best = { o, x: sx, y: sy, a }; }
  }
  return best;
}

function aiCover(state, e, dt, toP, dP) {
  const rng = state.rng, d = e.def, p = state.player;
  e.aiT -= dt;
  if (e.aiT <= 0 && e.state !== 'peek') {
    e.aiT = 0.6;
    const c = pickCover(state, e);
    if (c) { e.cover = c.o; e.spot = { x: c.x, y: c.y, a: c.a }; }
    else { e.cover = null; e.spot = null; }
  }
  // No cover in reach, or the hero is on top of him: fight in the open like a steady rifleman.
  if (!e.spot || dP < 150) {
    const a = toP + Math.sin(e.ph * 3 + e.seedw) * 0.5;
    const spd = dP < 260 ? -e.speed * 0.4 : e.speed * 0.6;
    e.face = toP;
    if (onScreen(state, e.x, e.y)) aimedBurst(state, e, dt, toP, dP);
    return [Math.cos(a), Math.sin(a), spd];
  }
  const s = e.spot;
  if (e.state === 'peek') {
    // Side-step out of cover until there is a clear line to the hero, then shoot.
    const tang = s.a + e.peekSide * Math.PI / 2;
    const px = s.x + Math.cos(tang) * (e.cover.r + e.radius), py = s.y + Math.sin(tang) * (e.cover.r + e.radius);
    e.face = toP;
    const clear = !losBlocked(state.world, e.x, e.y, p.x, p.y);
    if (clear && onScreen(state, e.x, e.y)) aimedBurst(state, e, dt, toP, dP);
    if (e.stateT <= 0 && e.burst === 0) {
      e.state = 'hide'; e.stateT = rng.range(1.0, 1.9);
      if (rng.chance(0.3)) shout(state, e.x, e.y, 'cover');
    }
    const dd = dist(e.x, e.y, px, py);
    return dd > 4 && !clear ? [(px - e.x) / dd, (py - e.y) / dd, e.speed * 0.8] : [0, 0, 0];
  }
  const dd = dist(e.x, e.y, s.x, s.y);
  if (dd > 6) {
    e.state = 'move';
    e.face = angleTo(e.x, e.y, s.x, s.y);
    return [(s.x - e.x) / dd, (s.y - e.y) / dd, e.speed];
  }
  if (e.state !== 'hide') { e.state = 'hide'; e.stateT = rng.range(0.6, 1.4); }
  e.face = toP;
  if (e.stateT <= 0) {
    e.state = 'peek'; e.stateT = rng.range(1.1, 1.8); e.peekSide = rng.sign();
    e.shootCd = Math.min(e.shootCd, 0.25);
  }
  return [0, 0, 0];
}

function aimedBurst(state, e, dt, toP, dP) {
  const d = e.def, rng = state.rng;
  if (e.burst > 0) {
    e.burstCd -= dt;
    if (e.burstCd <= 0) {
      e.burst--; e.burstCd = d.burstGap;
      fireAt(state, e, toP + (1 - d.accuracy) * rng.range(-0.5, 0.5), d);
    }
    return;
  }
  e.shootCd -= dt;
  if (e.shootCd <= 0 && dP < 660) {
    e.shootCd = d.shootInterval * rng.range(0.9, 1.3);
    e.burst = d.burst; e.burstCd = 0;
  }
}

// ---- AI: Ніва — steer toward the hero with a limited turn rate, ram, back off when stuck ----

function aiCar(state, e, dt, toP) {
  const p = state.player;
  if (e.reverseT > 0) {
    e.reverseT -= dt;
    e.speedNow = approach(e.speedNow, -e.speed * 0.5, 600 * dt);
  } else {
    // Aim slightly ahead of the hero so it swerves past instead of parking on him.
    const tx = p.x + Math.cos(e.seedw + e.ph * 0.7) * 90, ty = p.y + Math.sin(e.seedw + e.ph * 0.7) * 90;
    const want = angleTo(e.x, e.y, tx, ty);
    let da = want - e.face;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    e.face += Math.max(-2.6 * dt, Math.min(2.6 * dt, da));
    e.speedNow = approach(e.speedNow, e.speed * (Math.abs(da) > 1.2 ? 0.55 : 1), 320 * dt);
  }
  if (onScreen(state, e.x, e.y, 60) && state.rng.chance(dt * 0.3)) state.A.enemyShoot(); // rattling engine
  return [Math.cos(e.face), Math.sin(e.face), e.speedNow];
}

// ---- downed: crawl away, get back up if neglected ----

function updateDowned(state, e, dt) {
  const p = state.player;
  e.downT -= dt;
  const a = angleTo(p.x, p.y, e.x, e.y);
  e.vx = Math.cos(a) * DOWN.crawl; e.vy = Math.sin(a) * DOWN.crawl;
  e.x += e.vx * dt; e.y += e.vy * dt;
  const res = resolveCircle(state.world, e.x, e.y, e.radius);
  e.x = res[0]; e.y = res[1];
  clampInside(state.world, e);
  if (e.downT <= 0) {
    e.downed = false;
    e.hp = e.maxHp * DOWN.reviveHp;
    e.state = 'run'; e.stateT = 1;
    e.captureP = 0;
    shout(state, e.x, e.y, 'revive');
    console.log('DOWN → got back up: ' + e.def.sprite);
  }
}

function updateOne(state, e, dt) {
  const p = state.player;
  e.hurtT = Math.max(0, e.hurtT - dt);
  e.squash = approach(e.squash, 0, dt * 4);
  e.contactCd = Math.max(0, e.contactCd - dt);
  e.ph += dt;
  e.spawnT = Math.max(0, (e.spawnT || 0) - dt);
  e.stateT -= dt;

  if (e.downed) { updateDowned(state, e, dt); return; }

  const toP = angleTo(e.x, e.y, p.x, p.y);
  const dP = dist(e.x, e.y, p.x, p.y);
  const ai = e.def.ai;
  const [mx, my, spd] = ai === 'cover' ? aiCover(state, e, dt, toP, dP)
    : ai === 'car' ? aiCar(state, e, dt, toP)
    : aiBasic(state, e, dt, toP, dP);

  if (ai === 'car') {
    e.vx = mx * spd; e.vy = my * spd;
  } else {
    const k = Math.min(1, 8 * dt);
    e.vx += (mx * spd - e.vx) * k;
    e.vy += (my * spd - e.vy) * k;
  }
  const wantX = e.x + e.vx * dt, wantY = e.y + e.vy * dt;
  e.x = wantX; e.y = wantY;

  // Collide with room walls / cover.
  const res = resolveCircle(state.world, e.x, e.y, e.radius);
  e.x = res[0]; e.y = res[1];
  clampInside(state.world, e);

  if (ai === 'car') {
    const blocked = Math.hypot(e.x - wantX, e.y - wantY);
    e.stuckT = blocked > Math.abs(e.speedNow) * dt * 0.5 && e.reverseT <= 0 ? e.stuckT + dt : 0;
    if (e.stuckT > 0.35) { e.stuckT = 0; e.reverseT = 0.7; e.face += state.rng.range(0.6, 1.2) * state.rng.sign(); }
  }

  if (p.alive && e.contactCd <= 0 && dP < e.radius + p.radius && onScreen(state, e.x, e.y)) {
    hurtPlayer(state, e.touch);
    e.contactCd = 0.85; e.squash = 1;
    if (ai === 'car') { e.reverseT = 0.6; shake(state, 8); }
    else {
      const a = angleTo(p.x, p.y, e.x, e.y);
      e.vx += Math.cos(a) * 180; e.vy += Math.sin(a) * 180;
    }
  }
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
        // Cars shove people aside; people don't shove cars.
        const wa = a.def.vehicle ? 0 : b.def.vehicle ? 2 : 1, wb = 2 - wa;
        a.x -= nx * ov * wa; a.y -= ny * ov * wa; b.x += nx * ov * wb; b.y += ny * ov * wb;
      }
    }
  }

  // Separation can shove a crowd into a wall — keep everyone inside the room.
  for (let i = 0; i < en.length; i++) if (en[i].alive) clampInside(state.world, en[i]);

  for (let i = en.length - 1; i >= 0; i--) {
    if (!en[i].alive) { onDeath(state, en[i]); en[i] = en[en.length - 1]; en.pop(); }
  }
}

export function drawEnemy(R, state, e) {
  if (e.downed) { drawDowned(R, state, e); return; }
  const sq = e.squash;
  const grow = e.spawnT > 0 ? 0.4 + (1 - e.spawnT / 0.3) * 0.6 : 1;
  const sc = e.def.vehicle ? VEHICLE_SCALE : CHAR_SCALE;
  const sx = (1 + sq * (e.def.vehicle ? 0.06 : 0.25)) * grow * sc, sy = (1 - sq * (e.def.vehicle ? 0.05 : 0.2)) * grow * sc;
  const flashing = e.hurtT > 0;
  const tint = flashing ? { r: 1, g: 0.6, b: 0.6 } : {};
  R.draw(e.def.sprite, e.x, e.y, { rot: e.face, sx, sy, r: tint.r, g: tint.g, b: tint.b });
  if (e.def.vehicle && e.hp < e.maxHp * 0.5 && Math.random() < 0.25) { // cosmetic smoke
    state.fx.particles.push({ x: e.x - Math.cos(e.face) * 20, y: e.y - Math.sin(e.face) * 20, vx: 0, vy: -40, life: 0.8, maxLife: 0.8,
      size: 14, spr: 'soft', r: 0.2, g: 0.18, b: 0.15, a: 0.5, grav: 0, drag: 1, rot: 0, vr: 0, shrink: false });
  }
  if (e.state === 'stumble') {
    const a = state.time * 7;
    R.draw('star', e.x + Math.cos(a) * 12, e.y - e.radius - 4, { w: 12, h: 12 });
    R.draw('star', e.x + Math.cos(a + 2.1) * 12, e.y - e.radius - 2, { w: 10, h: 10 });
  }
}

function drawDowned(R, state, e) {
  // Lying flat: stretched along the body, squashed across, a bit greyed.
  R.draw(e.def.sprite, e.x, e.y, { rot: e.face + Math.PI / 2, sx: CHAR_SCALE * 1.35, sy: CHAR_SCALE * 0.62, r: 0.82, g: 0.78, b: 0.74 });
  const wave = Math.sin(state.time * 8) * 0.25;
  R.draw('whiteflag', e.x + 12, e.y - e.radius - 10, { rot: wave, ax: 0.1, ay: 0.95 });
  // Timer until he gets back up, and capture progress on top.
  const w = 34, y = e.y + e.radius + 10;
  R.draw('white', e.x, y, { w: w + 2, h: 6, r: 0, g: 0, b: 0, a: 0.5 });
  const t = Math.max(0, e.downT / DOWN.time);
  R.draw('white', e.x - w / 2 + (w * t) / 2, y, { w: w * t, h: 4, r: 1, g: 0.75, b: 0.3 });
  if (e.captureP > 0) {
    const c = Math.min(1, e.captureP / DOWN.captureT);
    R.draw('white', e.x - w / 2 + (w * c) / 2, y - 7, { w: w * c, h: 4, r: 0.5, g: 1, b: 0.5 });
  }
}
