// Procedural texture atlas baked on a 2D canvas, then uploaded to GL as one texture.
// No binary assets — every sprite is drawn here. Characters are drawn facing +x (right)
// so the renderer can rotate them straight to their aim/move angle.
import { PALETTE as P, ALL_PHRASES } from './data.js';

const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Sprites are baked at SS× resolution (sizes below stay in world px), so they stay crisp when
// the camera zooms them up on high-DPI phones.
const SS = 2;
const ATLAS_W = 2048, ATLAS_H = 1024;
const OUTLINE = 1.6; // world px, ink outline around characters/props

export function buildAtlas() {
  const cv = document.createElement('canvas');
  cv.width = ATLAS_W;
  cv.height = ATLAS_H;
  const ctx = cv.getContext('2d');
  const frames = {};
  const PAD = 4;
  let cx = 0, cy = 0, rowH = 0;

  function alloc(name, w, h) {
    w = Math.ceil(w); h = Math.ceil(h);
    const pw = w * SS, ph = h * SS;
    if (cx + pw + PAD > cv.width) { cx = 0; cy += rowH + PAD; rowH = 0; }
    if (cy + ph > cv.height) console.error('ATLAS overflow at ' + name);
    const f = { x: cx, y: cy, w: pw, h: ph, lw: w, lh: h };
    frames[name] = f;
    cx += pw + PAD;
    rowH = Math.max(rowH, ph);
    return f;
  }

  function place(name, w, h, draw) {
    const f = alloc(name, w, h);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.beginPath(); ctx.rect(0, 0, f.w, f.h); ctx.clip(); // never bleed into neighbouring frames
    ctx.scale(SS, SS);
    draw(ctx, f.lw, f.lh);
    ctx.restore();
  }

  // Cartoon ink outline: bake the sprite off-screen, stamp its silhouette in ink around it, then the sprite.
  const tmp = document.createElement('canvas');
  const tctx = tmp.getContext('2d');
  const sil = document.createElement('canvas');
  const sctx = sil.getContext('2d');
  function placeOutlined(name, w, h, draw) {
    const f = alloc(name, w, h);
    tmp.width = sil.width = f.w; tmp.height = sil.height = f.h;
    tctx.save(); tctx.scale(SS, SS); draw(tctx, f.lw, f.lh); tctx.restore();
    sctx.drawImage(tmp, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = rgba(P.ink, 0.9); sctx.fillRect(0, 0, f.w, f.h);
    sctx.globalCompositeOperation = 'source-over';
    const o = OUTLINE * SS;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.drawImage(sil, f.x + Math.cos(a) * o, f.y + Math.sin(a) * o);
    }
    ctx.drawImage(tmp, f.x, f.y);
  }

  // ---- primitives ----
  place('white', 4, 4, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); });

  place('soft', 48, 48, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });

  place('shadow', 56, 30, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.save(); c.translate(w / 2, h / 2); c.scale(1, 0.52); c.translate(-w / 2, -h / 2);
    c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
  });

  // ---- ground tiles ----
  function speckle(c, w, h, base, count, cols) {
    c.fillStyle = rgba(base); c.fillRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      const px = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const py = (Math.sin(i * 78.233) * 12543.123) % 1;
      const rx = Math.abs(px) * w, ry = Math.abs(py) * h;
      c.fillStyle = rgba(cols[i % cols.length], 0.5);
      c.fillRect(rx, ry, 2 + (i % 3), 2 + (i % 2));
    }
  }
  // Seamless steppe ground: every mark is drawn at wrapped offsets so tiles join invisibly.
  function ground(c, w, h, seed) {
    c.fillStyle = rgba(P.grass1); c.fillRect(0, 0, w, h);
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const wrap = (fn) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) fn(ox, oy); };
    for (let i = 0; i < 14; i++) {          // soft tonal blotches
      const x = rnd() * w, y = rnd() * h, r = 14 + rnd() * 26;
      const col = rnd() < 0.5 ? P.grass2 : P.grass3;
      wrap((ox, oy) => {
        const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, rgba(col, 0.45)); g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      });
    }
    c.lineCap = 'round';
    for (let i = 0; i < 90; i++) {          // grass blades
      const x = rnd() * w, y = rnd() * h, len = 3 + rnd() * 5, a = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
      const col = [P.grass3, P.bush, P.grass2, P.kovyla][i % 4];
      c.strokeStyle = rgba(col, 0.55); c.lineWidth = 1 + rnd() * 0.8;
      wrap((ox, oy) => { c.beginPath(); c.moveTo(x + ox, y + oy); c.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); c.stroke(); });
    }
    for (let i = 0; i < 26; i++) {          // pebbles / dry specks
      const x = rnd() * w, y = rnd() * h, r = 0.6 + rnd() * 1.2;
      c.fillStyle = rgba(i % 2 ? P.dirtDk : P.kovyla, 0.45);
      wrap((ox, oy) => { c.beginPath(); c.arc(x + ox, y + oy, r, 0, 7); c.fill(); });
    }
  }
  place('ground', 128, 128, (c, w, h) => ground(c, w, h, 1234567));

  // Soft-edged patches laid over the ground for large-scale variety (tinted per use).
  place('patch', 96, 96, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.55, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  place('dirt', 128, 96, (c, w, h) => {
    c.save();
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2, r = 1 + Math.sin(a * 3 + 1) * 0.08 + Math.sin(a * 7) * 0.05;
      c.lineTo(w / 2 + Math.cos(a) * (w / 2 - 6) * r, h / 2 + Math.sin(a) * (h / 2 - 6) * r);
    }
    c.closePath(); c.clip();
    speckle(c, w, h, P.dirt, 70, [P.dirtDk, P.kovyla]);
    c.strokeStyle = rgba(P.dirtDk, 0.35); c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, i * 16 + 6); c.bezierCurveTo(w * 0.3, i * 16, w * 0.7, i * 16 + 14, w, i * 16 + 4); c.stroke(); }
    const g = c.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, rgba(P.grass1, 0.85));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.restore();
  });

  // Screen vignette (drawn last, stretched over the view).
  place('vignette', 64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w * 0.72);
    g.addColorStop(0, 'rgba(40,24,8,0)'); g.addColorStop(1, 'rgba(40,24,8,0.42)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });

  // Inner-wall ambient shadow strip (dark at the wall, fading into the room).
  place('wallShade', 8, 32, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(30,18,6,0.45)'); g.addColorStop(1, 'rgba(30,18,6,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });

  // ---- decorations ----
  place('kovyla', 30, 46, (c, w, h) => {
    c.strokeStyle = rgba(P.kovyla, 0.95); c.lineWidth = 2.4; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const bx = 6 + i * 3.4;
      c.beginPath(); c.moveTo(w / 2, h);
      c.quadraticCurveTo(w / 2 + (i - 3) * 3, h / 2, bx, 4 + (i % 3) * 2); c.stroke();
    }
    c.fillStyle = rgba(P.grass3, 0.9); c.beginPath(); c.ellipse(w / 2, h - 3, 7, 4, 0, 0, 7); c.fill();
  });

  place('bush', 64, 56, (c, w, h) => {
    c.fillStyle = rgba(P.bushDk); c.beginPath(); c.ellipse(w / 2, h * 0.62, 27, 20, 0, 0, 7); c.fill();
    c.fillStyle = rgba(P.bush);
    for (const [ox, oy, r] of [[-12, 0, 14], [12, -2, 15], [0, -8, 16], [-6, 6, 12], [9, 7, 12]]) {
      c.beginPath(); c.ellipse(w / 2 + ox, h * 0.6 + oy, r, r * 0.85, 0, 0, 7); c.fill();
    }
    c.fillStyle = rgba(P.grass3, 0.6);
    for (const [ox, oy] of [[-8, -10], [6, -12], [0, -16]]) { c.beginPath(); c.ellipse(w / 2 + ox, h * 0.6 + oy, 6, 5, 0, 0, 7); c.fill(); }
  });

  placeOutlined('wreck', 104, 84, (c, w, h) => {
    // abandoned tractor-ish hulk, rusty
    c.fillStyle = rgba(P.metalDk); c.fillRect(20, 30, 64, 34);
    c.fillStyle = rgba(P.metal); c.fillRect(24, 18, 30, 22); // cab
    c.fillStyle = rgba(P.rust);
    for (const [x, y, r] of [[30, 64, 14], [74, 64, 16]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    c.fillStyle = rgba(P.metalDk); for (const [x, y, r] of [[30, 64, 7], [74, 64, 8]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    // rust streaks + broken pipe
    c.strokeStyle = rgba(P.rust, 0.7); c.lineWidth = 3; c.beginPath(); c.moveTo(54, 14); c.lineTo(58, 2); c.stroke();
    c.fillStyle = rgba(P.dirtDk, 0.5); c.fillRect(36, 22, 14, 12);
  });

  // ---- hero (facing +x) ----
  placeOutlined('soldier', 46, 46, (c, w, h) => {
    const cxp = w / 2, cyp = h / 2;
    // rifle pointing right
    c.fillStyle = rgba(P.steel); c.fillRect(cxp + 4, cyp - 3, 18, 5);
    c.fillStyle = rgba(P.ink); c.fillRect(cxp + 20, cyp - 2, 4, 3);
    // body (top-down shoulders)
    c.fillStyle = rgba(P.uniformDk); c.beginPath(); c.ellipse(cxp - 1, cyp, 14, 16, 0, 0, 7); c.fill();
    c.fillStyle = rgba(P.uniform); c.beginPath(); c.ellipse(cxp - 1, cyp, 12, 13, 0, 0, 7); c.fill();
    // arms toward rifle
    c.fillStyle = rgba(P.uniformDk); c.beginPath(); c.ellipse(cxp + 6, cyp - 4, 5, 4, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(cxp + 6, cyp + 4, 5, 4, 0, 0, 7); c.fill();
    // head + helmet
    c.fillStyle = rgba(P.skin); c.beginPath(); c.arc(cxp + 2, cyp, 7, 0, 7); c.fill();
    c.fillStyle = rgba(P.helmet); c.beginPath(); c.arc(cxp, cyp, 8, Math.PI * 0.55, Math.PI * 1.9); c.fill();
    c.fillStyle = rgba(P.uniformDk, 0.5); c.fillRect(cxp - 9, cyp - 1.5, 8, 3);
  });

  // ---- enemy: naked & barefoot (facing +x) ----
  placeOutlined('naked', 40, 42, (c, w, h) => {
    const cxp = w / 2, cyp = h / 2;
    // flailing arms
    c.strokeStyle = rgba(P.pinkDk); c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cxp, cyp); c.lineTo(cxp + 10, cyp - 9); c.stroke();
    c.beginPath(); c.moveTo(cxp, cyp); c.lineTo(cxp - 6, cyp + 11); c.stroke();
    // slippers
    c.fillStyle = rgba(P.slipper); c.beginPath(); c.ellipse(cxp + 8, cyp + 9, 5, 3, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(cxp - 9, cyp - 7, 5, 3, 0, 0, 7); c.fill();
    // body
    c.fillStyle = rgba(P.pinkDk); c.beginPath(); c.ellipse(cxp, cyp, 11, 12, 0, 0, 7); c.fill();
    c.fillStyle = rgba(P.pink); c.beginPath(); c.ellipse(cxp, cyp, 9, 10, 0, 0, 7); c.fill();
    // red trunks
    c.fillStyle = rgba(P.trunks); c.beginPath(); c.ellipse(cxp - 3, cyp, 6, 7, 0, 0, 7); c.fill();
    // head
    c.fillStyle = rgba(P.pink); c.beginPath(); c.arc(cxp + 4, cyp, 6, 0, 7); c.fill();
    c.fillStyle = rgba(P.ink); c.beginPath(); c.arc(cxp + 7, cyp - 2, 1.3, 0, 7); c.fill();
  });

  // ---- enemy: armed but hapless (facing +x) ----
  placeOutlined('armed', 44, 46, (c, w, h) => {
    const cxp = w / 2, cyp = h / 2;
    // stick (held, pointing right-ish, wobbly)
    c.strokeStyle = rgba(P.stick); c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cxp + 2, cyp + 2); c.lineTo(cxp + 16, cyp - 6); c.stroke();
    // body
    c.fillStyle = rgba(P.ragsDk); c.beginPath(); c.ellipse(cxp - 1, cyp, 13, 15, 0, 0, 7); c.fill();
    c.fillStyle = rgba(P.rags); c.beginPath(); c.ellipse(cxp - 1, cyp, 11, 12, 0, 0, 7); c.fill();
    // oversized helmet over eyes
    c.fillStyle = rgba(P.bighelm); c.beginPath(); c.arc(cxp + 2, cyp, 10, 0, 7); c.fill();
    c.fillStyle = rgba(P.steel); c.beginPath(); c.arc(cxp + 2, cyp, 10, Math.PI * 1.05, Math.PI * 1.95); c.fill();
    // tiny confused mouth poking below helmet
    c.fillStyle = rgba(P.skin); c.fillRect(cxp + 6, cyp + 6, 6, 4);
  });

  // ---- gags & projectiles ----
  placeOutlined('pants', 26, 18, (c, w, h) => {
    c.fillStyle = rgba(P.trunks); c.fillRect(2, 2, w - 4, h - 8);
    c.fillRect(3, h - 8, 8, 7); c.fillRect(w - 11, h - 8, 8, 7);
    c.fillStyle = rgba(P.ink, 0.3); c.fillRect(2, 2, w - 4, 3);
  });

  place('bulletP', 14, 14, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#fff'); g.addColorStop(0.4, rgba(P.muzzle)); g.addColorStop(1, 'rgba(255,200,80,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  place('bulletE', 14, 14, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#fff'); g.addColorStop(0.4, rgba(P.slipper)); g.addColorStop(1, 'rgba(90,140,210,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });

  place('muzzle', 26, 26, (c, w, h) => {
    c.fillStyle = rgba(P.muzzle, 0.95); c.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const r = i % 2 ? 5 : 12; c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); }
    c.closePath(); c.fill();
  });

  place('star', 18, 18, (c, w, h) => {
    c.fillStyle = '#fff7c0'; c.strokeStyle = rgba(P.ink, 0.5); c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? 3.5 : 8; c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); }
    c.closePath(); c.fill(); c.stroke();
  });

  // ---- enemy: pistol (facing +x) ----
  placeOutlined('pistol', 44, 44, (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    c.fillStyle = rgba(P.steel); c.fillRect(cx + 6, cy - 2, 12, 5);
    c.fillStyle = rgba(P.ink); c.fillRect(cx + 15, cy - 1, 3, 6);
    c.fillStyle = rgba(P.ragsDk); c.beginPath(); c.ellipse(cx - 1, cy, 13, 14, 0, 0, 7); c.fill();
    c.fillStyle = rgba(P.rags); c.beginPath(); c.ellipse(cx - 1, cy, 11, 12, 0, 0, 7); c.fill();
    c.fillStyle = rgba(P.ragsDk); c.beginPath(); c.ellipse(cx + 6, cy - 1, 5, 4, 0, 0, 7); c.fill();
    c.fillStyle = rgba(P.skin); c.beginPath(); c.arc(cx + 2, cy, 6, 0, 7); c.fill();
    c.fillStyle = rgba(P.helmet); c.beginPath(); c.arc(cx, cy, 8, Math.PI * 0.55, Math.PI * 1.9); c.fill();
  });

  // ---- enemy: automatic rifle (facing +x) ----
  placeOutlined('rifle', 50, 46, (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    c.fillStyle = rgba(P.stick); c.fillRect(cx - 2, cy + 1, 9, 4); // stock
    c.fillStyle = rgba(P.steel); c.fillRect(cx + 4, cy - 3, 22, 5);
    c.fillStyle = rgba(P.ink); c.fillRect(cx + 24, cy - 2, 4, 3);
    c.fillStyle = rgba(P.steel); c.fillRect(cx + 10, cy + 2, 4, 7); // magazine
    c.fillStyle = rgba(P.ragsDk); c.beginPath(); c.ellipse(cx - 1, cy, 13, 15, 0, 0, 7); c.fill();
    c.fillStyle = rgba(P.rags); c.beginPath(); c.ellipse(cx - 1, cy, 11, 12, 0, 0, 7); c.fill();
    c.fillStyle = rgba(P.bighelm); c.beginPath(); c.arc(cx + 2, cy, 10, 0, 7); c.fill();
    c.fillStyle = rgba(P.steel); c.beginPath(); c.arc(cx + 2, cy, 10, Math.PI * 1.05, Math.PI * 1.95); c.fill();
  });

  // ---- thrown shovel ----
  placeOutlined('shovel', 36, 16, (c, w, h) => {
    c.strokeStyle = rgba(P.stick); c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(4, h / 2); c.lineTo(w - 13, h / 2); c.stroke();
    c.fillStyle = rgba(P.metal); c.beginPath(); c.moveTo(w - 14, 2); c.lineTo(w - 1, h / 2); c.lineTo(w - 14, h - 2); c.closePath(); c.fill();
    c.fillStyle = rgba(P.metalDk); c.fillRect(w - 16, h / 2 - 3, 3, 6);
  });

  // ---- cover that blocks bullets ----
  placeOutlined('crate', 50, 50, (c, w, h) => {
    c.fillStyle = rgba(P.dirtDk); c.fillRect(3, 3, w - 6, h - 6);
    c.fillStyle = rgba(P.stick); c.fillRect(5, 5, w - 10, h - 10);
    c.strokeStyle = rgba(P.dirtDk); c.lineWidth = 3; c.strokeRect(6, 6, w - 12, h - 12);
    c.beginPath(); c.moveTo(7, 7); c.lineTo(w - 7, h - 7); c.moveTo(w - 7, 7); c.lineTo(7, h - 7); c.stroke();
  });

  placeOutlined('haybale', 56, 48, (c, w, h) => {
    c.fillStyle = rgba(P.grass1); c.beginPath(); c.ellipse(w / 2, h / 2, 26, 22, 0, 0, 7); c.fill();
    c.fillStyle = rgba(P.grass2); c.beginPath(); c.ellipse(w / 2, h / 2, 26, 22, 0, 0, 7); c.fill();
    c.strokeStyle = rgba(P.dirtDk, 0.5); c.lineWidth = 2;
    for (let i = 1; i <= 4; i++) { c.beginPath(); c.ellipse(w / 2, h / 2, i * 5, 22, 0, 0, 7); c.stroke(); }
  });

  // ---- loot ----
  placeOutlined('coin', 20, 20, (c, w, h) => {
    const g = c.createRadialGradient(w * 0.38, h * 0.35, 1, w / 2, h / 2, w / 2 - 2);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#f2c14e'); g.addColorStop(1, '#b8862a');
    c.fillStyle = g; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill();
    c.strokeStyle = 'rgba(120,80,20,0.8)'; c.lineWidth = 1.2; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4.5, 0, 7); c.stroke();
    c.fillStyle = '#8a5a14'; c.font = '900 10px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('₴', w / 2, h / 2 + 0.5);
  });
  placeOutlined('medkit', 24, 20, (c, w, h) => {
    c.fillStyle = '#f4f0e6'; c.beginPath(); c.roundRect ? c.roundRect(2, 3, w - 4, h - 5, 3) : c.rect(2, 3, w - 4, h - 5); c.fill();
    c.fillStyle = '#d23a32'; c.fillRect(w / 2 - 2, 6, 4, h - 11); c.fillRect(w / 2 - 6, h / 2 - 1.5, 12, 4);
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(2, h - 5, w - 4, 3);
  });

  // ---- room wall tile (brick rampart) ----
  place('wall', 64, 64, (c, w, h) => {
    c.fillStyle = rgba(P.dirtDk); c.fillRect(0, 0, w, h);
    c.fillStyle = rgba(P.stick);
    for (let r = 0; r < 4; r++) {
      const off = (r % 2) * 16;
      for (let cX = -1; cX < 5; cX++) c.fillRect(cX * 16 + off, r * 16 + 1, 15, 14);
    }
    c.strokeStyle = rgba(P.ink, 0.28); c.lineWidth = 2;
    for (let r = 0; r <= 4; r++) { c.beginPath(); c.moveTo(0, r * 16); c.lineTo(w, r * 16); c.stroke(); }
  });

  // ---- text: digits + phrases ----
  function bakeText(name, str, { size = 30, fill = '#fff7e0', stroke = rgba(P.ink), lw = 5 } = {}) {
    ctx.save();
    ctx.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`;
    const m = ctx.measureText(str);
    const w = Math.ceil(m.width) + lw * 2 + 4;
    const h = Math.ceil(size * 1.4) + lw;
    ctx.restore();
    place(name, w, h, (c) => {
      c.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = lw;
      c.strokeStyle = stroke;
      c.strokeText(str, w / 2, h / 2);
      c.fillStyle = fill;
      c.fillText(str, w / 2, h / 2);
    });
  }

  for (let d = 0; d <= 9; d++) bakeText('d' + d, String(d), { size: 26, fill: '#fff' });
  bakeText('dminus', '-', { size: 26, fill: '#fff' });
  ALL_PHRASES.forEach((s, i) => bakeText('t' + i, s, { size: 28 }));

  // Map phrase string -> baked frame name for lookup by callers.
  const phraseFrame = {};
  ALL_PHRASES.forEach((s, i) => { phraseFrame[s] = 't' + i; });

  return { canvas: cv, frames, phraseFrame };
}
