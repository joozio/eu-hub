/**
 * i18n system for EU Hub
 * Maps EU countries to their primary language, provides translation function.
 */

// Country code → language code
export const COUNTRY_LANG: Record<string, string> = {
  AT: 'de', BE: 'fr', BG: 'bg', HR: 'hr', CY: 'el', CZ: 'cs',
  DK: 'da', EE: 'et', FI: 'fi', FR: 'fr', DE: 'de', GR: 'el',
  HU: 'hu', IE: 'en', IT: 'it', LV: 'lv', LT: 'lt', LU: 'fr',
  MT: 'en', NL: 'nl', PL: 'pl', PT: 'pt', RO: 'ro', SK: 'sk',
  SI: 'sl', ES: 'es', SE: 'sv',
};

// Language code → native name
export const LANG_NAMES: Record<string, string> = {
  en: 'English', de: 'Deutsch', fr: 'Fran\u00e7ais', es: 'Espa\u00f1ol',
  it: 'Italiano', pl: 'Polski', nl: 'Nederlands', pt: 'Portugu\u00eas',
  ro: 'Rom\u00e2n\u0103', cs: '\u010ce\u0161tina', sk: 'Sloven\u010dina', hu: 'Magyar',
  bg: '\u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438', hr: 'Hrvatski', sl: 'Sloven\u0161\u010dina',
  el: '\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac', da: 'Dansk', sv: 'Svenska',
  fi: 'Suomi', et: 'Eesti', lv: 'Latvie\u0161u', lt: 'Lietuvi\u0173',
};

// Language code → full language name in English (for Mistral prompts)
export const LANG_ENGLISH: Record<string, string> = {
  en: 'English', de: 'German', fr: 'French', es: 'Spanish',
  it: 'Italian', pl: 'Polish', nl: 'Dutch', pt: 'Portuguese',
  ro: 'Romanian', cs: 'Czech', sk: 'Slovak', hu: 'Hungarian',
  bg: 'Bulgarian', hr: 'Croatian', sl: 'Slovenian', el: 'Greek',
  da: 'Danish', sv: 'Swedish', fi: 'Finnish', et: 'Estonian',
  lv: 'Latvian', lt: 'Lithuanian',
};

export function getLang(countryCode: string): string {
  return COUNTRY_LANG[countryCode] || 'en';
}

export function getLangEnglish(countryCode: string): string {
  return LANG_ENGLISH[getLang(countryCode)] || 'English';
}

export function normalizeLangCode(lang: string): string {
  const code = (lang || '').trim().toLowerCase();
  return code || 'en';
}
