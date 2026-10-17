
import { GoogleGenAI, Type } from "@google/genai";
import { CEFRLevel, StoryResponse, StorySize, AncientGreekDialect, AncientGreekFocus, ShakespeareanFocus } from "../types";

const getApiKey = () => process.env.API_KEY || process.env.GEMINI_API_KEY || "";

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

export const generateStory = async (
  targetLanguage: string,
  nativeLanguage: string,
  level: CEFRLevel,
  knownWords: string[],
  storySize: StorySize,
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus
): Promise<StoryResponse> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const sizeMap = { short: "5 to 10", standard: "exactly 10", medium: "10 to 15", long: "15 to 25" };
  const sentenceCount = sizeMap[storySize] || "5 to 10";
  const { langDisplay, focusInstruction } = getLanguageConfig(targetLanguage, ancientGreekDialect, ancientGreekFocus, shakespeareanFocus);

  const cleanWords = sanitizeKnownWords(knownWords);
  // Cap vocabulary window for prompt efficiency if excessively large
  const wordsForPrompt = cleanWords.length > 800 ? cleanWords.slice(-800) : cleanWords;
  const wordsDisplay = wordsForPrompt.length > 0 ? wordsForPrompt.join(", ") : "hello, world, is, the, in, to, and";

  const prompt = `
    Act as a Natural Language Acquisition Specialist. 
    Generate a story following the Natural Method (i+1).
    Target Language: ${langDisplay}
    Native Language: ${nativeLanguage}
    CEFR Level: ${level}
    
    ${focusInstruction}
    
    KNOWN WORDS (${cleanWords.length} total words): [${wordsDisplay}]
    
    RULES:
    1. i+1: Use known words for 95% of text.
    2. Introduce ONE new element per sentence NOT in the list.
    3. Length: ${sentenceCount} sentences.
    4. Provide IPA for the new element.
    5. TARGET DEFINITION: Provide a very brief definition of the 'new_element' IN ${targetLanguage} in the field 'definition_target'. Use simple words.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
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
        required: ["story_title", "sentences", "new_words_to_add"]
      }
    }
  });

  const parsed = parseJsonResponse(response.text);
  return normalizeStoryResponse(parsed, false, level);
};

export const generateReviewStory = async (
  targetLanguage: string,
  nativeLanguage: string,
  knownWords: string[],
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus
): Promise<StoryResponse> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const { langDisplay, focusInstruction } = getLanguageConfig(targetLanguage, ancientGreekDialect, ancientGreekFocus, shakespeareanFocus);

  const cleanWords = sanitizeKnownWords(knownWords);
  const wordsForPrompt = cleanWords.length > 800 ? cleanWords.slice(-800) : cleanWords;

  const prompt = `
    Act as a Polyglot Instructor. Generate a REVIEW story.
    Target Language: ${langDisplay}
    Native Language: ${nativeLanguage}
    
    ${focusInstruction}
    
    GOAL: Create a long, complex and coherent story using ONLY words from the known vocabulary list provided below. 
    
    KNOWN VOCABULARY: [${wordsForPrompt.join(", ")}]
    
    RULES:
    1. USE ONLY KNOWN WORDS. Do not introduce new vocabulary.
    2. LENGTH: 25 to 35 sentences.
    3. COHESION: The story must be very high quality and engaging.
    4. Fill 'new_element', 'phonetic', 'explanation', and 'definition_target' with empty strings.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
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
        required: ["story_title", "sentences"]
      }
    }
  });

  const parsed = parseJsonResponse(response.text);
  return normalizeStoryResponse(parsed, true);
};

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

