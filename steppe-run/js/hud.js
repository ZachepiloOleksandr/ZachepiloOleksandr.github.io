import { UPGRADES, upgradeCost } from './data.js';
import { upgradeLevel, buyUpgrade } from './meta.js';

// DOM overlays: HP/wave/kills/coins, wave banner, menu, perk cards, death screen, meta shop.
// Buttons call api.onStart / api.onRetry, wired by main.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), hp: $('hpfill'), hpl: $('hplabel'),
    wave: $('waveLabel'), kill: $('killLabel'), coin: $('coinLabel'), banner: $('banner'),
    menu: $('menu'), menuBest: $('menuBest'), menuBank: $('menuBank'),
    shop: $('shop'), shopBank: $('shopBank'), shopCards: $('shopCards'),
    perks: $('perks'), perkCards: $('perkCards'),
    death: $('death'), deathStats: $('deathStats'),
    start: $('startBtn'), retry: $('retryBtn'), stick: $('stick'),
    shopBtn: $('shopBtn'), shopBack: $('shopBack'), toMenu: $('toMenuBtn'),
  };
  let bannerT = null, lastHp = -1, lastWave = -1, lastKill = -1, lastCoin = -1;

  const api = {
    onStart: null, onRetry: null, onMenu: null, onBankChange: null, bank: null,

    setHP(hp, max) {
      hp = Math.max(0, Math.round(hp));
      if (hp === lastHp) return;
      lastHp = hp;
      el.hp.style.width = (100 * hp / max) + '%';
      el.hpl.textContent = hp;
    },
    setWave(n) { if (n === lastWave) return; lastWave = n; el.wave.textContent = 'Хвиля ' + n; },
    setKills(k) { if (k === lastKill) return; lastKill = k; el.kill.textContent = '☠ ' + k; },
    setCoins(c) { if (c === lastCoin) return; lastCoin = c; el.coin.textContent = '₴ ' + c; },

    banner(text, dur = 1500) {
      el.banner.textContent = text;
      el.banner.classList.remove('hidden');
      el.banner.style.animation = 'none';
      void el.banner.offsetWidth; // restart CSS pop animation
      el.banner.style.animation = '';
      if (bannerT) clearTimeout(bannerT);
      bannerT = setTimeout(() => el.banner.classList.add('hidden'), dur);
    },

    showGame() {
      el.hud.classList.remove('hidden');
      el.stick.classList.remove('hidden');
      el.menu.classList.add('hidden');
      el.death.classList.add('hidden');
      el.perks.classList.add('hidden');
    },

    showMenu(best, bank) {
      el.menu.classList.remove('hidden');
      el.shop.classList.add('hidden');
      el.death.classList.add('hidden');
      el.menuBank.textContent = bank ? bank.coins : 0;
      el.hud.classList.add('hidden');
      el.stick.classList.add('hidden');
      el.menuBest.textContent = best && best.wave
        ? `Рекорд: Хвиля ${best.wave} · принижено ${best.kills}` : '';
    },

    showPerks(perks, cb) {
      el.perks.classList.remove('hidden');
      el.perkCards.innerHTML = '';
      perks.forEach((pk) => {
        const c = document.createElement('div');
        c.className = 'perkCard';
        c.innerHTML = `<div class="ic">${pk.icon}</div><div class="txt"><h3>${pk.name}</h3><p>${pk.desc}</p></div>`;
        c.addEventListener('click', () => { el.perks.classList.add('hidden'); cb(pk); });
        el.perkCards.appendChild(c);
      });
    },

    showDeath(stats) {
      el.death.classList.remove('hidden');
      el.hud.classList.add('hidden');
      el.stick.classList.add('hidden');
      el.deathStats.innerHTML =
        `Дійшов до <b>Хвилі ${stats.wave}</b><br/>` +
        `Принижено ворогів: <b>${stats.kills}</b><br/>` +
        `Трофеї: <b>+${stats.coins} ₴</b> (скарбничка ${stats.bank} ₴)<br/>` +
        `Рекорд: <b>Хвиля ${stats.best.wave}</b>`;
    },
  };

  function renderShop() {
    const bank = api.bank;
    el.shopBank.textContent = bank.coins;
    el.menuBank.textContent = bank.coins;
    el.shopCards.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = upgradeLevel(bank, u.id), maxed = lvl >= u.max;
      const cost = maxed ? 0 : upgradeCost(u, lvl);
      const c = document.createElement('div');
      c.className = 'perkCard shopCard' + (maxed ? ' maxed' : bank.coins < cost ? ' poor' : '');
      const pips = '<i class="on"></i>'.repeat(lvl) + '<i></i>'.repeat(u.max - lvl);
      c.innerHTML = `<div class="ic">${u.icon}</div><div class="txt"><h3>${u.name} <span class="pips">${pips}</span></h3><p>${u.desc}</p></div>` +
        `<div class="price">${maxed ? 'MAX' : cost + ' ₴'}</div>`;
      if (!maxed) c.addEventListener('click', () => {
        if (buyUpgrade(bank, u)) { api.onBankChange && api.onBankChange(); renderShop(); }
        else { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
      });
      el.shopCards.appendChild(c);
    }
  }

  el.shopBtn.addEventListener('click', () => { renderShop(); el.menu.classList.add('hidden'); el.shop.classList.remove('hidden'); });
  el.shopBack.addEventListener('click', () => { el.shop.classList.add('hidden'); el.menu.classList.remove('hidden'); });
  el.toMenu.addEventListener('click', () => api.onMenu && api.onMenu());
  el.start.addEventListener('click', () => api.onStart && api.onStart());
  el.retry.addEventListener('click', () => api.onRetry && api.onRetry());
  return api;
}
