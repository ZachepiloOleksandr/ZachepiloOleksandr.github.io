// Content & tuning constants: palette, comic lines, perks, enemy defs, wave plan.

// Characters are drawn this much larger than their sprite so the art matches the hitbox.
export const CHAR_SCALE = 1.25;

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

// Comic shouts — humiliation through farce, no gore.
export const SHOUTS = {
  naked:   ['Ой!', 'Мамо!', 'Тікаймо!', 'Капці!', 'А-а-а!', 'Де штани?!', 'Ні-ні-ні!'],
  armed:   ['Каска налізла!', 'Рація не ловить!', 'Командир, що?!', 'Куди всі?', 'Я не бачу!', 'Заряджав?'],
  rifle:   ['Та-та-та!', 'Тримайсь!', 'Хто ставив запобіжник?', 'Патрони де?', 'Ой, заклинило!'],
  shovel:  ['Лови лопату!', 'Тримай!', 'На тобі!', 'Ось городина!'],
  friendly:['Ой, свої!', 'Це ж я!', 'Не в той бік!'],
  hurt:    ['Ай!', 'Тю!', 'Ну все...', 'Боляче!'],
  trip:    ['Гоп!', 'Спіткнувсь!', 'Ой-йой!'],
};

// All distinct strings the texture baker must pre-render into the atlas as sprites.
export const ALL_PHRASES = [
  ...new Set([].concat(SHOUTS.naked, SHOUTS.armed, SHOUTS.rifle, SHOUTS.shovel, SHOUTS.friendly, SHOUTS.hurt, SHOUTS.trip, ['+HP'])),
];

// Roguelike run upgrades. apply() mutates the player stat block in place.
export const PERKS = [
  { id: 'firerate', icon: '🔥', name: 'Скорострільність', desc: '+22% темп стрільби', apply: (p) => { p.fireRate *= 1.22; } },
  { id: 'damage',   icon: '💥', name: 'Калібр',           desc: '+28% шкоди',        apply: (p) => { p.damage *= 1.28; } },
  { id: 'speed',    icon: '👟', name: 'Біг підтюпцем',     desc: '+14% швидкості',    apply: (p) => { p.speed *= 1.14; } },
  { id: 'shotgun',  icon: '🌽', name: 'Качан дробу',       desc: '+1 куля віялом',    apply: (p) => { p.multishot += 1; } },
  { id: 'range',    icon: '🎯', name: 'Далекобій',         desc: '+20% дальність',    apply: (p) => { p.range *= 1.2; p.bulletSpeed *= 1.1; } },
  { id: 'pierce',   icon: '🔩', name: 'Бронебійні',        desc: 'куля б\'є +1 ворога', apply: (p) => { p.pierce += 1; } },
  { id: 'heal',     icon: '🩹', name: 'Аптечка',           desc: '+20 макс. HP, лікує', apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 45); } },
];

// Loot dropped by enemies. Coins (₴) persist between runs in the bank; medkits heal on the spot.
export const LOOT = {
  medkitChance: 0.05,
  medkitHeal: 20,
  magnetR: 95,        // pull radius (world px), before upgrades
  pickupR: 26,        // collect distance
  pullSpeed: 520,
  life: 14,           // seconds on the ground before vanishing
  vacuumDelay: 1.1,   // after a wave clears: time for leftovers to fly in before the perk screen
};

// Permanent upgrades bought with banked coins in the menu shop. lvl 0..max.
export const UPGRADES = [
  { id: 'hp',     icon: '❤️', name: 'Загартування', desc: '+12 макс. HP',        max: 5, base: 20, apply: (p, l) => { p.maxHp += 12 * l; p.hp = p.maxHp; } },
  { id: 'dmg',    icon: '💥', name: 'Набої',        desc: '+8% шкоди',           max: 5, base: 25, apply: (p, l) => { p.damage *= 1 + 0.08 * l; } },
  { id: 'rate',   icon: '🔥', name: 'Затвор',       desc: '+7% темп стрільби',   max: 5, base: 25, apply: (p, l) => { p.fireRate *= 1 + 0.07 * l; } },
  { id: 'speed',  icon: '👟', name: 'Берці',        desc: '+5% швидкості',       max: 5, base: 20, apply: (p, l) => { p.speed *= 1 + 0.05 * l; } },
  { id: 'magnet', icon: '🧲', name: 'Кишені',       desc: '+30% радіус збору',   max: 3, base: 15, apply: (p, l) => { p.magnetR *= 1 + 0.3 * l; } },
];

export function upgradeCost(u, lvl) { return Math.round(u.base * Math.pow(lvl + 1, 1.5)); }

// Enemy archetypes. Escalating "competence", escalating farce.
export const ENEMY = { SHOVEL: 0, PISTOL: 1, RIFLE: 2 };

// Per-type base stats (before per-wave scaling).
export const ENEMY_DEFS = {
  [ENEMY.SHOVEL]: {
    hp: 18, speed: 126, radius: 16, touch: 8, score: 1,
    coinChance: 0.6, coinValue: 1,
    weapon: 'melee',
    stumbleChance: 0.85, panicChance: 0.4,
    throwInterval: 2.6,   // occasionally flings a shovel
    sprite: 'naked',
  },
  [ENEMY.PISTOL]: {
    hp: 40, speed: 92, radius: 18, touch: 8, score: 3,
    coinChance: 0.9, coinValue: 2,
    weapon: 'pistol',
    stumbleChance: 0.3,
    shootInterval: 1.7, accuracy: 0.4, bulletDmg: 8, bulletSpeed: 360,
    sprite: 'pistol',
  },
  [ENEMY.RIFLE]: {
    hp: 64, speed: 72, radius: 19, touch: 10, score: 5,
    coinChance: 1, coinValue: 3,
    weapon: 'auto',
    stumbleChance: 0.2,
    shootInterval: 2.3, accuracy: 0.5, bulletDmg: 6, bulletSpeed: 420,
    burst: 5, burstGap: 0.09,   // automatic spray then a long fumble to reload
    sprite: 'rifle',
  },
};

// Wave plan: returns an array of ENEMY type ids to spawn this wave (== room number).
export function waveComposition(n) {
  const shovel = 4 + Math.round(n * 1.4);
  const pistol = n >= 2 ? Math.round((n - 1) * 1.0) : 0;
  const rifle = n >= 5 ? Math.round((n - 4) * 0.9) : 0;
  const list = [];
  for (let i = 0; i < shovel; i++) list.push(ENEMY.SHOVEL);
  for (let i = 0; i < pistol; i++) list.push(ENEMY.PISTOL);
  for (let i = 0; i < rifle; i++) list.push(ENEMY.RIFLE);
  return list;
}

// Mild per-wave stat scaling so late waves bite (gently).
export function waveScale(n) {
  return { hp: 1 + (n - 1) * 0.12, speed: 1 + (n - 1) * 0.03 };
}
