import { HistoryItem, Sentence, SRSCard, PersistedSRSCard, SRSCardRating, SRSStats, SRSReviewLogEntry } from '../types';

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
  if (card.firstReviewedAt !== undefined) persisted.firstReviewedAt = card.firstReviewedAt;
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
 * Returns local 00:00:00.000 timestamp for the given timestamp/date
 */
export const getStartOfDay = (dateInput: Date | number = Date.now()): number => {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Calculates due date:
 * - Sub-day intervals (< 1 day) stay relative to now (e.g. 10 minutes)
 * - Intervals >= 1 day are set to 00:00 local time of the target day (today + interval)
 */
export const getTargetDueDate = (intervalDays: number, now: number = Date.now()): number => {
  if (intervalDays < 1) {
    return now + Math.round(intervalDays * 86400 * 1000);
  }
  const target = new Date(now);
  target.setDate(target.getDate() + Math.round(intervalDays));
  target.setHours(0, 0, 0, 0);
  return target.getTime();
};

/**
 * Calculates the next SRS interval, ease factor, and due date following the SM-2 algorithm:
 * - Hard, Good, Easy with interval >= 1 day: dueDate at 00:00 local time of (today + interval)
 * - Again: 10 minutes from now
 * - Hard on new card (reps === 0): stays in 'learning', rescheduled in 10 minutes, no lapse added, easeFactor penalised by 0.15
 * - Good on new card (reps === 0): graduates to 1 day
 */
export const calculateNextInterval = (
  card: SRSCard,
  rating: SRSCardRating,
  now: number = Date.now()
): {
  interval: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  state: SRSCard['state'];
  dueDate: number;
} => {
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
        // Differentiate Hard from Good on new card:
        // Does not graduate, remains in learning, rescheduled in 10 minutes, no lapse added
        interval = 0.007; // ~10 minutes
        state = 'learning';
        dueDate = now + 10 * 60 * 1000;
        reps = 0;
      } else {
        interval = Math.max(1, Math.round(Math.max(1, interval) * 1.2));
        reps += 1;
        state = interval >= 21 ? 'mastered' : 'review';
        dueDate = getTargetDueDate(interval, now);
      }
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
      dueDate = getTargetDueDate(interval, now);
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
      dueDate = getTargetDueDate(interval, now);
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
 * Calculates preview labels for each rating button on a card consistent with actual rules
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
 * Filters cards that are due for review today or newly introduced:
 * - Review cards due (dueDate <= now) are never limited
 * - New cards ('new') are limited by dailyNewCardsLimit (default 0, 0 = unlimited)
 *   counting how many cards had their first review today
 */
export const getDueCards = (
  cards: SRSCard[],
  targetLanguage?: string,
  dailyNewCardsLimit = 0,
  now: number = Date.now()
): SRSCard[] => {
  const startOfTodayMs = getStartOfDay(now);

  const langCards = cards.filter(card => {
    if (targetLanguage && card.targetLanguage && card.targetLanguage !== targetLanguage) {
      return false;
    }
    return true;
  });

  // Count how many new cards were reviewed today for the first time
  const newCardsReviewedToday = langCards.filter(
    c => c.firstReviewedAt && c.firstReviewedAt >= startOfTodayMs
  ).length;

  const remainingNewSlots = dailyNewCardsLimit > 0
    ? Math.max(0, dailyNewCardsLimit - newCardsReviewedToday)
    : Infinity;

  // Review cards due are never limited
  const reviewCardsDue = langCards.filter(
    c => c.state !== 'new' && c.dueDate <= now
  );

  // New cards sorted by oldest story first, then sentenceId
  const newCardsAll = langCards
    .filter(c => c.state === 'new')
    .sort((a, b) => {
      if (a.storyTimestamp !== b.storyTimestamp) {
        return (a.storyTimestamp || 0) - (b.storyTimestamp || 0);
      }
      return (a.sentenceId ?? 0) - (b.sentenceId ?? 0);
    });

  const availableNewCards = remainingNewSlots > 0
    ? newCardsAll.slice(0, remainingNewSlots)
    : [];

  const combined = [...reviewCardsDue, ...availableNewCards];

  return combined.sort((a, b) => {
    // Prioritize learning cards first, then review due, then new cards, then mastered
    const order: Record<string, number> = { learning: 0, review: 1, new: 2, mastered: 3 };
    const orderA = order[a.state] ?? 1;
    const orderB = order[b.state] ?? 1;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    if (a.state === 'new' && b.state === 'new') {
      if (a.storyTimestamp !== b.storyTimestamp) {
        return (a.storyTimestamp || 0) - (b.storyTimestamp || 0);
      }
      return (a.sentenceId ?? 0) - (b.sentenceId ?? 0);
    }

    return a.dueDate - b.dueDate;
  });
};

/**
 * Computes high-level statistics of the SRS deck taking into account the daily new card limit
 */
export const computeSRSStats = (
  cards: SRSCard[],
  targetLanguage?: string,
  dailyNewCardsLimit = 0,
  now: number = Date.now()
): SRSStats => {
  const startOfTodayMs = getStartOfDay(now);

  let totalCards = 0;
  let totalNewInDeck = 0;
  let learningCards = 0;
  let reviewCards = 0;
  let masteredCards = 0;
  let reviewedTodayCount = 0;
  let newReviewedTodayCount = 0;
  let reviewDueCount = 0;

  cards.forEach(card => {
    if (targetLanguage && card.targetLanguage && card.targetLanguage !== targetLanguage) {
      return;
    }

    totalCards += 1;

    if (card.state === 'new') {
      totalNewInDeck += 1;
    } else if (card.dueDate <= now) {
      reviewDueCount += 1;
    }

    if (card.state === 'learning') learningCards += 1;
    else if (card.state === 'review') reviewCards += 1;
    else if (card.state === 'mastered') masteredCards += 1;

    if (card.lastReviewed && card.lastReviewed >= startOfTodayMs) {
      reviewedTodayCount += 1;
    }
    if (card.firstReviewedAt && card.firstReviewedAt >= startOfTodayMs) {
      newReviewedTodayCount += 1;
    }
  });

  const remainingNewSlots = dailyNewCardsLimit > 0
    ? Math.max(0, dailyNewCardsLimit - newReviewedTodayCount)
    : totalNewInDeck;

  const newCardsQueuedToday = Math.min(totalNewInDeck, remainingNewSlots);
  const dueToday = reviewDueCount + newCardsQueuedToday;

  return {
    totalCards,
    dueToday,
    newCards: newCardsQueuedToday,
    learningCards,
    reviewCards,
    masteredCards,
    reviewedTodayCount
  };
};

export const MAX_REVIEW_LOG_ENTRIES = 8000;

/**
 * Calculates real retention rate from review logs:
 * Among reviews of cards that already had interval >= 1 day, the fraction with rating >= 2 (not Again) in the last 30 days.
 */
export const calculateRealRetentionRate = (
  reviewLogs?: SRSReviewLogEntry[],
  days = 30,
  now = Date.now()
): { rate: number; count: number } | null => {
  if (!Array.isArray(reviewLogs) || reviewLogs.length === 0) return null;

  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const eligible = reviewLogs.filter(([_, timestamp, __, prevInterval]) => {
    const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    return time >= cutoff && prevInterval >= 1;
  });

  if (eligible.length < 5) {
    return null;
  }

  const successful = eligible.filter(([_, __, rating]) => rating >= 2);
  const rate = Math.round((successful.length / eligible.length) * 100);
  return { rate, count: eligible.length };
};

/**
 * Calculates retention rate:
 * - Uses real review logs if available and sufficient data exists
 * - Falls back to card state estimation if no logs, marking isEstimated: true
 * - Returns rate: null if insufficient data (< 5 reviews)
 */
export const estimateRetentionRate = (
  cards: SRSCard[],
  reviewLogs?: SRSReviewLogEntry[]
): { rate: number | null; isEstimated: boolean } => {
  const real = calculateRealRetentionRate(reviewLogs);
  if (real !== null) {
    return { rate: real.rate, isEstimated: false };
  }

  const reviewedCards = cards.filter(c => c.reps > 0 || c.lapses > 0);
  if (reviewedCards.length < 5) {
    return { rate: null, isEstimated: true };
  }

  let totalWeight = 0;
  let successWeight = 0;

  reviewedCards.forEach(c => {
    const trials = c.reps + c.lapses;
    totalWeight += trials;
    successWeight += c.reps;
  });

  if (totalWeight === 0) return { rate: null, isEstimated: true };
  const rate = Math.max(60, Math.min(99, Math.round((successWeight / totalWeight) * 100)));
  return { rate, isEstimated: true };
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
  retentionRate: number | null;
  isEstimated?: boolean;
}

/**
 * Generates a 30-day time series tracking cards moving from Learning to Mastered.
 * When review logs or masteredAt are available, uses real transition timestamps instead of fabricated dates.
 * Computes retentionRate for each day over the 30-day window ending on that day (or null if < 5 reviews).
 */
export const generate30DayRetentionData = (
  cards: SRSCard[],
  targetLanguage?: string,
  reviewLogs?: SRSReviewLogEntry[]
): RetentionProgressPoint[] => {
  const filtered = cards.filter(c => !targetLanguage || !c.targetLanguage || c.targetLanguage === targetLanguage);
  const now = Date.now();
  const ONE_DAY_MS = 86400000;
  
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayMs = endOfToday.getTime();

  // If logs exist, build a map of exact mastered timestamps
  // Mastered heuristic from logs: rating >= 3 and prevInterval * 2 >= 21
  const masteredDatesFromLogs = new Map<string, number>();
  if (Array.isArray(reviewLogs)) {
    reviewLogs.forEach(([cardId, timestamp, rating, prevInterval]) => {
      if (rating >= 3 && prevInterval * 2 >= 21) {
        const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
        if (!masteredDatesFromLogs.has(cardId) || time < masteredDatesFromLogs.get(cardId)!) {
          masteredDatesFromLogs.set(cardId, time);
        }
      }
    });
  }

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
      const cardCreated = card.storyTimestamp || card.firstReviewedAt || (now - 25 * ONE_DAY_MS);
      
      // Check if card existed on this day
      if (cardCreated <= dayEndMs) {
        const isMasteredNow = card.state === 'mastered';
        
        let graduationTime: number | null = null;
        if (card.masteredAt) {
          graduationTime = card.masteredAt;
        } else if (masteredDatesFromLogs.has(card.id)) {
          graduationTime = masteredDatesFromLogs.get(card.id)!;
        } else if (isMasteredNow) {
          // If no logs exist, use lastReviewed if valid, without fabricating +14 days
          graduationTime = card.lastReviewed || null;
        }

        if (graduationTime !== null && graduationTime <= dayEndMs) {
          masteredCount++;
          if (graduationTime >= dayStartMs && graduationTime <= dayEndMs) {
            graduatedToday++;
          }
        } else {
          learningCount++;
        }
      }
    });

    const totalActive = learningCount + masteredCount;

    // Rolling 30-day window ending on this day
    const windowStartMs = dayEndMs - 30 * ONE_DAY_MS;
    let dayRetentionRate: number | null = null;
    let isDayEstimated = false;

    if (Array.isArray(reviewLogs) && reviewLogs.length > 0) {
      const eligible = reviewLogs.filter(([_, timestamp, __, prevInterval]) => {
        const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
        return time >= windowStartMs && time <= dayEndMs && prevInterval >= 1;
      });

      if (eligible.length >= 5) {
        const successful = eligible.filter(([_, __, rating]) => rating >= 2);
        dayRetentionRate = Math.round((successful.length / eligible.length) * 100);
        isDayEstimated = false;
      } else {
        dayRetentionRate = null;
        isDayEstimated = true;
      }
    } else {
      dayRetentionRate = null;
      isDayEstimated = true;
    }

    dataPoints.push({
      date: dateLabel,
      fullDate: fullDateLabel,
      dayNumber: 30 - i,
      timestamp: dayEndMs,
      learning: learningCount,
      mastered: masteredCount,
      totalActive,
      graduatedToday,
      retentionRate: dayRetentionRate,
      isEstimated: isDayEstimated
    });
  }

  return dataPoints;
};

/**
 * Extracts weak words from SRS cards for priority reinforcement in story generation:
 * - Cards in targetLanguage that are in 'learning', have lapses > 0, or had Again/Hard in last 14 days
 * - Ordered from weakest to strongest
 */
export const getWeakWords = (
  cards: SRSCard[],
  targetLanguage: string,
  reviewLogs?: SRSReviewLogEntry[],
  now: number = Date.now()
): string[] => {
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  // Build card rating stats from logs if available
  const recentRatingsByCard = new Map<string, { againCount: number; hardCount: number }>();
  if (Array.isArray(reviewLogs)) {
    reviewLogs.forEach(([cardId, timestamp, rating]) => {
      const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
      if (time >= fourteenDaysAgo) {
        const current = recentRatingsByCard.get(cardId) || { againCount: 0, hardCount: 0 };
        if (rating === 1) current.againCount += 1;
        if (rating === 2) current.hardCount += 1;
        recentRatingsByCard.set(cardId, current);
      }
    });
  }

  // Filter cards of target language that qualify as weak
  const weakCandidates = cards.filter(card => {
    if (targetLanguage && card.targetLanguage && card.targetLanguage !== targetLanguage) {
      return false;
    }
    const logStats = recentRatingsByCard.get(card.id);
    const hasRecentAgainOrHard = logStats ? (logStats.againCount > 0 || logStats.hardCount > 0) : false;
    
    return card.state === 'learning' || (card.lapses || 0) > 0 || hasRecentAgainOrHard;
  });

  // Calculate weakness score (higher = weaker)
  const scored = weakCandidates.map(card => {
    let score = 0;
    if (card.state === 'learning') score += 10;
    score += (card.lapses || 0) * 4;
    score += Math.max(0, (2.5 - (card.easeFactor || 2.5)) * 4);

    const logStats = recentRatingsByCard.get(card.id);
    if (logStats) {
      score += logStats.againCount * 5;
      score += logStats.hardCount * 2;
    }

    return { card, score };
  });

  // Sort from weakest (highest score) to strongest
  scored.sort((a, b) => b.score - a.score);

  // Extract new_element, clean, lowercase, deduplicate
  const words: string[] = [];
  const seen = new Set<string>();

  for (const { card } of scored) {
    const rawWord = card.sentence?.new_element?.trim().toLowerCase();
    if (rawWord && !seen.has(rawWord) && rawWord.length >= 2) {
      seen.add(rawWord);
      words.push(rawWord);
    }
  }

  return words;
};
