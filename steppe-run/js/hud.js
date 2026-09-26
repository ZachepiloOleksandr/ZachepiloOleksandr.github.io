// DOM overlays: HP/wave/kills, wave banner, menu, perk cards, death screen.
// Buttons call api.onStart / api.onRetry, wired by main.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), hp: $('hpfill'), hpl: $('hplabel'),
    wave: $('waveLabel'), kill: $('killLabel'), banner: $('banner'),
    menu: $('menu'), menuBest: $('menuBest'),
    perks: $('perks'), perkCards: $('perkCards'),
    death: $('death'), deathStats: $('deathStats'),
    start: $('startBtn'), retry: $('retryBtn'), stick: $('stick'),
  };
  let bannerT = null, lastHp = -1, lastWave = -1, lastKill = -1;

  const api = {
    onStart: null, onRetry: null,

    setHP(hp, max) {
      hp = Math.max(0, Math.round(hp));
      if (hp === lastHp) return;
      lastHp = hp;
      el.hp.style.width = (100 * hp / max) + '%';
      el.hpl.textContent = hp;
    },
    setWave(n) { if (n === lastWave) return; lastWave = n; el.wave.textContent = 'Хвиля ' + n; },
    setKills(k) { if (k === lastKill) return; lastKill = k; el.kill.textContent = '☠ ' + k; },

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

    showMenu(best) {
      el.menu.classList.remove('hidden');
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
        `Рекорд: <b>Хвиля ${stats.best.wave}</b>`;
    },
  };

  el.start.addEventListener('click', () => api.onStart && api.onStart());
  el.retry.addEventListener('click', () => api.onRetry && api.onRetry());
  return api;
}
