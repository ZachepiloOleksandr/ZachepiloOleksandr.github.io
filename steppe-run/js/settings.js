// Player settings (volume, sound, music, language), persisted in localStorage.
import { detectLang, LANGS } from './i18n.js';

const KEY = 'steppe.settings';
export const SETTINGS_DEFAULTS = { volume: 0.8, sfx: true, music: true, lang: null };

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { console.warn('settings load failed', e); }
  const out = { ...SETTINGS_DEFAULTS, ...s };
  out.volume = Math.min(1, Math.max(0, Number(out.volume) || 0));
  if (!LANGS.some((l) => l.id === out.lang)) out.lang = detectLang();
  return out;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn('settings save failed', e); }
}
