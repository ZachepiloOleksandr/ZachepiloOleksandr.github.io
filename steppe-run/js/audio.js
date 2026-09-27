// Tiny WebAudio synth — no asset files. Comic blips, squeaks, thuds, an explosion, and a procedural
// folk-flavoured chiptune loop. Master volume → separate SFX and music buses. Lazily started on first gesture.

// Music: "Ukrainian Dorian" on A (A B C D# E F# G), hopak-ish 2/4 feel. Semitone offsets from A3.
const BPM = 138;
const STEP = 60 / BPM / 4;            // 16th note
const BASS = [[0, 7], [5, 12], [7, 14], [0, 7]];   // Am · Dm · E · Am roots (root, fifth)
const MELODY = [                       // 4 bars × 16 steps, null = rest
  12, null, 15, 16, 19, null, 16, 15, 12, null, 14, 15, 16, null, null, null,
  17, null, 16, 15, 17, null, 19, 17, 16, null, 15, 14, 12, null, null, null,
  11, null, 14, 16, 19, null, 18, 16, 14, null, 11, 14, 16, null, 14, null,
  12, 15, 16, 19, 21, 19, 16, 15, 12, null, 16, null, 12, null, null, null,
];
const MUSIC_LEVEL = 0.16;
const SFX_LEVEL = 1;

export function createAudio() {
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  const cfg = { volume: 0.8, sfx: true, music: true };
  const last = {}; // throttle map
  let musicOn = false, musicTimer = null, nextT = 0, step = 0;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master); musicBus.connect(master); master.connect(ctx.destination);
    // 1s of white noise for explosions / snare.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyLevels();
  }

  function applyLevels() {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(cfg.volume * 0.45, now, 0.02);
    sfxBus.gain.setTargetAtTime(cfg.sfx ? SFX_LEVEL : 0, now, 0.02);
    musicBus.gain.setTargetAtTime(cfg.music ? MUSIC_LEVEL : 0, now, 0.05);
  }

  function resume() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // One-shot oscillator with an exponential decay envelope.
  function blip(type, f0, f1, dur, vol, when = 0, bus = sfxBus) {
    if (!ctx || !bus) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, when = 0, bus = sfxBus, q = 0.7) {
    if (!ctx || !noiseBuf) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.15), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  function throttle(key, ms) {
    const now = (ctx ? ctx.currentTime : 0) * 1000;
    if (last[key] && now - last[key] < ms) return false;
    last[key] = now; return true;
  }

  // ---- music sequencer (lookahead scheduling) ----
  const hz = (semi) => 220 * Math.pow(2, semi / 12);
  function scheduleStep(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16;
    const when = t - ctx.currentTime;
    const m = MELODY[(bar * 16 + s)];
    if (m != null) blip('square', hz(m), hz(m) * 0.995, STEP * 1.6, 0.22, when, musicBus);
    if (s % 4 === 0) blip('triangle', hz(BASS[bar][0] - 12), hz(BASS[bar][0] - 12), STEP * 2.2, 0.5, when, musicBus);
    if (s % 4 === 2) blip('triangle', hz(BASS[bar][1] - 12), hz(BASS[bar][1] - 12), STEP * 1.6, 0.35, when, musicBus);
    if (s % 8 === 4) noise(0.09, 0.35, 5000, when, musicBus);          // snare-ish on the off-beat
    if (s % 2 === 0) noise(0.025, 0.12, 9000, when, musicBus);         // hat
  }
  function pump() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.15) { scheduleStep(step, nextT); step = (step + 1) % 64; nextT += STEP; }
  }
  function startMusic() {
    ensure();
    if (!ctx || musicOn) return;
    musicOn = true; step = 0; nextT = ctx.currentTime + 0.1;
    musicTimer = setInterval(pump, 40);
    console.log('MUSIC start');
  }
  function stopMusic() { musicOn = false; if (musicTimer) clearInterval(musicTimer); musicTimer = null; }

  const api = {
    resume,
    configure(s) { Object.assign(cfg, s); applyLevels(); },
    startMusic, stopMusic,
    shoot() { if (throttle('shoot', 55)) blip('square', 720, 480, 0.06, 0.12); },
    enemyHurt() { if (throttle('eh', 40)) blip('sawtooth', 380, 120, 0.12, 0.16); }, // squeak down
    enemyDie() { blip('triangle', 240, 60, 0.22, 0.2); blip('square', 500, 90, 0.18, 0.1, 0.02); },
    trip() { blip('sine', 900, 200, 0.28, 0.16); }, // slide-whistle down
    playerHurt() { blip('sawtooth', 160, 60, 0.2, 0.28); },
    enemyShoot() { if (throttle('es', 90)) blip('square', 300, 200, 0.08, 0.08); },
    ebaly() { if (throttle('eb', 45)) blip('square', 1320, 1760, 0.07, 0.09); },
    perk() { blip('triangle', 660, 990, 0.16, 0.2); },
    death() { [330, 262, 196, 147].forEach((f, i) => blip('sawtooth', f, f * 0.98, 0.3, 0.2, i * 0.16)); },
    start() { blip('square', 440, 660, 0.1, 0.18); },
    droneLaunch() { blip('sawtooth', 300, 900, 0.35, 0.08); blip('square', 620, 1240, 0.3, 0.05, 0.05); },
    explosion() {
      noise(0.9, 0.9, 1800);                         // blast
      blip('sine', 120, 32, 0.6, 0.7);               // thump
      noise(0.35, 0.4, 6000, 0.02);                  // crack
    },
  };
  return api;
}
