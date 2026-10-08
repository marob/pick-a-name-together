// Internationalisation: typed dictionaries (fr = reference), plurals via Intl.PluralRules.
import { fr } from './fr';
import { en } from './en';
import { es } from './es';

export type Lang = 'fr' | 'en' | 'es';
/** Plain entry, or plural forms picked from the `count` parameter */
export type Entry = string | { one: string; other: string };
export type Key = keyof typeof fr;
export type Dict = Record<Key, Entry>;

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

const DICTS: Record<Lang, Dict> = { fr, en, es };
const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' };

let current: Lang = detectLang();

/** Browser language among the available ones (English by default) */
export function detectLang(): Lang {
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  for (const p of prefs) {
    const code = p?.slice(0, 2).toLowerCase();
    if (code === 'fr' || code === 'en' || code === 'es') return code;
  }
  return 'en';
}

export function setLang(lang: Lang) {
  current = lang;
  document.documentElement.lang = lang;
  document.title = t('app.title');
}

export const getLang = () => current;
export const locale = () => LOCALES[current];

export function t(key: Key, params?: Record<string, string | number>): string {
  let entry: Entry = DICTS[current][key] ?? fr[key];
  if (typeof entry !== 'string') {
    const count = Number(params?.count ?? 0);
    entry = new Intl.PluralRules(locale()).select(count) === 'one' ? entry.one : entry.other;
  }
  if (!params) return entry;
  return entry.replace(/\{(\w+)\}/g, (m, p) => {
    const v = params[p];
    if (v === undefined) return m;
    return typeof v === 'number' ? formatNumber(v) : v;
  });
}

export const formatNumber = (n: number) => new Intl.NumberFormat(locale()).format(n);
export const formatDate = (ms: number) => new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
export const formatDay = (ms: number) => new Intl.DateTimeFormat(locale(), { dateStyle: 'short' }).format(ms);
