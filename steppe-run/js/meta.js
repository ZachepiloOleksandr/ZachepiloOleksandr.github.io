// Between-run progression: єБали bank + permanent upgrades, persisted in localStorage.
import { UPGRADES, upgradeCost } from './data.js';

const BANK_KEY = 'steppe.bank';

export function loadBank() {
  try {
    const b = JSON.parse(localStorage.getItem(BANK_KEY));
    if (b) {
      // Migrate: the first build banked "coins" (₴) — carry them over 1:1 as єБали.
      let eb = typeof b.ebaly === 'number' ? b.ebaly : typeof b.coins === 'number' ? b.coins : 0;
      const up = b.up || {};
      // The "magnet" upgrade (coin pickup radius) was retired with coins — refund what it cost.
      if (up.magnet) {
        const refund = [...Array(up.magnet).keys()].reduce((s, i) => s + upgradeCost({ base: 15 }, i), 0);
        console.log('BANK refund retired upgrade magnet lvl ' + up.magnet + ': +' + refund);
        eb += refund; delete up.magnet;
      }
      return { ebaly: eb, up };
    }
  } catch (e) { console.warn('bank load failed', e); }
  return { ebaly: 0, up: {} };
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
  if (bank.ebaly < cost) return false;
  bank.ebaly -= cost;
  bank.up[u.id] = lvl + 1;
  console.log('SHOP bought ' + u.id + ' → lvl ' + (lvl + 1) + ' for ' + cost + ' єБ, left ' + bank.ebaly);
  return true;
}

export function applyUpgrades(bank, player) {
  for (const u of UPGRADES) {
    const l = upgradeLevel(bank, u.id);
    if (l > 0) u.apply(player, l);
  }
}
