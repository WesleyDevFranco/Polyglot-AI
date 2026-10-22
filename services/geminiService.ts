import { GoogleGenAI, Type } from "@google/genai";
import { CEFRLevel, StoryResponse, StorySize, AncientGreekDialect, AncientGreekFocus, ShakespeareanFocus } from "../types";
import { resolveNativeLanguage } from "../utils/starterVocab";

// ============================================================
// Constants
// ============================================================
const PROMPT_VOCAB_LIMIT = 1000;          // how many known words go into the prompt (tune: 500–1000)
const DEFAULT_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";
const REQUEST_TIMEOUT_MS = 120000;   // long stories can take a while; a client abort does NOT cancel server-side quota usage
const ATTEMPTS_PER_MODEL = 3;

// ============================================================
// API key
// ============================================================
// Decentralized by design: only the key provided by the user is ever used.
// No environment-variable fallback, so no developer key is bundled or shared.
export const getApiKey = (customApiKey?: string): string => {
  return customApiKey?.trim() || "";
};

// ============================================================
// Vocabulary
// ============================================================
const sanitizeKnownWords = (words: any): string[] => {
  if (!words) return [];
  let list: any[] = [];
  if (typeof words === 'string') {
    list = words.split(',');
  } else if (Array.isArray(words)) {
    list = words;
  }
  return Array.from(new Set(
    list
      .map(w => {
        if (typeof w === 'string') return w.trim().toLowerCase();
        if (w && typeof w === 'object') {
          return String(w.word || w.term || w.original || '').trim().toLowerCase();
        }
        return String(w || '').trim().toLowerCase();
      })
      .filter(w => w.length > 0 && w !== '[object object]')
  ));
};

// Fisher-Yates shuffle (unbiased, does not mutate the original array)
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Selects up to `targetCount` known words for the AI prompt:
 * - If total known words <= targetCount, returns all words directly.
 * - If greater:
 *   - Takes the 4000 most recent words ('recentVocabulary').
 *   - Extracts the 300 most recent words ('ultraRecent') to guarantee active reinforcement.
 *   - Randomly samples the remaining slots from the rest of the recent pool ('randomKnown') for variety.
 */
export const selectVocabularyForPrompt = (
  cleanWords: string[],
  targetCount = PROMPT_VOCAB_LIMIT
): string[] => {
  if (cleanWords.length <= targetCount) {
    return cleanWords;
  }

  const recentVocabulary = cleanWords.slice(-4000);

  const ultraRecentCount = Math.min(300, targetCount, recentVocabulary.length);
  const ultraRecent = recentVocabulary.slice(-ultraRecentCount);

  const remainingPool = recentVocabulary.slice(0, recentVocabulary.length - ultraRecentCount);

  const neededRandom = Math.max(0, targetCount - ultraRecentCount);
  const randomKnown = shuffle(remainingPool).slice(0, neededRandom);

  return [...randomKnown, ...ultraRecent];
};

// ============================================================
// Response parsing
// ============================================================
const parseJsonResponse = (responseText?: string): any => {
  if (!responseText) {
    throw new Error("No response text received from AI.");
  }
  let text = responseText.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  }
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Failed to parse valid JSON from AI response.");
  }
};

// ============================================================
// Language configuration
// ============================================================
export interface LanguageConfig {
  langDisplay: string;
  focusInstruction: string;
}

export const getLanguageConfig = (
  targetLanguage: string,
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus
): LanguageConfig => {
  if (targetLanguage === 'Ancient Greek') {
    const isKoine = ancientGreekDialect === 'koine';
    const dialectName = isKoine ? 'Koine Greek (Hellenistic / New Testament)' : 'Classical Attic Greek';
    const focusDetail = ancientGreekFocus === 'philosophical'
      ? 'Focus on classical philosophical, ethical, and dialectic themes (Platonic and Aristotelian vocabulary).'
      : 'Focus on narrative Attic prose, daily life, history, and classical storytelling.';
    return {
      langDisplay: `Ancient Greek (${dialectName})`,
      focusInstruction: `DIALECT & REGISTER: Write in authentic ${dialectName}. ${focusDetail} Use polytonic accents and classical Greek grammar principles.`
    };
  }

  if (targetLanguage === 'Shakespearean English') {
    let styleDetail = 'Classic Elizabethan drama and dialogue (thou/thee/thy/thine, -eth verbs, authentic 16th/17th-century stage English).';
    if (shakespeareanFocus === 'drama') {
      styleDetail = 'High dramatic tragedy and soliloquy tone reminiscent of Hamlet and Macbeth, noble vocabulary, intense theatrical gravitas.';
    } else if (shakespeareanFocus === 'courtly') {
      styleDetail = 'Courtly romance, wit, poetic sonnet cadence and playful dialogue reminiscent of Twelfth Night and Much Ado About Nothing.';
    }
    return {
      langDisplay: 'Shakespearean English (Early Modern English, Elizabethan / Jacobean)',
      focusInstruction: `REGISTER & STYLE: Write in authentic Early Modern English (${styleDetail}). Use appropriate archaic pronouns (thou, thee, thy, thine, ye), conjugations (art, doth, hath, canst), and period-accurate idioms without sacrificing comprehension under i+1.`
    };
  }

  if (targetLanguage === 'Latin') {
    return {
      langDisplay: 'Classical Latin',
      focusInstruction: 'REGISTER: Use authentic Classical Latin syntax, standard vocabulary, and appropriate case agreements.'
    };
  }

  return {
    langDisplay: targetLanguage,
    focusInstruction: `Ensure natural, authentic, idiomatic expressions appropriate for contemporary ${targetLanguage} at the specified CEFR level.`
  };
};

// ============================================================
// Resilience: retry with exponential backoff + model fallback
// ============================================================
type ErrorKind = 'overloaded' | 'quota' | 'timeout' | 'permanent';

const classifyError = (e: any): ErrorKind => {
  const code = Number(e?.status ?? e?.code);
  const msg = String(e?.message || "");
  if (code === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return 'quota';
  if ([500, 502, 503, 504].includes(code) || /UNAVAILABLE|high demand|overloaded|fetch failed|network/i.test(msg)) return 'overloaded';
  if (/timed? ?out|aborted|AbortError/i.test(msg) || e?.name === 'AbortError') return 'timeout';
  return 'permanent';
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Strategy per error kind:
 * - overloaded (5xx): retry the SAME model with exponential backoff, then move to the next model.
 * - quota (429): do NOT retry (retrying only burns more quota). Quotas are per model,
 *   so jump straight to the next model.
 * - timeout: do NOT retry the same model (the server may still be processing and counting
 *   the request). Move to the next model.
 * - permanent (400/401/403...): throw immediately.
 */
const generateWithResilience = async <T,>(
  run: (model: string) => Promise<T>,
  models: string[],
  attemptsPerModel = ATTEMPTS_PER_MODEL
): Promise<T> => {
  let lastErr: any;
  let lastKind: ErrorKind = 'permanent';
  for (const model of models) {
    for (let i = 0; i < attemptsPerModel; i++) {
      try {
        return await run(model);
      } catch (e: any) {
        lastErr = e;
        lastKind = classifyError(e);
        console.warn(`[${model}] attempt ${i + 1}/${attemptsPerModel} failed (${lastKind}):`, e?.message || e);
        if (lastKind === 'permanent') throw e;
        if (lastKind !== 'overloaded') break;          // quota / timeout: next model
        if (i < attemptsPerModel - 1) {
          await sleep(800 * 2 ** i + Math.random() * 400);
        }
      }
    }
  }
  const err: any = new Error(lastKind === 'quota' ? "QUOTA_EXCEEDED" : lastKind === 'timeout' ? "REQUEST_TIMEOUT" : "MODEL_OVERLOADED");
  err.cause = lastErr;
  throw err;
};

// ============================================================
// Gemini call (shared schema)
// ============================================================
const buildStorySchema = (required: string[]) => ({
  type: Type.OBJECT,
  properties: {
    story_title: { type: Type.STRING },
    level_target: { type: Type.STRING },
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER },
          original: { type: Type.STRING },
          translation: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          new_element: { type: Type.STRING },
          explanation: { type: Type.STRING },
          definition_target: { type: Type.STRING }
        },
        required: ["id", "original", "translation"]
      }
    },
    estimated_vocab_count: { type: Type.STRING },
    new_words_to_add: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required
});

const callGemini = async (apiKey: string, prompt: string, required: string[]): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });

  const run = (model: string) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: buildStorySchema(required)
      }
    });

  const response = await generateWithResilience(run, [DEFAULT_MODEL, FALLBACK_MODEL]);
  console.info(
    "Prompt tokens:", response.usageMetadata?.promptTokenCount,
    "| output tokens:", response.usageMetadata?.candidatesTokenCount
  );
  return parseJsonResponse(response.text);
};

// ============================================================
// Story generation
// ============================================================
export const generateStory = async (
  targetLanguage: string,
  nativeLanguage: string,
  level: CEFRLevel,
  knownWords: string[],
  storySize: StorySize,
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus,
  customApiKey?: string
): Promise<StoryResponse> => {
  const apiKey = getApiKey(customApiKey);
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const sizeMap = { short: "5 to 10", standard: "exactly 10", medium: "10 to 15", long: "15 to 25" };
  const sentenceCount = sizeMap[storySize] || "exactly 10";
  const { langDisplay, focusInstruction } = getLanguageConfig(targetLanguage, ancientGreekDialect, ancientGreekFocus, shakespeareanFocus);
  const resolvedNative = resolveNativeLanguage(nativeLanguage);

  const cleanWords = sanitizeKnownWords(knownWords);
  const wordsForPrompt = selectVocabularyForPrompt(cleanWords);
  const wordsDisplay = wordsForPrompt.length > 0 ? wordsForPrompt.join(", ") : "hello, world, is, the, in, to, and";

  const prompt = `
    Act as a Natural Language Acquisition Specialist. 
    Generate a story following the Natural Method (i+1).
    Target Language: ${langDisplay}
    Native Language: ${resolvedNative}
    CEFR Level: ${level}
    
    ${focusInstruction}
    
    KNOWN WORDS (${cleanWords.length} total words, a representative sample of ${wordsForPrompt.length} is listed): [${wordsDisplay}]
    
    RULES:
    1. i+1: Use known words for 95% of text.
    2. Introduce ONE new element per sentence NOT in the list.
    3. Length: ${sentenceCount} sentences.
    4. Provide IPA for the new element.
    5. TARGET DEFINITION: Provide a very brief definition of the 'new_element' IN ${targetLanguage} in the field 'definition_target'. Use simple words.
  `;

  const parsed = await callGemini(apiKey, prompt, ["story_title", "sentences", "new_words_to_add"]);
  const story = normalizeStoryResponse(parsed, false, level);

  // Known words that were left out of the sampled list must not come back as "new"
  const knownSet = new Set(cleanWords);
  story.new_words_to_add = story.new_words_to_add.filter(w => !knownSet.has(w));

  return story;
};

export const generateReviewStory = async (
  targetLanguage: string,
  nativeLanguage: string,
  knownWords: string[],
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus,
  customApiKey?: string
): Promise<StoryResponse> => {
  const apiKey = getApiKey(customApiKey);
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const { langDisplay, focusInstruction } = getLanguageConfig(targetLanguage, ancientGreekDialect, ancientGreekFocus, shakespeareanFocus);
  const resolvedNative = resolveNativeLanguage(nativeLanguage);

  const cleanWords = sanitizeKnownWords(knownWords);
  const wordsForPrompt = selectVocabularyForPrompt(cleanWords);

  const prompt = `
    Act as a Polyglot Instructor. Generate a REVIEW story.
    Target Language: ${langDisplay}
    Native Language: ${resolvedNative}
    
    ${focusInstruction}
    
    GOAL: Create a long, complex and coherent story using ONLY words from the known vocabulary list provided below. 
    
    KNOWN VOCABULARY: [${wordsForPrompt.join(", ")}]
    
    RULES:
    1. USE ONLY KNOWN WORDS. Do not introduce new vocabulary.
    2. LENGTH: 25 to 35 sentences.
    3. COHESION: The story must be very high quality and engaging.
    4. Fill 'new_element', 'phonetic', 'explanation', and 'definition_target' with empty strings.
  `;

  const parsed = await callGemini(apiKey, prompt, ["story_title", "sentences"]);
  return normalizeStoryResponse(parsed, true);
};

// ============================================================
// Response normalization
// ============================================================
export const normalizeStoryResponse = (data: any, isReview = false, fallbackLevel = 'A1'): StoryResponse => {
  if (!data || typeof data !== 'object') {
    return {
      story_title: "Generated Story",
      level_target: fallbackLevel as any,
      sentences: [],
      estimated_vocab_count: "0",
      new_words_to_add: [],
      is_review: isReview
    };
  }

  const source = data.story && typeof data.story === 'object' ? data.story : data;
  const story_title = String(source.story_title || source.title || data.story_title || data.title || "Lesson Story");
  const level_target = source.level_target || data.level_target || fallbackLevel;
  const estimated_vocab_count = String(source.estimated_vocab_count || data.estimated_vocab_count || "0");

  let rawSentences = source.sentences || data.sentences || source.sentence_list || data.sentence_list;
  if (!Array.isArray(rawSentences)) {
    if (typeof source.text === 'string' || typeof data.text === 'string') {
      const text = source.text || data.text;
      rawSentences = text.split(/(?<=[.?!])\s+/).filter(Boolean).map((s: string, idx: number) => ({
        id: idx + 1,
        original: s,
        translation: '',
        new_element: '',
        explanation: ''
      }));
    } else {
      rawSentences = [];
    }
  }

  const sentences = (rawSentences as any[]).map((s: any, idx: number) => {
    if (typeof s === 'string') {
      return {
        id: idx + 1,
        original: s,
        translation: '',
        phonetic: '',
        new_element: '',
        explanation: '',
        definition_target: ''
      };
    }
    return {
      id: typeof s?.id === 'number' ? s.id : idx + 1,
      original: String(s?.original || s?.sentence || s?.text || '').trim(),
      translation: String(s?.translation || s?.meaning || '').trim(),
      phonetic: String(s?.phonetic || s?.ipa || '').trim(),
      new_element: String(s?.new_element || s?.new_word || s?.target_word || '').trim(),
      explanation: String(s?.explanation || '').trim(),
      definition_target: String(s?.definition_target || s?.definition || '').trim()
    };
  }).filter((s: any) => s.original.length > 0);

  let rawNewWords = source.new_words_to_add || data.new_words_to_add;
  let new_words_to_add: string[] = [];
  if (Array.isArray(rawNewWords)) {
    new_words_to_add = rawNewWords.map((w: any) => String(w || '').trim().toLowerCase()).filter(Boolean);
  } else if (typeof rawNewWords === 'string') {
    new_words_to_add = rawNewWords.split(/[,;\s]+/).map((w: string) => w.trim().toLowerCase()).filter(Boolean);
  } else if (!isReview) {
    new_words_to_add = Array.from(new Set(
      sentences.map((s: any) => s.new_element).filter(Boolean).map((w: string) => w.toLowerCase())
    ));
  }

  return {
    story_title,
    level_target,
    sentences,
    estimated_vocab_count,
    new_words_to_add,
    is_review: isReview
  };
};