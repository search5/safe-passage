import { getLanguage } from 'obsidian';
import en from './locales/en';
import ko from './locales/ko';

const localeMap: Record<string, typeof en> = {
  en,
  ko,
  'ko-kr': ko,
};

// Obsidian 설정(Settings > General > Language)에 지정된 언어 코드 사용
const currentLocale = (getLanguage() || 'en').toLowerCase();
const translations = localeMap[currentLocale] ?? en;

export type TranslationKeys = keyof typeof en;

export function t(key: TranslationKeys, vars?: Record<string, string | number>): string {
  let text = translations[key] ?? en[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
    }
  }

  return text;
}
