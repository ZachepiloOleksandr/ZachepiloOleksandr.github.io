// Between-run progression: coin bank + permanent upgrades, persisted in localStorage.
import { UPGRADES, upgradeCost } from './data.js';

const BANK_KEY = 'steppe.bank';

export function loadBank() {
  try {
    const b = JSON.parse(localStorage.getItem(BANK_KEY));
    if (b && typeof b.coins === 'number') return { coins: b.coins, up: b.up || {} };
  } catch (e) { console.warn('bank load failed', e); }
  return { coins: 0, up: {} };
}

export function saveBank(bank) {
  try { localStorage.setItem(BANK_KEY, JSON.stringify(bank)); }
  catch (e) { console.warn('bank save failed', e); }
}

export function upgradeLevel(bank, id) { return bank.up[id] || 0; }

// Returns true if bought. Caller persists.
export function buyUpgrade(bank, u) {
  const lvl = upgradeLevel(bank, u.id);
  if (lvl >= u.max) return false;
  const cost = upgradeCost(u, lvl);
  if (bank.coins < cost) return false;
  bank.coins -= cost;
  bank.up[u.id] = lvl + 1;
  console.log('SHOP bought ' + u.id + ' → lvl ' + (lvl + 1) + ' for ' + cost + ' ₴, left ' + bank.coins);
  return true;
}

export function applyUpgrades(bank, player) {
  for (const u of UPGRADES) {
    const l = upgradeLevel(bank, u.id);
    if (l > 0) u.apply(player, l);
  }
}
