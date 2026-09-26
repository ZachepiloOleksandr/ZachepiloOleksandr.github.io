// Virtual joystick: drag anywhere on the play area. Touch + mouse (desktop) via Pointer Events.
// Exposes a normalized direction vector (magnitude 0..1). Owns the on-screen stick visuals.
import { clamp } from './math.js';

export function createInput(canvas) {
  const stickEl = document.getElementById('stick');
  const baseEl = document.getElementById('stickBase');
  const knobEl = document.getElementById('stickKnob');

  const MAX = 58; // px radius of knob travel
  const state = { x: 0, y: 0, active: false, mag: 0 };
  let pid = null;
  let ox = 0, oy = 0;

  function place(el, px, py) {
    // Position by transform only — no per-move layout (avoids drag-time stutter on mobile).
    el.style.transform = 'translate(' + px + 'px,' + py + 'px) translate(-50%,-50%)';
  }
  function show(px, py) {
    stickEl.classList.add('active');
    place(baseEl, px, py);
    place(knobEl, px, py);
  }
  function hide() {
    stickEl.classList.remove('active');
  }

  function setKnob(px, py) {
    place(knobEl, px, py);
  }

  function down(e) {
    if (pid !== null) return;
    pid = e.pointerId;
    ox = e.clientX; oy = e.clientY;
    state.active = true;
    show(ox, oy);
    setKnob(ox, oy);
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(pid); } catch (_) {} }
  }

  function move(e) {
    if (e.pointerId !== pid) return;
    let dx = e.clientX - ox;
    let dy = e.clientY - oy;
    const d = Math.hypot(dx, dy);
    if (d > MAX) { dx = (dx / d) * MAX; dy = (dy / d) * MAX; }
    setKnob(ox + dx, oy + dy);
    state.x = dx / MAX;
    state.y = dy / MAX;
    state.mag = clamp(Math.hypot(state.x, state.y), 0, 1);
  }

  function up(e) {
    if (e.pointerId !== pid) return;
    pid = null;
    state.active = false;
    state.x = state.y = state.mag = 0;
    hide();
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  // Keyboard fallback (desktop dev): WASD / arrows.
  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  state.poll = function () {
    // Merge keyboard into the vector when the stick isn't active.
    if (!state.active) {
      let kx = 0, ky = 0;
      if (keys['a'] || keys['arrowleft']) kx -= 1;
      if (keys['d'] || keys['arrowright']) kx += 1;
      if (keys['w'] || keys['arrowup']) ky -= 1;
      if (keys['s'] || keys['arrowdown']) ky += 1;
      if (kx || ky) {
        const l = Math.hypot(kx, ky);
        state.x = kx / l; state.y = ky / l; state.mag = 1;
      } else {
        state.x = state.y = state.mag = 0;
      }
    }
    return state;
  };

  state.reset = function () {
    pid = null; state.active = false; state.x = state.y = state.mag = 0; hide();
  };

  return state;
}
