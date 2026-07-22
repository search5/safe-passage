import { moment } from 'obsidian';
import en from './locales/en';
import ko from './locales/ko';

const localeMap: Record<string, typeof en> = {
  en,
  ko,
  'ko-kr': ko,
};

// 현재 사용자의 로케일 감지
const currentLocale = (moment.locale() || 'en').toLowerCase();
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
