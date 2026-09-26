// Procedural steppe ROOM (sector): a fully walled plot, scattered cover
// that blocks both movement and bullets, and feather-grass decoration.
// Rooms are generated one at a time at the origin; the player transitions room → room.
import { clamp } from './math.js';
import { PALETTE as P } from './data.js';

const TS = 64;     // wall tile size
const GTS = 128;  // ground tile size (seamless texture)
const WT = 40;     // wall thickness

export function generateRoom(state, n) {
  const rng = state.rng;
  // Large scrolling map (bigger than the screen); the camera follows the player.
  // Enemies are spawned inside the visible screen (see waves.js) so combat stays in view.
  const W = Math.round(rng.range(1700, 2100));
  const H = Math.round(rng.range(2150, 2650));
  const world = { w: W, h: H, ts: TS, wt: WT, walls: [], obstacles: [], tall: [], kovyla: [], patches: [] };
  // Closed arena: solid walls on all sides. After the wave + perk the game fades to the next room.
  world.walls.push(
    { x: 0, y: 0, w: W, h: WT },
    { x: 0, y: H - WT, w: W, h: WT },
    { x: 0, y: 0, w: WT, h: H },
    { x: W - WT, y: 0, w: WT, h: H },
  );
  world.entry = { x: W / 2, y: H - WT - 70 };

  // Large soft tonal patches + a few worn dirt clearings (no hard-edged tiles).
  const area = W * H;
  const tints = [P.grass2, P.grass3, P.bush, P.kovyla];
  const nPatch = Math.round(area / 90000);
  for (let i = 0; i < nPatch; i++) {
    const c = rng.pick(tints);
    world.patches.push({ spr: 'patch', x: rng.range(0, W), y: rng.range(0, H), s: rng.range(2.2, 4.5), sy: rng.range(0.6, 1),
      rot: rng.angle(), r: c[0] / 255, g: c[1] / 255, b: c[2] / 255, a: rng.range(0.35, 0.6) });
  }
  const nDirt = 3 + Math.round(area / 1400000);
  for (let i = 0; i < nDirt; i++) {
    world.patches.push({ spr: 'dirt', x: rng.range(WT + 80, W - WT - 80), y: rng.range(WT + 80, H - WT - 80), s: rng.range(1.1, 2.2), sy: rng.range(0.7, 1),
      rot: rng.range(-0.5, 0.5), r: 1, g: 1, b: 1, a: 0.95 });
  }

  const kov = Math.max(40, Math.min(240, Math.round(area / 11000)));
  for (let i = 0; i < kov; i++) world.kovyla.push({ x: rng.range(WT + 16, W - WT - 16), y: rng.range(WT + 16, H - WT - 30), ph: rng.angle() });

  // Cover obstacles: block movement AND bullets. Kept clear of the entry.
  const covers = ['crate', 'haybale', 'wreck'];
  const count = Math.max(4, Math.min(16, Math.round(area / 210000) + Math.min(4, n)));
  let placed = 0, tries = 0;
  while (placed < count && tries < 160) {
    tries++;
    const spr = rng.pick(covers);
    const r = spr === 'wreck' ? rng.range(30, 38) : spr === 'haybale' ? rng.range(22, 26) : rng.range(20, 24);
    const x = rng.range(WT + r + 22, W - WT - r - 22);
    const y = rng.range(WT + r + 40, H - WT - r - 110);
    if (Math.hypot(x - world.entry.x, y - world.entry.y) < 130) continue;
    let bad = false;
    for (const o of world.obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + r + 44) { bad = true; break; }
    if (bad) continue;
    const scale = spr === 'wreck' ? rng.range(0.8, 1.0) : 1;
    world.tall.push({ spr, x, y, scale });
    world.obstacles.push({ x, y: y + (spr === 'wreck' ? 8 : 0), r, blockBullets: true });
    placed++;
  }

  state.world = world;
}

export function placePlayerAtEntry(state) {
  const p = state.player, e = state.world.entry;
  p.x = e.x; p.y = e.y; p.vx = 0; p.vy = 0;
}

// ---- collision helpers (shared by player, enemies, bullets) ----
function pushAABB(x, y, r, rect) {
  const nx = clamp(x, rect.x, rect.x + rect.w), ny = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) { const d = Math.sqrt(d2); return [x + (dx / d) * (r - d), y + (dy / d) * (r - d)]; }
  const left = x - rect.x, right = rect.x + rect.w - x, top = y - rect.y, bot = rect.y + rect.h - y;
  const m = Math.min(left, right, top, bot);
  if (m === left) return [rect.x - r, y];
  if (m === right) return [rect.x + rect.w + r, y];
  if (m === top) return [x, rect.y - r];
  return [x, rect.y + rect.h + r];
}

export function resolveCircle(world, x, y, r) {
  for (let i = 0; i < world.walls.length; i++) { const p = pushAABB(x, y, r, world.walls[i]); if (p) { x = p[0]; y = p[1]; } }
  for (let i = 0; i < world.obstacles.length; i++) {
    const o = world.obstacles[i];
    const dx = x - o.x, dy = y - o.y, min = o.r + r, d2 = dx * dx + dy * dy;
    if (d2 < min * min && d2 > 0.0001) { const d = Math.sqrt(d2); x = o.x + (dx / d) * min; y = o.y + (dy / d) * min; }
  }
  return [x, y];
}

export function pointSolidHit(world, x, y) {
  const ws = world.walls;
  for (let i = 0; i < ws.length; i++) { const w = ws[i]; if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true; }
  const os = world.obstacles;
  for (let i = 0; i < os.length; i++) { const o = os[i]; if (o.blockBullets) { const dx = x - o.x, dy = y - o.y; if (dx * dx + dy * dy < o.r * o.r) return true; } }
  return false;
}

// Is a world point currently within the player's screen (camera viewport)?
// Combat (player firing, enemy attacks) is gated to this so it happens only on-screen.
export function onScreen(state, x, y, margin = 0) {
  return Math.abs(x - state.cam.x) <= state.view.halfW + margin &&
         Math.abs(y - state.cam.y) <= state.view.halfH + margin;
}

// Hard guarantee against tunnelling: a body's centre never leaves the walled interior.
export function clampInside(world, b) {
  const m = world.wt + b.radius;
  b.x = clamp(b.x, m, world.w - m);
  b.y = clamp(b.y, m, world.h - m);
}

// ---- rendering ----
function drawWall(R, r) {
  for (let y = r.y; y < r.y + r.h; y += TS) {
    for (let x = r.x; x < r.x + r.w; x += TS) {
      const tw = Math.min(TS, r.x + r.w - x), th = Math.min(TS, r.y + r.h - y);
      R.draw('wall', x + tw / 2, y + th / 2, { w: tw + 1, h: th + 1 });
    }
  }
}

export function drawRoom(R, state) {
  const w = state.world;
  const cx = state.cam.x, cy = state.cam.y;
  const hw = state.view.halfW + TS, hh = state.view.halfH + TS;

  const gx0 = Math.floor((cx - hw) / GTS), gx1 = Math.floor((cx + hw) / GTS);
  const gy0 = Math.floor((cy - hh) / GTS), gy1 = Math.floor((cy + hh) / GTS);
  for (let ty = gy0; ty <= gy1; ty++)
    for (let tx = gx0; tx <= gx1; tx++)
      R.draw('ground', tx * GTS + GTS / 2, ty * GTS + GTS / 2, { w: GTS + 0.5, h: GTS + 0.5 });

  for (let i = 0; i < w.patches.length; i++) {
    const p = w.patches[i], fr = R.frame(p.spr), rad = Math.max(fr.w, fr.h) * p.s * 0.5;
    if (p.x < cx - hw - rad || p.x > cx + hw + rad || p.y < cy - hh - rad || p.y > cy + hh + rad) continue;
    R.draw(p.spr, p.x, p.y, { sx: p.s, sy: p.s * p.sy, rot: p.rot, r: p.r, g: p.g, b: p.b, a: p.a });
  }

  const t = state.time;
  for (let i = 0; i < w.kovyla.length; i++) {
    const k = w.kovyla[i];
    if (k.x < cx - hw || k.x > cx + hw || k.y < cy - hh || k.y > cy + hh) continue;
    R.draw('kovyla', k.x, k.y, { rot: Math.sin(t * 2 + k.ph) * 0.12, ay: 0.95 });
  }

  // Ambient occlusion along the inner wall faces.
  const SH = 30;
  R.draw('wallShade', w.w / 2, WT + SH / 2, { w: w.w - WT * 2, h: SH });
  R.draw('wallShade', w.w / 2, w.h - WT - SH / 2, { w: w.w - WT * 2, h: SH, rot: Math.PI });
  R.draw('wallShade', WT + SH / 2, w.h / 2, { w: w.h - WT * 2, h: SH, rot: -Math.PI / 2 });
  R.draw('wallShade', w.w - WT - SH / 2, w.h / 2, { w: w.h - WT * 2, h: SH, rot: Math.PI / 2 });

  for (let i = 0; i < w.walls.length; i++) drawWall(R, w.walls[i]);
}
