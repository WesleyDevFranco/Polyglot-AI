
import { GoogleGenAI, Type } from "@google/genai";
import { CEFRLevel, StoryResponse, StorySize, AncientGreekDialect, AncientGreekFocus, ShakespeareanFocus } from "../types";

const API_KEY = process.env.API_KEY || "";

const getLanguageConfig = (
  targetLanguage: string, 
  ancientGreekDialect?: AncientGreekDialect, 
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus
) => {
  let langDisplay = targetLanguage;
  let focusInstruction = "";

  if (targetLanguage === 'Ancient Greek') {
    const dialect = ancientGreekDialect === 'attic' ? 'Attic' : 'Koine';
    langDisplay = `Ancient Greek (${dialect} dialect)`;
    
    if (ancientGreekDialect === 'attic' && ancientGreekFocus === 'philosophical') {
      focusInstruction = `
        DOMAIN SPECIALIZATION: Focus specifically on the vocabulary and rhetorical styles found in the Platonic and Aristotelian corpus. 
        Prioritize terms, concepts, and idioms frequent in classical Greek philosophy (e.g., metaphysics, ethics, logic). 
      `;
    }
  } else if (targetLanguage === 'Shakespearean English') {
    langDisplay = 'Shakespearean English (Early Modern English / Elizabethan & Jacobean English)';
    focusInstruction = `
      DOMAIN SPECIALIZATION: Early Modern English / Shakespearean English (circa 1590-1615).
      - Style & Syntax: Employ authentic Shakespearean grammar, Early Modern second-person pronouns (thou/thee/thy/thine/ye), verb conjugations (-est, -eth, art, dost, hath, doth, wilt, shalt, canst), archaic prepositions/adverbs (wherefore, whither, thither, hither, betwixt, ere, anon, perchance, methinks, forsooth, prithee, hark, fie), and poetic inversion.
      - Tone: Rhythmic, dramatic, evocative, and poetic phrasing reminiscent of William Shakespeare's plays and sonnets.
      - Definitions & Explanations: Explain new Shakespearean words clearly, providing both their modern meaning and Elizabethan context.
    `;

    if (shakespeareanFocus === 'drama') {
      focusInstruction += `
      - DRAMATIC / TRAGIC FOCUS: Channel the tragic and dramatic intensity of Macbeth, Hamlet, King Lear, and Othello. Emphasize themes of fate, honor, ambition, intrigue, mortality, and intense human passion.
      `;
    } else if (shakespeareanFocus === 'courtly') {
      focusInstruction += `
      - COURTLY / ROMANCE FOCUS: Channel the witty romance and courtly lyricism of Shakespeare's Sonnets, Twelfth Night, Much Ado About Nothing, and A Midsummer Night's Dream. Emphasize wit, wordplay, romantic devotion, beauty, and court etiquette.
      `;
    }
  }
  return { langDisplay, focusInstruction };
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
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const sizeMap = { short: "5 to 10", standard: "exactly 10", medium: "10 to 15", long: "15 to 25" };
  const sentenceCount = sizeMap[storySize] || "5 to 10";
  const { langDisplay, focusInstruction } = getLanguageConfig(targetLanguage, ancientGreekDialect, ancientGreekFocus, shakespeareanFocus);

  const prompt = `
    Act as a Natural Language Acquisition Specialist. 
    Generate a story following the Natural Method (i+1).
    Target Language: ${langDisplay}
    Native Language: ${nativeLanguage}
    CEFR Level: ${level}
    
    ${focusInstruction}
    
    KNOWN WORDS: [${knownWords.join(", ")}]
    
    RULES:
    1. i+1: Use known words for 95% of text.
    2. Introduce ONE new element per sentence NOT in the list.
    3. Length: ${sentenceCount} sentences.
    4. Provide IPA for the new element.
    5. TARGET DEFINITION: Provide a very brief definition of the 'new_element' IN ${targetLanguage} in the field 'definition_target'. Use simple words.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
              }
            }
          },
          estimated_vocab_count: { type: Type.STRING },
          new_words_to_add: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  });

  return { ...JSON.parse(response.text), is_review: false };
};

export const generateReviewStory = async (
  targetLanguage: string,
  nativeLanguage: string,
  knownWords: string[],
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus
): Promise<StoryResponse> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const { langDisplay, focusInstruction } = getLanguageConfig(targetLanguage, ancientGreekDialect, ancientGreekFocus, shakespeareanFocus);

  const prompt = `
    Act as a Polyglot Instructor. Generate a REVIEW story.
    Target Language: ${langDisplay}
    Native Language: ${nativeLanguage}
    
    ${focusInstruction}
    
    GOAL: Create a long, complex and coherent story using ONLY words from the known vocabulary list provided below. 
    
    KNOWN VOCABULARY: [${knownWords.join(", ")}]
    
    RULES:
    1. USE ONLY KNOWN WORDS. Do not introduce new vocabulary.
    2. LENGTH: 25 to 35 sentences.
    3. COHESION: The story must be very high quality and engaging.
    4. Fill 'new_element', 'phonetic', 'explanation', and 'definition_target' with empty strings.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
              }
            }
          },
          estimated_vocab_count: { type: Type.STRING },
          new_words_to_add: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  });

  return { ...JSON.parse(response.text), is_review: true };
};
