import { HistoryItem, Sentence, SRSCard, SRSCardRating, SRSStats } from '../types';

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
 * Syncs sentences from completed stories in history into the user's SRS flashcard deck
 */
export const syncCardsFromHistory = (
  history: HistoryItem[],
  existingCards: SRSCard[],
  targetLanguage: string,
  nativeLanguage: string
): SRSCard[] => {
  const existingMap = new Map<string, SRSCard>();
  existingCards.forEach(c => existingMap.set(c.id, c));

  const result: SRSCard[] = [...existingCards];

  if (!Array.isArray(history)) return result;

  const now = Date.now();

  history.forEach(item => {
    if (!item || !item.completed || !Array.isArray(item.sentences)) return;

    item.sentences.forEach((sentence, idx) => {
      if (!sentence || !sentence.original) return;

      const sid = sentence.id ?? idx;
      const cardId = getCardId(item.timestamp, sid, sentence.original);

      if (!existingMap.has(cardId)) {
        const newCard: SRSCard = {
          id: cardId,
          storyTitle: item.story_title || 'Untitled Story',
          storyTimestamp: item.timestamp,
          sentence,
          targetLanguage: targetLanguage || 'Language',
          nativeLanguage: nativeLanguage || 'Native',
          state: 'new',
          reps: 0,
          lapses: 0,
          easeFactor: DEFAULT_EASE_FACTOR,
          interval: 0,
          dueDate: now // ready for review right away
        };
        existingMap.set(cardId, newCard);
        result.push(newCard);
      }
    });
  });

  return result;
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
 * Filters cards that are due for review today or newly introduced
 */
export const getDueCards = (cards: SRSCard[], targetLanguage?: string): SRSCard[] => {
  const now = Date.now();
  return cards
    .filter(card => {
      if (targetLanguage && card.targetLanguage && card.targetLanguage !== targetLanguage) {
        return false;
      }
      return card.state === 'new' || card.dueDate <= now;
    })
    .sort((a, b) => {
      // Prioritize learning cards first, then review due earliest, then new cards
      const order = { learning: 0, review: 1, new: 2, mastered: 3 };
      if (order[a.state] !== order[b.state]) {
        return order[a.state] - order[b.state];
      }
      return a.dueDate - b.dueDate;
    });
};

/**
 * Computes high-level statistics of the SRS deck
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
