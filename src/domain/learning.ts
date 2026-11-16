export type LearningConcept =
  | 'scaleSpelling' | 'keySignature' | 'stackedThirds' | 'triadQuality'
  | 'romanNumeral' | 'harmonicFunction' | 'relativeKey' | 'auralQuality';

export interface ReviewItem {
  id: string;
  keyId: string;
  concept: LearningConcept;
  degree: number;
  errorCount: number;
  lastReviewedAt: string;
  dueAt: string;
  correctStreak: number;
}

export interface AttemptState {
  errors: number;
  hints: number;
  phase: 'building' | 'assisted' | 'replay' | 'complete';
  assisted: boolean;
  replayRequired: boolean;
  score: number | null;
}

const boundedScore = (score: number): number =>
  Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0));

/** Errors count attempts before the correct answer. Sound and time never deduct points. */
export function calculateAttemptScore(errors: number, hints = 0, assisted = false): number {
  const base = assisted || errors >= 3 ? 20 : errors === 0 ? 100 : errors === 1 ? 70 : 40;
  return Math.max(0, base - Math.max(0, Math.floor(hints)) * 15);
}

export function calculateStars(scores: number[], assisted = false): 0 | 1 | 2 | 3 {
  if (scores.length === 0) return 0;
  const average = scores.reduce((sum, score) => sum + boundedScore(score), 0) / scores.length;
  return average >= 90 && !assisted ? 3 : average >= 75 ? 2 : 1;
}

export function calculateMasteryUpdate(oldMastery: number, attemptScore: number): number {
  return Math.round(boundedScore(oldMastery) * 0.8 + boundedScore(attemptScore) * 0.2);
}

export function createAttemptState(): AttemptState {
  return { errors: 0, hints: 0, phase: 'building', assisted: false, replayRequired: false, score: null };
}

/** The third failed submission reveals a model; it does not pass the question. */
export function recordIncorrect(state: AttemptState): AttemptState {
  if (state.phase === 'complete' || state.phase === 'assisted') return state;
  const errors = state.errors + 1;
  const assisted = state.assisted || errors >= 3;
  return { ...state, errors, assisted, replayRequired: assisted, phase: assisted ? 'assisted' : 'building', score: null };
}

export function recordHint(state: AttemptState): AttemptState {
  if (state.phase === 'complete') return state;
  return { ...state, hints: state.hints + 1 };
}

/** UI clears the demonstrated answer before the learner independently repeats it. */
export function beginReplay(state: AttemptState): AttemptState {
  return state.phase === 'assisted' ? { ...state, phase: 'replay', replayRequired: true } : state;
}

export function recordCorrect(state: AttemptState): AttemptState {
  if (state.phase === 'assisted' || state.phase === 'complete') return state;
  return {
    ...state,
    phase: 'complete',
    replayRequired: false,
    score: calculateAttemptScore(state.errors, state.hints, state.assisted),
  };
}

/** Due items first, then low mastery, elapsed review time, and repeated errors. */
export function selectReviewQuestions(
  queue: ReviewItem[],
  mastery: Record<string, number>,
  limit = 7,
  now: number | Date = Date.now(),
): ReviewItem[] {
  const nowMs = now instanceof Date ? now.getTime() : now;
  const unique = new Map<string, ReviewItem>();
  for (const item of queue) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  const priority = (item: ReviewItem): number => {
    const value = mastery[`${item.keyId}:${item.concept}`] ?? 0;
    const reviewedMs = Date.parse(item.lastReviewedAt);
    const daysSince = Number.isFinite(reviewedMs) ? Math.max(0, (nowMs - reviewedMs) / 86_400_000) : 0;
    const isDue = Date.parse(item.dueAt) <= nowMs;
    return (isDue ? 1000 : 0) + (100 - boundedScore(value)) + daysSince * 3 + item.errorCount * 5 + (item.correctStreak === 0 ? 10 : 0);
  };
  return [...unique.values()]
    .sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, Math.floor(limit)));
}
