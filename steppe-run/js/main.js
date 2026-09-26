// Boot + game loop + state machine (menu / playing / perk / dead) + camera + render order.
import { buildAtlas } from './textures.js';
import { createRenderer } from './renderer.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { makeRng } from './rng.js';
import { clamp, lerp, jitter } from './math.js';
import { generateRoom, drawRoom, placePlayerAtEntry } from './world.js';
import { createPlayer, updatePlayer, drawPlayer } from './player.js';
import { updatePlayerFire, updateBullets, drawBullets } from './bullets.js';
import { updateEnemies, drawEnemy } from './enemies.js';
import { startRun, startWave, updateWaves } from './waves.js';
import { updateFx, drawParticles, drawFloaters } from './fx.js';
import { PERKS, LOOT, EB } from './data.js';
import { loadBank, saveBank, applyUpgrades } from './meta.js';
import { updatePickups, drawPickups, vacuumPickups } from './pickups.js';

const TARGET_VIEW_H = 820; // world px visible vertically (zoom level) — device-independent
const BEST_KEY = 'steppe.best';

function loadBest() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY)) || { wave: 0, kills: 0 }; }
  catch (_) { return { wave: 0, kills: 0 }; }
}
function saveBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (_) {} }

function main() {
  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false }) ||
             canvas.getContext('experimental-webgl', { alpha: false });
  if (!gl) {
    document.getElementById('menu').innerHTML = '<h1>WebGL недоступний</h1><p class="sub">Спробуй інший браузер.</p>';
    return;
  }

  const atlas = buildAtlas();
  const R = createRenderer(gl, atlas);
  const A = createAudio();
  const hud = createHud();
  const input = createInput(canvas);

  const state = {
    time: 0, status: 'menu', seed: 0, rng: makeRng(1),
    R, A, atlas, input, hud,
    zoom: 1, view: { halfW: 420, halfH: 420 },
    cam: { x: 0, y: 0, shake: 0, sx: 0, sy: 0 },
    world: null, player: null,
    enemies: [], bullets: [], pickups: [], fx: { particles: [], floaters: [] },
    stats: { kills: 0, ebaly: 0 },
    bank: loadBank(), clearT: 0,
    wave: { index: 0, phase: 'idle', queue: [], introT: 0, spawnCd: 0 },
    best: loadBest(),
    onBanner: (t) => hud.banner(t),
    onWaveCleared: () => { vacuumPickups(state); state.clearT = LOOT.vacuumDelay; },
  };

  // Fixed zoom (the "as before" close-up). Rooms are generated to match this viewport,
  // so the whole arena equals one screen — gameplay stays in-frame without zooming out.
  function fitView() {
    const bw = canvas.width, bh = canvas.height;
    state.zoom = bh / TARGET_VIEW_H;
    state.view.halfW = (bw / state.zoom) / 2;
    state.view.halfH = (bh / state.zoom) / 2;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // cap render resolution to ease GPU/present load on phones
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    R.resize(canvas.width, canvas.height);
    fitView();
  }
  window.addEventListener('resize', resize);
  resize();

  // One-time device/GPU diagnostics (helps explain presentation stutter the rAF meter can't see).
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a';
    console.log('DEV dpr=' + (window.devicePixelRatio || 1) + ' win=' + window.innerWidth + 'x' + window.innerHeight +
      ' buf=' + canvas.width + 'x' + canvas.height + ' cores=' + (navigator.hardwareConcurrency || '?') +
      ' gpu=' + gpu);
  } catch (e) {}

  function resetEntities() {
    state.enemies.length = 0;
    state.bullets.length = 0;
    state.pickups.length = 0;
    state.fx.particles.length = 0;
    state.fx.floaters.length = 0;
  }

  function menuScene() {
    state.rng = makeRng(20260628);
    generateRoom(state, 1);
    createPlayer(state);
    placePlayerAtEntry(state);
    resetEntities();
    state.cam.x = state.player.x; state.cam.y = state.player.y; state.cam.shake = 0;
    state.status = 'menu';
    hud.showMenu(state.best, state.bank);
  }

  function newRun() {
    A.resume(); A.start();
    state.rng = makeRng((Math.random() * 0x7fffffff) >>> 0);
    generateRoom(state, 1);
    createPlayer(state);
    applyUpgrades(state.bank, state.player);
    placePlayerAtEntry(state);
    resetEntities();
    state.cam.x = state.player.x; state.cam.y = state.player.y; state.cam.shake = 0;
    state.stats.kills = 0;
    state.stats.ebaly = 0;
    state.clearT = 0;
    console.log('RUN start | bank ' + state.bank.ebaly + ' ' + EB + ' | up ' + JSON.stringify(state.bank.up));
    input.reset();
    hud.setHP(state.player.hp, state.player.maxHp);
    hud.setKills(0);
    hud.setEbaly(0);
    hud.showGame();
    state.status = 'playing';
    startRun(state);
  }

  function enterPerk() {
    state.status = 'perk';
    saveBank(state.bank);
    const pool = PERKS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = state.rng.int(0, i);
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const picks = pool.slice(0, 3);
    hud.showPerks(picks, (pk) => {
      pk.apply(state.player);
      A.perk();
      hud.setHP(state.player.hp, state.player.maxHp);
      startTransition();
    });
  }

  let transitioning = false;
  function startTransition() {
    if (transitioning) return;
    transitioning = true;
    state.status = 'transition';
    const fade = document.getElementById('fade');
    if (fade) fade.classList.add('show');
    const next = state.wave.index + 1;
    setTimeout(() => {
      generateRoom(state, next);
      placePlayerAtEntry(state);
      state.bullets.length = 0;
      state.pickups.length = 0;
      state.fx.particles.length = 0;
      state.cam.x = state.player.x; state.cam.y = state.player.y; state.cam.shake = 0;
      startWave(state, next);
      state.status = 'playing';
      if (fade) fade.classList.remove('show');
      transitioning = false;
    }, 300);
  }

  function die() {
    state.status = 'dead';
    A.death();
    if (state.wave.index > state.best.wave) state.best.wave = state.wave.index;
    if (state.stats.kills > state.best.kills) state.best.kills = state.stats.kills;
    saveBest(state.best);
    saveBank(state.bank);
    console.log('RUN end | хв ' + state.wave.index + ' | +' + state.stats.ebaly + ' ' + EB + ' | bank ' + state.bank.ebaly);
    hud.showDeath({ wave: state.wave.index, kills: state.stats.kills, ebaly: state.stats.ebaly, bank: state.bank.ebaly, best: state.best });
  }

  hud.onStart = newRun;
  hud.onRetry = newRun;
  hud.onMenu = menuScene;
  hud.bank = state.bank;
  hud.onBankChange = () => saveBank(state.bank);
  // єБали are credited to the bank on each kill; persist if the app is backgrounded/closed mid-run.
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveBank(state.bank); });

  function updateCamera(dt) {
    const p = state.player, cam = state.cam, w = state.world;
    if (!p || !w) return;
    const hw = state.view.halfW, hh = state.view.halfH;
    let tx = p.x, ty = p.y;
    tx = w.w > hw * 2 ? clamp(tx, hw, w.w - hw) : w.w / 2;
    ty = w.h > hh * 2 ? clamp(ty, hh, w.h - hh) : w.h / 2;
    const k = Math.min(1, 10 * dt);
    cam.x = lerp(cam.x, tx, k);
    cam.y = lerp(cam.y, ty, k);
    cam.shake = Math.max(0, cam.shake - dt * 40);
    cam.sx = jitter(cam.shake);
    cam.sy = jitter(cam.shake);
  }

  function update(dt) {
    state.time += dt;
    input.poll();
    if (state.status === 'playing') {
      updatePlayer(state, dt);
      updatePlayerFire(state, dt);
      updateEnemies(state, dt);
      updateBullets(state, dt);
      updateWaves(state, dt);
      updatePickups(state, dt);
      hud.setHP(state.player.hp, state.player.maxHp);
      hud.setKills(state.stats.kills);
      hud.setEbaly(state.stats.ebaly);
      if (!state.player.alive) die();
      else if (state.clearT > 0) {
        state.clearT -= dt;
        if (state.clearT <= 0 || state.pickups.length === 0) { state.clearT = 0; enterPerk(); }
      }
    }
    updateFx(state, dt);
    updateCamera(dt);
  }

  const ITEMS = [];
  function byY(a, b) { return a.y - b.y; }
  function drawDeco(d) { R.draw(d.spr, d.x, d.y, { sx: d.scale, sy: d.scale, ay: 0.86 }); }

  function render() {
    if (!state.world) return;
    const cam = state.cam;
    // Smooth sub-pixel camera (no pixel-snap — snapping quantises the lerp into uneven
    // 1px steps and reads as micro-shake while panning, even with no enemies).
    R.begin(cam.x + cam.sx, cam.y + cam.sy, state.zoom);
    drawRoom(R, state);

    // Shadows (under everything).
    const tall = state.world.tall;
    for (let i = 0; i < tall.length; i++) {
      const d = tall[i], fr = R.frame(d.spr);
      R.draw('shadow', d.x, d.y + fr.h * d.scale * 0.20, { w: fr.w * d.scale * 0.8, h: fr.h * d.scale * 0.34, a: 0.4 });
    }
    const en = state.enemies;
    for (let i = 0; i < en.length; i++) {
      const e = en[i];
      R.draw('shadow', e.x, e.y + e.radius * 0.7, { w: e.radius * 2.4, h: e.radius * 1.1, a: 0.4 });
    }
    const p = state.player;
    if (p) R.draw('shadow', p.x, p.y + 13, { w: 42, h: 18, a: 0.5 });

    // Y-sorted bodies.
    const items = ITEMS; items.length = 0;
    for (let i = 0; i < tall.length; i++) items.push(tall[i]);
    for (let i = 0; i < en.length; i++) items.push(en[i]);
    if (p) items.push(p);
    items.sort(byY);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it === p) drawPlayer(R, state);
      else if (it.def) drawEnemy(R, state, it);
      else drawDeco(it);
    }

    drawPickups(R, state);
    drawBullets(R, state);
    drawParticles(R, state);
    R.draw('vignette', cam.x + cam.sx, cam.y + cam.sy, { w: state.view.halfW * 2 + 4, h: state.view.halfH * 2 + 4 });
    drawFloaters(R, state);
    R.flush();
  }

  let last = 0;
  let bT0 = 0, bFrames = 0, bWorst = 0;        // badge window (0.5s)
  let sT0 = 0, sFrames = 0, sWorst = 0;        // log-summary window (3s)
  let lastHitchT = 0;
  let recUntil = 0;
  const fpsEl = document.getElementById('fps');
  const recBtn = document.getElementById('recBtn');
  if (recBtn) recBtn.addEventListener('click', () => {
    recUntil = performance.now() + 2500;
    recBtn.classList.add('on');
    console.log('--- REC координат старт (2.5с) ---');
  });

  function frame(t) {
    const rawMs = last ? (t - last) : 16.7;     // real frame time (uncapped), for measuring
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; // capped, for the simulation
    last = t;
    if (!bT0) { bT0 = t; sT0 = t; }

    fitView();
    update(dt);
    render();

    bFrames++; sFrames++;
    const valid = rawMs < 1000; // ignore app-backgrounded gaps, not real hitches
    if (valid && rawMs > bWorst) bWorst = rawMs;
    if (valid && rawMs > sWorst) sWorst = rawMs;

    // REC: per-frame coordinate + frame-time capture (tap REC near a wall to record).
    if (t < recUntil && state.player) {
      const p = state.player, c = state.cam;
      console.log('P x=' + p.x.toFixed(1) + ' y=' + p.y.toFixed(1) +
        ' v=' + p.vx.toFixed(0) + ',' + p.vy.toFixed(0) +
        ' cam=' + c.x.toFixed(1) + ',' + c.y.toFixed(1) + ' ms=' + Math.round(rawMs));
    } else if (recUntil && t >= recUntil) {
      recUntil = 0;
      if (recBtn) recBtn.classList.remove('on');
      console.log('--- REC кінець ---');
    }

    // A single long frame = a visible freeze. Log it with context to diagnose.
    if (valid && rawMs > 80 && t - lastHitchT > 250) {
      lastHitchT = t;
      console.warn('ФРІЗ ' + Math.round(rawMs) + 'мс (~' + Math.round(1000 / rawMs) +
        ' fps) | хв ' + state.wave.index + ' | ворогів ' + state.enemies.length +
        ' куль ' + state.bullets.length + ' партикл ' + state.fx.particles.length +
        ' тексту ' + state.fx.floaters.length);
    }

    if (t - bT0 >= 500) {
      const avg = Math.round((bFrames * 1000) / (t - bT0));
      const low = Math.round(1000 / Math.max(1, bWorst));
      if (fpsEl) fpsEl.textContent = bWorst > 32 ? (avg + ' fps ↓' + low) : (avg + ' fps');
      bT0 = t; bFrames = 0; bWorst = 0;
    }
    if (t - sT0 >= 3000) {
      const avg = Math.round((sFrames * 1000) / (t - sT0));
      console.log('FPS ' + avg + ' avg | найгірший кадр ' + Math.round(sWorst) + 'мс (~' +
        Math.round(1000 / Math.max(1, sWorst)) + ' fps) | хв ' + state.wave.index +
        ' ворогів ' + state.enemies.length);
      sT0 = t; sFrames = 0; sWorst = 0;
    }
    requestAnimationFrame(frame);
  }

  if (typeof window !== 'undefined') window.__game = state; // debug/verification hook

  menuScene();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
else main();
