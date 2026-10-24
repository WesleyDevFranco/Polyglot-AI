import { UILanguage } from '../types';

export const UI_LANGUAGE_TO_NATIVE_NAME: Record<UILanguage, string> = {
  pt: 'Portuguese',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian'
};

export const getNativeLanguageFromUI = (uiLang?: UILanguage): string => {
  if (!uiLang) return 'Portuguese';
  return UI_LANGUAGE_TO_NATIVE_NAME[uiLang] || 'Portuguese';
};

const NATIVE_NAME_TO_UI_CODE: Record<string, UILanguage> = {
  portuguese: 'pt',
  português: 'pt',
  english: 'en',
  inglês: 'en',
  spanish: 'es',
  español: 'es',
  espanhol: 'es',
  french: 'fr',
  français: 'fr',
  francês: 'fr',
  german: 'de',
  deutsch: 'de',
  alemão: 'de',
  italian: 'it',
  italiano: 'it'
};

export const resolveNativeLanguage = (codeOrName?: string): string => {
  if (!codeOrName) return 'Portuguese';
  const trimmed = codeOrName.trim().toLowerCase();
  if (trimmed in UI_LANGUAGE_TO_NATIVE_NAME) {
    return UI_LANGUAGE_TO_NATIVE_NAME[trimmed as UILanguage];
  }
  const uiCode = NATIVE_NAME_TO_UI_CODE[trimmed];
  if (uiCode && UI_LANGUAGE_TO_NATIVE_NAME[uiCode]) {
    return UI_LANGUAGE_TO_NATIVE_NAME[uiCode];
  }
  return codeOrName;
};

export const getUiLanguageFromNative = (nativeName?: string): UILanguage => {
  if (!nativeName) return 'pt';
  const trimmed = nativeName.trim().toLowerCase();
  if (trimmed in UI_LANGUAGE_TO_NATIVE_NAME) {
    return trimmed as UILanguage;
  }
  return NATIVE_NAME_TO_UI_CODE[trimmed] || 'en';
};

export const NATIVE_LANGUAGES: { code: UILanguage; name: string; nativeLabel: string; flag: string }[] = [
  { code: 'pt', name: 'Portuguese', nativeLabel: 'Português', flag: '🇧🇷' },
  { code: 'en', name: 'English', nativeLabel: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeLabel: 'Italiano', flag: '🇮🇹' }
];

export const EXPERIMENTAL_LANGUAGES = ['Latin', 'Ancient Greek', 'Shakespearean English'];

export const isExperimentalLanguage = (lang?: string): boolean => {
  return Boolean(lang && EXPERIMENTAL_LANGUAGES.includes(lang));
};

export const TARGET_LANGUAGES: { id: string; label: string; flag: string; experimental?: boolean }[] = [
  { id: 'English', label: 'English', flag: '🇺🇸' },
  { id: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { id: 'French', label: 'Français', flag: '🇫🇷' },
  { id: 'German', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'Italian', label: 'Italiano', flag: '🇮🇹' },
  { id: 'Portuguese', label: 'Português', flag: '🇧🇷' },
  { id: 'Japanese', label: '日本語 (Japanese)', flag: '🇯🇵' },
  { id: 'Chinese', label: '中文 (Chinese)', flag: '🇨🇳' },
  { id: 'Russian', label: 'Русский (Russian)', flag: '🇷🇺' },
  { id: 'Latin', label: 'Latina (Classical Latin) ⚠️', flag: '🏛️', experimental: true },
  { id: 'Modern Greek', label: 'Ελληνικά (Modern Greek)', flag: '🇬🇷' },
  { id: 'Ancient Greek', label: 'Ancient Greek ⚠️', flag: '🏺', experimental: true },
  { id: 'Shakespearean English', label: 'Shakespearean English ⚠️', flag: '📜', experimental: true }
];

export const STARTER_VOCABULARY: Record<string, string[]> = {
  'Shakespearean English': [
    'thou', 'thee', 'thy', 'thine', 'art', 'hath', 'doth', 'tis', 
    'wherefore', 'anon', 'nay', 'aye', 'fair', 'heart', 'lord', 'lady', 
    'love', 'night', 'sun', 'speak', 'shall', 'good', 'heavens', 'farewell'
  ],
  'Ancient Greek': [
    'logos', 'theos', 'anthropos', 'psyche', 'sophia', 'kosmos', 
    'arete', 'nomos', 'physis', 'polis', 'kalon', 'agathon', 'nous'
  ],
  'Latin': [
    'salve', 'terra', 'aqua', 'ignis', 'caelum', 'homo', 'deus', 
    'amor', 'lux', 'nox', 'vita', 'mors', 'tempus', 'veritas'
  ],
  'English': ['hello', 'world', 'the', 'is', 'a', 'to', 'in', 'and', 'you', 'it'],
  'Spanish': ['hola', 'mundo', 'el', 'la', 'es', 'un', 'una', 'en', 'y', 'de'],
  'Portuguese': ['olá', 'mundo', 'o', 'a', 'é', 'um', 'uma', 'em', 'e', 'de'],
  'French': ['bonjour', 'monde', 'le', 'la', 'est', 'un', 'une', 'dans', 'et', 'de'],
  'German': ['hallo', 'welt', 'der', 'die', 'das', 'ist', 'ein', 'eine', 'in', 'und'],
  'Italian': ['ciao', 'mondo', 'il', 'la', 'è', 'un', 'una', 'in', 'e', 'di'],
  'Japanese': ['konnichiwa', 'sekai', 'kore', 'sore', 'watashi', 'anata', 'desu', 'wa', 'no'],
  'Chinese': ['nihao', 'shijie', 'zhe', 'na', 'wo', 'ni', 'shi', 'zai', 'he', 'de'],
  'Russian': ['privet', 'mir', 'eto', 'ya', 'ty', 'on', 'ona', 'v', 'i', 'ne'],
  'Modern Greek': ['geia', 'kosmos', 'aftos', 'afti', 'einai', 'enas', 'mia', 'se', 'kai']
};

export const getStarterVocabulary = (targetLanguage: string): string[] => {
  return STARTER_VOCABULARY[targetLanguage] || STARTER_VOCABULARY['English'];
};
