
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type UILanguage = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'it';
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
  streakCount?: number;
  lastCompletedDate?: string;
  dailyGoal?: number;
  apiKey?: string;
  srsBackType?: SRSBackType;
  srsDailyGoal?: number;
}

export interface HistoryItem extends StoryResponse {
  timestamp: number;
  completed: boolean;
}

export type SRSBackType = 'full_translation' | 'element_translation' | 'target_definition';

export type SRSCardRating = 1 | 2 | 3 | 4; // 1 = Again, 2 = Hard, 3 = Good, 4 = Easy

export interface SRSCard {
  id: string;
  storyTitle: string;
  storyTimestamp: number;
  sentence: Sentence;
  targetLanguage: string;
  nativeLanguage: string;
  state: 'new' | 'learning' | 'review' | 'mastered';
  reps: number;
  lapses: number;
  easeFactor: number; // default 2.5
  interval: number; // in days
  dueDate: number; // timestamp (ms)
  lastReviewed?: number; // timestamp (ms)
  masteredAt?: number; // timestamp (ms) when card graduated to mastered
  learningAt?: number; // timestamp (ms) when card started learning
}

export interface SRSStats {
  totalCards: number;
  dueToday: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  masteredCards: number;
  reviewedTodayCount: number;
}
