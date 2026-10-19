import { HistoryItem, Sentence, SRSCard, PersistedSRSCard, SRSCardRating, SRSStats } from '../types';

export const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Creates a unique deterministic identifier for an SRS card
 */
export const getCardId = (storyTimestamp: number, sentenceId: number, sentenceOriginal: string): string => {
  const hash = Math.abs(
    sentenceOriginal.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  ).toString(36);
  return `${storyTimestamp}_s${sentenceId}_${hash.slice(0, 6)}`;
};

/**
 * Extracts sentenceId from any card representation (new or legacy)
 */
export const getSentenceIdFromCard = (card: { sentenceId?: number; sentence?: { id?: number }; id?: string }): number => {
  if (typeof card.sentenceId === 'number') return card.sentenceId;
  if (card.sentence && typeof card.sentence.id === 'number') return card.sentence.id;
  if (card.id) {
    const match = card.id.match(/_s(\d+)_/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
};

/**
 * Checks if a card has departed from its initial state (reviewed at least once or moved beyond new)
 */
export const isCardNonInitial = (card: PersistedSRSCard | SRSCard): boolean => {
  return card.state !== 'new' || (card.reps || 0) > 0 || (card.lapses || 0) > 0;
};

/**
 * Converts a runtime or raw SRS card to its compact persisted format.
 * Strips sentence and storyTitle if the story exists in history.
 * Retains sentence and storyTitle ONLY for orphan cards (story deleted from history).
 */
export const toPersistedCard = (
  card: SRSCard | PersistedSRSCard,
  history: HistoryItem[]
): PersistedSRSCard => {
  const sentenceId = getSentenceIdFromCard(card);
  const storyExists = Array.isArray(history) && history.some(h => h && h.timestamp === card.storyTimestamp);

  const persisted: PersistedSRSCard = {
    id: card.id,
    storyTimestamp: card.storyTimestamp,
    sentenceId,
    targetLanguage: card.targetLanguage,
    nativeLanguage: card.nativeLanguage,
    state: card.state,
    reps: card.reps,
    lapses: card.lapses,
    easeFactor: card.easeFactor || DEFAULT_EASE_FACTOR,
    interval: card.interval || 0,
    dueDate: card.dueDate
  };

  if (card.lastReviewed !== undefined) persisted.lastReviewed = card.lastReviewed;
  if (card.learningAt !== undefined) persisted.learningAt = card.learningAt;
  if (card.masteredAt !== undefined) persisted.masteredAt = card.masteredAt;

  // Orphan fallback: If story does not exist in history, keep sentence and storyTitle
  if (!storyExists) {
    if (card.sentence) persisted.sentence = card.sentence;
    if (card.storyTitle) persisted.storyTitle = card.storyTitle;
  }

  return persisted;
};

/**
 * Filters and compacts cards for persistence (localStorage and export).
 * Only cards that have exited the initial state are stored, plus any orphan cards with fallback data.
 */
export const compactAndFilterPersistedCards = (
  cards: (PersistedSRSCard | SRSCard)[],
  history: HistoryItem[]
): PersistedSRSCard[] => {
  if (!Array.isArray(cards)) return [];
  return cards
    .filter(c => {
      if (!c) return false;
      if (isCardNonInitial(c)) return true;
      const storyExists = Array.isArray(history) && history.some(h => h && h.timestamp === c.storyTimestamp);
      return !storyExists && Boolean(c.sentence);
    })
    .map(c => toPersistedCard(c, history));
};

/**
 * Resolves a single persisted SRS card into a complete runtime SRSCard.
 * Rule: Uses embedded sentence and storyTitle if present (orphan fallback), otherwise looks up in history.
 */
export const resolveCard = (
  card: PersistedSRSCard | SRSCard,
  history: HistoryItem[]
): SRSCard | null => {
  const sentenceId = getSentenceIdFromCard(card);

  // 1. Embedded fallback (orphan cards or pre-resolved)
  if (card.sentence && card.storyTitle) {
    return {
      ...card,
      sentenceId,
      sentence: card.sentence,
      storyTitle: card.storyTitle
    };
  }

  // 2. Lookup story in history by timestamp
  const story = Array.isArray(history) ? history.find(h => h && h.timestamp === card.storyTimestamp) : null;
  if (!story || !Array.isArray(story.sentences)) {
    if (card.sentence) {
      return {
        ...card,
        sentenceId,
        sentence: card.sentence,
        storyTitle: card.storyTitle || 'Archived Story'
      };
    }
    return null;
  }

  // 3. Lookup sentence in story
  const foundSentence = story.sentences.find((s, idx) => {
    if (s.id !== undefined) return s.id === sentenceId;
    return idx === sentenceId;
  }) || story.sentences[sentenceId] || story.sentences[0];

  if (!foundSentence) return null;

  return {
    ...card,
    sentenceId,
    sentence: foundSentence,
    storyTitle: story.story_title || 'Untitled Story'
  };
};

/**
 * Resolves all active SRS cards at runtime:
 * 1. Resolves all persisted non-initial cards (and orphan cards) via resolveCard.
 * 2. Lazily generates virtual "new" cards from history in stable order (oldest story to newest story)
 *    for any sentence that has not yet been reviewed/persisted.
 */
export const resolveAllCards = (
  persistedCards: PersistedSRSCard[],
  history: HistoryItem[],
  targetLanguage: string,
  nativeLanguage: string
): SRSCard[] => {
  const resolvedList: SRSCard[] = [];
  const trackedCardIds = new Set<string>();
  const trackedStorySentenceKeys = new Set<string>();

  // 1. Resolve persisted cards
  if (Array.isArray(persistedCards)) {
    persistedCards.forEach(pc => {
      const resolved = resolveCard(pc, history);
      if (resolved) {
        resolvedList.push(resolved);
        trackedCardIds.add(resolved.id);
        trackedStorySentenceKeys.add(`${resolved.storyTimestamp}_${resolved.sentenceId}`);
      }
    });
  }

  // 2. Generate virtual "new" cards from history (oldest story to newest story)
  if (Array.isArray(history)) {
    const completedStories = history
      .filter(h => h && h.completed && Array.isArray(h.sentences))
      .slice()
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    completedStories.forEach(story => {
      story.sentences.forEach((sentence, idx) => {
        if (!sentence || !sentence.original) return;
        const sid = sentence.id ?? idx;
        const cardId = getCardId(story.timestamp, sid, sentence.original);
        const storySentenceKey = `${story.timestamp}_${sid}`;

        if (!trackedCardIds.has(cardId) && !trackedStorySentenceKeys.has(storySentenceKey)) {
          const virtualCard: SRSCard = {
            id: cardId,
            storyTimestamp: story.timestamp,
            sentenceId: sid,
            sentence,
            storyTitle: story.story_title || 'Untitled Story',
            targetLanguage: story.targetLanguage || targetLanguage || 'Language',
            nativeLanguage: (story as any).nativeLanguage || nativeLanguage || 'Native',
            state: 'new',
            reps: 0,
            lapses: 0,
            easeFactor: DEFAULT_EASE_FACTOR,
            interval: 0,
            dueDate: story.completedAt || story.timestamp || Date.now()
          };
          resolvedList.push(virtualCard);
          trackedCardIds.add(cardId);
          trackedStorySentenceKeys.add(storySentenceKey);
        }
      });
    });
  }

  return resolvedList;
};

/**
 * Legacy compatibility stub: kept for backward compatibility if imported elsewhere
 */
export const syncCardsFromHistory = (
  history: HistoryItem[],
  existingCards: SRSCard[],
  targetLanguage: string,
  nativeLanguage: string
): SRSCard[] => {
  return resolveAllCards(existingCards, history, targetLanguage, nativeLanguage);
};

/**
 * Calculates the next SRS interval, ease factor, and due date following the SM-2 algorithm
 */
export const calculateNextInterval = (
  card: SRSCard,
  rating: SRSCardRating
): {
  interval: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  state: SRSCard['state'];
  dueDate: number;
} => {
  const now = Date.now();
  let easeFactor = card.easeFactor || DEFAULT_EASE_FACTOR;
  let reps = card.reps || 0;
  let lapses = card.lapses || 0;
  let interval = card.interval || 0;
  let state: SRSCard['state'] = card.state;
  let dueDate = now;

  switch (rating) {
    case 1: { // Again / Errei
      easeFactor = Math.max(1.3, easeFactor - 0.20);
      reps = 0;
      lapses += 1;
      interval = 0.007; // ~10 minutes
      state = 'learning';
      dueDate = now + 10 * 60 * 1000;
      break;
    }

    case 2: { // Hard / Difícil
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      if (reps === 0) {
        interval = 1;
      } else {
        interval = Math.max(1, Math.round(Math.max(1, interval) * 1.2));
      }
      reps += 1;
      state = interval >= 21 ? 'mastered' : 'review';
      dueDate = now + Math.round(interval * 86400 * 1000);
      break;
    }

    case 3: { // Good / Bom
      if (reps === 0) {
        interval = 1;
      } else if (reps === 1) {
        interval = 6;
      } else {
        interval = Math.round(Math.max(1, interval) * easeFactor);
      }
      reps += 1;
      state = interval >= 21 ? 'mastered' : 'review';
      dueDate = now + Math.round(interval * 86400 * 1000);
      break;
    }

    case 4: { // Easy / Fácil
      easeFactor = Math.min(3.0, easeFactor + 0.15);
      if (reps === 0) {
        interval = 3;
      } else if (reps === 1) {
        interval = 8;
      } else {
        interval = Math.round(Math.max(1, interval) * easeFactor * 1.3);
      }
      reps += 1;
      state = interval >= 21 ? 'mastered' : 'review';
      dueDate = now + Math.round(interval * 86400 * 1000);
      break;
    }
  }

  return {
    interval,
    easeFactor,
    reps,
    lapses,
    state,
    dueDate
  };
};

/**
 * Returns user-friendly time string for Anki button badges (e.g. "< 10m", "1d", "4d", "2m")
 */
export const formatIntervalLabel = (intervalInDays: number): string => {
  if (intervalInDays < 0.05) {
    return '< 10m';
  }
  if (intervalInDays < 1) {
    return `${Math.round(intervalInDays * 24)}h`;
  }
  if (intervalInDays < 30) {
    return `${Math.round(intervalInDays)}d`;
  }
  if (intervalInDays < 365) {
    const months = Math.round(intervalInDays / 30);
    return `${months}m`;
  }
  const years = (intervalInDays / 365).toFixed(1);
  return `${years}y`;
};

/**
 * Calculates preview labels for each rating button on a card
 */
export const getCardButtonIntervals = (card: SRSCard): Record<SRSCardRating, string> => {
  return {
    1: '< 10m',
    2: formatIntervalLabel(calculateNextInterval(card, 2).interval),
    3: formatIntervalLabel(calculateNextInterval(card, 3).interval),
    4: formatIntervalLabel(calculateNextInterval(card, 4).interval)
  };
};

/**
 * Filters cards that are due for review today or newly introduced (no daily goal limit)
 * Order: persisted cards due by dueDate ascending; virtual/new cards by storyTimestamp ascending then sentenceId
 */
export const getDueCards = (cards: SRSCard[], targetLanguage?: string): SRSCard[] => {
  const now = Date.now();
  const filtered = cards.filter(card => {
    if (targetLanguage && card.targetLanguage && card.targetLanguage !== targetLanguage) {
      return false;
    }
    return card.state === 'new' || card.dueDate <= now;
  });

  return filtered.sort((a, b) => {
    // Prioritize learning cards first, then review due, then new cards, then mastered
    const order: Record<string, number> = { learning: 0, review: 1, new: 2, mastered: 3 };
    const orderA = order[a.state] ?? 1;
    const orderB = order[b.state] ?? 1;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // For new cards: stable story order (oldest to newest story, then sentenceId)
    if (a.state === 'new' && b.state === 'new') {
      if (a.storyTimestamp !== b.storyTimestamp) {
        return (a.storyTimestamp || 0) - (b.storyTimestamp || 0);
      }
      return (a.sentenceId ?? 0) - (b.sentenceId ?? 0);
    }

    // For persisted cards due: dueDate crescente
    return a.dueDate - b.dueDate;
  });
};

/**
 * Computes high-level statistics of the SRS deck (no daily goal limit)
 */
export const computeSRSStats = (cards: SRSCard[], targetLanguage?: string): SRSStats => {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();

  let totalCards = 0;
  let dueToday = 0;
  let newCards = 0;
  let learningCards = 0;
  let reviewCards = 0;
  let masteredCards = 0;
  let reviewedTodayCount = 0;

  cards.forEach(card => {
    if (targetLanguage && card.targetLanguage && card.targetLanguage !== targetLanguage) {
      return;
    }

    totalCards += 1;

    if (card.state === 'new') {
      newCards += 1;
      dueToday += 1;
    } else if (card.dueDate <= now) {
      dueToday += 1;
    }

    if (card.state === 'learning') learningCards += 1;
    else if (card.state === 'review') reviewCards += 1;
    else if (card.state === 'mastered') masteredCards += 1;

    if (card.lastReviewed && card.lastReviewed >= startOfTodayMs) {
      reviewedTodayCount += 1;
    }
  });

  return {
    totalCards,
    dueToday,
    newCards,
    learningCards,
    reviewCards,
    masteredCards,
    reviewedTodayCount
  };
};

/**
 * Calculates estimated retention rate based on successful reps vs lapses
 */
export const estimateRetentionRate = (cards: SRSCard[]): number => {
  const reviewedCards = cards.filter(c => c.reps > 0 || c.lapses > 0);
  if (reviewedCards.length === 0) return 90; // baseline

  let totalWeight = 0;
  let successWeight = 0;

  reviewedCards.forEach(c => {
    const trials = c.reps + c.lapses;
    totalWeight += trials;
    successWeight += c.reps;
  });

  if (totalWeight === 0) return 90;
  const rate = Math.round((successWeight / totalWeight) * 100);
  return Math.max(60, Math.min(99, rate));
};

export interface RetentionProgressPoint {
  date: string;
  fullDate: string;
  dayNumber: number;
  timestamp: number;
  learning: number;
  mastered: number;
  totalActive: number;
  graduatedToday: number;
  retentionRate: number;
}

/**
 * Generates a 30-day time series tracking cards moving from Learning to Mastered
 */
export const generate30DayRetentionData = (
  cards: SRSCard[],
  targetLanguage?: string
): RetentionProgressPoint[] => {
  const filtered = cards.filter(c => !targetLanguage || !c.targetLanguage || c.targetLanguage === targetLanguage);
  const now = Date.now();
  const ONE_DAY_MS = 86400000;
  
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayMs = endOfToday.getTime();

  const dataPoints: RetentionProgressPoint[] = [];

  for (let i = 29; i >= 0; i--) {
    const dayEndMs = endOfTodayMs - (i * ONE_DAY_MS);
    const dayStartMs = dayEndMs - ONE_DAY_MS + 1;
    const dateObj = new Date(dayEndMs);

    const dateLabel = dateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const fullDateLabel = dateObj.toLocaleDateString(undefined, { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });

    let learningCount = 0;
    let masteredCount = 0;
    let graduatedToday = 0;

    filtered.forEach(card => {
      const cardCreated = card.storyTimestamp || (now - 25 * ONE_DAY_MS);
      
      // Check if card existed on this day
      if (cardCreated <= dayEndMs) {
        const isMasteredNow = card.state === 'mastered';
        
        // Determine graduation timestamp
        let graduationTime: number | null = null;
        if (card.masteredAt) {
          graduationTime = card.masteredAt;
        } else if (isMasteredNow) {
          // If mastered but no masteredAt recorded yet, infer from lastReviewed or story creation
          graduationTime = card.lastReviewed || (cardCreated + 14 * ONE_DAY_MS);
          if (graduationTime > now) graduationTime = now;
        }

        if (graduationTime !== null && graduationTime <= dayEndMs) {
          masteredCount++;
          if (graduationTime >= dayStartMs && graduationTime <= dayEndMs) {
            graduatedToday++;
          }
        } else {
          // Active in learning or review
          learningCount++;
        }
      }
    });

    const totalActive = learningCount + masteredCount;
    const retentionRate = totalActive > 0 ? Math.round((masteredCount / totalActive) * 100) : 0;

    dataPoints.push({
      date: dateLabel,
      fullDate: fullDateLabel,
      dayNumber: 30 - i,
      timestamp: dayEndMs,
      learning: learningCount,
      mastered: masteredCount,
      totalActive,
      graduatedToday,
      retentionRate
    });
  }

  return dataPoints;
};
