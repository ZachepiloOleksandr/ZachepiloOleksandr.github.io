import { UPGRADES, upgradeCost } from './data.js';
import { upgradeLevel, buyUpgrade } from './meta.js';
import { t, LANGS, getLang, applyDom } from './i18n.js';

// DOM overlays: HP/wave/kills/єБали, wave banner, menu, perk cards, death screen, meta shop, settings/pause.
// Buttons call api.on* callbacks, wired by main.
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
    droneBtn: $('droneBtn'), droneLbl: $('droneLbl'), pauseBtn: $('pauseBtn'),
    settings: $('settings'), setTitle: $('settingsTitle'), settingsBtn: $('settingsBtn'),
    setVolume: $('setVolume'), setVolumeVal: $('setVolumeVal'), setSfx: $('setSfx'), setMusic: $('setMusic'),
    setLangs: $('setLangs'), setResume: $('setResume'), setBack: $('setBack'), setQuit: $('setQuit'),
  };
  let lastAct = '', lastDrone = '';
  let bannerT = null, lastHp = -1, lastWave = -1, lastKill = -1, lastEb = '';
  let lastBest = null, waveN = 1;
  let settingsFrom = 'menu'; // 'menu' | 'pause'

  function hideCombat() {
    el.actions.classList.add('hidden'); el.droneBtn.classList.add('hidden'); el.pauseBtn.classList.add('hidden');
    lastAct = ''; lastDrone = '';
  }

  const api = {
    onStart: null, onRetry: null, onMenu: null, onBankChange: null, bank: null,
    onDrone: null, onFinish: null, onCapture: null,
    onPause: null, onResume: null, onSettingsChange: null, settings: null,

    setHP(hp, max) {
      hp = Math.max(0, Math.round(hp));
      if (hp === lastHp) return;
      lastHp = hp;
      el.hp.style.width = (100 * hp / max) + '%';
      el.hpl.textContent = hp;
    },
    setWave(n) { if (n === lastWave) return; lastWave = n; waveN = n; el.wave.textContent = t('wave', { n }); },
    setKills(k) { if (k === lastKill) return; lastKill = k; el.kill.textContent = '☠ ' + k; },
    // Confirmed єБали + claims pending DELTA verification (⏳).
    setEbaly(n, pending) {
      const key = n + '|' + pending;
      if (key === lastEb) return; lastEb = key;
      el.eb.textContent = n + ' ' + t('eb') + (pending ? ' ⏳+' + pending : '');
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
      el.droneLbl.textContent = s.ready ? t('ready') + (s.owned > 1 ? ' ×' + s.ready : '') : t('sec', { n: Math.ceil(s.next) });
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
      el.pauseBtn.classList.remove('hidden');
      el.menu.classList.add('hidden');
      el.death.classList.add('hidden');
      el.perks.classList.add('hidden');
      el.settings.classList.add('hidden');
    },

    showMenu(best, bank) {
      hideCombat();
      lastBest = best;
      el.menu.classList.remove('hidden');
      el.shop.classList.add('hidden');
      el.death.classList.add('hidden');
      el.perks.classList.add('hidden');
      el.settings.classList.add('hidden');
      el.menuBank.textContent = bank ? bank.ebaly : 0;
      el.hud.classList.add('hidden');
      el.stick.classList.add('hidden');
      renderBest();
    },

    showPerks(perks, confirmed, cb) {
      el.perks.classList.remove('hidden');
      el.perkNote.textContent = confirmed ? t('deltaOk', { n: confirmed }) : '';
      el.perkCards.innerHTML = '';
      perks.forEach((pk) => {
        const c = document.createElement('div');
        c.className = 'perkCard';
        c.innerHTML = `<div class="ic">${pk.icon}</div><div class="txt"><h3>${t('perk.' + pk.id)}</h3><p>${t('perk.' + pk.id + '.d')}</p></div>`;
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
        t('dReached', { n: stats.wave }) + '<br/>' +
        t('dKills', { n: stats.kills }) + '<br/>' +
        t('dEb', { n: stats.ebaly, bank: stats.bank }) + '<br/>' +
        (stats.captured || stats.evacuated ? t('dPow', { c: stats.captured, e: stats.evacuated }) + '<br/>' : '') +
        (stats.lost ? '<small>' + t('dLost', { n: stats.lost }) + '</small><br/>' : '') +
        t('dBest', { n: stats.best.wave });
    },

    showSettings(from) { settingsFrom = from; renderSettings(); el.settings.classList.remove('hidden'); },
    hideSettings() { el.settings.classList.add('hidden'); },
  };

  function renderBest() {
    const b = lastBest;
    el.menuBest.textContent = b && b.wave ? t('best', { w: b.wave, k: b.kills }) : '';
  }

  // Re-apply every translated label (after a language switch).
  function relabel() {
    applyDom();
    lastEb = ''; lastDrone = '';
    el.wave.textContent = t('wave', { n: waveN });
    renderBest();
    if (!el.shop.classList.contains('hidden')) renderShop();
    document.title = t('title').replace(/<br\/?>/g, ' ');
  }
  api.relabel = relabel;

  function renderShop() {
    const bank = api.bank;
    el.shopBank.innerHTML = t('shopBalance', { n: bank.ebaly });
    el.menuBank.textContent = bank.ebaly;
    el.shopCards.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = upgradeLevel(bank, u.id), maxed = lvl >= u.max;
      const cost = maxed ? 0 : upgradeCost(u, lvl);
      const c = document.createElement('div');
      c.className = 'perkCard shopCard' + (maxed ? ' maxed' : bank.ebaly < cost ? ' poor' : '');
      const pips = '<i class="on"></i>'.repeat(lvl) + '<i></i>'.repeat(u.max - lvl);
      const icon = u.id === 'fpv' ? el.droneBtn.querySelector('svg').outerHTML : u.icon;
      c.innerHTML = `<div class="ic">${icon}</div><div class="txt"><h3>${t('up.' + u.id)} <span class="pips">${pips}</span></h3><p>${t('up.' + u.id + '.d')}</p></div>` +
        `<div class="price">${maxed ? t('max') : cost + ' ' + t('eb')}</div>`;
      if (!maxed) c.addEventListener('click', () => {
        if (buyUpgrade(bank, u)) { api.onBankChange && api.onBankChange(); renderShop(); }
        else { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
      });
      el.shopCards.appendChild(c);
    }
  }

  function renderSettings() {
    const s = api.settings;
    el.setTitle.textContent = settingsFrom === 'pause' ? t('paused') : t('settings');
    el.setVolume.value = Math.round(s.volume * 100);
    el.setVolumeVal.textContent = Math.round(s.volume * 100) + '%';
    el.setSfx.textContent = s.sfx ? t('on') : t('off');
    el.setSfx.classList.toggle('off', !s.sfx);
    el.setMusic.textContent = s.music ? t('on') : t('off');
    el.setMusic.classList.toggle('off', !s.music);
    el.setLangs.innerHTML = '';
    for (const l of LANGS) {
      const b = document.createElement('button');
      b.className = 'langBtn' + (l.id === getLang() ? ' on' : '');
      b.textContent = l.name;
      b.addEventListener('click', () => changeSetting({ lang: l.id }));
      el.setLangs.appendChild(b);
    }
    el.setResume.classList.toggle('hidden', settingsFrom !== 'pause');
    el.setQuit.classList.toggle('hidden', settingsFrom !== 'pause');
    el.setBack.classList.toggle('hidden', settingsFrom === 'pause');
  }

  function changeSetting(patch) {
    Object.assign(api.settings, patch);
    api.onSettingsChange && api.onSettingsChange(patch);
    if ('lang' in patch) relabel();
    renderSettings();
  }

  el.setVolume.addEventListener('input', () => changeSetting({ volume: el.setVolume.value / 100 }));
  el.setSfx.addEventListener('click', () => changeSetting({ sfx: !api.settings.sfx }));
  el.setMusic.addEventListener('click', () => changeSetting({ music: !api.settings.music }));
  el.settingsBtn.addEventListener('click', () => { el.menu.classList.add('hidden'); api.showSettings('menu'); });
  el.setBack.addEventListener('click', () => { api.hideSettings(); el.menu.classList.remove('hidden'); });
  el.setResume.addEventListener('click', () => { api.hideSettings(); api.onResume && api.onResume(); });
  el.setQuit.addEventListener('click', () => { api.hideSettings(); api.onMenu && api.onMenu(); });
  el.pauseBtn.addEventListener('click', () => { if (api.onPause && api.onPause()) api.showSettings('pause'); });

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
