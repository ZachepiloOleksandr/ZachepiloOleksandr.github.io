// Tiny WebAudio synth — no asset files. Comic blips, squeaks, thuds. Lazily started on first gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  const last = {}; // throttle map

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }

  function resume() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // One-shot oscillator with an exponential decay envelope.
  function blip(type, f0, f1, dur, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function throttle(key, ms) {
    const now = (ctx ? ctx.currentTime : 0) * 1000;
    if (last[key] && now - last[key] < ms) return false;
    last[key] = now; return true;
  }

  const api = {
    resume,
    setMuted(v) { muted = v; },
    isMuted() { return muted; },
    shoot() { if (throttle('shoot', 55)) blip('square', 720, 480, 0.06, 0.12); },
    enemyHurt() { if (throttle('eh', 40)) blip('sawtooth', 380, 120, 0.12, 0.16); }, // squeak down
    enemyDie() { blip('triangle', 240, 60, 0.22, 0.2); blip('square', 500, 90, 0.18, 0.1, 0.02); },
    trip() { blip('sine', 900, 200, 0.28, 0.16); }, // slide-whistle down
    playerHurt() { blip('sawtooth', 160, 60, 0.2, 0.28); },
    enemyShoot() { if (throttle('es', 90)) blip('square', 300, 200, 0.08, 0.08); },
    waveClear() { [523, 659, 784, 1047].forEach((f, i) => blip('triangle', f, f, 0.14, 0.18, i * 0.09)); },
    coin() { if (throttle('coin', 45)) blip('square', 1320, 1760, 0.07, 0.09); },
    perk() { blip('triangle', 660, 990, 0.16, 0.2); },
    death() { [330, 262, 196, 147].forEach((f, i) => blip('sawtooth', f, f * 0.98, 0.3, 0.2, i * 0.16)); },
    start() { blip('square', 440, 660, 0.1, 0.18); },
  };
  return api;
}
