// Content & tuning constants: palette, comic lines, perks, enemy defs, wave plan.

// Characters are drawn this much larger than their sprite so the art matches the hitbox.
export const CHAR_SCALE = 1.25;
export const VEHICLE_SCALE = 1.5;

// Warm Ukrainian-steppe palette. RGB 0..255 — consumed by the procedural texture baker.
export const PALETTE = {
  grass1: [201, 178, 78],   // golden field
  grass2: [176, 166, 70],   // drier patch
  grass3: [150, 168, 76],   // green tuft
  dirt:   [168, 122, 74],   // ground road
  dirtDk: [134, 92, 52],
  bush:   [108, 138, 60],
  bushDk: [78, 104, 44],
  kovyla: [226, 214, 170],  // feather-grass (ковила)
  rust:   [150, 92, 58],
  metal:  [120, 118, 110],
  metalDk:[86, 86, 80],
  // hero
  uniform:[96, 110, 62],
  uniformDk:[70, 82, 44],
  skin:   [232, 185, 140],
  helmet: [74, 84, 48],
  steel:  [70, 70, 66],
  // enemy: naked & barefoot
  pink:   [240, 184, 155],
  pinkDk: [206, 150, 122],
  trunks: [205, 70, 70],
  slipper:[58, 110, 165],
  // enemy: armed but hapless
  rags:   [126, 124, 104],
  ragsDk: [96, 94, 78],
  bighelm:[70, 70, 74],
  stick:  [120, 84, 46],
  // fx
  muzzle: [255, 232, 150],
  blood:  [220, 90, 80],     // used as comic "ow" puff, not gore
  dust:   [206, 188, 140],
  white:  [255, 255, 255],
  ink:    [40, 30, 16],
};

// Roguelike run upgrades (names/descriptions in i18n: perk.<id>, perk.<id>.d). apply() mutates the player.
export const PERKS = [
  { id: 'firerate', icon: '🔥', apply: (p) => { p.fireRate *= 1.22; } },
  { id: 'damage', icon: '💥', apply: (p) => { p.damage *= 1.28; } },
  { id: 'speed', icon: '👟', apply: (p) => { p.speed *= 1.14; } },
  { id: 'shotgun', icon: '🌽', apply: (p) => { p.multishot += 1; } },
  { id: 'range', icon: '🎯', apply: (p) => { p.range *= 1.2; p.bulletSpeed *= 1.1; } },
  { id: 'pierce', icon: '🔩', apply: (p) => { p.pierce += 1; } },
  { id: 'heal', icon: '🩹', apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 45); } },
];

// єБали (after the real "Армія дронів. Бонус" program): every confirmed result earns points,
// which are exchanged for tech in the Маркет. Results go to "DELTA" for verification and are
// credited when the wave is cleared; dying mid-wave confirms only part of the pending claims.
export const EBALY = {
  deathConfirm: 0.5,   // share of pending єБали confirmed if you fall mid-wave
  evac: 5,             // evacuating a wounded comrade
  woundedChance: 0.6,  // chance a room has a wounded comrade to evacuate
  evacR: 40,           // stand this close to evacuate
  evacHold: 1.6,       // seconds to load him onto the stretcher
  bleed: 45,           // seconds before he bleeds out
};

// Downed enemies: finish them off or take them prisoner (worth more, takes time).
export const DOWN = {
  chance: 0.4,         // share of lethal hits (not drone) that leave an enemy downed instead
  time: 9,             // seconds before a neglected downed enemy gets back up
  reviveHp: 0.35,      // HP share he gets back up with
  crawl: 16,           // crawl-away speed
  actR: 80,            // player distance for the finish/capture buttons
  captureT: 1.4,       // seconds to take him prisoner (player must stay close)
  captureMul: 2,       // єБали for a prisoner = kill value × mul + bonus
  captureBonus: 2,
};

// Market tech (bought with єБали, active every run).
// Launched only by the 🚁 button; prefers vehicles (a drone kills a car with its crew inside).
export const DRONE = {
  cd: 10, cdPerLvl: 1.5,   // recharge seconds per drone, faster per level
  speed: 640, dmg: 44, dmgPerWave: 4, blastR: 92, edgeDmg: 0.45, knock: 260,
  orbitR: 38, range: 620,
};

// Loot dropped by enemies: medkits heal on the spot.
export const LOOT = {
  medkitChance: 0.05,
  medkitHeal: 20,
  magnetR: 95,        // pull radius (world px), before upgrades
  pickupR: 26,        // collect distance
  pullSpeed: 520,
  life: 14,           // seconds on the ground before vanishing
  vacuumDelay: 1.1,   // after a wave clears: time for leftovers to fly in before the perk screen
};

// Маркет: permanent upgrades bought with banked єБали (texts in i18n: up.<id>, up.<id>.d). lvl 0..max.
export const UPGRADES = [
  { id: 'fpv', icon: '🚁', max: 3, base: 60, apply: (p, l) => { p.fpv = l; } },
  { id: 'reb', icon: '📡', max: 3, base: 45, apply: (p, l) => { p.reb = 0.12 * l; } },
  { id: 'nrk', icon: '🚜', max: 1, base: 150, apply: (p) => { p.revives = 1; } },
  { id: 'hp', icon: '❤️', max: 5, base: 20, apply: (p, l) => { p.maxHp += 12 * l; p.hp = p.maxHp; } },
  { id: 'dmg', icon: '💥', max: 5, base: 25, apply: (p, l) => { p.damage *= 1 + 0.08 * l; } },
  { id: 'rate', icon: '🔥', max: 5, base: 25, apply: (p, l) => { p.fireRate *= 1 + 0.07 * l; } },
  { id: 'speed', icon: '👟', max: 5, base: 20, apply: (p, l) => { p.speed *= 1 + 0.05 * l; } },
  { id: 'ebaly', icon: '📋', max: 3, base: 40, apply: (p, l) => { p.ebalyBonus += l; } },
];

export function upgradeCost(u, lvl) { return Math.round(u.base * Math.pow(lvl + 1, 1.5)); }

// Enemy archetypes. Escalating "competence", escalating farce.
export const ENEMY = { SHOVEL: 0, PISTOL: 1, RIFLE: 2, COVER: 3, NIVA: 4 };

// Per-type base stats (before per-wave scaling).
export const ENEMY_DEFS = {
  [ENEMY.SHOVEL]: {
    hp: 18, speed: 126, radius: 16, touch: 8, score: 1,
    ebaly: 1,
    weapon: 'melee',
    stumbleChance: 0.85, panicChance: 0.4,
    throwInterval: 2.6,   // occasionally flings a shovel
    sprite: 'naked',
  },
  [ENEMY.PISTOL]: {
    hp: 40, speed: 92, radius: 18, touch: 8, score: 3,
    ebaly: 2,
    weapon: 'pistol',
    stumbleChance: 0.3,
    shootInterval: 1.7, accuracy: 0.4, bulletDmg: 8, bulletSpeed: 360,
    sprite: 'pistol',
  },
  [ENEMY.RIFLE]: {
    hp: 64, speed: 72, radius: 19, touch: 10, score: 5,
    ebaly: 3,
    weapon: 'auto',
    stumbleChance: 0.2,
    shootInterval: 2.3, accuracy: 0.5, bulletDmg: 6, bulletSpeed: 420,
    burst: 5, burstGap: 0.09,   // automatic spray then a long fumble to reload
    sprite: 'rifle',
  },
  // "Окопник" (wave 3+): tough, accurate, fights from behind cover and peeks out to shoot.
  [ENEMY.COVER]: {
    hp: 95, speed: 104, radius: 19, touch: 10, score: 6,
    ebaly: 4,
    weapon: 'aimed', ai: 'cover',
    stumbleChance: 0.05,
    shootInterval: 1.3, accuracy: 0.86, bulletDmg: 11, bulletSpeed: 480,
    burst: 2, burstGap: 0.18,
    sprite: 'okopnyk',
  },
  // "Ніва" (wave 4+): rams the hero; when shot to pieces its crew bails out.
  [ENEMY.NIVA]: {
    hp: 170, speed: 185, radius: 34, touch: 18, score: 8,
    ebaly: 6,
    ai: 'car', vehicle: true,
    stumbleChance: 0,
    sprite: 'niva',
  },
};

// Niva crew (always 4), tougher the deeper the run.
export function nivaCrew(n) {
  const S = ENEMY.SHOVEL, Pi = ENEMY.PISTOL, R = ENEMY.RIFLE, C = ENEMY.COVER;
  if (n < 6) return [S, S, S, Pi];
  if (n < 9) return [S, S, Pi, R];
  if (n < 12) return [S, Pi, R, C];
  return [Pi, R, C, C];
}

// Wave plan: returns an array of ENEMY type ids to spawn this wave (== room number).
export function waveComposition(n) {
  const shovel = 4 + Math.round(n * 1.4);
  const pistol = n >= 2 ? Math.round((n - 1) * 1.0) : 0;
  const rifle = n >= 5 ? Math.round((n - 4) * 0.9) : 0;
  const cover = n >= 3 ? Math.round((n - 2) * 0.6) : 0;
  const niva = n >= 4 ? Math.floor((n - 1) / 3) : 0;
  const list = [];
  for (let i = 0; i < cover; i++) list.push(ENEMY.COVER);
  for (let i = 0; i < niva; i++) list.push(ENEMY.NIVA);
  for (let i = 0; i < shovel; i++) list.push(ENEMY.SHOVEL);
  for (let i = 0; i < pistol; i++) list.push(ENEMY.PISTOL);
  for (let i = 0; i < rifle; i++) list.push(ENEMY.RIFLE);
  return list;
}

// Mild per-wave stat scaling so late waves bite (gently).
export function waveScale(n) {
  return { hp: 1 + (n - 1) * 0.12, speed: 1 + (n - 1) * 0.03 };
}
