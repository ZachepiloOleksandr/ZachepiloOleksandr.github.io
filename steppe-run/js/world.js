// Procedural steppe ROOM (sector): a walled plot with one gated exit, scattered cover
// that blocks both movement and bullets, and feather-grass decoration.
// Rooms are generated one at a time at the origin; the player transitions room → room.
import { clamp } from './math.js';
import { hash2 } from './rng.js';

const TS = 64;     // tile size
const WT = 40;     // wall thickness
const GATE = 168;  // exit gate width

export function generateRoom(state, n) {
  const rng = state.rng;
  // Large scrolling map (bigger than the screen); the camera follows the player.
  // Enemies are spawned inside the visible screen (see waves.js) so combat stays in view.
  const W = Math.round(rng.range(1700, 2100));
  const H = Math.round(rng.range(2150, 2650));
  const world = { w: W, h: H, ts: TS, wt: WT, walls: [], obstacles: [], tall: [], kovyla: [], dirt: new Set() };
  const gw = Math.max(110, Math.min(GATE, Math.min(W, H) * 0.34));

  // Exit on a non-entry side (entry is always the bottom).
  const side = rng.pick(['top', 'left', 'left', 'right', 'right']);
  let gate;
  if (side === 'top') { const gx = rng.range(W * 0.3, W * 0.7); gate = { side, x0: gx - gw / 2, x1: gx + gw / 2 }; }
  else { const gy = rng.range(H * 0.22, H * 0.52); gate = { side, y0: gy - gw / 2, y1: gy + gw / 2 }; }

  const walls = world.walls;
  walls.push({ x: 0, y: H - WT, w: W, h: WT }); // bottom (entry, solid)
  if (side === 'top') { walls.push({ x: 0, y: 0, w: gate.x0, h: WT }); walls.push({ x: gate.x1, y: 0, w: W - gate.x1, h: WT }); }
  else walls.push({ x: 0, y: 0, w: W, h: WT });
  if (side === 'left') { walls.push({ x: 0, y: 0, w: WT, h: gate.y0 }); walls.push({ x: 0, y: gate.y1, w: WT, h: H - gate.y1 }); }
  else walls.push({ x: 0, y: 0, w: WT, h: H });
  if (side === 'right') { walls.push({ x: W - WT, y: 0, w: WT, h: gate.y0 }); walls.push({ x: W - WT, y: gate.y1, w: WT, h: H - gate.y1 }); }
  else walls.push({ x: W - WT, y: 0, w: WT, h: H });

  // Door fills the gate gap until the room is cleared.
  if (side === 'top') world.door = { x: gate.x0, y: 0, w: gate.x1 - gate.x0, h: WT, open: false };
  else if (side === 'left') world.door = { x: 0, y: gate.y0, w: WT, h: gate.y1 - gate.y0, open: false };
  else world.door = { x: W - WT, y: gate.y0, w: WT, h: gate.y1 - gate.y0, open: false };
  world.gate = gate; world.side = side;

  world.entry = { x: W / 2, y: H - WT - 70 };
  if (side === 'top') world.exitPos = { x: (gate.x0 + gate.x1) / 2, y: WT + 34 };
  else if (side === 'left') world.exitPos = { x: WT + 34, y: (gate.y0 + gate.y1) / 2 };
  else world.exitPos = { x: W - WT - 34, y: (gate.y0 + gate.y1) / 2 };

  const cx = W / 2, cy = H / 2;
  for (let ty = Math.floor((cy - 200) / TS); ty < (cy + 200) / TS; ty++)
    for (let tx = Math.floor((cx - 160) / TS); tx < (cx + 160) / TS; tx++)
      if (hash2(tx, ty) < 0.5) world.dirt.add(tx + ',' + ty);

  const area = W * H;
  const kov = Math.max(40, Math.min(240, Math.round(area / 11000)));
  for (let i = 0; i < kov; i++) world.kovyla.push({ x: rng.range(WT + 16, W - WT - 16), y: rng.range(WT + 16, H - WT - 30), ph: rng.angle() });

  // Cover obstacles: block movement AND bullets. Kept clear of entry & exit.
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
    if (Math.hypot(x - world.exitPos.x, y - world.exitPos.y) < 130) continue;
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
  if (world.door && !world.door.open) { const p = pushAABB(x, y, r, world.door); if (p) { x = p[0]; y = p[1]; } }
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
  if (world.door && !world.door.open) { const d = world.door; if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return true; }
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

export function exitReached(world, p) {
  if (!world.door || !world.door.open) return false;
  const g = world.gate, s = world.side;
  if (s === 'top') return p.y < world.wt + 2 && p.x > g.x0 && p.x < g.x1;
  if (s === 'left') return p.x < world.wt + 2 && p.y > g.y0 && p.y < g.y1;
  return p.x > world.w - world.wt - 2 && p.y > g.y0 && p.y < g.y1;
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
  const minTx = Math.max(0, Math.floor((cx - hw) / TS)), maxTx = Math.min(Math.ceil(w.w / TS), Math.floor((cx + hw) / TS));
  const minTy = Math.max(0, Math.floor((cy - hh) / TS)), maxTy = Math.min(Math.ceil(w.h / TS), Math.floor((cy + hh) / TS));

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const h = hash2(tx, ty);
      const spr = h < 0.34 ? 'grass1' : h < 0.67 ? 'grass2' : 'grass3';
      const x = tx * TS + TS / 2, y = ty * TS + TS / 2;
      R.draw(spr, x, y, { w: TS + 1, h: TS + 1 });
      if (w.dirt.has(tx + ',' + ty)) R.draw('dirt', x, y, { w: TS + 1, h: TS + 1, a: 0.9 });
    }
  }

  const t = state.time;
  for (let i = 0; i < w.kovyla.length; i++) {
    const k = w.kovyla[i];
    if (k.x < cx - hw || k.x > cx + hw || k.y < cy - hh || k.y > cy + hh) continue;
    R.draw('kovyla', k.x, k.y, { rot: Math.sin(t * 2 + k.ph) * 0.12, ay: 0.95 });
  }

  for (let i = 0; i < w.walls.length; i++) drawWall(R, w.walls[i]);
  if (w.door && !w.door.open) drawWall(R, w.door);
  if (w.door && w.door.open) {
    const e = w.exitPos;
    const rot = w.side === 'top' ? 0 : w.side === 'left' ? -Math.PI / 2 : Math.PI / 2;
    R.draw('arrow', e.x, e.y, { rot, a: 0.5 + 0.35 * Math.sin(t * 6) });
  }
}
