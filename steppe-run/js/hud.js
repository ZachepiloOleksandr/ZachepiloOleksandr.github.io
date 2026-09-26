import { UPGRADES, upgradeCost, EB } from './data.js';
import { upgradeLevel, buyUpgrade } from './meta.js';

// DOM overlays: HP/wave/kills/єБали, wave banner, menu, perk cards, death screen, meta shop.
// Buttons call api.onStart / api.onRetry, wired by main.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), hp: $('hpfill'), hpl: $('hplabel'),
    wave: $('waveLabel'), kill: $('killLabel'), eb: $('ebLabel'), banner: $('banner'),
    menu: $('menu'), menuBest: $('menuBest'), menuBank: $('menuBank'),
    shop: $('shop'), shopBank: $('shopBank'), shopCards: $('shopCards'),
    perks: $('perks'), perkCards: $('perkCards'), perkNote: $('perkNote'),
    death: $('death'), deathStats: $('deathStats'),
    start: $('startBtn'), retry: $('retryBtn'), stick: $('stick'),
    shopBtn: $('shopBtn'), shopBack: $('shopBack'), toMenu: $('toMenuBtn'),
    actions: $('actions'), actFinish: $('actFinish'), actCapture: $('actCapture'),
    droneBtn: $('droneBtn'), droneLbl: $('droneLbl'),
  };
  let lastAct = '', lastDrone = '';
  let bannerT = null, lastHp = -1, lastWave = -1, lastKill = -1, lastEb = '';

  function hideCombat() {
    el.actions.classList.add('hidden'); el.droneBtn.classList.add('hidden');
    lastAct = ''; lastDrone = '';
  }

  const api = {
    onStart: null, onRetry: null, onMenu: null, onBankChange: null, bank: null,
    onDrone: null, onFinish: null, onCapture: null,

    setHP(hp, max) {
      hp = Math.max(0, Math.round(hp));
      if (hp === lastHp) return;
      lastHp = hp;
      el.hp.style.width = (100 * hp / max) + '%';
      el.hpl.textContent = hp;
    },
    setWave(n) { if (n === lastWave) return; lastWave = n; el.wave.textContent = 'Хвиля ' + n; },
    setKills(k) { if (k === lastKill) return; lastKill = k; el.kill.textContent = '☠ ' + k; },
    // Confirmed єБали + claims pending DELTA verification (⏳).
    setEbaly(n, pending) {
      const key = n + '|' + pending;
      if (key === lastEb) return; lastEb = key;
      el.eb.textContent = n + ' ' + EB + (pending ? ' ⏳+' + pending : '');
    },

    // Finish/capture buttons, shown only next to a downed enemy.
    showActions(show, capturing) {
      const key = show + '|' + capturing;
      if (key === lastAct) return; lastAct = key;
      el.actions.classList.toggle('hidden', !show);
      el.actCapture.classList.toggle('busy', !!capturing);
    },

    setDrone(s) {
      const key = s.owned + '|' + s.ready + '|' + Math.ceil(s.next);
      if (key === lastDrone) return; lastDrone = key;
      el.droneBtn.classList.toggle('hidden', !s.owned);
      el.droneBtn.classList.toggle('cool', !s.ready);
      el.droneLbl.textContent = s.ready ? (s.owned > 1 ? 'ГОТОВО ×' + s.ready : 'ГОТОВО') : Math.ceil(s.next) + 'с';
    },

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
      hideCombat();
      el.menu.classList.remove('hidden');
      el.shop.classList.add('hidden');
      el.death.classList.add('hidden');
      el.perks.classList.add('hidden');
      el.menuBank.textContent = bank ? bank.ebaly : 0;
      el.hud.classList.add('hidden');
      el.stick.classList.add('hidden');
      el.menuBest.textContent = best && best.wave
        ? `Рекорд: Хвиля ${best.wave} · принижено ${best.kills}` : '';
    },

    showPerks(perks, confirmed, cb) {
      el.perks.classList.remove('hidden');
      el.perkNote.textContent = confirmed ? `DELTA підтвердила: +${confirmed} ${EB}` : '';
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
      hideCombat();
      el.death.classList.remove('hidden');
      el.hud.classList.add('hidden');
      el.stick.classList.add('hidden');
      el.deathStats.innerHTML =
        `Дійшов до <b>Хвилі ${stats.wave}</b><br/>` +
        `Принижено ворогів: <b>${stats.kills}</b><br/>` +
        `єБали: <b>+${stats.ebaly}</b> (всього ${stats.bank} ${EB})<br/>` +
        (stats.captured || stats.evacuated ? `Полонених: <b>${stats.captured}</b> · евакуйовано: <b>${stats.evacuated}</b><br/>` : '') +
        (stats.lost ? `<small>Без підтвердження DELTA згоріло: ${stats.lost} ${EB}</small><br/>` : '') +
        `Рекорд: <b>Хвиля ${stats.best.wave}</b>`;
    },
  };

  function renderShop() {
    const bank = api.bank;
    el.shopBank.textContent = bank.ebaly;
    el.menuBank.textContent = bank.ebaly;
    el.shopCards.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = upgradeLevel(bank, u.id), maxed = lvl >= u.max;
      const cost = maxed ? 0 : upgradeCost(u, lvl);
      const c = document.createElement('div');
      c.className = 'perkCard shopCard' + (maxed ? ' maxed' : bank.ebaly < cost ? ' poor' : '');
      const pips = '<i class="on"></i>'.repeat(lvl) + '<i></i>'.repeat(u.max - lvl);
      c.innerHTML = `<div class="ic">${u.icon}</div><div class="txt"><h3>${u.name} <span class="pips">${pips}</span></h3><p>${u.desc}</p></div>` +
        `<div class="price">${maxed ? 'MAX' : cost + ' ' + EB}</div>`;
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
  // pointerdown (not click) so combat buttons react instantly while the other thumb steers.
  const press = (btn, fn) => btn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); fn(); });
  press(el.droneBtn, () => {
    if (!(api.onDrone && api.onDrone())) { el.droneBtn.classList.remove('shake'); void el.droneBtn.offsetWidth; el.droneBtn.classList.add('shake'); }
  });
  press(el.actFinish, () => api.onFinish && api.onFinish());
  press(el.actCapture, () => api.onCapture && api.onCapture());
  el.start.addEventListener('click', () => api.onStart && api.onStart());
  el.retry.addEventListener('click', () => api.onRetry && api.onRetry());
  return api;
}
