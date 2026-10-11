
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type UILanguage = 'en' | 'pt' | 'es';
export type StorySize = 'short' | 'standard' | 'medium' | 'long';
export type AncientGreekDialect = 'attic' | 'koine';
export type AncientGreekFocus = 'general' | 'philosophical';
export type ShakespeareanFocus = 'general' | 'drama' | 'courtly';

export interface Sentence {
  id: number;
  original: string;
  translation: string;
  phonetic: string; 
  new_element: string;
  explanation: string;
  definition_target: string; // New field for immersive learning
}

export interface StoryResponse {
  story_title: string;
  level_target: CEFRLevel;
  sentences: Sentence[];
  estimated_vocab_count: string;
  new_words_to_add: string[];
  is_review?: boolean;
}

export interface UserProfile {
  name: string;
  targetLanguage: string;
  nativeLanguage: string;
  level: CEFRLevel;
  knownWords: string[];
  uiLanguage: UILanguage;
  darkMode: boolean;
  notificationTime: string; // "HH:mm"
  notificationsEnabled: boolean;
  storySize: StorySize;
  ancientGreekDialect?: AncientGreekDialect;
  ancientGreekFocus?: AncientGreekFocus;
  shakespeareanFocus?: ShakespeareanFocus;
}

export interface HistoryItem extends StoryResponse {
  timestamp: number;
  completed: boolean;
}
