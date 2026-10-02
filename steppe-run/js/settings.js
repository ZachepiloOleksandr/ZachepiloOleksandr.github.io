// Player settings (volume, sound, music, language), persisted in localStorage.
import { AUTO, LANGS } from './i18n.js';

const KEY = 'steppe.settings';
// language: 'auto' follows the device language on every launch; a picked id pins it.
export const SETTINGS_DEFAULTS = { volume: 0.8, sfx: true, music: true, language: AUTO };

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { console.warn('settings load failed', e); }
  const out = { ...SETTINGS_DEFAULTS, ...s };
  out.volume = Math.min(1, Math.max(0, Number(out.volume) || 0));
  // Older builds saved the auto-detected language as `lang`; start everyone on auto.
  delete out.lang;
  if (out.language !== AUTO && !LANGS.some((l) => l.id === out.language)) out.language = AUTO;
  return out;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn('settings save failed', e); }
}
