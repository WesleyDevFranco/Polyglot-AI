import { GoogleGenAI, Type } from "@google/genai";
import { CEFRLevel, StoryResponse, StorySize, AncientGreekDialect, AncientGreekFocus, ShakespeareanFocus } from "../types";
import { resolveNativeLanguage } from "../utils/starterVocab";

// ============================================================
// Constants
// ============================================================
export interface ModelChainEntry {
  model: string;
  attempts: number;
}

export const MODEL_CHAIN: ModelChainEntry[] = [
  { model: "gemini-3.8-flash",      attempts: 3 },
  { model: "gemini-3.6-flash",      attempts: 2 },
  { model: "gemini-3.5-flash-lite", attempts: 1 },
  { model: "gemini-3.1-flash-lite", attempts: 1 },
];

export const PROMPT_VOCAB_LIMIT = 1000; // how many known words go into prompt
export const COOLDOWN_DAILY_MS = 6 * 60 * 60 * 1000; // 6 hours for daily quota
export const COOLDOWN_RATE_LIMIT_MS = 60 * 1000; // 60 seconds for standard rate limit
export const MAX_INVALID_NEW_ELEMENT_RATIO = 0.3; // max 30% invalid new elements before regen
const quotaCooldowns = new Map<string, number>(); // in-memory: model name -> cooldown expiry timestamp
const REQUEST_TIMEOUT_MS = 120000;   // long stories can take a while; a client abort does NOT cancel server-side quota usage

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
 * 1. Up to 150 weak words that are also in the user's known vocabulary (if provided).
 * 2. The 300 most recent words from known vocabulary to guarantee active reinforcement.
 * 3. Random Fisher-Yates sample of remaining words up to targetCount.
 * Maintains no duplicates.
 */
export const selectVocabularyForPrompt = (
  cleanWords: string[],
  targetCount = PROMPT_VOCAB_LIMIT,
  weakWords?: string[]
): string[] => {
  const cleanSet = new Set(cleanWords);
  const result: string[] = [];
  const added = new Set<string>();

  // 1. Up to 150 weak words that are also known
  if (weakWords && weakWords.length > 0) {
    for (const w of weakWords) {
      const lower = w.trim().toLowerCase();
      if (lower && cleanSet.has(lower) && !added.has(lower)) {
        result.push(lower);
        added.add(lower);
        if (result.length >= 150) break;
      }
    }
  }

  // If cleanWords total <= targetCount, append all remaining known words
  if (cleanWords.length <= targetCount) {
    for (const w of cleanWords) {
      if (!added.has(w)) {
        result.push(w);
        added.add(w);
      }
    }
    return shuffle(result);
  }

  // 2. 300 most recent words from cleanWords
  const ultraRecentCount = Math.min(300, cleanWords.length);
  const ultraRecent = cleanWords.slice(-ultraRecentCount);
  for (let i = ultraRecent.length - 1; i >= 0; i--) {
    const w = ultraRecent[i];
    if (!added.has(w) && result.length < targetCount) {
      result.push(w);
      added.add(w);
    }
  }

  // 3. Fisher-Yates sample from remaining words
  const remaining = cleanWords.filter(w => !added.has(w));
  const shuffled = shuffle(remaining);
  for (const w of shuffled) {
    if (result.length >= targetCount) break;
    result.push(w);
    added.add(w);
  }

  return shuffle(result);
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
type ErrorKind = 'overloaded' | 'quota' | 'timeout' | 'not_found' | 'permanent';

const classifyError = (e: any): ErrorKind => {
  const code = Number(e?.status ?? e?.code);
  const msg = String(e?.message || "");
  if (code === 404 || /NOT_FOUND|not found/i.test(msg)) return 'not_found';
  if (code === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return 'quota';
  if ([500, 502, 503, 504].includes(code) || /UNAVAILABLE|high demand|overloaded|fetch failed|network/i.test(msg)) return 'overloaded';
  if (/timed? ?out|aborted|AbortError/i.test(msg) || e?.name === 'AbortError') return 'timeout';
  return 'permanent';
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface GenerationResult<T> {
  result: T;
  modelUsed: string;
}

/**
 * Strategy per error kind:
 * - overloaded (5xx): retry the SAME model with exponential backoff up to attempts, then move to next model.
 * - quota (429): do NOT retry; put model into COOLDOWN_MS cooldown and jump directly to next model.
 * - timeout: do NOT retry same model; jump to next model.
 * - not_found (404): model does not exist for this key; log a warning and skip to next model without retrying.
 * - permanent (400/401/403...): throw immediately.
 * 
 * Cooldown:
 * - Models currently in quota cooldown are skipped.
 * - If ALL models in chain are in cooldown, ignore cooldown and try the chain normally once.
 */
const generateWithResilience = async <T,>(
  run: (model: string) => Promise<T>,
  chain: ModelChainEntry[] = MODEL_CHAIN
): Promise<GenerationResult<T>> => {
  const now = Date.now();
  // Filter out models currently in cooldown
  let activeChain = chain.filter(entry => {
    const cooldownUntil = quotaCooldowns.get(entry.model);
    return !cooldownUntil || cooldownUntil <= now;
  });

  // If ALL models are in cooldown, ignore cooldown and attempt the chain normally once
  if (activeChain.length === 0) {
    activeChain = chain;
  }

  let lastErr: any;
  let lastKind: ErrorKind = 'permanent';

  for (const entry of activeChain) {
    const { model, attempts } = entry;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await run(model);
        // Successful response - clear any active cooldown for this model
        quotaCooldowns.delete(model);
        return { result: res, modelUsed: model };
      } catch (e: any) {
        lastErr = e;
        lastKind = classifyError(e);

        if (lastKind === 'permanent') {
          throw e;
        }

        if (lastKind === 'not_found') {
          console.warn(`[${model}] model not found for this key (404), skipping model in chain:`, e?.message || e);
          break; // skip to next model in chain immediately without retrying
        }

        if (lastKind === 'quota') {
          const isDaily = /PerDay|per day|daily/i.test(String(e?.message || ""));
          const cooldownDuration = isDaily ? COOLDOWN_DAILY_MS : COOLDOWN_RATE_LIMIT_MS;
          console.warn(`[${model}] quota exceeded (429), ${isDaily ? 'daily limit' : 'rate limit'}, entering ${cooldownDuration / 1000}s cooldown; moving to next model:`, e?.message || e);
          quotaCooldowns.set(model, Date.now() + cooldownDuration);
          break; // jump straight to next model without retrying
        }

        if (lastKind === 'timeout') {
          console.warn(`[${model}] request timeout, moving to next model:`, e?.message || e);
          break; // jump straight to next model without retrying
        }

        // 'overloaded' (5xx)
        console.warn(`[${model}] attempt ${i + 1}/${attempts} failed (${lastKind}):`, e?.message || e);
        if (i < attempts - 1) {
          await sleep(800 * 2 ** i + Math.random() * 400);
        }
      }
    }
  }

  const err: any = new Error(
    lastKind === 'quota'
      ? "QUOTA_EXCEEDED"
      : lastKind === 'timeout'
        ? "REQUEST_TIMEOUT"
        : "MODEL_OVERLOADED"
  );
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
          definition_target: { type: Type.STRING },
          part_of_speech: { type: Type.STRING }
        },
        required: ["id", "original", "translation"]
      }
    },
    estimated_vocab_count: { type: Type.STRING },
    new_words_to_add: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required
});

const callGemini = async (apiKey: string, prompt: string, required: string[]): Promise<{ data: any; modelUsed: string }> => {
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

  const { result: response, modelUsed } = await generateWithResilience(run, MODEL_CHAIN);
  console.info(
    `[Model: ${modelUsed}] Prompt tokens:`, response.usageMetadata?.promptTokenCount,
    "| output tokens:", response.usageMetadata?.candidatesTokenCount
  );
  const data = parseJsonResponse(response.text);
  return { data, modelUsed };
};

// ============================================================
// ============================================================
// Post-generation i+1 validation
// ============================================================
export const MIN_KNOWN_RATIO_STORY = 0.85; // 85% known words threshold for i+1 story
export const MAX_UNKNOWN_RATIO_REVIEW = 0.05; // 5% max unknown words for review story

export interface StoryValidationResult {
  knownRatio: number;
  unknownRatio: number;
  unknownWordsPerSentence: { sentenceId: number; unknownWords: string[] }[];
  sentencesWithMultipleNewElements: number[];
  isValid: boolean;
}

/**
 * Tokenizer dropping elided prefixes (l', dell', un', qu', don') and matching Unicode words > 1 char
 */
export const tokenize = (text: string): string[] =>
  text.toLowerCase()
    .replace(/[\p{L}\p{M}]+['’]/gu, ' ')   // drop elided prefixes: l', dell', un', qu', don'
    .match(/[\p{L}\p{M}]+/gu)?.filter(t => t.length > 1) || [];

/**
 * Returns the IDs of sentences whose new_element, when tokenized, has ALL words
 * already present in the user's complete known vocabulary.
 * Sentences without a new_element are not included.
 */
export const getInvalidNewElementIds = (story: StoryResponse, knownWords: string[]): number[] => {
  const cleanKnown = sanitizeKnownWords(knownWords);
  const knownSet = new Set(cleanKnown);
  const invalidIds: number[] = [];

  const sentences = Array.isArray(story.sentences) ? story.sentences : [];
  for (const s of sentences) {
    if (!s.new_element || !s.new_element.trim()) continue;
    const tokens = tokenize(s.new_element);
    if (tokens.length === 0) continue;
    const allKnown = tokens.every(t => knownSet.has(t));
    if (allKnown) {
      invalidIds.push(s.id);
    }
  }

  return invalidIds;
};

/**
 * Validates the story vocabulary against the user's complete known vocabulary.
 *
 * NOTE ON INFLECTED LANGUAGES:
 * Highly inflected languages (e.g., Italian, Latin, Ancient Greek) naturally produce
 * morphological conjugations/declensions (e.g. verb tenses, case endings) that may register
 * as unrecognized when tested strictly against dictionary base words. The 85% threshold
 * (MIN_KNOWN_RATIO_STORY) accommodates these natural grammatical variations while catching
 * runaway vocabulary hallucinations.
 */
export const validateStoryAgainstVocabulary = (
  story: StoryResponse,
  knownWords: string[],
  isReview = false
): StoryValidationResult => {
  const cleanKnown = sanitizeKnownWords(knownWords);
  const knownSet = new Set(cleanKnown);

  let totalWords = 0;
  let unknownCount = 0;
  const unknownWordsPerSentence: { sentenceId: number; unknownWords: string[] }[] = [];
  const sentencesWithMultipleNewElements: number[] = [];

  const sentences = Array.isArray(story.sentences) ? story.sentences : [];

  for (const s of sentences) {
    if (!s.original) continue;

    // Tokenize word characters with Unicode letters and marks; ignore elisions and punctuation
    const tokens = tokenize(s.original);
    if (tokens.length === 0) continue;

    // Allowed set for this sentence includes known words + the sentence's own new_element tokens
    const allowed = new Set(knownSet);
    if (s.new_element) {
      const elemTokens = tokenize(s.new_element);
      elemTokens.forEach(t => allowed.add(t));
    }

    const sentenceUnknowns: string[] = [];
    for (const token of tokens) {
      totalWords++;
      if (!allowed.has(token)) {
        sentenceUnknowns.push(token);
        unknownCount++;
      }
    }

    if (sentenceUnknowns.length > 0) {
      unknownWordsPerSentence.push({
        sentenceId: s.id,
        unknownWords: sentenceUnknowns
      });
    }

    const distinctSentenceUnknowns = new Set(sentenceUnknowns);
    if (!isReview && distinctSentenceUnknowns.size > 1) {
      sentencesWithMultipleNewElements.push(s.id);
    }
  }

  const knownRatio = totalWords > 0 ? (totalWords - unknownCount) / totalWords : 1;
  const unknownRatio = totalWords > 0 ? unknownCount / totalWords : 0;

  const isValid = isReview
    ? unknownRatio <= MAX_UNKNOWN_RATIO_REVIEW
    : knownRatio >= MIN_KNOWN_RATIO_STORY;

  return {
    knownRatio,
    unknownRatio,
    unknownWordsPerSentence,
    sentencesWithMultipleNewElements,
    isValid
  };
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
  customApiKey?: string,
  weakWords?: string[]
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
  const wordsForPrompt = selectVocabularyForPrompt(cleanWords, PROMPT_VOCAB_LIMIT, weakWords);
  const wordsDisplay = wordsForPrompt.length > 0 ? wordsForPrompt.join(", ") : "hello, world, is, the, in, to, and";

  const prompt = `
    Act as a Natural Language Acquisition Specialist. 
    Generate a story following the Natural Method (i+1).
    Target Language: ${langDisplay}
    Native Language: ${resolvedNative}
    CEFR Level: ${level}
    
    ${focusInstruction}
    
    KNOWN WORDS (${cleanWords.length} total words): [${wordsDisplay}]

    CRITICAL: Every 'new_element' MUST NOT appear in the KNOWN WORDS list. Words in the list are already learned: never present them as new. Before answering, check each new_element against the list and pick a different word if it is there.
    
    RULES:
    1. i+1: Use known words for 95% of text.
    2. Introduce ONE new element per sentence NOT in the list.
    3. Length: ${sentenceCount} sentences.
    4. Provide IPA for the new element.
    5. TARGET DEFINITION: Provide a very brief definition of the 'new_element' IN ${targetLanguage} in the field 'definition_target'. Use simple words.
    6. PART OF SPEECH: Identify the grammatical class of the 'new_element' (e.g. noun, verb, adjective, adverb, phrasal verb, etc.) in the field 'part_of_speech'.
  `;

  const { data: parsed, modelUsed } = await callGemini(apiKey, prompt, ["story_title", "sentences", "new_words_to_add"]);
  let story = normalizeStoryResponse(parsed, false, level);
  story.modelUsed = modelUsed;

  // Known words that were left out of the sampled list must not come back as "new"
  const knownSet = new Set(cleanWords);
  story.new_words_to_add = story.new_words_to_add.filter(w => !knownSet.has(w));

  // Validation against full known vocabulary and new_element uniqueness
  let validation = validateStoryAgainstVocabulary(story, cleanWords, false);
  let invalidNewElementIds = getInvalidNewElementIds(story, cleanWords);
  const sentencesWithNewElem = story.sentences.filter(s => s.new_element && s.new_element.trim().length > 0);
  let invalidNewElemRatio = sentencesWithNewElem.length > 0 ? invalidNewElementIds.length / sentencesWithNewElem.length : 0;

  const shouldRegenerate = !validation.isValid || invalidNewElemRatio > MAX_INVALID_NEW_ELEMENT_RATIO;
  if (shouldRegenerate) {
    console.warn(
      `[Story Validation] Needs regeneration: Known ratio ${(validation.knownRatio * 100).toFixed(1)}% (min ${MIN_KNOWN_RATIO_STORY * 100}%), ` +
      `Invalid new_element ratio ${(invalidNewElemRatio * 100).toFixed(1)}% (max ${MAX_INVALID_NEW_ELEMENT_RATIO * 100}%). Attempting 1 regeneration...`
    );
    try {
      // Collect up to 30 unknown words
      const unknownWordsList: string[] = [];
      const seenUnknowns = new Set<string>();
      validation.unknownWordsPerSentence.forEach(u => {
        u.unknownWords.forEach(w => {
          if (!seenUnknowns.has(w)) {
            seenUnknowns.add(w);
            unknownWordsList.push(w);
          }
        });
      });
      const top30Unknowns = unknownWordsList.slice(0, 30);

      // Collect known words mistakenly used as new elements
      const knownMistakenAsNew: string[] = [];
      const seenKnownAsNew = new Set<string>();
      for (const s of story.sentences) {
        if (invalidNewElementIds.includes(s.id) && s.new_element) {
          const raw = s.new_element.trim();
          if (raw && !seenKnownAsNew.has(raw.toLowerCase())) {
            seenKnownAsNew.add(raw.toLowerCase());
            knownMistakenAsNew.push(raw);
          }
        }
      }

      let revisionNotes = `CRITICAL REVISION REQUIREMENT:\n`;
      if (top30Unknowns.length > 0) {
        revisionNotes += `AVOID these words, they are not in the known list: [${top30Unknowns.join(', ')}].\n`;
      }
      if (knownMistakenAsNew.length > 0) {
        revisionNotes += `These are already known and MUST NOT be used as new elements: [${knownMistakenAsNew.join(', ')}].\n`;
      }
      revisionNotes += `Strictly adhere to the KNOWN WORDS list. Use ONLY words from that list for 95% of each sentence, introducing strictly at most 1 new element per sentence that does not appear in known words.`;

      const regenPrompt = `${prompt}\n\n${revisionNotes}`;
      const { data: regenParsed, modelUsed: regenModel } = await callGemini(apiKey, regenPrompt, ["story_title", "sentences", "new_words_to_add"]);
      const regenStory = normalizeStoryResponse(regenParsed, false, level);
      regenStory.modelUsed = regenModel;
      regenStory.new_words_to_add = regenStory.new_words_to_add.filter(w => !knownSet.has(w));

      const regenValidation = validateStoryAgainstVocabulary(regenStory, cleanWords, false);
      const regenInvalidIds = getInvalidNewElementIds(regenStory, cleanWords);
      const regenSentencesWithNew = regenStory.sentences.filter(s => s.new_element && s.new_element.trim().length > 0);
      const regenInvalidRatio = regenSentencesWithNew.length > 0 ? regenInvalidIds.length / regenSentencesWithNew.length : 0;

      const isRegenValid = regenValidation.isValid && regenInvalidRatio <= MAX_INVALID_NEW_ELEMENT_RATIO;
      const isOriginalValid = validation.isValid && invalidNewElemRatio <= MAX_INVALID_NEW_ELEMENT_RATIO;

      if (isRegenValid && !isOriginalValid) {
        story = regenStory;
        validation = regenValidation;
        invalidNewElementIds = regenInvalidIds;
      } else if (isRegenValid && isOriginalValid) {
        if (regenValidation.knownRatio >= validation.knownRatio) {
          story = regenStory;
          validation = regenValidation;
          invalidNewElementIds = regenInvalidIds;
        }
      } else {
        const origScore = validation.knownRatio - invalidNewElemRatio;
        const regenScore = regenValidation.knownRatio - regenInvalidRatio;
        if (regenScore > origScore) {
          story = regenStory;
          validation = regenValidation;
          invalidNewElementIds = regenInvalidIds;
        }
      }
    } catch (e) {
      console.warn("[Story Validation] Regeneration attempt failed, retaining original story:", e);
    }
  }

  // Clear new_element, explanation, phonetic, definition_target, and part_of_speech for any remaining invalid sentences
  const finalInvalidSet = new Set(getInvalidNewElementIds(story, cleanWords));
  if (finalInvalidSet.size > 0) {
    story.sentences = story.sentences.map(s => {
      if (finalInvalidSet.has(s.id)) {
        return {
          ...s,
          new_element: '',
          explanation: '',
          phonetic: '',
          definition_target: '',
          part_of_speech: ''
        };
      }
      return s;
    });

    const validNewElements = new Set(
      story.sentences.map(s => s.new_element?.trim().toLowerCase()).filter(Boolean) as string[]
    );
    story.new_words_to_add = story.new_words_to_add.filter(w => validNewElements.has(w.toLowerCase()));
  }

  if (!validation.isValid) {
    story.hasHighUnknownWords = true;
  }

  return story;
};

export const generateReviewStory = async (
  targetLanguage: string,
  nativeLanguage: string,
  knownWords: string[],
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus,
  customApiKey?: string,
  weakWords?: string[]
): Promise<StoryResponse> => {
  const apiKey = getApiKey(customApiKey);
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const { langDisplay, focusInstruction } = getLanguageConfig(targetLanguage, ancientGreekDialect, ancientGreekFocus, shakespeareanFocus);
  const resolvedNative = resolveNativeLanguage(nativeLanguage);

  const cleanWords = sanitizeKnownWords(knownWords);
  const wordsForPrompt = selectVocabularyForPrompt(cleanWords, PROMPT_VOCAB_LIMIT, weakWords);

  const weakWordsBlock = (weakWords && weakWords.length > 0)
    ? `\n    WEAK / LEARNING WORDS (PRIORITY): [${weakWords.slice(0, 50).join(", ")}]\n    CRITICAL REPETITION RULE: The weak/learning words listed above MUST appear multiple times throughout the story in different contexts to solidify retention.`
    : '';

  const prompt = `
    Act as a Polyglot Instructor. Generate a REVIEW story.
    Target Language: ${langDisplay}
    Native Language: ${resolvedNative}
    
    ${focusInstruction}
    
    GOAL: Create a long, complex and coherent story using ONLY words from the known vocabulary list provided below. 
    
    KNOWN VOCABULARY: [${wordsForPrompt.join(", ")}]
    ${weakWordsBlock}
    
    RULES:
    1. USE ONLY KNOWN WORDS. Do not introduce new vocabulary.
    2. LENGTH: 25 to 35 sentences.
    3. COHESION: The story must be very high quality and engaging.
    4. Fill 'new_element', 'phonetic', 'explanation', 'definition_target', and 'part_of_speech' with empty strings.
  `;

  const { data: parsed, modelUsed } = await callGemini(apiKey, prompt, ["story_title", "sentences"]);
  let story = normalizeStoryResponse(parsed, true);
  story.modelUsed = modelUsed;

  // Validation against full known vocabulary for review story (max 5% unknown)
  let validation = validateStoryAgainstVocabulary(story, cleanWords, true);
  if (!validation.isValid) {
    console.warn(`[Review Validation] Unknown ratio ${(validation.unknownRatio * 100).toFixed(1)}% > ${(MAX_UNKNOWN_RATIO_REVIEW * 100)}%. Attempting 1 regeneration...`);
    try {
      const unknownWordsList: string[] = [];
      const seenUnknowns = new Set<string>();
      validation.unknownWordsPerSentence.forEach(u => {
        u.unknownWords.forEach(w => {
          if (!seenUnknowns.has(w)) {
            seenUnknowns.add(w);
            unknownWordsList.push(w);
          }
        });
      });
      const top30Unknowns = unknownWordsList.slice(0, 30);
      const avoidBlock = top30Unknowns.length > 0 ? `AVOID these words, they are not in the known list: [${top30Unknowns.join(', ')}].\n` : '';

      const regenPrompt = `${prompt}
      CRITICAL REVISION REQUIREMENT: The previous output contained words outside known vocabulary (${(validation.unknownRatio * 100).toFixed(1)}% unknown).
      ${avoidBlock}Strictly use ONLY the provided KNOWN VOCABULARY list with ZERO unknown words.`;
      const { data: regenParsed, modelUsed: regenModel } = await callGemini(apiKey, regenPrompt, ["story_title", "sentences"]);
      const regenStory = normalizeStoryResponse(regenParsed, true);
      regenStory.modelUsed = regenModel;
      const regenValidation = validateStoryAgainstVocabulary(regenStory, cleanWords, true);
      if (regenValidation.isValid || regenValidation.unknownRatio < validation.unknownRatio) {
        story = regenStory;
        validation = regenValidation;
      }
    } catch (e) {
      console.warn("[Review Validation] Regeneration attempt failed, retaining original story:", e);
    }
  }

  if (!validation.isValid) {
    story.hasHighUnknownWords = true;
  }

  return story;
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
  const modelUsed = source.modelUsed || data.modelUsed || undefined;

  let rawSentences = source.sentences || data.sentences || source.sentence_list || data.sentence_list;
  if (!Array.isArray(rawSentences)) {
    if (typeof source.text === 'string' || typeof data.text === 'string') {
      const text = source.text || data.text;
      rawSentences = text.split(/(?<=[.?!])\s+/).filter(Boolean).map((s: string, idx: number) => ({
        id: idx + 1,
        original: s,
        translation: '',
        new_element: '',
        explanation: '',
        part_of_speech: ''
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
        definition_target: '',
        part_of_speech: ''
      };
    }
    return {
      id: typeof s?.id === 'number' ? s.id : idx + 1,
      original: String(s?.original || s?.sentence || s?.text || '').trim(),
      translation: String(s?.translation || s?.meaning || '').trim(),
      phonetic: String(s?.phonetic || s?.ipa || '').trim(),
      new_element: String(s?.new_element || s?.new_word || s?.target_word || '').trim(),
      explanation: String(s?.explanation || '').trim(),
      definition_target: String(s?.definition_target || s?.definition || '').trim(),
      part_of_speech: String(s?.part_of_speech || s?.grammar_class || s?.pos || '').trim()
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
    is_review: isReview,
    modelUsed
  };
};